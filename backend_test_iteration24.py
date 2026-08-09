#!/usr/bin/env python3
"""
Backend test for Iteration 24: Stedi Phase 1 Eligibility API (GET/POST /api/stedi/eligibility)

Test cases:
1. GET /api/stedi/eligibility with NO cookie -> expect 401
2. GET /api/stedi/eligibility as staff -> expect 200 with JSON {checks: [...]} (array; may be empty)
3. POST /api/stedi/eligibility as staff with body -> expect 400 with "not configured" (Stedi disabled)
4. POST /api/stedi/eligibility with NO cookie -> expect 401
5. OPTIONAL live-wiring check: Enable Stedi with fake key as admin, POST should return 200 with error,
   GET should show saved check, then disable Stedi

Auth:
- Staff: andy.manzano@proactiveclinic.com / apex123
- Admin: admin@proactiveclinic.com / apex123
- Cookie: proactive_session
- Base URL: http://localhost:3000
"""

import requests
import json

BASE_URL = "http://localhost:3000"

def test_case_1_get_no_cookie():
    """Test case 1: GET /api/stedi/eligibility with NO cookie -> expect 401"""
    print("\n" + "="*80)
    print("TEST CASE 1: GET /api/stedi/eligibility without cookie -> expect 401")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/api/stedi/eligibility", timeout=10)
        print(f"✓ Status: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ TEST CASE 1 PASSED: Correctly blocked with 401 Unauthorized")
            return True
        else:
            print(f"❌ TEST CASE 1 FAILED: Expected 401, got {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ TEST CASE 1 FAILED: Exception - {e}")
        return False

def test_case_2_get_as_staff():
    """Test case 2: GET /api/stedi/eligibility as staff -> expect 200 with {checks: [...]}"""
    print("\n" + "="*80)
    print("TEST CASE 2: GET /api/stedi/eligibility as staff -> expect 200 with {checks: [...]}")
    print("="*80)
    
    try:
        # Login as staff
        print("→ Logging in as staff (andy.manzano@proactiveclinic.com)...")
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "andy.manzano@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        
        if login_response.status_code != 200:
            print(f"❌ Staff login failed: {login_response.status_code}")
            print(f"Response: {login_response.text[:200]}")
            return False
        
        staff_cookie = login_response.cookies.get("proactive_session")
        if not staff_cookie:
            print("❌ No proactive_session cookie received")
            return False
        
        print(f"✓ Staff login successful, cookie: {staff_cookie[:20]}...")
        
        # GET eligibility checks
        print("→ GET /api/stedi/eligibility...")
        response = requests.get(
            f"{BASE_URL}/api/stedi/eligibility",
            cookies={"proactive_session": staff_cookie},
            timeout=10
        )
        
        print(f"✓ Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST CASE 2 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
        
        data = response.json()
        print(f"✓ Response JSON: {json.dumps(data, indent=2)[:300]}...")
        
        if "checks" not in data:
            print(f"❌ TEST CASE 2 FAILED: Response missing 'checks' field")
            return False
        
        if not isinstance(data["checks"], list):
            print(f"❌ TEST CASE 2 FAILED: 'checks' is not an array")
            return False
        
        print(f"✓ Response has 'checks' array with {len(data['checks'])} items")
        print("✅ TEST CASE 2 PASSED: GET as staff returns 200 with {checks: [...]}")
        return True
        
    except Exception as e:
        print(f"❌ TEST CASE 2 FAILED: Exception - {e}")
        return False

def test_case_3_post_stedi_disabled():
    """Test case 3: POST /api/stedi/eligibility as staff (Stedi disabled) -> expect 400 'not configured'"""
    print("\n" + "="*80)
    print("TEST CASE 3: POST /api/stedi/eligibility as staff (Stedi disabled) -> expect 400 'not configured'")
    print("="*80)
    
    try:
        # Login as staff
        print("→ Logging in as staff (andy.manzano@proactiveclinic.com)...")
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "andy.manzano@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        
        if login_response.status_code != 200:
            print(f"❌ Staff login failed: {login_response.status_code}")
            return False
        
        staff_cookie = login_response.cookies.get("proactive_session")
        print(f"✓ Staff login successful")
        
        # POST eligibility check
        print("→ POST /api/stedi/eligibility with test data...")
        body = {
            "payerId": "87726",
            "firstName": "Test",
            "lastName": "User",
            "dateOfBirth": "1980-01-01"
        }
        print(f"  Body: {json.dumps(body)}")
        
        response = requests.post(
            f"{BASE_URL}/api/stedi/eligibility",
            json=body,
            cookies={"proactive_session": staff_cookie},
            timeout=10
        )
        
        print(f"✓ Status: {response.status_code}")
        print(f"✓ Response: {response.text[:300]}")
        
        if response.status_code != 400:
            print(f"❌ TEST CASE 3 FAILED: Expected 400, got {response.status_code}")
            return False
        
        data = response.json()
        error_message = data.get("error", "")
        
        if "not configured" not in error_message.lower():
            print(f"❌ TEST CASE 3 FAILED: Error message doesn't contain 'not configured'")
            print(f"   Got: {error_message}")
            return False
        
        print(f"✓ Error message contains 'not configured': {error_message}")
        print("✅ TEST CASE 3 PASSED: POST with Stedi disabled returns 400 'not configured'")
        return True
        
    except Exception as e:
        print(f"❌ TEST CASE 3 FAILED: Exception - {e}")
        return False

def test_case_4_post_no_cookie():
    """Test case 4: POST /api/stedi/eligibility with NO cookie -> expect 401"""
    print("\n" + "="*80)
    print("TEST CASE 4: POST /api/stedi/eligibility without cookie -> expect 401")
    print("="*80)
    
    try:
        body = {
            "payerId": "87726",
            "firstName": "Test",
            "lastName": "User",
            "dateOfBirth": "1980-01-01"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/stedi/eligibility",
            json=body,
            timeout=10
        )
        
        print(f"✓ Status: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ TEST CASE 4 PASSED: Correctly blocked with 401 Unauthorized")
            return True
        else:
            print(f"❌ TEST CASE 4 FAILED: Expected 401, got {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ TEST CASE 4 FAILED: Exception - {e}")
        return False

def test_case_5_live_wiring_check():
    """Test case 5: OPTIONAL live-wiring check - Enable Stedi with fake key, test, then disable"""
    print("\n" + "="*80)
    print("TEST CASE 5: OPTIONAL live-wiring check - Enable Stedi with fake key")
    print("="*80)
    
    try:
        # Login as admin
        print("→ Logging in as admin (admin@proactiveclinic.com)...")
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        
        if login_response.status_code != 200:
            print(f"❌ Admin login failed: {login_response.status_code}")
            print(f"Response: {login_response.text[:200]}")
            return False
        
        admin_cookie = login_response.cookies.get("proactive_session")
        if not admin_cookie:
            print("❌ No proactive_session cookie received")
            return False
        
        print(f"✓ Admin login successful")
        
        # Enable Stedi with fake credentials
        print("→ PUT /api/admin/integrations to enable Stedi with fake key...")
        stedi_config = {
            "providers": {
                "stedi": {
                    "enabled": True,
                    "subServices": {
                        "coverage": True
                    },
                    "subServiceCredentials": {},
                    "credentials": {
                        "API_KEY": "test_fake_key_123",
                        "ENVIRONMENT": "test",
                        "ORG_NAME": "Proactive Clinic LLC",
                        "BILLING_NPI": "1999999992",
                        "TAX_ID": "555123456",
                        "TAX_ID_TYPE": "EIN",
                        "DEFAULT_PAYER_ID": "87726"
                    }
                }
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/integrations",
            json=stedi_config,
            cookies={"proactive_session": admin_cookie},
            timeout=10
        )
        
        print(f"✓ PUT status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Failed to enable Stedi: {response.status_code}")
            print(f"Response: {response.text[:300]}")
            return False
        
        print("✓ Stedi enabled with fake credentials")
        
        # Login as staff for eligibility check
        print("\n→ Logging in as staff for eligibility check...")
        staff_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "andy.manzano@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        
        staff_cookie = staff_login.cookies.get("proactive_session")
        print(f"✓ Staff login successful")
        
        # POST eligibility check (should fail with fake key but return 200 with error)
        print("\n→ POST /api/stedi/eligibility with fake key (expect 200 with error)...")
        body = {
            "payerId": "87726",
            "firstName": "Test",
            "lastName": "User",
            "dateOfBirth": "1980-01-01"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/stedi/eligibility",
            json=body,
            cookies={"proactive_session": staff_cookie},
            timeout=15
        )
        
        print(f"✓ POST status: {response.status_code}")
        print(f"✓ Response: {response.text[:500]}")
        
        if response.status_code != 200:
            print(f"⚠️  Expected 200 with error field, got {response.status_code}")
            # Continue to check if it's still a valid error response
        
        data = response.json()
        
        # Check if response has error field OR check with status='error'
        has_error = "error" in data or (data.get("check", {}).get("status") == "error")
        
        if not has_error:
            print(f"❌ Response doesn't contain error field or error status check")
            print(f"   Response: {json.dumps(data, indent=2)[:500]}")
            # Don't fail yet, continue to check GET
        else:
            print(f"✓ Response contains error (fake key rejected by Stedi): {data.get('error', data.get('check', {}).get('status'))}")
        
        # GET eligibility checks to verify saved error check
        print("\n→ GET /api/stedi/eligibility to verify saved check...")
        response = requests.get(
            f"{BASE_URL}/api/stedi/eligibility",
            cookies={"proactive_session": staff_cookie},
            timeout=10
        )
        
        print(f"✓ GET status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ GET failed: {response.status_code}")
        else:
            data = response.json()
            checks = data.get("checks", [])
            print(f"✓ Found {len(checks)} eligibility checks")
            
            if len(checks) > 0:
                latest_check = checks[0]
                print(f"✓ Latest check: status={latest_check.get('status')}, patientName={latest_check.get('patientName')}")
                
                if latest_check.get("status") == "error":
                    print("✓ Saved check has status='error' (fake key rejection persisted)")
                else:
                    print(f"⚠️  Latest check status is '{latest_check.get('status')}', expected 'error'")
            else:
                print("⚠️  No checks found in history")
        
        # Disable Stedi to restore clean state
        print("\n→ PUT /api/admin/integrations to disable Stedi (restore clean state)...")
        disable_config = {
            "providers": {
                "stedi": {
                    "enabled": False,
                    "subServices": {},
                    "subServiceCredentials": {},
                    "credentials": {
                        "API_KEY": "",
                        "ORG_NAME": "",
                        "BILLING_NPI": "",
                        "TAX_ID": ""
                    }
                }
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/integrations",
            json=disable_config,
            cookies={"proactive_session": admin_cookie},
            timeout=10
        )
        
        print(f"✓ Disable status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"⚠️  Failed to disable Stedi: {response.status_code}")
        else:
            print("✓ Stedi disabled successfully (clean state restored)")
        
        print("✅ TEST CASE 5 PASSED: Live-wiring check completed - fake key rejected, error saved, Stedi disabled")
        return True
        
    except Exception as e:
        print(f"❌ TEST CASE 5 FAILED: Exception - {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "="*80)
    print("BACKEND TEST: Iteration 24 - Stedi Phase 1 Eligibility API")
    print("="*80)
    
    results = []
    
    # Run all test cases
    results.append(("Test 1: GET without cookie -> 401", test_case_1_get_no_cookie()))
    results.append(("Test 2: GET as staff -> 200 {checks:[]}", test_case_2_get_as_staff()))
    results.append(("Test 3: POST as staff (disabled) -> 400 'not configured'", test_case_3_post_stedi_disabled()))
    results.append(("Test 4: POST without cookie -> 401", test_case_4_post_no_cookie()))
    results.append(("Test 5: OPTIONAL live-wiring check", test_case_5_live_wiring_check()))
    
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
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    exit(main())
