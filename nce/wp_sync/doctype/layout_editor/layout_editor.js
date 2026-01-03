// Copyright (c) 2025, NCE and contributors
// For license information, please see license.txt

frappe.ui.form.on("Layout Editor", {
    refresh: function(frm) {
        // Set instructions
        frm.set_df_property('instructions_html', 'options', `
            <div style="padding: 10px; background: #f5f5f5; border-radius: 4px; margin-bottom: 10px;">
                <h4>📐 Layout Editor</h4>
                <p>Edit DocType layouts that can't be changed in Customize Form:</p>
                <ul style="margin: 5px 0; padding-left: 20px;">
                    <li>Move fields between tabs/sections</li>
                    <li>Reorder fields freely</li>
                    <li>Rename Tab/Section labels</li>
                    <li>Delete fields, sections, or tabs</li>
                    <li>Change field types</li>
                </ul>
                <p><strong>Workflow:</strong> Select DocType → Load JSON → Edit → Generate Prompt → Paste in Cursor</p>
            </div>
        `);
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
                    frappe.show_alert({
                        message: `Loaded ${r.message.fields.length} fields from ${frm.doc.target_doctype}`,
                        indicator: 'green'
                    });
                }
            }
        });
    },
    
    validate_json_button: function(frm) {
        if (!frm.doc.json_editor) {
            frappe.msgprint("No JSON to validate. Load a DocType first.");
            return;
        }
        
        frappe.call({
            method: "nce.wp_sync.doctype.layout_editor.layout_editor.validate_json",
            args: {
                json_str: frm.doc.json_editor
            },
            callback: function(r) {
                if (r.message) {
                    if (r.message.valid) {
                        frm.set_df_property('structure_preview', 'options', r.message.structure_html);
                        frappe.show_alert({
                            message: r.message.message,
                            indicator: 'green'
                        });
                    } else {
                        frappe.msgprint({
                            title: 'Validation Error',
                            indicator: 'red',
                            message: r.message.error
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




