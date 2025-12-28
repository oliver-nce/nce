"""
WP Zoho Registration DocType Controller

Mirror of wp_zoho_registrations_new_site table from WordPress.
"""

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class WPZohoRegistration(Document):
    """A registration record mirrored from WordPress."""

    def before_save(self):
        """Update synced_at timestamp on every save."""
        self.synced_at = now_datetime()

