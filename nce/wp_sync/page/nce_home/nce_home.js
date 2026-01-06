/**
 * NCE Home - Landing Page
 * 
 * Auto-wires all shortcut buttons defined in the HTML.
 * To add a new button, just add a div to nce_home.html - no JS changes needed!
 */

frappe.pages['nce-home'].on_page_load = function(wrapper) {
    // Create the page
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'NCE Home',
        single_column: true
    });
    
    // Store page reference
    wrapper.page = page;
    
    // Load the HTML template
    $(frappe.render_template('nce_home')).appendTo(page.body);
    
    // Initialize buttons
    init_shortcut_buttons(wrapper);
    
    // Show version badge
    show_version_badge(wrapper);
};

frappe.pages['nce-home'].on_page_show = function(wrapper) {
    // Re-initialize if needed when page is shown again
};

/**
 * Initialize all shortcut buttons
 * Queries all .nce-shortcut-btn divs and renders them as clickable buttons
 */
function init_shortcut_buttons(wrapper) {
    const $container = $(wrapper).find('.nce-button-grid');
    
    $container.find('.nce-shortcut-btn').each(function() {
        const $btn = $(this);
        const route = $btn.data('route');
        const icon = $btn.data('icon') || '📄';
        const label = $btn.data('label') || 'Untitled';
        const description = $btn.data('description') || '';
        const filters = $btn.data('filters');
        
        // Render button content
        $btn.html(`
            <div class="nce-btn-icon">${icon}</div>
            <div class="nce-btn-content">
                <div class="nce-btn-label">${label}</div>
                ${description ? `<div class="nce-btn-description">${description}</div>` : ''}
            </div>
        `);
        
        // Add click handler
        $btn.on('click', function() {
            if (route) {
                // Handle filters if provided
                if (filters) {
                    try {
                        const filterObj = typeof filters === 'string' ? JSON.parse(filters) : filters;
                        frappe.set_route(route, filterObj);
                    } catch (e) {
                        frappe.set_route(route);
                    }
                } else {
                    frappe.set_route(route);
                }
            }
        });
        
        // Add hover effect class
        $btn.addClass('nce-btn-ready');
    });
}

/**
 * Show version badge in footer
 */
function show_version_badge(wrapper) {
    const $badge = $(wrapper).find('.nce-version-badge');
    
    if (frappe.boot.nce_version) {
        const branch = frappe.boot.nce_branch || '';
        const branchDisplay = branch && branch !== 'main' ? ` (${branch})` : '';
        $badge.text(`NCE v${frappe.boot.nce_version}${branchDisplay}`);
    }
}

