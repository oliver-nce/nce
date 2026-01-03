# Copyright (c) 2025, NCE and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import json


class LayoutEditor(Document):
    pass


@frappe.whitelist()
def load_doctype_json(doctype_name):
    """Load the fields JSON for a DocType - includes ALL properties from base + Property Setters"""
    if not doctype_name:
        frappe.throw("Please select a DocType")
    
    meta = frappe.get_meta(doctype_name)
    
    # Build a complete fields structure with ALL properties
    fields = []
    for field in meta.fields:
        # Get all field properties as dict
        field_dict = field.as_dict()
        
        # Remove metadata fields that aren't needed for layout
        remove_keys = [
            'name', 'owner', 'creation', 'modified', 'modified_by', 
            'docstatus', 'parent', 'parentfield', 'parenttype', 
            'idx', 'doctype', '__islocal', '__onload', '__unsaved'
        ]
        for key in remove_keys:
            field_dict.pop(key, None)
        
        # Ensure essential fields are present
        if not field_dict.get("fieldname"):
            continue
        if not field_dict.get("fieldtype"):
            continue
            
        # Clean up - remove None/empty values for cleaner JSON
        field_dict = {k: v for k, v in field_dict.items() if v not in [None, "", 0, []]}
        
        # But ensure label exists (can be empty string)
        if "label" not in field_dict:
            field_dict["label"] = ""
            
        fields.append(field_dict)
    
    # Build structure preview
    structure = build_structure_preview(fields)
    
    return {
        "fields": fields,
        "fields_json": json.dumps(fields, indent=4),
        "structure_html": structure,
        "doctype_name": doctype_name,
        "total_fields": len(fields),
        "source": "Customized version (base JSON + Property Setters merged)"
    }


@frappe.whitelist()
def validate_json(json_str):
    """Validate that the JSON is valid and has required structure"""
    try:
        fields = json.loads(json_str)
        
        if not isinstance(fields, list):
            return {"valid": False, "error": "JSON must be an array of field objects"}
        
        errors = []
        for i, field in enumerate(fields):
            if not isinstance(field, dict):
                errors.append(f"Item {i} is not an object")
                continue
            if "fieldname" not in field:
                errors.append(f"Item {i} missing 'fieldname'")
            if "fieldtype" not in field:
                errors.append(f"Item {i} missing 'fieldtype'")
        
        if errors:
            return {"valid": False, "error": "\n".join(errors)}
        
        # Build structure preview
        structure = build_structure_preview(fields)
        
        return {
            "valid": True, 
            "message": f"Valid JSON with {len(fields)} fields",
            "structure_html": structure
        }
        
    except json.JSONDecodeError as e:
        return {"valid": False, "error": f"Invalid JSON syntax: {str(e)}"}


@frappe.whitelist()
def generate_cursor_prompt(doctype_name, json_str):
    """Generate a prompt to paste into Cursor"""
    try:
        fields = json.loads(json_str)
    except json.JSONDecodeError as e:
        frappe.throw(f"Invalid JSON: {str(e)}")
    
    # Generate field_order array
    field_order = [f["fieldname"] for f in fields]
    
    prompt = f"""## Update Layout for DocType: {doctype_name}

Please update the JSON file for DocType `{doctype_name}` with the following layout changes.

### New field_order:
```json
{json.dumps(field_order, indent=4)}
```

### New fields array:
```json
{json.dumps(fields, indent=4)}
```

### Instructions:
1. Replace the `field_order` array in the JSON file with the new one above
2. Replace the `fields` array in the JSON file with the new one above
3. Bump the version number
4. Commit and push

Please confirm before making changes.
"""
    
    return {"prompt": prompt}


def build_structure_preview(fields):
    """Build an HTML preview of the layout structure"""
    html = ['<div style="font-family: monospace; font-size: 12px; line-height: 1.6;">']
    
    current_tab = "Default"
    current_section = None
    in_column = False
    indent = 0
    
    for field in fields:
        ft = field.get("fieldtype", "")
        fn = field.get("fieldname", "")
        label = field.get("label", fn)
        hidden = field.get("hidden", 0)
        
        style = "color: #888;" if hidden else ""
        hidden_badge = ' <span style="color: red; font-size: 10px;">[HIDDEN]</span>' if hidden else ""
        
        if ft == "Tab Break":
            current_tab = label or fn
            html.append(f'<div style="margin-top: 10px; font-weight: bold; color: #2196F3;">📑 TAB: {label}{hidden_badge}</div>')
            indent = 1
            
        elif ft == "Section Break":
            current_section = label or fn
            collapsible = " (collapsible)" if field.get("collapsible") else ""
            html.append(f'<div style="margin-top: 8px; margin-left: {indent*20}px; font-weight: bold; color: #4CAF50;">📁 SECTION: {label}{collapsible}{hidden_badge}</div>')
            
        elif ft == "Column Break":
            html.append(f'<div style="margin-left: {indent*20 + 20}px; color: #FF9800;">│ ── COLUMN BREAK ──</div>')
            
        else:
            # Regular field
            html.append(f'<div style="margin-left: {indent*20 + 40}px; {style}">• {label} <span style="color: #999;">({ft})</span>{hidden_badge}</div>')
    
    html.append('</div>')
    return "\n".join(html)




