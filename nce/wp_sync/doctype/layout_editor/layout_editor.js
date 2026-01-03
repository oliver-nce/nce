// Copyright (c) 2025, NCE and contributors
// For license information, please see license.txt

// Load Layout Editor theme CSS
frappe.require('/assets/nce/css/layout_editor_theme.css');

// Load modular JavaScript components
frappe.require('/assets/nce/js/layout_editor/utils.js');
frappe.require('/assets/nce/js/layout_editor/field_types.js');
frappe.require('/assets/nce/js/layout_editor/data_manager.js');
frappe.require('/assets/nce/js/layout_editor/visual_renderer.js');
frappe.require('/assets/nce/js/layout_editor/properties_panel.js');
frappe.require('/assets/nce/js/layout_editor/drag_drop_handler.js');
frappe.require('/assets/nce/js/layout_editor/layout_editor_widget.js');

// Global widget instance
let layoutEditorWidget = null;

frappe.ui.form.on("Layout Editor", {
    refresh: function(frm) {
        // Set instructions using CSS classes instead of inline styles
        frm.set_df_property('instructions_html', 'options', `
            <div class="layout-editor-instructions">
                <h4>📐 Layout Editor</h4>
                <p>Edit DocType layouts that can't be changed in Customize Form:</p>
                <ul>
                    <li>Set field rows (height)</li>
                    <li>Move fields between tabs/sections</li>
                    <li>Reorder fields freely</li>
                    <li>Rename Tab/Section labels</li>
                    <li>Hide standard fields</li>
                    <li>Change field properties</li>
                </ul>
                <p><strong>Workflow:</strong> Load JSON → Edit → Validate → Update Properties</p>
                <p><strong>🎨 NEW:</strong> Click "Visual Editor" button to use drag-and-drop interface</p>
            </div>
        `);
        
        // Add Visual Editor button
        if (!frm.custom_buttons["Visual Editor"]) {
            frm.add_custom_button(__("Visual Editor"), function() {
                launch_visual_editor(frm);
            }).addClass('le-btn-primary');
        }
        
        // Show "Update Properties" button if validated and not changed
        if (frm.doc.__validated && !frm.doc.__json_changed) {
            if (!frm.custom_buttons["Update Properties"]) {
                frm.add_custom_button(__("Update Properties"), function() {
                    update_properties(frm);
                }).addClass('btn-update-properties');
            }
        } else {
            // Remove button if it exists
            if (frm.custom_buttons["Update Properties"]) {
                frm.remove_custom_button("Update Properties");
            }
        }
    },
    
    load_json_button: function(frm) {
        if (!frm.doc.target_doctype) {
            frappe.msgprint("Please select a DocType first");
            return;
        }
        
        frappe.call({
            method: "nce.wp_sync.doctype.layout_editor.layout_editor.load_doctype_json",
            args: {
                doctype_name: frm.doc.target_doctype
            },
            callback: function(r) {
                if (r.message) {
                    frm.set_value("json_editor", r.message.fields_json);
                    frm.set_df_property('structure_preview', 'options', r.message.structure_html);
                    
                    // Reset validation state
                    frm.doc.__validated = false;
                    frm.doc.__json_changed = false;
                    frm.refresh();
                    
                    frappe.show_alert({
                        message: `Loaded ${r.message.total_fields} fields from ${frm.doc.target_doctype}`,
                        indicator: 'green'
                    });
                }
            }
        });
    },
    
    json_editor: function(frm) {
        // Mark as changed when JSON is edited
        if (frm.doc.__validated) {
            frm.doc.__json_changed = true;
            frm.doc.__validated = false;
            frm.refresh();
        }
    },
    
    validate_json_button: function(frm) {
        if (!frm.doc.target_doctype) {
            frappe.msgprint("Please select a DocType first");
            return;
        }
        
        if (!frm.doc.json_editor) {
            frappe.msgprint("No JSON to validate. Load a DocType first.");
            return;
        }
        
        frappe.call({
            method: "nce.wp_sync.doctype.layout_editor.layout_editor.validate_json_for_customizations",
            args: {
                doctype_name: frm.doc.target_doctype,
                json_str: frm.doc.json_editor
            },
            callback: function(r) {
                if (r.message) {
                    if (r.message.success) {
                        // Validation passed!
                        frm.doc.__validated = true;
                        frm.doc.__json_changed = false;
                        frm.set_df_property('structure_preview', 'options', r.message.structure_html);
                        frm.refresh();
                        
                        frappe.show_alert({
                            message: r.message.message,
                            indicator: 'green'
                        });
                        
                        frappe.msgprint({
                            title: '✅ Validation Passed',
                            indicator: 'green',
                            message: r.message.message + '<br><br><strong>Click "Update Properties" button to apply changes.</strong>'
                        });
                    } else {
                        // Validation failed - show all errors using CSS classes
                        frm.doc.__validated = false;
                        frm.doc.__json_changed = true;
                        frm.refresh();
                        
                        let error_html = '<div class="layout-editor-error">';
                        error_html += `<p><strong>${r.message.total_errors} error(s) found:</strong></p><ol>`;
                        r.message.errors.forEach(function(err) {
                            error_html += '<li>' + err + '</li>';
                        });
                        error_html += '</ol></div>';
                        
                        frappe.msgprint({
                            title: '❌ Validation Failed',
                            indicator: 'red',
                            message: error_html
                        });
                    }
                }
            }
        });
    },
    
    generate_prompt_button: function(frm) {
        if (!frm.doc.target_doctype) {
            frappe.msgprint("Please select a DocType first");
            return;
        }
        if (!frm.doc.json_editor) {
            frappe.msgprint("No JSON to generate prompt from. Load a DocType first.");
            return;
        }
        
        // First validate
        frappe.call({
            method: "nce.wp_sync.doctype.layout_editor.layout_editor.validate_json",
            args: {
                json_str: frm.doc.json_editor
            },
            callback: function(r) {
                if (r.message && !r.message.valid) {
                    frappe.msgprint({
                        title: 'Fix JSON First',
                        indicator: 'red',
                        message: r.message.error
                    });
                    return;
                }
                
                // Generate prompt
                frappe.call({
                    method: "nce.wp_sync.doctype.layout_editor.layout_editor.generate_cursor_prompt",
                    args: {
                        doctype_name: frm.doc.target_doctype,
                        json_str: frm.doc.json_editor
                    },
                    callback: function(r2) {
                        if (r2.message) {
                            frm.set_value("output_prompt", r2.message.prompt);
                            frappe.show_alert({
                                message: 'Prompt generated! Copy it from the field below.',
                                indicator: 'green'
                            });
                            
                            // Scroll to output
                            frappe.utils.scroll_to(frm.fields_dict.output_prompt.$wrapper);
                        }
                    }
                });
            }
        });
    }
});


function update_properties(frm) {
    if (!frm.doc.target_doctype || !frm.doc.json_editor) {
        frappe.msgprint("No data to apply");
        return;
    }
    
    // Confirm before applying
    frappe.confirm(
        `Apply customizations to <strong>${frm.doc.target_doctype}</strong>?<br><br>` +
        `This will create/update Property Setters in the database.`,
        function() {
            // User confirmed
            frappe.call({
                method: "nce.wp_sync.doctype.layout_editor.layout_editor.update_properties",
                args: {
                    doctype_name: frm.doc.target_doctype,
                    json_str: frm.doc.json_editor
                },
                callback: function(r) {
                    if (r.message && r.message.success) {
                        frappe.show_alert({
                            message: r.message.message,
                            indicator: 'green'
                        });
                        
                        frappe.msgprint({
                            title: '✅ Success',
                            indicator: 'green',
                            message: r.message.message + '<br><br>Reload the JSON to see the applied changes.'
                        });
                        
                        // Reset state
                        frm.doc.__validated = false;
                        frm.doc.__json_changed = false;
                        frm.refresh();
                    } else {
                        frappe.msgprint({
                            title: 'Error',
                            indicator: 'red',
                            message: 'Failed to apply customizations'
                        });
                    }
                }
            });
        }
    );
}

/**
 * Launch Visual Editor
 */
function launch_visual_editor(frm) {
    if (!frm.doc.target_doctype) {
        frappe.msgprint("Please select a DocType first");
        return;
    }
    
    // Create dialog for visual editor
    const dialog = new frappe.ui.Dialog({
        title: `Visual Editor - ${frm.doc.target_doctype}`,
        size: 'extra-large',
        fields: [
            {
                fieldname: 'visual_editor_container',
                fieldtype: 'HTML'
            }
        ],
        primary_action_label: 'Close',
        primary_action: function() {
            dialog.hide();
            if (layoutEditorWidget) {
                layoutEditorWidget.destroy();
                layoutEditorWidget = null;
            }
        }
    });
    
    dialog.show();
    dialog.$wrapper.addClass('layout-editor-dialog');
    
    // Get container
    const container = dialog.fields_dict.visual_editor_container.$wrapper[0];
    
    // Initialize widget
    layoutEditorWidget = new LayoutEditorWidget({
        frm: frm,
        container: container,
        mode: 'visual'
    });
    
    // Initialize and load
    layoutEditorWidget.initialize().then(() => {
        // Auto-load the selected DocType
        layoutEditorWidget.loadDocType(frm.doc.target_doctype);
    });
}




