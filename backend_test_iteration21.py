#!/usr/bin/env python3
"""
Backend test for Iteration 21: Patient update/archive/delete API (role-gated)
Tests PATCH & DELETE /api/patients/[id] with role-based access control
"""

import requests
import json
import random
import string

# Base URL
BASE_URL = "http://localhost:3000"

# Test credentials (all passwords: apex123)
ADMIN_EMAIL = "admin@proactiveclinic.com"
FRONTDESK_EMAIL = "front.lopez@proactiveclinic.com"
BILLING_EMAIL = "billing@proactiveclinic.com"
PASSWORD = "apex123"

def random_suffix():
    """Generate random suffix for unique test data"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

def login(email, password):
    """Login and return session cookie"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=10
        )
        print(f"✓ Login {email}: {resp.status_code}")
        if resp.status_code == 200:
            cookies = resp.cookies.get_dict()
            return cookies.get('proactive_session')
        return None
    except Exception as e:
        print(f"✗ Login failed: {e}")
        return None

def create_throwaway_patient(session_cookie):
    """Create a throwaway patient for testing (as ADMIN)"""
    try:
        last_name = f"Throwaway{random_suffix()}"
        payload = {
            "firstName": "Zed",
            "lastName": last_name,
            "dob": "1990-01-01",
            "sex": "M"
        }
        resp = requests.post(
            f"{BASE_URL}/api/patients",
            json=payload,
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"✓ Create throwaway patient: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            patient_id = data.get('patient', {}).get('id')
            print(f"  Created patient ID: {patient_id}, lastName: {last_name}")
            return patient_id
        else:
            print(f"  Error: {resp.text}")
            return None
    except Exception as e:
        print(f"✗ Create patient failed: {e}")
        return None

def test_step_1_create_patient():
    """Step 1: As ADMIN, create a throwaway patient"""
    print("\n=== STEP 1: Create throwaway patient as ADMIN ===")
    admin_cookie = login(ADMIN_EMAIL, PASSWORD)
    if not admin_cookie:
        print("✗ STEP 1 FAILED: Could not login as admin")
        return None, None
    
    patient_id = create_throwaway_patient(admin_cookie)
    if patient_id:
        print(f"✅ STEP 1 PASSED: Created throwaway patient {patient_id}")
        return patient_id, admin_cookie
    else:
        print("✗ STEP 1 FAILED: Could not create patient")
        return None, None

def test_step_2_admin_update(patient_id, admin_cookie):
    """Step 2: As ADMIN, PATCH patient with phone and city"""
    print("\n=== STEP 2: ADMIN updates patient phone and city ===")
    try:
        payload = {
            "phone": "2105550000",
            "city": "San Antonio"
        }
        resp = requests.patch(
            f"{BASE_URL}/api/patients/{patient_id}",
            json=payload,
            cookies={"proactive_session": admin_cookie},
            timeout=10
        )
        print(f"✓ PATCH as admin: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            patient = data.get('patient', {})
            if patient.get('phone') == "2105550000" and patient.get('city') == "San Antonio":
                print(f"  ✓ phone: {patient.get('phone')}, city: {patient.get('city')}")
                print("✅ STEP 2 PASSED: Admin successfully updated phone and city")
                return True
            else:
                print(f"  ✗ Fields not updated correctly: phone={patient.get('phone')}, city={patient.get('city')}")
                print("✗ STEP 2 FAILED: Fields not updated")
                return False
        else:
            print(f"  Error: {resp.text}")
            print("✗ STEP 2 FAILED: Non-200 response")
            return False
    except Exception as e:
        print(f"✗ STEP 2 FAILED: {e}")
        return False

def test_step_3_frontdesk_status(patient_id):
    """Step 3: As FRONTDESK, archive then reactivate patient"""
    print("\n=== STEP 3: FRONTDESK archives and reactivates patient ===")
    frontdesk_cookie = login(FRONTDESK_EMAIL, PASSWORD)
    if not frontdesk_cookie:
        print("✗ STEP 3 FAILED: Could not login as frontdesk")
        return False
    
    try:
        # Archive
        resp1 = requests.patch(
            f"{BASE_URL}/api/patients/{patient_id}",
            json={"status": "archived"},
            cookies={"proactive_session": frontdesk_cookie},
            timeout=10
        )
        print(f"✓ PATCH status=archived as frontdesk: {resp1.status_code}")
        
        if resp1.status_code != 200:
            print(f"  Error: {resp1.text}")
            print("✗ STEP 3 FAILED: Could not archive")
            return False
        
        data1 = resp1.json()
        if data1.get('patient', {}).get('status') != 'archived':
            print(f"  ✗ Status not archived: {data1.get('patient', {}).get('status')}")
            print("✗ STEP 3 FAILED: Status not archived")
            return False
        
        print(f"  ✓ Status archived: {data1.get('patient', {}).get('status')}")
        
        # Reactivate
        resp2 = requests.patch(
            f"{BASE_URL}/api/patients/{patient_id}",
            json={"status": "active"},
            cookies={"proactive_session": frontdesk_cookie},
            timeout=10
        )
        print(f"✓ PATCH status=active as frontdesk: {resp2.status_code}")
        
        if resp2.status_code != 200:
            print(f"  Error: {resp2.text}")
            print("✗ STEP 3 FAILED: Could not reactivate")
            return False
        
        data2 = resp2.json()
        if data2.get('patient', {}).get('status') != 'active':
            print(f"  ✗ Status not active: {data2.get('patient', {}).get('status')}")
            print("✗ STEP 3 FAILED: Status not active")
            return False
        
        print(f"  ✓ Status active: {data2.get('patient', {}).get('status')}")
        print("✅ STEP 3 PASSED: Frontdesk successfully archived and reactivated")
        return True
        
    except Exception as e:
        print(f"✗ STEP 3 FAILED: {e}")
        return False

def test_step_4_validation(patient_id, admin_cookie):
    """Step 4: Validation tests (invalid status, invalid dob, empty firstName, empty body)"""
    print("\n=== STEP 4: Validation tests as ADMIN ===")
    all_passed = True
    
    # Test 4a: Invalid status
    try:
        resp = requests.patch(
            f"{BASE_URL}/api/patients/{patient_id}",
            json={"status": "bogus"},
            cookies={"proactive_session": admin_cookie},
            timeout=10
        )
        print(f"✓ PATCH status=bogus: {resp.status_code}")
        if resp.status_code == 400:
            print(f"  ✓ Correctly rejected with 400: {resp.json().get('error')}")
        else:
            print(f"  ✗ Expected 400, got {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"✗ Test 4a failed: {e}")
        all_passed = False
    
    # Test 4b: Invalid dob
    try:
        resp = requests.patch(
            f"{BASE_URL}/api/patients/{patient_id}",
            json={"dob": "not-a-date"},
            cookies={"proactive_session": admin_cookie},
            timeout=10
        )
        print(f"✓ PATCH dob=not-a-date: {resp.status_code}")
        if resp.status_code == 400:
            print(f"  ✓ Correctly rejected with 400: {resp.json().get('error')}")
        else:
            print(f"  ✗ Expected 400, got {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"✗ Test 4b failed: {e}")
        all_passed = False
    
    # Test 4c: Empty firstName
    try:
        resp = requests.patch(
            f"{BASE_URL}/api/patients/{patient_id}",
            json={"firstName": ""},
            cookies={"proactive_session": admin_cookie},
            timeout=10
        )
        print(f"✓ PATCH firstName='': {resp.status_code}")
        if resp.status_code == 400:
            print(f"  ✓ Correctly rejected with 400: {resp.json().get('error')}")
        else:
            print(f"  ✗ Expected 400, got {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"✗ Test 4c failed: {e}")
        all_passed = False
    
    # Test 4d: Empty body
    try:
        resp = requests.patch(
            f"{BASE_URL}/api/patients/{patient_id}",
            json={},
            cookies={"proactive_session": admin_cookie},
            timeout=10
        )
        print(f"✓ PATCH empty body: {resp.status_code}")
        if resp.status_code == 400:
            print(f"  ✓ Correctly rejected with 400: {resp.json().get('error')}")
        else:
            print(f"  ✗ Expected 400, got {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"✗ Test 4d failed: {e}")
        all_passed = False
    
    if all_passed:
        print("✅ STEP 4 PASSED: All validation tests passed")
    else:
        print("✗ STEP 4 FAILED: Some validation tests failed")
    
    return all_passed

def test_step_5_role_denials(patient_id):
    """Step 5: Role denial tests (BILLING cannot PATCH phone or status, FRONTDESK cannot DELETE)"""
    print("\n=== STEP 5: Role denial tests ===")
    all_passed = True
    
    # Login as BILLING
    billing_cookie = login(BILLING_EMAIL, PASSWORD)
    if not billing_cookie:
        print("✗ STEP 5 FAILED: Could not login as billing")
        return False
    
    # Test 5a: BILLING cannot PATCH phone
    try:
        resp = requests.patch(
            f"{BASE_URL}/api/patients/{patient_id}",
            json={"phone": "2105551111"},
            cookies={"proactive_session": billing_cookie},
            timeout=10
        )
        print(f"✓ BILLING PATCH phone: {resp.status_code}")
        if resp.status_code == 403:
            print(f"  ✓ Correctly denied with 403: {resp.json().get('error')}")
        else:
            print(f"  ✗ Expected 403, got {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"✗ Test 5a failed: {e}")
        all_passed = False
    
    # Test 5b: BILLING cannot PATCH status
    try:
        resp = requests.patch(
            f"{BASE_URL}/api/patients/{patient_id}",
            json={"status": "archived"},
            cookies={"proactive_session": billing_cookie},
            timeout=10
        )
        print(f"✓ BILLING PATCH status: {resp.status_code}")
        if resp.status_code == 403:
            print(f"  ✓ Correctly denied with 403: {resp.json().get('error')}")
        else:
            print(f"  ✗ Expected 403, got {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"✗ Test 5b failed: {e}")
        all_passed = False
    
    # Login as FRONTDESK
    frontdesk_cookie = login(FRONTDESK_EMAIL, PASSWORD)
    if not frontdesk_cookie:
        print("✗ STEP 5 FAILED: Could not login as frontdesk")
        return False
    
    # Test 5c: FRONTDESK cannot DELETE
    try:
        resp = requests.delete(
            f"{BASE_URL}/api/patients/{patient_id}",
            cookies={"proactive_session": frontdesk_cookie},
            timeout=10
        )
        print(f"✓ FRONTDESK DELETE: {resp.status_code}")
        if resp.status_code == 403:
            print(f"  ✓ Correctly denied with 403: {resp.json().get('error')}")
        else:
            print(f"  ✗ Expected 403, got {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"✗ Test 5c failed: {e}")
        all_passed = False
    
    if all_passed:
        print("✅ STEP 5 PASSED: All role denial tests passed")
    else:
        print("✗ STEP 5 FAILED: Some role denial tests failed")
    
    return all_passed

def test_step_6_no_auth(patient_id):
    """Step 6: No auth tests (PATCH and DELETE without cookie should return 401)"""
    print("\n=== STEP 6: No auth tests ===")
    all_passed = True
    
    # Test 6a: PATCH without cookie
    try:
        resp = requests.patch(
            f"{BASE_URL}/api/patients/{patient_id}",
            json={"phone": "2105552222"},
            timeout=10
        )
        print(f"✓ PATCH without cookie: {resp.status_code}")
        if resp.status_code == 401:
            print(f"  ✓ Correctly blocked with 401")
        else:
            print(f"  ✗ Expected 401, got {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"✗ Test 6a failed: {e}")
        all_passed = False
    
    # Test 6b: DELETE without cookie
    try:
        resp = requests.delete(
            f"{BASE_URL}/api/patients/{patient_id}",
            timeout=10
        )
        print(f"✓ DELETE without cookie: {resp.status_code}")
        if resp.status_code == 401:
            print(f"  ✓ Correctly blocked with 401")
        else:
            print(f"  ✗ Expected 401, got {resp.status_code}")
            all_passed = False
    except Exception as e:
        print(f"✗ Test 6b failed: {e}")
        all_passed = False
    
    if all_passed:
        print("✅ STEP 6 PASSED: All no-auth tests passed")
    else:
        print("✗ STEP 6 FAILED: Some no-auth tests failed")
    
    return all_passed

def test_step_7_admin_delete(patient_id, admin_cookie):
    """Step 7: As ADMIN, DELETE patient and verify 404 on subsequent GET"""
    print("\n=== STEP 7: ADMIN deletes patient ===")
    
    try:
        # DELETE
        resp1 = requests.delete(
            f"{BASE_URL}/api/patients/{patient_id}",
            cookies={"proactive_session": admin_cookie},
            timeout=10
        )
        print(f"✓ DELETE as admin: {resp1.status_code}")
        
        if resp1.status_code != 200:
            print(f"  Error: {resp1.text}")
            print("✗ STEP 7 FAILED: Could not delete")
            return False
        
        data1 = resp1.json()
        if not data1.get('ok'):
            print(f"  ✗ Response not ok: {data1}")
            print("✗ STEP 7 FAILED: Delete response not ok")
            return False
        
        print(f"  ✓ Delete successful: {data1}")
        
        # Verify 404 on GET
        resp2 = requests.get(
            f"{BASE_URL}/api/patients/{patient_id}",
            cookies={"proactive_session": admin_cookie},
            timeout=10
        )
        print(f"✓ GET after delete: {resp2.status_code}")
        
        if resp2.status_code == 404:
            print(f"  ✓ Correctly returns 404 after deletion")
            print("✅ STEP 7 PASSED: Admin successfully deleted patient and verified 404")
            return True
        else:
            print(f"  ✗ Expected 404, got {resp2.status_code}")
            print("✗ STEP 7 FAILED: Patient still exists after deletion")
            return False
        
    except Exception as e:
        print(f"✗ STEP 7 FAILED: {e}")
        return False

def main():
    print("=" * 80)
    print("BACKEND TEST: Iteration 21 - Patient update/archive/delete API (role-gated)")
    print("=" * 80)
    
    # Step 1: Create throwaway patient
    patient_id, admin_cookie = test_step_1_create_patient()
    if not patient_id or not admin_cookie:
        print("\n❌ CRITICAL: Could not create throwaway patient. Aborting tests.")
        return
    
    # Step 2: Admin updates phone and city
    step2_passed = test_step_2_admin_update(patient_id, admin_cookie)
    
    # Step 3: Frontdesk archives and reactivates
    step3_passed = test_step_3_frontdesk_status(patient_id)
    
    # Step 4: Validation tests
    step4_passed = test_step_4_validation(patient_id, admin_cookie)
    
    # Step 5: Role denial tests
    step5_passed = test_step_5_role_denials(patient_id)
    
    # Step 6: No auth tests
    step6_passed = test_step_6_no_auth(patient_id)
    
    # Step 7: Admin deletes patient
    step7_passed = test_step_7_admin_delete(patient_id, admin_cookie)
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Step 1 (Create throwaway patient): {'✅ PASSED' if patient_id else '❌ FAILED'}")
    print(f"Step 2 (Admin update phone/city): {'✅ PASSED' if step2_passed else '❌ FAILED'}")
    print(f"Step 3 (Frontdesk archive/reactivate): {'✅ PASSED' if step3_passed else '❌ FAILED'}")
    print(f"Step 4 (Validation tests): {'✅ PASSED' if step4_passed else '❌ FAILED'}")
    print(f"Step 5 (Role denial tests): {'✅ PASSED' if step5_passed else '❌ FAILED'}")
    print(f"Step 6 (No auth tests): {'✅ PASSED' if step6_passed else '❌ FAILED'}")
    print(f"Step 7 (Admin delete + verify 404): {'✅ PASSED' if step7_passed else '❌ FAILED'}")
    
    all_passed = all([patient_id, step2_passed, step3_passed, step4_passed, step5_passed, step6_passed, step7_passed])
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED")
    else:
        print("\n⚠️  SOME TESTS FAILED")
    
    print("=" * 80)

if __name__ == "__main__":
    main()
