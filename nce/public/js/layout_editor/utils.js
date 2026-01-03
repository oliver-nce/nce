/**
 * Utility Functions
 * Shared helper functions for the Layout Editor
 */

class LayoutEditorUtils {
    /**
     * Escape HTML to prevent XSS
     */
    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Generate unique ID for elements
     */
    static generateId(prefix = 'le') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Deep clone an object
     */
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    
    /**
     * Check if object is empty
     */
    static isEmpty(obj) {
        return !obj || Object.keys(obj).length === 0;
    }
    
    /**
     * Debounce function calls
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Show Frappe alert
     */
    static showAlert(message, indicator = 'green') {
        frappe.show_alert({
            message: message,
            indicator: indicator
        });
    }
    
    /**
     * Show error message
     */
    static showError(message, title = 'Error') {
        frappe.msgprint({
            title: title,
            indicator: 'red',
            message: message
        });
    }
    
    /**
     * Show success message
     */
    static showSuccess(message, title = 'Success') {
        frappe.msgprint({
            title: title,
            indicator: 'green',
            message: message
        });
    }
    
    /**
     * Format field label (handle missing labels)
     */
    static formatLabel(field) {
        if (field.label) {
            return field.label;
        }
        // Generate label from fieldname
        if (field.fieldname) {
            return field.fieldname
                .replace(/_/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
        }
        return 'Unnamed Field';
    }
    
    /**
     * Get field display name (with required indicator)
     */
    static getFieldDisplayName(field) {
        let label = this.formatLabel(field);
        if (field.reqd) {
            label += ' *';
        }
        return label;
    }
    
    /**
     * Create DOM element with classes and attributes
     */
    static createElement(tag, classes = [], attributes = {}, innerHTML = '') {
        const el = document.createElement(tag);
        
        if (classes.length > 0) {
            el.className = classes.join(' ');
        }
        
        Object.keys(attributes).forEach(key => {
            el.setAttribute(key, attributes[key]);
        });
        
        if (innerHTML) {
            el.innerHTML = innerHTML;
        }
        
        return el;
    }
    
    /**
     * Remove all child elements
     */
    static clearElement(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
    
    /**
     * Get field property safely (with default)
     */
    static getFieldProperty(field, property, defaultValue = null) {
        return field && field.hasOwnProperty(property) ? field[property] : defaultValue;
    }
    
    /**
     * Calculate column width percentage
     */
    static calculateColumnWidth(columns, totalColumns) {
        if (!columns || !totalColumns) return '100%';
        const percentage = (columns / totalColumns) * 100;
        return `${Math.round(percentage)}%`;
    }
}

// Export as global
window.LayoutEditorUtils = LayoutEditorUtils;

