#!/usr/bin/env python3
"""
Backend test for POST /api/auth/change-password endpoint.
Tests password change functionality with billing@proactiveclinic.com account.
IMPORTANT: Restores password to apex123! at the end.

NOTE: The review request specified "apex123" but that's only 7 characters.
The endpoint requires minimum 8 characters, so we use "apex123!" (8 chars).
The demo fallback still uses "apex123" (7 chars) which is why old password
may appear to work via demo login after DB password change.
"""

import requests
import sys

# Base URL from .env: NEXT_PUBLIC_BASE_URL
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Test account (NON-critical account as specified)
TEST_EMAIL = "billing@proactiveclinic.com"
ORIGINAL_PASSWORD = "apex123!"  # 8 characters minimum required (apex123 is only 7)
NEW_PASSWORD = "newpass123"

def print_test(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print('='*60)

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def main():
    print("="*60)
    print("PASSWORD CHANGE ENDPOINT TESTING")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Account: {TEST_EMAIL}")
    print(f"Original Password: {ORIGINAL_PASSWORD}")
    print("="*60)

    session = requests.Session()
    all_passed = True

    # ========================================================================
    # TEST 1: POST /api/auth/change-password WITHOUT auth cookie -> 401
    # ========================================================================
    print_test("1. Change password WITHOUT auth cookie (expect 401)")
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"currentPassword": ORIGINAL_PASSWORD, "newPassword": NEW_PASSWORD},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 401:
            print_result(True, "Correctly returned 401 Unauthorized without auth cookie")
        else:
            print_result(False, f"Expected 401, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_result(False, f"Request failed: {e}")
        all_passed = False

    # ========================================================================
    # TEST 2: Login with billing@proactiveclinic.com / apex123 to get session cookie
    # ========================================================================
    print_test("2. Login to get session cookie")
    try:
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": ORIGINAL_PASSWORD},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok"):
                print_result(True, f"Login successful, session cookie set")
                print(f"Cookies: {session.cookies.get_dict()}")
            else:
                print_result(False, f"Login returned 200 but ok=false: {data}")
                all_passed = False
                return
        else:
            print_result(False, f"Login failed with status {response.status_code}")
            all_passed = False
            return
    except Exception as e:
        print_result(False, f"Login request failed: {e}")
        all_passed = False
        return

    # ========================================================================
    # TEST 3: With cookie, POST with WRONG current password -> 400 "Current password is incorrect."
    # ========================================================================
    print_test("3. Change password with WRONG current password (expect 400)")
    try:
        response = session.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"currentPassword": "wrongpass", "newPassword": NEW_PASSWORD},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 400:
            data = response.json()
            error_msg = data.get("error", "")
            if "Current password is incorrect" in error_msg:
                print_result(True, f"Correctly returned 400 with error: '{error_msg}'")
            else:
                print_result(False, f"Got 400 but wrong error message: '{error_msg}'")
                all_passed = False
        else:
            print_result(False, f"Expected 400, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_result(False, f"Request failed: {e}")
        all_passed = False

    # ========================================================================
    # TEST 4: With cookie, POST with password < 8 chars -> 400 (min 8 chars)
    # ========================================================================
    print_test("4. Change password with SHORT new password (expect 400)")
    try:
        response = session.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"currentPassword": ORIGINAL_PASSWORD, "newPassword": "short"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 400:
            data = response.json()
            error_msg = data.get("error", "")
            if "8 characters" in error_msg or "at least 8" in error_msg:
                print_result(True, f"Correctly returned 400 with error: '{error_msg}'")
            else:
                print_result(False, f"Got 400 but wrong error message: '{error_msg}'")
                all_passed = False
        else:
            print_result(False, f"Expected 400, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_result(False, f"Request failed: {e}")
        all_passed = False

    # ========================================================================
    # TEST 5: With cookie, POST valid password change -> 200 {ok:true}
    # ========================================================================
    print_test("5. Change password successfully (expect 200)")
    try:
        response = session.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"currentPassword": ORIGINAL_PASSWORD, "newPassword": NEW_PASSWORD},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok"):
                print_result(True, "Password change successful, returned {ok:true}")
            else:
                print_result(False, f"Got 200 but ok=false: {data}")
                all_passed = False
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_result(False, f"Request failed: {e}")
        all_passed = False

    # ========================================================================
    # TEST 6a: Verify new password works - login with NEW password -> 200
    # ========================================================================
    print_test("6a. Verify NEW password works (login with newpass123)")
    try:
        new_session = requests.Session()
        response = new_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": NEW_PASSWORD},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok"):
                print_result(True, "Login with NEW password successful")
                # Keep this session for cleanup
                session = new_session
            else:
                print_result(False, f"Login returned 200 but ok=false: {data}")
                all_passed = False
        else:
            print_result(False, f"Login with new password failed: {response.status_code}")
            all_passed = False
    except Exception as e:
        print_result(False, f"Request failed: {e}")
        all_passed = False

    # ========================================================================
    # TEST 6b: Verify old password NO LONGER works - login with OLD password -> 401
    # NOTE: Due to ALLOW_DEMO_LOGIN=true, "apex123" (7 chars) will still work
    # via demo fallback, but "apex123!" (8 chars, the real DB password) should fail
    # ========================================================================
    print_test("6b. Verify OLD password no longer works (login with apex123!)")
    try:
        old_session = requests.Session()
        response = old_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": ORIGINAL_PASSWORD},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 401:
            print_result(True, "Login with OLD password correctly rejected with 401")
        elif response.status_code == 200:
            data = response.json()
            user_id = data.get("user", {}).get("id", "")
            # If it's a demo user (id starts with "demo-"), that's the fallback, not the real DB user
            if user_id.startswith("demo-"):
                print_result(True, f"DB password changed (demo fallback returned: {user_id})")
            elif not data.get("ok"):
                print_result(True, "Login with OLD password correctly rejected")
            else:
                print_result(False, "OLD DB password still works! Password change may have failed")
                all_passed = False
        else:
            print_result(False, f"Unexpected status {response.status_code}")
            all_passed = False
    except Exception as e:
        print_result(False, f"Request failed: {e}")
        all_passed = False

    # ========================================================================
    # TEST 7: CLEANUP - Restore password to apex123!
    # ========================================================================
    print_test("7. CLEANUP - Restore password to apex123!")
    try:
        # session should have the new password cookie from test 6a
        response = session.post(
            f"{BASE_URL}/api/auth/change-password",
            json={"currentPassword": NEW_PASSWORD, "newPassword": ORIGINAL_PASSWORD},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok"):
                print_result(True, f"Password restored to {ORIGINAL_PASSWORD} successfully")
            else:
                print_result(False, f"Got 200 but ok=false: {data}")
                all_passed = False
        else:
            print_result(False, f"Password restore failed with status {response.status_code}")
            all_passed = False
            print(f"⚠️  WARNING: Password may not be restored to {ORIGINAL_PASSWORD}!")
    except Exception as e:
        print_result(False, f"Request failed: {e}")
        all_passed = False
        print(f"⚠️  WARNING: Password may not be restored to {ORIGINAL_PASSWORD}!")

    # ========================================================================
    # TEST 8: Final verification - login with apex123! should work
    # ========================================================================
    print_test("8. Final verification - login with apex123!")
    try:
        final_session = requests.Session()
        response = final_session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": ORIGINAL_PASSWORD},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            user_id = data.get("user", {}).get("id", "")
            if data.get("ok") and not user_id.startswith("demo-"):
                print_result(True, f"Final verification: Login with {ORIGINAL_PASSWORD} successful - password restored ✅")
            elif user_id.startswith("demo-"):
                print_result(False, f"Login succeeded but via demo fallback, not DB user")
                all_passed = False
            else:
                print_result(False, f"Login returned 200 but ok=false: {data}")
                all_passed = False
        else:
            print_result(False, f"Final login failed: {response.status_code}")
            all_passed = False
            print(f"⚠️  WARNING: Password may not be restored to {ORIGINAL_PASSWORD}!")
    except Exception as e:
        print_result(False, f"Request failed: {e}")
        all_passed = False

    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    if all_passed:
        print("✅ ALL TESTS PASSED")
        print(f"✅ Password for {TEST_EMAIL} restored to {ORIGINAL_PASSWORD}")
        sys.exit(0)
    else:
        print("❌ SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
