/**
 * Data Manager
 * Handles loading, parsing, and structuring DocType data
 */

class LayoutEditorDataManager {
    constructor() {
        this.rawFields = [];
        this.structure = {
            tabs: [],
            currentTab: null
        };
        this.doctype = null;
        this.fieldTypes = new LayoutEditorFieldTypes();
        this.changes = {}; // Track changes: { fieldname: { property: value } }
        this.hasUnsavedChanges = false;
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
                            this.rawFields = JSON.parse(response.message.fields_json);
                            this.doctype = doctypeName;
                            
                            // Build structure
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
     * Build hierarchical structure from flat field list
     * Structure: Tabs → Sections → Columns → Fields
     */
    buildStructure() {
        this.structure = {
            tabs: [],
            currentTab: null
        };
        
        let currentTab = null;
        let currentSection = null;
        let currentColumn = null;
        
        this.rawFields.forEach((field, index) => {
            field._idx = index; // Store original index
            
            // Tab Break - start new tab (explicit Tab Break field)
            if (this.fieldTypes.isTabBreak(field.fieldtype)) {
                currentTab = {
                    label: field.label || 'Details',
                    fieldname: field.fieldname,
                    sections: []
                };
                this.structure.tabs.push(currentTab);
                currentSection = null;
                currentColumn = null;
            }
            // Also detect implicit tabs from field.parent_tab property
            else if (field.parent_tab && (!currentTab || currentTab.label !== field.parent_tab)) {
                currentTab = {
                    label: field.parent_tab,
                    fieldname: '_tab_' + field.parent_tab.toLowerCase().replace(/\s+/g, '_'),
                    sections: []
                };
                this.structure.tabs.push(currentTab);
                currentSection = null;
                currentColumn = null;
            }
            
            // Section Break - start new section
            else if (this.fieldTypes.isSectionBreak(field.fieldtype)) {
                // If no tab yet, create default tab
                if (!currentTab) {
                    currentTab = {
                        label: 'Details',
                        fieldname: '_default_tab',
                        sections: []
                    };
                    this.structure.tabs.push(currentTab);
                }
                
                currentSection = {
                    label: field.label || '',
                    fieldname: field.fieldname,
                    collapsible: field.collapsible || 0,
                    columns: []
                };
                currentTab.sections.push(currentSection);
                
                // Start first column
                currentColumn = {
                    fields: []
                };
                currentSection.columns.push(currentColumn);
            }
            
            // Column Break - start new column
            else if (this.fieldTypes.isColumnBreak(field.fieldtype)) {
                // If no section yet, create default section
                if (!currentSection) {
                    if (!currentTab) {
                        currentTab = {
                            label: 'Details',
                            fieldname: '_default_tab',
                            sections: []
                        };
                        this.structure.tabs.push(currentTab);
                    }
                    currentSection = {
                        label: '',
                        fieldname: '_default_section',
                        collapsible: 0,
                        columns: []
                    };
                    currentTab.sections.push(currentSection);
                }
                
                currentColumn = {
                    fields: []
                };
                currentSection.columns.push(currentColumn);
            }
            
            // Regular field - add to current column
            else {
                // Ensure we have tab, section, and column
                if (!currentTab) {
                    currentTab = {
                        label: 'Details',
                        fieldname: '_default_tab',
                        sections: []
                    };
                    this.structure.tabs.push(currentTab);
                }
                
                if (!currentSection) {
                    currentSection = {
                        label: '',
                        fieldname: '_default_section',
                        collapsible: 0,
                        columns: []
                    };
                    currentTab.sections.push(currentSection);
                }
                
                if (!currentColumn) {
                    currentColumn = {
                        fields: []
                    };
                    currentSection.columns.push(currentColumn);
                }
                
                // Add field to current column
                currentColumn.fields.push(field);
            }
        });
        
        // Set first tab as current
        if (this.structure.tabs.length > 0) {
            this.structure.currentTab = 0;
        }
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
            return true;
        }
        return false;
    }
    
    /**
     * Get field by fieldname
     */
    getField(fieldname) {
        return this.rawFields.find(f => f.fieldname === fieldname);
    }
    
    /**
     * Get all fields
     */
    getAllFields() {
        return this.rawFields;
    }
    
    /**
     * Get statistics
     */
    getStats() {
        const stats = {
            totalFields: this.rawFields.length,
            tabs: this.structure.tabs.length,
            sections: 0,
            dataFields: 0,
            breaks: 0
        };
        
        this.structure.tabs.forEach(tab => {
            stats.sections += tab.sections.length;
        });
        
        this.rawFields.forEach(field => {
            if (this.fieldTypes.isBreak(field.fieldtype)) {
                stats.breaks++;
            } else if (this.fieldTypes.isDataField(field.fieldtype)) {
                stats.dataFields++;
            }
        });
        
        return stats;
    }
    
    /**
     * Update a field property
     */
    updateFieldProperty(fieldname, property, value) {
        // Find the field
        const field = this.getField(fieldname);
        if (!field) {
            console.error('Field not found:', fieldname);
            return false;
        }
        
        // Convert checkbox values
        if (typeof value === 'boolean') {
            value = value ? 1 : 0;
        }
        
        // Update the field
        field[property] = value;
        
        // Track the change
        if (!this.changes[fieldname]) {
            this.changes[fieldname] = {};
        }
        this.changes[fieldname][property] = value;
        
        this.hasUnsavedChanges = true;
        
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
    }
    
    /**
     * Check if there are unsaved changes
     */
    hasChanges() {
        return this.hasUnsavedChanges;
    }
    
    /**
     * Set change callback
     */
    setOnChangeCallback(callback) {
        this.onChangeCallback = callback;
    }
    
    /**
     * Get updated fields JSON for saving
     */
    getUpdatedFieldsJSON() {
        return JSON.stringify(this.rawFields, null, 2);
    }
    
    /**
     * Move a section within the current tab
     * @param {number} fromIndex - Current section index in tab
     * @param {number} toIndex - Target section index in tab
     * @returns {boolean} Success
     */
    moveSectionInCurrentTab(fromIndex, toIndex) {
        const currentTab = this.structure.tabs[this.structure.currentTab];
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
        
        // Get the section being moved
        const movingSection = sections[fromIndex];
        
        // Find the raw field indices for the sections
        const sectionRanges = this.getSectionFieldRanges(currentTab);
        
        if (!sectionRanges[fromIndex] || !sectionRanges[toIndex]) {
            console.error('Could not determine section field ranges');
            return false;
        }
        
        // Extract the fields for the moving section
        const movingRange = sectionRanges[fromIndex];
        const movingFields = this.rawFields.splice(movingRange.start, movingRange.count);
        
        // Recalculate ranges after extraction
        const updatedRanges = this.getSectionFieldRanges(currentTab);
        
        // Find new insertion point
        let insertIndex;
        if (toIndex === 0) {
            // Moving to first position - insert at start of tab's fields
            insertIndex = this.getTabStartIndex(currentTab);
        } else if (fromIndex < toIndex) {
            // Moving down - insert after the target section
            const targetRange = updatedRanges[toIndex - 1]; // -1 because we removed one
            insertIndex = targetRange ? targetRange.start + targetRange.count : this.rawFields.length;
        } else {
            // Moving up - insert before the target section
            const targetRange = updatedRanges[toIndex];
            insertIndex = targetRange ? targetRange.start : 0;
        }
        
        // Insert the fields at new position
        this.rawFields.splice(insertIndex, 0, ...movingFields);
        
        // Rebuild structure
        this.buildStructure();
        
        // Mark as changed - track idx changes for all affected fields
        this.trackSectionReorder();
        
        console.log(`Section moved from ${fromIndex} to ${toIndex}`);
        return true;
    }
    
    /**
     * Get the field index ranges for each section in a tab
     * Returns array of { start, count, sectionFieldname }
     */
    getSectionFieldRanges(tab) {
        const ranges = [];
        
        if (!tab.sections) return ranges;
        
        tab.sections.forEach(section => {
            const sectionFieldname = section.fieldname;
            
            // Find the section break field index
            const sectionIdx = this.rawFields.findIndex(f => f.fieldname === sectionFieldname);
            
            if (sectionIdx === -1) {
                // Default/implicit section - find first field
                if (section.columns && section.columns[0] && section.columns[0].fields[0]) {
                    const firstField = section.columns[0].fields[0];
                    const firstIdx = this.rawFields.findIndex(f => f.fieldname === firstField.fieldname);
                    ranges.push({
                        start: firstIdx,
                        count: this.countSectionFields(section),
                        sectionFieldname: sectionFieldname
                    });
                }
                return;
            }
            
            // Count fields in this section (section break + columns + fields)
            const fieldCount = this.countSectionFields(section) + 1; // +1 for section break itself
            
            ranges.push({
                start: sectionIdx,
                count: fieldCount,
                sectionFieldname: sectionFieldname
            });
        });
        
        return ranges;
    }
    
    /**
     * Count total fields in a section (columns + fields, not the section break itself)
     */
    countSectionFields(section) {
        let count = 0;
        
        if (section.columns) {
            section.columns.forEach((column, colIdx) => {
                // Add column break (except for first column)
                if (colIdx > 0) count++;
                
                // Add fields in column
                if (column.fields) {
                    count += column.fields.length;
                }
            });
        }
        
        return count;
    }
    
    /**
     * Get the starting raw field index for a tab
     */
    getTabStartIndex(tab) {
        if (tab.fieldname && !tab.fieldname.startsWith('_')) {
            // Explicit tab break - find it
            const idx = this.rawFields.findIndex(f => f.fieldname === tab.fieldname);
            if (idx !== -1) return idx + 1; // After the tab break
        }
        
        // Default tab - start at beginning
        return 0;
    }
    
    /**
     * Track section reorder as idx changes
     */
    trackSectionReorder() {
        // After reordering, all field positions may have changed
        // We need to track idx changes for Property Setters
        this.rawFields.forEach((field, newIdx) => {
            const originalIdx = field._idx;
            
            if (originalIdx !== undefined && originalIdx !== newIdx) {
                // idx changed - track it
                if (!this.changes[field.fieldname]) {
                    this.changes[field.fieldname] = {};
                }
                this.changes[field.fieldname].idx = newIdx;
                
                // Update the stored idx
                field._idx = newIdx;
            }
        });
        
        this.hasUnsavedChanges = true;
        
        // Trigger callback
        if (this.onChangeCallback) {
            this.onChangeCallback('_reorder', 'idx', 'multiple');
        }
    }
}


// Export as global
window.LayoutEditorDataManager = LayoutEditorDataManager;

