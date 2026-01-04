/**
 * Properties Panel
 * Displays and edits properties of selected field
 */

class LayoutEditorPropertiesPanel {
    constructor(container, dataManager) {
        this.container = container;
        this.dataManager = dataManager;
        this.currentField = null;
        this.currentColumn = null;
        this.selectionType = null; // 'field', 'column', 'section'
        this.utils = LayoutEditorUtils;
    }
    
    /**
     * Render empty state
     */
    renderEmpty() {
        this.utils.clearElement(this.container);
        
        const emptyDiv = this.utils.createElement(
            'div',
            ['le-properties-empty'],
            {},
            `
                <div style="padding: 20px; text-align: center; color: #999;">
                    <div style="font-size: 48px; margin-bottom: 15px;">👈</div>
                    <h4>No Field Selected</h4>
                    <p>Click on a field in the visual panel to view and edit its properties</p>
                </div>
            `
        );
        
        this.container.appendChild(emptyDiv);
    }
    
    /**
     * Display column properties
     */
    displayColumn(columnData) {
        this.currentColumn = columnData;
        this.currentField = columnData.columnBreakField;
        this.selectionType = 'column';
        this.utils.clearElement(this.container);
        
        // Header
        const header = this.utils.createElement('div', ['le-properties-header', 'le-mb-15']);
        const title = this.utils.createElement('h3', [], {}, 'Column Properties');
        const columnInfo = this.utils.createElement(
            'div',
            ['le-field-info'],
            {},
            `
                <div><strong>Column:</strong> ${columnData.columnIndex + 1}</div>
                <div><strong>Section:</strong> ${this.utils.escapeHtml(columnData.sectionFieldname || 'Default')}</div>
            `
        );
        header.appendChild(title);
        header.appendChild(columnInfo);
        this.container.appendChild(header);
        
        // Width properties section
        const widthSection = this.utils.createElement('div', ['le-properties-section', 'le-mb-20']);
        const sectionTitle = this.utils.createElement(
            'h4',
            ['le-properties-section-title'],
            {},
            'Column Width (12-column grid)'
        );
        widthSection.appendChild(sectionTitle);
        
        if (columnData.isFirstColumn) {
            // First column - explain it takes remaining space
            const info = this.utils.createElement(
                'div',
                ['le-info-box'],
                {},
                `<p>📌 <strong>First column</strong> takes the remaining space after other columns.</p>
                 <p>To control width, adjust the Column Break for columns 2, 3, etc.</p>`
            );
            widthSection.appendChild(info);
        } else if (columnData.columnBreakField) {
            // Has Column Break - can edit width
            const currentWidth = columnData.columnBreakField.columns || 0;
            
            // Width selector
            const widthProp = this.utils.createElement('div', ['le-property', 'le-mb-10']);
            const label = this.utils.createElement('label', ['le-property-label'], {}, 'Width (columns)');
            widthProp.appendChild(label);
            
            const select = this.utils.createElement('select', ['le-select'], {
                'data-property': 'columns'
            });
            
            // Options: auto, 1-11
            const options = [
                { value: '0', label: 'Auto (equal split)' },
                { value: '1', label: '1 of 12 (8%)' },
                { value: '2', label: '2 of 12 (17%)' },
                { value: '3', label: '3 of 12 (25%)' },
                { value: '4', label: '4 of 12 (33%)' },
                { value: '5', label: '5 of 12 (42%)' },
                { value: '6', label: '6 of 12 (50%)' },
                { value: '7', label: '7 of 12 (58%)' },
                { value: '8', label: '8 of 12 (67%)' },
                { value: '9', label: '9 of 12 (75%)' },
                { value: '10', label: '10 of 12 (83%)' },
                { value: '11', label: '11 of 12 (92%)' }
            ];
            
            options.forEach(opt => {
                const option = this.utils.createElement('option', [], { value: opt.value }, opt.label);
                if (String(currentWidth) === opt.value) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            select.addEventListener('change', (e) => {
                this.onColumnWidthChange(parseInt(e.target.value));
            });
            
            widthProp.appendChild(select);
            widthSection.appendChild(widthProp);
            
            // Visual indicator
            const visualWidth = this.utils.createElement(
                'div',
                ['le-width-visual'],
                {},
                this.renderWidthVisual(currentWidth || 6)
            );
            widthSection.appendChild(visualWidth);
        } else {
            // No Column Break field found
            const info = this.utils.createElement(
                'div',
                ['le-info-box'],
                {},
                `<p>⚠️ Column Break field not found. Cannot edit width.</p>`
            );
            widthSection.appendChild(info);
        }
        
        this.container.appendChild(widthSection);
    }
    
    /**
     * Render visual width indicator
     */
    renderWidthVisual(width) {
        let html = '<div class="le-width-grid">';
        for (let i = 1; i <= 12; i++) {
            const active = i <= width ? 'active' : '';
            html += `<div class="le-width-cell ${active}"></div>`;
        }
        html += '</div>';
        html += `<div class="le-width-label">${width} of 12 columns</div>`;
        return html;
    }
    
    /**
     * Handle column width change
     */
    onColumnWidthChange(newWidth) {
        if (!this.currentColumn || !this.currentColumn.columnBreakField) return;
        
        const fieldname = this.currentColumn.columnBreakField.fieldname;
        
        // Update in data manager
        this.dataManager.updateFieldProperty(fieldname, 'columns', newWidth);
        
        // Update current reference
        this.currentColumn.columnBreakField.columns = newWidth;
        
        // Re-render to update visual
        this.displayColumn(this.currentColumn);
        
        this.utils.showAlert(`Column width set to ${newWidth || 'auto'}`, 'green');
    }
    
    /**
     * Display field properties
     */
    displayField(field) {
        this.currentField = field;
        this.currentColumn = null;
        this.selectionType = 'field';
        this.utils.clearElement(this.container);
        
        // Header
        const header = this.renderHeader(field);
        this.container.appendChild(header);
        
        // Properties sections
        const basicProps = this.renderBasicProperties(field);
        this.container.appendChild(basicProps);
        
        const displayProps = this.renderDisplayProperties(field);
        this.container.appendChild(displayProps);
        
        const validationProps = this.renderValidationProperties(field);
        this.container.appendChild(validationProps);
        
        // Quick actions
        const actions = this.renderQuickActions(field);
        this.container.appendChild(actions);
    }
    
    /**
     * Render header
     */
    renderHeader(field) {
        const header = this.utils.createElement('div', ['le-properties-header', 'le-mb-15']);
        
        const title = this.utils.createElement('h3', [], {}, 'Field Properties');
        const fieldInfo = this.utils.createElement(
            'div',
            ['le-field-info'],
            {},
            `
                <div><strong>Type:</strong> ${this.utils.escapeHtml(field.fieldtype)}</div>
                <div><strong>Name:</strong> ${this.utils.escapeHtml(field.fieldname)}</div>
            `
        );
        
        header.appendChild(title);
        header.appendChild(fieldInfo);
        
        return header;
    }
    
    /**
     * Render basic properties section
     */
    renderBasicProperties(field) {
        const section = this.utils.createElement('div', ['le-properties-section', 'le-mb-20']);
        
        const sectionTitle = this.utils.createElement(
            'h4',
            ['le-properties-section-title'],
            {},
            'Basic Properties'
        );
        section.appendChild(sectionTitle);
        
        // Label
        section.appendChild(this.renderProperty('Label', 'label', field.label || '', 'text'));
        
        // Description
        section.appendChild(this.renderProperty(
            'Description',
            'description',
            field.description || '',
            'textarea'
        ));
        
        // Options (if applicable)
        if (['Select', 'Link'].includes(field.fieldtype)) {
            section.appendChild(this.renderProperty(
                'Options',
                'options',
                field.options || '',
                'textarea'
            ));
        }
        
        // Default value
        section.appendChild(this.renderProperty('Default', 'default', field.default || '', 'text'));
        
        return section;
    }
    
    /**
     * Render display properties section
     */
    renderDisplayProperties(field) {
        const section = this.utils.createElement('div', ['le-properties-section', 'le-mb-20']);
        
        const sectionTitle = this.utils.createElement(
            'h4',
            ['le-properties-section-title'],
            {},
            'Display Properties'
        );
        section.appendChild(sectionTitle);
        
        // Rows (for text fields)
        if (['Text', 'Small Text', 'Long Text', 'Code'].includes(field.fieldtype)) {
            section.appendChild(this.renderProperty('Rows', 'rows', field.rows || 1, 'number'));
        }
        
        // Columns
        section.appendChild(this.renderProperty('Columns', 'columns', field.columns || 0, 'number'));
        
        // Bold
        section.appendChild(this.renderProperty('Bold', 'bold', field.bold || 0, 'checkbox'));
        
        // Hidden
        section.appendChild(this.renderProperty('Hidden', 'hidden', field.hidden || 0, 'checkbox'));
        
        // Read Only
        section.appendChild(this.renderProperty(
            'Read Only',
            'read_only',
            field.read_only || 0,
            'checkbox'
        ));
        
        return section;
    }
    
    /**
     * Render validation properties section
     */
    renderValidationProperties(field) {
        const section = this.utils.createElement('div', ['le-properties-section', 'le-mb-20']);
        
        const sectionTitle = this.utils.createElement(
            'h4',
            ['le-properties-section-title'],
            {},
            'Validation'
        );
        section.appendChild(sectionTitle);
        
        // Required
        section.appendChild(this.renderProperty('Required', 'reqd', field.reqd || 0, 'checkbox'));
        
        // Unique
        section.appendChild(this.renderProperty('Unique', 'unique', field.unique || 0, 'checkbox'));
        
        return section;
    }
    
    /**
     * Render a single property input
     */
    renderProperty(label, propName, value, type = 'text') {
        const propDiv = this.utils.createElement('div', ['le-property', 'le-mb-10']);
        
        const labelEl = this.utils.createElement(
            'label',
            ['le-property-label'],
            {},
            this.utils.escapeHtml(label)
        );
        propDiv.appendChild(labelEl);
        
        let inputEl;
        
        if (type === 'checkbox') {
            inputEl = this.utils.createElement('input', ['le-input'], {
                type: 'checkbox',
                'data-property': propName
            });
            if (value) {
                inputEl.checked = true;
            }
        } else if (type === 'textarea') {
            inputEl = this.utils.createElement('textarea', ['le-textarea'], {
                'data-property': propName,
                rows: 3
            });
            inputEl.value = value;
        } else {
            inputEl = this.utils.createElement('input', ['le-input'], {
                type: type,
                'data-property': propName
            });
            inputEl.value = value;
        }
        
        // Change handler
        inputEl.addEventListener('change', (e) => {
            const value = type === 'checkbox' ? e.target.checked : e.target.value;
            this.onPropertyChange(propName, value, type);
        });
        
        propDiv.appendChild(inputEl);
        
        return propDiv;
    }
    
    /**
     * Render quick actions
     */
    renderQuickActions(field) {
        const section = this.utils.createElement('div', ['le-properties-section', 'le-mb-20']);
        
        const sectionTitle = this.utils.createElement(
            'h4',
            ['le-properties-section-title'],
            {},
            'Quick Actions'
        );
        section.appendChild(sectionTitle);
        
        const actionsDiv = this.utils.createElement('div', ['le-quick-actions']);
        
        // Hide/Show toggle
        const hideBtn = this.utils.createElement(
            'button',
            ['le-btn', 'le-btn-secondary', 'le-mb-10'],
            { style: 'width: 100%;' },
            field.hidden ? '👁️ Show Field' : '👁️‍🗨️ Hide Field'
        );
        hideBtn.addEventListener('click', () => {
            this.toggleHidden();
        });
        actionsDiv.appendChild(hideBtn);
        
        // Make Required toggle
        const reqdBtn = this.utils.createElement(
            'button',
            ['le-btn', 'le-btn-secondary', 'le-mb-10'],
            { style: 'width: 100%;' },
            field.reqd ? '☐ Make Optional' : '☑️ Make Required'
        );
        reqdBtn.addEventListener('click', () => {
            this.toggleRequired();
        });
        actionsDiv.appendChild(reqdBtn);
        
        // Make Read Only toggle
        const readonlyBtn = this.utils.createElement(
            'button',
            ['le-btn', 'le-btn-secondary', 'le-mb-10'],
            { style: 'width: 100%;' },
            field.read_only ? '✏️ Make Editable' : '🔒 Make Read Only'
        );
        readonlyBtn.addEventListener('click', () => {
            this.toggleReadOnly();
        });
        actionsDiv.appendChild(readonlyBtn);
        
        section.appendChild(actionsDiv);
        
        return section;
    }
    
    /**
     * Handle property change
     */
    onPropertyChange(propName, value, type) {
        if (!this.currentField) return;
        
        console.log('Property changed:', propName, value);
        
        // Update in data manager
        this.dataManager.updateFieldProperty(
            this.currentField.fieldname,
            propName,
            value
        );
        
        // Show feedback
        this.utils.showAlert(`Updated ${propName}`, 'green');
    }
    
    /**
     * Toggle hidden state
     */
    toggleHidden() {
        if (!this.currentField) return;
        
        const newValue = this.currentField.hidden ? 0 : 1;
        this.dataManager.updateFieldProperty(
            this.currentField.fieldname,
            'hidden',
            newValue
        );
        
        // Update current field reference
        this.currentField.hidden = newValue;
        
        // Re-render to update button text
        this.displayField(this.currentField);
        
        this.utils.showSuccess(
            `Field ${newValue ? 'hidden' : 'shown'}`,
            'Quick Action'
        );
    }
    
    /**
     * Toggle required state
     */
    toggleRequired() {
        if (!this.currentField) return;
        
        const newValue = this.currentField.reqd ? 0 : 1;
        this.dataManager.updateFieldProperty(
            this.currentField.fieldname,
            'reqd',
            newValue
        );
        
        // Update current field reference
        this.currentField.reqd = newValue;
        
        // Re-render to update button text
        this.displayField(this.currentField);
        
        this.utils.showSuccess(
            `Field ${newValue ? 'required' : 'optional'}`,
            'Quick Action'
        );
    }
    
    /**
     * Toggle read only state
     */
    toggleReadOnly() {
        if (!this.currentField) return;
        
        const newValue = this.currentField.read_only ? 0 : 1;
        this.dataManager.updateFieldProperty(
            this.currentField.fieldname,
            'read_only',
            newValue
        );
        
        // Update current field reference
        this.currentField.read_only = newValue;
        
        // Re-render to update button text
        this.displayField(this.currentField);
        
        this.utils.showSuccess(
            `Field ${newValue ? 'read-only' : 'editable'}`,
            'Quick Action'
        );
    }
}

// Export as global
window.LayoutEditorPropertiesPanel = LayoutEditorPropertiesPanel;

