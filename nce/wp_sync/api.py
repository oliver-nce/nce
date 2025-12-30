"""
WP Sync API

Whitelisted API methods for manual sync triggers and status checks.
"""

import frappe
from frappe import _


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
    Get column names from a WordPress table (for mapping UI).

    Args:
        table_name: Name of the WordPress table/view

    Returns:
        list: Column information
    """
    frappe.only_for("System Manager")

    from nce.wp_sync.doctype.wp_sync_settings.wp_sync_settings import get_wp_connection

    try:
        connection = get_wp_connection()
        cursor = connection.cursor()
        cursor.execute(f"DESCRIBE {table_name}")
        columns = cursor.fetchall()
        cursor.close()
        connection.close()

        return {
            "success": True,
            "columns": columns
        }
    except Exception as e:
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

