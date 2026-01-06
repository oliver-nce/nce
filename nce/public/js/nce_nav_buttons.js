/**
 * NCE Navigation Buttons - Global
 * Automatically adds Home and Back buttons to ALL forms and list views
 * 
 * Uses Frappe's event system properly - no DOM hacking
 */

(function() {
    'use strict';
    
    /**
     * Add nav buttons to a form
     * Frappe's add_custom_button handles duplicates internally
     */
    function addNavButtonsToForm(frm) {
        if (!frm || !frm.add_custom_button) return;
        
        // Remove existing nav buttons first (clean slate)
        frm.remove_custom_button(__('🏠 Home'));
        frm.remove_custom_button(__('← Back'));
        
        // Add Home button
        frm.add_custom_button(__('🏠 Home'), function() {
            frappe.set_route('nce-home');
        });
        
        // Add Back button  
        frm.add_custom_button(__('← Back'), function() {
            window.history.back();
        });
    }
    
    /**
     * Add nav buttons to a list view page
     */
    function addNavButtonsToListView(page) {
        if (!page || !page.add_inner_button) return;
        
        // Check if buttons already exist by looking for them
        const $toolbar = page.inner_toolbar || page.$inner_toolbar;
        if ($toolbar && $toolbar.find(':contains("🏠 Home")').length > 0) {
            return; // Already has buttons
        }
        
        page.add_inner_button(__('🏠 Home'), function() {
            frappe.set_route('nce-home');
        });
        
        page.add_inner_button(__('← Back'), function() {
            window.history.back();
        });
    }
    
    // Hook into form refresh event for ALL doctypes
    $(document).on('form-refresh', function(e, frm) {
        addNavButtonsToForm(frm);
    });
    
    // Also hook into form-load for initial load
    $(document).on('form-load', function(e, frm) {
        addNavButtonsToForm(frm);
    });
    
    // For list views - hook into page-change
    $(document).on('page-change', function() {
        // Check if there's an active list view
        if (typeof cur_list !== 'undefined' && cur_list && cur_list.page) {
            addNavButtonsToListView(cur_list.page);
        }
    });
    
})();
