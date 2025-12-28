# NCE Frappe App

WordPress to Frappe data synchronization app.

## Overview

This Frappe app syncs data from a WordPress/WooCommerce database to Frappe DocTypes. It supports:

- **One-way sync** (WP → Frappe): Mirror WordPress tables in Frappe
- **Bidirectional sync** (coming soon): Two-way synchronization with conflict resolution
- **Scheduled sync**: Automatic synchronization via Frappe scheduler
- **Manual sync**: On-demand sync via API or DocType actions

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

### 1. Configure WordPress Database Connection

1. Go to **WP Sync Settings** in Frappe
2. Enter your WordPress database credentials:
   - Database Host (external IP or hostname)
   - Database Port (default: 3306)
   - Database Name
   - Database User
   - Database Password
3. Click **Test Connection** to verify

> **Important:** Your WordPress database must allow external connections. You may need to:
> - Whitelist Frappe Cloud's IP addresses
> - Create a read-only MySQL user for security

### 2. Create Sync Tasks

1. Go to **WP Sync Task** list
2. Create a new task:
   - **Task Name**: Descriptive name (e.g., "Sync Zoho Registrations")
   - **Source Table**: WordPress table or view name (e.g., `wp_zoho_registrations_new_site`)
   - **Target DocType**: Frappe DocType to sync into (e.g., `WP Zoho Registration`)
   - **Field Mapping**: JSON mapping of WP columns to Frappe fields
   - **Execution Order**: Lower numbers run first

### 3. Field Mapping Example

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

### 4. Enable Scheduled Sync

1. In **WP Sync Settings**, check **Enable Scheduled Sync**
2. The scheduler runs every 5 minutes (configurable in `hooks.py`)

## DocTypes

| DocType | Purpose |
|---------|---------|
| **WP Sync Settings** | Global configuration (DB credentials, sync settings) |
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

1. **Database User**: Create a read-only MySQL user for WP → Frappe sync
2. **IP Whitelisting**: Only allow connections from Frappe Cloud IPs
3. **Encrypted Passwords**: Frappe stores the DB password encrypted

## Troubleshooting

### Connection Refused
- Check if WordPress DB allows remote connections
- Verify firewall rules
- Ensure correct port (3306 is default)

### Permission Denied
- Verify MySQL user has SELECT privileges on the tables
- Check if user is allowed to connect from Frappe's IP

### No Data Syncing
- Check WP Sync Task is enabled
- Check WP Sync Settings has "Enable Scheduled Sync" checked
- Review WP Sync Log for errors

## Version History

- **0.0.1** - Initial release
  - WP → Frappe one-way sync
  - Scheduled and manual sync
  - WP Zoho Registration mirror

---

*Last updated: 2025-12-28*

