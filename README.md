# NCE Frappe App

WordPress to Frappe data synchronization app via REST API.

## Overview

This Frappe app syncs data from WordPress tables to Frappe DocTypes using WordPress REST API. It supports:

- **One-way sync** (WP → Frappe): Mirror WordPress tables in Frappe via REST API
- **Bidirectional sync** (coming soon): Two-way synchronization with conflict resolution
- **Scheduled sync**: Automatic synchronization via Frappe scheduler
- **Manual sync**: On-demand sync via API or DocType actions
- **WP Engine Compatible**: Works with WP Engine and shared hosting (no direct MySQL access needed)

## Installation

### On Frappe Cloud

1. Push this app to your GitHub repository
2. In Frappe Cloud dashboard, go to your bench
3. Add the app from your GitHub repo
4. Deploy

### Local Development

```bash
# Navigate to your bench
cd frappe-bench

# Get the app
bench get-app https://github.com/oliver-nce/nce.git

# Install on your site
bench --site your-site.local install-app nce

# Run migrations
bench --site your-site.local migrate
```

## Configuration

### 1. Install Custom SQL Endpoint Plugin on WordPress

First, install the Custom SQL Endpoint plugin on your WordPress site:

1. Upload `custom-sql-endpoint.php` to `wp-content/plugins/custom-sql-endpoint/`
2. Activate the plugin in WordPress admin
3. Create an Application Password for API authentication:
   - Go to **Users** → **Your Profile** → **Application Passwords**
   - Create a new application password (e.g., "Frappe Sync")
   - Save the generated password (you'll need it for Frappe settings)

### 2. Configure WordPress REST API Connection in Frappe

1. Go to **WP Sync Settings** in Frappe
2. Enter your WordPress API credentials:
   - **WordPress Site URL**: Full URL (e.g., `https://yoursite.com`)
   - **WordPress Username**: Your WordPress admin username
   - **Application Password**: The password generated in step 1
3. Click **Test Connection** to verify

> **Note:** The Custom SQL Endpoint plugin only allows SELECT and CALL queries for security.

### 3. Create Sync Tasks

1. Go to **WP Sync Task** list
2. Create a new task:
   - **Task Name**: Descriptive name (e.g., "Sync Zoho Registrations")
   - **Source Table**: WordPress table or view name (e.g., `wp_zoho_registrations_new_site`)
   - **Target DocType**: Frappe DocType to sync into (e.g., `WP Zoho Registration`)
   - **Field Mapping**: JSON mapping of WP columns to Frappe fields
   - **Execution Order**: Lower numbers run first

### 4. Field Mapping Example

```json
{
    "id": "wp_source_id",
    "created_at": "wp_created_at",
    "updated_at": "wp_updated_at",
    "first_name": "first_name",
    "last_name": "last_name",
    "email": "email",
    "phone": "phone",
    "program_name": "program_name",
    "amount": "amount",
    "status": "status"
}
```

### 5. Enable Scheduled Sync

1. In **WP Sync Settings**, check **Enable Scheduled Sync**
2. The scheduler runs every 5 minutes (configurable in `hooks.py`)

## DocTypes

| DocType | Purpose |
|---------|---------|
| **WP Sync Settings** | Global configuration (API credentials, sync settings) |
| **WP Sync Task** | Individual sync task definitions |
| **WP Sync Log** | Execution history and logs |
| **WP Zoho Registration** | Mirror of `wp_zoho_registrations_new_site` |

## API Endpoints

### Run All Tasks
```python
frappe.call("nce.wp_sync.api.run_all_tasks")
```

### Run Single Task
```python
frappe.call("nce.wp_sync.api.run_task", task_name="Sync Zoho Registrations")
```

### Test Connection
```python
frappe.call("nce.wp_sync.api.test_wp_connection")
```

### Get Sync Status
```python
frappe.call("nce.wp_sync.api.get_sync_status")
```

### Get WP Table Columns
```python
frappe.call("nce.wp_sync.api.get_wp_table_columns", table_name="wp_zoho_registrations_new_site")
```

## Adding New Mirror Tables

To add a new WordPress table to sync:

1. **Create a DocType** for the mirror table:
   - Add `wp_source_id` field (Data, unique) - this is the primary key from WP
   - Add `synced_at` field (Datetime, read-only)
   - Add `raw_data` field (JSON) for debugging
   - Add fields matching your WP table columns

2. **Create a Sync Task**:
   - Set the source table name
   - Set the target DocType
   - Configure field mapping

3. **Run the sync** manually to test, then enable scheduled sync

## File Structure

```
nce/
├── nce/
│   ├── __init__.py
│   ├── hooks.py                    # Scheduler config
│   ├── modules.txt
│   ├── patches.txt
│   │
│   └── wp_sync/                    # WP Sync module
│       ├── __init__.py
│       ├── api.py                  # Whitelisted API methods
│       ├── tasks.py                # Sync logic
│       │
│       └── doctype/
│           ├── wp_sync_settings/   # Settings DocType
│           ├── wp_sync_task/       # Task definition DocType
│           ├── wp_sync_log/        # Execution log DocType
│           └── wp_zoho_registration/  # Mirror DocType
│
├── setup.py
├── requirements.txt
├── license.txt
└── README.md
```

## Scheduler Configuration

The scheduler is configured in `hooks.py`:

```python
scheduler_events = {
    "cron": {
        "*/5 * * * *": [                    # Every 5 minutes
            "nce.wp_sync.tasks.run_scheduled_sync"
        ]
    },
    "daily": [
        "nce.wp_sync.tasks.cleanup_old_logs"  # Cleanup old logs
    ],
}
```

## Security Considerations

1. **Application Passwords**: WordPress Application Passwords provide secure API access without exposing your main password
2. **Read-Only Access**: The Custom SQL Endpoint plugin only allows SELECT and CALL queries, preventing data modification
3. **WordPress Authentication**: All API requests use WordPress built-in authentication
4. **Encrypted Passwords**: Frappe stores the application password encrypted
5. **HTTPS Required**: Always use HTTPS for your WordPress site to secure API communications

## Troubleshooting

### Connection Failed / 401 Unauthorized
- Verify your WordPress username is correct
- Regenerate Application Password in WordPress
- Ensure the plugin is activated
- Check WordPress site URL is correct (include https://)

### API Request Timeout
- Check WordPress site is accessible
- Verify firewall/security plugins aren't blocking API requests
- Increase timeout in `wp_sync_settings.py` if needed

### No Data Syncing
- Check WP Sync Task is enabled
- Check WP Sync Settings has "Enable Scheduled Sync" checked
- Review WP Sync Log for errors
- Test query manually via API endpoint

### SQL Query Error
- Verify table name is correct (usually prefixed with `wp_`)
- Check WHERE clause syntax if used
- Remember only SELECT and CALL queries are allowed

## Version History

- **0.0.2** (2025-12-28)
  - Switched from direct MySQL to WordPress REST API
  - Added support for WP Engine and shared hosting
  - Updated to use WordPress Application Passwords
  - Removed pymysql dependency, added requests library

- **0.0.1** - Initial release
  - WP → Frappe one-way sync via direct MySQL
  - Scheduled and manual sync
  - WP Zoho Registration mirror

---

*Last updated: 2025-12-28*

