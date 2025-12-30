"""
WP Sync Settings DocType Controller

Handles WordPress REST API connection settings and testing.
"""

import frappe
from frappe.model.document import Document
import requests
import base64


class WPSyncSettings(Document):
    """Settings for WordPress REST API synchronization."""

    def validate(self):
        """Validate settings before save."""
        if self.wp_site_url:
            # Ensure URL doesn't end with trailing slash
            self.wp_site_url = self.wp_site_url.rstrip('/')

    @frappe.whitelist()
    def test_connection(self):
        """Test the WordPress REST API connection."""
        try:
            # Test with a simple query
            result = execute_wp_query("SELECT 1 as test")
            if result and len(result) > 0:
                self.connection_status = "Connected Successfully"
                self.save()
                return {"success": True, "message": "Connection successful!"}
            else:
                raise Exception("Empty response from API")
        except Exception as e:
            self.connection_status = f"Failed: {str(e)[:100]}"
            self.save()
            return {"success": False, "message": str(e)}


def get_wp_settings():
    """Get WP Sync Settings singleton."""
    return frappe.get_single("WP Sync Settings")


def execute_wp_query(sql_query):
    """
    Execute a SQL query via WordPress REST API.
    
    Args:
        sql_query (str): SELECT or CALL SQL query to execute
    
    Returns:
        list: List of dictionaries with query results
    
    Raises:
        Exception: If API call fails or returns error
    """
    settings = get_wp_settings()

    if not settings.wp_site_url:
        frappe.throw("WordPress REST API settings not configured")

    # Build endpoint URL
    endpoint = f"{settings.wp_site_url}/wp-json/custom/v1/sql-query"

    # TEMPORARY: Use exact credentials from curl that works
    # TODO: Remove after testing
    encoded_credentials = "b3JlaWRAZmlyc3RnbS5jb206VkgwSlhWTDlQOUZrNkI5bklQMGhBbjZ5"
    
    # Prepare request payload
    payload = {"sql": sql_query}

    # Make API request
    try:
        response = requests.post(
            endpoint,
            json=payload,
            timeout=30,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "curl/8.7.1",
                "Accept": "*/*",
                "Authorization": f"Basic {encoded_credentials}"
            },
            verify=True
        )

        # Check for HTTP errors
        response.raise_for_status()

        # Parse JSON response
        data = response.json()

        # Check for WordPress error format
        if isinstance(data, dict) and data.get("code"):
            error_msg = data.get("message", "Unknown API error")
            frappe.throw(f"WordPress API Error: {error_msg}")

        # Extract result array
        if isinstance(data, dict) and "result" in data:
            return data["result"]
        else:
            frappe.throw(f"Unexpected API response format: {data}")

    except requests.exceptions.RequestException as e:
        frappe.throw(f"API request failed: {str(e)}")
    except ValueError as e:
        frappe.throw(f"Failed to parse API response: {str(e)}")

