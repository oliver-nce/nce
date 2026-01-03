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
     * Create toolbar with save button
     */
    createToolbar() {
        // Save button
        this.saveBtn = document.createElement('button');
        this.saveBtn.className = 'btn btn-primary btn-sm';
        this.saveBtn.textContent = '💾 Save Changes';
        this.saveBtn.style.marginRight = '10px';
        this.saveBtn.disabled = true;
        this.saveBtn.addEventListener('click', () => {
            this.saveChanges();
        });
        this.toolbarEl.appendChild(this.saveBtn);
        
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
        this.saveBtn.disabled = false;
        this.statusEl.textContent = '● Unsaved changes';
        this.statusEl.style.color = '#ff9800';
    }
    
    /**
     * Save changes to backend
     */
    async saveChanges() {
        if (!this.dataManager.hasChanges()) {
            LayoutEditorUtils.showAlert('No changes to save', 'blue');
            return;
        }
        
        try {
            // Disable save button during save
            this.saveBtn.disabled = true;
            this.statusEl.textContent = 'Saving...';
            this.statusEl.style.color = '#2196f3';
            
            const changes = this.dataManager.getChanges();
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
            this.saveBtn.disabled = true;
            this.statusEl.textContent = '✓ All changes saved';
            this.statusEl.style.color = '#4caf50';
            
            LayoutEditorUtils.showSuccess(
                `Saved ${Object.keys(changes).length} field(s)`,
                'Changes Saved'
            );
            
            // Reset status after 3 seconds
            setTimeout(() => {
                if (!this.dataManager.hasChanges()) {
                    this.statusEl.textContent = 'No changes';
                    this.statusEl.style.color = '#999';
                }
            }, 3000);
            
        } catch (error) {
            console.error('Save error:', error);
            
            // Re-enable save button
            this.saveBtn.disabled = false;
            this.statusEl.textContent = '● Unsaved changes';
            this.statusEl.style.color = '#ff9800';
            
            LayoutEditorUtils.showError(
                `Failed to save: ${error.message}`,
                'Save Error'
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

