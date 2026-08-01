#!/usr/bin/env python3
"""
Backend test for Iteration 8: Admin-only installer download endpoint
Tests GET /api/admin/installer with admin/provider/no-auth scenarios
Also verifies white-label routes were removed (regression)
"""

import requests
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_admin_installer_download():
    """Test 1: Admin user can download installer zip"""
    print("\n=== TEST 1: Admin installer download (200 + zip) ===")
    
    # Login as admin
    login_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@proactiveclinic.com", "password": "apex123"},
        allow_redirects=False
    )
    
    if login_resp.status_code != 200:
        print(f"❌ Admin login failed: {login_resp.status_code} {login_resp.text}")
        return False
    
    admin_cookie = login_resp.cookies.get("proactive_session")
    if not admin_cookie:
        print("❌ Admin login did not set proactive_session cookie")
        return False
    
    print(f"✅ Admin login successful, cookie: {admin_cookie[:20]}...")
    
    # GET /api/admin/installer
    installer_resp = requests.get(
        f"{BASE_URL}/api/admin/installer",
        cookies={"proactive_session": admin_cookie},
        allow_redirects=False
    )
    
    if installer_resp.status_code != 200:
        print(f"❌ GET /api/admin/installer failed: {installer_resp.status_code}")
        print(f"Response: {installer_resp.text[:500]}")
        return False
    
    print(f"✅ GET /api/admin/installer returned 200")
    
    # Check Content-Type
    content_type = installer_resp.headers.get("Content-Type", "")
    if content_type != "application/zip":
        print(f"❌ Content-Type is '{content_type}', expected 'application/zip'")
        return False
    
    print(f"✅ Content-Type is 'application/zip'")
    
    # Check Content-Disposition
    content_disp = installer_resp.headers.get("Content-Disposition", "")
    if "attachment" not in content_disp:
        print(f"❌ Content-Disposition missing 'attachment': {content_disp}")
        return False
    
    if "clinic-installer.zip" not in content_disp:
        print(f"❌ Content-Disposition missing 'clinic-installer.zip': {content_disp}")
        return False
    
    print(f"✅ Content-Disposition contains 'attachment' and 'clinic-installer.zip'")
    
    # Check body is non-empty and starts with ZIP magic bytes 'PK'
    body = installer_resp.content
    if len(body) == 0:
        print("❌ Response body is empty")
        return False
    
    print(f"✅ Response body is non-empty: {len(body)} bytes ({len(body) / 1024 / 1024:.2f} MB)")
    
    # Verify ZIP magic bytes
    if not body.startswith(b'PK'):
        print(f"❌ Body does not start with ZIP magic bytes 'PK', starts with: {body[:10]}")
        return False
    
    print(f"✅ Body starts with ZIP magic bytes 'PK' (valid ZIP file)")
    
    # Verify size is several MB (at least 1 MB)
    if len(body) < 1024 * 1024:
        print(f"❌ Body size is too small: {len(body)} bytes (expected several MB)")
        return False
    
    print(f"✅ Body size is appropriate for installer package")
    
    return True


def test_provider_installer_forbidden():
    """Test 2: Provider (non-admin) gets 403"""
    print("\n=== TEST 2: Provider (non-admin) gets 403 ===")
    
    # Login as provider
    login_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "andy.manzano@proactiveclinic.com", "password": "apex123"},
        allow_redirects=False
    )
    
    if login_resp.status_code != 200:
        print(f"❌ Provider login failed: {login_resp.status_code} {login_resp.text}")
        return False
    
    provider_cookie = login_resp.cookies.get("proactive_session")
    if not provider_cookie:
        print("❌ Provider login did not set proactive_session cookie")
        return False
    
    print(f"✅ Provider login successful")
    
    # GET /api/admin/installer as provider
    installer_resp = requests.get(
        f"{BASE_URL}/api/admin/installer",
        cookies={"proactive_session": provider_cookie},
        allow_redirects=False
    )
    
    if installer_resp.status_code != 403:
        print(f"❌ Expected 403, got {installer_resp.status_code}")
        print(f"Response: {installer_resp.text[:500]}")
        return False
    
    print(f"✅ Provider correctly blocked with 403")
    
    # Verify error message
    try:
        data = installer_resp.json()
        if "error" in data and "Admin" in data["error"]:
            print(f"✅ Error message mentions admin requirement: {data['error']}")
        else:
            print(f"⚠️  Error message: {data}")
    except Exception:
        pass
    
    return True


def test_no_session_unauthorized():
    """Test 3: No session gets 401"""
    print("\n=== TEST 3: No session gets 401 ===")
    
    # GET /api/admin/installer without session
    installer_resp = requests.get(
        f"{BASE_URL}/api/admin/installer",
        allow_redirects=False
    )
    
    if installer_resp.status_code != 401:
        print(f"❌ Expected 401, got {installer_resp.status_code}")
        print(f"Response: {installer_resp.text[:500]}")
        return False
    
    print(f"✅ No session correctly blocked with 401")
    
    # Verify error message
    try:
        data = installer_resp.json()
        if "error" in data and "Unauthorized" in data["error"]:
            print(f"✅ Error message: {data['error']}")
        else:
            print(f"⚠️  Error message: {data}")
    except Exception:
        pass
    
    return True


def test_whitelabel_routes_removed():
    """Test 4: Regression - white-label routes should return 404"""
    print("\n=== TEST 4: Regression - white-label routes removed ===")
    
    all_passed = True
    
    # First, login as admin to get past middleware
    login_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@proactiveclinic.com", "password": "apex123"},
        allow_redirects=False
    )
    
    admin_cookie = login_resp.cookies.get("proactive_session")
    if not admin_cookie:
        print("❌ Could not get admin session for regression test")
        return False
    
    print("✅ Got admin session for regression test")
    
    # Test /api/site-config with auth (should be 404 if route doesn't exist)
    print("\nTesting GET /api/site-config (with auth)...")
    resp = requests.get(
        f"{BASE_URL}/api/site-config",
        cookies={"proactive_session": admin_cookie},
        allow_redirects=False
    )
    
    if resp.status_code != 404:
        print(f"❌ GET /api/site-config returned {resp.status_code}, expected 404")
        print(f"Response: {resp.text[:500]}")
        all_passed = False
    else:
        print(f"✅ GET /api/site-config correctly returns 404 (route removed)")
    
    # Test /api/branding/logo-header with auth (should be 404 if route doesn't exist)
    print("\nTesting GET /api/branding/logo-header (with auth)...")
    resp = requests.get(
        f"{BASE_URL}/api/branding/logo-header",
        cookies={"proactive_session": admin_cookie},
        allow_redirects=False
    )
    
    if resp.status_code != 404:
        print(f"❌ GET /api/branding/logo-header returned {resp.status_code}, expected 404")
        print(f"Response: {resp.text[:500]}")
        all_passed = False
    else:
        print(f"✅ GET /api/branding/logo-header correctly returns 404 (route removed)")
    
    return all_passed


def main():
    print("=" * 80)
    print("BACKEND TEST: Admin Installer Download (Iteration 8)")
    print("=" * 80)
    
    results = []
    
    # Run all tests
    results.append(("Admin installer download (200 + zip)", test_admin_installer_download()))
    results.append(("Provider gets 403", test_provider_installer_forbidden()))
    results.append(("No session gets 401", test_no_session_unauthorized()))
    results.append(("White-label routes removed (404)", test_whitelabel_routes_removed()))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
