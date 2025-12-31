/**
 * WP Sync Task JavaScript Controller
 * 
 * Handles client-side logic for the WP Sync Task form.
 */

frappe.ui.form.on('WP Sync Task', {
    refresh: function(frm) {
        // Display app version
        frappe.call({
            method: 'nce.wp_sync.api.get_app_version',
            callback: function(r) {
                if (r.message) {
                    frm.get_field('app_version_display').$wrapper.html(
                        '<div style="padding: 8px 0; color: #6c757d; font-size: 12px;">' +
                        '<strong>NCE Sync</strong> ' + r.message.display +
                        '</div>'
                    );
                }
            }
        });
    },

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
    },

    create_mirror_doctype_button: function(frm) {
        // Validate source_table is filled
        if (!frm.doc.source_table) {
            frappe.msgprint({
                title: __('Missing Source Table'),
                message: __('Please enter a Source Table/View name first'),
                indicator: 'orange'
            });
            return;
        }

        frappe.confirm(
            __('Create a new DocType that mirrors the WordPress table "{0}"?', [frm.doc.source_table]),
            function() {
                frappe.call({
                    method: 'nce.wp_sync.api.create_mirror_doctype',
                    args: {
                        table_name: frm.doc.source_table
                    },
                    freeze: true,
                    freeze_message: __('Creating DocType...'),
                    callback: function(r) {
                        if (r.message && r.message.success) {
                            frappe.show_alert({
                                message: __('DocType "{0}" created successfully!', [r.message.doctype_name]),
                                indicator: 'green'
                            });
                            // Auto-fill the target_doctype field
                            frm.set_value('target_doctype', r.message.doctype_name);
                            // Only auto-save if document already exists
                            if (!frm.is_new()) {
                                frm.save();
                            }
                        } else if (r.message && r.message.exists) {
                            frappe.msgprint({
                                title: __('DocType Already Exists'),
                                message: __('DocType "{0}" already exists. You can select it as the Target DocType.', [r.message.doctype_name]),
                                indicator: 'blue'
                            });
                            // Auto-fill the target_doctype field
                            frm.set_value('target_doctype', r.message.doctype_name);
                        } else {
                            frappe.msgprint({
                                title: __('Creation Failed'),
                                message: r.message.message || __('Unknown error'),
                                indicator: 'red'
                            });
                        }
                    }
                });
            }
        );
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

