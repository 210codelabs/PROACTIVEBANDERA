#!/usr/bin/env python3
"""
Backend test for Templates API and Note Addenda API
Base URL: https://nextjs-ssr-stack.preview.emergentagent.com
Staff login: andy.manzano@proactiveclinic.com / apex123
"""

import requests
import json
import sys
from typing import Optional

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Track created resources for cleanup
created_template_ids = []
created_addendum_ids = []
test_encounter_id = None

def print_test(test_num: str, description: str):
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)

def print_result(success: bool, message: str):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def staff_login() -> Optional[requests.Session]:
    """Login as staff and return session with cookie"""
    print_test("SETUP", "Staff login")
    session = requests.Session()
    try:
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "andy.manzano@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            print_result(True, f"Staff login successful: {data.get('user', {}).get('email')}")
            print(f"Session cookie: {session.cookies.get('proactive_session', 'NOT SET')}")
            return session
        else:
            print_result(False, f"Staff login failed: {response.status_code} {response.text}")
            return None
    except Exception as e:
        print_result(False, f"Staff login error: {e}")
        return None

def test_templates_api(session: requests.Session):
    """Test Templates API endpoints"""
    global created_template_ids
    
    # TEST 1: GET without session -> 401
    print_test("A1", "GET /api/templates?kind=charting WITHOUT session -> 401")
    try:
        response = requests.get(f"{BASE_URL}/api/templates?kind=charting", timeout=10)
        if response.status_code == 401:
            print_result(True, f"Correctly blocked with 401: {response.json().get('error')}")
        else:
            print_result(False, f"Expected 401, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Error: {e}")
    
    # TEST 2: POST charting template
    print_test("A2", "POST /api/templates with charting template -> 200")
    try:
        template_data = {
            "kind": "charting",
            "name": "LBP",
            "shared": True,
            "shortcut": "lbp",
            "data": {
                "sections": {
                    "subjective": ["{age} y/o with LBP"],
                    "objective": [],
                    "assessment": ["Lumbago"],
                    "plan": ["PT referral"]
                }
            }
        }
        response = session.post(f"{BASE_URL}/api/templates", json=template_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("template"):
                template = data["template"]
                template_id = template.get("id")
                created_template_ids.append(template_id)
                print_result(True, f"Template created: id={template_id}, mine={template.get('mine')}")
                print(f"  Data sections: {list(template.get('data', {}).get('sections', {}).keys())}")
                # Verify data is parsed as object, not string
                if isinstance(template.get("data"), dict):
                    print_result(True, "Template data is parsed as object (not string)")
                else:
                    print_result(False, f"Template data is {type(template.get('data'))}, expected dict")
            else:
                print_result(False, f"Unexpected response structure: {data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Error: {e}")
    
    # TEST 3a: POST with invalid kind -> 400
    print_test("A3a", "POST with kind:'foo' -> 400")
    try:
        response = session.post(
            f"{BASE_URL}/api/templates",
            json={"kind": "foo", "name": "Test"},
            timeout=10
        )
        if response.status_code == 400:
            print_result(True, f"Correctly rejected with 400: {response.json().get('error')}")
        else:
            print_result(False, f"Expected 400, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Error: {e}")
    
    # TEST 3b: POST with no name -> 400
    print_test("A3b", "POST with no name -> 400")
    try:
        response = session.post(
            f"{BASE_URL}/api/templates",
            json={"kind": "charting"},
            timeout=10
        )
        if response.status_code == 400:
            print_result(True, f"Correctly rejected with 400: {response.json().get('error')}")
        else:
            print_result(False, f"Expected 400, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Error: {e}")
    
    # TEST 4: GET templates with kind=charting
    print_test("A4", "GET /api/templates?kind=charting -> 200, includes LBP template")
    try:
        response = session.get(f"{BASE_URL}/api/templates?kind=charting", timeout=10)
        if response.status_code == 200:
            data = response.json()
            templates = data.get("templates", [])
            print_result(True, f"Retrieved {len(templates)} charting templates")
            # Find the LBP template
            lbp_template = next((t for t in templates if t.get("name") == "LBP"), None)
            if lbp_template:
                print_result(True, f"LBP template found: id={lbp_template.get('id')}")
                # Verify data is parsed as object
                if isinstance(lbp_template.get("data"), dict):
                    print_result(True, "LBP template data is parsed as object (not string)")
                    sections = lbp_template.get("data", {}).get("sections", {})
                    print(f"  Sections: subjective={sections.get('subjective')}, assessment={sections.get('assessment')}")
                else:
                    print_result(False, f"LBP template data is {type(lbp_template.get('data'))}, expected dict")
            else:
                print_result(False, "LBP template not found in results")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Error: {e}")
    
    # TEST 5a: POST billing template
    print_test("A5a", "POST kind:'billing' template -> 200")
    try:
        billing_data = {
            "kind": "billing",
            "name": "Bundle",
            "shared": True,
            "data": {
                "codes": [
                    {
                        "cpt": "99214",
                        "description": "L4",
                        "feeCents": 17500
                    }
                ]
            }
        }
        response = session.post(f"{BASE_URL}/api/templates", json=billing_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("template"):
                template_id = data["template"].get("id")
                created_template_ids.append(template_id)
                print_result(True, f"Billing template created: id={template_id}")
            else:
                print_result(False, f"Unexpected response: {data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Error: {e}")
    
    # TEST 5b: POST order template
    print_test("A5b", "POST kind:'order' template -> 200")
    try:
        order_data = {
            "kind": "order",
            "name": "Labs",
            "data": {
                "orderType": "lab",
                "tests": ["CBC", "CMP"],
                "diagnoses": [
                    {
                        "icd10": "Z00.00",
                        "description": "exam"
                    }
                ]
            }
        }
        response = session.post(f"{BASE_URL}/api/templates", json=order_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("template"):
                template_id = data["template"].get("id")
                created_template_ids.append(template_id)
                print_result(True, f"Order template created: id={template_id}")
            else:
                print_result(False, f"Unexpected response: {data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Error: {e}")
    
    # TEST 6: PATCH template to change shared status
    print_test("A6", "PATCH /api/templates/{lbpId} {shared:false} -> 200")
    if created_template_ids:
        lbp_id = created_template_ids[0]  # First one is LBP
        try:
            response = session.patch(
                f"{BASE_URL}/api/templates/{lbp_id}",
                json={"shared": False},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                template = data.get("template", {})
                if template.get("shared") == False:
                    print_result(True, f"Template shared status updated to False")
                else:
                    print_result(False, f"Template shared={template.get('shared')}, expected False")
            else:
                print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        except Exception as e:
            print_result(False, f"Error: {e}")
    else:
        print_result(False, "No LBP template ID available")
    
    # TEST 7a: DELETE template
    print_test("A7a", "DELETE /api/templates/{lbpId} -> 200")
    if created_template_ids:
        lbp_id = created_template_ids[0]
        try:
            response = session.delete(f"{BASE_URL}/api/templates/{lbp_id}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    print_result(True, "Template deleted successfully")
                else:
                    print_result(False, f"Unexpected response: {data}")
            else:
                print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        except Exception as e:
            print_result(False, f"Error: {e}")
    else:
        print_result(False, "No template ID available")
    
    # TEST 7b: DELETE same template again -> 404
    print_test("A7b", "DELETE same template again -> 404")
    if created_template_ids:
        lbp_id = created_template_ids[0]
        try:
            response = session.delete(f"{BASE_URL}/api/templates/{lbp_id}", timeout=10)
            if response.status_code == 404:
                print_result(True, f"Correctly returned 404: {response.json().get('error')}")
            else:
                print_result(False, f"Expected 404, got {response.status_code}: {response.text}")
        except Exception as e:
            print_result(False, f"Error: {e}")
    else:
        print_result(False, "No template ID available")

def find_or_create_signed_encounter(session: requests.Session) -> Optional[str]:
    """Find a signed encounter or create one"""
    print_test("B-SETUP", "Find or create a signed encounter")
    
    # Try to find an existing signed encounter via MongoDB
    try:
        from pymongo import MongoClient
        client = MongoClient("mongodb://localhost:27017")
        db = client["proactive_clinic"]
        
        # Find a signed encounter
        encounter = db.Encounter.find_one({"status": "signed"})
        if encounter:
            encounter_id = encounter["_id"]
            print_result(True, f"Found existing signed encounter: {encounter_id}")
            return encounter_id
        
        # Find any encounter and sign it
        encounter = db.Encounter.find_one({})
        if encounter:
            encounter_id = encounter["_id"]
            print(f"Found encounter {encounter_id}, signing it...")
            
            # Sign the encounter via PATCH
            response = session.patch(
                f"{BASE_URL}/api/encounters/{encounter_id}",
                json={"signed": True},
                timeout=10
            )
            if response.status_code == 200:
                print_result(True, f"Signed encounter: {encounter_id}")
                return encounter_id
            else:
                print_result(False, f"Failed to sign encounter: {response.status_code} {response.text}")
        else:
            print_result(False, "No encounters found in database")
        
        client.close()
    except Exception as e:
        print_result(False, f"Error finding/creating encounter: {e}")
    
    return None

def test_addenda_api(session: requests.Session, encounter_id: str):
    """Test Note Addenda API endpoints"""
    global created_addendum_ids
    
    # TEST 9: GET without session -> 401
    print_test("B9", "GET /api/encounters/{id}/addenda WITHOUT session -> 401")
    try:
        response = requests.get(f"{BASE_URL}/api/encounters/{encounter_id}/addenda", timeout=10)
        if response.status_code == 401:
            print_result(True, f"Correctly blocked with 401: {response.json().get('error')}")
        else:
            print_result(False, f"Expected 401, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Error: {e}")
    
    # TEST 10: POST addendum with note
    print_test("B10", "POST addendum with note -> 200")
    try:
        response = session.post(
            f"{BASE_URL}/api/encounters/{encounter_id}/addenda",
            json={"note": "Clarification added after review."},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("addendum"):
                addendum = data["addendum"]
                addendum_id = addendum.get("id")
                created_addendum_ids.append(addendum_id)
                print_result(True, f"Addendum created: id={addendum_id}")
                print(f"  Note: {addendum.get('note')}")
                print(f"  Author: {addendum.get('authorName')}")
            else:
                print_result(False, f"Unexpected response: {data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Error: {e}")
    
    # TEST 11: POST addendum with newEncounterTypeId
    print_test("B11", "POST addendum with newEncounterTypeId -> 200")
    try:
        # First, get a valid encounter type
        et_response = session.get(f"{BASE_URL}/api/charting/encounter-types", timeout=10)
        if et_response.status_code == 200:
            encounter_types = et_response.json().get("encounterTypes", [])
            if encounter_types:
                new_type_id = encounter_types[0].get("id")
                new_type_name = encounter_types[0].get("name")
                print(f"Using encounter type: {new_type_name} (id={new_type_id})")
                
                # POST addendum with type change
                response = session.post(
                    f"{BASE_URL}/api/encounters/{encounter_id}/addenda",
                    json={"newEncounterTypeId": new_type_id},
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok") and data.get("addendum"):
                        addendum = data["addendum"]
                        addendum_id = addendum.get("id")
                        created_addendum_ids.append(addendum_id)
                        new_encounter_type_name = addendum.get("newEncounterTypeName")
                        print_result(True, f"Addendum created with type change: id={addendum_id}")
                        print(f"  New encounter type: {new_encounter_type_name}")
                        
                        # Verify newEncounterTypeName is set (non-null)
                        if new_encounter_type_name:
                            print_result(True, f"newEncounterTypeName is set: {new_encounter_type_name}")
                        else:
                            print_result(False, "newEncounterTypeName is null")
                        
                        # Verify the encounter's encounterTypeName was updated
                        try:
                            from pymongo import MongoClient
                            client = MongoClient("mongodb://localhost:27017")
                            db = client["proactive_clinic"]
                            encounter = db.Encounter.find_one({"_id": encounter_id})
                            if encounter:
                                if encounter.get("encounterTypeName") == new_type_name:
                                    print_result(True, f"Encounter type updated in DB: {encounter.get('encounterTypeName')}")
                                else:
                                    print_result(False, f"Encounter type in DB: {encounter.get('encounterTypeName')}, expected {new_type_name}")
                            client.close()
                        except Exception as e:
                            print(f"Warning: Could not verify DB update: {e}")
                    else:
                        print_result(False, f"Unexpected response: {data}")
                else:
                    print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
            else:
                print_result(False, "No encounter types found")
        else:
            print_result(False, f"Failed to get encounter types: {et_response.status_code}")
    except Exception as e:
        print_result(False, f"Error: {e}")
    
    # TEST 12: POST with no note and no type -> 400
    print_test("B12", "POST {} (no note, no type) -> 400")
    try:
        response = session.post(
            f"{BASE_URL}/api/encounters/{encounter_id}/addenda",
            json={},
            timeout=10
        )
        if response.status_code == 400:
            print_result(True, f"Correctly rejected with 400: {response.json().get('error')}")
        else:
            print_result(False, f"Expected 400, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Error: {e}")
    
    # TEST 13: GET addenda list
    print_test("B13", "GET /api/encounters/{id}/addenda -> 200 with array")
    try:
        response = session.get(f"{BASE_URL}/api/encounters/{encounter_id}/addenda", timeout=10)
        if response.status_code == 200:
            data = response.json()
            addenda = data.get("addenda", [])
            print_result(True, f"Retrieved {len(addenda)} addenda")
            if len(addenda) >= 2:
                # Verify most recent first (descending order)
                first_created = addenda[0].get("createdAt")
                last_created = addenda[-1].get("createdAt")
                if first_created >= last_created:
                    print_result(True, "Addenda are ordered most recent first")
                else:
                    print_result(False, f"Addenda order incorrect: first={first_created}, last={last_created}")
                
                # Show sample addenda
                for i, addendum in enumerate(addenda[:3]):
                    print(f"  [{i}] id={addendum.get('id')}, note={addendum.get('note')}, type_change={addendum.get('newEncounterTypeName')}")
            else:
                print(f"  Found {len(addenda)} addenda (expected at least 2 from tests)")
        else:
            print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
    except Exception as e:
        print_result(False, f"Error: {e}")

def cleanup(session: requests.Session):
    """Clean up created test data"""
    print_test("CLEANUP", "Delete created templates and addenda")
    
    # Delete remaining templates
    for template_id in created_template_ids[1:]:  # Skip first one (already deleted in test)
        try:
            response = session.delete(f"{BASE_URL}/api/templates/{template_id}", timeout=10)
            if response.status_code == 200:
                print_result(True, f"Deleted template: {template_id}")
            else:
                print(f"Warning: Failed to delete template {template_id}: {response.status_code}")
        except Exception as e:
            print(f"Warning: Error deleting template {template_id}: {e}")
    
    # Delete addenda via MongoDB (no DELETE endpoint)
    if created_addendum_ids:
        try:
            from pymongo import MongoClient
            client = MongoClient("mongodb://localhost:27017")
            db = client["proactive_clinic"]
            
            for addendum_id in created_addendum_ids:
                result = db.Addendum.delete_one({"_id": addendum_id})
                if result.deleted_count > 0:
                    print_result(True, f"Deleted addendum: {addendum_id}")
                else:
                    print(f"Warning: Addendum {addendum_id} not found in DB")
            
            client.close()
        except Exception as e:
            print(f"Warning: Error deleting addenda: {e}")

def main():
    print("\n" + "="*80)
    print("BACKEND TEST: Templates API and Note Addenda API")
    print("="*80)
    
    # Login
    session = staff_login()
    if not session:
        print("\n❌ FATAL: Could not login as staff")
        sys.exit(1)
    
    # Test Templates API
    print("\n" + "="*80)
    print("PART A: TEMPLATES API")
    print("="*80)
    test_templates_api(session)
    
    # Find or create signed encounter
    encounter_id = find_or_create_signed_encounter(session)
    if not encounter_id:
        print("\n❌ FATAL: Could not find or create signed encounter")
        sys.exit(1)
    
    # Test Addenda API
    print("\n" + "="*80)
    print("PART B: NOTE ADDENDA API")
    print("="*80)
    test_addenda_api(session, encounter_id)
    
    # Cleanup
    cleanup(session)
    
    print("\n" + "="*80)
    print("TEST SUITE COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
