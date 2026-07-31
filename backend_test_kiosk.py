#!/usr/bin/env python3
"""
Backend test for Kiosk Intake endpoint (POST /api/kiosk/intake)
Tests: valid intake, validation errors, idempotent patient reuse
"""
import requests
import json
import random
import string
import re
from datetime import datetime

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def generate_random_suffix():
    """Generate random suffix for unique emails"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

def test_valid_intake():
    """Test A: Valid intake with unique email"""
    print("\n" + "="*80)
    print("TEST A: Valid kiosk intake with unique email")
    print("="*80)
    
    random_suffix = generate_random_suffix()
    unique_email = f"qa.kiosk.{random_suffix}@example.com"
    
    payload = {
        "firstName": "QA",
        "lastName": f"Kiosk{random_suffix[:4]}",
        "dob": "1985-03-12",
        "sex": "M",
        "phone": "210-555-0199",
        "email": unique_email,
        "module": "ProactiveMed",
        "reason": "Knee pain",
        "hipaaConsent": True,
        "signature": "QA Kiosk"
    }
    
    try:
        print(f"POST {BASE_URL}/api/kiosk/intake")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(f"{BASE_URL}/api/kiosk/intake", json=payload, timeout=30)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            assert data.get("ok") == True, "Expected ok:true"
            assert "confirmation" in data, "Expected confirmation field"
            assert "patientId" in data, "Expected patientId field"
            assert "mrn" in data, "Expected mrn field"
            
            # Verify confirmation format: PC-[A-Z0-9]{6}
            confirmation = data["confirmation"]
            confirmation_pattern = r'^PC-[A-Z0-9]{6}$'
            assert re.match(confirmation_pattern, confirmation), f"Confirmation '{confirmation}' doesn't match pattern {confirmation_pattern}"
            
            # Verify MRN format: PC-\d{6}
            mrn = data["mrn"]
            mrn_pattern = r'^PC-\d{6}$'
            assert re.match(mrn_pattern, mrn), f"MRN '{mrn}' doesn't match pattern {mrn_pattern}"
            
            print(f"\n✅ TEST A PASSED:")
            print(f"   - Status: 200")
            print(f"   - ok: true")
            print(f"   - confirmation: {confirmation} (matches pattern {confirmation_pattern})")
            print(f"   - patientId: {data['patientId']}")
            print(f"   - mrn: {mrn} (matches pattern {mrn_pattern})")
            
            return {
                "email": unique_email,
                "patientId": data["patientId"],
                "mrn": mrn,
                "confirmation": confirmation,
                "payload": payload
            }
        else:
            print(f"\n❌ TEST A FAILED: Expected 200, got {response.status_code}")
            return None
            
    except Exception as e:
        print(f"\n❌ TEST A FAILED with exception: {str(e)}")
        return None

def test_document_persistence(patient_data):
    """Test B: Verify document persistence (if endpoint exists)"""
    print("\n" + "="*80)
    print("TEST B: Verify document persistence")
    print("="*80)
    
    print("Note: No GET /api/patients/[id]/documents endpoint found in codebase.")
    print("Skipping document verification as per test instructions.")
    print("The 200 response from Test A is sufficient evidence of document creation.")
    print("\n✅ TEST B SKIPPED (no documents GET endpoint available)")

def test_validation_missing_name_dob():
    """Test C1: Missing name/dob validation"""
    print("\n" + "="*80)
    print("TEST C1: Validation - Missing name/dob")
    print("="*80)
    
    payload = {
        "firstName": "",
        "lastName": "",
        "dob": ""
    }
    
    try:
        print(f"POST {BASE_URL}/api/kiosk/intake")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(f"{BASE_URL}/api/kiosk/intake", json=payload, timeout=30)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 400:
            data = response.json()
            assert "error" in data, "Expected error field in response"
            print(f"\n✅ TEST C1 PASSED:")
            print(f"   - Status: 400 (as expected)")
            print(f"   - Error message: {data['error']}")
        else:
            print(f"\n❌ TEST C1 FAILED: Expected 400, got {response.status_code}")
            
    except Exception as e:
        print(f"\n❌ TEST C1 FAILED with exception: {str(e)}")

def test_validation_hipaa_false():
    """Test C2: hipaaConsent false validation"""
    print("\n" + "="*80)
    print("TEST C2: Validation - hipaaConsent false")
    print("="*80)
    
    random_suffix = generate_random_suffix()
    payload = {
        "firstName": "QA",
        "lastName": f"Test{random_suffix[:4]}",
        "dob": "1990-01-01",
        "sex": "F",
        "phone": "210-555-0100",
        "email": f"qa.test.{random_suffix}@example.com",
        "module": "ProactiveMed",
        "reason": "Test",
        "hipaaConsent": False,
        "signature": "QA Test"
    }
    
    try:
        print(f"POST {BASE_URL}/api/kiosk/intake")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(f"{BASE_URL}/api/kiosk/intake", json=payload, timeout=30)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 400:
            data = response.json()
            assert "error" in data, "Expected error field in response"
            print(f"\n✅ TEST C2 PASSED:")
            print(f"   - Status: 400 (as expected)")
            print(f"   - Error message: {data['error']}")
        else:
            print(f"\n❌ TEST C2 FAILED: Expected 400, got {response.status_code}")
            
    except Exception as e:
        print(f"\n❌ TEST C2 FAILED with exception: {str(e)}")

def test_validation_missing_signature():
    """Test C3: Missing signature validation"""
    print("\n" + "="*80)
    print("TEST C3: Validation - Missing signature")
    print("="*80)
    
    random_suffix = generate_random_suffix()
    payload = {
        "firstName": "QA",
        "lastName": f"Test{random_suffix[:4]}",
        "dob": "1990-01-01",
        "sex": "F",
        "phone": "210-555-0100",
        "email": f"qa.test.{random_suffix}@example.com",
        "module": "ProactiveMed",
        "reason": "Test",
        "hipaaConsent": True,
        "signature": ""
    }
    
    try:
        print(f"POST {BASE_URL}/api/kiosk/intake")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(f"{BASE_URL}/api/kiosk/intake", json=payload, timeout=30)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 400:
            data = response.json()
            assert "error" in data, "Expected error field in response"
            print(f"\n✅ TEST C3 PASSED:")
            print(f"   - Status: 400 (as expected)")
            print(f"   - Error message: {data['error']}")
        else:
            print(f"\n❌ TEST C3 FAILED: Expected 400, got {response.status_code}")
            
    except Exception as e:
        print(f"\n❌ TEST C3 FAILED with exception: {str(e)}")

def test_idempotent_patient_reuse(patient_data):
    """Test D: Idempotent patient reuse - same email should return same mrn"""
    print("\n" + "="*80)
    print("TEST D: Idempotent patient reuse (same email)")
    print("="*80)
    
    if not patient_data:
        print("❌ TEST D SKIPPED: No patient data from Test A")
        return
    
    # Use the same payload from Test A
    payload = patient_data["payload"]
    original_mrn = patient_data["mrn"]
    
    try:
        print(f"POST {BASE_URL}/api/kiosk/intake (SAME payload as Test A)")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Original MRN from Test A: {original_mrn}")
        
        response = requests.post(f"{BASE_URL}/api/kiosk/intake", json=payload, timeout=30)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            data = response.json()
            new_mrn = data.get("mrn")
            
            if new_mrn == original_mrn:
                print(f"\n✅ TEST D PASSED:")
                print(f"   - Status: 200")
                print(f"   - Original MRN: {original_mrn}")
                print(f"   - New MRN: {new_mrn}")
                print(f"   - MRNs match: Patient was reused (not duplicated) ✓")
            else:
                print(f"\n❌ TEST D FAILED:")
                print(f"   - Original MRN: {original_mrn}")
                print(f"   - New MRN: {new_mrn}")
                print(f"   - MRNs DO NOT match: Patient was duplicated (should have been reused)")
        else:
            print(f"\n❌ TEST D FAILED: Expected 200, got {response.status_code}")
            
    except Exception as e:
        print(f"\n❌ TEST D FAILED with exception: {str(e)}")

def main():
    print("\n" + "="*80)
    print("KIOSK INTAKE ENDPOINT TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Endpoint: POST /api/kiosk/intake")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test A: Valid intake
    patient_data = test_valid_intake()
    
    # Test B: Document persistence (skip if no endpoint)
    test_document_persistence(patient_data)
    
    # Test C: Validation errors
    test_validation_missing_name_dob()
    test_validation_hipaa_false()
    test_validation_missing_signature()
    
    # Test D: Idempotent patient reuse
    test_idempotent_patient_reuse(patient_data)
    
    print("\n" + "="*80)
    print("TESTING COMPLETE")
    print("="*80)
    print(f"Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
