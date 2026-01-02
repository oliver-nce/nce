/**
 * WP Sync Settings Client Script
 * 
 * Handles UI interactions for WordPress REST API connection testing.
 */

frappe.ui.form.on('WP Sync Settings', {
    refresh: function(frm) {
        // Display app version (in field + headline, so it shows even if field is hidden)
        frappe.call({
            method: 'nce.wp_sync.api.get_app_version',
            callback: function(r) {
                if (r.message) {
                    // Set value into the Data field (persists visibly even with custom layouts)
                    frm.set_value('app_version_display', r.message.display);
                    frm.refresh_field('app_version_display');
                    // Headline fallback (shows even if field is hidden by customization)
                    frm.dashboard.set_headline(__('NCE Sync {0}', [r.message.display]));
                    frm.dashboard.add_indicator(__('NCE Sync {0}', [r.message.display]), 'blue');
                    // Title subtitle (works on Single doctypes where dashboard headline may be hidden)
                    if (frm.page && frm.page.set_title_sub) {
                        frm.page.set_title_sub(__('NCE Sync {0}', [r.message.display]));
                    }
                } else {
                    frm.dashboard.set_headline(__('NCE Sync (version unavailable)'));
                    frm.dashboard.add_indicator(__('NCE Sync (version unavailable)'), 'orange');
                    if (frm.page && frm.page.set_title_sub) {
                        frm.page.set_title_sub(__('NCE Sync (version unavailable)'));
                    }
                }
            }
        });
    },
    
    test_connection_button: function(frm) {
        // This handles clicks on the "Test Connection" button field
        
        // Validate required fields
        if (!frm.doc.wp_site_url || !frm.doc.wp_username || !frm.doc.wp_app_password) {
            frappe.msgprint({
                title: __('Missing Information'),
                indicator: 'red',
                message: __('Please fill in WordPress Site URL, Username, and Application Password before testing connection.')
            });
            return;
        }

        // Show loading indicator
        frappe.show_alert({
            message: __('Testing connection...'),
            indicator: 'blue'
        }, 3);

        // Call the test_connection method
        frm.call({
            method: 'test_connection',
            doc: frm.doc,
            callback: function(r) {
                if (r.message) {
                    if (r.message.success) {
                        // Success
                        frappe.show_alert({
                            message: __('Connection Successful!'),
                            indicator: 'green'
                        }, 5);
                        
                        // Refresh to show updated connection status
                        frm.reload_doc();
                    } else {
                        // Failure
                        frappe.msgprint({
                            title: __('Connection Failed'),
                            indicator: 'red',
                            message: r.message.message || __('Unable to connect to WordPress')
                        });
                        
                        // Refresh to show updated connection status
                        frm.reload_doc();
                    }
                }
            },
            error: function(r) {
                // Network or server error
                frappe.msgprint({
                    title: __('Error'),
                    indicator: 'red',
                    message: __('Failed to test connection. Check the console for details.')
                });
            }
        });
    }
});

