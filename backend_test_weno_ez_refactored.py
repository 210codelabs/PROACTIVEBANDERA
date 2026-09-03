#!/usr/bin/env python3
"""
Backend test for refactored Weno EZ ComposeRx sample-payload endpoint.
Tests the modular buildWenoPrescriptionPayload(patientId, providerId) function
that must emit EXACTLY 45 keys in EXACT contract order.

Base URL: http://localhost:3000

AUTH accounts (staff login POST /api/auth/login {email, password}):
- admin: admin@proactiveclinic.com / apex123
- nurse: nurse.kim@proactiveclinic.com / apex123
- provider: andy.manzano@proactiveclinic.com / apex123

SECURITY: Do NOT print the values of UserEmail, MD5Password, LocationID — mask them as *** in any output.
"""

import requests
import json
import re
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# The exact 45-key ordered list to compare against
EXPECTED_45_KEYS = [
    "UserEmail",
    "MD5Password",
    "LocationID",
    "TestPatient",
    "PatientType",
    "OrgPatientID",
    "LastName",
    "FirstName",
    "MiddleName",
    "Prefix",
    "Suffix",
    "Gender",
    "DateOfBirth",
    "AddressLine1",
    "AddressLine2",
    "City",
    "State",
    "PostalCode",
    "CountryCode",
    "PrimaryPhone",
    "SupportsSMS",
    "PatientEmail",
    "ResponsiblePartySameAsPatient",
    "ResponsiblePartyLastName",
    "ResponsiblePartyFirstName",
    "ResponsiblePartyAddressLine1",
    "ResponsiblePartyAddressLine2",
    "ResponsiblePartyCity",
    "ResponsiblePartyState",
    "ResponsiblePartyPostalCode",
    "ResponsiblePartyCountryCode",
    "ResponsiblePartyPrimaryPhone",
    "PatientLocation",
    "FacilityName",
    "FacilityAddressLine1",
    "FacilityAddressLine2",
    "FacilityCity",
    "FacilityState",
    "FacilityPostalCode",
    "FacilityCountryCode",
    "FacilityPrimaryPhone",
    "FacilityEmail",
    "FacilityFax",
    "PrimaryPharmacyNCPCP",
    "AlternativePharmacyNCPCP",
]

def mask_secrets(data):
    """Mask sensitive Weno credentials in output."""
    if isinstance(data, dict):
        masked = {}
        for k, v in data.items():
            if k in ["UserEmail", "MD5Password", "LocationID"]:
                masked[k] = "***"
            elif isinstance(v, dict):
                masked[k] = mask_secrets(v)
            elif isinstance(v, list):
                masked[k] = [mask_secrets(item) if isinstance(item, dict) else item for item in v]
            else:
                masked[k] = v
        return masked
    return data

def login(email, password):
    """Login and return session cookie."""
    print(f"  → Logging in as {email}...")
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        print(f"    ✗ Login failed: {resp.status_code} {resp.text[:200]}")
        return None
    cookie = resp.cookies.get("proactive_session")
    if not cookie:
        print(f"    ✗ No session cookie returned")
        return None
    print(f"    ✓ Login successful, session cookie obtained")
    return cookie

def get_real_patient_id(session_cookie):
    """Get a real patientId via GET /api/patients/search?q=a&limit=1."""
    print("  → Getting real patientId via GET /api/patients/search?q=adams&limit=1...")
    resp = requests.get(f"{BASE_URL}/api/patients/search?q=adams&limit=1", cookies={"proactive_session": session_cookie})
    if resp.status_code != 200:
        print(f"    ✗ Failed to get patient: {resp.status_code} {resp.text[:200]}")
        return None
    data = resp.json()
    # Try both 'results' and 'patients' keys for compatibility
    patients = data.get("results") or data.get("patients") or []
    if len(patients) == 0:
        print(f"    ✗ No patients found")
        return None
    patient = patients[0]
    patient_id = patient.get("id")
    patient_name = f"{patient.get('firstName', '')} {patient.get('lastName', '')}"
    print(f"    ✓ Found patient: {patient_name} (ID: {patient_id})")
    return patient_id

def verify_45_keys_exact_order(payload, test_name):
    """Verify payload has exactly 45 keys in exact order."""
    actual_keys = list(payload.keys())
    
    # Check count
    if len(actual_keys) != 45:
        print(f"    ✗ FAIL: Expected 45 keys, got {len(actual_keys)}")
        print(f"       Expected: {EXPECTED_45_KEYS}")
        print(f"       Actual:   {actual_keys}")
        return False
    
    # Check exact order
    mismatches = []
    for i, (expected, actual) in enumerate(zip(EXPECTED_45_KEYS, actual_keys)):
        if expected != actual:
            mismatches.append(f"Position {i}: expected '{expected}', got '{actual}'")
    
    if mismatches:
        print(f"    ✗ FAIL: Key order mismatch:")
        for m in mismatches:
            print(f"       {m}")
        return False
    
    print(f"    ✓ PASS: Payload has exactly 45 keys in exact order")
    return True

def verify_md5_password_format(payload):
    """Verify MD5Password matches ^[a-f0-9]{32}$ format WITHOUT printing it."""
    md5_value = payload.get("MD5Password", "")
    if re.match(r'^[a-f0-9]{32}$', md5_value):
        print(f"    ✓ MD5Password format verified (32-char hex) WITHOUT printing value")
        return True
    else:
        print(f"    ✗ MD5Password format invalid (expected 32-char hex, got length {len(md5_value)})")
        return False

def test_1_no_session():
    """TEST 1: No session: GET /api/weno/ez/sample-payload -> 401."""
    print("\n" + "="*80)
    print("TEST 1: No session -> 401")
    print("="*80)
    
    resp = requests.get(f"{BASE_URL}/api/weno/ez/sample-payload")
    print(f"  Status: {resp.status_code}")
    
    if resp.status_code == 401:
        print(f"  ✓ PASS: Correctly returns 401 Unauthorized")
        return True
    else:
        print(f"  ✗ FAIL: Expected 401, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False

def test_2_nurse_session():
    """TEST 2: Nurse session: GET /api/weno/ez/sample-payload -> 403 (error mentions prescriber/admin required)."""
    print("\n" + "="*80)
    print("TEST 2: Nurse session -> 403 (prescriber/admin required)")
    print("="*80)
    
    nurse_cookie = login("nurse.kim@proactiveclinic.com", "apex123")
    if not nurse_cookie:
        print("  ✗ FAIL: Could not login as nurse")
        return False
    
    resp = requests.get(f"{BASE_URL}/api/weno/ez/sample-payload", cookies={"proactive_session": nurse_cookie})
    print(f"  Status: {resp.status_code}")
    
    if resp.status_code == 403:
        data = resp.json()
        error = data.get("error", "")
        print(f"  Error message: {error}")
        if "prescriber" in error.lower() or "admin" in error.lower():
            print(f"  ✓ PASS: Correctly returns 403 with prescriber/admin requirement")
            return True
        else:
            print(f"  ✗ FAIL: 403 returned but error message doesn't mention prescriber/admin")
            return False
    else:
        print(f"  ✗ FAIL: Expected 403, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False

def test_3_admin_no_patient():
    """TEST 3: Admin, no patientId: GET /api/weno/ez/sample-payload -> 200 JSON {environment, missing, payload}.
    Assert Object.keys(payload) EQUALS the 45-key list above IN THE SAME ORDER (exact length 45, exact order).
    Confirm MD5Password matches ^[a-f0-9]{32}$ format WITHOUT printing it."""
    print("\n" + "="*80)
    print("TEST 3: Admin, no patientId -> 200 with 45 keys in exact order")
    print("="*80)
    
    admin_cookie = login("admin@proactiveclinic.com", "apex123")
    if not admin_cookie:
        print("  ✗ FAIL: Could not login as admin")
        return False
    
    resp = requests.get(f"{BASE_URL}/api/weno/ez/sample-payload", cookies={"proactive_session": admin_cookie})
    print(f"  Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"  ✗ FAIL: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False
    
    data = resp.json()
    
    # Check response structure
    if "environment" not in data or "missing" not in data or "payload" not in data:
        print(f"  ✗ FAIL: Response missing required keys (environment, missing, payload)")
        print(f"  Response keys: {list(data.keys())}")
        return False
    
    print(f"  ✓ Response has correct structure: environment, missing, payload")
    print(f"  Environment: {data['environment']}")
    print(f"  Missing array: {data['missing']}")
    
    payload = data["payload"]
    
    # Verify 45 keys in exact order
    if not verify_45_keys_exact_order(payload, "admin_no_patient"):
        return False
    
    # Verify MD5Password format
    if not verify_md5_password_format(payload):
        return False
    
    # Mask and print sample of payload (for debugging)
    masked_payload = mask_secrets(payload)
    print(f"  Sample payload fields (secrets masked):")
    print(f"    UserEmail: {masked_payload['UserEmail']}")
    print(f"    MD5Password: {masked_payload['MD5Password']}")
    print(f"    LocationID: {masked_payload['LocationID']}")
    print(f"    TestPatient: {payload['TestPatient']}")
    print(f"    LastName: {payload['LastName']}")
    print(f"    FirstName: {payload['FirstName']}")
    print(f"    DateOfBirth: {payload['DateOfBirth']}")
    
    print(f"  ✓ PASS: All checks passed for admin without patientId")
    return True

def test_4_admin_real_patient(admin_cookie, patient_id):
    """TEST 4: Admin, real patientId: GET /api/weno/ez/sample-payload?patientId=<realId> -> 200.
    Payload still has exactly 45 keys in exact order. LastName/FirstName/DateOfBirth reflect the real patient.
    Report the `missing` array contents."""
    print("\n" + "="*80)
    print("TEST 4: Admin, real patientId -> 200 with 45 keys, real patient data")
    print("="*80)
    
    resp = requests.get(f"{BASE_URL}/api/weno/ez/sample-payload?patientId={patient_id}", cookies={"proactive_session": admin_cookie})
    print(f"  Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"  ✗ FAIL: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False
    
    data = resp.json()
    
    # Check response structure
    if "environment" not in data or "missing" not in data or "payload" not in data:
        print(f"  ✗ FAIL: Response missing required keys (environment, missing, payload)")
        return False
    
    print(f"  ✓ Response has correct structure")
    print(f"  Environment: {data['environment']}")
    print(f"  Missing array: {data['missing']}")
    
    payload = data["payload"]
    
    # Verify 45 keys in exact order
    if not verify_45_keys_exact_order(payload, "admin_real_patient"):
        return False
    
    # Verify MD5Password format
    if not verify_md5_password_format(payload):
        return False
    
    # Check that patient data is present (not sample patient)
    print(f"  Real patient data in payload:")
    print(f"    LastName: {payload['LastName']}")
    print(f"    FirstName: {payload['FirstName']}")
    print(f"    DateOfBirth: {payload['DateOfBirth']}")
    print(f"    OrgPatientID: {payload['OrgPatientID']}")
    
    if payload['OrgPatientID'] != patient_id:
        print(f"  ✗ FAIL: OrgPatientID doesn't match patientId (expected {patient_id}, got {payload['OrgPatientID']})")
        return False
    
    print(f"  ✓ PASS: All checks passed for admin with real patientId")
    return True

def test_5_download_mode(admin_cookie, patient_id):
    """TEST 5: Download mode: GET /api/weno/ez/sample-payload?patientId=<realId>&download=1 -> 200 with
    Content-Type application/json and Content-Disposition attachment filename. The response body must be
    the RAW payload object ONLY (no environment/missing wrapper). Parse it and assert Object.keys EQUALS
    the 45-key list in order. Do not print secret values."""
    print("\n" + "="*80)
    print("TEST 5: Download mode -> 200 with raw payload only, 45 keys in order")
    print("="*80)
    
    resp = requests.get(f"{BASE_URL}/api/weno/ez/sample-payload?patientId={patient_id}&download=1", cookies={"proactive_session": admin_cookie})
    print(f"  Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"  ✗ FAIL: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False
    
    # Check Content-Type
    content_type = resp.headers.get("Content-Type", "")
    print(f"  Content-Type: {content_type}")
    if "application/json" not in content_type:
        print(f"  ✗ FAIL: Expected Content-Type application/json, got {content_type}")
        return False
    print(f"  ✓ Content-Type is application/json")
    
    # Check Content-Disposition
    content_disposition = resp.headers.get("Content-Disposition", "")
    print(f"  Content-Disposition: {content_disposition}")
    if "attachment" not in content_disposition or "filename" not in content_disposition:
        print(f"  ✗ FAIL: Expected Content-Disposition with attachment and filename")
        return False
    print(f"  ✓ Content-Disposition has attachment and filename")
    
    # Parse response body - should be RAW payload only (no wrapper)
    try:
        payload = resp.json()
    except Exception as e:
        print(f"  ✗ FAIL: Could not parse JSON response: {e}")
        return False
    
    # Check that it's the raw payload (not wrapped)
    if "environment" in payload or "missing" in payload or "payload" in payload:
        print(f"  ✗ FAIL: Response body is wrapped (has environment/missing/payload keys)")
        print(f"  Response keys: {list(payload.keys())}")
        return False
    
    print(f"  ✓ Response body is raw payload (no wrapper)")
    
    # Verify 45 keys in exact order
    if not verify_45_keys_exact_order(payload, "download_mode"):
        return False
    
    # Verify MD5Password format
    if not verify_md5_password_format(payload):
        return False
    
    # Mask and print sample (for debugging)
    masked_payload = mask_secrets(payload)
    print(f"  Sample payload fields (secrets masked):")
    print(f"    UserEmail: {masked_payload['UserEmail']}")
    print(f"    MD5Password: {masked_payload['MD5Password']}")
    print(f"    LocationID: {masked_payload['LocationID']}")
    
    print(f"  ✓ PASS: All checks passed for download mode")
    return True

def test_6_provider_session():
    """TEST 6: Provider session (andy.manzano): GET /api/weno/ez/sample-payload -> 200 (provider role allowed, not 403)."""
    print("\n" + "="*80)
    print("TEST 6: Provider session -> 200 (provider role allowed)")
    print("="*80)
    
    provider_cookie = login("andy.manzano@proactiveclinic.com", "apex123")
    if not provider_cookie:
        print("  ✗ FAIL: Could not login as provider")
        return False
    
    resp = requests.get(f"{BASE_URL}/api/weno/ez/sample-payload", cookies={"proactive_session": provider_cookie})
    print(f"  Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"  ✗ FAIL: Expected 200, got {resp.status_code}")
        print(f"  Response: {resp.text[:500]}")
        return False
    
    data = resp.json()
    
    # Check response structure
    if "environment" not in data or "missing" not in data or "payload" not in data:
        print(f"  ✗ FAIL: Response missing required keys (environment, missing, payload)")
        return False
    
    print(f"  ✓ Response has correct structure")
    
    payload = data["payload"]
    
    # Verify 45 keys in exact order
    if not verify_45_keys_exact_order(payload, "provider_session"):
        return False
    
    print(f"  ✓ PASS: Provider role is allowed to access endpoint")
    return True

def main():
    print("\n" + "="*80)
    print("WENO EZ COMPOSERX SAMPLE-PAYLOAD REFACTORED ENDPOINT TEST")
    print("Testing buildWenoPrescriptionPayload(patientId, providerId)")
    print("Must emit EXACTLY 45 keys in EXACT contract order")
    print("="*80)
    
    results = []
    
    # TEST 1: No session
    results.append(("TEST 1: No session -> 401", test_1_no_session()))
    
    # TEST 2: Nurse session
    results.append(("TEST 2: Nurse session -> 403", test_2_nurse_session()))
    
    # TEST 3: Admin, no patientId
    results.append(("TEST 3: Admin, no patientId -> 45 keys", test_3_admin_no_patient()))
    
    # Get admin cookie and real patient for remaining tests
    admin_cookie = login("admin@proactiveclinic.com", "apex123")
    if not admin_cookie:
        print("\n✗ CRITICAL: Could not login as admin, skipping remaining tests")
        sys.exit(1)
    
    patient_id = get_real_patient_id(admin_cookie)
    if not patient_id:
        print("\n✗ CRITICAL: Could not get real patient ID, skipping remaining tests")
        sys.exit(1)
    
    # TEST 4: Admin, real patientId
    results.append(("TEST 4: Admin, real patientId -> 45 keys", test_4_admin_real_patient(admin_cookie, patient_id)))
    
    # TEST 5: Download mode
    results.append(("TEST 5: Download mode -> raw payload", test_5_download_mode(admin_cookie, patient_id)))
    
    # TEST 6: Provider session
    results.append(("TEST 6: Provider session -> 200", test_6_provider_session()))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✓ ALL TESTS PASSED - NO HTTP 500 ERRORS ENCOUNTERED")
        print("✓ Payload has exactly 45 keys in exact order for all scenarios")
        print("✓ Security: UserEmail, MD5Password, LocationID masked in output")
        return 0
    else:
        print(f"\n✗ {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
