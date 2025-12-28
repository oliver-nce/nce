# Migration Guide: MySQL to REST API

## Overview

Version 0.0.2 switches from direct MySQL database connections to WordPress REST API. This change makes the app compatible with WP Engine and other shared hosting providers that don't allow direct MySQL access.

---

## What Changed

### 1. **WP Sync Settings DocType**

**Old Fields (Removed):**
- `wp_db_host` - Database Host
- `wp_db_port` - Database Port  
- `wp_db_name` - Database Name
- `wp_db_user` - Database User
- `wp_db_password` - Database Password

**New Fields (Added):**
- `wp_site_url` - Full WordPress site URL (e.g., https://yoursite.com)
- `wp_username` - WordPress username
- `wp_app_password` - WordPress Application Password

### 2. **Dependencies**

**Removed:**
- `pymysql>=1.0.0`

**Added:**
- `requests>=2.31.0`

### 3. **Code Changes**

**`wp_sync_settings.py`:**
- Removed `get_wp_connection()` function
- Added `execute_wp_query(sql_query)` function that uses REST API

**`tasks.py`:**
- Updated `sync_wp_to_frappe()` to use `execute_wp_query()` instead of database cursor
- Removed connection/cursor management
- Same logic, different transport layer

---

## Migration Steps

### Step 1: Install Custom SQL Endpoint Plugin on WordPress

1. Upload the plugin to your WordPress site:
   ```
   wp-content/plugins/custom-sql-endpoint/custom-sql-endpoint.php
   ```

2. Activate the plugin in **Plugins** → **Installed Plugins**

3. Verify it's working by visiting (when logged in):
   ```
   https://yoursite.com/wp-json/custom/v1/
   ```

### Step 2: Create WordPress Application Password

1. Log in to WordPress admin
2. Go to **Users** → **Your Profile**
3. Scroll down to **Application Passwords**
4. Enter a name (e.g., "Frappe Sync")
5. Click **Add New Application Password**
6. **IMPORTANT:** Copy the generated password immediately (it won't be shown again)

### Step 3: Update Code on Frappe

#### Option A: Pull from GitHub (Recommended)

1. Push the updated code to your GitHub repository
2. In Frappe Cloud, trigger a deploy from the bench dashboard
3. Wait for deployment to complete

#### Option B: Manual Update (Local Development)

```bash
cd frappe-bench/apps/nce

# Pull latest changes
git pull origin main

# Install updated dependencies
cd ~/frappe-bench
bench --site your-site.local migrate

# Restart bench
bench restart
```

### Step 4: Update WP Sync Settings in Frappe

1. Go to **WP Sync Settings**
2. You'll see the new fields:
   - **WordPress Site URL**: Enter your full site URL (e.g., `https://yoursite.com`)
   - **WordPress Username**: Your WordPress admin username
   - **Application Password**: Paste the password from Step 2
3. Click **Test Connection**
4. Verify it says "Connected Successfully"

### Step 5: Test Sync

1. Go to **WP Sync Task** list
2. Open your existing task (e.g., "Sync Zoho Registrations")
3. Click **Run Now** (if there's a button) or use the API:
   ```python
   frappe.call("nce.wp_sync.api.run_task", task_name="YOUR_TASK_NAME")
   ```
4. Check **WP Sync Log** for results

---

## Troubleshooting

### "Custom SQL Endpoint plugin not found"

**Problem:** The plugin isn't installed or activated.

**Solution:**
1. Verify plugin file exists: `wp-content/plugins/custom-sql-endpoint/custom-sql-endpoint.php`
2. Activate in WordPress admin
3. Check for PHP errors in WordPress error log

### "401 Unauthorized"

**Problem:** Authentication failed.

**Solution:**
1. Verify username is correct (case-sensitive)
2. Regenerate Application Password in WordPress
3. Make sure you copied the entire password (no spaces)
4. Try logging in to WordPress to verify username/password work

### "Connection test failed"

**Problem:** Can't reach the REST API endpoint.

**Solution:**
1. Verify site URL is correct (include `https://`)
2. Check if site is accessible from Frappe Cloud
3. Verify WordPress REST API is enabled (it's on by default)
4. Check for security plugins blocking API requests

### "Table not found" errors during sync

**Problem:** WordPress table name is incorrect or doesn't exist.

**Solution:**
1. Use the correct WordPress table prefix (usually `wp_`)
2. Test query manually:
   ```bash
   curl -X POST https://yoursite.com/wp-json/custom/v1/sql-query \
     -u "username:application_password" \
     -H "Content-Type: application/json" \
     -d '{"sql":"SHOW TABLES"}'
   ```

---

## Rollback (If Needed)

If you need to rollback to the MySQL version:

```bash
cd frappe-bench/apps/nce

# Checkout previous version
git checkout v0.0.1

# Update dependencies
cd ~/frappe-bench
pip install -e apps/nce

# Restart
bench restart
```

Then reconfigure the old MySQL settings in **WP Sync Settings**.

---

## Performance Considerations

### MySQL (Old) vs REST API (New)

| Aspect | MySQL Direct | REST API |
|--------|-------------|----------|
| **Speed** | Faster (direct connection) | Slightly slower (HTTP overhead) |
| **Compatibility** | Requires external MySQL access | Works everywhere |
| **Security** | Needs IP whitelisting, firewall rules | Uses WordPress auth |
| **Maintenance** | Complex networking setup | Simple to configure |

**Recommendation:** The slight performance trade-off is worth the simplified setup and broader compatibility.

### Optimization Tips

1. **Limit rows**: Use WHERE clauses in sync tasks to only sync recent data
2. **Batch processing**: Break large tables into multiple tasks
3. **Schedule wisely**: Adjust sync interval based on data volume
4. **Index tables**: Ensure WordPress tables have proper indexes

---

## API Endpoint Reference

### Request Format

```bash
POST https://yoursite.com/wp-json/custom/v1/sql-query
Content-Type: application/json
Authorization: Basic base64(username:app_password)

{
  "sql": "SELECT * FROM wp_zoho_registrations_new_site"
}
```

### Response Format (Success)

```json
{
  "result": [
    {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com"
    }
  ]
}
```

### Response Format (Error)

```json
{
  "code": "query_error",
  "message": "Table 'wp_invalid_table' doesn't exist",
  "data": {
    "status": 500
  }
}
```

---

## Security Notes

### What's Better with REST API

✅ **No database credentials** in Frappe (more secure)  
✅ **WordPress handles authentication** (leverages built-in security)  
✅ **Application Passwords** can be revoked without changing main password  
✅ **No IP whitelisting** needed (simpler firewall rules)  
✅ **WordPress security plugins** protect the endpoint  

### What to Watch

⚠️ **HTTPS required** - Always use HTTPS for your WordPress site  
⚠️ **Rate limiting** - Some hosts may rate-limit API requests  
⚠️ **Plugin security** - Keep the Custom SQL Endpoint plugin updated  

---

## Questions?

If you encounter issues not covered here:

1. Check **WP Sync Log** in Frappe for error messages
2. Check WordPress error logs for PHP errors
3. Test the endpoint manually with curl (see troubleshooting section)
4. Verify plugin version matches this guide (v1.2+)

---

*Last updated: 2025-12-28*

