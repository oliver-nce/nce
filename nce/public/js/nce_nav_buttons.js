/**
 * NCE Navigation Buttons - Global
 * Automatically adds Home and Back buttons to ALL forms and list views
 * 
 * Uses Frappe's event system properly - no DOM hacking
 */

(function() {
    'use strict';
    
    // Hook into form refresh event for ALL doctypes
    $(document).on('form-refresh', function(e, frm) {
        if (!frm || !frm.add_custom_button) return;
        
        // Don't add if already added this session
        if (frm._nce_nav_added) return;
        frm._nce_nav_added = true;
        
        // Add Home button
        frm.add_custom_button(__('🏠 Home'), function() {
            frappe.set_route('nce-home');
        });
        
        // Add Back button  
        frm.add_custom_button(__('← Back'), function() {
            window.history.back();
        });
    });
    
    // Hook into list view load for ALL doctypes
    $(document).on('page-change', function() {
        // Wait for page to render
        setTimeout(function() {
            // Check if we're on a list view
            const cur_list = frappe.views && frappe.views.ListView && cur_list;
            if (cur_list && cur_list.page && !cur_list._nce_nav_added) {
                cur_list._nce_nav_added = true;
                
                // Add to list view toolbar
                cur_list.page.add_inner_button(__('🏠 Home'), function() {
                    frappe.set_route('nce-home');
                });
                
                cur_list.page.add_inner_button(__('← Back'), function() {
                    window.history.back();
                });
            }
        }, 100);
    });
    
})();
