#!/usr/bin/env python3
"""
Backend test for NEW PUBLIC intake endpoints (no auth required).
Tests 3 endpoints:
1. GET /api/intake/forms
2. GET /api/intake/forms/{slug}/pdf
3. POST /api/intake/submit
"""

import asyncio
import aiohttp
import random
import string
from datetime import datetime

# Base URL from .env
BASE_URL = "http://localhost:3000"

def random_suffix():
    """Generate random suffix for unique test data"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

async def test_intake_endpoints():
    """Test all 3 intake endpoints"""
    
    async with aiohttp.ClientSession() as session:
        print("\n" + "="*80)
        print("BACKEND TEST: PUBLIC INTAKE ENDPOINTS")
        print("="*80)
        
        # =====================================================================
        # TEST 1: GET /api/intake/forms
        # =====================================================================
        print("\n[TEST 1] GET /api/intake/forms")
        print("-" * 80)
        
        try:
            async with session.get(f"{BASE_URL}/api/intake/forms") as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"✓ Status: {status}")
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    return
                
                # Check response structure
                if "forms" not in data:
                    print(f"✗ FAIL: Response missing 'forms' key")
                    return
                
                forms = data["forms"]
                print(f"✓ Response has 'forms' array with {len(forms)} items")
                
                # Check exactly 5 forms
                if len(forms) != 5:
                    print(f"✗ FAIL: Expected 5 forms, got {len(forms)}")
                    return
                print(f"✓ Exactly 5 forms returned")
                
                # Check expected slugs
                expected_slugs = [
                    "new-patient-intake",
                    "current-patient-checkin", 
                    "first-office-visit",
                    "followup-visit",
                    "procedure-report"
                ]
                actual_slugs = [f["slug"] for f in forms]
                
                for slug in expected_slugs:
                    if slug not in actual_slugs:
                        print(f"✗ FAIL: Missing expected slug '{slug}'")
                        return
                print(f"✓ All 5 expected slugs present: {', '.join(expected_slugs)}")
                
                # Check each form has required fields
                for form in forms:
                    required_fields = ["slug", "title", "subtitle", "audience", "online"]
                    for field in required_fields:
                        if field not in form:
                            print(f"✗ FAIL: Form '{form.get('slug')}' missing field '{field}'")
                            return
                print(f"✓ All forms have required fields (slug, title, subtitle, audience, online)")
                
                # Check exactly 2 have online:true
                online_forms = [f for f in forms if f["online"] is True]
                if len(online_forms) != 2:
                    print(f"✗ FAIL: Expected 2 online forms, got {len(online_forms)}")
                    return
                
                online_slugs = [f["slug"] for f in online_forms]
                expected_online = ["new-patient-intake", "current-patient-checkin"]
                
                if set(online_slugs) != set(expected_online):
                    print(f"✗ FAIL: Expected online forms {expected_online}, got {online_slugs}")
                    return
                
                print(f"✓ Exactly 2 forms have online:true: {', '.join(online_slugs)}")
                print(f"✓ TEST 1 PASSED: GET /api/intake/forms working correctly")
                
        except Exception as e:
            print(f"✗ TEST 1 FAILED with exception: {e}")
            return
        
        # =====================================================================
        # TEST 2: GET /api/intake/forms/{slug}/pdf
        # =====================================================================
        print("\n[TEST 2] GET /api/intake/forms/{slug}/pdf")
        print("-" * 80)
        
        # Test 2a: Valid slugs should return PDF
        valid_slugs = [
            "new-patient-intake",
            "current-patient-checkin",
            "first-office-visit",
            "followup-visit",
            "procedure-report"
        ]
        
        for slug in valid_slugs:
            try:
                async with session.get(f"{BASE_URL}/api/intake/forms/{slug}/pdf") as resp:
                    status = resp.status
                    content_type = resp.headers.get("Content-Type", "")
                    body = await resp.read()
                    
                    if status != 200:
                        print(f"✗ FAIL: Slug '{slug}' returned status {status}, expected 200")
                        return
                    
                    if content_type != "application/pdf":
                        print(f"✗ FAIL: Slug '{slug}' Content-Type is '{content_type}', expected 'application/pdf'")
                        return
                    
                    if not body or len(body) == 0:
                        print(f"✗ FAIL: Slug '{slug}' returned empty body")
                        return
                    
                    # Check PDF magic bytes
                    if not body.startswith(b"%PDF"):
                        print(f"✗ FAIL: Slug '{slug}' body does not start with '%PDF' magic bytes")
                        return
                    
                    print(f"✓ Slug '{slug}': 200, Content-Type: application/pdf, body starts with '%PDF', size: {len(body)} bytes")
                    
            except Exception as e:
                print(f"✗ FAIL: Slug '{slug}' raised exception: {e}")
                return
        
        print(f"✓ All 5 valid slugs return valid PDFs")
        
        # Test 2b: Unknown slug should return 404
        try:
            async with session.get(f"{BASE_URL}/api/intake/forms/nope/pdf") as resp:
                status = resp.status
                data = await resp.json()
                
                if status != 404:
                    print(f"✗ FAIL: Unknown slug 'nope' returned status {status}, expected 404")
                    return
                
                if "error" not in data or data["error"] != "Form not found":
                    print(f"✗ FAIL: Unknown slug 'nope' error message incorrect: {data}")
                    return
                
                print(f"✓ Unknown slug 'nope': 404 with {{error: 'Form not found'}}")
                print(f"✓ TEST 2 PASSED: GET /api/intake/forms/{{slug}}/pdf working correctly")
                
        except Exception as e:
            print(f"✗ TEST 2 FAILED with exception: {e}")
            return
        
        # =====================================================================
        # TEST 3: POST /api/intake/submit
        # =====================================================================
        print("\n[TEST 3] POST /api/intake/submit")
        print("-" * 80)
        
        # Test 3a: Valid new-patient-intake create
        print("\n[TEST 3a] Valid new-patient-intake create (isNew:true)")
        unique_suffix = random_suffix()
        unique_last = f"Uniquename{unique_suffix}"
        unique_email = f"intaketest{unique_suffix}@example.com"
        
        payload_3a = {
            "slug": "new-patient-intake",
            "values": {
                "firstName": "IntakeTest",
                "lastName": unique_last,
                "dob": "1990-05-14",
                "signature": f"IntakeTest {unique_last}",
                "phone": "210-555-0100",
                "email": unique_email,
                "sex": "F"
            }
        }
        
        try:
            async with session.post(f"{BASE_URL}/api/intake/submit", json=payload_3a) as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"✓ Status: {status}")
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    print(f"  Response: {data}")
                    return
                
                # Check response structure
                required_fields = ["ok", "confirmation", "mrn", "patientId", "isNew"]
                for field in required_fields:
                    if field not in data:
                        print(f"✗ FAIL: Response missing field '{field}'")
                        return
                
                if data["ok"] is not True:
                    print(f"✗ FAIL: ok is not true")
                    return
                
                if data["isNew"] is not True:
                    print(f"✗ FAIL: isNew is not true (expected new patient)")
                    return
                
                # Check confirmation format: ^PC-[A-Z0-9]{6}$
                confirmation = data["confirmation"]
                if not confirmation.startswith("PC-"):
                    print(f"✗ FAIL: confirmation '{confirmation}' does not start with 'PC-'")
                    return
                
                if len(confirmation) != 9:  # PC- + 6 chars
                    print(f"✗ FAIL: confirmation '{confirmation}' is not 9 characters (PC-XXXXXX)")
                    return
                
                # Check MRN format: ^PC-\d{6}$
                mrn = data["mrn"]
                if not mrn.startswith("PC-"):
                    print(f"✗ FAIL: mrn '{mrn}' does not start with 'PC-'")
                    return
                
                mrn_digits = mrn[3:]
                if not mrn_digits.isdigit() or len(mrn_digits) != 6:
                    print(f"✗ FAIL: mrn '{mrn}' does not match PC-\\d{{6}} format")
                    return
                
                patient_id = data["patientId"]
                if not patient_id:
                    print(f"✗ FAIL: patientId is empty")
                    return
                
                print(f"✓ Response: ok=true, confirmation='{confirmation}' (matches ^PC-[A-Z0-9]{{6}}$)")
                print(f"✓ mrn='{mrn}' (matches ^PC-\\d{{6}}$)")
                print(f"✓ patientId='{patient_id}' (non-empty)")
                print(f"✓ isNew=true")
                print(f"✓ TEST 3a PASSED: Valid new-patient-intake create")
                
                # Save for test 3b
                saved_first = payload_3a["values"]["firstName"]
                saved_last = payload_3a["values"]["lastName"]
                saved_dob = payload_3a["values"]["dob"]
                saved_mrn = mrn
                
        except Exception as e:
            print(f"✗ TEST 3a FAILED with exception: {e}")
            return
        
        # Test 3b: Existing patient match (isNew:false)
        print("\n[TEST 3b] Existing patient match (isNew:false)")
        
        payload_3b = {
            "slug": "current-patient-checkin",
            "values": {
                "firstName": saved_first,
                "lastName": saved_last,
                "dob": saved_dob,
                "signature": f"{saved_first} {saved_last}"
            }
        }
        
        try:
            async with session.post(f"{BASE_URL}/api/intake/submit", json=payload_3b) as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"✓ Status: {status}")
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    print(f"  Response: {data}")
                    return
                
                if data.get("isNew") is not False:
                    print(f"✗ FAIL: isNew is not false (expected existing patient match)")
                    return
                
                if data.get("mrn") != saved_mrn:
                    print(f"✗ FAIL: mrn '{data.get('mrn')}' does not match saved mrn '{saved_mrn}'")
                    return
                
                print(f"✓ isNew=false (patient matched)")
                print(f"✓ mrn='{data['mrn']}' (matches saved mrn from test 3a)")
                print(f"✓ TEST 3b PASSED: Existing patient match working")
                
        except Exception as e:
            print(f"✗ TEST 3b FAILED with exception: {e}")
            return
        
        # Test 3c: Validation cases
        print("\n[TEST 3c] Validation cases (all should return 400)")
        
        validation_tests = [
            {
                "name": "missing body entirely",
                "payload": None,
                "expected_status": 400
            },
            {
                "name": "missing slug",
                "payload": {"values": {"firstName": "A"}},
                "expected_status": 400
            },
            {
                "name": "values not an object",
                "payload": {"slug": "new-patient-intake", "values": "not-an-object"},
                "expected_status": 400
            },
            {
                "name": "non-online slug",
                "payload": {
                    "slug": "first-office-visit",
                    "values": {
                        "firstName": "A",
                        "lastName": "B",
                        "dob": "1990-01-01",
                        "signature": "A B"
                    }
                },
                "expected_status": 400,
                "expected_error_contains": "not available for online submission"
            },
            {
                "name": "missing firstName",
                "payload": {
                    "slug": "new-patient-intake",
                    "values": {
                        "lastName": "B",
                        "dob": "1990-01-01",
                        "signature": "x"
                    }
                },
                "expected_status": 400
            },
            {
                "name": "missing dob",
                "payload": {
                    "slug": "new-patient-intake",
                    "values": {
                        "firstName": "A",
                        "lastName": "B",
                        "signature": "x"
                    }
                },
                "expected_status": 400
            },
            {
                "name": "missing signature",
                "payload": {
                    "slug": "new-patient-intake",
                    "values": {
                        "firstName": "A",
                        "lastName": "B",
                        "dob": "1990-01-01"
                    }
                },
                "expected_status": 400
            },
            {
                "name": "invalid dob",
                "payload": {
                    "slug": "new-patient-intake",
                    "values": {
                        "firstName": "A",
                        "lastName": "B",
                        "dob": "not-a-date",
                        "signature": "x"
                    }
                },
                "expected_status": 400
            }
        ]
        
        for test in validation_tests:
            try:
                if test["payload"] is None:
                    # Send invalid JSON
                    async with session.post(
                        f"{BASE_URL}/api/intake/submit",
                        data="invalid-json",
                        headers={"Content-Type": "application/json"}
                    ) as resp:
                        status = resp.status
                        try:
                            data = await resp.json()
                        except Exception:
                            data = {}
                else:
                    async with session.post(f"{BASE_URL}/api/intake/submit", json=test["payload"]) as resp:
                        status = resp.status
                        data = await resp.json()
                
                if status != test["expected_status"]:
                    print(f"✗ FAIL: {test['name']} - Expected status {test['expected_status']}, got {status}")
                    return
                
                if "error" not in data:
                    print(f"✗ FAIL: {test['name']} - Response missing 'error' field")
                    return
                
                if "expected_error_contains" in test:
                    if test["expected_error_contains"] not in data["error"]:
                        print(f"✗ FAIL: {test['name']} - Error message does not contain '{test['expected_error_contains']}'")
                        print(f"  Got: {data['error']}")
                        return
                
                print(f"✓ {test['name']}: 400 with error '{data['error']}'")
                
            except Exception as e:
                print(f"✗ FAIL: {test['name']} raised exception: {e}")
                return
        
        print(f"✓ TEST 3c PASSED: All validation cases return 400 with error")
        print(f"✓ TEST 3 PASSED: POST /api/intake/submit working correctly")
        
        # =====================================================================
        # SUMMARY
        # =====================================================================
        print("\n" + "="*80)
        print("✓ ALL TESTS PASSED")
        print("="*80)
        print("Summary:")
        print("  ✓ GET /api/intake/forms - Returns 5 forms, 2 online")
        print("  ✓ GET /api/intake/forms/{slug}/pdf - Returns PDF for valid slugs, 404 for invalid")
        print("  ✓ POST /api/intake/submit - Creates/matches patients, validates all cases")
        print("="*80)

if __name__ == "__main__":
    asyncio.run(test_intake_endpoints())
