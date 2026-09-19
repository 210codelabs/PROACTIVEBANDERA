#!/usr/bin/env python3
"""
Backend test for TWO tasks:
1. Emergency Contact Information on patient registration + chart (POST/PATCH /api/patients)
2. PIP billing auto-route claim to auto-insurer as primary payer (POST /api/stedi/claims)

Base URL: from NEXT_PUBLIC_BASE_URL in /app/.env
Session login: admin@proactiveclinic.com / apex123
NO HTTP 500s allowed; do NOT print secrets.
"""

import requests
import json
import sys
from datetime import datetime

# Read base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def mask_sensitive(data):
    """Mask sensitive data in output"""
    if isinstance(data, dict):
        masked = {}
        for k, v in data.items():
            if k in ['password', 'secret', 'token', 'key']:
                masked[k] = '***MASKED***'
            elif isinstance(v, (dict, list)):
                masked[k] = mask_sensitive(v)
            else:
                masked[k] = v
        return masked
    elif isinstance(data, list):
        return [mask_sensitive(item) for item in data]
    return data

def login():
    """Login as admin and return session"""
    print("\n=== ADMIN LOGIN ===")
    session = requests.Session()
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@proactiveclinic.com",
        "password": "apex123"
    })
    print(f"Login status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        sys.exit(1)
    data = resp.json()
    print(f"Login successful: ok={data.get('ok')}")
    return session

def test_task1_emergency_contact(session):
    """
    TASK 1: Emergency Contact Information on patient registration + chart
    """
    print("\n" + "="*80)
    print("TASK 1: Emergency Contact Information (POST/PATCH /api/patients)")
    print("="*80)
    
    created_patient_ids = []
    
    try:
        # TEST 1.1: POST /api/patients WITHOUT session -> expect 401
        print("\n--- TEST 1.1: POST /api/patients WITHOUT session (expect 401) ---")
        no_session = requests.Session()
        resp = no_session.post(f"{BASE_URL}/api/patients", json={
            "firstName": "Test",
            "lastName": "NoAuth",
            "dob": "1990-01-01",
            "sex": "F"
        })
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ TEST 1.1 PASSED: Correctly returns 401 without session")
        else:
            print(f"❌ TEST 1.1 FAILED: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text}")
        
        # TEST 1.2: POST /api/patients WITH full EC fields
        print("\n--- TEST 1.2: POST /api/patients WITH full EC fields ---")
        resp = session.post(f"{BASE_URL}/api/patients", json={
            "firstName": "EcTest",
            "lastName": "Case",
            "dob": "1990-01-01",
            "sex": "F",
            "ecName": "Maria Adams",
            "ecRelation": "Spouse",
            "ecPhone": "2105551234",
            "ecPhoneAlt": "2105559999",
            "ecEmail": "maria@example.com"
        })
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 500:
            print("❌ CRITICAL FAILURE: HTTP 500 ERROR (NOT ALLOWED)")
            print(f"Response: {resp.text}")
            return created_patient_ids
        
        if resp.status_code != 200:
            print(f"❌ TEST 1.2 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return created_patient_ids
        
        data = resp.json()
        print(f"Response: ok={data.get('ok')}, patient.id={data.get('patient', {}).get('id')}")
        
        if not data.get('ok') or not data.get('patient', {}).get('id'):
            print("❌ TEST 1.2 FAILED: Missing ok:true or patient.id")
            return created_patient_ids
        
        patient_id = data['patient']['id']
        created_patient_ids.append(patient_id)
        print(f"✅ Patient created with ID: {patient_id}")
        
        # Verify EC fields in response
        patient = data['patient']
        ec_fields = {
            'ecName': 'Maria Adams',
            'ecRelation': 'Spouse',
            'ecPhone': '2105551234',
            'ecPhoneAlt': '2105559999',
            'ecEmail': 'maria@example.com'
        }
        
        all_match = True
        for field, expected in ec_fields.items():
            actual = patient.get(field)
            if actual == expected:
                print(f"  ✅ {field} = '{actual}' (matches expected)")
            else:
                print(f"  ❌ {field} = '{actual}' (expected '{expected}')")
                all_match = False
        
        if all_match:
            print("✅ TEST 1.2 PASSED: All EC fields persisted correctly in POST response")
        else:
            print("❌ TEST 1.2 FAILED: Some EC fields do not match")
        
        # GET /api/patients/{id} to confirm persistence
        print(f"\n--- TEST 1.2b: GET /api/patients/{patient_id} to confirm EC persistence ---")
        resp = session.get(f"{BASE_URL}/api/patients/{patient_id}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ GET failed: {resp.status_code}")
            print(f"Response: {resp.text}")
        else:
            data = resp.json()
            patient = data.get('patient', {})
            all_match = True
            for field, expected in ec_fields.items():
                actual = patient.get(field)
                if actual == expected:
                    print(f"  ✅ {field} = '{actual}' (persisted)")
                else:
                    print(f"  ❌ {field} = '{actual}' (expected '{expected}')")
                    all_match = False
            
            if all_match:
                print("✅ TEST 1.2b PASSED: All EC fields confirmed persisted via GET")
            else:
                print("❌ TEST 1.2b FAILED: Some EC fields not persisted correctly")
        
        # TEST 1.3: PATCH /api/patients/{id} to update EC fields
        print(f"\n--- TEST 1.3: PATCH /api/patients/{patient_id} to update ecPhoneAlt and ecEmail ---")
        resp = session.patch(f"{BASE_URL}/api/patients/{patient_id}", json={
            "ecPhoneAlt": "2105550000",
            "ecEmail": "new@example.com"
        })
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 500:
            print("❌ CRITICAL FAILURE: HTTP 500 ERROR (NOT ALLOWED)")
            print(f"Response: {resp.text}")
        elif resp.status_code != 200:
            print(f"❌ TEST 1.3 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
        else:
            data = resp.json()
            print(f"Response: ok={data.get('ok')}")
            
            # GET to confirm updates
            print(f"\n--- TEST 1.3b: GET /api/patients/{patient_id} to confirm updates ---")
            resp = session.get(f"{BASE_URL}/api/patients/{patient_id}")
            if resp.status_code == 200:
                data = resp.json()
                patient = data.get('patient', {})
                ecPhoneAlt = patient.get('ecPhoneAlt')
                ecEmail = patient.get('ecEmail')
                
                if ecPhoneAlt == "2105550000" and ecEmail == "new@example.com":
                    print(f"  ✅ ecPhoneAlt = '{ecPhoneAlt}' (updated)")
                    print(f"  ✅ ecEmail = '{ecEmail}' (updated)")
                    print("✅ TEST 1.3 PASSED: EC fields updated successfully via PATCH")
                else:
                    print(f"  ❌ ecPhoneAlt = '{ecPhoneAlt}' (expected '2105550000')")
                    print(f"  ❌ ecEmail = '{ecEmail}' (expected 'new@example.com')")
                    print("❌ TEST 1.3 FAILED: EC fields not updated correctly")
            else:
                print(f"❌ GET failed: {resp.status_code}")
        
        # TEST 1.4: POST /api/patients WITHOUT EC fields (should not crash)
        print("\n--- TEST 1.4: POST /api/patients WITHOUT EC fields (no crash) ---")
        resp = session.post(f"{BASE_URL}/api/patients", json={
            "firstName": "EcNone",
            "lastName": "Case",
            "dob": "1990-01-01",
            "sex": "M"
        })
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 500:
            print("❌ CRITICAL FAILURE: HTTP 500 ERROR (NOT ALLOWED)")
            print(f"Response: {resp.text}")
        elif resp.status_code != 200:
            print(f"❌ TEST 1.4 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
        else:
            data = resp.json()
            if data.get('ok') and data.get('patient', {}).get('id'):
                patient_id2 = data['patient']['id']
                created_patient_ids.append(patient_id2)
                print(f"✅ Patient created with ID: {patient_id2}")
                
                # Check EC fields are null/empty
                patient = data['patient']
                ec_null = all(patient.get(f) in [None, ''] for f in ['ecName', 'ecRelation', 'ecPhone', 'ecPhoneAlt', 'ecEmail'])
                if ec_null:
                    print("  ✅ All EC fields are null/empty (no crash)")
                    print("✅ TEST 1.4 PASSED: Patient created without EC fields, no crash")
                else:
                    print("  ⚠️  Some EC fields have values (unexpected but not critical)")
                    print("✅ TEST 1.4 PASSED: Patient created without crash")
            else:
                print("❌ TEST 1.4 FAILED: Patient not created")
    
    except Exception as e:
        print(f"❌ EXCEPTION in TASK 1: {e}")
        import traceback
        traceback.print_exc()
    
    return created_patient_ids

def test_task2_pip_billing(session):
    """
    TASK 2: PIP billing auto-route claim to auto-insurer as primary payer
    """
    print("\n" + "="*80)
    print("TASK 2: PIP billing auto-route claim (POST /api/stedi/claims)")
    print("="*80)
    
    created_patient_ids = []
    
    try:
        # SETUP: Create a legal patient with PIP insurer
        print("\n--- SETUP: Create legal patient with PIP insurer ---")
        resp = session.post(f"{BASE_URL}/api/patients", json={
            "firstName": "PipClaim",
            "lastName": "Case",
            "dob": "1990-01-01",
            "sex": "F",
            "patientType": "legal",
            "caseType": "auto_accident",
            "pipInsurerName": "Progressive",
            "pipInsurerPayerId": "PROG01"
        })
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 500:
            print("❌ CRITICAL FAILURE: HTTP 500 ERROR (NOT ALLOWED)")
            print(f"Response: {resp.text}")
            return created_patient_ids
        
        if resp.status_code != 200:
            print(f"❌ SETUP FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return created_patient_ids
        
        data = resp.json()
        if not data.get('ok') or not data.get('patient', {}).get('id'):
            print("❌ SETUP FAILED: Missing ok:true or patient.id")
            return created_patient_ids
        
        pip_patient_id = data['patient']['id']
        created_patient_ids.append(pip_patient_id)
        print(f"✅ PIP patient created with ID: {pip_patient_id}")
        
        # SETUP: Create a clinical patient
        print("\n--- SETUP: Create clinical patient ---")
        resp = session.post(f"{BASE_URL}/api/patients", json={
            "firstName": "ClinClaim",
            "lastName": "Case",
            "dob": "1990-01-01",
            "sex": "M",
            "patientType": "clinical"
        })
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ SETUP FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return created_patient_ids
        
        data = resp.json()
        clinical_patient_id = data['patient']['id']
        created_patient_ids.append(clinical_patient_id)
        print(f"✅ Clinical patient created with ID: {clinical_patient_id}")
        
        # TEST 2.1: POST /api/stedi/claims for PIP patient WITHOUT payerId (auto-route)
        print(f"\n--- TEST 2.1: POST /api/stedi/claims for PIP patient (NO payerId, expect auto-route) ---")
        resp = session.post(f"{BASE_URL}/api/stedi/claims", json={
            "patientId": pip_patient_id,
            "serviceLines": [{
                "serviceDate": "2026-01-01",
                "procedureCode": "97110",
                "chargeCents": 5000,
                "units": 1,
                "diagnosisCodePointers": ["1"]
            }]
        })
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 500:
            print("❌ CRITICAL FAILURE: HTTP 500 ERROR (NOT ALLOWED)")
            print(f"Response: {resp.text}")
        elif resp.status_code != 200:
            print(f"❌ TEST 2.1 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
        else:
            data = resp.json()
            print(f"Response: ok={data.get('ok')}, pipRouted={data.get('pipRouted')}")
            
            if data.get('ok') and data.get('pipRouted') == True:
                claim = data.get('claim', {})
                payerName = claim.get('payerName')
                payerId = claim.get('payerId')
                
                if payerName == "Progressive" and payerId == "PROG01":
                    print(f"  ✅ pipRouted = True")
                    print(f"  ✅ claim.payerName = '{payerName}'")
                    print(f"  ✅ claim.payerId = '{payerId}'")
                    print("✅ TEST 2.1 PASSED: PIP auto-routing working correctly")
                else:
                    print(f"  ❌ claim.payerName = '{payerName}' (expected 'Progressive')")
                    print(f"  ❌ claim.payerId = '{payerId}' (expected 'PROG01')")
                    print("❌ TEST 2.1 FAILED: PIP auto-routing not working correctly")
            else:
                print(f"  ❌ ok={data.get('ok')}, pipRouted={data.get('pipRouted')}")
                print("❌ TEST 2.1 FAILED: Expected ok:true and pipRouted:true")
        
        # TEST 2.2: POST /api/stedi/claims for PIP patient WITH explicit payerId (explicit wins)
        print(f"\n--- TEST 2.2: POST /api/stedi/claims for PIP patient WITH explicit payerId (explicit wins) ---")
        resp = session.post(f"{BASE_URL}/api/stedi/claims", json={
            "patientId": pip_patient_id,
            "payerId": "87726",
            "serviceLines": [{
                "serviceDate": "2026-01-01",
                "procedureCode": "97110",
                "chargeCents": 5000,
                "units": 1,
                "diagnosisCodePointers": ["1"]
            }]
        })
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 500:
            print("❌ CRITICAL FAILURE: HTTP 500 ERROR (NOT ALLOWED)")
            print(f"Response: {resp.text}")
        elif resp.status_code != 200:
            print(f"❌ TEST 2.2 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
        else:
            data = resp.json()
            print(f"Response: ok={data.get('ok')}, pipRouted={data.get('pipRouted')}")
            
            if data.get('ok') and data.get('pipRouted') == False:
                claim = data.get('claim', {})
                payerId = claim.get('payerId')
                
                if payerId == "87726":
                    print(f"  ✅ pipRouted = False (explicit payer wins)")
                    print(f"  ✅ claim.payerId = '{payerId}'")
                    print("✅ TEST 2.2 PASSED: Explicit payerId overrides PIP auto-routing")
                else:
                    print(f"  ❌ claim.payerId = '{payerId}' (expected '87726')")
                    print("❌ TEST 2.2 FAILED: Explicit payerId not working")
            else:
                print(f"  ❌ ok={data.get('ok')}, pipRouted={data.get('pipRouted')}")
                print("❌ TEST 2.2 FAILED: Expected ok:true and pipRouted:false")
        
        # TEST 2.3: POST /api/stedi/claims for clinical patient (no PIP routing)
        print(f"\n--- TEST 2.3: POST /api/stedi/claims for clinical patient (no PIP routing) ---")
        resp = session.post(f"{BASE_URL}/api/stedi/claims", json={
            "patientId": clinical_patient_id,
            "serviceLines": [{
                "serviceDate": "2026-01-01",
                "procedureCode": "97110",
                "chargeCents": 5000,
                "units": 1,
                "diagnosisCodePointers": ["1"]
            }]
        })
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 500:
            print("❌ CRITICAL FAILURE: HTTP 500 ERROR (NOT ALLOWED)")
            print(f"Response: {resp.text}")
        elif resp.status_code != 200:
            print(f"❌ TEST 2.3 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
        else:
            data = resp.json()
            print(f"Response: ok={data.get('ok')}, pipRouted={data.get('pipRouted')}")
            
            if data.get('ok') and data.get('pipRouted') == False:
                print(f"  ✅ pipRouted = False (clinical patient, no PIP)")
                print("✅ TEST 2.3 PASSED: No PIP routing for clinical patient")
            else:
                print(f"  ❌ ok={data.get('ok')}, pipRouted={data.get('pipRouted')}")
                print("❌ TEST 2.3 FAILED: Expected ok:true and pipRouted:false")
        
        # TEST 2.4: POST /api/stedi/claims WITHOUT session (expect 401)
        print("\n--- TEST 2.4: POST /api/stedi/claims WITHOUT session (expect 401) ---")
        no_session = requests.Session()
        resp = no_session.post(f"{BASE_URL}/api/stedi/claims", json={
            "patientId": pip_patient_id,
            "serviceLines": [{
                "serviceDate": "2026-01-01",
                "procedureCode": "97110",
                "chargeCents": 5000,
                "units": 1,
                "diagnosisCodePointers": ["1"]
            }]
        })
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print("✅ TEST 2.4 PASSED: Correctly returns 401 without session")
        else:
            print(f"❌ TEST 2.4 FAILED: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text}")
    
    except Exception as e:
        print(f"❌ EXCEPTION in TASK 2: {e}")
        import traceback
        traceback.print_exc()
    
    return created_patient_ids

def cleanup_patients(session, patient_ids):
    """Delete created patients"""
    print("\n" + "="*80)
    print("CLEANUP: Deleting created patients")
    print("="*80)
    
    for patient_id in patient_ids:
        try:
            print(f"\nDeleting patient {patient_id}...")
            resp = session.delete(f"{BASE_URL}/api/patients/{patient_id}")
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                print(f"✅ Patient {patient_id} deleted successfully")
            else:
                print(f"⚠️  Failed to delete patient {patient_id}: {resp.status_code}")
                print(f"Response: {resp.text}")
        except Exception as e:
            print(f"⚠️  Exception deleting patient {patient_id}: {e}")

def main():
    print("="*80)
    print("BACKEND TEST: Emergency Contact + PIP Billing Auto-Route")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    # Login
    session = login()
    
    # Test Task 1: Emergency Contact
    task1_patients = test_task1_emergency_contact(session)
    
    # Test Task 2: PIP Billing
    task2_patients = test_task2_pip_billing(session)
    
    # Cleanup
    all_patients = task1_patients + task2_patients
    if all_patients:
        cleanup_patients(session, all_patients)
    
    print("\n" + "="*80)
    print("BACKEND TEST COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
