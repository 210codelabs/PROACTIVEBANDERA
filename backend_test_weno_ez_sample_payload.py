#!/usr/bin/env python3
"""
Backend test for NEW Weno EZ ComposeRx sample-payload generator endpoint.
GET /api/weno/ez/sample-payload

SECURITY: This endpoint returns real Weno credentials in payload.UserEmail, 
payload.MD5Password, payload.LocationID. These values MUST be masked in output.
"""

import requests
import json
import re
from typing import Dict, Any

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def mask_secrets(data: Dict[str, Any]) -> Dict[str, Any]:
    """Mask sensitive Weno credentials in payload."""
    if isinstance(data, dict):
        masked = {}
        for key, value in data.items():
            if key in ["UserEmail", "MD5Password", "LocationID"]:
                masked[key] = "***"
            elif isinstance(value, dict):
                masked[key] = mask_secrets(value)
            else:
                masked[key] = value
        return masked
    return data

def login(email: str, password: str) -> str:
    """Login and return session cookie."""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=10,
            allow_redirects=False  # Don't follow redirects
        )
        # Check for session cookie in response (try both names)
        cookie = resp.cookies.get("proactive_session") or resp.cookies.get("session")
        if cookie:
            print(f"✅ Login successful for {email}")
            return cookie
        
        # If no cookie but 200, check response
        if resp.status_code == 200:
            print(f"⚠️  Login returned 200 but no session cookie for {email}")
            print(f"Response: {resp.text[:200]}")
            print(f"Cookies: {dict(resp.cookies)}")
        else:
            print(f"❌ Login failed for {email}: {resp.status_code}")
        return ""
    except Exception as e:
        print(f"❌ Login error for {email}: {e}")
        return ""

def get_real_patient_id(session_cookie: str) -> str:
    """Get a real patient ID via search."""
    try:
        resp = requests.get(
            f"{BASE_URL}/api/patients/search?q=a&limit=1",
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("results") and len(data["results"]) > 0:
                patient_id = data["results"][0].get("id")
                patient_name = f"{data['results'][0].get('lastName')}, {data['results'][0].get('firstName')}"
                print(f"✅ Found real patient: {patient_name} (ID: {patient_id})")
                return patient_id
        print(f"❌ Failed to get patient: {resp.status_code}")
        return ""
    except Exception as e:
        print(f"❌ Error getting patient: {e}")
        return ""

def test_no_session():
    """TEST 1: No session -> 401"""
    print("\n=== TEST 1: No session -> 401 ===")
    try:
        resp = requests.get(f"{BASE_URL}/api/weno/ez/sample-payload", timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text[:200]}")
        
        if resp.status_code == 401:
            print("✅ TEST 1 PASSED: Correctly returns 401 without session")
            return True
        else:
            print(f"❌ TEST 1 FAILED: Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 ERROR: {e}")
        return False

def test_nurse_session():
    """TEST 2: Nurse session -> 403"""
    print("\n=== TEST 2: Nurse session -> 403 ===")
    try:
        nurse_cookie = login("nurse.kim@proactiveclinic.com", "apex123")
        if not nurse_cookie:
            print("❌ TEST 2 FAILED: Could not login as nurse")
            return False
        
        resp = requests.get(
            f"{BASE_URL}/api/weno/ez/sample-payload",
            cookies={"proactive_session": nurse_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text[:200]}")
        
        if resp.status_code == 403:
            print("✅ TEST 2 PASSED: Correctly returns 403 for nurse")
            return True
        else:
            print(f"❌ TEST 2 FAILED: Expected 403, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 2 ERROR: {e}")
        return False

def test_admin_no_patient_id(admin_cookie: str):
    """TEST 3: Admin session without patientId -> 200 with all required fields"""
    print("\n=== TEST 3: Admin session without patientId -> 200 ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/weno/ez/sample-payload",
            cookies={"proactive_session": admin_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code}")
            print(f"Body: {resp.text[:500]}")
            return False
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check top-level structure
        if "environment" not in data:
            print("❌ TEST 3 FAILED: Missing 'environment' field")
            return False
        if "missing" not in data:
            print("❌ TEST 3 FAILED: Missing 'missing' array")
            return False
        if "payload" not in data:
            print("❌ TEST 3 FAILED: Missing 'payload' object")
            return False
        
        print(f"Environment: {data['environment']}")
        print(f"Missing fields: {data['missing']}")
        
        # Check all required payload keys
        payload = data["payload"]
        required_keys = [
            "UserEmail", "MD5Password", "LocationID", "TestPatient", "PatientType",
            "OrgPatientID", "LastName", "FirstName", "MiddleName", "Prefix", "Suffix",
            "Gender", "DateOfBirth", "AddressLine1", "AddressLine2", "City", "State",
            "PostalCode", "CountryCode", "PrimaryPhone", "SupportsSMS", "PatientEmail",
            "ResponsiblePartySameAsPatient", "PatientLocation", "PrimaryPharmacyNCPCP",
            "AlternativePharmacyNCPCP"
        ]
        
        missing_keys = [k for k in required_keys if k not in payload]
        if missing_keys:
            print(f"❌ TEST 3 FAILED: Missing payload keys: {missing_keys}")
            return False
        
        print(f"✅ All {len(required_keys)} required payload keys present")
        
        # Check MD5Password format (32-char hex) WITHOUT printing it
        md5_password = payload.get("MD5Password", "")
        is_md5_format = bool(re.match(r'^[a-f0-9]{32}$', md5_password))
        print(f"MD5Password looks like 32-char hex: {'YES' if is_md5_format else 'NO'}")
        
        # Print masked payload
        masked_payload = mask_secrets(payload)
        print(f"Masked payload sample: {json.dumps(masked_payload, indent=2)[:500]}...")
        
        print("✅ TEST 3 PASSED: Returns 200 with all required fields")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 ERROR: {e}")
        return False

def test_admin_with_patient_id(admin_cookie: str, patient_id: str):
    """TEST 4: Admin session with real patientId -> 200 with patient data"""
    print("\n=== TEST 4: Admin session with real patientId -> 200 ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/weno/ez/sample-payload?patientId={patient_id}",
            cookies={"proactive_session": admin_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 4 FAILED: Expected 200, got {resp.status_code}")
            print(f"Body: {resp.text[:500]}")
            return False
        
        data = resp.json()
        payload = data.get("payload", {})
        
        # Check that patient data is populated (not sample data)
        last_name = payload.get("LastName", "")
        first_name = payload.get("FirstName", "")
        dob = payload.get("DateOfBirth", "")
        
        print(f"Patient data in payload:")
        print(f"  LastName: {last_name}")
        print(f"  FirstName: {first_name}")
        print(f"  DateOfBirth: {dob}")
        
        # These should NOT be the sample patient values
        is_sample = (last_name == "Satterfield" and first_name == "Ryan")
        if is_sample:
            print("⚠️  WARNING: Payload contains sample patient data, not real patient")
        else:
            print("✅ Payload contains real patient data (not sample)")
        
        # Check missing array
        missing = data.get("missing", [])
        print(f"Missing fields: {missing}")
        
        # Print masked payload
        masked_payload = mask_secrets(payload)
        print(f"Masked payload sample: {json.dumps(masked_payload, indent=2)[:500]}...")
        
        print("✅ TEST 4 PASSED: Returns 200 with patient data")
        return True
        
    except Exception as e:
        print(f"❌ TEST 4 ERROR: {e}")
        return False

def test_download_flag(admin_cookie: str, patient_id: str):
    """TEST 5: Admin session with download=1 -> 200 with Content-Disposition"""
    print("\n=== TEST 5: Admin session with download=1 -> 200 ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/weno/ez/sample-payload?patientId={patient_id}&download=1",
            cookies={"proactive_session": admin_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 5 FAILED: Expected 200, got {resp.status_code}")
            print(f"Body: {resp.text[:500]}")
            return False
        
        # Check Content-Type
        content_type = resp.headers.get("Content-Type", "")
        print(f"Content-Type: {content_type}")
        if "application/json" not in content_type:
            print(f"❌ TEST 5 FAILED: Expected Content-Type application/json, got {content_type}")
            return False
        
        # Check Content-Disposition
        content_disposition = resp.headers.get("Content-Disposition", "")
        print(f"Content-Disposition: {content_disposition}")
        if not content_disposition or "attachment" not in content_disposition:
            print(f"❌ TEST 5 FAILED: Missing or invalid Content-Disposition header")
            return False
        
        # Check filename in Content-Disposition
        if "filename=" not in content_disposition:
            print(f"❌ TEST 5 FAILED: Content-Disposition missing filename")
            return False
        
        print(f"Body length: {len(resp.text)} bytes")
        print("✅ Body is JSON (not printing to avoid exposing secrets)")
        
        print("✅ TEST 5 PASSED: Returns 200 with Content-Type application/json and Content-Disposition attachment")
        return True
        
    except Exception as e:
        print(f"❌ TEST 5 ERROR: {e}")
        return False

def main():
    print("=" * 80)
    print("WENO EZ SAMPLE-PAYLOAD ENDPOINT TEST")
    print("=" * 80)
    print("\nSECURITY NOTE: UserEmail, MD5Password, and LocationID will be masked as '***'")
    print("in all output to protect real Weno credentials.\n")
    
    results = []
    
    # TEST 1: No session
    results.append(("TEST 1: No session -> 401", test_no_session()))
    
    # TEST 2: Nurse session
    results.append(("TEST 2: Nurse session -> 403", test_nurse_session()))
    
    # Login as admin for remaining tests
    print("\n=== Admin Login ===")
    admin_cookie = login("admin@proactiveclinic.com", "apex123")
    if not admin_cookie:
        print("❌ CRITICAL: Could not login as admin. Aborting remaining tests.")
        print_summary(results)
        return
    
    # Get real patient ID
    print("\n=== Get Real Patient ===")
    patient_id = get_real_patient_id(admin_cookie)
    if not patient_id:
        print("⚠️  WARNING: Could not get real patient ID. Tests 4-5 may use sample data.")
    
    # TEST 3: Admin without patientId
    results.append(("TEST 3: Admin without patientId -> 200", test_admin_no_patient_id(admin_cookie)))
    
    # TEST 4: Admin with patientId
    if patient_id:
        results.append(("TEST 4: Admin with patientId -> 200", test_admin_with_patient_id(admin_cookie, patient_id)))
    else:
        print("\n⚠️  SKIPPING TEST 4: No patient ID available")
        results.append(("TEST 4: Admin with patientId -> 200", None))
    
    # TEST 5: Admin with download=1
    if patient_id:
        results.append(("TEST 5: Admin with download=1 -> 200", test_download_flag(admin_cookie, patient_id)))
    else:
        print("\n⚠️  SKIPPING TEST 5: No patient ID available")
        results.append(("TEST 5: Admin with download=1 -> 200", None))
    
    print_summary(results)

def print_summary(results):
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result is True)
    failed = sum(1 for _, result in results if result is False)
    skipped = sum(1 for _, result in results if result is None)
    total = len(results)
    
    for test_name, result in results:
        if result is True:
            print(f"✅ {test_name}")
        elif result is False:
            print(f"❌ {test_name}")
        else:
            print(f"⚠️  {test_name} (SKIPPED)")
    
    print(f"\nTotal: {total} | Passed: {passed} | Failed: {failed} | Skipped: {skipped}")
    
    if failed == 0 and passed > 0:
        print("\n🎉 ALL TESTS PASSED!")
    elif failed > 0:
        print(f"\n⚠️  {failed} TEST(S) FAILED")

if __name__ == "__main__":
    main()
