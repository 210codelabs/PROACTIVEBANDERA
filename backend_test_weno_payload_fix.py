#!/usr/bin/env python3
"""
Backend test for Weno payload datatype fix: buildPrescriptionPayload now OMITS
empty optional fields (Weno's validator rejects empty strings "" for datatypes
an1..N and MailAddressType). Required fields are always present; optional fields
appear only when non-empty.

Base URL: https://nextjs-ssr-stack.preview.emergentagent.com
Admin login: POST /api/auth/login {email:"admin@proactivemedclinic.com", password:"apex123"}
Get a real patientId via GET /api/patients/search?q=a&limit=1 (with staff cookie).
SECURITY: mask UserEmail, MD5Password, LocationID, and the `data=` value in output.

TESTS (no HTTP 500 allowed):
1) First ensure the test patient has NO pharmacy set: PATCH /api/patients/<id> with {"primaryPharmacyNcpdp":"","alternativePharmacyNcpdp":""} -> 200.
2) GET /api/weno/sso-payload/<id> as admin -> 200. The body is the raw payload object. Assert:
   (a) NO value in the payload is an empty string — iterate all entries and confirm every value has length > 0. List any keys whose value is "" (should be NONE).
   (b) These REQUIRED keys are PRESENT: UserEmail, MD5Password, LocationID, TestPatient, PatientType, OrgPatientID, LastName, FirstName, Gender, DateOfBirth, AddressLine1, City, State, PostalCode, CountryCode, PrimaryPhone, SupportsSMS, ResponsiblePartySameAsPatient, PatientLocation.
   (c) Because the patient has no pharmacy, keys PrimaryPharmacyNCPCP and AlternativePharmacyNCPCP must be ABSENT (not present at all).
   (d) Report which optional keys are present vs absent (MiddleName, Prefix, Suffix, AddressLine2, PatientEmail).
3) Set a pharmacy: PATCH /api/patients/<id> {"primaryPharmacyNcpdp":"1234567"} -> 200. Then GET /api/weno/sso-payload/<id> -> 200 and assert PrimaryPharmacyNCPCP=="1234567" is now PRESENT, and AlternativePharmacyNCPCP still ABSENT.
4) GET /api/weno/ez/sample-payload (admin, no patientId) -> 200 {environment,missing,payload}. The Weno SAMPLE patient has values for all fields, so assert the payload still contains MiddleName, Prefix, Suffix, AddressLine2, PatientEmail, PrimaryPharmacyNCPCP, AlternativePharmacyNCPCP (all non-empty). Assert no empty-string values.
5) GET /api/weno/iframe-url/<id> as admin -> 200 with { iframeUrl } starting with "https://online.wenoexchange.com/en/NewRx/ComposeRx?useremail=" (do not print data value). Confirm no 500.

Report each step: status, pass/fail, list of any empty-string keys (should be none), and which optional keys were present/absent. Confirm NO HTTP 500 anywhere.
"""

import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Security: mask these fields in output
MASKED_FIELDS = ["UserEmail", "MD5Password", "LocationID"]

def mask_value(key, value):
    """Mask sensitive fields for security."""
    if key in MASKED_FIELDS:
        return "***MASKED***"
    return value

def mask_payload(payload):
    """Return a masked copy of the payload for safe printing."""
    return {k: mask_value(k, v) for k, v in payload.items()}

def print_test(step, message):
    """Print test step header."""
    print(f"\n{'='*80}")
    print(f"TEST {step}: {message}")
    print('='*80)

def main():
    print("="*80)
    print("WENO PAYLOAD DATATYPE FIX TEST")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("SECURITY: UserEmail, MD5Password, LocationID, and data= values will be masked")
    print()

    # -------------------------------------------------------------------------
    # SETUP: Login as admin
    # -------------------------------------------------------------------------
    print_test("SETUP", "Login as admin@proactiveclinic.com")
    
    login_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@proactiveclinic.com", "password": "apex123"},
        timeout=30
    )
    
    if login_resp.status_code != 200:
        print(f"❌ SETUP FAILED: Login returned {login_resp.status_code}")
        print(f"Response: {login_resp.text[:500]}")
        sys.exit(1)
    
    admin_cookie = login_resp.cookies
    print(f"✅ Admin login successful (status: {login_resp.status_code})")
    
    # -------------------------------------------------------------------------
    # SETUP: Get a real patient ID
    # -------------------------------------------------------------------------
    print("\nSETUP: Get a real patient ID via GET /api/patients/search?q=a&limit=1")
    
    search_resp = requests.get(
        f"{BASE_URL}/api/patients/search",
        params={"q": "a", "limit": "1"},
        cookies=admin_cookie,
        timeout=30
    )
    
    if search_resp.status_code != 200:
        print(f"❌ SETUP FAILED: Patient search returned {search_resp.status_code}")
        print(f"Response: {search_resp.text[:500]}")
        sys.exit(1)
    
    search_data = search_resp.json()
    
    # Handle different response formats
    if isinstance(search_data, dict) and "results" in search_data:
        patients = search_data["results"]
    elif isinstance(search_data, list):
        patients = search_data
    else:
        print(f"❌ SETUP FAILED: Unexpected response format: {type(search_data)}")
        print(f"Response keys: {list(search_data.keys()) if isinstance(search_data, dict) else 'not a dict'}")
        sys.exit(1)
    
    if not patients or len(patients) == 0:
        print("❌ SETUP FAILED: No patients found")
        sys.exit(1)
    
    patient_id = patients[0]["id"]
    patient_name = f"{patients[0].get('firstName', '')} {patients[0].get('lastName', '')}"
    print(f"✅ Found patient: {patient_name} (ID: {patient_id})")
    
    # -------------------------------------------------------------------------
    # TEST 1: Clear pharmacy fields and verify they are ABSENT from payload
    # -------------------------------------------------------------------------
    print_test("1", "Clear pharmacy fields and verify ABSENT from payload")
    
    # Step 1a: Clear pharmacy fields
    print("\nStep 1a: PATCH /api/patients/{id} to clear pharmacy fields")
    patch_resp = requests.patch(
        f"{BASE_URL}/api/patients/{patient_id}",
        json={"primaryPharmacyNcpdp": "", "alternativePharmacyNcpdp": ""},
        cookies=admin_cookie,
        timeout=30
    )
    
    if patch_resp.status_code != 200:
        print(f"❌ TEST 1a FAILED: PATCH returned {patch_resp.status_code}")
        print(f"Response: {patch_resp.text[:500]}")
        sys.exit(1)
    
    print(f"✅ PATCH successful (status: {patch_resp.status_code})")
    
    # Step 1b: Get SSO payload and verify no empty strings
    print("\nStep 1b: GET /api/weno/sso-payload/{id} and verify payload structure")
    sso_resp = requests.get(
        f"{BASE_URL}/api/weno/sso-payload/{patient_id}",
        cookies=admin_cookie,
        timeout=30
    )
    
    if sso_resp.status_code != 200:
        print(f"❌ TEST 1b FAILED: GET sso-payload returned {sso_resp.status_code}")
        print(f"Response: {sso_resp.text[:500]}")
        sys.exit(1)
    
    payload = sso_resp.json()
    print(f"✅ GET sso-payload successful (status: {sso_resp.status_code})")
    print(f"Payload has {len(payload)} keys")
    
    # Assertion (a): NO empty strings in payload
    print("\nAssertion (a): Verify NO empty strings in payload")
    empty_keys = [k for k, v in payload.items() if v == ""]
    if empty_keys:
        print(f"❌ FAILED: Found {len(empty_keys)} keys with empty string values:")
        for k in empty_keys:
            print(f"  - {k}")
        sys.exit(1)
    print("✅ PASSED: NO empty string values found in payload")
    
    # Assertion (b): Required keys are PRESENT
    print("\nAssertion (b): Verify REQUIRED keys are PRESENT")
    required_keys = [
        "UserEmail", "MD5Password", "LocationID", "TestPatient", "PatientType",
        "OrgPatientID", "LastName", "FirstName", "Gender", "DateOfBirth",
        "AddressLine1", "City", "State", "PostalCode", "CountryCode",
        "PrimaryPhone", "SupportsSMS", "ResponsiblePartySameAsPatient", "PatientLocation"
    ]
    missing_required = [k for k in required_keys if k not in payload]
    if missing_required:
        print(f"❌ FAILED: Missing {len(missing_required)} required keys:")
        for k in missing_required:
            print(f"  - {k}")
        sys.exit(1)
    print(f"✅ PASSED: All {len(required_keys)} required keys are PRESENT")
    
    # Assertion (c): Pharmacy keys must be ABSENT
    print("\nAssertion (c): Verify pharmacy keys are ABSENT (patient has no pharmacy)")
    pharmacy_keys = ["PrimaryPharmacyNCPCP", "AlternativePharmacyNCPCP"]
    present_pharmacy = [k for k in pharmacy_keys if k in payload]
    if present_pharmacy:
        print(f"❌ FAILED: Found {len(present_pharmacy)} pharmacy keys that should be ABSENT:")
        for k in present_pharmacy:
            print(f"  - {k} = {payload[k]}")
        sys.exit(1)
    print("✅ PASSED: Pharmacy keys are ABSENT (correctly omitted)")
    
    # Assertion (d): Report optional keys present/absent
    print("\nAssertion (d): Report optional keys present vs absent")
    optional_keys = ["MiddleName", "Prefix", "Suffix", "AddressLine2", "PatientEmail"]
    present_optional = [k for k in optional_keys if k in payload]
    absent_optional = [k for k in optional_keys if k not in payload]
    print(f"Optional keys PRESENT ({len(present_optional)}):")
    for k in present_optional:
        print(f"  - {k} = '{mask_value(k, payload[k])}'")
    print(f"Optional keys ABSENT ({len(absent_optional)}):")
    for k in absent_optional:
        print(f"  - {k}")
    
    print("\n✅ TEST 1 PASSED: Payload correctly OMITS empty optional fields")
    
    # -------------------------------------------------------------------------
    # TEST 2: Set pharmacy and verify it appears in payload
    # -------------------------------------------------------------------------
    print_test("2", "Set pharmacy and verify it appears in payload")
    
    # Step 2a: Set primary pharmacy
    print("\nStep 2a: PATCH /api/patients/{id} to set primaryPharmacyNcpdp='1234567'")
    patch_resp = requests.patch(
        f"{BASE_URL}/api/patients/{patient_id}",
        json={"primaryPharmacyNcpdp": "1234567"},
        cookies=admin_cookie,
        timeout=30
    )
    
    if patch_resp.status_code != 200:
        print(f"❌ TEST 2a FAILED: PATCH returned {patch_resp.status_code}")
        print(f"Response: {patch_resp.text[:500]}")
        sys.exit(1)
    
    print(f"✅ PATCH successful (status: {patch_resp.status_code})")
    
    # Step 2b: Get SSO payload and verify pharmacy is present
    print("\nStep 2b: GET /api/weno/sso-payload/{id} and verify PrimaryPharmacyNCPCP present")
    sso_resp = requests.get(
        f"{BASE_URL}/api/weno/sso-payload/{patient_id}",
        cookies=admin_cookie,
        timeout=30
    )
    
    if sso_resp.status_code != 200:
        print(f"❌ TEST 2b FAILED: GET sso-payload returned {sso_resp.status_code}")
        print(f"Response: {sso_resp.text[:500]}")
        sys.exit(1)
    
    payload = sso_resp.json()
    print(f"✅ GET sso-payload successful (status: {sso_resp.status_code})")
    
    # Verify PrimaryPharmacyNCPCP is present and correct
    if "PrimaryPharmacyNCPCP" not in payload:
        print("❌ FAILED: PrimaryPharmacyNCPCP is ABSENT (should be PRESENT)")
        sys.exit(1)
    
    if payload["PrimaryPharmacyNCPCP"] != "1234567":
        print(f"❌ FAILED: PrimaryPharmacyNCPCP = '{payload['PrimaryPharmacyNCPCP']}' (expected '1234567')")
        sys.exit(1)
    
    print(f"✅ PASSED: PrimaryPharmacyNCPCP = '1234567' (correctly PRESENT)")
    
    # Verify AlternativePharmacyNCPCP is still ABSENT
    if "AlternativePharmacyNCPCP" in payload:
        print(f"❌ FAILED: AlternativePharmacyNCPCP is PRESENT (should be ABSENT): '{payload['AlternativePharmacyNCPCP']}'")
        sys.exit(1)
    
    print("✅ PASSED: AlternativePharmacyNCPCP is ABSENT (correctly omitted)")
    
    # Verify no empty strings
    empty_keys = [k for k, v in payload.items() if v == ""]
    if empty_keys:
        print(f"❌ FAILED: Found {len(empty_keys)} keys with empty string values:")
        for k in empty_keys:
            print(f"  - {k}")
        sys.exit(1)
    print("✅ PASSED: NO empty string values in payload")
    
    print("\n✅ TEST 2 PASSED: Pharmacy field correctly appears when set")
    
    # -------------------------------------------------------------------------
    # TEST 3: Sample payload has all optional fields (Weno sample patient)
    # -------------------------------------------------------------------------
    print_test("3", "Sample payload has all optional fields (Weno sample patient)")
    
    print("\nGET /api/weno/ez/sample-payload (no patientId)")
    sample_resp = requests.get(
        f"{BASE_URL}/api/weno/ez/sample-payload",
        cookies=admin_cookie,
        timeout=30
    )
    
    if sample_resp.status_code != 200:
        print(f"❌ TEST 3 FAILED: GET sample-payload returned {sample_resp.status_code}")
        print(f"Response: {sample_resp.text[:500]}")
        sys.exit(1)
    
    sample_data = sample_resp.json()
    print(f"✅ GET sample-payload successful (status: {sample_resp.status_code})")
    
    # Verify response structure
    if "environment" not in sample_data or "missing" not in sample_data or "payload" not in sample_data:
        print("❌ FAILED: Response missing required keys (environment, missing, payload)")
        print(f"Keys present: {list(sample_data.keys())}")
        sys.exit(1)
    
    print(f"✅ Response has correct structure: environment='{sample_data['environment']}', missing={sample_data['missing']}")
    
    sample_payload = sample_data["payload"]
    print(f"Sample payload has {len(sample_payload)} keys")
    
    # Verify Weno sample patient has all optional fields
    expected_optional = [
        "MiddleName", "Prefix", "Suffix", "AddressLine2", "PatientEmail",
        "PrimaryPharmacyNCPCP", "AlternativePharmacyNCPCP"
    ]
    missing_optional = [k for k in expected_optional if k not in sample_payload]
    if missing_optional:
        print(f"❌ FAILED: Sample payload missing {len(missing_optional)} expected optional fields:")
        for k in missing_optional:
            print(f"  - {k}")
        sys.exit(1)
    
    print(f"✅ PASSED: All {len(expected_optional)} expected optional fields are PRESENT in sample payload")
    
    # Verify no empty strings
    empty_keys = [k for k, v in sample_payload.items() if v == ""]
    if empty_keys:
        print(f"❌ FAILED: Found {len(empty_keys)} keys with empty string values:")
        for k in empty_keys:
            print(f"  - {k}")
        sys.exit(1)
    print("✅ PASSED: NO empty string values in sample payload")
    
    # Print sample of optional field values (masked)
    print("\nSample optional field values:")
    for k in expected_optional:
        print(f"  - {k} = '{mask_value(k, sample_payload[k])}'")
    
    print("\n✅ TEST 3 PASSED: Sample payload has all optional fields with non-empty values")
    
    # -------------------------------------------------------------------------
    # TEST 4: iframe-url endpoint returns 200 with valid URL
    # -------------------------------------------------------------------------
    print_test("4", "iframe-url endpoint returns 200 with valid URL")
    
    print(f"\nGET /api/weno/iframe-url/{patient_id}")
    iframe_resp = requests.get(
        f"{BASE_URL}/api/weno/iframe-url/{patient_id}",
        cookies=admin_cookie,
        timeout=30
    )
    
    if iframe_resp.status_code != 200:
        print(f"❌ TEST 4 FAILED: GET iframe-url returned {iframe_resp.status_code}")
        print(f"Response: {iframe_resp.text[:500]}")
        sys.exit(1)
    
    iframe_data = iframe_resp.json()
    print(f"✅ GET iframe-url successful (status: {iframe_resp.status_code})")
    
    # Verify response has iframeUrl
    if "iframeUrl" not in iframe_data:
        print("❌ FAILED: Response missing 'iframeUrl' key")
        print(f"Keys present: {list(iframe_data.keys())}")
        sys.exit(1)
    
    iframe_url = iframe_data["iframeUrl"]
    
    # Verify URL starts with expected base
    expected_start = "https://online.wenoexchange.com/en/NewRx/ComposeRx?useremail="
    if not iframe_url.startswith(expected_start):
        print(f"❌ FAILED: iframeUrl does not start with expected base")
        print(f"Expected start: {expected_start}")
        print(f"Actual start: {iframe_url[:len(expected_start)]}")
        sys.exit(1)
    
    print(f"✅ PASSED: iframeUrl starts with '{expected_start}'")
    
    # Verify URL contains data parameter (but don't print it)
    if "&data=" not in iframe_url:
        print("❌ FAILED: iframeUrl missing '&data=' parameter")
        sys.exit(1)
    
    print("✅ PASSED: iframeUrl contains '&data=' parameter (encrypted payload)")
    
    # Print URL with data masked
    if "&data=" in iframe_url:
        url_parts = iframe_url.split("&data=")
        masked_url = url_parts[0] + "&data=***MASKED***"
        print(f"\niframeUrl (data masked): {masked_url}")
    
    print("\n✅ TEST 4 PASSED: iframe-url endpoint working correctly")
    
    # -------------------------------------------------------------------------
    # CLEANUP: Clear pharmacy field
    # -------------------------------------------------------------------------
    print_test("CLEANUP", "Clear pharmacy field")
    
    patch_resp = requests.patch(
        f"{BASE_URL}/api/patients/{patient_id}",
        json={"primaryPharmacyNcpdp": ""},
        cookies=admin_cookie,
        timeout=30
    )
    
    if patch_resp.status_code == 200:
        print("✅ Cleanup successful: pharmacy field cleared")
    else:
        print(f"⚠️  Cleanup warning: PATCH returned {patch_resp.status_code}")
    
    # -------------------------------------------------------------------------
    # FINAL SUMMARY
    # -------------------------------------------------------------------------
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    print("✅ ALL TESTS PASSED")
    print()
    print("Test Results:")
    print("  ✅ TEST 1: Payload correctly OMITS empty optional fields")
    print("  ✅ TEST 2: Pharmacy field correctly appears when set")
    print("  ✅ TEST 3: Sample payload has all optional fields with non-empty values")
    print("  ✅ TEST 4: iframe-url endpoint working correctly")
    print()
    print("Critical Assertions:")
    print("  ✅ NO empty string values found in any payload")
    print("  ✅ Required fields always PRESENT")
    print("  ✅ Optional fields ABSENT when empty, PRESENT when non-empty")
    print("  ✅ Pharmacy fields correctly omitted/included based on patient data")
    print("  ✅ NO HTTP 500 errors encountered")
    print()
    print("Security:")
    print("  ✅ UserEmail, MD5Password, LocationID masked in output")
    print("  ✅ Encrypted data= parameter masked in output")
    print()
    print("="*80)
    print("WENO PAYLOAD DATATYPE FIX VERIFIED ✅")
    print("="*80)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
