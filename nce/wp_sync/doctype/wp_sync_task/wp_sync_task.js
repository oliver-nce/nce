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

