"""
WP Sync Tasks

Scheduled and on-demand sync tasks for WordPress → Frappe data synchronization.
"""

import json
import frappe
from frappe.utils import now_datetime

from nce.wp_sync.doctype.wp_sync_settings.wp_sync_settings import get_wp_connection, get_wp_settings
from nce.wp_sync.doctype.wp_sync_log.wp_sync_log import create_sync_log


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
    Sync data from WordPress table to Frappe DocType.

    Args:
        task: WP Sync Task document

    Returns:
        dict: Result with counts
    """
    connection = get_wp_connection()
    cursor = connection.cursor()

    try:
        # Build query
        query = f"SELECT * FROM {task.source_table}"
        if task.where_clause:
            query += f" WHERE {task.where_clause}"

        cursor.execute(query)
        rows = cursor.fetchall()

        if not rows:
            return {"rows_processed": 0, "rows_inserted": 0, "rows_updated": 0, "rows_skipped": 0}

        # Get field mapping
        field_mapping = task.get_field_mapping()

        # If no mapping provided, try to auto-map (column names to field names)
        if not field_mapping:
            # Use column names as-is (assuming they match Frappe field names)
            field_mapping = {col: col for col in rows[0].keys()}

        # Find the source ID field (maps to wp_source_id)
        source_id_field = None
        for wp_col, frappe_field in field_mapping.items():
            if frappe_field == "wp_source_id":
                source_id_field = wp_col
                break

        # Default to 'id' if not specified
        if not source_id_field:
            source_id_field = "id"
            field_mapping["id"] = "wp_source_id"

        rows_inserted = 0
        rows_updated = 0
        rows_skipped = 0

        for row in rows:
            try:
                source_id = str(row.get(source_id_field))
                if not source_id:
                    rows_skipped += 1
                    continue

                # Check if record exists
                existing = frappe.db.exists(task.target_doctype, {"wp_source_id": source_id})

                # Build field values
                values = {}
                for wp_col, frappe_field in field_mapping.items():
                    if wp_col in row:
                        value = row[wp_col]
                        # Handle None values
                        if value is not None:
                            values[frappe_field] = value

                # Store raw data for debugging
                values["raw_data"] = json.dumps(row, default=str)
                values["synced_at"] = now_datetime()

                if existing:
                    # Update existing record
                    doc = frappe.get_doc(task.target_doctype, existing)
                    for field, value in values.items():
                        if field != "wp_source_id":  # Don't update the key field
                            setattr(doc, field, value)
                    doc.save(ignore_permissions=True)
                    rows_updated += 1
                else:
                    # Insert new record
                    values["doctype"] = task.target_doctype
                    values["wp_source_id"] = source_id
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

    finally:
        cursor.close()
        connection.close()


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

