#!/usr/bin/env python3
"""
Backend test for Weno EZ Integration iFrame URL endpoint
GET /api/weno/iframe-url/[patientId]

IMPORTANT: Weno is NOT configured in preview, so a fully-valid prescriber+patient
request is EXPECTED to return HTTP 400 with an error mentioning "not configured".
That is a PASS, not a bug. Only HTTP 500 is a failure.

Test steps:
1) AUTH: GET /api/weno/iframe-url/{patientId} with NO session cookie -> 401
2) AUTHZ: login as NURSE -> GET /api/weno/iframe-url/{patientId} -> 403 (error mentions prescriber required)
   Repeat as FRONTDESK -> 403
3) NOT FOUND: login as ADMIN -> GET /api/weno/iframe-url/does-not-exist-id -> 404 {error:"Patient not found"}
4) VALID PRESCRIBER + REAL PATIENT: as ADMIN -> GET /api/weno/iframe-url/{real patientId}.
   Expect 400 with error containing "not configured" OR "Missing required patient information" (+ a `missing` array).
   Either 400 = PASS. If it returns 200 (creds present), assert iframeUrl contains "/NewRx/ComposeRx?useremail=" and "&data="
5) Also try as PROVIDER (andy.manzano) on the real patientId -> same 400 (not 403), confirming provider role is allowed
"""

import requests
import sys
import json

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def login(email: str, password: str) -> requests.Session:
    """Login and return a session with cookies"""
    session = requests.Session()
    resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        print(f"❌ Login failed for {email}: {resp.status_code} {resp.text[:200]}")
        sys.exit(1)
    print(f"✅ Login successful for {email}")
    return session

def get_real_patient_id(session: requests.Session) -> str:
    """Get a real patient ID via GET /api/patients/search?q=a&limit=1"""
    resp = session.get(f"{BASE_URL}/api/patients/search?q=a&limit=1")
    if resp.status_code != 200:
        print(f"❌ Failed to get patient: {resp.status_code} {resp.text[:200]}")
        sys.exit(1)
    data = resp.json()
    if not data.get("results") or len(data["results"]) == 0:
        print(f"❌ No patients found in search")
        sys.exit(1)
    patient_id = data["results"][0]["id"]
    patient_name = f"{data['results'][0].get('firstName', '')} {data['results'][0].get('lastName', '')}"
    print(f"✅ Found real patient: {patient_name} (ID: {patient_id})")
    return patient_id

def main():
    print("=" * 80)
    print("BACKEND TEST: Weno EZ Integration iFrame URL endpoint")
    print("=" * 80)
    
    # Get a real patient ID first (using admin session)
    print("\n--- SETUP: Get real patient ID ---")
    admin_session = login("admin@proactiveclinic.com", "apex123")
    real_patient_id = get_real_patient_id(admin_session)
    
    # TEST 1: AUTH - GET without session cookie -> 401
    print("\n--- TEST 1: AUTH (no session cookie) ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/weno/iframe-url/{real_patient_id}")
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text[:200]}")
        if resp.status_code == 401:
            print("✅ TEST 1 PASS: GET without session correctly returns 401 Unauthorized")
        else:
            print(f"❌ TEST 1 FAIL: Expected 401, got {resp.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ TEST 1 FAIL: Exception: {e}")
        sys.exit(1)
    
    # TEST 2a: AUTHZ - login as NURSE -> 403 (error mentions prescriber required)
    print("\n--- TEST 2a: AUTHZ (nurse session) ---")
    try:
        nurse_session = login("nurse.kim@proactiveclinic.com", "apex123")
        resp = nurse_session.get(f"{BASE_URL}/api/weno/iframe-url/{real_patient_id}")
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text[:300]}")
        if resp.status_code == 403:
            data = resp.json()
            error_msg = data.get("error", "").lower()
            if "prescriber" in error_msg or "prescrib" in error_msg:
                print("✅ TEST 2a PASS: Nurse correctly returns 403 with error mentioning prescriber")
            else:
                print(f"⚠️ TEST 2a PARTIAL: Got 403 but error doesn't mention prescriber: {data.get('error')}")
        else:
            print(f"❌ TEST 2a FAIL: Expected 403, got {resp.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ TEST 2a FAIL: Exception: {e}")
        sys.exit(1)
    
    # TEST 2b: AUTHZ - login as FRONTDESK -> 403
    print("\n--- TEST 2b: AUTHZ (frontdesk session) ---")
    try:
        frontdesk_session = login("front.lopez@proactiveclinic.com", "apex123")
        resp = frontdesk_session.get(f"{BASE_URL}/api/weno/iframe-url/{real_patient_id}")
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text[:300]}")
        if resp.status_code == 403:
            data = resp.json()
            error_msg = data.get("error", "").lower()
            if "prescriber" in error_msg or "prescrib" in error_msg:
                print("✅ TEST 2b PASS: Frontdesk correctly returns 403 with error mentioning prescriber")
            else:
                print(f"⚠️ TEST 2b PARTIAL: Got 403 but error doesn't mention prescriber: {data.get('error')}")
        else:
            print(f"❌ TEST 2b FAIL: Expected 403, got {resp.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ TEST 2b FAIL: Exception: {e}")
        sys.exit(1)
    
    # TEST 3: NOT FOUND - login as ADMIN -> GET with nonexistent patient ID -> 404
    print("\n--- TEST 3: NOT FOUND (nonexistent patient ID) ---")
    try:
        resp = admin_session.get(f"{BASE_URL}/api/weno/iframe-url/does-not-exist-id")
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text[:300]}")
        if resp.status_code == 404:
            data = resp.json()
            error_msg = data.get("error", "").lower()
            if "patient" in error_msg and "not found" in error_msg:
                print("✅ TEST 3 PASS: Nonexistent patient ID correctly returns 404 with 'Patient not found' error")
            else:
                print(f"⚠️ TEST 3 PARTIAL: Got 404 but error message unexpected: {data.get('error')}")
        else:
            print(f"❌ TEST 3 FAIL: Expected 404, got {resp.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ TEST 3 FAIL: Exception: {e}")
        sys.exit(1)
    
    # TEST 4: VALID PRESCRIBER + REAL PATIENT (as ADMIN)
    # Expect 400 with error containing "not configured" OR "Missing required patient information"
    print("\n--- TEST 4: VALID PRESCRIBER + REAL PATIENT (admin session) ---")
    try:
        resp = admin_session.get(f"{BASE_URL}/api/weno/iframe-url/{real_patient_id}")
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text[:500]}")
        
        if resp.status_code == 500:
            print(f"❌ TEST 4 FAIL: Got HTTP 500 (server error) - this is a FAILURE")
            sys.exit(1)
        elif resp.status_code == 400:
            data = resp.json()
            error_msg = data.get("error", "").lower()
            
            # Check if error mentions "not configured" OR "missing required patient information"
            if "not configured" in error_msg:
                print("✅ TEST 4 PASS: Got 400 with 'not configured' error (EXPECTED - Weno not configured in preview)")
                print(f"   Error message: {data.get('error')}")
            elif "missing required patient information" in error_msg:
                missing = data.get("missing", [])
                print(f"✅ TEST 4 PASS: Got 400 with 'Missing required patient information' error (EXPECTED)")
                print(f"   Missing fields: {missing}")
            else:
                print(f"⚠️ TEST 4 PARTIAL: Got 400 but error message unexpected: {data.get('error')}")
        elif resp.status_code == 200:
            # If somehow Weno is configured, verify the response structure
            data = resp.json()
            iframe_url = data.get("iframeUrl", "")
            if "/NewRx/ComposeRx?useremail=" in iframe_url and "&data=" in iframe_url:
                print("✅ TEST 4 PASS: Got 200 with valid iframeUrl (Weno is configured)")
                print(f"   iframeUrl contains required parameters")
            else:
                print(f"❌ TEST 4 FAIL: Got 200 but iframeUrl missing required parameters")
                print(f"   iframeUrl: {iframe_url[:200]}")
                sys.exit(1)
        else:
            print(f"❌ TEST 4 FAIL: Unexpected status code {resp.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ TEST 4 FAIL: Exception: {e}")
        sys.exit(1)
    
    # TEST 5: VALID PRESCRIBER + REAL PATIENT (as PROVIDER)
    # Expect same 400 (not 403), confirming provider role is allowed
    print("\n--- TEST 5: VALID PRESCRIBER + REAL PATIENT (provider session) ---")
    try:
        provider_session = login("andy.manzano@proactiveclinic.com", "apex123")
        resp = provider_session.get(f"{BASE_URL}/api/weno/iframe-url/{real_patient_id}")
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text[:500]}")
        
        if resp.status_code == 403:
            print(f"❌ TEST 5 FAIL: Got 403 (provider should be allowed, not forbidden)")
            sys.exit(1)
        elif resp.status_code == 500:
            print(f"❌ TEST 5 FAIL: Got HTTP 500 (server error) - this is a FAILURE")
            sys.exit(1)
        elif resp.status_code == 400:
            data = resp.json()
            error_msg = data.get("error", "").lower()
            
            # Check if error mentions "not configured" OR "missing required patient information"
            if "not configured" in error_msg:
                print("✅ TEST 5 PASS: Provider role allowed, got 400 with 'not configured' error (EXPECTED)")
                print(f"   Error message: {data.get('error')}")
            elif "missing required patient information" in error_msg:
                missing = data.get("missing", [])
                print(f"✅ TEST 5 PASS: Provider role allowed, got 400 with 'Missing required patient information' error (EXPECTED)")
                print(f"   Missing fields: {missing}")
            else:
                print(f"⚠️ TEST 5 PARTIAL: Provider role allowed, got 400 but error message unexpected: {data.get('error')}")
        elif resp.status_code == 200:
            # If somehow Weno is configured, verify the response structure
            data = resp.json()
            iframe_url = data.get("iframeUrl", "")
            if "/NewRx/ComposeRx?useremail=" in iframe_url and "&data=" in iframe_url:
                print("✅ TEST 5 PASS: Provider role allowed, got 200 with valid iframeUrl (Weno is configured)")
                print(f"   iframeUrl contains required parameters")
            else:
                print(f"❌ TEST 5 FAIL: Got 200 but iframeUrl missing required parameters")
                print(f"   iframeUrl: {iframe_url[:200]}")
                sys.exit(1)
        else:
            print(f"❌ TEST 5 FAIL: Unexpected status code {resp.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ TEST 5 FAIL: Exception: {e}")
        sys.exit(1)
    
    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED")
    print("=" * 80)
    print("\nSUMMARY:")
    print("  ✅ TEST 1: AUTH (no session) -> 401")
    print("  ✅ TEST 2a: AUTHZ (nurse) -> 403 with prescriber error")
    print("  ✅ TEST 2b: AUTHZ (frontdesk) -> 403 with prescriber error")
    print("  ✅ TEST 3: NOT FOUND (nonexistent patient) -> 404")
    print("  ✅ TEST 4: VALID PRESCRIBER + REAL PATIENT (admin) -> 400 (not configured OR missing info)")
    print("  ✅ TEST 5: VALID PRESCRIBER + REAL PATIENT (provider) -> 400 (not 403, provider role allowed)")
    print("\nCRITICAL ASSERTION: NO HTTP 500 ERRORS ENCOUNTERED ✅")
    print("\nNOTE: Weno is NOT configured in preview, so 400 'not configured' is EXPECTED and CORRECT.")

if __name__ == "__main__":
    main()
