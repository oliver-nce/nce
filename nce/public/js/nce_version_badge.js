/**
 * NCE Version Badge with Cache Clear
 * Displays app version/branch info and provides quick cache clear
 */

frappe.ready(function() {
    // Wait for boot info to be available
    if (typeof frappe.boot === 'undefined') return;
    
    const version = frappe.boot.nce_version || 'unknown';
    const branch = frappe.boot.nce_branch || 'unknown';
    
    // Create the badge element
    const badge = document.createElement('div');
    badge.id = 'nce-version-badge';
    badge.innerHTML = `
        <span class="version">NCE v${version}</span>
        <span class="separator">|</span>
        <span class="branch">${branch}</span>
        <button class="cache-btn" title="Clear Cache & Reload">🔄</button>
    `;
    
    // Style the badge
    badge.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: linear-gradient(135deg, #2d3436 0%, #636e72 100%);
        color: #dfe6e9;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        opacity: 0.85;
        transition: opacity 0.2s ease;
        display: flex;
        align-items: center;
        gap: 4px;
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        #nce-version-badge:hover {
            opacity: 1 !important;
        }
        #nce-version-badge .branch {
            color: #CDDC39;
            font-weight: 600;
        }
        #nce-version-badge .separator {
            margin: 0 4px;
            opacity: 0.5;
        }
        #nce-version-badge .cache-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 12px;
            padding: 2px 4px;
            margin-left: 6px;
            border-radius: 4px;
            transition: all 0.2s ease;
            opacity: 0.7;
        }
        #nce-version-badge .cache-btn:hover {
            background: rgba(255,255,255,0.15);
            opacity: 1;
            transform: rotate(90deg);
        }
        #nce-version-badge .cache-btn.spinning {
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    // Add to page
    document.body.appendChild(badge);
    
    // Cache clear handler
    const cacheBtn = badge.querySelector('.cache-btn');
    cacheBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // Add spinning animation
        cacheBtn.classList.add('spinning');
        
        frappe.call({
            method: 'nce.wp_sync.api.clear_all_caches',
            freeze: true,
            freeze_message: __('Clearing cache...'),
            callback: function(r) {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: __('Cache cleared! Reloading...'),
                        indicator: 'green'
                    }, 2);
                    setTimeout(() => location.reload(true), 800);
                }
            },
            error: function() {
                cacheBtn.classList.remove('spinning');
                frappe.show_alert({
                    message: __('Failed to clear cache'),
                    indicator: 'red'
                });
            }
        });
    });
});
