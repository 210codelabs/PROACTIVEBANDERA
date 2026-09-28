#!/usr/bin/env python3
"""
Backend test for Weno EZ e-prescribing PRODUCTION default fix.

BUG CONTEXT: e-prescriptions sent via Weno EZ were not reaching the LIVE Weno
Exchange logs because the app could silently run in TEST mode (TestPatient=Y,
targeting test.wenoexchange.com). The fix makes a configured integration default
to PRODUCTION and exposes diagnostics.

SECURITY CRITICAL: NEVER print or log the full iframeUrl, its `data=` query value,
`useremail`, passwords, encryption keys, or any secret. Mask them.

Test scenarios (NO HTTP 500s allowed):
1. GET /api/weno/iframe-url/cms87vx850017l4ocyz5zfz89 with admin session
   -> expect HTTP 200 with:
   - environment === 'production'
   - live === true
   - testPatient === 'N'
   - composeHost === 'online.wenoexchange.com' (NOT 'test.wenoexchange.com')
   - iframeUrl field is present (do NOT print it)
   - If 404/422 for this patient, pick another patient with complete demographics

2. GET /api/weno/iframe-url/cms87vx850017l4ocyz5zfz89 WITHOUT session -> 401

3. Confirm NO HTTP 500 responses
"""

import requests
import sys
import json
from typing import Optional

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Admin credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

# Test patient ID (Eleanor Adams)
TEST_PATIENT_ID = "cms87vx850017l4ocyz5zfz89"

def mask_sensitive_data(data: dict) -> dict:
    """Mask sensitive fields in response data for safe logging."""
    masked = data.copy()
    if 'iframeUrl' in masked:
        # Only show that it exists, not the actual value
        masked['iframeUrl'] = '<MASKED - PHI + CREDENTIALS>'
    return masked

def login_admin() -> Optional[requests.Session]:
    """Login as admin and return session with cookie."""
    print("\n=== STEP 0: ADMIN LOGIN ===")
    session = requests.Session()
    
    try:
        resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30
        )
        
        print(f"POST /api/auth/login -> {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                print(f"✅ Admin login successful")
                print(f"   Session cookie set: {bool(session.cookies.get('proactive_session'))}")
                return session
            else:
                print(f"❌ Login failed: {data}")
                return None
        else:
            print(f"❌ Login failed with status {resp.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def get_patient_with_complete_demographics(session: requests.Session) -> Optional[str]:
    """Get a patient ID with complete demographics for Weno."""
    print("\n=== FINDING PATIENT WITH COMPLETE DEMOGRAPHICS ===")
    
    try:
        # Get list of patients
        resp = session.get(
            f"{BASE_URL}/api/patients/search?q=a&limit=20",
            timeout=30
        )
        
        print(f"GET /api/patients/search?q=a&limit=20 -> {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Failed to get patients: {resp.status_code}")
            return None
            
        data = resp.json()
        patients = data.get("results", [])
        
        print(f"Found {len(patients)} patients")
        
        # Look for a patient with complete demographics
        required_fields = ['firstName', 'lastName', 'dob', 'address1', 'city', 'state', 'postalCode', 'phone']
        
        for patient in patients:
            # Check if patient has all required fields
            has_all = all(patient.get(field) for field in required_fields)
            
            if has_all:
                print(f"✅ Found patient with complete demographics:")
                print(f"   ID: {patient['id']}")
                print(f"   Name: {patient.get('firstName')} {patient.get('lastName')}")
                print(f"   MRN: {patient.get('mrn')}")
                return patient['id']
        
        print(f"⚠️  No patient found with complete demographics, will try original patient ID")
        return None
        
    except Exception as e:
        print(f"❌ Error finding patient: {e}")
        return None

def test_iframe_url_with_auth(session: requests.Session, patient_id: str) -> bool:
    """Test GET /api/weno/iframe-url/[patientId] WITH admin session."""
    print(f"\n=== TEST 1: GET /api/weno/iframe-url/{patient_id} WITH AUTH ===")
    
    try:
        resp = session.get(
            f"{BASE_URL}/api/weno/iframe-url/{patient_id}",
            timeout=30
        )
        
        print(f"GET /api/weno/iframe-url/{patient_id} -> {resp.status_code}")
        
        # Check for 404/422 (patient not found or missing demographics)
        if resp.status_code in [404, 422]:
            data = resp.json()
            print(f"⚠️  Patient {patient_id} returned {resp.status_code}: {data.get('error')}")
            print(f"   This is ACCEPTABLE if the patient is missing required Weno demographics")
            
            # Try to find another patient
            print(f"\n   Attempting to find a patient with complete demographics...")
            new_patient_id = get_patient_with_complete_demographics(session)
            
            if new_patient_id and new_patient_id != patient_id:
                print(f"\n   Retrying with patient {new_patient_id}...")
                return test_iframe_url_with_auth(session, new_patient_id)
            else:
                print(f"❌ Could not find a suitable patient for testing")
                return False
        
        # Check for HTTP 500 (NOT allowed)
        if resp.status_code == 500:
            print(f"❌ CRITICAL: HTTP 500 error (NOT ALLOWED)")
            try:
                print(f"   Response: {resp.text[:500]}")
            except:
                pass
            return False
        
        # Expect HTTP 200
        if resp.status_code != 200:
            print(f"❌ Unexpected status code: {resp.status_code}")
            try:
                print(f"   Response: {resp.json()}")
            except:
                print(f"   Response: {resp.text[:500]}")
            return False
        
        # Parse response
        data = resp.json()
        
        # Mask sensitive data for logging
        masked_data = mask_sensitive_data(data)
        print(f"Response (masked): {json.dumps(masked_data, indent=2)}")
        
        # CRITICAL ASSERTIONS
        print("\n--- CRITICAL ASSERTIONS ---")
        
        # 1. iframeUrl field must be present
        if 'iframeUrl' not in data:
            print(f"❌ ASSERTION FAILED: 'iframeUrl' field is missing")
            return False
        print(f"✅ ASSERTION PASSED: 'iframeUrl' field is present")
        
        # 2. environment must be 'production'
        if data.get('environment') != 'production':
            print(f"❌ ASSERTION FAILED: environment = '{data.get('environment')}' (expected 'production')")
            return False
        print(f"✅ ASSERTION PASSED: environment === 'production'")
        
        # 3. live must be true
        if data.get('live') != True:
            print(f"❌ ASSERTION FAILED: live = {data.get('live')} (expected true)")
            return False
        print(f"✅ ASSERTION PASSED: live === true")
        
        # 4. testPatient must be 'N'
        if data.get('testPatient') != 'N':
            print(f"❌ ASSERTION FAILED: testPatient = '{data.get('testPatient')}' (expected 'N')")
            return False
        print(f"✅ ASSERTION PASSED: testPatient === 'N'")
        
        # 5. composeHost must be 'online.wenoexchange.com' (NOT 'test.wenoexchange.com')
        if data.get('composeHost') != 'online.wenoexchange.com':
            print(f"❌ ASSERTION FAILED: composeHost = '{data.get('composeHost')}' (expected 'online.wenoexchange.com')")
            return False
        print(f"✅ ASSERTION PASSED: composeHost === 'online.wenoexchange.com' (NOT 'test.wenoexchange.com')")
        
        print(f"\n✅ TEST 1 PASSED: All critical assertions passed")
        print(f"   - environment: production ✅")
        print(f"   - live: true ✅")
        print(f"   - testPatient: N ✅")
        print(f"   - composeHost: online.wenoexchange.com ✅")
        print(f"   - iframeUrl: present (masked for security) ✅")
        
        return True
        
    except Exception as e:
        print(f"❌ TEST 1 ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_iframe_url_without_auth(patient_id: str) -> bool:
    """Test GET /api/weno/iframe-url/[patientId] WITHOUT session."""
    print(f"\n=== TEST 2: GET /api/weno/iframe-url/{patient_id} WITHOUT AUTH ===")
    
    try:
        # Create a new session without logging in
        session = requests.Session()
        
        resp = session.get(
            f"{BASE_URL}/api/weno/iframe-url/{patient_id}",
            timeout=30
        )
        
        print(f"GET /api/weno/iframe-url/{patient_id} (no auth) -> {resp.status_code}")
        
        # Expect HTTP 401
        if resp.status_code != 401:
            print(f"❌ ASSERTION FAILED: Expected 401, got {resp.status_code}")
            try:
                print(f"   Response: {resp.json()}")
            except:
                print(f"   Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        print(f"✅ TEST 2 PASSED: Correctly returns 401 Unauthorized without session")
        return True
        
    except Exception as e:
        print(f"❌ TEST 2 ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests."""
    print("=" * 80)
    print("BACKEND TEST: Weno EZ e-prescribing PRODUCTION default fix")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print(f"Test Patient ID: {TEST_PATIENT_ID}")
    print("=" * 80)
    
    # Login as admin
    session = login_admin()
    if not session:
        print("\n❌ FAILED: Could not login as admin")
        sys.exit(1)
    
    # Run tests
    results = []
    
    # Test 1: GET with auth
    results.append(("Test 1: GET iframe-url WITH auth", test_iframe_url_with_auth(session, TEST_PATIENT_ID)))
    
    # Test 2: GET without auth
    results.append(("Test 2: GET iframe-url WITHOUT auth", test_iframe_url_without_auth(TEST_PATIENT_ID)))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print("=" * 80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("=" * 80)
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED")
        print("\nCRITICAL VERIFICATION:")
        print("  ✅ NO HTTP 500 errors encountered")
        print("  ✅ environment === 'production' (defaults to PRODUCTION)")
        print("  ✅ live === true")
        print("  ✅ testPatient === 'N' (NOT 'Y')")
        print("  ✅ composeHost === 'online.wenoexchange.com' (NOT 'test.wenoexchange.com')")
        print("  ✅ iframeUrl field present (masked for security)")
        print("  ✅ 401 Unauthorized without session")
        print("\nROOT-CAUSE FIX VERIFIED:")
        print("  The Weno EZ integration now defaults to PRODUCTION mode.")
        print("  E-prescriptions will reach the LIVE Weno Exchange logs.")
        print("  The fix prevents silent routing to the TEST stream.")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
