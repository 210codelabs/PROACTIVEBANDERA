#!/usr/bin/env python3
"""
Backend test for Weno Online config reconcile-on-boot from env (fixes stale production encryption key)

Tests:
1. GUARD: POST /api/internal/weno-apply-env WITHOUT x-weno-cron header -> 403
2. RECONCILE: POST /api/internal/weno-apply-env WITH x-weno-cron header -> 200 with {ok, applied, changed, reconciled}
3. NO REGRESSION: GET /api/weno/iframe-url/<patientId> as admin -> 200 with iframeUrl containing 'online.wenoexchange.com' and '&data='
"""

import os
import sys
import requests
import json
from typing import Dict, Any

# Read environment variables
BASE_URL = os.getenv("NEXT_PUBLIC_BASE_URL", "https://nextjs-ssr-stack.preview.emergentagent.com")
AUTH_SECRET = os.getenv("AUTH_SECRET", "proactive-clinic-dev-secret-change-me-in-production-please-32chars+")

# Test credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def print_test_header(test_name: str):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print('='*80)

def print_result(success: bool, message: str):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def login_as_admin() -> str:
    """Login as admin and return session cookie"""
    print_test_header("SETUP: Login as admin")
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"Login response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Login failed: {response.text}")
            sys.exit(1)
        
        # Extract session cookie
        cookies = response.cookies
        session_cookie = cookies.get("proactive_session")
        
        if not session_cookie:
            print("ERROR: No proactive_session cookie in response")
            sys.exit(1)
        
        print_result(True, f"Admin login successful, session cookie obtained")
        return session_cookie
    except Exception as e:
        print(f"ERROR during login: {e}")
        sys.exit(1)

def get_real_patient_id(session_cookie: str) -> str:
    """Get a real patient ID - using known patient from database"""
    print_test_header("SETUP: Get real patient ID")
    
    # Use known patient ID from database (Eleanor Adams)
    patient_id = "cms87vx850017l4ocyz5zfz89"
    patient_name = "Eleanor Adams"
    
    print_result(True, f"Using patient: {patient_name} (ID: {patient_id})")
    return patient_id

def test_guard_without_header():
    """TEST 1: POST /api/internal/weno-apply-env WITHOUT x-weno-cron header -> 403"""
    print_test_header("TEST 1: GUARD - POST without x-weno-cron header")
    url = f"{BASE_URL}/api/internal/weno-apply-env"
    
    try:
        response = requests.post(url, json={}, timeout=30)
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:200]}")
        
        if response.status_code == 403:
            data = response.json()
            if "error" in data:
                print_result(True, f"Correctly returns 403 Forbidden with error: {data['error']}")
                return True
        
        print_result(False, f"Expected 403, got {response.status_code}")
        return False
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_reconcile_with_header():
    """TEST 2: POST /api/internal/weno-apply-env WITH x-weno-cron header -> 200"""
    print_test_header("TEST 2: RECONCILE - POST with x-weno-cron header")
    url = f"{BASE_URL}/api/internal/weno-apply-env"
    headers = {"x-weno-cron": AUTH_SECRET}
    
    try:
        response = requests.post(url, json={}, headers=headers, timeout=30)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Response body: {response.text}")
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"Response body: {json.dumps(data, indent=2)}")
        
        # Verify response structure
        checks = []
        
        # Check ok field
        if data.get("ok") == True:
            checks.append(("ok === true", True))
        else:
            checks.append(("ok === true", False))
        
        # Check applied field (should be an array)
        applied = data.get("applied", [])
        if isinstance(applied, list):
            checks.append(("applied is array", True))
            # Check for expected fields
            expected_fields = ["EHR_ENCRYPTION_KEY", "ENVIRONMENT", "PROVIDER_EMAIL", "PROVIDER_PASSWORD", "LOCATION_ID"]
            has_all_fields = all(field in applied for field in expected_fields)
            if has_all_fields:
                checks.append((f"applied includes all 5 required fields: {expected_fields}", True))
            else:
                checks.append((f"applied includes all 5 required fields", False))
                print(f"  Applied fields: {applied}")
        else:
            checks.append(("applied is array", False))
        
        # Check changed field (should be an array, likely empty in preview)
        changed = data.get("changed", [])
        if isinstance(changed, list):
            checks.append(("changed is array", True))
            if len(changed) == 0:
                print(f"  Note: changed is [] (EXPECTED - preview DB already matches env)")
            else:
                print(f"  Note: changed has {len(changed)} items: {changed}")
        else:
            checks.append(("changed is array", False))
        
        # Check reconciled field
        reconciled = data.get("reconciled")
        if reconciled == True:
            checks.append(("reconciled === true", True))
        else:
            checks.append(("reconciled === true", False))
        
        # Print all checks
        all_passed = True
        for check_name, passed in checks:
            print_result(passed, check_name)
            if not passed:
                all_passed = False
        
        # CRITICAL: Verify NO secret values are in the response
        response_str = json.dumps(data)
        secret_values = [
            os.getenv("WENO_ONLINE_KEY", ""),
            os.getenv("WENO_ONLINE_PASSWORD", ""),
        ]
        
        secrets_leaked = False
        for secret in secret_values:
            if secret and len(secret) > 0 and secret in response_str:
                print_result(False, f"SECURITY VIOLATION: Secret value leaked in response!")
                secrets_leaked = True
                all_passed = False
        
        if not secrets_leaked:
            print_result(True, "SECURITY: No secret values leaked in response")
        
        return all_passed
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def test_no_regression(session_cookie: str, patient_id: str):
    """TEST 3: GET /api/weno/iframe-url/<patientId> as admin -> 200 with iframeUrl"""
    print_test_header("TEST 3: NO REGRESSION - GET /api/weno/iframe-url/<patientId>")
    url = f"{BASE_URL}/api/weno/iframe-url/{patient_id}"
    cookies = {"proactive_session": session_cookie}
    
    try:
        response = requests.get(url, cookies=cookies, timeout=30)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Response body: {response.text}")
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Verify response structure
        checks = []
        
        # Check iframeUrl field
        iframe_url = data.get("iframeUrl", "")
        if iframe_url:
            checks.append(("iframeUrl is present", True))
            
            # Check if it contains 'online.wenoexchange.com'
            if "online.wenoexchange.com" in iframe_url:
                checks.append(("iframeUrl contains 'online.wenoexchange.com'", True))
            else:
                checks.append(("iframeUrl contains 'online.wenoexchange.com'", False))
                print(f"  iframeUrl: {iframe_url[:100]}...")
            
            # Check if it contains '&data='
            if "&data=" in iframe_url:
                checks.append(("iframeUrl contains '&data=' (encrypted payload)", True))
            else:
                checks.append(("iframeUrl contains '&data='", False))
                print(f"  iframeUrl: {iframe_url[:100]}...")
            
            # SECURITY: Do NOT print the full iframeUrl (contains encrypted PHI + credentials)
            print(f"  iframeUrl format: {iframe_url.split('?')[0]}?useremail=***MASKED***&data=***MASKED***")
        else:
            checks.append(("iframeUrl is present", False))
        
        # Print all checks
        all_passed = True
        for check_name, passed in checks:
            print_result(passed, check_name)
            if not passed:
                all_passed = False
        
        return all_passed
    except Exception as e:
        print_result(False, f"Exception: {e}")
        return False

def main():
    print("\n" + "="*80)
    print("BACKEND TEST: Weno Online config reconcile-on-boot from env")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"AUTH_SECRET: {'***' + AUTH_SECRET[-4:] if len(AUTH_SECRET) > 4 else '***'}")
    
    # Setup
    session_cookie = login_as_admin()
    patient_id = get_real_patient_id(session_cookie)
    
    # Run tests
    results = []
    
    results.append(("TEST 1: GUARD without header", test_guard_without_header()))
    results.append(("TEST 2: RECONCILE with header", test_reconcile_with_header()))
    results.append(("TEST 3: NO REGRESSION iframe-url", test_no_regression(session_cookie, patient_id)))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if not passed:
            all_passed = False
    
    print("\n" + "="*80)
    if all_passed:
        print("✅ ALL TESTS PASSED - NO CRITICAL ISSUES")
        print("="*80)
        sys.exit(0)
    else:
        print("❌ SOME TESTS FAILED")
        print("="*80)
        sys.exit(1)

if __name__ == "__main__":
    main()
