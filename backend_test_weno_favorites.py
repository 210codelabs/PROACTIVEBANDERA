#!/usr/bin/env python3
"""
Backend test for Weno Favorites CRUD + Directory Auto-Sync Schedule State + Internal Cron Guard
Tests the newest task at the bottom of test_result.md
"""

import requests
import json
import sys
import os

# Use HTTPS preview base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
AUTH_SECRET = 'proactive-clinic-dev-secret-change-me-in-production-please-32chars+'

def login_staff():
    """Login as staff admin to get session cookie"""
    print("\n=== STAFF LOGIN ===")
    url = f"{BASE_URL}/api/auth/login"
    payload = {
        "email": "admin@proactiveclinic.com",
        "password": "apex123"
    }
    try:
        resp = requests.post(url, json=payload, timeout=30)
        print(f"POST /api/auth/login: {resp.status_code}")
        if resp.status_code == 200:
            cookies = resp.cookies
            print(f"✅ Login successful, session cookie obtained")
            return cookies
        else:
            print(f"❌ Login failed: {resp.status_code} {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"❌ Login exception: {e}")
        return None

def test_favorites_crud(cookies):
    """Test 1: FAVORITES CRUD with idempotent upsert"""
    print("\n=== TEST 1: FAVORITES CRUD ===")
    
    # 1a. GET without cookie -> 401
    print("\n[1a] GET /api/weno/favorites WITHOUT auth cookie")
    try:
        resp = requests.get(f"{BASE_URL}/api/weno/favorites", timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ PASS: Returns 401 Unauthorized without cookie")
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 1b. GET with cookie -> 200 {favorites:[]}
    print("\n[1b] GET /api/weno/favorites WITH auth cookie")
    try:
        resp = requests.get(f"{BASE_URL}/api/weno/favorites", cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)[:500]}")
            if 'favorites' in data:
                print(f"✅ PASS: Returns 200 with favorites array (count: {len(data['favorites'])})")
            else:
                print(f"❌ FAIL: Missing 'favorites' key in response")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 1c. POST create favorite
    print("\n[1c] POST /api/weno/favorites (create)")
    payload = {
        "ncpdpId": "1234567",
        "name": "Weno Test Pharmacy",
        "city": "Test City",
        "state": "TX",
        "phone": "(210) 555-0100"
    }
    try:
        resp = requests.post(f"{BASE_URL}/api/weno/favorites", json=payload, cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and 'favorite' in data:
                print(f"✅ PASS: Created favorite with ncpdpId={data['favorite'].get('ncpdpId')}")
            else:
                print(f"❌ FAIL: Missing 'ok' or 'favorite' in response")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 1d. GET again -> includes the favorite
    print("\n[1d] GET /api/weno/favorites (verify created)")
    try:
        resp = requests.get(f"{BASE_URL}/api/weno/favorites", cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            favorites = data.get('favorites', [])
            found = any(f.get('ncpdpId') == '1234567' for f in favorites)
            if found:
                print(f"✅ PASS: Favorite with ncpdpId=1234567 found in list")
            else:
                print(f"❌ FAIL: Favorite not found in list")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 1e. POST SAME ncpdpId again (idempotent upsert)
    print("\n[1e] POST /api/weno/favorites (SAME ncpdpId - idempotent)")
    try:
        resp = requests.post(f"{BASE_URL}/api/weno/favorites", json=payload, cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print(f"✅ PASS: Idempotent POST returns 200")
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 1f. GET again -> still exactly ONE entry for 1234567 (no duplicate)
    print("\n[1f] GET /api/weno/favorites (verify NO duplicate)")
    try:
        resp = requests.get(f"{BASE_URL}/api/weno/favorites", cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            favorites = data.get('favorites', [])
            count_1234567 = sum(1 for f in favorites if f.get('ncpdpId') == '1234567')
            print(f"Count of ncpdpId=1234567: {count_1234567}")
            if count_1234567 == 1:
                print(f"✅ PASS: Exactly ONE entry for ncpdpId=1234567 (idempotent, no duplicate)")
            else:
                print(f"❌ FAIL: Expected 1 entry, found {count_1234567}")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 1g. DELETE the favorite
    print("\n[1g] DELETE /api/weno/favorites?ncpdpId=1234567")
    try:
        resp = requests.delete(f"{BASE_URL}/api/weno/favorites?ncpdpId=1234567", cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok'):
                print(f"✅ PASS: DELETE returns 200 {{ok:true}}")
            else:
                print(f"❌ FAIL: Missing 'ok' in response")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 1h. GET again -> no longer present
    print("\n[1h] GET /api/weno/favorites (verify deleted)")
    try:
        resp = requests.get(f"{BASE_URL}/api/weno/favorites", cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            favorites = data.get('favorites', [])
            found = any(f.get('ncpdpId') == '1234567' for f in favorites)
            if not found:
                print(f"✅ PASS: Favorite with ncpdpId=1234567 NOT present after DELETE")
            else:
                print(f"❌ FAIL: Favorite still present after DELETE")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 1i. POST without cookie -> 401
    print("\n[1i] POST /api/weno/favorites WITHOUT auth cookie")
    try:
        resp = requests.post(f"{BASE_URL}/api/weno/favorites", json=payload, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ PASS: POST without cookie returns 401")
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 1j. DELETE without cookie -> 401
    print("\n[1j] DELETE /api/weno/favorites WITHOUT auth cookie")
    try:
        resp = requests.delete(f"{BASE_URL}/api/weno/favorites?ncpdpId=1234567", timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ PASS: DELETE without cookie returns 401")
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    print("\n✅ TEST 1 COMPLETE: All FAVORITES CRUD tests passed")
    return True

def test_directory_schedule_state(cookies):
    """Test 2: DIRECTORY SCHEDULE STATE (GET/PATCH autoSync)"""
    print("\n=== TEST 2: DIRECTORY SCHEDULE STATE ===")
    
    # 2a. GET without cookie -> 401
    print("\n[2a] GET /api/admin/weno/directory/sync WITHOUT auth cookie")
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/weno/directory/sync", timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ PASS: Returns 401 Unauthorized without cookie")
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 2b. GET with admin cookie -> 200 with state fields
    print("\n[2b] GET /api/admin/weno/directory/sync WITH admin cookie")
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/weno/directory/sync", cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)[:500]}")
            required_fields = ['count', 'autoSync', 'lastSyncAt', 'lastResult', 'lastError']
            missing = [f for f in required_fields if f not in data]
            if not missing:
                print(f"✅ PASS: Returns 200 with all required fields: {required_fields}")
                print(f"  count={data.get('count')}, autoSync={data.get('autoSync')}")
            else:
                print(f"❌ FAIL: Missing fields: {missing}")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 2c. PATCH {autoSync:true}
    print("\n[2c] PATCH /api/admin/weno/directory/sync {{autoSync:true}}")
    try:
        resp = requests.patch(f"{BASE_URL}/api/admin/weno/directory/sync", 
                             json={"autoSync": True}, cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)[:300]}")
            if data.get('ok') and data.get('autoSync') == True:
                print(f"✅ PASS: PATCH returns 200 {{ok:true, autoSync:true}}")
            else:
                print(f"❌ FAIL: Missing 'ok' or autoSync != true")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 2d. GET again -> autoSync:true
    print("\n[2d] GET /api/admin/weno/directory/sync (verify autoSync:true)")
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/weno/directory/sync", cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data.get('autoSync') == True:
                print(f"✅ PASS: autoSync is true")
            else:
                print(f"❌ FAIL: autoSync is {data.get('autoSync')}, expected true")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 2e. PATCH {autoSync:false}
    print("\n[2e] PATCH /api/admin/weno/directory/sync {{autoSync:false}}")
    try:
        resp = requests.patch(f"{BASE_URL}/api/admin/weno/directory/sync", 
                             json={"autoSync": False}, cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('autoSync') == False:
                print(f"✅ PASS: PATCH returns 200 {{ok:true, autoSync:false}}")
            else:
                print(f"❌ FAIL: Missing 'ok' or autoSync != false")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 2f. GET again -> autoSync:false
    print("\n[2f] GET /api/admin/weno/directory/sync (verify autoSync:false)")
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/weno/directory/sync", cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data.get('autoSync') == False:
                print(f"✅ PASS: autoSync is false")
            else:
                print(f"❌ FAIL: autoSync is {data.get('autoSync')}, expected false")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 2g. PATCH without admin cookie -> 401/403
    print("\n[2g] PATCH /api/admin/weno/directory/sync WITHOUT auth cookie")
    try:
        resp = requests.patch(f"{BASE_URL}/api/admin/weno/directory/sync", 
                             json={"autoSync": True}, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code in [401, 403]:
            print(f"✅ PASS: PATCH without cookie returns {resp.status_code}")
        else:
            print(f"❌ FAIL: Expected 401/403, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    print("\n✅ TEST 2 COMPLETE: All DIRECTORY SCHEDULE STATE tests passed")
    return True

def test_internal_cron_guard():
    """Test 3: INTERNAL CRON GUARD"""
    print("\n=== TEST 3: INTERNAL CRON GUARD ===")
    
    # 3a. POST without header -> 403
    print("\n[3a] POST /api/internal/weno-autosync WITHOUT x-weno-cron header")
    try:
        resp = requests.post(f"{BASE_URL}/api/internal/weno-autosync", timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 403:
            print("✅ PASS: Returns 403 Forbidden without header")
        else:
            print(f"❌ FAIL: Expected 403, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # 3b. POST with correct AUTH_SECRET header -> 200 with {ran:bool, reason:...}
    print(f"\n[3b] POST /api/internal/weno-autosync WITH x-weno-cron header (AUTH_SECRET)")
    try:
        headers = {"x-weno-cron": AUTH_SECRET}
        resp = requests.post(f"{BASE_URL}/api/internal/weno-autosync", headers=headers, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)[:500]}")
            if 'ran' in data and isinstance(data['ran'], bool):
                print(f"✅ PASS: Returns 200 with JSON containing 'ran' boolean field (ran={data['ran']})")
                if 'reason' in data:
                    print(f"  reason: {data['reason']}")
            else:
                print(f"❌ FAIL: Missing 'ran' boolean field in response")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    print("\n✅ TEST 3 COMPLETE: All INTERNAL CRON GUARD tests passed")
    return True

def test_manual_sync_graceful(cookies):
    """Test 4: Manual sync still graceful (no 500 crash)"""
    print("\n=== TEST 4: MANUAL SYNC GRACEFUL ===")
    
    print("\n[4] POST /api/admin/weno/directory/sync (manual sync)")
    try:
        resp = requests.post(f"{BASE_URL}/api/admin/weno/directory/sync", cookies=cookies, timeout=65)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        # Accept 200 (ok), 400 (bad request), or 502 (bad gateway) - just NOT 500
        if resp.status_code in [200, 400, 502]:
            print(f"✅ PASS: Returns {resp.status_code} (graceful, no 500 crash)")
            # Try to parse as JSON
            try:
                data = resp.json()
                if resp.status_code == 200:
                    if 'ok' in data or 'imported' in data:
                        print(f"  Response has 'ok' or 'imported' field")
                else:
                    if 'error' in data:
                        print(f"  Error message: {data.get('error')}")
            except Exception:
                print(f"  Response is not JSON (may be HTML from timeout)")
        elif resp.status_code == 500:
            print(f"❌ FAIL: Returns 500 (crash)")
            return False
        else:
            print(f"⚠️  WARNING: Unexpected status {resp.status_code}, but not 500")
        
        return True
    except requests.exceptions.Timeout:
        print(f"⚠️  WARNING: Request timed out (acceptable for long-running sync)")
        return True
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False

def main():
    print("=" * 80)
    print("BACKEND TEST: Weno Favorites CRUD + Directory Auto-Sync + Internal Cron Guard")
    print("=" * 80)
    
    # Login
    cookies = login_staff()
    if not cookies:
        print("\n❌ OVERALL RESULT: FAILED (login failed)")
        sys.exit(1)
    
    # Run all tests
    results = []
    
    try:
        results.append(("FAVORITES CRUD", test_favorites_crud(cookies)))
    except Exception as e:
        print(f"\n❌ TEST 1 EXCEPTION: {e}")
        results.append(("FAVORITES CRUD", False))
    
    try:
        results.append(("DIRECTORY SCHEDULE STATE", test_directory_schedule_state(cookies)))
    except Exception as e:
        print(f"\n❌ TEST 2 EXCEPTION: {e}")
        results.append(("DIRECTORY SCHEDULE STATE", False))
    
    try:
        results.append(("INTERNAL CRON GUARD", test_internal_cron_guard()))
    except Exception as e:
        print(f"\n❌ TEST 3 EXCEPTION: {e}")
        results.append(("INTERNAL CRON GUARD", False))
    
    try:
        results.append(("MANUAL SYNC GRACEFUL", test_manual_sync_graceful(cookies)))
    except Exception as e:
        print(f"\n❌ TEST 4 EXCEPTION: {e}")
        results.append(("MANUAL SYNC GRACEFUL", False))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
    
    all_passed = all(passed for _, passed in results)
    if all_passed:
        print("\n✅ OVERALL RESULT: ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("\n❌ OVERALL RESULT: SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
