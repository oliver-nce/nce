/**
 * WP Sync Settings Client Script
 * 
 * Handles UI interactions for WordPress REST API connection testing.
 */

frappe.ui.form.on('WP Sync Settings', {
    refresh: function(frm) {
        // Add "Test Connection" button
        frm.add_custom_button(__('Test Connection'), function() {
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
        });
    }
});

