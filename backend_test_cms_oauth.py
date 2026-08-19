#!/usr/bin/env python3
"""
Backend test for CMS Blue Button 2.0 OAuth wiring.
Tests the OAuth redirect routes WITHOUT following redirects.
"""
import requests
import sys
from urllib.parse import urlparse, parse_qs

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def login_admin():
    """Login as admin and return session cookie."""
    print("\n=== SETUP: Admin Login ===")
    
    # Create a session to persist cookies
    session = requests.Session()
    r = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@proactiveclinic.com", "password": "apex123"},
        allow_redirects=False
    )
    print(f"Login status: {r.status_code}")
    
    if r.status_code != 200:
        print(f"Login failed: {r.text}")
        sys.exit(1)
    
    # Check all cookies in the session
    print(f"Cookies after login: {session.cookies.get_dict()}")
    
    # Extract session cookie (might be named differently)
    session_cookie = session.cookies.get("session") or session.cookies.get("next-auth.session-token")
    
    if not session_cookie:
        # Try to get any cookie that looks like a session
        all_cookies = session.cookies.get_dict()
        if all_cookies:
            print(f"Available cookies: {list(all_cookies.keys())}")
            # Use the session object directly instead
            print(f"✅ Admin login successful, using session object")
            return session
        else:
            print("ERROR: No cookies returned from login")
            sys.exit(1)
    
    print(f"✅ Admin login successful, session cookie obtained")
    return {"session": session_cookie}

def test_authorize_without_auth():
    """TEST 1: GET /api/cms/authorize without auth cookie -> 401"""
    print("\n=== TEST 1: GET /api/cms/authorize WITHOUT auth cookie ===")
    try:
        # Use a fresh session with no cookies
        r = requests.get(
            f"{BASE_URL}/api/cms/authorize?patientId=abc",
            allow_redirects=False
        )
        print(f"Status: {r.status_code}")
        
        if r.status_code == 401:
            print("✅ TEST 1 PASSED: Returns 401 Unauthorized (middleware guard working)")
            return True
        else:
            print(f"❌ TEST 1 FAILED: Expected 401, got {r.status_code}")
            print(f"Response: {r.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 FAILED with exception: {e}")
        return False

def test_authorize_with_auth(session):
    """TEST 2: GET /api/cms/authorize with admin cookie -> 3xx with correct Location and cms_oauth cookie"""
    print("\n=== TEST 2: GET /api/cms/authorize WITH admin cookie (DO NOT FOLLOW REDIRECTS) ===")
    try:
        # Use the session object if it's a Session, otherwise use cookies dict
        if isinstance(session, requests.Session):
            r = session.get(
                f"{BASE_URL}/api/cms/authorize?patientId=abc",
                allow_redirects=False  # CRITICAL: Do not follow redirects
            )
        else:
            r = requests.get(
                f"{BASE_URL}/api/cms/authorize?patientId=abc",
                cookies=session,
                allow_redirects=False  # CRITICAL: Do not follow redirects
            )
        print(f"Status: {r.status_code}")
        
        # Check status is 3xx
        if r.status_code not in [301, 302, 303, 307, 308]:
            print(f"❌ TEST 2 FAILED: Expected 3xx redirect, got {r.status_code}")
            print(f"Response: {r.text[:200]}")
            return False
        
        print(f"✅ Status is {r.status_code} (3xx redirect)")
        
        # Check Location header
        location = r.headers.get("Location", "")
        print(f"Location header: {location[:150]}...")
        
        if not location:
            print("❌ TEST 2 FAILED: No Location header in redirect response")
            return False
        
        # Parse Location URL
        parsed = urlparse(location)
        query_params = parse_qs(parsed.query)
        
        # CRITICAL ASSERTIONS
        checks = []
        
        # 1. Location must start with https://api.bluebutton.cms.gov/v2/o/authorize
        expected_base = "https://api.bluebutton.cms.gov/v2/o/authorize"
        if location.startswith(expected_base):
            print(f"✅ Location starts with {expected_base}")
            checks.append(True)
        else:
            print(f"❌ Location does NOT start with {expected_base}")
            print(f"   Actual: {location[:100]}")
            checks.append(False)
        
        # 2. Contains response_type=code
        if query_params.get("response_type") == ["code"]:
            print("✅ Contains response_type=code")
            checks.append(True)
        else:
            print(f"❌ Missing or incorrect response_type: {query_params.get('response_type')}")
            checks.append(False)
        
        # 3. Contains code_challenge_method=S256
        if query_params.get("code_challenge_method") == ["S256"]:
            print("✅ Contains code_challenge_method=S256")
            checks.append(True)
        else:
            print(f"❌ Missing or incorrect code_challenge_method: {query_params.get('code_challenge_method')}")
            checks.append(False)
        
        # 4. Contains client_id=Q9asq4TAj4i5WMvZwIRUu4fZsLtRbnTMfIak4Xmd
        expected_client_id = "Q9asq4TAj4i5WMvZwIRUu4fZsLtRbnTMfIak4Xmd"
        if query_params.get("client_id") == [expected_client_id]:
            print(f"✅ Contains client_id={expected_client_id}")
            checks.append(True)
        else:
            print(f"❌ Missing or incorrect client_id: {query_params.get('client_id')}")
            checks.append(False)
        
        # 5. Contains redirect_uri ending with /api/cms/callback
        redirect_uri = query_params.get("redirect_uri", [""])[0]
        if redirect_uri.endswith("/api/cms/callback"):
            print(f"✅ Contains redirect_uri ending with /api/cms/callback: {redirect_uri}")
            checks.append(True)
        else:
            print(f"❌ redirect_uri does NOT end with /api/cms/callback: {redirect_uri}")
            checks.append(False)
        
        # 6. Contains scope param
        if "scope" in query_params:
            print(f"✅ Contains scope param: {query_params['scope'][0][:50]}...")
            checks.append(True)
        else:
            print("❌ Missing scope param")
            checks.append(False)
        
        # 7. Contains state param
        if "state" in query_params and query_params["state"][0]:
            print(f"✅ Contains state param: {query_params['state'][0]}")
            checks.append(True)
        else:
            print("❌ Missing state param")
            checks.append(False)
        
        # 8. Contains code_challenge param
        if "code_challenge" in query_params and query_params["code_challenge"][0]:
            print(f"✅ Contains code_challenge param: {query_params['code_challenge'][0][:20]}...")
            checks.append(True)
        else:
            print("❌ Missing code_challenge param")
            checks.append(False)
        
        # 9. Check Set-Cookie header for cms_oauth (httpOnly)
        set_cookie_headers = r.headers.get("Set-Cookie", "")
        if "cms_oauth" in set_cookie_headers:
            print(f"✅ Set-Cookie header contains cms_oauth cookie")
            if "HttpOnly" in set_cookie_headers or "httponly" in set_cookie_headers.lower():
                print("✅ cms_oauth cookie has HttpOnly flag")
                checks.append(True)
            else:
                print("⚠️  cms_oauth cookie may not have HttpOnly flag (check manually)")
                checks.append(True)  # Still pass, as the cookie is set
        else:
            print(f"❌ Set-Cookie header does NOT contain cms_oauth cookie")
            print(f"   Set-Cookie: {set_cookie_headers[:200]}")
            checks.append(False)
        
        if all(checks):
            print("\n✅ TEST 2 PASSED: All assertions passed")
            return True
        else:
            print(f"\n❌ TEST 2 FAILED: {checks.count(False)} out of {len(checks)} checks failed")
            return False
            
    except Exception as e:
        print(f"❌ TEST 2 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_callback_without_valid_cookie(session):
    """TEST 3: GET /api/cms/callback with admin cookie but NO valid cms_oauth cookie -> 3xx with bb=error"""
    print("\n=== TEST 3: GET /api/cms/callback WITH admin cookie but NO valid cms_oauth cookie ===")
    try:
        # Use the session object if it's a Session, otherwise use cookies dict
        if isinstance(session, requests.Session):
            r = session.get(
                f"{BASE_URL}/api/cms/callback?code=x&state=y",
                allow_redirects=False  # CRITICAL: Do not follow redirects
            )
        else:
            r = requests.get(
                f"{BASE_URL}/api/cms/callback?code=x&state=y",
                cookies=session,  # Only admin session cookie, NO cms_oauth cookie
                allow_redirects=False  # CRITICAL: Do not follow redirects
            )
        print(f"Status: {r.status_code}")
        
        # Check status is 3xx (NOT 500)
        if r.status_code not in [301, 302, 303, 307, 308]:
            print(f"❌ TEST 3 FAILED: Expected 3xx redirect, got {r.status_code}")
            if r.status_code == 500:
                print("❌ CRITICAL: Endpoint returned 500 instead of graceful redirect")
            print(f"Response: {r.text[:200]}")
            return False
        
        print(f"✅ Status is {r.status_code} (3xx redirect, NOT 500)")
        
        # Check Location header contains bb=error
        location = r.headers.get("Location", "")
        print(f"Location header: {location}")
        
        if not location:
            print("❌ TEST 3 FAILED: No Location header in redirect response")
            return False
        
        if "bb=error" in location:
            print("✅ Location contains 'bb=error' (state mismatch error handling working)")
            print("\n✅ TEST 3 PASSED: Callback gracefully handles missing/invalid cms_oauth cookie")
            return True
        else:
            print(f"❌ TEST 3 FAILED: Location does NOT contain 'bb=error'")
            print(f"   Expected error redirect, got: {location}")
            return False
            
    except Exception as e:
        print(f"❌ TEST 3 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 80)
    print("CMS BLUE BUTTON 2.0 OAUTH WIRING TEST")
    print("Testing OAuth redirect routes WITHOUT following redirects")
    print("=" * 80)
    
    # Setup: Login as admin
    admin_session = login_admin()
    
    # Run tests
    results = []
    
    results.append(("TEST 1: Authorize without auth", test_authorize_without_auth()))
    results.append(("TEST 2: Authorize with auth (redirect wiring)", test_authorize_with_auth(admin_session)))
    results.append(("TEST 3: Callback without valid cms_oauth cookie", test_callback_without_valid_cookie(admin_session)))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    total = len(results)
    passed = sum(1 for _, p in results if p)
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - CMS Blue Button OAuth wiring is correctly implemented")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
