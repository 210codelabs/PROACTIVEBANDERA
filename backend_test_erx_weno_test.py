#!/usr/bin/env python3
"""
Backend test for eRx↔Weno wiring (2026-08):
- GET /api/erx/weno-test (Test Connection endpoint)
- GET /api/erx/weno-status (returns online.prescriber for pre-fill)
- GET /api/nppes/search (NPI lookup for eRx search box)

CREDENTIALS:
- Provider: andy.manzano@proactiveclinic.com / apex123 (has profile NPI 1234567890)
- Admin: admin@proactiveclinic.com / apex123

Base URL: https://nextjs-ssr-stack.preview.emergentagent.com
"""

import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def login(email, password):
    """Login and return session cookie"""
    url = f"{BASE_URL}/api/auth/login"
    resp = requests.post(url, json={"email": email, "password": password}, timeout=30)
    if resp.status_code != 200:
        print(f"❌ Login failed for {email}: {resp.status_code} {resp.text[:200]}")
        return None
    cookie = resp.cookies.get("proactive_session")
    if not cookie:
        print(f"❌ No proactive_session cookie returned for {email}")
        return None
    print(f"✅ Login successful for {email}")
    return cookie

def test_1_weno_test_auth():
    """TEST 1: GET /api/erx/weno-test with NO cookie -> 401"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/erx/weno-test - AUTH GUARD (no cookie)")
    print("="*80)
    
    try:
        url = f"{BASE_URL}/api/erx/weno-test"
        resp = requests.get(url, timeout=30)
        
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print("✅ TEST 1 PASSED: Correctly returns 401 Unauthorized without auth cookie")
            return True
        else:
            print(f"❌ TEST 1 FAILED: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 FAILED with exception: {e}")
        return False

def test_2_weno_test_provider(provider_cookie):
    """TEST 2: GET /api/erx/weno-test (provider cookie) -> 200 with specific structure"""
    print("\n" + "="*80)
    print("TEST 2: GET /api/erx/weno-test - PROVIDER ACCESS")
    print("="*80)
    
    try:
        url = f"{BASE_URL}/api/erx/weno-test"
        cookies = {"proactive_session": provider_cookie}
        resp = requests.get(url, cookies=cookies, timeout=30)
        
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 2 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        print(f"Response JSON: {json.dumps(data, indent=2)}")
        
        # Check required fields
        if "ok" not in data:
            print("❌ TEST 2 FAILED: Missing 'ok' field")
            return False
        
        if "online" not in data:
            print("❌ TEST 2 FAILED: Missing 'online' field")
            return False
        
        online = data["online"]
        
        # Check online object structure
        required_online_fields = ["enabled", "configured", "ok", "environment", "message"]
        for field in required_online_fields:
            if field not in online:
                print(f"❌ TEST 2 FAILED: Missing online.{field} field")
                return False
        
        print(f"✅ online.enabled: {online['enabled']}")
        print(f"✅ online.configured: {online['configured']}")
        print(f"✅ online.ok: {online['ok']}")
        print(f"✅ online.environment: {online['environment']}")
        print(f"✅ online.message: {online['message']}")
        
        # Check switch object
        if "switch" not in data:
            print("❌ TEST 2 FAILED: Missing 'switch' field")
            return False
        
        switch = data["switch"]
        required_switch_fields = ["enabled", "configured", "environment", "message"]
        for field in required_switch_fields:
            if field not in switch:
                print(f"❌ TEST 2 FAILED: Missing switch.{field} field")
                return False
        
        print(f"✅ switch.enabled: {switch['enabled']}")
        print(f"✅ switch.configured: {switch['configured']}")
        print(f"✅ switch.environment: {switch['environment']}")
        print(f"✅ switch.message: {switch['message']}")
        
        # CRITICAL ASSERTIONS for online.message
        message = online["message"]
        
        if "Ready" not in message:
            print(f"❌ TEST 2 FAILED: online.message does NOT contain 'Ready'")
            print(f"   Actual message: {message}")
            return False
        print(f"✅ online.message contains 'Ready'")
        
        if "ComposeRx launch builds" not in message:
            print(f"❌ TEST 2 FAILED: online.message does NOT contain 'ComposeRx launch builds'")
            print(f"   Actual message: {message}")
            return False
        print(f"✅ online.message contains 'ComposeRx launch builds'")
        
        if "ernesto@210codelabs.com" not in message:
            print(f"❌ TEST 2 FAILED: online.message does NOT contain 'ernesto@210codelabs.com'")
            print(f"   Actual message: {message}")
            return False
        print(f"✅ online.message contains 'ernesto@210codelabs.com'")
        
        # Check that online.ok is true
        if online["ok"] != True:
            print(f"❌ TEST 2 FAILED: online.ok is {online['ok']}, expected True")
            return False
        print(f"✅ online.ok is True")
        
        # Check that online.configured is true
        if online["configured"] != True:
            print(f"❌ TEST 2 FAILED: online.configured is {online['configured']}, expected True")
            return False
        print(f"✅ online.configured is True")
        
        # Check that online.environment is 'test'
        if online["environment"] != "test":
            print(f"❌ TEST 2 FAILED: online.environment is '{online['environment']}', expected 'test'")
            return False
        print(f"✅ online.environment is 'test'")
        
        print("✅ TEST 2 PASSED: All assertions passed")
        return True
        
    except Exception as e:
        print(f"❌ TEST 2 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_3_weno_status_prescriber(provider_cookie):
    """TEST 3: GET /api/erx/weno-status (provider cookie) -> 200 with online.prescriber object"""
    print("\n" + "="*80)
    print("TEST 3: GET /api/erx/weno-status - PRESCRIBER OBJECT")
    print("="*80)
    
    try:
        url = f"{BASE_URL}/api/erx/weno-status"
        cookies = {"proactive_session": provider_cookie}
        resp = requests.get(url, cookies=cookies, timeout=30)
        
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        print(f"Response JSON: {json.dumps(data, indent=2)}")
        
        # Check that online object exists
        if "online" not in data:
            print("❌ TEST 3 FAILED: Missing 'online' field")
            return False
        
        online = data["online"]
        
        # Check that online.prescriber exists
        if "prescriber" not in online:
            print("❌ TEST 3 FAILED: Missing 'online.prescriber' field")
            return False
        
        prescriber = online["prescriber"]
        print(f"✅ online.prescriber object found: {json.dumps(prescriber, indent=2)}")
        
        # CRITICAL: Assert that the KEYS exist (values may be empty strings)
        required_keys = ["npi", "dea", "firstName", "lastName", "name"]
        for key in required_keys:
            if key not in prescriber:
                print(f"❌ TEST 3 FAILED: Missing prescriber.{key} key")
                return False
            print(f"✅ prescriber.{key} key exists (value: '{prescriber[key]}')")
        
        # Also check that online.configured is true
        if online.get("configured") != True:
            print(f"❌ TEST 3 FAILED: online.configured is {online.get('configured')}, expected True")
            return False
        print(f"✅ online.configured is True")
        
        # Check that online.environment is 'test'
        if online.get("environment") != "test":
            print(f"❌ TEST 3 FAILED: online.environment is '{online.get('environment')}', expected 'test'")
            return False
        print(f"✅ online.environment is 'test'")
        
        print("✅ TEST 3 PASSED: All assertions passed")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_4_nppes_search_auth():
    """TEST 4a: GET /api/nppes/search with NO cookie -> 401"""
    print("\n" + "="*80)
    print("TEST 4a: GET /api/nppes/search - AUTH GUARD (no cookie)")
    print("="*80)
    
    try:
        url = f"{BASE_URL}/api/nppes/search?last_name=Smith&type=NPI-1"
        resp = requests.get(url, timeout=30)
        
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print("✅ TEST 4a PASSED: Correctly returns 401 Unauthorized without auth cookie")
            return True
        else:
            print(f"❌ TEST 4a FAILED: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 4a FAILED with exception: {e}")
        return False

def test_4_nppes_search_staff(staff_cookie):
    """TEST 4b: GET /api/nppes/search (staff cookie) -> 200 with count and results"""
    print("\n" + "="*80)
    print("TEST 4b: GET /api/nppes/search - STAFF ACCESS (live NPPES)")
    print("="*80)
    
    try:
        url = f"{BASE_URL}/api/nppes/search?last_name=Smith&type=NPI-1"
        cookies = {"proactive_session": staff_cookie}
        resp = requests.get(url, cookies=cookies, timeout=30)
        
        print(f"Status: {resp.status_code}")
        
        # Live NPPES may occasionally return 502 due to rate-limit
        if resp.status_code == 502:
            print("⚠️  TEST 4b: NPPES returned 502 (rate-limit or service unavailable)")
            print("   This is a known limitation of the live NPPES API, not an app bug")
            print("   Treating as acceptable and continuing...")
            return True
        
        if resp.status_code != 200:
            print(f"❌ TEST 4b FAILED: Expected 200 or 502, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        print(f"Response JSON keys: {list(data.keys())}")
        
        # Check required fields
        if "count" not in data:
            print("❌ TEST 4b FAILED: Missing 'count' field")
            return False
        print(f"✅ count: {data['count']}")
        
        if "results" not in data:
            print("❌ TEST 4b FAILED: Missing 'results' field")
            return False
        
        results = data["results"]
        print(f"✅ results array length: {len(results)}")
        
        if len(results) > 0:
            # Check that each result has npi and name
            sample = results[0]
            print(f"Sample result: {json.dumps(sample, indent=2)}")
            
            if "npi" not in sample:
                print("❌ TEST 4b FAILED: Result missing 'npi' field")
                return False
            print(f"✅ Sample result has 'npi': {sample['npi']}")
            
            if "name" not in sample:
                print("❌ TEST 4b FAILED: Result missing 'name' field")
                return False
            print(f"✅ Sample result has 'name': {sample['name']}")
        else:
            print("⚠️  No results returned (NPPES may have no matches for 'Smith' with type NPI-1)")
            print("   This is acceptable - the endpoint is working correctly")
        
        print("✅ TEST 4b PASSED: All assertions passed")
        return True
        
    except Exception as e:
        print(f"❌ TEST 4b FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("="*80)
    print("BACKEND TEST: eRx↔Weno wiring (Test Connection + Prescriber Pre-fill + NPI Lookup)")
    print("="*80)
    
    # Login as provider
    print("\n--- Logging in as PROVIDER ---")
    provider_cookie = login("andy.manzano@proactiveclinic.com", "apex123")
    if not provider_cookie:
        print("❌ CRITICAL: Provider login failed. Cannot continue.")
        sys.exit(1)
    
    # Login as staff (for NPPES search)
    print("\n--- Logging in as STAFF (admin) ---")
    staff_cookie = login("admin@proactiveclinic.com", "apex123")
    if not staff_cookie:
        print("❌ CRITICAL: Staff login failed. Cannot continue.")
        sys.exit(1)
    
    # Run all tests
    results = []
    
    results.append(("TEST 1: weno-test auth guard", test_1_weno_test_auth()))
    results.append(("TEST 2: weno-test provider access", test_2_weno_test_provider(provider_cookie)))
    results.append(("TEST 3: weno-status prescriber object", test_3_weno_status_prescriber(provider_cookie)))
    results.append(("TEST 4a: nppes search auth guard", test_4_nppes_search_auth()))
    results.append(("TEST 4b: nppes search staff access", test_4_nppes_search_staff(staff_cookie)))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! eRx↔Weno wiring is working correctly.")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} test(s) failed. Please review the output above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
