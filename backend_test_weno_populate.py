#!/usr/bin/env python3
"""
Backend test for Weno populate preconfigured TEST values endpoint.
Tests POST /api/admin/weno/populate-test with authentication, authorization,
persistence, idempotency, and secret masking verification.
"""

import requests
import json
import sys

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"
NURSE_EMAIL = "nurse.kim@proactiveclinic.com"
NURSE_PASSWORD = "apex123"

def login(email: str, password: str) -> requests.Session:
    """Login and return session with cookie."""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30
    )
    if response.status_code != 200:
        print(f"❌ Login failed for {email}: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        sys.exit(1)
    print(f"✅ Login successful for {email}")
    return session

def test_step_1_no_auth():
    """TEST 1: POST /api/admin/weno/populate-test with NO auth cookie -> expect 403 Forbidden."""
    print("\n" + "="*80)
    print("TEST 1: POST /api/admin/weno/populate-test WITHOUT auth cookie")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/weno/populate-test",
            timeout=30
        )
        
        if response.status_code == 403:
            print(f"✅ PASS: Returns 403 Forbidden as expected")
            return True
        else:
            print(f"❌ FAIL: Expected 403, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        return False

def test_step_2_admin_populate(admin_session: requests.Session):
    """TEST 2: Login as admin, then POST -> expect 200 with correct JSON shape."""
    print("\n" + "="*80)
    print("TEST 2: POST /api/admin/weno/populate-test as ADMIN")
    print("="*80)
    
    try:
        response = admin_session.post(
            f"{BASE_URL}/api/admin/weno/populate-test",
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        print(f"✅ PASS: Returns 200")
        print(f"Response JSON: {json.dumps(data, indent=2)}")
        
        # Verify JSON shape
        if not data.get("ok"):
            print(f"❌ FAIL: Missing 'ok: true' in response")
            return False
        print(f"✅ PASS: Response has 'ok: true'")
        
        # Verify online object
        online = data.get("online", {})
        if not isinstance(online.get("applied"), list):
            print(f"❌ FAIL: online.applied is not a list")
            return False
        print(f"✅ PASS: online.applied is a list with {len(online['applied'])} items")
        
        # Check required fields in online.applied
        required_fields = ["EHR_ENCRYPTION_KEY", "ENVIRONMENT", "PROVIDER_EMAIL", "PROVIDER_PASSWORD", "LOCATION_ID"]
        for field in required_fields:
            if field not in online["applied"]:
                print(f"❌ FAIL: online.applied missing required field '{field}'")
                return False
        print(f"✅ PASS: online.applied includes all required fields: {required_fields}")
        
        if online.get("enabled") != True:
            print(f"❌ FAIL: online.enabled is not true, got: {online.get('enabled')}")
            return False
        print(f"✅ PASS: online.enabled === true")
        
        # Verify exchange object
        exchange = data.get("exchange", {})
        if not isinstance(exchange.get("applied"), list):
            print(f"❌ FAIL: exchange.applied is not a list")
            return False
        print(f"✅ PASS: exchange.applied is a list with {len(exchange['applied'])} items")
        
        if exchange.get("enabled") != False:
            print(f"❌ FAIL: exchange.enabled is not false, got: {exchange.get('enabled')}")
            return False
        print(f"✅ PASS: exchange.enabled === false (no partner creds baked)")
        
        return True
        
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_step_3_persistence(admin_session: requests.Session):
    """TEST 3: Verify persistence via GET /api/admin/integrations."""
    print("\n" + "="*80)
    print("TEST 3: Persistence check via GET /api/admin/integrations")
    print("="*80)
    
    try:
        response = admin_session.get(
            f"{BASE_URL}/api/admin/integrations",
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        print(f"✅ PASS: GET /api/admin/integrations returns 200")
        
        # Find weno-online provider
        state = data.get("state", {})
        providers = state.get("providers", {})
        weno_online = providers.get("weno-online")
        
        if not weno_online:
            print(f"❌ FAIL: 'weno-online' provider not found in response")
            print(f"Available providers: {list(providers.keys())}")
            return False
        print(f"✅ PASS: Found 'weno-online' provider in response")
        
        # Verify enabled
        if not weno_online.get("enabled"):
            print(f"❌ FAIL: weno-online is not enabled")
            return False
        print(f"✅ PASS: weno-online provider is enabled")
        
        # Verify secret fields are masked (not returned in plaintext)
        credentials = weno_online.get("credentials", {})
        secrets_set = weno_online.get("secretsSet", {})
        
        # Check that secret fields are empty strings in credentials
        secret_fields = ["EHR_ENCRYPTION_KEY", "PROVIDER_PASSWORD"]
        for field in secret_fields:
            if field in credentials and credentials[field] != "":
                print(f"❌ FAIL: Secret field '{field}' is NOT masked (value: {credentials[field][:20]}...)")
                return False
            if not secrets_set.get(field):
                print(f"❌ FAIL: secretsSet.{field} is not true")
                return False
        print(f"✅ PASS: Secret fields (EHR_ENCRYPTION_KEY, PROVIDER_PASSWORD) are masked (empty strings in credentials)")
        print(f"✅ PASS: secretsSet indicates secrets are SET: {secrets_set}")
        
        # Verify non-secret fields are present
        if credentials.get("ENVIRONMENT") != "test":
            print(f"❌ FAIL: ENVIRONMENT field is not 'test', got: {credentials.get('ENVIRONMENT')}")
            return False
        print(f"✅ PASS: Non-secret field ENVIRONMENT='test' is present")
        
        if not credentials.get("PROVIDER_EMAIL"):
            print(f"❌ FAIL: PROVIDER_EMAIL field is missing")
            return False
        print(f"✅ PASS: Non-secret field PROVIDER_EMAIL is present (value: {credentials.get('PROVIDER_EMAIL')})")
        
        if not credentials.get("LOCATION_ID"):
            print(f"❌ FAIL: LOCATION_ID field is missing")
            return False
        print(f"✅ PASS: Non-secret field LOCATION_ID is present (value: {credentials.get('LOCATION_ID')})")
        
        return True
        
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_step_4_idempotency(admin_session: requests.Session):
    """TEST 4: POST the endpoint again as admin -> 200, no error, still enabled."""
    print("\n" + "="*80)
    print("TEST 4: Idempotency - POST /api/admin/weno/populate-test again")
    print("="*80)
    
    try:
        response = admin_session.post(
            f"{BASE_URL}/api/admin/weno/populate-test",
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        print(f"✅ PASS: Returns 200 on second call")
        
        if not data.get("ok"):
            print(f"❌ FAIL: Missing 'ok: true' in response")
            return False
        print(f"✅ PASS: Response has 'ok: true'")
        
        online = data.get("online", {})
        if online.get("enabled") != True:
            print(f"❌ FAIL: online.enabled is not true after second call")
            return False
        print(f"✅ PASS: online.enabled still === true (idempotent)")
        
        exchange = data.get("exchange", {})
        if exchange.get("enabled") != False:
            print(f"❌ FAIL: exchange.enabled is not false after second call")
            return False
        print(f"✅ PASS: exchange.enabled still === false (idempotent)")
        
        return True
        
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_step_5_non_admin(nurse_session: requests.Session):
    """TEST 5: Non-admin (nurse) session POST -> expect 403."""
    print("\n" + "="*80)
    print("TEST 5: POST /api/admin/weno/populate-test as NON-ADMIN (nurse)")
    print("="*80)
    
    try:
        response = nurse_session.post(
            f"{BASE_URL}/api/admin/weno/populate-test",
            timeout=30
        )
        
        if response.status_code == 403:
            print(f"✅ PASS: Returns 403 Forbidden for non-admin user")
            return True
        else:
            print(f"❌ FAIL: Expected 403, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        return False

def main():
    """Run all tests."""
    print("="*80)
    print("WENO POPULATE TEST VALUES - BACKEND TESTING")
    print("="*80)
    
    results = []
    
    # TEST 1: No auth
    results.append(("TEST 1: No auth -> 403", test_step_1_no_auth()))
    
    # Login as admin
    admin_session = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    # TEST 2: Admin populate
    results.append(("TEST 2: Admin populate -> 200 with correct JSON", test_step_2_admin_populate(admin_session)))
    
    # TEST 3: Persistence check
    results.append(("TEST 3: Persistence check (secrets masked)", test_step_3_persistence(admin_session)))
    
    # TEST 4: Idempotency
    results.append(("TEST 4: Idempotency (second POST)", test_step_4_idempotency(admin_session)))
    
    # Login as nurse (non-admin)
    nurse_session = login(NURSE_EMAIL, NURSE_PASSWORD)
    
    # TEST 5: Non-admin forbidden
    results.append(("TEST 5: Non-admin -> 403", test_step_5_non_admin(nurse_session)))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
