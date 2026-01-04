/**
 * WP Sync Log JavaScript Controller
 * 
 * Handles client-side logic for the WP Sync Log form.
 */

frappe.ui.form.on('WP Sync Log', {
    refresh: function(frm) {
        // Add Back button
        frm.add_custom_button(__('← Back'), function() {
            window.history.back();
        });
    }
});

// Add Back button to list view
frappe.listview_settings['WP Sync Log'] = {
    onload: function(listview) {
        listview.page.add_inner_button(__('← Back'), function() {
            window.history.back();
        });
    }
};

