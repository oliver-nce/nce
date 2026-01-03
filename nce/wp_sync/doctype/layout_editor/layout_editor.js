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
        // Hide Frappe's standard Save button (not needed - this is a tool, not a data form)
        frm.disable_save();
        
        // Initialize tabs if not already done
        if (!frm._tabs_initialized) {
            setup_tabs(frm);
            frm._tabs_initialized = true;
        }
        
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
                <p><strong>🎨 NEW:</strong> Switch to "Visual Editor" tab for drag-and-drop interface</p>
            </div>
        `);
        
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
 * Setup Bootstrap tabs using Frappe's intended method
 */
function setup_tabs(frm) {
    // Get the form wrapper
    const form_wrapper = frm.$wrapper.find('.form-layout');
    
    // Check if tabs already exist
    if (form_wrapper.find('.layout-editor-tabs').length > 0) {
        return;
    }
    
    // Create tab navigation using Bootstrap standard HTML
    const tab_nav = $(`
        <div class="layout-editor-tabs" style="margin-bottom: 20px;">
            <ul class="nav nav-tabs" id="layout-editor-tabs" role="tablist">
                <li class="nav-item">
                    <a class="nav-link active" id="json-editor-tab-link" data-toggle="tab" href="#json-editor-tab" role="tab" aria-controls="json-editor-tab" aria-selected="true">
                        📝 JSON Editor
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" id="visual-editor-tab-link" data-toggle="tab" href="#visual-editor-tab" role="tab" aria-controls="visual-editor-tab" aria-selected="false">
                        🎨 Visual Editor
                    </a>
                </li>
            </ul>
        </div>
    `);
    
    // Create tab content containers
    const tab_content = $(`
        <div class="tab-content">
            <div class="tab-pane fade show active" id="json-editor-tab" role="tabpanel" aria-labelledby="json-editor-tab-link">
                <!-- Original form content will be moved here -->
            </div>
            <div class="tab-pane fade" id="visual-editor-tab" role="tabpanel" aria-labelledby="visual-editor-tab-link">
                <div id="visual-editor-container" style="min-height: 600px; padding: 20px;">
                    <div class="text-muted text-center" style="padding: 100px 20px;">
                        <p><strong>Select a DocType and click "Load JSON"</strong></p>
                        <p>Then switch to this tab to use the Visual Editor</p>
                    </div>
                </div>
            </div>
        </div>
    `);
    
    // Insert tabs before form content
    form_wrapper.prepend(tab_nav);
    
    // Move existing form fields into Tab 1
    const json_editor_container = tab_content.find('#json-editor-tab');
    form_wrapper.find('.frappe-control').each(function() {
        json_editor_container.append($(this));
    });
    
    // Append tab content
    form_wrapper.append(tab_content);
    
    // Initialize Bootstrap tabs using jQuery (THE FRAPPE WAY)
    $('#layout-editor-tabs a').on('click', function (e) {
        e.preventDefault(); // Prevent default link behavior
        e.stopPropagation(); // Stop event from bubbling to Frappe's router
        $(this).tab('show'); // Use jQuery Bootstrap method to show tab
        return false; // Extra safety - equivalent to preventDefault + stopPropagation
    });
    
    // Listen for tab shown event to initialize Visual Editor
    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        const target = $(e.target).attr('href');
        if (target === '#visual-editor-tab') {
            initialize_visual_editor(frm);
        }
    });
}

/**
 * Initialize Visual Editor when tab is shown
 */
function initialize_visual_editor(frm) {
    if (!frm.doc.target_doctype) {
        const container = $('#visual-editor-container');
        container.html(`
            <div class="text-muted text-center" style="padding: 100px 20px;">
                <p><strong>⚠️ Please select a DocType first</strong></p>
                <p>Go back to the JSON Editor tab and select a DocType, then click "Load JSON"</p>
            </div>
        `);
        return;
    }
    
    // Check if already initialized
    if (layoutEditorWidget && layoutEditorWidget.isInitialized) {
        return;
    }
    
    // Get container
    const container = document.getElementById('visual-editor-container');
    
    // Clear placeholder content
    container.innerHTML = '';
    
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




