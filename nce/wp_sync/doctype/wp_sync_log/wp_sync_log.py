"""
WP Sync Log DocType Controller

Logs each sync execution with timing and results.
"""

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, time_diff_in_seconds


class WPSyncLog(Document):
    """Log entry for a sync execution."""

    def complete(self, status, rows_processed=0, rows_inserted=0, rows_updated=0,
                 rows_skipped=0, rows_failed=0, error_message=None, log_details=None):
        """Mark the log as complete with results."""
        self.completed_at = now_datetime()
        self.status = status
        self.duration_seconds = time_diff_in_seconds(self.completed_at, self.started_at)
        self.rows_processed = rows_processed
        self.rows_inserted = rows_inserted
        self.rows_updated = rows_updated
        self.rows_skipped = rows_skipped
        self.rows_failed = rows_failed
        self.error_message = error_message
        if log_details:
            import json
            self.log_details = json.dumps(log_details)
        self.save(ignore_permissions=True)


def create_sync_log(task_name):
    """Create a new sync log entry."""
    log = frappe.get_doc({
        "doctype": "WP Sync Log",
        "task": task_name,
        "status": "Running",
        "started_at": now_datetime()
    })
    log.insert(ignore_permissions=True)
    frappe.db.commit()
    return log

