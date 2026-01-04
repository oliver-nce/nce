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
        
        this.visualRenderer.setOnColumnSelect((columnData) => {
            this.onColumnSelected(columnData);
        });
        
        // Connect drag drop handler to visual renderer
        this.visualRenderer.setDragDropHandler(this.dragDropHandler);
        
        // Initialize drag & drop
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
        // DocType indicator (left side)
        this.doctypeIndicator = document.createElement('span');
        this.doctypeIndicator.className = 'layout-editor-doctype-indicator';
        this.doctypeIndicator.textContent = 'No DocType loaded';
        this.toolbarEl.appendChild(this.doctypeIndicator);
        
        // Spacer
        const spacer = document.createElement('span');
        spacer.style.flex = '1';
        this.toolbarEl.appendChild(spacer);
        
        // Preview Changes button (validates before saving)
        this.previewBtn = document.createElement('button');
        this.previewBtn.className = 'btn le-btn-primary btn-sm';
        this.previewBtn.textContent = '👁️ Preview Changes';
        this.previewBtn.disabled = true;
        this.previewBtn.addEventListener('click', () => {
            this.previewAndSaveChanges();
        });
        this.toolbarEl.appendChild(this.previewBtn);
        
        // Status indicator
        this.statusEl = document.createElement('span');
        this.statusEl.className = 'layout-editor-status';
        this.statusEl.textContent = '✓ No changes';
        this.toolbarEl.appendChild(this.statusEl);
        
        // Setup change tracking
        this.dataManager.setOnChangeCallback(() => {
            this.onDataChanged();
        });
    }
    
    /**
     * Update the DocType indicator in toolbar
     */
    updateDoctypeIndicator(doctypeName) {
        if (this.doctypeIndicator) {
            this.doctypeIndicator.innerHTML = `<strong>📋 Editing:</strong> ${doctypeName || 'None'}`;
        }
    }
    
    /**
     * Handle data changes
     */
    onDataChanged() {
        this.previewBtn.disabled = false;
        this.statusEl.textContent = '● Unsaved changes';
        this.statusEl.className = 'layout-editor-status status-unsaved';
    }
    
    /**
     * Preview and save changes (with confirmation)
     */
    async previewAndSaveChanges() {
        if (!this.dataManager.hasChanges()) {
            LayoutEditorUtils.showAlert('No changes to preview', 'blue');
            return;
        }
        
        const changes = this.dataManager.getChanges();
        const changeCount = Object.keys(changes).length;
        
        // Build preview HTML
        let previewHtml = '<div style="max-height: 300px; overflow-y: auto;">';
        for (const [fieldname, properties] of Object.entries(changes)) {
            const field = this.dataManager.getField(fieldname);
            const fieldLabel = field ? field.label || fieldname : fieldname;
            previewHtml += `<div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px;">`;
            previewHtml += `<strong>${fieldLabel}</strong> <small style="color: #666;">(${fieldname})</small><ul style="margin: 5px 0 0 20px;">`;
            for (const [prop, value] of Object.entries(properties)) {
                previewHtml += `<li><code>${prop}</code> = <strong>${value}</strong></li>`;
            }
            previewHtml += '</ul></div>';
        }
        previewHtml += '</div>';
        
        // Show confirmation dialog
        frappe.confirm(
            `<h4>Preview Changes</h4>
            <p><strong>${changeCount} field(s)</strong> will be updated:</p>
            ${previewHtml}
            <p style="margin-top: 15px;"><strong>Apply these changes?</strong></p>`,
            () => {
                // User confirmed - save changes
                this.doSaveChanges(changes);
            },
            () => {
                // User cancelled
                LayoutEditorUtils.showAlert('Changes not applied', 'blue');
            }
        );
    }
    
    /**
     * Actually save changes to backend
     */
    async doSaveChanges(changes) {
        try {
            // Disable button during save
            this.previewBtn.disabled = true;
            this.statusEl.textContent = 'Applying...';
            this.statusEl.className = 'layout-editor-status status-saving';
            
            console.log('Saving changes:', changes);
            
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
            this.statusEl.textContent = '✓ DocType updated';
            this.statusEl.className = 'layout-editor-status status-saved';
            
            LayoutEditorUtils.showSuccess(
                `<strong>${this.currentDocType}</strong> has been updated!<br>` +
                `${Object.keys(changes).length} field property change(s) applied.<br><br>` +
                `<small>Refresh the DocType form to see changes.</small>`,
                '✅ DocType Customizations Saved'
            );
            
            // Reset status after 3 seconds
            setTimeout(() => {
                if (!this.dataManager.hasChanges()) {
                    this.statusEl.textContent = '✓ No changes';
                    this.statusEl.className = 'layout-editor-status';
                }
            }, 3000);
            
        } catch (error) {
            console.error('Save error:', error);
            
            // Re-enable button
            this.previewBtn.disabled = false;
            this.statusEl.textContent = '● Unsaved changes';
            this.statusEl.className = 'layout-editor-status status-unsaved';
            
            LayoutEditorUtils.showError(
                `Failed to apply: ${error.message}`,
                'Error'
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
            
            // Update DocType indicator immediately
            this.updateDoctypeIndicator(doctypeName);
            
            // Load data
            const result = await this.dataManager.loadDocType(doctypeName);
            this.currentDocType = doctypeName;
            
            // Reset change state
            this.dataManager.clearChanges();
            this.previewBtn.disabled = true;
            this.statusEl.textContent = '✓ No changes';
            this.statusEl.className = 'layout-editor-status';
            
            // Render visual structure
            this.visualRenderer.render();
            
            // Reset properties panel
            this.propertiesPanel.renderEmpty();
            
            // Show brief toast notification (not a dialog)
            const stats = this.dataManager.getStats();
            frappe.show_alert({
                message: `Loaded ${doctypeName}: ${stats.dataFields} fields, ${stats.sections} sections`,
                indicator: 'green'
            }, 3);
            
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
     * Handle column selection
     */
    onColumnSelected(columnData) {
        console.log('Column selected:', columnData.columnIndex, 'in section:', columnData.sectionFieldname);
        this.propertiesPanel.displayColumn(columnData);
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

