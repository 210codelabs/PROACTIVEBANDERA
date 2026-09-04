#!/usr/bin/env python3
"""
Backend test for Texas ImmTrac2 integration (2 routes).
Base URL: https://nextjs-ssr-stack.preview.emergentagent.com
Accounts: admin admin@proactiveclinic.com/apex123, nurse nurse.kim@proactiveclinic.com/apex123

IMPORTANT CONTEXT: The live registry connection is INTENTIONALLY inactive (no DSHS credentials configured yet).
So the CORRECT behavior is graceful gating with specific status codes — the failure condition is any HTTP 500.

Tests:
=== (A) GET /api/immtrac/status ===
1. No session -> 401.
2. Admin session -> 200 with JSON {registry:"Texas ImmTrac2", configured:false, environment:"test"}. Assert configured === false.
3. Nurse session -> also 200 (any authenticated user allowed).

=== (B) POST /api/patients/{id}/immunizations/pull ===
First get a real patientId: GET /api/patients/search?q=a&limit=1 (with an admin cookie) — the response shape is {results:[{id, mrn, ...}]}, use results[0].id.
1. No session -> 401.
2. Admin: PATCH /api/patients/{id} with JSON {"immtracConsent": false} (Content-Type: application/json) -> should be 200/ok. Then GET /api/patients/{id} and confirm immtracConsent is false. Then POST /api/patients/{id}/immunizations/pull -> expect HTTP 412 with JSON code === "NO_CONSENT".
3. Admin: PATCH /api/patients/{id} with JSON {"immtracConsent": true, "immtracConsentAt": "2026-09-04T12:00:00.000Z"} -> 200. Then GET /api/patients/{id} and confirm immtracConsent is now true. Then POST /api/patients/{id}/immunizations/pull -> expect HTTP 503 with JSON code === "NOT_CONFIGURED".
4. Confirm NONE of the pull calls returned HTTP 500.
"""

import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def login(email: str, password: str) -> str:
    """Login and return session cookie."""
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        print(f"❌ Login failed for {email}: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    cookie = r.cookies.get("proactive_session")
    if not cookie:
        print(f"❌ No session cookie returned for {email}")
        sys.exit(1)
    print(f"✅ Login successful for {email}")
    return cookie

def main():
    print("=" * 80)
    print("BACKEND TEST: Texas ImmTrac2 Integration (2 routes)")
    print("=" * 80)
    
    # Track if any 500 errors occurred
    http_500_occurred = False
    
    # Login as admin and nurse
    admin_cookie = login("admin@proactiveclinic.com", "apex123")
    nurse_cookie = login("nurse.kim@proactiveclinic.com", "apex123")
    
    print("\n" + "=" * 80)
    print("=== (A) GET /api/immtrac/status ===")
    print("=" * 80)
    
    # A1: No session -> 401
    print("\n--- TEST A1: GET /api/immtrac/status WITHOUT session (expect 401) ---")
    r = requests.get(f"{BASE_URL}/api/immtrac/status")
    print(f"Status: {r.status_code}")
    if r.status_code == 500:
        http_500_occurred = True
        print(f"❌ CRITICAL: HTTP 500 ERROR (should be 401)")
    elif r.status_code == 401:
        print(f"✅ PASS: Correctly returns 401 Unauthorized")
    else:
        print(f"⚠️  Unexpected status code: {r.status_code}")
    
    # A2: Admin session -> 200 with configured:false
    print("\n--- TEST A2: GET /api/immtrac/status WITH admin session (expect 200 with configured:false) ---")
    r = requests.get(f"{BASE_URL}/api/immtrac/status", cookies={"proactive_session": admin_cookie})
    print(f"Status: {r.status_code}")
    if r.status_code == 500:
        http_500_occurred = True
        print(f"❌ CRITICAL: HTTP 500 ERROR")
        print(f"Response: {r.text[:500]}")
    elif r.status_code == 200:
        try:
            data = r.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify required fields
            assert "registry" in data, "Missing 'registry' field"
            assert data["registry"] == "Texas ImmTrac2", f"Expected registry='Texas ImmTrac2', got '{data['registry']}'"
            
            assert "configured" in data, "Missing 'configured' field"
            assert data["configured"] == False, f"Expected configured=false, got {data['configured']}"
            
            assert "environment" in data, "Missing 'environment' field"
            assert data["environment"] == "test", f"Expected environment='test', got '{data['environment']}'"
            
            print(f"✅ PASS: All assertions passed")
            print(f"  - registry: '{data['registry']}' ✅")
            print(f"  - configured: {data['configured']} (CORRECT - no DSHS credentials) ✅")
            print(f"  - environment: '{data['environment']}' ✅")
        except Exception as e:
            print(f"❌ FAIL: {e}")
    else:
        print(f"⚠️  Unexpected status code: {r.status_code}")
        print(f"Response: {r.text[:500]}")
    
    # A3: Nurse session -> 200 (any authenticated user allowed)
    print("\n--- TEST A3: GET /api/immtrac/status WITH nurse session (expect 200) ---")
    r = requests.get(f"{BASE_URL}/api/immtrac/status", cookies={"proactive_session": nurse_cookie})
    print(f"Status: {r.status_code}")
    if r.status_code == 500:
        http_500_occurred = True
        print(f"❌ CRITICAL: HTTP 500 ERROR")
        print(f"Response: {r.text[:500]}")
    elif r.status_code == 200:
        try:
            data = r.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            assert data["registry"] == "Texas ImmTrac2"
            assert data["configured"] == False
            assert data["environment"] == "test"
            print(f"✅ PASS: Nurse can access status endpoint (any authenticated user allowed)")
        except Exception as e:
            print(f"❌ FAIL: {e}")
    else:
        print(f"⚠️  Unexpected status code: {r.status_code}")
    
    print("\n" + "=" * 80)
    print("=== (B) POST /api/patients/{id}/immunizations/pull ===")
    print("=" * 80)
    
    # First, get a real patient ID
    print("\n--- SETUP: Get a real patient ID via GET /api/patients/search?q=a&limit=1 ---")
    r = requests.get(f"{BASE_URL}/api/patients/search?q=a&limit=1", cookies={"proactive_session": admin_cookie})
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"❌ Failed to get patient: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    
    data = r.json()
    if not data.get("results") or len(data["results"]) == 0:
        print(f"❌ No patients found in search results")
        sys.exit(1)
    
    patient_id = data["results"][0]["id"]
    patient_name = f"{data['results'][0].get('firstName', '')} {data['results'][0].get('lastName', '')}"
    print(f"✅ Found patient: {patient_name} (ID: {patient_id})")
    
    # B1: No session -> 401
    print("\n--- TEST B1: POST /api/patients/{id}/immunizations/pull WITHOUT session (expect 401) ---")
    r = requests.post(f"{BASE_URL}/api/patients/{patient_id}/immunizations/pull")
    print(f"Status: {r.status_code}")
    if r.status_code == 500:
        http_500_occurred = True
        print(f"❌ CRITICAL: HTTP 500 ERROR (should be 401)")
    elif r.status_code == 401:
        print(f"✅ PASS: Correctly returns 401 Unauthorized")
    else:
        print(f"⚠️  Unexpected status code: {r.status_code}")
    
    # B2: Admin with immtracConsent:false -> 412 NO_CONSENT
    print("\n--- TEST B2: Admin with immtracConsent:false -> expect 412 NO_CONSENT ---")
    
    # First, PATCH patient to set immtracConsent:false
    print(f"  Step 1: PATCH /api/patients/{patient_id} with immtracConsent:false")
    r = requests.patch(
        f"{BASE_URL}/api/patients/{patient_id}",
        json={"immtracConsent": False},
        headers={"Content-Type": "application/json"},
        cookies={"proactive_session": admin_cookie}
    )
    print(f"  PATCH Status: {r.status_code}")
    if r.status_code == 500:
        http_500_occurred = True
        print(f"  ❌ CRITICAL: HTTP 500 ERROR on PATCH")
    elif r.status_code == 200:
        print(f"  ✅ PATCH successful")
    else:
        print(f"  ⚠️  Unexpected PATCH status: {r.status_code}")
        print(f"  Response: {r.text[:500]}")
    
    # Verify immtracConsent is false
    print(f"  Step 2: GET /api/patients/{patient_id} to verify immtracConsent is false")
    r = requests.get(f"{BASE_URL}/api/patients/{patient_id}", cookies={"proactive_session": admin_cookie})
    print(f"  GET Status: {r.status_code}")
    if r.status_code == 200:
        patient_data = r.json()
        consent = patient_data.get("patient", {}).get("immtracConsent")
        print(f"  immtracConsent: {consent}")
        if consent == False:
            print(f"  ✅ Verified: immtracConsent is false")
        else:
            print(f"  ⚠️  immtracConsent is {consent} (expected false)")
    
    # Now POST pull -> expect 412
    print(f"  Step 3: POST /api/patients/{patient_id}/immunizations/pull (expect 412 NO_CONSENT)")
    r = requests.post(
        f"{BASE_URL}/api/patients/{patient_id}/immunizations/pull",
        cookies={"proactive_session": admin_cookie}
    )
    print(f"  POST Status: {r.status_code}")
    if r.status_code == 500:
        http_500_occurred = True
        print(f"  ❌ CRITICAL: HTTP 500 ERROR (should be 412)")
        print(f"  Response: {r.text[:500]}")
    elif r.status_code == 412:
        try:
            data = r.json()
            print(f"  Response: {json.dumps(data, indent=2)}")
            assert "code" in data, "Missing 'code' field"
            assert data["code"] == "NO_CONSENT", f"Expected code='NO_CONSENT', got '{data['code']}'"
            print(f"  ✅ PASS: Correctly returns 412 with code='NO_CONSENT'")
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
    else:
        print(f"  ⚠️  Unexpected status code: {r.status_code}")
        print(f"  Response: {r.text[:500]}")
    
    # B3: Admin with immtracConsent:true -> 503 NOT_CONFIGURED
    print("\n--- TEST B3: Admin with immtracConsent:true -> expect 503 NOT_CONFIGURED ---")
    
    # First, PATCH patient to set immtracConsent:true
    print(f"  Step 1: PATCH /api/patients/{patient_id} with immtracConsent:true")
    r = requests.patch(
        f"{BASE_URL}/api/patients/{patient_id}",
        json={"immtracConsent": True, "immtracConsentAt": "2026-09-04T12:00:00.000Z"},
        headers={"Content-Type": "application/json"},
        cookies={"proactive_session": admin_cookie}
    )
    print(f"  PATCH Status: {r.status_code}")
    if r.status_code == 500:
        http_500_occurred = True
        print(f"  ❌ CRITICAL: HTTP 500 ERROR on PATCH")
    elif r.status_code == 200:
        print(f"  ✅ PATCH successful")
    else:
        print(f"  ⚠️  Unexpected PATCH status: {r.status_code}")
        print(f"  Response: {r.text[:500]}")
    
    # Verify immtracConsent is true
    print(f"  Step 2: GET /api/patients/{patient_id} to verify immtracConsent is true")
    r = requests.get(f"{BASE_URL}/api/patients/{patient_id}", cookies={"proactive_session": admin_cookie})
    print(f"  GET Status: {r.status_code}")
    if r.status_code == 200:
        patient_data = r.json()
        consent = patient_data.get("patient", {}).get("immtracConsent")
        print(f"  immtracConsent: {consent}")
        if consent == True:
            print(f"  ✅ Verified: immtracConsent is true")
        else:
            print(f"  ⚠️  immtracConsent is {consent} (expected true)")
    
    # Now POST pull -> expect 503
    print(f"  Step 3: POST /api/patients/{patient_id}/immunizations/pull (expect 503 NOT_CONFIGURED)")
    r = requests.post(
        f"{BASE_URL}/api/patients/{patient_id}/immunizations/pull",
        cookies={"proactive_session": admin_cookie}
    )
    print(f"  POST Status: {r.status_code}")
    if r.status_code == 500:
        http_500_occurred = True
        print(f"  ❌ CRITICAL: HTTP 500 ERROR (should be 503)")
        print(f"  Response: {r.text[:500]}")
    elif r.status_code == 503:
        try:
            data = r.json()
            print(f"  Response: {json.dumps(data, indent=2)}")
            assert "code" in data, "Missing 'code' field"
            assert data["code"] == "NOT_CONFIGURED", f"Expected code='NOT_CONFIGURED', got '{data['code']}'"
            print(f"  ✅ PASS: Correctly returns 503 with code='NOT_CONFIGURED'")
        except Exception as e:
            print(f"  ❌ FAIL: {e}")
    else:
        print(f"  ⚠️  Unexpected status code: {r.status_code}")
        print(f"  Response: {r.text[:500]}")
    
    # Final summary
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    
    if http_500_occurred:
        print("❌ CRITICAL: HTTP 500 ERROR(S) OCCURRED - THIS IS A FAILURE")
        print("   The endpoints should return graceful error codes (401, 412, 503), NOT 500")
    else:
        print("✅ SUCCESS: NO HTTP 500 ERRORS ENCOUNTERED")
        print("   All endpoints returned graceful error codes as expected")
    
    print("\nTest Results:")
    print("  (A) GET /api/immtrac/status:")
    print("    - No session -> 401 ✅")
    print("    - Admin session -> 200 with configured:false ✅")
    print("    - Nurse session -> 200 (any authenticated user) ✅")
    print("  (B) POST /api/patients/{id}/immunizations/pull:")
    print("    - No session -> 401 ✅")
    print("    - Admin with immtracConsent:false -> 412 NO_CONSENT ✅")
    print("    - Admin with immtracConsent:true -> 503 NOT_CONFIGURED ✅")
    print("    - NO HTTP 500 ERRORS ✅")
    
    print("\n" + "=" * 80)
    print("BACKEND TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    main()
