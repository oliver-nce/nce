/**
 * Field Types Configuration
 * Maps Frappe field types to icons, colors, and labels
 */

class LayoutEditorFieldTypes {
    constructor() {
        // Field type to icon mapping (using emoji for now, can be replaced with icon font)
        this.icons = {
            'Data': '📝',
            'Small Text': '📝',
            'Text': '📄',
            'Text Editor': '📄',
            'Code': '💻',
            'Link': '🔗',
            'Dynamic Link': '↔️',
            'Select': '🔽',
            'Check': '☑️',
            'Int': '#️⃣',
            'Float': '#️⃣',
            'Currency': '💰',
            'Percent': '%',
            'Date': '📅',
            'Datetime': '🕒',
            'Time': '⏰',
            'Table': '📊',
            'Attach': '📎',
            'Attach Image': '🖼️',
            'Image': '🖼️',
            'Button': '⚙️',
            'HTML': '🌐',
            'Section Break': '📋',
            'Column Break': '│',
            'Tab Break': '📑',
            'Heading': '📌',
            'Read Only': '🔒',
            'Color': '🎨',
            'Signature': '✍️',
            'Barcode': '🔢',
            'Geolocation': '📍',
            'Duration': '⏱️',
            'Rating': '⭐',
            'Password': '🔐',
            'JSON': '💾',
            'Long Text': '📄',
            'Markdown Editor': '📝',
            'Table MultiSelect': '☑️',
            'Autocomplete': '🔍',
            'Phone': '📱',
            'Email': '📧'
        };
        
        // Field type CSS classes for colors
        this.colorClasses = {
            'Data': 'le-icon-data',
            'Small Text': 'le-icon-data',
            'Text': 'le-icon-data',
            'Link': 'le-icon-link',
            'Dynamic Link': 'le-icon-link',
            'Int': 'le-icon-number',
            'Float': 'le-icon-number',
            'Currency': 'le-icon-number',
            'Percent': 'le-icon-number',
            'Date': 'le-icon-date',
            'Datetime': 'le-icon-date',
            'Time': 'le-icon-date',
            'Select': 'le-icon-select',
            'Check': 'le-icon-check',
            'Table': 'le-icon-table'
        };
        
        // Default icon/color for unlisted types
        this.defaultIcon = '📄';
        this.defaultColorClass = 'le-icon-data';
    }
    
    /**
     * Get icon for field type
     */
    getIcon(fieldtype) {
        return this.icons[fieldtype] || this.defaultIcon;
    }
    
    /**
     * Get CSS class for field type color
     */
    getColorClass(fieldtype) {
        return this.colorClasses[fieldtype] || this.defaultColorClass;
    }
    
    /**
     * Check if field type is a break (Section, Column, Tab)
     */
    isBreak(fieldtype) {
        return ['Section Break', 'Column Break', 'Tab Break'].includes(fieldtype);
    }
    
    /**
     * Check if field type is a Section Break
     */
    isSectionBreak(fieldtype) {
        return fieldtype === 'Section Break';
    }
    
    /**
     * Check if field type is a Column Break
     */
    isColumnBreak(fieldtype) {
        return fieldtype === 'Column Break';
    }
    
    /**
     * Check if field type is a Tab Break
     */
    isTabBreak(fieldtype) {
        return fieldtype === 'Tab Break';
    }
    
    /**
     * Check if field is a data entry field (not break, not HTML, etc.)
     */
    isDataField(fieldtype) {
        const nonDataTypes = [
            'Section Break', 'Column Break', 'Tab Break',
            'HTML', 'Heading', 'Button'
        ];
        return !nonDataTypes.includes(fieldtype);
    }
}

// Export as global for Frappe environment
window.LayoutEditorFieldTypes = LayoutEditorFieldTypes;

