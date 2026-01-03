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
            this.propertiesPanelEl
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

