#!/usr/bin/env python3
"""
Backend test for PIP (Personal Injury Protection) auto-insurer billing on legal/attorney patient registration.
Tests POST /api/patients with optional PIP fields that persist onto the created LegalCase.
"""

import requests
import sys
import json

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
LOGIN_EMAIL = "admin@proactiveclinic.com"
LOGIN_PASSWORD = "apex123"

def print_test(msg):
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_result(success, msg):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {msg}")

def login():
    """Login and return session cookie"""
    print_test("Admin Login")
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
        timeout=30
    )
    if resp.status_code != 200:
        print_result(False, f"Login failed with status {resp.status_code}")
        sys.exit(1)
    
    session_cookie = resp.cookies.get("proactive_session")
    if not session_cookie:
        print_result(False, "No session cookie returned")
        sys.exit(1)
    
    print_result(True, f"Login successful, session cookie obtained")
    return session_cookie

def test_no_auth():
    """Test 1: POST /api/patients WITHOUT session cookie -> expect 401"""
    print_test("Scenario 1: POST /api/patients WITHOUT session cookie (expect 401)")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/patients",
            json={"firstName": "Test", "lastName": "User", "dob": "1990-01-01", "sex": "M"},
            timeout=30
        )
        
        if resp.status_code == 401:
            print_result(True, f"Correctly returned 401 Unauthorized without session cookie")
            return True
        else:
            print_result(False, f"Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_legal_with_full_pip(session_cookie):
    """Test 2: POST /api/patients with full PIP data -> expect 200 with all PIP fields on legalCase"""
    print_test("Scenario 2: POST /api/patients legal patient WITH full PIP data (expect 200)")
    
    payload = {
        "firstName": "PipTest",
        "lastName": "Case",
        "dob": "1990-01-01",
        "sex": "F",
        "patientType": "legal",
        "caseType": "auto_accident",
        "pipInsurerName": "Progressive",
        "pipInsurerPayerId": "PROG01",
        "pipPolicyNumber": "PN123",
        "pipClaimNumber": "CN456",
        "pipMedLimit": "$10,000",
        "pipInsuredName": "Self",
        "pipRelation": "self"
    }
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/patients",
            json=payload,
            cookies={"proactive_session": session_cookie},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_result(False, f"Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return None
        
        data = resp.json()
        
        # Verify response structure
        if not data.get("ok"):
            print_result(False, f"Response ok is not true: {data}")
            return None
        
        if not data.get("patient") or not data.get("patient", {}).get("id"):
            print_result(False, f"No patient.id in response: {data}")
            return None
        
        if not data.get("legalCase") or not data.get("legalCase", {}).get("id"):
            print_result(False, f"No legalCase.id in response: {data}")
            return None
        
        legal_case = data["legalCase"]
        patient_id = data["patient"]["id"]
        
        # Verify all PIP fields persisted
        pip_checks = [
            ("pipInsurerName", "Progressive"),
            ("pipInsurerPayerId", "PROG01"),
            ("pipPolicyNumber", "PN123"),
            ("pipClaimNumber", "CN456"),
            ("pipMedLimit", "$10,000"),
            ("pipInsuredName", "Self"),
            ("pipRelation", "self")
        ]
        
        all_passed = True
        for field, expected in pip_checks:
            actual = legal_case.get(field)
            if actual != expected:
                print_result(False, f"legalCase.{field} = {actual}, expected {expected}")
                all_passed = False
            else:
                print(f"  ✓ legalCase.{field} = {actual}")
        
        if all_passed:
            print_result(True, f"All PIP fields persisted correctly on legalCase")
            print(f"  Patient ID: {patient_id}")
            print(f"  LegalCase ID: {legal_case['id']}")
            return patient_id
        else:
            return None
            
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return None

def test_legal_without_pip(session_cookie):
    """Test 3: POST /api/patients legal patient WITHOUT any PIP fields -> expect 200 with PIP fields null"""
    print_test("Scenario 3: POST /api/patients legal patient WITHOUT PIP fields (expect 200, PIP fields null)")
    
    payload = {
        "firstName": "PipEmpty",
        "lastName": "Case",
        "dob": "1990-01-01",
        "sex": "M",
        "patientType": "legal",
        "caseType": "personal_injury"
    }
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/patients",
            json=payload,
            cookies={"proactive_session": session_cookie},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_result(False, f"Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return None
        
        data = resp.json()
        
        if not data.get("ok") or not data.get("legalCase"):
            print_result(False, f"Missing ok or legalCase in response: {data}")
            return None
        
        legal_case = data["legalCase"]
        patient_id = data["patient"]["id"]
        
        # Verify all PIP fields are null
        pip_fields = [
            "pipInsurerName", "pipInsurerPayerId", "pipPolicyNumber", 
            "pipClaimNumber", "pipMedLimit", "pipInsuredName", "pipRelation"
        ]
        
        all_null = True
        for field in pip_fields:
            actual = legal_case.get(field)
            if actual is not None:
                print_result(False, f"legalCase.{field} = {actual}, expected null")
                all_null = False
            else:
                print(f"  ✓ legalCase.{field} = null")
        
        if all_null:
            print_result(True, f"All PIP fields are null (no crash)")
            print(f"  Patient ID: {patient_id}")
            return patient_id
        else:
            return None
            
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return None

def test_clinical_patient(session_cookie):
    """Test 4: POST /api/patients clinical patient -> expect 200 with legalCase:null"""
    print_test("Scenario 4: POST /api/patients clinical patient (expect 200, legalCase:null)")
    
    payload = {
        "firstName": "ClinTest",
        "lastName": "Case",
        "dob": "1990-01-01",
        "sex": "M",
        "patientType": "clinical"
    }
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/patients",
            json=payload,
            cookies={"proactive_session": session_cookie},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_result(False, f"Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return None
        
        data = resp.json()
        
        if not data.get("ok"):
            print_result(False, f"Response ok is not true: {data}")
            return None
        
        if data.get("legalCase") is not None:
            print_result(False, f"legalCase should be null for clinical patient, got: {data.get('legalCase')}")
            return None
        
        patient_id = data["patient"]["id"]
        print_result(True, f"Clinical patient created with legalCase:null")
        print(f"  Patient ID: {patient_id}")
        return patient_id
            
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return None

def test_manual_insurer(session_cookie):
    """Test 5: POST /api/patients legal with manual insurer (pipInsurerName but NO pipInsurerPayerId)"""
    print_test("Scenario 5: POST /api/patients legal with manual insurer (pipInsurerName, NO pipInsurerPayerId)")
    
    payload = {
        "firstName": "ManualInsurer",
        "lastName": "Case",
        "dob": "1990-01-01",
        "sex": "F",
        "patientType": "legal",
        "caseType": "auto_accident",
        "pipInsurerName": "Some Local Auto Insurer"
        # NO pipInsurerPayerId
    }
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/patients",
            json=payload,
            cookies={"proactive_session": session_cookie},
            timeout=30
        )
        
        if resp.status_code != 200:
            print_result(False, f"Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return None
        
        data = resp.json()
        
        if not data.get("ok") or not data.get("legalCase"):
            print_result(False, f"Missing ok or legalCase in response: {data}")
            return None
        
        legal_case = data["legalCase"]
        patient_id = data["patient"]["id"]
        
        # Verify pipInsurerName persists and pipInsurerPayerId is null
        if legal_case.get("pipInsurerName") != "Some Local Auto Insurer":
            print_result(False, f"pipInsurerName = {legal_case.get('pipInsurerName')}, expected 'Some Local Auto Insurer'")
            return None
        
        if legal_case.get("pipInsurerPayerId") is not None:
            print_result(False, f"pipInsurerPayerId = {legal_case.get('pipInsurerPayerId')}, expected null")
            return None
        
        print_result(True, f"Manual insurer persisted correctly")
        print(f"  legalCase.pipInsurerName = {legal_case.get('pipInsurerName')}")
        print(f"  legalCase.pipInsurerPayerId = null")
        print(f"  Patient ID: {patient_id}")
        return patient_id
            
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return None

def cleanup_patient(patient_id, session_cookie):
    """Delete a patient via DELETE /api/patients/{id}"""
    if not patient_id:
        return
    
    print(f"\nCleaning up patient {patient_id}...")
    try:
        resp = requests.delete(
            f"{BASE_URL}/api/patients/{patient_id}",
            cookies={"proactive_session": session_cookie},
            timeout=30
        )
        if resp.status_code == 200:
            print(f"  ✓ Patient {patient_id} deleted successfully")
        else:
            print(f"  ⚠ Could not delete patient {patient_id}: {resp.status_code}")
    except Exception as e:
        print(f"  ⚠ Exception during cleanup: {e}")

def main():
    print("\n" + "="*80)
    print("PIP (Personal Injury Protection) Billing Backend Test")
    print("Testing POST /api/patients with optional PIP fields")
    print("="*80)
    
    # Login
    session_cookie = login()
    
    # Track created patients for cleanup
    created_patients = []
    
    # Run tests
    test_results = []
    
    # Test 1: No auth
    result1 = test_no_auth()
    test_results.append(("No auth (401)", result1))
    
    # Test 2: Legal with full PIP
    patient2 = test_legal_with_full_pip(session_cookie)
    test_results.append(("Legal with full PIP", patient2 is not None))
    if patient2:
        created_patients.append(patient2)
    
    # Test 3: Legal without PIP
    patient3 = test_legal_without_pip(session_cookie)
    test_results.append(("Legal without PIP", patient3 is not None))
    if patient3:
        created_patients.append(patient3)
    
    # Test 4: Clinical patient
    patient4 = test_clinical_patient(session_cookie)
    test_results.append(("Clinical patient", patient4 is not None))
    if patient4:
        created_patients.append(patient4)
    
    # Test 5: Manual insurer
    patient5 = test_manual_insurer(session_cookie)
    test_results.append(("Manual insurer", patient5 is not None))
    if patient5:
        created_patients.append(patient5)
    
    # Cleanup
    print("\n" + "="*80)
    print("CLEANUP")
    print("="*80)
    for patient_id in created_patients:
        cleanup_patient(patient_id, session_cookie)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - NO HTTP 500 ERRORS")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
