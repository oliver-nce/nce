"""
NCE Frappe App Hooks

Hooks are configuration points for the Frappe framework.
This file defines app metadata, scheduled jobs, and other integrations.
"""

app_name = "nce"
app_title = "NCE"
app_publisher = "NCE"
app_description = "WordPress to Frappe data synchronization"
app_email = "dev@ncesoccer.com"
app_license = "MIT"

# Required apps (dependencies)
# required_apps = []

# Includes in <head>
# ------------------
# include js, css files in header of desk.html
app_include_css = "/assets/nce/css/nce_theme.css"
app_include_js = [
    "/assets/nce/js/nce_version_badge.js",
    "/assets/nce/js/nce_nav_buttons.js"
]

# include js, css files in header of web template
# web_include_css = "/assets/nce/css/nce.css"
# web_include_js = "/assets/nce/js/nce.js"

# Home Pages
# ----------
# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
#     "Role": "home_page"
# }

# Generators
# ----------
# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# DocType Class Overrides
# -----------------------
# override_doctype_class = {
#     "ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events
# doc_events = {
#     "*": {
#         "on_update": "method",
#         "on_cancel": "method",
#         "on_trash": "method"
#     }
# }

# Scheduled Tasks
# ---------------
# Define scheduled jobs for WP sync
scheduler_events = {
    # Run every 5 minutes
    "cron": {
        "*/5 * * * *": [
            "nce.wp_sync.tasks.run_scheduled_sync"
        ]
    },
    # Run daily at midnight
    "daily": [
        "nce.wp_sync.tasks.cleanup_old_logs"
    ],
}

# Testing
# -------
# before_tests = "nce.install.before_tests"

# Overriding Methods
# ------------------
# override_whitelisted_methods = {
#     "frappe.desk.doctype.event.event.get_events": "nce.event.get_events"
# }

# Each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
#     "Task": "nce.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Fixtures
# --------
# Export these doctypes when running bench export-fixtures
# fixtures = []

# Boot Info
# ---------
# Add app version and branch to boot data (available as frappe.boot.nce_version, frappe.boot.nce_branch)
extend_bootinfo = "nce.wp_sync.api.extend_bootinfo"

# User Data Protection
# --------------------
# user_data_fields = [
#     {
#         "doctype": "{doctype_1}",
#         "filter_by": "{filter_by}",
#         "redact_fields": ["{field_1}", "{field_2}"],
#         "partial": 1,
#     },
# ]

# Authentication and authorization
# --------------------------------
# auth_hooks = [
#     "nce.auth.validate"
# ]

