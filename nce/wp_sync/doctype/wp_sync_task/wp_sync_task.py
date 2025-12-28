"""
WP Sync Task DocType Controller

Defines individual sync tasks between WordPress and Frappe.
"""

import json
import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class WPSyncTask(Document):
    """A single sync task definition."""

    def validate(self):
        """Validate the task configuration."""
        # Validate JSON field mapping
        if self.field_mapping:
            try:
                mapping = json.loads(self.field_mapping)
                if not isinstance(mapping, dict):
                    frappe.throw("Field mapping must be a JSON object (dictionary)")
            except json.JSONDecodeError as e:
                frappe.throw(f"Invalid JSON in field mapping: {e}")

    def get_field_mapping(self):
        """Get field mapping as a Python dictionary."""
        if self.field_mapping:
            return json.loads(self.field_mapping)
        return {}

    @frappe.whitelist()
    def run_now(self):
        """Manually trigger this sync task."""
        from nce.wp_sync.tasks import run_single_task

        result = run_single_task(self.name)
        return result

    def update_status(self, status, rows=0, error=None):
        """Update the task status after execution."""
        self.last_run_at = now_datetime()
        self.last_run_status = status
        self.rows_synced = rows
        self.last_error = error[:500] if error else None
        self.save(ignore_permissions=True)

