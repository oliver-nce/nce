/**
 * WP Zoho Registration JavaScript Controller
 * 
 * Handles client-side logic for the WP Zoho Registration form.
 */

frappe.ui.form.on('WP Zoho Registration', {
    refresh: function(frm) {
        // Add Back button
        frm.add_custom_button(__('← Back'), function() {
            window.history.back();
        });
    }
});

// Add Back button to list view
frappe.listview_settings['WP Zoho Registration'] = {
    onload: function(listview) {
        listview.page.add_inner_button(__('← Back'), function() {
            window.history.back();
        });
    }
};

