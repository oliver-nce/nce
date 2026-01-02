/**
 * WP Sync Task JavaScript Controller
 * 
 * Handles client-side logic for the WP Sync Task form.
 */

frappe.ui.form.on('WP Sync Task', {
    refresh: function(frm) {
        // Add NCE theme class to body for CSS targeting
        $('body').addClass('nce-wp-sync-form');
        
        // Display app version in HTML field
        frappe.call({
            method: 'nce.wp_sync.api.get_app_version',
            callback: function(r) {
                if (r.message) {
                    // Set HTML content for the version display
                    frm.fields_dict.app_version_display.$wrapper.html(
                        '<div class="frappe-control" style="margin-bottom: 10px;">' +
                        '<span class="indicator-pill whitespace-nowrap blue">' + 
                        '<span class="indicator-dot"></span>' +
                        '<span>' + r.message.display + '</span>' +
                        '</span></div>'
                    );
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
        
        // Load persisted column mapping table
        if (frm.doc.column_mapping_html) {
            frm.get_field('column_mapping_display').$wrapper.html(frm.doc.column_mapping_html);
        }
        
        // Populate column dropdowns if source_table is set
        if (frm.doc.source_table) {
            frm.trigger('load_source_columns');
        }
    },
    
    source_table: function(frm) {
        // When source table changes, reload column options
        if (frm.doc.source_table) {
            frm.trigger('load_source_columns');
        }
    },
    
    load_source_columns: function(frm) {
        frappe.call({
            method: 'nce.wp_sync.api.get_source_columns',
            args: {
                table_name: frm.doc.source_table
            },
            callback: function(r) {
                if (r.message && r.message.success) {
                    // Populate source_primary_key dropdown with all columns
                    let pk_options = [''].concat(r.message.all_columns);
                    frm.set_df_property('source_primary_key', 'options', pk_options.join('\n'));
                    
                    // Populate updated_at_field dropdown with date/datetime columns
                    let date_options = [''].concat(r.message.date_columns);
                    frm.set_df_property('updated_at_field', 'options', date_options.join('\n'));
                    
                    frm.refresh_field('source_primary_key');
                    frm.refresh_field('updated_at_field');
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
                if (r.message && r.message.status === "Success") {
                    frappe.msgprint({
                        title: __('✓ Sync Completed'),
                        message: '<table class="table table-bordered" style="margin-top:10px;">' +
                            '<tr><td><strong>Rows Processed</strong></td><td>' + (r.message.rows_processed || 0) + '</td></tr>' +
                            '<tr><td><strong>Inserted</strong></td><td>' + (r.message.rows_inserted || 0) + '</td></tr>' +
                            '<tr><td><strong>Updated</strong></td><td>' + (r.message.rows_updated || 0) + '</td></tr>' +
                            '<tr><td><strong>Skipped</strong></td><td>' + (r.message.rows_skipped || 0) + '</td></tr>' +
                            '</table>',
                        indicator: 'green'
                    });
                    frm.reload_doc();
                } else {
                    frappe.msgprint({
                        title: __('Sync Failed'),
                        message: r.message ? (r.message.error || r.message.message || __('Unknown error')) : __('Unknown error'),
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

        // Step 1: Fetch preview of columns and suggested types
        frappe.call({
            method: 'nce.wp_sync.api.preview_mirror_doctype',
            args: {
                table_name: frm.doc.source_table
            },
            freeze: true,
            freeze_message: __('Fetching table structure...'),
            callback: function(r) {
                if (!r.message || !r.message.success) {
                    frappe.msgprint({
                        title: __('Preview Failed'),
                        message: r.message ? r.message.message : __('Unknown error'),
                        indicator: 'red'
                    });
                    return;
                }

                let preview = r.message.preview;
                let field_types = r.message.field_types;
                
                // Generate default DocType name
                let default_name = frm.doc.target_doctype || 
                    frm.doc.source_table.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                // Build preview table HTML with dropdowns
                let table_html = '<table class="table table-bordered table-sm" style="margin-top:10px;">';
                table_html += '<thead><tr><th>WordPress Column</th><th>MySQL Type</th><th>Frappe Type</th><th>Label</th></tr></thead>';
                table_html += '<tbody>';
                
                preview.forEach(function(row, idx) {
                    let options_html = field_types.map(function(ft) {
                        let selected = ft === row.suggested_type ? 'selected' : '';
                        return '<option value="' + ft + '" ' + selected + '>' + ft + '</option>';
                    }).join('');
                    
                    table_html += '<tr>';
                    table_html += '<td><strong>' + row.column + '</strong></td>';
                    table_html += '<td><code>' + row.mysql_type + '</code></td>';
                    table_html += '<td><select class="form-control input-sm field-type-select" data-column="' + row.column + '">' + options_html + '</select></td>';
                    table_html += '<td>' + row.label + '</td>';
                    table_html += '</tr>';
                });
                table_html += '</tbody></table>';
                
                // Show dialog with preview and editable types
                let d = new frappe.ui.Dialog({
                    title: __('Create Mirror DocType'),
                    size: 'large',
                    fields: [
                        {
                            fieldname: 'doctype_name',
                            fieldtype: 'Data',
                            label: 'DocType Name',
                            reqd: 1,
                            default: default_name
                        },
                        {
                            fieldname: 'preview_html',
                            fieldtype: 'HTML',
                            options: '<div style="max-height:400px; overflow-y:auto;">' + table_html + '</div>'
                        }
                    ],
                    primary_action_label: __('Create DocType'),
                    primary_action: function() {
                        let doctype_name = d.get_value('doctype_name');
                        
                        // Collect field type selections
                        let field_types_map = {};
                        d.$wrapper.find('.field-type-select').each(function() {
                            let col = $(this).data('column');
                            let type = $(this).val();
                            field_types_map[col] = type;
                        });
                        
                        d.hide();
                        
                        // Step 2: Create the DocType with selected types
                        frappe.call({
                            method: 'nce.wp_sync.api.create_mirror_doctype',
                            args: {
                                table_name: frm.doc.source_table,
                                doctype_name: doctype_name,
                                task_name: frm.doc.task_name || frm.doc.name,
                                field_types: JSON.stringify(field_types_map)
                            },
                            freeze: true,
                            freeze_message: __('Creating DocType...'),
                            callback: function(r) {
                                if (r.message && r.message.success) {
                                    frappe.show_alert({
                                        message: __('DocType "{0}" created successfully!', [r.message.doctype_name]),
                                        indicator: 'green'
                                    });
                                    frm.set_value('target_doctype', r.message.doctype_name);
                                    
                                    // Build and display comparison table
                                    if (r.message.comparison) {
                                        let html = '<table class="table table-bordered table-sm">';
                                        html += '<thead><tr><th>WordPress Column</th><th>Frappe Field</th><th>Label</th></tr></thead>';
                                        html += '<tbody>';
                                        r.message.comparison.forEach(function(row) {
                                            html += '<tr><td>' + row.source + '</td><td>' + row.fieldname + '</td><td>' + row.label + '</td></tr>';
                                        });
                                        html += '</tbody></table>';
                                        
                                        frm.get_field('column_mapping_display').$wrapper.html(html);
                                        frm.set_value('column_mapping_html', html);
                                    }
                                    
                                    if (!frm.is_new()) {
                                        frm.save();
                                    }
                                } else {
                                    frappe.msgprint({
                                        title: __('Creation Failed'),
                                        message: r.message ? r.message.message : __('Unknown error'),
                                        indicator: 'red'
                                    });
                                }
                            }
                        });
                    }
                });
                
                d.show();
            }
        });
    },

    delete_all_records_button: function(frm) {
        if (!frm.doc.target_doctype) {
            frappe.msgprint({
                title: __('No Target DocType'),
                message: __('Please set a Target DocType first'),
                indicator: 'orange'
            });
            return;
        }
        
        frappe.confirm(
            __('Delete ALL records from "{0}"? This cannot be undone!', [frm.doc.target_doctype]),
            function() {
                frappe.call({
                    method: 'nce.wp_sync.api.delete_all_records',
                    args: {
                        doctype: frm.doc.target_doctype
                    },
                    freeze: true,
                    freeze_message: __('Deleting records...'),
                    callback: function(r) {
                        if (r.message) {
                            frappe.show_alert({
                                message: r.message.message || r.message,
                                indicator: 'green'
                            });
                        }
                    }
                });
            }
        );
    },

    start_over_button: function(frm) {
        if (!frm.doc.target_doctype) {
            frappe.msgprint({
                title: __('No Target DocType'),
                message: __('Please set a Target DocType first'),
                indicator: 'orange'
            });
            return;
        }
        
        frappe.confirm(
            __('COMPLETELY DELETE DocType "{0}" and ALL its data? This cannot be undone!', [frm.doc.target_doctype]),
            function() {
                frappe.call({
                    method: 'nce.wp_sync.api.delete_doctype',
                    args: {
                        doctype: frm.doc.target_doctype
                    },
                    freeze: true,
                    freeze_message: __('Deleting DocType...'),
                    callback: function(r) {
                        if (r.message && r.message.success) {
                            frappe.show_alert({
                                message: r.message.message,
                                indicator: 'green'
                            });
                            // Clear the target_doctype field and column mapping
                            frm.set_value('target_doctype', '');
                            frm.set_value('column_mapping_html', '');
                            frm.get_field('column_mapping_display').$wrapper.html('');
                            frm.save();
                        } else {
                            frappe.msgprint({
                                title: __('Deletion Failed'),
                                message: r.message ? r.message.message : __('Unknown error'),
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

