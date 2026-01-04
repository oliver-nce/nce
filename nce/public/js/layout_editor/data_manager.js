/**
 * Data Manager
 * Handles loading, parsing, and structuring DocType data
 * 
 * Architecture (v1.0.67):
 * - rawFields: Original loaded state (pristine until save)
 * - shadowJSON: Working copy for ALL property edits
 * - virtualOrder: Display order structure for drag/drop (fieldnames only)
 */

class LayoutEditorDataManager {
    constructor() {
        // Original loaded state - pristine until save
        this.rawFields = [];
        
        // Working copy for property edits
        this.shadowJSON = [];
        
        // Virtual order for display/reordering (structure with fieldnames)
        this.virtualOrder = {
            tabs: []
        };
        
        // Legacy structure (built from virtualOrder + shadowJSON for rendering)
        this.structure = {
            tabs: [],
            currentTab: null
        };
        
        this.doctype = null;
        this.fieldTypes = new LayoutEditorFieldTypes();
        this.changes = {}; // Track changes: { fieldname: { property: value } }
        this.hasUnsavedChanges = false;
        this.hasOrderChanges = false; // Separate flag for order changes
        this.onChangeCallback = null;
    }
    
    /**
     * Load DocType metadata from backend
     */
    async loadDocType(doctypeName) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'nce.wp_sync.doctype.layout_editor.layout_editor.load_doctype_json',
                args: {
                    doctype_name: doctypeName
                },
                callback: (response) => {
                    if (response.message) {
                        try {
                            // Parse the JSON response
                            const fields = JSON.parse(response.message.fields_json);
                            
                            // Store original (pristine)
                            this.rawFields = JSON.parse(JSON.stringify(fields));
                            
                            // Create working copy (shadowJSON)
                            this.shadowJSON = JSON.parse(JSON.stringify(fields));
                            
                            this.doctype = doctypeName;
                            
                            // Build virtual order structure
                            this.buildVirtualOrder();
                            
                            // Build legacy structure for rendering
                            this.buildStructure();
                            
                            resolve({
                                doctype: doctypeName,
                                structure: this.structure,
                                totalFields: response.message.total_fields
                            });
                        } catch (error) {
                            reject(new Error('Failed to parse DocType JSON: ' + error.message));
                        }
                    } else {
                        reject(new Error('No data received from backend'));
                    }
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }
    
    /**
     * Build virtual order structure from shadowJSON
     * This stores ONLY fieldnames for ordering, not the full field data
     */
    buildVirtualOrder() {
        this.virtualOrder = {
            tabs: [],
            currentTab: 0
        };
        
        let currentTab = null;
        let currentSection = null;
        let currentColumn = null;
        
        this.shadowJSON.forEach((field, index) => {
            // Tab Break - start new tab
            if (this.fieldTypes.isTabBreak(field.fieldtype)) {
                currentTab = {
                    label: field.label || 'Details',
                    fieldname: field.fieldname,
                    sections: []
                };
                this.virtualOrder.tabs.push(currentTab);
                currentSection = null;
                currentColumn = null;
            }
            // Section Break - start new section
            else if (this.fieldTypes.isSectionBreak(field.fieldtype)) {
                // Ensure we have a tab
                if (!currentTab) {
                    currentTab = {
                        label: 'Details',
                        fieldname: '_default_tab',
                        sections: []
                    };
                    this.virtualOrder.tabs.push(currentTab);
                }
                
                currentSection = {
                    fieldname: field.fieldname,
                    columns: []
                };
                currentTab.sections.push(currentSection);
                
                // Start first column (no Column Break)
                currentColumn = {
                    fieldnames: [] // Store only fieldnames
                };
                currentSection.columns.push(currentColumn);
            }
            // Column Break - start new column
            else if (this.fieldTypes.isColumnBreak(field.fieldtype)) {
                if (!currentSection) {
                    // Create default section if needed
                    if (!currentTab) {
                        currentTab = {
                            label: 'Details',
                            fieldname: '_default_tab',
                            sections: []
                        };
                        this.virtualOrder.tabs.push(currentTab);
                    }
                    currentSection = {
                        fieldname: '_default_section',
                        columns: []
                    };
                    currentTab.sections.push(currentSection);
                }
                
                currentColumn = {
                    columnBreakFieldname: field.fieldname,
                    fieldnames: []
                };
                currentSection.columns.push(currentColumn);
            }
            // Regular field - add fieldname to current column
            else {
                // Ensure we have tab, section, and column
                if (!currentTab) {
                    currentTab = {
                        label: 'Details',
                        fieldname: '_default_tab',
                        sections: []
                    };
                    this.virtualOrder.tabs.push(currentTab);
                }
                
                if (!currentSection) {
                    currentSection = {
                        fieldname: '_default_section',
                        columns: []
                    };
                    currentTab.sections.push(currentSection);
                }
                
                if (!currentColumn) {
                    currentColumn = {
                        fieldnames: []
                    };
                    currentSection.columns.push(currentColumn);
                }
                
                // Add only the fieldname reference
                currentColumn.fieldnames.push(field.fieldname);
            }
        });
    }
    
    /**
     * Build structure from virtualOrder + shadowJSON
     * This creates the full structure needed for rendering
     */
    buildStructure() {
        this.structure = {
            tabs: [],
            currentTab: this.virtualOrder.currentTab || 0
        };
        
        this.virtualOrder.tabs.forEach(vTab => {
            const tab = {
                label: vTab.label,
                fieldname: vTab.fieldname,
                sections: []
            };
            
            vTab.sections.forEach(vSection => {
                // Get section field data from shadowJSON
                const sectionField = this.getFieldFromShadow(vSection.fieldname);
                
                const section = {
                    label: sectionField ? sectionField.label || '' : '',
                    fieldname: vSection.fieldname,
                    collapsible: sectionField ? sectionField.collapsible || 0 : 0,
                    columns: []
                };
                
                vSection.columns.forEach(vColumn => {
                    const column = {
                        fields: [],
                        columnBreakFieldname: vColumn.columnBreakFieldname || null,
                        width: 'auto'
                    };
                    
                    // Get width from Column Break field if exists
                    if (vColumn.columnBreakFieldname) {
                        const cbField = this.getFieldFromShadow(vColumn.columnBreakFieldname);
                        if (cbField) {
                            column.width = cbField.columns || 'auto';
                        }
                    }
                    
                    // Get full field objects for rendering
                    vColumn.fieldnames.forEach(fieldname => {
                        const field = this.getFieldFromShadow(fieldname);
                        if (field) {
                            column.fields.push(field);
                        }
                    });
                    
                    section.columns.push(column);
                });
                
                tab.sections.push(section);
            });
            
            this.structure.tabs.push(tab);
        });
    }
    
    /**
     * Get field from shadowJSON by fieldname
     */
    getFieldFromShadow(fieldname) {
        return this.shadowJSON.find(f => f.fieldname === fieldname);
    }
    
    /**
     * Get current structure
     */
    getStructure() {
        return this.structure;
    }
    
    /**
     * Get specific tab
     */
    getTab(index) {
        return this.structure.tabs[index] || null;
    }
    
    /**
     * Get all tabs
     */
    getTabs() {
        return this.structure.tabs;
    }
    
    /**
     * Switch to different tab
     */
    setCurrentTab(index) {
        if (index >= 0 && index < this.structure.tabs.length) {
            this.structure.currentTab = index;
            this.virtualOrder.currentTab = index;
            return true;
        }
        return false;
    }
    
    /**
     * Get field by fieldname (from shadowJSON)
     */
    getField(fieldname) {
        return this.getFieldFromShadow(fieldname);
    }
    
    /**
     * Get all fields (from shadowJSON)
     */
    getAllFields() {
        return this.shadowJSON;
    }
    
    /**
     * Get statistics
     */
    getStats() {
        const stats = {
            totalFields: this.shadowJSON.length,
            tabs: this.structure.tabs.length,
            sections: 0,
            dataFields: 0,
            breaks: 0
        };
        
        this.structure.tabs.forEach(tab => {
            stats.sections += tab.sections.length;
        });
        
        this.shadowJSON.forEach(field => {
            if (this.fieldTypes.isBreak(field.fieldtype)) {
                stats.breaks++;
            } else if (this.fieldTypes.isDataField(field.fieldtype)) {
                stats.dataFields++;
            }
        });
        
        return stats;
    }
    
    /**
     * Update a field property (in shadowJSON)
     */
    updateFieldProperty(fieldname, property, value) {
        // Find the field in shadowJSON
        const field = this.getFieldFromShadow(fieldname);
        if (!field) {
            console.error('Field not found:', fieldname);
            return false;
        }
        
        // Convert checkbox values
        if (typeof value === 'boolean') {
            value = value ? 1 : 0;
        }
        
        // Update the field in shadowJSON
        field[property] = value;
        
        // Track the change
        if (!this.changes[fieldname]) {
            this.changes[fieldname] = {};
        }
        this.changes[fieldname][property] = value;
        
        this.hasUnsavedChanges = true;
        
        // Rebuild structure to reflect changes
        this.buildStructure();
        
        // Trigger callback
        if (this.onChangeCallback) {
            this.onChangeCallback(fieldname, property, value);
        }
        
        console.log(`Updated ${fieldname}.${property} = ${value}`);
        return true;
    }
    
    /**
     * Get all changes
     */
    getChanges() {
        return this.changes;
    }
    
    /**
     * Clear changes (after save)
     */
    clearChanges() {
        this.changes = {};
        this.hasUnsavedChanges = false;
        this.hasOrderChanges = false;
    }
    
    /**
     * Check if there are unsaved changes
     */
    hasChanges() {
        return this.hasUnsavedChanges || this.hasOrderChanges;
    }
    
    /**
     * Set change callback
     */
    setOnChangeCallback(callback) {
        this.onChangeCallback = callback;
    }
    
    /**
     * Revert all changes - reset shadowJSON and virtualOrder to original rawFields
     */
    revertChanges() {
        // Reset shadowJSON to original
        this.shadowJSON = JSON.parse(JSON.stringify(this.rawFields));
        
        // Rebuild virtualOrder from original
        this.buildVirtualOrder();
        
        // Rebuild structure
        this.buildStructure();
        
        // Clear change tracking
        this.changes = {};
        this.hasUnsavedChanges = false;
        this.hasOrderChanges = false;
        
        console.log('Reverted all changes to original loaded state');
        
        // Trigger callback
        if (this.onChangeCallback) {
            this.onChangeCallback('_revert', 'all', 'reverted');
        }
        
        return true;
    }
    
    /**
     * Apply virtual order to shadowJSON (for preview/save)
     * Reorders shadowJSON fields to match virtualOrder
     */
    applyVirtualOrder() {
        const reorderedFields = [];
        
        this.virtualOrder.tabs.forEach(tab => {
            // Add Tab Break field if explicit
            if (tab.fieldname && !tab.fieldname.startsWith('_')) {
                const tabField = this.getFieldFromShadow(tab.fieldname);
                if (tabField) {
                    reorderedFields.push(tabField);
                }
            }
            
            tab.sections.forEach(section => {
                // Add Section Break field
                if (section.fieldname && !section.fieldname.startsWith('_')) {
                    const sectionField = this.getFieldFromShadow(section.fieldname);
                    if (sectionField) {
                        reorderedFields.push(sectionField);
                    }
                }
                
                section.columns.forEach((column, colIdx) => {
                    // Add Column Break field (for columns 2+)
                    if (colIdx > 0 && column.columnBreakFieldname) {
                        const cbField = this.getFieldFromShadow(column.columnBreakFieldname);
                        if (cbField) {
                            reorderedFields.push(cbField);
                        }
                    }
                    
                    // Add data fields in column
                    column.fieldnames.forEach(fieldname => {
                        const field = this.getFieldFromShadow(fieldname);
                        if (field) {
                            reorderedFields.push(field);
                        }
                    });
                });
            });
        });
        
        // Update shadowJSON with reordered fields
        this.shadowJSON = reorderedFields;
        
        // Track idx changes by comparing with rawFields order
        this.trackIdxChanges();
        
        console.log('Applied virtual order to shadowJSON');
        return true;
    }
    
    /**
     * Track idx changes by comparing shadowJSON order with rawFields order
     */
    trackIdxChanges() {
        // Create a map of fieldname -> original idx
        const originalIdxMap = {};
        this.rawFields.forEach((field, idx) => {
            originalIdxMap[field.fieldname] = idx;
        });
        
        // Check each field in shadowJSON for position changes
        this.shadowJSON.forEach((field, newIdx) => {
            const originalIdx = originalIdxMap[field.fieldname];
            
            if (originalIdx !== undefined && originalIdx !== newIdx) {
                // Position changed - track it
                if (!this.changes[field.fieldname]) {
                    this.changes[field.fieldname] = {};
                }
                this.changes[field.fieldname].idx = newIdx;
            }
        });
    }
    
    /**
     * Get updated fields JSON for saving (from shadowJSON with virtual order applied)
     */
    getUpdatedFieldsJSON() {
        // Apply virtual order before generating JSON
        this.applyVirtualOrder();
        return JSON.stringify(this.shadowJSON, null, 2);
    }
    
    // =============================================
    // SECTION REORDERING (updates virtualOrder only)
    // =============================================
    
    /**
     * Move a section within the current tab
     * Updates virtualOrder only - doesn't touch shadowJSON
     */
    moveSectionInCurrentTab(fromIndex, toIndex) {
        const currentTabIdx = this.virtualOrder.currentTab || 0;
        const currentTab = this.virtualOrder.tabs[currentTabIdx];
        
        if (!currentTab || !currentTab.sections) {
            console.error('No current tab or sections');
            return false;
        }
        
        const sections = currentTab.sections;
        
        // Validate indices
        if (fromIndex < 0 || fromIndex >= sections.length ||
            toIndex < 0 || toIndex >= sections.length ||
            fromIndex === toIndex) {
            console.error('Invalid section indices:', fromIndex, toIndex);
            return false;
        }
        
        // Perform the move in virtualOrder
        const [movingSection] = sections.splice(fromIndex, 1);
        sections.splice(toIndex, 0, movingSection);
        
        // Mark as having order changes
        this.hasOrderChanges = true;
        
        // Rebuild structure for rendering
        this.buildStructure();
        
        // Trigger callback
        if (this.onChangeCallback) {
            this.onChangeCallback('_reorder', 'section', `${fromIndex} -> ${toIndex}`);
        }
        
        console.log(`Section moved in virtualOrder: ${fromIndex} -> ${toIndex}`);
        return true;
    }
    
    // =============================================
    // COLUMN REORDERING (updates virtualOrder only)
    // =============================================
    
    /**
     * Move a column within a section
     * Updates virtualOrder only - doesn't touch shadowJSON
     */
    moveColumnInSection(sectionFieldname, fromIndex, toIndex) {
        // Find the section in virtualOrder
        const section = this.findSectionInVirtualOrder(sectionFieldname);
        
        if (!section || !section.columns) {
            console.error('Section not found:', sectionFieldname);
            return false;
        }
        
        const columns = section.columns;
        
        // Validate indices
        if (fromIndex < 0 || fromIndex >= columns.length ||
            toIndex < 0 || toIndex >= columns.length ||
            fromIndex === toIndex) {
            console.error('Invalid column indices:', fromIndex, toIndex);
            return false;
        }
        
        // Handle Column Break shuffling
        // When we move columns, we need to handle the Column Break fields specially:
        // - Column 0 never has a Column Break
        // - Columns 1+ always have a Column Break
        
        const movingColumn = columns[fromIndex];
        const targetColumn = columns[toIndex];
        
        // Extract the moving column
        const [extracted] = columns.splice(fromIndex, 1);
        
        // Insert at new position
        columns.splice(toIndex, 0, extracted);
        
        // Now fix up Column Break assignments:
        // After the move, we need to ensure:
        // - columns[0] has NO columnBreakFieldname
        // - columns[1+] each have a columnBreakFieldname
        
        this.fixColumnBreakAssignments(columns);
        
        // Mark as having order changes
        this.hasOrderChanges = true;
        
        // Rebuild structure for rendering
        this.buildStructure();
        
        // Trigger callback
        if (this.onChangeCallback) {
            this.onChangeCallback('_reorder', 'column', `${fromIndex} -> ${toIndex}`);
        }
        
        console.log(`Column moved in virtualOrder: ${fromIndex} -> ${toIndex} in section ${sectionFieldname}`);
        return true;
    }
    
    /**
     * Fix Column Break assignments after a column move
     * Ensures column 0 has no break, and columns 1+ each have one
     */
    fixColumnBreakAssignments(columns) {
        // Collect all Column Break fieldnames from all columns
        const allColumnBreaks = [];
        columns.forEach(col => {
            if (col.columnBreakFieldname) {
                allColumnBreaks.push(col.columnBreakFieldname);
            }
        });
        
        // Now reassign:
        // - Column 0: no break
        // - Columns 1+: assign breaks in order
        
        columns.forEach((col, idx) => {
            if (idx === 0) {
                // First column - no Column Break
                delete col.columnBreakFieldname;
            } else {
                // Columns 1+ need a Column Break
                if (allColumnBreaks.length > 0) {
                    col.columnBreakFieldname = allColumnBreaks.shift();
                }
            }
        });
        
        // If we have leftover Column Breaks, log a warning
        if (allColumnBreaks.length > 0) {
            console.warn('Leftover Column Breaks after reassignment:', allColumnBreaks);
        }
    }
    
    /**
     * Find a section in virtualOrder by fieldname
     */
    findSectionInVirtualOrder(sectionFieldname) {
        for (const tab of this.virtualOrder.tabs) {
            if (tab.sections) {
                const section = tab.sections.find(s => s.fieldname === sectionFieldname);
                if (section) {
                    return section;
                }
            }
        }
        return null;
    }
    
    // =============================================
    // FIELD REORDERING (future - updates virtualOrder only)
    // =============================================
    
    /**
     * Move a field within a column
     * Updates virtualOrder only
     */
    moveFieldInColumn(sectionFieldname, columnIndex, fromFieldIndex, toFieldIndex) {
        const section = this.findSectionInVirtualOrder(sectionFieldname);
        
        if (!section || !section.columns || !section.columns[columnIndex]) {
            console.error('Column not found');
            return false;
        }
        
        const fieldnames = section.columns[columnIndex].fieldnames;
        
        // Validate indices
        if (fromFieldIndex < 0 || fromFieldIndex >= fieldnames.length ||
            toFieldIndex < 0 || toFieldIndex >= fieldnames.length ||
            fromFieldIndex === toFieldIndex) {
            return false;
        }
        
        // Perform the move
        const [moving] = fieldnames.splice(fromFieldIndex, 1);
        fieldnames.splice(toFieldIndex, 0, moving);
        
        this.hasOrderChanges = true;
        this.buildStructure();
        
        if (this.onChangeCallback) {
            this.onChangeCallback('_reorder', 'field', `${fromFieldIndex} -> ${toFieldIndex}`);
        }
        
        return true;
    }
    
    /**
     * Move a field between columns
     * Updates virtualOrder only
     */
    moveFieldToColumn(sectionFieldname, fromColumnIndex, fieldIndex, toColumnIndex, toFieldIndex) {
        const section = this.findSectionInVirtualOrder(sectionFieldname);
        
        if (!section || !section.columns) {
            return false;
        }
        
        const fromColumn = section.columns[fromColumnIndex];
        const toColumn = section.columns[toColumnIndex];
        
        if (!fromColumn || !toColumn) {
            return false;
        }
        
        // Extract field from source column
        const [fieldname] = fromColumn.fieldnames.splice(fieldIndex, 1);
        
        // Insert into target column
        toColumn.fieldnames.splice(toFieldIndex, 0, fieldname);
        
        this.hasOrderChanges = true;
        this.buildStructure();
        
        if (this.onChangeCallback) {
            this.onChangeCallback('_reorder', 'field_move', `col${fromColumnIndex} -> col${toColumnIndex}`);
        }
        
        return true;
    }
    
    // =============================================
    // LEGACY METHODS (for compatibility)
    // =============================================
    
    /**
     * Get section field ranges (legacy - kept for compatibility)
     */
    getSectionFieldRanges(tab) {
        // This is now mostly unused, but kept for any legacy code
        const ranges = [];
        // ... implementation would go here if needed
        return ranges;
    }
    
    /**
     * Get column field ranges (legacy)
     */
    getColumnFieldRanges(sectionFieldname) {
        // Also mostly unused now
        return [];
    }
}


// Export as global
window.LayoutEditorDataManager = LayoutEditorDataManager;
