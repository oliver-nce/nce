"""
WP Sync Settings DocType Controller

Handles WordPress database connection settings and testing.
"""

import frappe
from frappe.model.document import Document


class WPSyncSettings(Document):
    """Settings for WordPress database synchronization."""

    def validate(self):
        """Validate settings before save."""
        if self.wp_db_port and (self.wp_db_port < 1 or self.wp_db_port > 65535):
            frappe.throw("Database port must be between 1 and 65535")

    @frappe.whitelist()
    def test_connection(self):
        """Test the WordPress database connection."""
        try:
            connection = get_wp_connection()
            if connection:
                connection.close()
                self.connection_status = "Connected Successfully"
                self.save()
                return {"success": True, "message": "Connection successful!"}
        except Exception as e:
            self.connection_status = f"Failed: {str(e)[:100]}"
            self.save()
            return {"success": False, "message": str(e)}


def get_wp_settings():
    """Get WP Sync Settings singleton."""
    return frappe.get_single("WP Sync Settings")


def get_wp_connection():
    """
    Create a connection to the WordPress database.
    
    Returns:
        pymysql.Connection: Database connection object
    
    Raises:
        Exception: If connection fails
    """
    import pymysql

    settings = get_wp_settings()

    if not settings.wp_db_host:
        frappe.throw("WordPress database settings not configured")

    connection = pymysql.connect(
        host=settings.wp_db_host,
        port=settings.wp_db_port or 3306,
        user=settings.wp_db_user,
        password=settings.get_password("wp_db_password"),
        database=settings.wp_db_name,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=10,
    )

    return connection

