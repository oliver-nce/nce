# Layout Editor - Technical Guide

**Version:** 1.0.68  
**Last Updated:** 2026-01-04

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Structures](#data-structures)
4. [File Reference](#file-reference)
5. [Core Concepts](#core-concepts)
6. [Frappe Integration](#frappe-integration)
7. [Drag & Drop System](#drag--drop-system)
8. [Styling & Theming](#styling--theming)
9. [Key Algorithms](#key-algorithms)
10. [Debugging Tips](#debugging-tips)

---

## Overview

The Layout Editor is a visual tool for customizing Frappe DocType layouts. It allows users to:

- **Reorder sections and columns** via drag & drop
- **Edit field properties** (label, required, hidden, width, etc.)
- **Preview changes** before applying
- **Apply customizations** via Property Setters (non-destructive)

### Why Property Setters?

Frappe stores DocType definitions in JSON files. Instead of modifying these files directly (which would be overwritten on updates), the Layout Editor creates **Property Setters** - database records that override specific field properties at runtime.

```
┌─────────────────────┐
│  Base DocType JSON  │ ← Read-only, from app/module
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Property Setters  │ ← Created by Layout Editor
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   frappe.get_meta() │ ← Merged view (base + overrides)
└─────────────────────┘
```

---

## Architecture

### Client-Side Components (JavaScript)

```
┌─────────────────────────────────────────────────────────────────┐
│                    layout_editor.js (Controller)                │
│                 Frappe form integration, tab setup              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 layout_editor_widget.js (Orchestrator)          │
│         Creates & coordinates all other components              │
└───────┬──────────────┬─────────────────┬───────────────┬────────┘
        │              │                 │               │
        ▼              ▼                 ▼               ▼
┌───────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ data_manager  │ │visual_render│ │ properties  │ │ drag_drop   │
│    .js        │ │    er.js    │ │  _panel.js  │ │ _handler.js │
└───────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
        │              │                 │               │
        │              │                 │               │
        ▼              ▼                 ▼               ▼
┌───────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ field_types   │ │   utils.js  │ (shared utilities)             │
│    .js        │ │             │                                 │
└───────────────┘ └─────────────┘─────────────────────────────────┘
```

### Server-Side Components (Python)

```
layout_editor.py
├── get_eligible_doctypes()    # List WP* DocTypes
├── load_doctype_json()        # Load merged meta
├── validate_json()            # Basic JSON check
├── validate_json_for_customizations()  # Full validation
├── save_field_changes()       # Create Property Setters
└── update_properties()        # Batch update from JSON
```

---

## Data Structures

### The Three-Part Architecture (v1.0.68)

The data manager maintains three separate data structures:

```javascript
class LayoutEditorDataManager {
    // 1. ORIGINAL (pristine until save)
    this.rawFields = [];        // Original field array from server
    
    // 2. WORKING COPY (for property edits)
    this.shadowJSON = [];       // Deep copy, modified on property edits
    
    // 3. VIRTUAL ORDER (for drag/drop)
    this.virtualOrder = {       // Fieldname-only structure for ordering
        tabs: [
            {
                label: 'Details',
                fieldname: 'tab_fieldname',
                sections: [
                    {
                        fieldname: 'section_fieldname',
                        columns: [
                            {
                                columnBreakFieldname: null,  // Col 0 has none
                                fieldnames: ['field_a', 'field_b']
                            },
                            {
                                columnBreakFieldname: 'col_break_1',
                                fieldnames: ['field_c']
                            }
                        ]
                    }
                ]
            }
        ],
        currentTab: 0
    };
}
```

### Why Three Structures?

| Structure | Purpose | Modified By |
|-----------|---------|-------------|
| `rawFields` | Pristine reference | Only on load/save |
| `shadowJSON` | Working field data | Property edits |
| `virtualOrder` | Display ordering | Drag & drop |

### Data Flow

```
LOAD DocType
    │
    ├──► rawFields = server data (deep copy)
    ├──► shadowJSON = server data (working copy)
    └──► virtualOrder = parsed from shadowJSON

DRAG column/section
    └──► virtualOrder updated (simple array swap)
    
EDIT property (label, width, hidden)
    └──► shadowJSON updated
    
RENDER visual editor
    └──► buildStructure() combines:
         virtualOrder (order) + shadowJSON (field data)
         
PREVIEW/SAVE
    ├──► applyVirtualOrder() reorders shadowJSON
    ├──► Generate diff vs rawFields
    └──► Send changes to server as Property Setters
    
REVERT
    ├──► shadowJSON = deep copy of rawFields
    └──► Rebuild virtualOrder from original
```

---

## File Reference

### `/nce/public/js/layout_editor/`

| File | Purpose |
|------|---------|
| `utils.js` | Static utility methods (DOM helpers, alerts, escaping) |
| `field_types.js` | Field type → icon/color mapping |
| `data_manager.js` | Core data management, ordering, change tracking |
| `visual_renderer.js` | DOM rendering for visual editor |
| `properties_panel.js` | Field/column property editing UI |
| `drag_drop_handler.js` | HTML5 drag & drop implementation |
| `layout_editor_widget.js` | Main controller, coordinates all components |

### `/nce/wp_sync/doctype/layout_editor/`

| File | Purpose |
|------|---------|
| `layout_editor.py` | Server-side API methods |
| `layout_editor.js` | Frappe form controller |
| `layout_editor.json` | DocType definition |

### `/nce/public/css/`

| File | Purpose |
|------|---------|
| `layout_editor_theme.css` | Complete styling with CSS variables |

---

## Core Concepts

### Frappe Field Structure

In Frappe, a DocType's layout is determined by the **order of fields** in the `fields` array. Special field types act as structural markers:

```
fields = [
    { fieldtype: "Tab Break", label: "Details" },
    { fieldtype: "Section Break", label: "Basic Info" },
    { fieldtype: "Data", fieldname: "name", label: "Name" },
    { fieldtype: "Data", fieldname: "email", label: "Email" },
    { fieldtype: "Column Break" },  // <-- Starts Column 2
    { fieldtype: "Data", fieldname: "phone", label: "Phone" },
    { fieldtype: "Section Break", label: "Advanced" },
    ...
]
```

### Key Insight: First Column Has No Column Break

This is critical for the drag & drop logic:

```
Section Break → Start of section
├── Field A      ← Column 0 (implicit, NO Column Break field)
├── Field B      
├── Column Break ← Start of Column 1
├── Field C      
├── Column Break ← Start of Column 2
└── Field D      
```

When moving Column 2 to position 0:
- Column 2's fields move to start (without their Column Break)
- The Column Break stays to mark the new Column 1

### The 12-Column Grid

Frappe uses a Bootstrap-style 12-column grid. The `columns` property on a Column Break specifies width:

- `columns: 0` or undefined → "auto" (equal split)
- `columns: 6` → 50% width
- `columns: 4` → 33% width

**Rule:** Column 0 (first column) is always "auto" - it takes whatever space remains after other columns.

---

## Frappe Integration

### Loading DocType Data

```python
# Server-side: layout_editor.py
@frappe.whitelist()
def load_doctype_json(doctype_name):
    meta = frappe.get_meta(doctype_name)  # Merged view!
    
    fields = []
    for field in meta.fields:
        field_dict = field.as_dict()
        # Clean up metadata fields
        fields.append(field_dict)
    
    return {
        "fields_json": json.dumps(fields),
        "total_fields": len(fields)
    }
```

```javascript
// Client-side: data_manager.js
async loadDocType(doctypeName) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: 'nce.wp_sync.doctype.layout_editor.layout_editor.load_doctype_json',
            args: { doctype_name: doctypeName },
            callback: (response) => {
                this.rawFields = JSON.parse(response.message.fields_json);
                this.shadowJSON = JSON.parse(JSON.stringify(this.rawFields));
                this.buildVirtualOrder();
                this.buildStructure();
                resolve(result);
            }
        });
    });
}
```

### Saving Changes via Property Setters

```python
# Server-side: layout_editor.py
@frappe.whitelist()
def save_field_changes(doctype_name, changes):
    """
    changes = {
        fieldname: { property: value, ... },
        ...
    }
    """
    for fieldname, properties in changes.items():
        for prop, value in properties.items():
            # Check if Property Setter exists
            existing = frappe.db.exists("Property Setter", {
                "doc_type": doctype_name,
                "field_name": fieldname,
                "property": prop
            })
            
            if existing:
                # Update existing
                ps = frappe.get_doc("Property Setter", existing)
                ps.value = str(value)
                ps.save()
            else:
                # Create new - CRITICAL: doctype_or_field = "DocField"
                frappe.get_doc({
                    "doctype": "Property Setter",
                    "doctype_or_field": "DocField",  # ← Required!
                    "doc_type": doctype_name,
                    "field_name": fieldname,
                    "property": prop,
                    "value": str(value),
                    "property_type": "Data"  # or "Check", "Int"
                }).insert()
    
    frappe.db.commit()
    frappe.clear_cache(doctype=doctype_name)
```

---

## Drag & Drop System

### Section Drag & Drop

```javascript
// drag_drop_handler.js

setupSectionDrag(sectionsContainer) {
    const sections = sectionsContainer.querySelectorAll('.le-section');
    
    sections.forEach((section, index) => {
        this.makeSectionDraggable(section, index);
    });
    
    // Create drop zones BETWEEN sections
    this.createDropZones(sectionsContainer, sections.length);
}

makeSectionDraggable(sectionEl, sectionIndex) {
    const header = sectionEl.querySelector('.le-section-header');
    
    // Make HEADER draggable (not whole section)
    header.setAttribute('draggable', 'true');
    
    header.addEventListener('dragstart', (e) => {
        this.draggedData = { type: 'section', fromIndex: sectionIndex };
        e.dataTransfer.setData('text/plain', JSON.stringify(this.draggedData));
        sectionEl.classList.add('le-dragging');
        
        // Show drop zones
        this.dropZones.forEach(zone => zone.classList.add('visible'));
    });
}

onDrop(event, targetIndex) {
    const fromIndex = this.draggedData.fromIndex;
    
    // Update virtualOrder (not rawFields!)
    this.dataManager.moveSectionInCurrentTab(fromIndex, targetIndex);
    
    // Re-render
    this.visualRenderer.render();
}
```

### Column Drag & Drop (Special Cases)

Column reordering is complex because of how Column Breaks work:

```javascript
// data_manager.js

moveColumnInSection(sectionFieldname, fromIndex, toIndex) {
    const section = this.findSectionInVirtualOrder(sectionFieldname);
    const columns = section.columns;
    
    // Simple array swap in virtualOrder
    const [extracted] = columns.splice(fromIndex, 1);
    columns.splice(toIndex, 0, extracted);
    
    // Fix Column Break assignments
    // Column 0: no break, Columns 1+: each has a break
    this.fixColumnBreakAssignments(columns);
    
    this.hasOrderChanges = true;
    this.buildStructure();
}

fixColumnBreakAssignments(columns) {
    // Collect all Column Breaks
    const allColumnBreaks = [];
    columns.forEach(col => {
        if (col.columnBreakFieldname) {
            allColumnBreaks.push(col.columnBreakFieldname);
        }
    });
    
    // Reassign
    columns.forEach((col, idx) => {
        if (idx === 0) {
            delete col.columnBreakFieldname;  // First column: no break
        } else {
            col.columnBreakFieldname = allColumnBreaks.shift();  // Assign next break
        }
    });
}
```

---

## Styling & Theming

### CSS Variable Architecture

All colors are defined as CSS variables for easy rebranding:

```css
/* layout_editor_theme.css */

:root {
    /* Brand Tokens - Change these for rebranding */
    --le-brand-primary: #D7DF23;        /* NCE Citron */
    --le-brand-secondary: #231F20;       /* NCE Charcoal */
    
    /* Semantic Tokens - Mapped to elements */
    --le-section-header-bg: var(--le-brand-secondary);
    --le-selected-border: var(--le-brand-primary);
    --le-btn-primary-bg: var(--le-brand-primary);
}
```

### Key CSS Classes

| Class | Purpose |
|-------|---------|
| `.le-section` | Section container |
| `.le-section-header` | Draggable section header |
| `.le-column` | Column container |
| `.le-column-header` | Draggable column header |
| `.le-field` | Field card |
| `.le-field.selected` | Selected field styling |
| `.le-section-drop-zone` | Section drag target |
| `.le-column-drop-zone` | Column drag target |
| `.le-dragging` | Element being dragged |

---

## Key Algorithms

### Building Structure from Virtual Order

```javascript
buildStructure() {
    this.structure = { tabs: [], currentTab: this.virtualOrder.currentTab };
    
    this.virtualOrder.tabs.forEach(vTab => {
        const tab = {
            label: vTab.label,
            fieldname: vTab.fieldname,
            sections: []
        };
        
        vTab.sections.forEach(vSection => {
            // Get section data from shadowJSON
            const sectionField = this.getFieldFromShadow(vSection.fieldname);
            
            const section = {
                label: sectionField?.label || '',
                fieldname: vSection.fieldname,
                columns: []
            };
            
            vSection.columns.forEach(vColumn => {
                const column = {
                    fields: [],
                    columnBreakFieldname: vColumn.columnBreakFieldname,
                    width: 'auto'
                };
                
                // Get width from Column Break
                if (vColumn.columnBreakFieldname) {
                    const cbField = this.getFieldFromShadow(vColumn.columnBreakFieldname);
                    column.width = cbField?.columns || 'auto';
                }
                
                // Get full field objects for rendering
                vColumn.fieldnames.forEach(fieldname => {
                    const field = this.getFieldFromShadow(fieldname);
                    if (field) column.fields.push(field);
                });
                
                section.columns.push(column);
            });
            
            tab.sections.push(section);
        });
        
        this.structure.tabs.push(tab);
    });
}
```

### Applying Virtual Order (for Save)

```javascript
applyVirtualOrder() {
    const reorderedFields = [];
    
    this.virtualOrder.tabs.forEach(tab => {
        // Tab Break (if explicit)
        if (tab.fieldname && !tab.fieldname.startsWith('_')) {
            const tabField = this.getFieldFromShadow(tab.fieldname);
            if (tabField) reorderedFields.push(tabField);
        }
        
        tab.sections.forEach(section => {
            // Section Break
            const sectionField = this.getFieldFromShadow(section.fieldname);
            if (sectionField) reorderedFields.push(sectionField);
            
            section.columns.forEach((column, colIdx) => {
                // Column Break (columns 2+)
                if (colIdx > 0 && column.columnBreakFieldname) {
                    const cbField = this.getFieldFromShadow(column.columnBreakFieldname);
                    if (cbField) reorderedFields.push(cbField);
                }
                
                // Data fields
                column.fieldnames.forEach(fieldname => {
                    const field = this.getFieldFromShadow(fieldname);
                    if (field) reorderedFields.push(field);
                });
            });
        });
    });
    
    this.shadowJSON = reorderedFields;
    this.trackIdxChanges();  // Compare with rawFields for changes
}
```

### Column Visual Width Calculation

```javascript
calculateColumnVisualWidth(column, columnIndex, allColumns) {
    // Calculate total fixed width of columns 2+
    let totalFixedWidth = 0;
    let autoColumnCount = 0;
    
    allColumns.forEach((col, idx) => {
        if (idx === 0) {
            autoColumnCount++;  // First column is always auto
        } else {
            const width = parseInt(col.width) || 0;
            if (width > 0) {
                totalFixedWidth += width;
            } else {
                autoColumnCount++;
            }
        }
    });
    
    const remainingWidth = 12 - totalFixedWidth;
    
    if (columnIndex === 0 || !parseInt(column.width)) {
        // Auto column: share remaining space
        return (remainingWidth / autoColumnCount / 12) * 100;
    } else {
        // Fixed width column
        return (parseInt(column.width) / 12) * 100;
    }
}
```

---

## Debugging Tips

### Console Logging

The data manager logs operations:

```javascript
console.log(`Section moved in virtualOrder: ${fromIndex} -> ${toIndex}`);
console.log(`Column moved in virtualOrder: ${fromIndex} -> ${toIndex}`);
console.log(`Updated ${fieldname}.${property} = ${value}`);
```

### Inspecting State

```javascript
// In browser console:
layoutEditorWidget.dataManager.rawFields      // Original data
layoutEditorWidget.dataManager.shadowJSON     // Working copy
layoutEditorWidget.dataManager.virtualOrder   // Current ordering
layoutEditorWidget.dataManager.changes        // Pending changes
layoutEditorWidget.dataManager.hasChanges()   // Has unsaved changes?
```

### Common Issues

1. **Fields not saving:** Check `doctype_or_field: "DocField"` in Property Setter creation
2. **Column width not updating:** Verify the Column Break field has a `columns` property
3. **Drag not working:** Ensure `draggable="true"` is on the header element, not the container
4. **Order not persisting:** Check that `applyVirtualOrder()` is called before save

---

## Future Enhancements (Pending)

1. **Field drag between columns** - Move individual fields between columns
2. **Section drag between tabs** - Move entire sections to different tabs
3. **Add new fields** - Create custom fields directly in the editor
4. **Export to fixtures** - Generate fixture JSON for deployment
5. **Undo/Redo stack** - Multiple levels of undo

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.68 | 2026-01-04 | Virtual Order architecture, Revert button |
| 1.0.66 | 2026-01-04 | Visual Editor refresh on DocType change |
| 1.0.65 | 2026-01-04 | Column-to-position-0 move fix |
| 1.0.63 | 2026-01-04 | Column drag & drop |
| 1.0.59 | 2026-01-04 | Inline column width editing |
| 1.0.58 | 2026-01-04 | Column click selection & properties |
| 1.0.56 | 2026-01-04 | Section drag & drop |
| 1.0.33 | 2026-01-03 | Core Layout Editor with Property Setters |


