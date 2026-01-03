/**
 * Layout Editor Widget
 * Main controller that coordinates all components
 */

class LayoutEditorWidget {
    constructor(options = {}) {
        this.frm = options.frm;
        this.container = options.container;
        this.mode = options.mode || 'visual'; // 'visual' or 'json'
        
        // Initialize components
        this.dataManager = new LayoutEditorDataManager();
        this.visualRenderer = null;
        this.propertiesPanel = null;
        this.dragDropHandler = null;
        
        this.isInitialized = false;
        this.currentDocType = null;
    }
    
    /**
     * Initialize the widget
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        
        // Create UI container
        this.createContainer();
        
        // Initialize components
        this.visualRenderer = new LayoutEditorVisualRenderer(
            this.visualPanelEl,
            this.dataManager
        );
        
        this.propertiesPanel = new LayoutEditorPropertiesPanel(
            this.propertiesPanelEl,
            this.dataManager
        );
        
        this.dragDropHandler = new LayoutEditorDragDropHandler(
            this.visualRenderer,
            this.dataManager
        );
        
        // Connect components
        this.visualRenderer.setOnFieldSelect((field) => {
            this.onFieldSelected(field);
        });
        
        // Initialize drag & drop (Phase 2)
        this.dragDropHandler.initialize();
        
        // Render empty state
        this.visualRenderer.render();
        this.propertiesPanel.renderEmpty();
        
        this.isInitialized = true;
        
        console.log('Layout Editor Widget initialized');
    }
    
    /**
     * Create container structure
     */
    createContainer() {
        // Clear existing content
        this.container.innerHTML = '';
        
        // Create toolbar
        this.toolbarEl = document.createElement('div');
        this.toolbarEl.className = 'layout-editor-toolbar';
        this.container.appendChild(this.toolbarEl);
        
        this.createToolbar();
        
        // Create main wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'layout-editor-container';
        
        // Create visual panel (left side)
        this.visualPanelEl = document.createElement('div');
        this.visualPanelEl.className = 'layout-editor-visual-panel';
        wrapper.appendChild(this.visualPanelEl);
        
        // Create properties panel (right side)
        this.propertiesPanelEl = document.createElement('div');
        this.propertiesPanelEl.className = 'layout-editor-properties-panel';
        wrapper.appendChild(this.propertiesPanelEl);
        
        this.container.appendChild(wrapper);
    }
    
    /**
     * Create toolbar with preview button
     */
    createToolbar() {
        // Preview Changes button (replaces direct save)
        this.previewBtn = document.createElement('button');
        this.previewBtn.className = 'btn btn-primary btn-sm';
        this.previewBtn.textContent = '👁️ Preview Changes';
        this.previewBtn.style.marginRight = '10px';
        this.previewBtn.disabled = true;
        this.previewBtn.addEventListener('click', () => {
            this.previewAndValidateChanges();
        });
        this.toolbarEl.appendChild(this.previewBtn);
        
        // Status indicator
        this.statusEl = document.createElement('span');
        this.statusEl.className = 'layout-editor-status';
        this.statusEl.textContent = 'No changes';
        this.statusEl.style.color = '#999';
        this.statusEl.style.marginLeft = '10px';
        this.toolbarEl.appendChild(this.statusEl);
        
        // Setup change tracking
        this.dataManager.setOnChangeCallback(() => {
            this.onDataChanged();
        });
    }
    
    /**
     * Handle data changes
     */
    onDataChanged() {
        this.previewBtn.disabled = false;
        this.statusEl.textContent = '● Unsaved changes';
        this.statusEl.style.color = '#ff9800';
    }
    
    /**
     * Preview and validate changes before saving
     */
    async previewAndValidateChanges() {
        if (!this.dataManager.hasChanges()) {
            LayoutEditorUtils.showAlert('No changes to preview', 'blue');
            return;
        }
        
        const changes = this.dataManager.getChanges();
        
        // Build validation request
        try {
            this.previewBtn.disabled = true;
            this.statusEl.textContent = 'Validating...';
            this.statusEl.style.color = '#2196f3';
            
            // Call backend to validate
            const validation = await new Promise((resolve, reject) => {
                frappe.call({
                    method: 'nce.wp_sync.doctype.layout_editor.layout_editor.validate_field_changes',
                    args: {
                        doctype_name: this.currentDocType,
                        changes: changes
                    },
                    callback: (r) => {
                        if (r.message) {
                            resolve(r.message);
                        } else {
                            reject(new Error('No response from server'));
                        }
                    },
                    error: (err) => {
                        reject(err);
                    }
                });
            });
            
            // Re-enable button
            this.previewBtn.disabled = false;
            this.statusEl.textContent = '● Unsaved changes';
            this.statusEl.style.color = '#ff9800';
            
            // Show validation results
            if (validation.valid) {
                this.showConfirmationDialog(changes, validation);
            } else {
                this.showValidationErrors(validation);
            }
            
        } catch (error) {
            console.error('Validation error:', error);
            this.previewBtn.disabled = false;
            this.statusEl.textContent = '● Unsaved changes';
            this.statusEl.style.color = '#ff9800';
            
            LayoutEditorUtils.showError(
                `Validation failed: ${error.message}`,
                'Validation Error'
            );
        }
    }
    
    /**
     * Show validation errors
     */
    showValidationErrors(validation) {
        const errorHtml = `
            <div style="color: #d32f2f; margin-bottom: 15px;">
                <h4>❌ Validation Failed</h4>
                <p><strong>${validation.errors.length} error(s) found:</strong></p>
            </div>
            <div style="background: #ffebee; padding: 15px; border-radius: 4px; max-height: 300px; overflow-y: auto;">
                <ul style="margin: 0; padding-left: 20px;">
                    ${validation.errors.map(err => `<li>${LayoutEditorUtils.escapeHtml(err)}</li>`).join('')}
                </ul>
            </div>
        `;
        
        frappe.msgprint({
            title: 'Validation Failed',
            message: errorHtml,
            indicator: 'red'
        });
    }
    
    /**
     * Show confirmation dialog with preview
     */
    showConfirmationDialog(changes, validation) {
        // Build preview HTML
        const changesHtml = this.buildChangesPreview(changes);
        
        const dialog = new frappe.ui.Dialog({
            title: '✅ Changes Validated - Ready to Apply',
            size: 'large',
            fields: [
                {
                    fieldtype: 'HTML',
                    options: `
                        <div style="margin-bottom: 20px;">
                            <div style="padding: 15px; background: #e8f5e9; border-radius: 4px; margin-bottom: 15px;">
                                <strong>✓ Validation Passed</strong><br>
                                ${validation.message || 'All changes are valid and safe to apply'}
                            </div>
                            <h4>Preview of Changes:</h4>
                            ${changesHtml}
                        </div>
                    `
                }
            ],
            primary_action_label: '✅ Apply Changes',
            primary_action: () => {
                dialog.hide();
                this.applyChanges(changes);
            },
            secondary_action_label: 'Cancel',
            secondary_action: () => {
                dialog.hide();
            }
        });
        
        dialog.show();
    }
    
    /**
     * Build HTML preview of changes
     */
    buildChangesPreview(changes) {
        let html = '<div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; padding: 15px; border-radius: 4px; background: #fafafa;">';
        
        for (const [fieldname, properties] of Object.entries(changes)) {
            const field = this.dataManager.getField(fieldname);
            const fieldLabel = field ? field.label || fieldname : fieldname;
            
            html += `
                <div style="margin-bottom: 20px; padding: 10px; background: white; border-radius: 4px; border-left: 3px solid #2196f3;">
                    <strong style="color: #1976d2;">📝 ${LayoutEditorUtils.escapeHtml(fieldLabel)}</strong>
                    <span style="color: #666; font-size: 12px; margin-left: 10px;">(${LayoutEditorUtils.escapeHtml(fieldname)})</span>
                    <ul style="margin: 10px 0 0 20px; padding: 0;">
            `;
            
            for (const [prop, value] of Object.entries(properties)) {
                const displayValue = value === '' ? '(empty)' : value;
                html += `<li><code>${LayoutEditorUtils.escapeHtml(prop)}</code> = <strong>${LayoutEditorUtils.escapeHtml(String(displayValue))}</strong></li>`;
            }
            
            html += '</ul></div>';
        }
        
        html += '</div>';
        
        const changeCount = Object.keys(changes).length;
        const propCount = Object.values(changes).reduce((sum, props) => sum + Object.keys(props).length, 0);
        
        html = `
            <div style="margin-bottom: 15px; padding: 10px; background: #fff3e0; border-radius: 4px;">
                <strong>${changeCount} field(s)</strong> will be updated with <strong>${propCount} property change(s)</strong>
            </div>
        ` + html;
        
        return html;
    }
    
    /**
     * Apply changes after validation and confirmation
     */
    async applyChanges(changes) {
        try {
            // Disable button during save
            this.previewBtn.disabled = true;
            this.statusEl.textContent = 'Applying...';
            this.statusEl.style.color = '#2196f3';
            
            console.log('Applying changes:', changes);
            
            // Call backend to save
            const response = await new Promise((resolve, reject) => {
                frappe.call({
                    method: 'nce.wp_sync.doctype.layout_editor.layout_editor.save_field_changes',
                    args: {
                        doctype_name: this.currentDocType,
                        changes: changes
                    },
                    callback: (r) => {
                        if (r.message) {
                            resolve(r.message);
                        } else {
                            reject(new Error('No response from server'));
                        }
                    },
                    error: (err) => {
                        reject(err);
                    }
                });
            });
            
            // Clear changes
            this.dataManager.clearChanges();
            
            // Update UI
            this.previewBtn.disabled = true;
            this.statusEl.textContent = '✓ All changes saved';
            this.statusEl.style.color = '#4caf50';
            
            LayoutEditorUtils.showSuccess(
                `Applied ${Object.keys(changes).length} field change(s)`,
                'Changes Applied Successfully'
            );
            
            // Reset status after 3 seconds
            setTimeout(() => {
                if (!this.dataManager.hasChanges()) {
                    this.statusEl.textContent = 'No changes';
                    this.statusEl.style.color = '#999';
                }
            }, 3000);
            
        } catch (error) {
            console.error('Apply error:', error);
            
            // Re-enable button
            this.previewBtn.disabled = false;
            this.statusEl.textContent = '● Unsaved changes';
            this.statusEl.style.color = '#ff9800';
            
            LayoutEditorUtils.showError(
                `Failed to apply changes: ${error.message}`,
                'Apply Error'
            );
        }
    }
    
    /**
     * Load a DocType
     */
    async loadDocType(doctypeName) {
        if (!doctypeName) {
            LayoutEditorUtils.showError('Please select a DocType first');
            return false;
        }
        
        try {
            // Show loading
            LayoutEditorUtils.showAlert('Loading DocType...', 'blue');
            
            // Load data
            const result = await this.dataManager.loadDocType(doctypeName);
            this.currentDocType = doctypeName;
            
            // Render visual structure
            this.visualRenderer.render();
            
            // Reset properties panel
            this.propertiesPanel.renderEmpty();
            
            // Show success with stats
            const stats = this.dataManager.getStats();
            LayoutEditorUtils.showSuccess(
                `Loaded <strong>${doctypeName}</strong><br>` +
                `${stats.dataFields} fields, ${stats.sections} sections, ${stats.tabs} tabs`,
                'DocType Loaded'
            );
            
            return true;
        } catch (error) {
            console.error('Error loading DocType:', error);
            LayoutEditorUtils.showError(
                `Failed to load DocType: ${error.message}`,
                'Load Error'
            );
            return false;
        }
    }
    
    /**
     * Handle field selection
     */
    onFieldSelected(field) {
        console.log('Field selected:', field.fieldname);
        this.propertiesPanel.displayField(field);
    }
    
    /**
     * Switch to different tab
     */
    switchTab(tabIndex) {
        if (this.dataManager.setCurrentTab(tabIndex)) {
            this.visualRenderer.render();
        }
    }
    
    /**
     * Refresh the widget
     */
    refresh() {
        if (this.visualRenderer) {
            this.visualRenderer.render();
        }
        if (this.propertiesPanel && !this.propertiesPanel.currentField) {
            this.propertiesPanel.renderEmpty();
        }
    }
    
    /**
     * Get current state
     */
    getState() {
        return {
            doctype: this.currentDocType,
            mode: this.mode,
            structure: this.dataManager.getStructure(),
            stats: this.dataManager.getStats()
        };
    }
    
    /**
     * Destroy widget
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.isInitialized = false;
        console.log('Layout Editor Widget destroyed');
    }
}

// Export as global
window.LayoutEditorWidget = LayoutEditorWidget;

