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


@frappe.whitelist()
def validate_json_for_customizations(doctype_name, json_str):
    """Validate JSON before applying as customizations - checks all fields, rejects all if any invalid"""
    errors = []
    
    # Parse JSON
    try:
        fields = json.loads(json_str)
    except json.JSONDecodeError as e:
        return {"success": False, "errors": [f"Invalid JSON syntax: {str(e)}"]}
    
    # Check structure
    if not isinstance(fields, list):
        return {"success": False, "errors": ["JSON must be an array of field objects"]}
    
    # Get base meta to check against
    try:
        base_meta = frappe.get_meta(doctype_name)
    except Exception as e:
        return {"success": False, "errors": [f"Cannot load DocType '{doctype_name}': {str(e)}"]}
    
    base_fieldnames = [f.fieldname for f in base_meta.fields]
    
    # Valid fieldtypes
    valid_fieldtypes = [
        "Data", "Text", "Small Text", "Text Editor", "Code", "Select", "Link", 
        "Dynamic Link", "Check", "Int", "Float", "Currency", "Date", "Time", 
        "Datetime", "Duration", "Password", "Percent", "Long Text", "HTML", 
        "Markdown Editor", "Attach", "Attach Image", "Signature", "Color", 
        "Barcode", "Geolocation", "HTML Editor", "Read Only", "Button",
        "Table", "Table MultiSelect", "Section Break", "Column Break", "Tab Break",
        "Heading", "Image", "Fold", "Rating", "Icon", "Autocomplete", "JSON"
    ]
    
    # Validate each field
    for idx, field in enumerate(fields):
        if not isinstance(field, dict):
            errors.append(f"Field {idx}: Not an object")
            continue
        
        # Required fields
        fieldname = field.get("fieldname")
        fieldtype = field.get("fieldtype")
        
        if not fieldname:
            errors.append(f"Field {idx}: Missing 'fieldname'")
            continue
            
        if not fieldtype:
            errors.append(f"Field {idx} ({fieldname}): Missing 'fieldtype'")
            continue
        
        # Check fieldtype validity
        if fieldtype not in valid_fieldtypes:
            errors.append(f"Field {idx} ({fieldname}): Invalid fieldtype '{fieldtype}'")
        
        # Check for duplicate fieldnames in this submission
        fieldnames_in_submission = [f.get("fieldname") for f in fields if f.get("fieldname")]
        if fieldnames_in_submission.count(fieldname) > 1:
            errors.append(f"Field {idx} ({fieldname}): Duplicate fieldname in submission")
    
    # Check for deleted core fields (fields in base but not in submission)
    edited_fieldnames = [f.get("fieldname") for f in fields if f.get("fieldname")]
    deleted_fields = set(base_fieldnames) - set(edited_fieldnames)
    
    if deleted_fields:
        errors.append(f"Cannot delete core fields: {', '.join(sorted(deleted_fields))}. To hide them, set 'hidden': 1 instead.")
    
    # Return results
    if errors:
        return {
            "success": False, 
            "errors": errors,
            "total_errors": len(errors)
        }
    else:
        # Build structure preview
        structure = build_structure_preview(fields)
        return {
            "success": True,
            "message": f"✅ All {len(fields)} fields validated successfully",
            "structure_html": structure
        }


@frappe.whitelist()
def update_properties(doctype_name, json_str):
    """Apply validated JSON as Property Setters - assumes validation already passed"""
    try:
        fields = json.loads(json_str)
    except json.JSONDecodeError as e:
        frappe.throw(f"Invalid JSON: {str(e)}")
    
    # Get current meta
    base_meta = frappe.get_meta(doctype_name)
    
    # Track changes
    updated_count = 0
    created_count = 0
    
    # Apply each field's properties
    for field in fields:
        fieldname = field.get("fieldname")
        if not fieldname:
            continue
        
        # Get base field if exists
        base_field = None
        for f in base_meta.fields:
            if f.fieldname == fieldname:
                base_field = f
                break
        
        # Compare and create Property Setters for changed properties
        for prop, value in field.items():
            # Skip fieldname and fieldtype (can't be changed via Property Setter)
            if prop in ["fieldname", "fieldtype"]:
                continue
            
            # Check if property changed from base
            base_value = getattr(base_field, prop, None) if base_field else None
            
            # If different from base, create/update Property Setter
            if value != base_value:
                # Check if Property Setter already exists
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
                    updated_count += 1
                else:
                    # Create new Property Setter
                    frappe.get_doc({
                        "doctype": "Property Setter",
                        "doc_type": doctype_name,
                        "field_name": fieldname,
                        "property": prop,
                        "value": str(value),
                        "property_type": get_property_type(value),
                        "applied_on": "DocField"  # Required: indicates this is a field property
                    }).insert()
                    created_count += 1
    
    # Commit changes
    frappe.db.commit()
    
    # Clear cache to reflect changes
    frappe.clear_cache(doctype=doctype_name)
    
    return {
        "success": True,
        "message": f"✅ Applied customizations: {created_count} created, {updated_count} updated",
        "created": created_count,
        "updated": updated_count
    }


def get_property_type(value):
    """Determine property type for Property Setter"""
    if isinstance(value, bool) or value in [0, 1]:
        return "Check"
    elif isinstance(value, int):
        return "Int"
    elif isinstance(value, float):
        return "Float"
    else:
        return "Data"


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




