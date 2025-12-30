"""
WP Sync API

Whitelisted API methods for manual sync triggers and status checks.
"""

import frappe
from frappe import _
import re


def mysql_type_to_frappe_fieldtype(mysql_type):
    """
    Convert MySQL column type to Frappe fieldtype.
    
    Args:
        mysql_type: MySQL column type string (e.g., 'varchar(255)', 'int(11)', 'decimal(10,2)')
    
    Returns:
        str: Corresponding Frappe fieldtype
    """
    if not mysql_type:
        return "Data"
    
    # Normalize to lowercase for matching
    mysql_type = mysql_type.lower().strip()
    
    # Extract base type (remove size/precision info)
    base_type = re.split(r'[\(\s]', mysql_type)[0]
    
    # Integer types
    if base_type in ('int', 'integer', 'bigint', 'mediumint', 'smallint', 'tinyint'):
        # Check if it's a boolean (tinyint(1))
        if base_type == 'tinyint' and '(1)' in mysql_type:
            return "Check"
        return "Int"
    
    # Decimal/Float types
    if base_type in ('decimal', 'numeric', 'float', 'double', 'real'):
        return "Float"
    
    # String types
    if base_type in ('varchar', 'char'):
        # Check length - if > 140, use Small Text
        match = re.search(r'\((\d+)\)', mysql_type)
        if match:
            length = int(match.group(1))
            if length > 140:
                return "Small Text"
        return "Data"
    
    # Text types
    if base_type in ('text', 'mediumtext', 'longtext'):
        return "Text"
    if base_type == 'tinytext':
        return "Small Text"
    
    # Date/Time types
    if base_type == 'date':
        return "Date"
    if base_type in ('datetime', 'timestamp'):
        return "Datetime"
    if base_type == 'time':
        return "Time"
    
    # JSON type
    if base_type == 'json':
        return "JSON"
    
    # Enum type
    if base_type == 'enum':
        return "Select"
    
    # Set type
    if base_type == 'set':
        return "Select"
    
    # Binary types
    if base_type in ('blob', 'mediumblob', 'longblob', 'binary', 'varbinary'):
        return "Text"
    
    # Default to Data for unknown types
    return "Data"


def get_enum_options(mysql_type):
    """
    Extract options from MySQL ENUM type definition.
    
    Args:
        mysql_type: MySQL ENUM type string (e.g., "enum('active','inactive','pending')")
    
    Returns:
        str: Newline-separated options for Frappe Select field, or empty string
    """
    if not mysql_type or not mysql_type.lower().startswith('enum'):
        return ""
    
    # Extract values between parentheses
    match = re.search(r"enum\s*\((.+)\)", mysql_type, re.IGNORECASE)
    if not match:
        return ""
    
    # Parse the comma-separated quoted values
    values_str = match.group(1)
    # Match quoted strings (handles both single and double quotes)
    values = re.findall(r"['\"]([^'\"]+)['\"]", values_str)
    
    return "\n".join(values)


def generate_doctype_from_wp_table(table_name, columns, doctype_name=None):
    """
    Generate a Frappe DocType definition from WordPress table columns.
    
    Args:
        table_name: Original WordPress table name
        columns: List of column dicts from get_wp_table_columns()
        doctype_name: Optional custom DocType name (defaults to formatted table_name)
    
    Returns:
        dict: Complete DocType definition ready for creation
    """
    # Generate DocType name from table name if not provided
    if not doctype_name:
        # Convert table_name to Title Case (e.g., "wp_users" -> "WP Users")
        doctype_name = table_name.replace('_', ' ').title()
        # Prefix with "WP " if not already
        if not doctype_name.upper().startswith('WP '):
            doctype_name = f"WP {doctype_name}"
    
    # Find primary key column
    primary_key_col = None
    for col in columns:
        if col.get('IS_PRIMARY_KEY') == 'YES':
            primary_key_col = col.get('COLUMN_NAME')
            break
    
    # Build fields list
    fields = []
    field_order = []
    
    # Add a section break for main data
    fields.append({
        "fieldname": "wp_data_section",
        "fieldtype": "Section Break",
        "label": "WordPress Data"
    })
    field_order.append("wp_data_section")
    
    # Add source table reference field (hidden, for tracking)
    fields.append({
        "fieldname": "track_source_table",
        "fieldtype": "Data",
        "label": "Source Table",
        "default": table_name,
        "read_only": 1,
        "hidden": 1
    })
    field_order.append("track_source_table")
    
    # Add source record ID field (for linking back to WP)
    fields.append({
        "fieldname": "track_record_id",
        "fieldtype": "Data",
        "label": "Record ID",
        "read_only": 1,
        "in_list_view": 1,
        "in_standard_filter": 1
    })
    field_order.append("track_record_id")
    
    # Add column break
    fields.append({
        "fieldname": "column_break_1",
        "fieldtype": "Column Break"
    })
    field_order.append("column_break_1")
    
    # Add last synced timestamp
    fields.append({
        "fieldname": "track_last_synced",
        "fieldtype": "Datetime",
        "label": "Last Synced",
        "read_only": 1
    })
    field_order.append("track_last_synced")
    
    # Add section break for WordPress columns
    fields.append({
        "fieldname": "wp_columns_section",
        "fieldtype": "Section Break",
        "label": "Data Fields"
    })
    field_order.append("wp_columns_section")
    
    # Convert each WordPress column to a Frappe field
    col_count = 0
    for col in columns:
        col_name = col.get('COLUMN_NAME', '')
        col_type = col.get('COLUMN_TYPE', '')
        is_nullable = col.get('IS_NULLABLE', 'YES')
        col_default = col.get('COLUMN_DEFAULT')
        is_pk = col.get('IS_PRIMARY_KEY') == 'YES'
        is_unique = col.get('IS_UNIQUE') == 'YES'
        is_indexed = col.get('IS_INDEXED') == 'YES'
        
        # Skip if no column name
        if not col_name:
            continue
        
        # Generate fieldname (lowercase, underscores) - keep same as WP column name
        fieldname = col_name.lower().replace(' ', '_')
        
        # Get Frappe fieldtype
        fieldtype = mysql_type_to_frappe_fieldtype(col_type)
        
        # Build field definition
        field_def = {
            "fieldname": fieldname,
            "fieldtype": fieldtype,
            "label": col_name.replace('_', ' ').title(),
            "reqd": 1 if is_nullable == 'NO' and not is_pk else 0
        }
        
        # Add options for Select fields (ENUM)
        if fieldtype == "Select":
            options = get_enum_options(col_type)
            if options:
                field_def["options"] = options
        
        # Set default if present
        if col_default is not None and col_default != 'NULL':
            field_def["default"] = col_default
        
        # Primary key field settings
        if is_pk:
            field_def["in_list_view"] = 1
            field_def["unique"] = 1
        # Unique index (non-primary)
        elif is_unique:
            field_def["unique"] = 1
        # Regular index
        elif is_indexed:
            field_def["search_index"] = 1
        
        # Add to first 3 columns in list view
        if col_count < 3:
            field_def["in_list_view"] = 1
        
        fields.append(field_def)
        field_order.append(fieldname)
        
        # Add column break every 2 fields for better layout
        col_count += 1
        if col_count % 2 == 0 and col_count < len(columns):
            cb_name = f"column_break_{col_count}"
            fields.append({
                "fieldname": cb_name,
                "fieldtype": "Column Break"
            })
            field_order.append(cb_name)
    
    # Build complete DocType definition
    doctype_def = {
        "doctype": "DocType",
        "name": doctype_name,
        "module": "WP Sync",
        "naming_rule": "Expression",
        "autoname": f"WP-{table_name[:10].upper()}-" + ".#####",
        "title_field": "track_record_id",
        "engine": "InnoDB",
        "is_submittable": 0,
        "istable": 0,
        "quick_entry": 0,
        "track_changes": 1,
        "fields": fields,
        "field_order": field_order,
        "permissions": [
            {
                "role": "System Manager",
                "read": 1,
                "write": 1,
                "create": 1,
                "delete": 1
            }
        ],
        "sort_field": "modified",
        "sort_order": "DESC"
    }
    
    return doctype_def


@frappe.whitelist()
def create_mirror_doctype(table_name, doctype_name=None):
    """
    Create a Frappe DocType that mirrors a WordPress table structure.
    
    This endpoint:
    1. Queries WordPress for the table structure via REST API
    2. Generates a DocType definition with mapped field types
    3. Creates the DocType in Frappe (if it doesn't exist)
    4. Returns the created DocType info
    
    Args:
        table_name: Name of the WordPress table/view to mirror
        doctype_name: Optional custom name for the DocType
    
    Returns:
        dict: Success status and DocType information
    """
    frappe.only_for("System Manager")
    
    # Step 1: Get table columns from WordPress
    columns_result = get_wp_table_columns(table_name)
    
    if not columns_result.get("success"):
        return {
            "success": False,
            "message": f"Failed to get table structure: {columns_result.get('message')}"
        }
    
    columns = columns_result.get("columns", [])
    
    if not columns:
        return {
            "success": False,
            "message": f"No columns found for table '{table_name}'"
        }
    
    # Step 2: Generate DocType definition
    doctype_def = generate_doctype_from_wp_table(table_name, columns, doctype_name)
    final_doctype_name = doctype_def.get("name")
    
    # Step 3: Check if DocType already exists
    if frappe.db.exists("DocType", final_doctype_name):
        return {
            "success": False,
            "message": f"DocType '{final_doctype_name}' already exists",
            "doctype_name": final_doctype_name,
            "exists": True
        }
    
    # Step 4: Create the DocType
    try:
        doc = frappe.get_doc(doctype_def)
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"DocType '{final_doctype_name}' created successfully",
            "doctype_name": final_doctype_name,
            "field_count": len(columns),
            "columns": [c.get("COLUMN_NAME") for c in columns]
        }
    except Exception as e:
        frappe.log_error(f"Error creating DocType for {table_name}: {str(e)}", "WP Sync Error")
        return {
            "success": False,
            "message": f"Failed to create DocType: {str(e)}"
        }


@frappe.whitelist()
def sync_doctype_schema(table_name, doctype_name):
    """
    Sync DocType schema with WordPress table - adds new columns only.
    Never removes fields (safe - preserves data).
    
    Args:
        table_name: WordPress table name
        doctype_name: Frappe DocType name
    
    Returns:
        dict: Results showing added fields
    """
    frappe.only_for("System Manager")
    
    # Check DocType exists
    if not frappe.db.exists("DocType", doctype_name):
        return {
            "success": False,
            "message": f"DocType '{doctype_name}' does not exist"
        }
    
    # Get WP table columns
    wp_result = get_wp_table_columns(table_name)
    if not wp_result.get("success"):
        return {
            "success": False,
            "message": f"Failed to get WP columns: {wp_result.get('message')}"
        }
    
    wp_columns = wp_result.get("columns", [])
    
    # Get existing DocType fields
    doctype_doc = frappe.get_doc("DocType", doctype_name)
    existing_fieldnames = {f.fieldname for f in doctype_doc.fields}
    
    # Find new columns (not in DocType)
    new_fields = []
    for col in wp_columns:
        col_name = col.get("COLUMN_NAME", "")
        if not col_name:
            continue
        
        # Generate fieldname (same logic as generate_doctype_from_wp_table)
        fieldname = col_name.lower().replace(' ', '_')
        
        # Check if field exists
        if fieldname not in existing_fieldnames:
            # This is a new column - add it
            col_type = col.get("COLUMN_TYPE", "")
            is_nullable = col.get("IS_NULLABLE", "YES")
            is_unique = col.get("IS_UNIQUE") == "YES"
            is_indexed = col.get("IS_INDEXED") == "YES"
            is_pk = col.get("IS_PRIMARY_KEY") == "YES"
            
            fieldtype = mysql_type_to_frappe_fieldtype(col_type)
            
            field_def = {
                "fieldname": fieldname,
                "fieldtype": fieldtype,
                "label": col_name.replace('_', ' ').title(),
                "reqd": 0,  # Don't make required - existing records won't have it
                "insert_after": doctype_doc.fields[-1].fieldname if doctype_doc.fields else None
            }
            
            # Add index settings
            if is_pk or is_unique:
                field_def["unique"] = 1
            elif is_indexed:
                field_def["search_index"] = 1
            
            # Add options for Select fields
            if fieldtype == "Select":
                options = get_enum_options(col_type)
                if options:
                    field_def["options"] = options
            
            new_fields.append(field_def)
    
    if not new_fields:
        return {
            "success": True,
            "message": "Schema is up to date - no new columns found",
            "fields_added": 0
        }
    
    # Add new fields to DocType
    try:
        for field_def in new_fields:
            doctype_doc.append("fields", field_def)
        
        doctype_doc.save(ignore_permissions=True)
        frappe.db.commit()
        
        # Clear cache so new fields take effect
        frappe.clear_cache(doctype=doctype_name)
        
        return {
            "success": True,
            "message": f"Added {len(new_fields)} new field(s)",
            "fields_added": len(new_fields),
            "new_fields": [f["fieldname"] for f in new_fields]
        }
    except Exception as e:
        frappe.log_error(f"Error adding fields to {doctype_name}: {str(e)}", "WP Sync Error")
        return {
            "success": False,
            "message": f"Failed to add fields: {str(e)}"
        }


@frappe.whitelist()
def run_all_tasks():
    """
    Manually trigger all enabled sync tasks.

    Returns:
        dict: Results from all tasks
    """
    from nce.wp_sync.tasks import run_scheduled_sync

    frappe.only_for("System Manager")

    results = run_scheduled_sync()
    return {
        "success": True,
        "message": f"Executed {len(results)} tasks",
        "results": results
    }


@frappe.whitelist()
def run_task(task_name):
    """
    Manually trigger a specific sync task.

    Args:
        task_name: Name of the WP Sync Task

    Returns:
        dict: Result from the task
    """
    from nce.wp_sync.tasks import run_single_task

    frappe.only_for("System Manager")

    if not frappe.db.exists("WP Sync Task", task_name):
        frappe.throw(_("Task {0} not found").format(task_name))

    result = run_single_task(task_name)
    return result


@frappe.whitelist()
def run_multiple_tasks(task_names):
    """
    Manually trigger multiple sync tasks.

    Args:
        task_names: List of WP Sync Task names (JSON array)

    Returns:
        dict: Results from all tasks
    """
    from nce.wp_sync.tasks import run_single_task
    import json

    frappe.only_for("System Manager")
    
    # Parse task names if passed as JSON string
    if isinstance(task_names, str):
        task_names = json.loads(task_names)
    
    results = []
    for task_name in task_names:
        if frappe.db.exists("WP Sync Task", task_name):
            result = run_single_task(task_name)
            results.append(result)
    
    return {
        "success": True,
        "tasks_run": len(results),
        "results": results
    }


@frappe.whitelist()
def test_wp_connection():
    """
    Test the WordPress database connection.

    Returns:
        dict: Connection status
    """
    frappe.only_for("System Manager")

    from nce.wp_sync.doctype.wp_sync_settings.wp_sync_settings import get_wp_connection

    try:
        connection = get_wp_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        connection.close()
        return {"success": True, "message": "Connection successful!"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@frappe.whitelist()
def get_wp_table_columns(table_name):
    """
    Get column information from a WordPress table via REST API.
    
    Uses simple SHOW COLUMNS query which returns:
    - Field, Type, Null, Key (PRI/UNI/MUL), Default, Extra

    Args:
        table_name: Name of the WordPress table/view

    Returns:
        dict: Success status and column information
    """
    frappe.only_for("System Manager")

    from nce.wp_sync.doctype.wp_sync_settings.wp_sync_settings import execute_wp_query

    # Validate table name (basic security check)
    if not table_name or not isinstance(table_name, str):
        return {"success": False, "message": "Invalid table name"}
    
    # Remove any potential SQL injection attempts (basic sanitization)
    table_name = table_name.strip().replace('`', '').replace(';', '').replace('--', '')
    
    # Simple query to get column info
    query = f"SHOW COLUMNS FROM {table_name}"

    try:
        raw_columns = execute_wp_query(query)
        
        # Normalize output to consistent format for generate_doctype_from_wp_table
        columns = []
        for col in raw_columns:
            columns.append({
                "COLUMN_NAME": col.get("Field"),
                "COLUMN_TYPE": col.get("Type"),
                "IS_NULLABLE": col.get("Null", "YES"),
                "COLUMN_DEFAULT": col.get("Default"),
                "EXTRA": col.get("Extra", ""),
                "KEY": col.get("Key", ""),  # PRI, UNI, MUL, or empty
                "IS_PRIMARY_KEY": "YES" if col.get("Key") == "PRI" else "NO",
                "IS_UNIQUE": "YES" if col.get("Key") == "UNI" else "NO",
                "IS_INDEXED": "YES" if col.get("Key") in ("PRI", "UNI", "MUL") else "NO"
            })
        
        return {
            "success": True,
            "table_name": table_name,
            "columns": columns,
            "column_count": len(columns)
        }
    except Exception as e:
        frappe.log_error(f"Error getting table columns for {table_name}: {str(e)}", "WP Sync Error")
        return {"success": False, "message": str(e)}


@frappe.whitelist()
def get_sync_status():
    """
    Get overall sync status and recent logs.

    Returns:
        dict: Status information
    """
    frappe.only_for("System Manager")

    from nce.wp_sync.doctype.wp_sync_settings.wp_sync_settings import get_wp_settings

    settings = get_wp_settings()

    # Get recent logs
    recent_logs = frappe.get_all(
        "WP Sync Log",
        fields=["name", "task", "status", "started_at", "completed_at", "rows_processed"],
        order_by="started_at desc",
        limit=10
    )

    # Get task counts
    total_tasks = frappe.db.count("WP Sync Task")
    enabled_tasks = frappe.db.count("WP Sync Task", {"enabled": 1})

    return {
        "sync_enabled": settings.sync_enabled,
        "last_sync_at": settings.last_sync_at,
        "connection_status": settings.connection_status,
        "total_tasks": total_tasks,
        "enabled_tasks": enabled_tasks,
        "recent_logs": recent_logs
    }

