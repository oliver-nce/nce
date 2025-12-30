/**
 * WP Sync Task JavaScript Controller
 * 
 * Handles client-side logic for the WP Sync Task form.
 */

frappe.ui.form.on('WP Sync Task', {
    run_now_button: function(frm) {
        frappe.call({
            method: 'nce.wp_sync.api.run_task',
            args: {
                task_name: frm.doc.name
            },
            freeze: true,
            freeze_message: __('Running sync...'),
            callback: function(r) {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: __('Sync completed successfully!'),
                        indicator: 'green'
                    });
                    frm.reload_doc();
                } else {
                    frappe.msgprint({
                        title: __('Sync Failed'),
                        message: r.message.message || __('Unknown error'),
                        indicator: 'red'
                    });
                }
            }
        });
    }
});

// Add bulk action to list view
frappe.listview_settings['WP Sync Task'] = {
    onload: function(listview) {
        listview.page.add_action_item(__('Run Selected Tasks'), function() {
            let selected = listview.get_checked_items();
            if (selected.length === 0) {
                frappe.msgprint(__('Please select at least one task'));
                return;
            }
            
            frappe.confirm(
                __('Run {0} selected task(s)?', [selected.length]),
                function() {
                    frappe.call({
                        method: 'nce.wp_sync.api.run_multiple_tasks',
                        args: {
                            task_names: selected.map(item => item.name)
                        },
                        freeze: true,
                        freeze_message: __('Running syncs...'),
                        callback: function(r) {
                            frappe.show_alert({
                                message: __('Sync tasks completed'),
                                indicator: 'green'
                            });
                            listview.refresh();
                        }
                    });
                }
            );
        });
    }
};

