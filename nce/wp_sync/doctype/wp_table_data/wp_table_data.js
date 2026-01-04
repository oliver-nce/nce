/**
 * WP Table Data JavaScript Controller
 * 
 * Handles client-side logic for the WP Table Data form.
 */

frappe.ui.form.on('WP Table Data', {
    refresh: function(frm) {
        // Add Back button
        frm.add_custom_button(__('← Back'), function() {
            window.history.back();
        });
    }
});

// Add Back button to list view
frappe.listview_settings['WP Table Data'] = {
    onload: function(listview) {
        listview.page.add_inner_button(__('← Back'), function() {
            window.history.back();
        });
    }
};

