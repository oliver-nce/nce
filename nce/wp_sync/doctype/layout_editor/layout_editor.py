# Copyright (c) 2025, NCE and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import json


class LayoutEditor(Document):
    pass


@frappe.whitelist()
def load_doctype_json(doctype_name):
    """Load the fields JSON for a DocType"""
    if not doctype_name:
        frappe.throw("Please select a DocType")
    
    meta = frappe.get_meta(doctype_name)
    
    # Build a clean fields structure
    fields = []
    for field in meta.fields:
        field_dict = {
            "fieldname": field.fieldname,
            "fieldtype": field.fieldtype,
            "label": field.label or ""
        }
        
        # Add optional properties if they have values
        if field.options:
            field_dict["options"] = field.options
        if field.reqd:
            field_dict["reqd"] = 1
        if field.read_only:
            field_dict["read_only"] = 1
        if field.hidden:
            field_dict["hidden"] = 1
        if field.default:
            field_dict["default"] = field.default
        if field.description:
            field_dict["description"] = field.description
        if field.depends_on:
            field_dict["depends_on"] = field.depends_on
        if field.collapsible:
            field_dict["collapsible"] = 1
        if field.unique:
            field_dict["unique"] = 1
        if field.in_list_view:
            field_dict["in_list_view"] = 1
        if field.in_standard_filter:
            field_dict["in_standard_filter"] = 1
            
        fields.append(field_dict)
    
    # Build structure preview
    structure = build_structure_preview(fields)
    
    return {
        "fields": fields,
        "fields_json": json.dumps(fields, indent=4),
        "structure_html": structure,
        "doctype_name": doctype_name
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


