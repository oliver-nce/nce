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
        this.selectedElement = null; // Track selected DOM element
        this.onFieldSelect = null; // Callback when field is selected
        this.onColumnSelect = null; // Callback when column is selected
        this.onSectionSelect = null; // Callback when section is selected
        this.dragDropHandler = null; // Set by widget after initialization
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
        
        // Initialize drag and drop after rendering
        this.initializeDragDrop();
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
        sectionContainer.dataset.sectionIndex = sectionIndex;
        sectionContainer.dataset.sectionFieldname = section.fieldname;
        
        // Section header
        const header = this.renderSectionHeader(section);
        sectionContainer.appendChild(header);
        
        // Section body (columns)
        const body = this.utils.createElement('div', ['le-section-body']);
        
        if (section.columns && section.columns.length > 0) {
            const columnsContainer = this.renderColumns(section.columns, section.fieldname);
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
    renderColumns(columns, sectionFieldname) {
        const columnsContainer = this.utils.createElement('div', ['le-columns']);
        
        columns.forEach((column, index) => {
            const columnEl = this.renderColumn(column, index, sectionFieldname, columns.length, columns);
            columnsContainer.appendChild(columnEl);
        });
        
        return columnsContainer;
    }
    
    /**
     * Calculate visual width percentage for a column
     * Based on Frappe's 12-column grid
     */
    calculateColumnVisualWidth(column, columnIndex, allColumns) {
        // Calculate total fixed width of all columns (except auto ones)
        let totalFixedWidth = 0;
        let autoColumnCount = 0;
        
        allColumns.forEach((col, idx) => {
            if (idx === 0) {
                // First column is always auto
                autoColumnCount++;
            } else {
                const width = parseInt(col.width) || 0;
                if (width > 0) {
                    totalFixedWidth += width;
                } else {
                    autoColumnCount++;
                }
            }
        });
        
        // Calculate this column's width
        if (columnIndex === 0) {
            // First column: takes remaining space
            const remainingWidth = 12 - totalFixedWidth;
            return (remainingWidth / 12) * 100;
        } else {
            const width = parseInt(column.width) || 0;
            if (width > 0) {
                // Fixed width column
                return (width / 12) * 100;
            } else {
                // Auto column (share remaining with other autos)
                const remainingWidth = 12 - totalFixedWidth;
                return (remainingWidth / autoColumnCount / 12) * 100;
            }
        }
    }
    
    /**
     * Render single column
     */
    renderColumn(column, columnIndex, sectionFieldname, totalColumns, sectionColumns) {
        const columnEl = this.utils.createElement('div', ['le-column']);
        columnEl.dataset.columnIndex = columnIndex;
        columnEl.dataset.sectionFieldname = sectionFieldname;
        
        // Calculate and apply visual width
        const visualWidth = this.calculateColumnVisualWidth(column, columnIndex, sectionColumns);
        if (visualWidth) {
            columnEl.style.flex = `0 0 ${visualWidth}%`;
            columnEl.style.maxWidth = `${visualWidth}%`;
        }
        
        // Column header with inline editable width
        const columnHeader = this.utils.createElement('div', ['le-column-header']);
        
        // Column label
        const labelSpan = this.utils.createElement(
            'span',
            ['le-column-label'],
            {},
            `Col ${columnIndex + 1}`
        );
        columnHeader.appendChild(labelSpan);
        
        // Width selector (inline editable)
        if (columnIndex === 0) {
            // First column - show "auto" (takes remaining space)
            const widthSpan = this.utils.createElement(
                'span',
                ['le-column-width-display'],
                { title: 'First column takes remaining space' },
                'auto'
            );
            columnHeader.appendChild(widthSpan);
        } else {
            // Column 2+ - editable width dropdown
            const widthSelect = this.utils.createElement('select', ['le-column-width-select'], {
                title: 'Column width (1-12 grid)'
            });
            
            const currentWidth = column.width || 0;
            const options = [
                { value: '0', label: 'auto' },
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '4', label: '4' },
                { value: '5', label: '5' },
                { value: '6', label: '6' },
                { value: '7', label: '7' },
                { value: '8', label: '8' },
                { value: '9', label: '9' },
                { value: '10', label: '10' },
                { value: '11', label: '11' }
            ];
            
            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                if (String(currentWidth) === opt.value) {
                    option.selected = true;
                }
                widthSelect.appendChild(option);
            });
            
            // Change handler - update immediately
            widthSelect.addEventListener('change', (e) => {
                e.stopPropagation();
                const newWidth = parseInt(e.target.value);
                this.onColumnWidthChange(column, columnIndex, newWidth, sectionFieldname);
            });
            
            // Prevent click from bubbling to header
            widthSelect.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            columnHeader.appendChild(widthSelect);
        }
        
        // Click on header (not dropdown) to select column for more properties
        columnHeader.addEventListener('click', (e) => {
            if (e.target.tagName !== 'SELECT') {
                e.stopPropagation();
                this.selectColumn(column, columnIndex, columnEl, sectionFieldname);
            }
        });
        
        columnEl.appendChild(columnHeader);
        
        // Column fields container
        const fieldsContainer = this.utils.createElement('div', ['le-column-fields']);
        
        if (column.fields && column.fields.length > 0) {
            column.fields.forEach(field => {
                const fieldEl = this.renderField(field);
                fieldsContainer.appendChild(fieldEl);
            });
        } else {
            const emptyColumn = this.utils.createElement(
                'div',
                ['le-empty-column'],
                {},
                '<p style="text-align: center; color: #ccc; padding: 10px;">Empty column</p>'
            );
            fieldsContainer.appendChild(emptyColumn);
        }
        
        columnEl.appendChild(fieldsContainer);
        
        return columnEl;
    }
    
    /**
     * Handle column width change from inline dropdown
     */
    onColumnWidthChange(column, columnIndex, newWidth, sectionFieldname) {
        if (!column.columnBreakFieldname) {
            console.warn('No Column Break field for column', columnIndex);
            return;
        }
        
        // Validate: check if total would exceed 12
        const section = this.findSectionByFieldname(sectionFieldname);
        if (section && newWidth > 0) {
            const otherColumnsTotal = this.calculateOtherColumnsWidth(section, columnIndex);
            const newTotal = otherColumnsTotal + newWidth;
            
            if (newTotal > 12) {
                LayoutEditorUtils.showError(
                    `Cannot set width to ${newWidth}. Other columns use ${otherColumnsTotal}, total would be ${newTotal} (max 12).`,
                    'Width Exceeds Grid'
                );
                // Reset dropdown to previous value
                this.render();
                return;
            }
        }
        
        // Update in data manager
        this.dataManager.updateFieldProperty(column.columnBreakFieldname, 'columns', newWidth);
        
        // Update local reference
        column.width = newWidth || 'auto';
        
        // Re-render to show visual width change
        this.render();
        
        // Show feedback
        LayoutEditorUtils.showAlert(`Column ${columnIndex + 1} width: ${newWidth || 'auto'}`, 'green');
    }
    
    /**
     * Find section by fieldname in current tab
     */
    findSectionByFieldname(sectionFieldname) {
        const structure = this.dataManager.getStructure();
        if (!structure || !structure.tabs) return null;
        
        const currentTab = structure.tabs[structure.currentTab];
        if (!currentTab || !currentTab.sections) return null;
        
        return currentTab.sections.find(s => s.fieldname === sectionFieldname);
    }
    
    /**
     * Calculate total width of other columns (excluding the one being changed)
     */
    calculateOtherColumnsWidth(section, excludeColumnIndex) {
        let total = 0;
        
        if (!section.columns) return total;
        
        section.columns.forEach((col, idx) => {
            if (idx !== excludeColumnIndex && idx > 0) {
                // Only count columns 2+ (column 1 is auto)
                const width = parseInt(col.width) || 0;
                if (width > 0) {
                    total += width;
                }
            }
        });
        
        return total;
    }
    
    /**
     * Select a column
     */
    selectColumn(column, columnIndex, columnElement, sectionFieldname) {
        // Remove previous selection
        this.clearSelection();
        
        // Add selection to this column
        columnElement.classList.add('selected');
        this.selectedElement = columnElement;
        
        // Find the Column Break field for this column (if not first column)
        let columnBreakField = null;
        if (columnIndex > 0 && column.columnBreakFieldname) {
            columnBreakField = this.dataManager.getField(column.columnBreakFieldname);
        }
        
        // Trigger callback if set
        if (this.onColumnSelect) {
            this.onColumnSelect({
                columnIndex: columnIndex,
                sectionFieldname: sectionFieldname,
                columnBreakField: columnBreakField,
                width: column.width,
                isFirstColumn: columnIndex === 0
            });
        }
    }
    
    /**
     * Clear any selection (field, column, section)
     */
    clearSelection() {
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
        }
        this.selectedField = null;
        this.selectedElement = null;
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
        // Clear any previous selection
        this.clearSelection();
        
        // Add selection to this field
        fieldElement.classList.add('selected');
        this.selectedField = field;
        this.selectedElement = fieldElement;
        
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
    
    /**
     * Set column select callback
     */
    setOnColumnSelect(callback) {
        this.onColumnSelect = callback;
    }
    
    /**
     * Set section select callback
     */
    setOnSectionSelect(callback) {
        this.onSectionSelect = callback;
    }
    
    /**
     * Set drag drop handler reference
     */
    setDragDropHandler(handler) {
        this.dragDropHandler = handler;
    }
    
    /**
     * Initialize drag and drop for current sections
     * Called after render to setup drag handlers
     */
    initializeDragDrop() {
        if (!this.dragDropHandler) return;
        
        const tabContent = this.container.querySelector('.le-tab-content');
        if (tabContent) {
            this.dragDropHandler.setupSectionDrag(tabContent);
        }
    }
}

// Export as global
window.LayoutEditorVisualRenderer = LayoutEditorVisualRenderer;

