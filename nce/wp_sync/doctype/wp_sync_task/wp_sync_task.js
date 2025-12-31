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
                    let html = '<div style="color:#888; font-size:12px; margin-bottom:10px;">NCE Sync ' + r.message.display + '</div>';
                    frm.fields_dict.app_version_display.$wrapper.html(html);
                }
            }
        });
        
        // Load and render stored column mapping HTML
        if (frm.doc.column_mapping_html) {
            frm.fields_dict.column_mapping_display.$wrapper.html(frm.doc.column_mapping_html);
        }
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

        // Generate default DocType name from source table
        let default_name = frm.doc.source_table
            .replace(/^wp_/, '')
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        default_name = 'Wp ' + default_name;
        
        // Prompt for DocType name
        frappe.prompt([
            {
                label: 'DocType Name',
                fieldname: 'doctype_name',
                fieldtype: 'Data',
                default: default_name,
                reqd: 1,
                description: 'Name for the new Frappe DocType (will store synced data)'
            }
        ], function(values) {
            frappe.call({
                method: 'nce.wp_sync.api.create_mirror_doctype',
                args: {
                    table_name: frm.doc.source_table,
                    doctype_name: values.doctype_name
                },
                    freeze: true,
                    freeze_message: __('Creating DocType...'),
                    callback: function(r) {
                        if (r.message && r.message.success) {
                            // Build comparison table HTML
                            let html = '<h4>DocType: ' + r.message.doctype_name + '</h4>';
                            html += '<table class="table table-bordered" style="width:100%"><thead><tr style="background:#f5f5f5"><th>Source Column</th><th>Fieldname (DB)</th><th>Label (UI)</th></tr></thead><tbody>';
                            if (r.message.comparison) {
                                r.message.comparison.forEach(function(row) {
                                    let match = row.source === row.fieldname ? '✓' : '✗';
                                    html += '<tr><td>' + row.source + '</td><td>' + row.fieldname + ' ' + match + '</td><td>' + row.label + '</td></tr>';
                                });
                            }
                            html += '</tbody></table>';
                            
                            // Display HTML in the field and store for persistence
                            frm.fields_dict.column_mapping_display.$wrapper.html(html);
                            frm.set_value('column_mapping_html', html);
                            
                            // Store full table schema for future reference (2-way sync)
                            if (r.message.schema) {
                                frm.set_value('source_table_schema', JSON.stringify(r.message.schema));
                            }
                            
                            frappe.show_alert({
                                message: __('DocType "{0}" created! See Column Mapping below.', [r.message.doctype_name]),
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

