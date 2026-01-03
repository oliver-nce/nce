/**
 * Visual Renderer
 * Renders the visual structure (tabs, sections, columns, fields) to DOM
 */

class LayoutEditorVisualRenderer {
    constructor(container, dataManager) {
        this.container = container;
        this.dataManager = dataManager;
        this.fieldTypes = new LayoutEditorFieldTypes();
        this.utils = LayoutEditorUtils;
        this.selectedField = null;
        this.onFieldSelect = null; // Callback when field is selected
    }
    
    /**
     * Render complete structure
     */
    render() {
        this.utils.clearElement(this.container);
        
        const structure = this.dataManager.getStructure();
        
        if (!structure || !structure.tabs || structure.tabs.length === 0) {
            this.renderEmpty();
            return;
        }
        
        // Render tabs
        const tabsContainer = this.renderTabs(structure.tabs, structure.currentTab);
        this.container.appendChild(tabsContainer);
        
        // Render current tab content
        const currentTab = structure.tabs[structure.currentTab];
        if (currentTab) {
            const tabContent = this.renderTabContent(currentTab);
            this.container.appendChild(tabContent);
        }
    }
    
    /**
     * Render empty state
     */
    renderEmpty() {
        const emptyDiv = this.utils.createElement(
            'div',
            ['layout-editor-empty', 'le-mb-20'],
            {},
            `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📋</div>
                    <h3>No DocType Loaded</h3>
                    <p>Select a DocType and click "Load DocType" to begin</p>
                </div>
            `
        );
        this.container.appendChild(emptyDiv);
    }
    
    /**
     * Render tab navigation
     */
    renderTabs(tabs, currentTabIndex) {
        const tabsContainer = this.utils.createElement('div', ['le-tabs']);
        
        tabs.forEach((tab, index) => {
            const isActive = index === currentTabIndex;
            const tabEl = this.utils.createElement(
                'div',
                ['le-tab', isActive ? 'active' : ''],
                { 'data-tab-index': index },
                this.utils.escapeHtml(tab.label)
            );
            
            // Click to switch tabs
            tabEl.addEventListener('click', () => {
                this.switchTab(index);
            });
            
            tabsContainer.appendChild(tabEl);
        });
        
        return tabsContainer;
    }
    
    /**
     * Render tab content (sections)
     */
    renderTabContent(tab) {
        const contentContainer = this.utils.createElement('div', ['le-tab-content']);
        
        if (!tab.sections || tab.sections.length === 0) {
            const emptySection = this.utils.createElement(
                'div',
                ['le-empty-tab'],
                {},
                '<p style="padding: 20px; text-align: center; color: #999;">No sections in this tab</p>'
            );
            contentContainer.appendChild(emptySection);
            return contentContainer;
        }
        
        tab.sections.forEach((section, index) => {
            const sectionEl = this.renderSection(section, index);
            contentContainer.appendChild(sectionEl);
        });
        
        return contentContainer;
    }
    
    /**
     * Render section
     */
    renderSection(section, sectionIndex) {
        const sectionContainer = this.utils.createElement('div', ['le-section']);
        
        // Section header
        const header = this.renderSectionHeader(section);
        sectionContainer.appendChild(header);
        
        // Section body (columns)
        const body = this.utils.createElement('div', ['le-section-body']);
        
        if (section.columns && section.columns.length > 0) {
            const columnsContainer = this.renderColumns(section.columns);
            body.appendChild(columnsContainer);
        }
        
        sectionContainer.appendChild(body);
        
        return sectionContainer;
    }
    
    /**
     * Render section header
     */
    renderSectionHeader(section) {
        const header = this.utils.createElement('div', ['le-section-header']);
        
        const title = this.utils.createElement(
            'div',
            ['le-section-header-title'],
            {},
            `
                <span class="le-drag-handle" title="Drag to reorder">☰</span>
                <span>${this.utils.escapeHtml(section.label || 'Unnamed Section')}</span>
            `
        );
        
        const controls = this.utils.createElement(
            'div',
            ['le-section-controls'],
            {},
            `
                <span class="le-section-control" title="Edit section">✏️</span>
                <span class="le-section-control" title="Toggle visibility">👁️</span>
            `
        );
        
        header.appendChild(title);
        header.appendChild(controls);
        
        return header;
    }
    
    /**
     * Render columns
     */
    renderColumns(columns) {
        const columnsContainer = this.utils.createElement('div', ['le-columns']);
        
        columns.forEach((column, index) => {
            const columnEl = this.renderColumn(column, index);
            columnsContainer.appendChild(columnEl);
        });
        
        return columnsContainer;
    }
    
    /**
     * Render single column
     */
    renderColumn(column, columnIndex) {
        const columnEl = this.utils.createElement('div', ['le-column']);
        
        if (column.fields && column.fields.length > 0) {
            column.fields.forEach(field => {
                const fieldEl = this.renderField(field);
                columnEl.appendChild(fieldEl);
            });
        } else {
            const emptyColumn = this.utils.createElement(
                'div',
                ['le-empty-column'],
                {},
                '<p style="text-align: center; color: #ccc; padding: 10px;">Empty column</p>'
            );
            columnEl.appendChild(emptyColumn);
        }
        
        return columnEl;
    }
    
    /**
     * Render field
     */
    renderField(field) {
        const icon = this.fieldTypes.getIcon(field.fieldtype);
        const colorClass = this.fieldTypes.getColorClass(field.fieldtype);
        const label = this.utils.getFieldDisplayName(field);
        const isHidden = field.hidden ? ' (Hidden)' : '';
        
        const fieldEl = this.utils.createElement(
            'div',
            ['le-field'],
            {
                'data-fieldname': field.fieldname,
                'data-fieldtype': field.fieldtype
            }
        );
        
        // Field icon
        const iconEl = this.utils.createElement(
            'span',
            ['le-field-icon', colorClass],
            {},
            icon
        );
        
        // Field label
        const labelEl = this.utils.createElement(
            'span',
            ['le-field-label', field.reqd ? 'le-field-required' : ''],
            {},
            this.utils.escapeHtml(label) + isHidden
        );
        
        // Drag handle
        const dragHandle = this.utils.createElement(
            'span',
            ['le-drag-handle'],
            { 'title': 'Drag to reorder' },
            '⠿'
        );
        
        fieldEl.appendChild(dragHandle);
        fieldEl.appendChild(iconEl);
        fieldEl.appendChild(labelEl);
        
        // Click to select
        fieldEl.addEventListener('click', (e) => {
            this.selectField(field, fieldEl);
        });
        
        return fieldEl;
    }
    
    /**
     * Select a field
     */
    selectField(field, fieldElement) {
        // Remove previous selection
        if (this.selectedField) {
            const prevSelected = this.container.querySelector('.le-field.selected');
            if (prevSelected) {
                prevSelected.classList.remove('selected');
            }
        }
        
        // Add selection to this field
        fieldElement.classList.add('selected');
        this.selectedField = field;
        
        // Trigger callback if set
        if (this.onFieldSelect) {
            this.onFieldSelect(field);
        }
    }
    
    /**
     * Switch tab
     */
    switchTab(tabIndex) {
        if (this.dataManager.setCurrentTab(tabIndex)) {
            this.render();
        }
    }
    
    /**
     * Refresh (re-render)
     */
    refresh() {
        this.render();
    }
    
    /**
     * Set field select callback
     */
    setOnFieldSelect(callback) {
        this.onFieldSelect = callback;
    }
}

// Export as global
window.LayoutEditorVisualRenderer = LayoutEditorVisualRenderer;

