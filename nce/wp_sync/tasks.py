"""
WP Sync Tasks

Scheduled and on-demand sync tasks for WordPress → Frappe data synchronization.
"""

import json
import frappe
from frappe.utils import now_datetime, add_to_date, get_datetime

from nce.wp_sync.doctype.wp_sync_settings.wp_sync_settings import execute_wp_query, get_wp_settings
from nce.wp_sync.doctype.wp_sync_log.wp_sync_log import create_sync_log


def build_incremental_where_clause(task):
    """
    Build WHERE clause for incremental sync based on updated_at field.
    
    Args:
        task: WP Sync Task document
    
    Returns:
        str: WHERE clause condition or empty string
    """
    # Check if incremental sync is enabled and configured
    if not task.use_incremental_sync:
        return ""
    
    if not task.updated_at_field:
        return ""
    
    if not task.last_run_at:
        # First run - no incremental filter
        return ""
    
    # Calculate cutoff time with buffer
    buffer_minutes = task.sync_buffer_minutes or 3
    cutoff_time = add_to_date(task.last_run_at, minutes=-buffer_minutes)
    
    # Format timestamp for SQL
    # Handle timezone - if WordPress stores in UTC, we use UTC
    # If WordPress uses local time, we need to convert
    if task.updated_at_timezone == "UTC":
        # Format as UTC timestamp
        cutoff_str = cutoff_time.strftime("%Y-%m-%d %H:%M:%S")
    else:
        # Server local time - use as-is
        cutoff_str = cutoff_time.strftime("%Y-%m-%d %H:%M:%S")
    
    # Build the condition
    condition = f"{task.updated_at_field} >= '{cutoff_str}'"
    
    return condition


def run_scheduled_sync():
    """
    Run all enabled sync tasks in order.
    Called by the scheduler (configured in hooks.py).
    """
    settings = get_wp_settings()

    # Check if sync is enabled
    if not settings.sync_enabled:
        frappe.logger().info("WP Sync: Scheduled sync is disabled")
        return

    # Get all enabled tasks, ordered by execution_order
    tasks = frappe.get_all(
        "WP Sync Task",
        filters={"enabled": 1},
        fields=["name"],
        order_by="execution_order asc"
    )

    if not tasks:
        frappe.logger().info("WP Sync: No enabled tasks found")
        return

    frappe.logger().info(f"WP Sync: Starting scheduled sync with {len(tasks)} tasks")

    results = []
    for task in tasks:
        result = run_single_task(task.name)
        results.append(result)

        # If a task fails, continue with others (can be made configurable)
        if result.get("status") == "Failed":
            frappe.logger().error(f"WP Sync: Task {task.name} failed: {result.get('error')}")

    # Update last sync time in settings
    settings.last_sync_at = now_datetime()
    settings.save(ignore_permissions=True)
    frappe.db.commit()

    return results


def run_single_task(task_name):
    """
    Run a single sync task by name.

    Args:
        task_name: Name of the WP Sync Task to run

    Returns:
        dict: Result with status, rows_processed, error, etc.
    """
    task = frappe.get_doc("WP Sync Task", task_name)

    # Create log entry
    log = create_sync_log(task_name)

    try:
        # Determine sync direction
        if task.sync_direction == "WP to Frappe":
            result = sync_wp_to_frappe(task)
        elif task.sync_direction == "Frappe to WP":
            result = sync_frappe_to_wp(task)
        else:  # Bidirectional
            result = sync_bidirectional(task)

        # Update log with success
        log.complete(
            status="Success",
            rows_processed=result.get("rows_processed", 0),
            rows_inserted=result.get("rows_inserted", 0),
            rows_updated=result.get("rows_updated", 0),
            rows_skipped=result.get("rows_skipped", 0),
        )

        # Update task status
        task.update_status("Success", result.get("rows_processed", 0))

        return {"status": "Success", **result}

    except Exception as e:
        error_msg = str(e)
        frappe.log_error(f"WP Sync Task Failed: {task_name}\n{error_msg}", "WP Sync Error")

        # Update log with failure
        log.complete(
            status="Failed",
            error_message=error_msg
        )

        # Update task status
        task.update_status("Failed", error=error_msg)

        return {"status": "Failed", "error": error_msg}


def sync_wp_to_frappe(task):
    """
    Sync data from WordPress table to Frappe DocType via REST API.

    Args:
        task: WP Sync Task document

    Returns:
        dict: Result with counts
    """
    # First, sync schema - add any new columns from WP to DocType
    # Skip for generic WP Table Data (uses JSON field)
    if task.target_doctype != "WP Table Data":
        from nce.wp_sync.api import sync_doctype_schema
        schema_result = sync_doctype_schema(task.source_table, task.target_doctype)
        if schema_result.get("fields_added", 0) > 0:
            frappe.logger().info(
                f"WP Sync: Added {schema_result['fields_added']} new field(s) to {task.target_doctype}"
            )
    
    # Build query
    query = f"SELECT * FROM {task.source_table}"
    
    # Collect WHERE conditions
    where_conditions = []
    
    # Add user-defined WHERE clause
    if task.where_clause:
        where_conditions.append(f"({task.where_clause})")
    
    # Add incremental sync condition
    incremental_condition = build_incremental_where_clause(task)
    if incremental_condition:
        where_conditions.append(f"({incremental_condition})")
    
    # Combine conditions
    if where_conditions:
        query += " WHERE " + " AND ".join(where_conditions)

    # Execute query via REST API
    rows = execute_wp_query(query)

    if not rows:
        return {"rows_processed": 0, "rows_inserted": 0, "rows_updated": 0, "rows_skipped": 0}

    # Get field mapping
    field_mapping = task.get_field_mapping()

    # Check if syncing to generic WP Table Data
    is_generic = task.target_doctype == "WP Table Data"

    # Auto-generate field mapping if not provided (for auto-created DocTypes)
    # Maps WP column names directly to lowercase Frappe field names
    if not is_generic and (not field_mapping or len(field_mapping) == 0) and rows:
        field_mapping = {}
        for col_name in rows[0].keys():
            # Frappe field name is lowercase with underscores (same as WP column)
            frappe_fieldname = col_name.lower().replace(' ', '_')
            field_mapping[col_name] = frappe_fieldname

    if is_generic:
        # For generic storage, just need record_id mapping
        source_id_field = None
        for wp_col, frappe_field in field_mapping.items():
            if frappe_field == "record_id":
                source_id_field = wp_col
                break
        if not source_id_field:
            source_id_field = "id"  # Default
    else:
        # Find the source ID field (maps to track_record_id)
        source_id_field = None
        for wp_col, frappe_field in field_mapping.items():
            if frappe_field == "track_record_id":
                source_id_field = wp_col
                break
        
        # If not explicitly mapped, find a suitable ID column
        if not source_id_field and rows:
            row_keys = list(rows[0].keys())
            # Try common ID column patterns
            for col in row_keys:
                col_lower = col.lower()
                if col_lower == 'id' or col_lower.endswith('_id'):
                    source_id_field = col
                    break
            # Fallback to first column
            if not source_id_field:
                source_id_field = row_keys[0]
            
            # Note: Don't overwrite field_mapping here - we need the data field
            # to be populated too. track_record_id is set separately below.

    rows_inserted = 0
    rows_updated = 0
    rows_skipped = 0

    for row in rows:
        try:
            source_id = str(row.get(source_id_field))
            if not source_id:
                rows_skipped += 1
                continue

            if is_generic:
                # Generic WP Table Data: use table_name + record_id as unique key
                existing = frappe.db.exists(task.target_doctype, {
                    "table_name": task.source_table,
                    "record_id": source_id
                })
                
                if existing:
                    # Update existing record
                    doc = frappe.get_doc(task.target_doctype, existing)
                    doc.data = row  # Store all data in JSON field
                    doc.synced_at = now_datetime()
                    doc.save(ignore_permissions=True)
                    rows_updated += 1
                else:
                    # Insert new record
                    doc = frappe.get_doc({
                        "doctype": task.target_doctype,
                        "table_name": task.source_table,
                        "record_id": source_id,
                        "data": row,  # All WordPress columns as JSON
                        "synced_at": now_datetime()
                    })
                    doc.insert(ignore_permissions=True)
                    rows_inserted += 1
            else:
                # Specific DocType: use field mapping
                existing = frappe.db.exists(task.target_doctype, {"track_record_id": source_id})

                # Build field values
                values = {}
                for wp_col, frappe_field in field_mapping.items():
                    if wp_col in row:
                        value = row[wp_col]
                        # Handle None values
                        if value is not None:
                            values[frappe_field] = value

                # Set tracking fields
                values["track_source_table"] = task.source_table
                values["track_last_synced"] = now_datetime()

                if existing:
                    # Update existing record
                    doc = frappe.get_doc(task.target_doctype, existing)
                    for field, value in values.items():
                        if field != "track_record_id":  # Don't update the key field
                            setattr(doc, field, value)
                    doc.save(ignore_permissions=True)
                    rows_updated += 1
                else:
                    # Insert new record
                    values["doctype"] = task.target_doctype
                    values["track_record_id"] = source_id
                    doc = frappe.get_doc(values)
                    doc.insert(ignore_permissions=True)
                    rows_inserted += 1

        except Exception as e:
            frappe.log_error(f"Error syncing row {row}: {str(e)}", "WP Sync Row Error")
            rows_skipped += 1

    frappe.db.commit()

    return {
        "rows_processed": len(rows),
        "rows_inserted": rows_inserted,
        "rows_updated": rows_updated,
        "rows_skipped": rows_skipped
    }


def sync_frappe_to_wp(task):
    """
    Sync data from Frappe DocType to WordPress table.
    (To be implemented for bidirectional sync)

    Args:
        task: WP Sync Task document

    Returns:
        dict: Result with counts
    """
    # TODO: Implement Frappe → WP sync
    frappe.throw("Frappe to WP sync not yet implemented")


def sync_bidirectional(task):
    """
    Bidirectional sync between WordPress and Frappe.
    (To be implemented)

    Args:
        task: WP Sync Task document

    Returns:
        dict: Result with counts
    """
    # TODO: Implement bidirectional sync with conflict resolution
    frappe.throw("Bidirectional sync not yet implemented")


def cleanup_old_logs():
    """
    Clean up old sync logs (older than 30 days).
    Called daily by scheduler.
    """
    from frappe.utils import add_days

    cutoff_date = add_days(now_datetime(), -30)

    old_logs = frappe.get_all(
        "WP Sync Log",
        filters={"started_at": ["<", cutoff_date]},
        fields=["name"]
    )

    for log in old_logs:
        frappe.delete_doc("WP Sync Log", log.name, ignore_permissions=True)

    frappe.db.commit()

    if old_logs:
        frappe.logger().info(f"WP Sync: Cleaned up {len(old_logs)} old log entries")

