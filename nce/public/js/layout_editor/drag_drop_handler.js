/**
 * Drag & Drop Handler
 * Handles drag and drop functionality for sections (Phase 2)
 */

class LayoutEditorDragDropHandler {
    constructor(visualRenderer, dataManager) {
        this.visualRenderer = visualRenderer;
        this.dataManager = dataManager;
        this.draggedElement = null;
        this.draggedData = null;
        this.dropZones = [];
        this.placeholder = null;
    }
    
    /**
     * Initialize drag and drop for sections
     */
    initialize() {
        console.log('Drag & Drop Handler: Initializing section drag & drop');
    }
    
    /**
     * Setup drag handlers for all sections in a container
     * Called by visual_renderer after rendering sections
     */
    setupSectionDrag(sectionsContainer) {
        if (!sectionsContainer) return;
        
        const sections = sectionsContainer.querySelectorAll('.le-section');
        
        sections.forEach((section, index) => {
            this.makeSectionDraggable(section, index);
        });
        
        // Create drop zones between sections
        this.createDropZones(sectionsContainer, sections.length);
    }
    
    /**
     * Make a section draggable
     */
    makeSectionDraggable(sectionEl, sectionIndex) {
        const header = sectionEl.querySelector('.le-section-header');
        if (!header) return;
        
        // Store section index
        sectionEl.dataset.sectionIndex = sectionIndex;
        
        // Make the HEADER draggable (not the whole section)
        header.setAttribute('draggable', 'true');
        header.dataset.sectionIndex = sectionIndex;
        
        // Drag start - on header
        header.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            this.onDragStart(e, sectionEl, sectionIndex);
        });
        
        // Drag end - on header
        header.addEventListener('dragend', (e) => {
            e.stopPropagation();
            this.onDragEnd(e);
        });
        
        // Style the drag handle
        const dragHandle = header.querySelector('.le-drag-handle');
        if (dragHandle) {
            dragHandle.style.cursor = 'grab';
            dragHandle.title = 'Drag to reorder section';
        }
        
        // Also style the header to indicate it's draggable
        header.style.cursor = 'grab';
    }
    
    /**
     * Create drop zones between sections
     */
    createDropZones(container, sectionCount) {
        // Remove existing drop zones
        this.dropZones.forEach(zone => zone.remove());
        this.dropZones = [];
        
        const sections = container.querySelectorAll('.le-section');
        
        // Create drop zone before first section
        const firstZone = this.createDropZone(0);
        if (sections[0]) {
            container.insertBefore(firstZone, sections[0]);
        } else {
            container.appendChild(firstZone);
        }
        this.dropZones.push(firstZone);
        
        // Create drop zones after each section
        sections.forEach((section, index) => {
            const zone = this.createDropZone(index + 1);
            section.after(zone);
            this.dropZones.push(zone);
        });
    }
    
    /**
     * Create a single drop zone element
     */
    createDropZone(targetIndex) {
        const zone = document.createElement('div');
        zone.className = 'le-section-drop-zone';
        zone.dataset.targetIndex = targetIndex;
        
        // Drop zone visual indicator (hidden by default)
        zone.innerHTML = '<div class="le-drop-indicator">Drop section here</div>';
        
        // Drag over - show zone
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            zone.classList.add('active');
        });
        
        // Drag leave - hide zone
        zone.addEventListener('dragleave', (e) => {
            zone.classList.remove('active');
        });
        
        // Drop
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('active');
            this.onDrop(e, parseInt(zone.dataset.targetIndex));
        });
        
        return zone;
    }
    
    /**
     * Handle drag start
     */
    onDragStart(event, sectionEl, sectionIndex) {
        this.draggedElement = sectionEl;
        this.draggedData = {
            type: 'section',
            fromIndex: sectionIndex
        };
        
        // Set drag data
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify(this.draggedData));
        
        // Create a custom drag image (clone of section header)
        const header = sectionEl.querySelector('.le-section-header');
        if (header) {
            const dragImage = header.cloneNode(true);
            dragImage.style.width = header.offsetWidth + 'px';
            dragImage.style.position = 'absolute';
            dragImage.style.top = '-1000px';
            dragImage.style.left = '-1000px';
            dragImage.style.opacity = '0.8';
            dragImage.style.background = '#D7DF23';
            document.body.appendChild(dragImage);
            event.dataTransfer.setDragImage(dragImage, 20, 20);
            
            // Remove drag image after a short delay
            setTimeout(() => {
                document.body.removeChild(dragImage);
            }, 0);
        }
        
        // Add dragging class for styling
        sectionEl.classList.add('le-dragging');
        
        // Show all drop zones immediately
        this.dropZones.forEach(zone => {
            zone.classList.add('visible');
        });
        
        console.log('Drag started: section', sectionIndex);
    }
    
    /**
     * Handle drag end
     */
    onDragEnd(event) {
        // Remove dragging class
        if (this.draggedElement) {
            this.draggedElement.classList.remove('le-dragging');
        }
        
        // Hide all drop zones
        this.dropZones.forEach(zone => {
            zone.classList.remove('visible', 'active');
        });
        
        // Reset state
        this.draggedElement = null;
        this.draggedData = null;
        
        console.log('Drag ended');
    }
    
    /**
     * Handle drop
     */
    onDrop(event, targetIndex) {
        if (!this.draggedData || this.draggedData.type !== 'section') {
            return;
        }
        
        const fromIndex = this.draggedData.fromIndex;
        
        // Don't move if dropping in same position
        if (fromIndex === targetIndex || fromIndex === targetIndex - 1) {
            console.log('No move needed - same position');
            return;
        }
        
        // Adjust target index if moving down
        let actualTargetIndex = targetIndex;
        if (fromIndex < targetIndex) {
            actualTargetIndex = targetIndex - 1;
        }
        
        console.log(`Moving section from ${fromIndex} to ${actualTargetIndex}`);
        
        // Call data manager to perform the move
        const success = this.dataManager.moveSectionInCurrentTab(fromIndex, actualTargetIndex);
        
        if (success) {
            // Re-render the visual editor
            this.visualRenderer.render();
            
            // Re-setup drag handlers after render
            const tabContent = this.visualRenderer.container.querySelector('.le-tab-content');
            if (tabContent) {
                this.setupSectionDrag(tabContent);
            }
            
            // Show feedback
            LayoutEditorUtils.showAlert('Section moved! Click "Preview Changes" to apply.', 'green');
        } else {
            LayoutEditorUtils.showAlert('Failed to move section', 'red');
        }
    }
}

// Export as global
window.LayoutEditorDragDropHandler = LayoutEditorDragDropHandler;
