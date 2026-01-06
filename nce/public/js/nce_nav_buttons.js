/**
 * NCE Navigation Buttons
 * Adds Home and Back buttons to the left side of form headers
 */

(function() {
    'use strict';
    
    // CSS for the nav buttons
    const navStyles = `
        .nce-nav-buttons {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-right: 12px;
        }
        
        .nce-nav-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border: 1px solid var(--nce-silver, #E7E7E6);
            border-radius: 6px;
            background: var(--nce-white, #ffffff);
            cursor: pointer;
            font-size: 16px;
            transition: all 0.15s ease;
            text-decoration: none;
            color: var(--nce-charcoal, #231F20);
        }
        
        .nce-nav-btn:hover {
            background: var(--nce-citron, #D7DF23);
            border-color: var(--nce-citron, #D7DF23);
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .nce-nav-btn:active {
            transform: translateY(0);
        }
        
        /* Ensure title doesn't overflow into buttons */
        .page-head .title-area {
            display: flex;
            align-items: center;
        }
    `;
    
    // Inject styles once
    function injectStyles() {
        if (document.getElementById('nce-nav-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'nce-nav-styles';
        style.textContent = navStyles;
        document.head.appendChild(style);
    }
    
    // Add nav buttons to page header
    function addNavButtons() {
        // Only add on form/page views, not list views
        const pageHead = document.querySelector('.page-head .page-title');
        if (!pageHead) return;
        
        // Don't add twice
        if (pageHead.querySelector('.nce-nav-buttons')) return;
        
        // Don't add on the nce-home page itself
        if (window.location.pathname.includes('nce-home')) return;
        
        // Create button container
        const navContainer = document.createElement('div');
        navContainer.className = 'nce-nav-buttons';
        
        // Home button
        const homeBtn = document.createElement('a');
        homeBtn.className = 'nce-nav-btn nce-home-btn';
        homeBtn.href = '/app/nce-home';
        homeBtn.title = 'NCE Home';
        homeBtn.innerHTML = '🏠';
        homeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            frappe.set_route('nce-home');
        });
        
        // Back button
        const backBtn = document.createElement('button');
        backBtn.className = 'nce-nav-btn nce-back-btn';
        backBtn.title = 'Go Back';
        backBtn.innerHTML = '◀';
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.history.back();
        });
        
        navContainer.appendChild(homeBtn);
        navContainer.appendChild(backBtn);
        
        // Insert at the beginning of the title area
        pageHead.insertBefore(navContainer, pageHead.firstChild);
    }
    
    // Initialize when DOM is ready
    function init() {
        injectStyles();
        
        // Add buttons on initial load
        setTimeout(addNavButtons, 100);
        
        // Re-add buttons when page changes (Frappe SPA navigation)
        $(document).on('page-change', function() {
            setTimeout(addNavButtons, 100);
        });
        
        // Also listen for form refresh
        if (frappe.ui && frappe.ui.form) {
            $(document).on('form-refresh', function() {
                setTimeout(addNavButtons, 100);
            });
        }
    }
    
    // Start when document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();

