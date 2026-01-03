/**
 * Properties Panel
 * Displays and edits properties of selected field
 */

class LayoutEditorPropertiesPanel {
    constructor(container) {
        this.container = container;
        this.currentField = null;
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
     * Display field properties
     */
    displayField(field) {
        this.currentField = field;
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
        
        // Change handler (placeholder for now)
        inputEl.addEventListener('change', (e) => {
            this.onPropertyChange(propName, e.target.value, type);
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
     * Handle property change (placeholder)
     */
    onPropertyChange(propName, value, type) {
        console.log('Property changed:', propName, value);
        // TODO: Update data model and mark as changed
    }
    
    /**
     * Toggle hidden state
     */
    toggleHidden() {
        console.log('Toggle hidden for:', this.currentField.fieldname);
        // TODO: Implement
        this.utils.showAlert('Quick actions coming in Phase 2', 'blue');
    }
    
    /**
     * Toggle required state
     */
    toggleRequired() {
        console.log('Toggle required for:', this.currentField.fieldname);
        // TODO: Implement
        this.utils.showAlert('Quick actions coming in Phase 2', 'blue');
    }
    
    /**
     * Toggle read only state
     */
    toggleReadOnly() {
        console.log('Toggle read only for:', this.currentField.fieldname);
        // TODO: Implement
        this.utils.showAlert('Quick actions coming in Phase 2', 'blue');
    }
}

// Export as global
window.LayoutEditorPropertiesPanel = LayoutEditorPropertiesPanel;

