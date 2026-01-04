/**
 * WP Sync Settings Client Script
 * 
 * Handles UI interactions for WordPress REST API connection testing.
 */

frappe.ui.form.on('WP Sync Settings', {
    refresh: function(frm) {
        // Add NCE theme class to body for CSS targeting
        $('body').addClass('nce-wp-sync-form');
        
        // Display app version in HTML field with cache clear button
        frappe.call({
            method: 'nce.wp_sync.api.get_app_version',
            callback: function(r) {
                if (r.message) {
                    // Set HTML content for the version display with cache clear button
                    frm.fields_dict.app_version_display.$wrapper.html(
                        '<div class="frappe-control" style="margin-bottom: 10px; display: flex; align-items: center; gap: 12px;">' +
                        '<span class="indicator-pill whitespace-nowrap blue">' + 
                        '<span class="indicator-dot"></span>' +
                        '<span>' + r.message.display + '</span>' +
                        '</span>' +
                        '<button class="btn btn-xs btn-default nce-cache-clear-btn" title="Clear all server cache and reload page">' +
                        '🔄 Clear Cache' +
                        '</button>' +
                        '</div>'
                    );
                    
                    // Attach click handler for cache clear button
                    frm.fields_dict.app_version_display.$wrapper.find('.nce-cache-clear-btn').on('click', function() {
                        var $btn = $(this);
                        $btn.prop('disabled', true).text('Clearing...');
                        
                        frappe.call({
                            method: 'nce.wp_sync.api.clear_all_caches',
                            callback: function(response) {
                                if (response.message && response.message.success) {
                                    frappe.show_alert({
                                        message: __('Cache cleared! Reloading...'),
                                        indicator: 'green'
                                    }, 2);
                                    setTimeout(function() {
                                        window.location.reload(true);
                                    }, 500);
                                } else {
                                    $btn.prop('disabled', false).text('🔄 Clear Cache');
                                    frappe.show_alert({
                                        message: __('Failed to clear cache'),
                                        indicator: 'red'
                                    });
                                }
                            },
                            error: function() {
                                $btn.prop('disabled', false).text('🔄 Clear Cache');
                                frappe.show_alert({
                                    message: __('Error clearing cache'),
                                    indicator: 'red'
                                });
                            }
                        });
                    });
                } else {
                    frm.fields_dict.app_version_display.$wrapper.html(
                        '<div class="frappe-control" style="margin-bottom: 10px;">' +
                        '<span class="indicator-pill whitespace-nowrap orange">' + 
                        '<span class="indicator-dot"></span>' +
                        '<span>Version unavailable</span>' +
                        '</span></div>'
                    );
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

