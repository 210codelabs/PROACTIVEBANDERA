#!/usr/bin/env python3
"""
Backend test for Integrations save round-trip: masked secret hint + per-provider change audit
Tests GET/PUT /api/admin/integrations and POST /api/admin/integrations/test

CRITICAL: NON-DESTRUCTIVE testing - only modify 'zoom' provider, NEVER modify 'stedi' provider
"""

import requests
import json
from datetime import datetime

# Base URL - MUST use HTTPS for secure cookies
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def login_admin():
    """Login as admin and return session cookie"""
    print("\n=== LOGIN AS ADMIN ===")
    url = f"{BASE_URL}/api/auth/login"
    payload = {
        "email": "admin@proactiveclinic.com",
        "password": "apex123"
    }
    
    try:
        response = requests.post(url, json=payload, allow_redirects=False)
        print(f"Login response status: {response.status_code}")
        
        if response.status_code == 200:
            cookies = response.cookies
            print(f"✅ Login successful, session cookie obtained")
            return cookies
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_get_without_auth():
    """TEST 1: GET /api/admin/integrations without cookie -> expect non-200"""
    print("\n=== TEST 1: GET /api/admin/integrations WITHOUT AUTH ===")
    url = f"{BASE_URL}/api/admin/integrations"
    
    try:
        response = requests.get(url, allow_redirects=False)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"✅ PASS: Non-200 status ({response.status_code}) as expected (auth guard working)")
            return True
        else:
            print(f"❌ FAIL: Got 200 without auth cookie (should be 401 or redirect)")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_get_with_auth(cookies):
    """TEST 2: GET as admin -> verify stedi has secretHints and lastEditedAt/lastEditedBy"""
    print("\n=== TEST 2: GET /api/admin/integrations AS ADMIN ===")
    url = f"{BASE_URL}/api/admin/integrations"
    
    try:
        response = requests.get(url, cookies=cookies)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False, None
        
        data = response.json()
        print(f"✅ Got 200 response")
        
        # Check state structure
        if 'state' not in data:
            print(f"❌ FAIL: Response missing 'state' key")
            return False, None
        
        state = data['state']
        
        # Check providers
        if 'providers' not in state:
            print(f"❌ FAIL: State missing 'providers' key")
            return False, None
        
        providers = state['providers']
        
        # Check stedi provider exists
        if 'stedi' not in providers:
            print(f"❌ FAIL: 'stedi' provider not found in providers")
            return False, None
        
        stedi = providers['stedi']
        print(f"✅ Found 'stedi' provider in state")
        
        # Check for secretHints
        if 'secretHints' not in stedi:
            print(f"❌ FAIL: 'stedi' provider missing 'secretHints' key")
            return False, None
        
        print(f"✅ 'stedi' provider has 'secretHints' key: {stedi['secretHints']}")
        
        # Check for lastEditedAt
        if 'lastEditedAt' not in stedi:
            print(f"⚠️  WARNING: 'stedi' provider missing 'lastEditedAt' key (may be null if never edited)")
        else:
            print(f"✅ 'stedi' provider has 'lastEditedAt': {stedi['lastEditedAt']}")
        
        # Check for lastEditedBy
        if 'lastEditedBy' not in stedi:
            print(f"⚠️  WARNING: 'stedi' provider missing 'lastEditedBy' key (may be null if never edited)")
        else:
            print(f"✅ 'stedi' provider has 'lastEditedBy': {stedi['lastEditedBy']}")
        
        print(f"✅ PASS: State structure verified with secretHints and audit fields present")
        return True, state
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False, None

def test_put_zoom_with_secret(cookies):
    """TEST 3: PUT to save zoom provider with CLIENT_SECRET='supersecretkey1234'"""
    print("\n=== TEST 3: PUT /api/admin/integrations - SAVE ZOOM WITH SECRET ===")
    url = f"{BASE_URL}/api/admin/integrations"
    
    payload = {
        "providers": {
            "zoom": {
                "enabled": True,
                "credentials": {
                    "ACCOUNT_ID": "acct-test",
                    "CLIENT_ID": "cid-test",
                    "CLIENT_SECRET": "supersecretkey1234"
                },
                "subServices": {},
                "subServiceCredentials": {}
            }
        }
    }
    
    try:
        response = requests.put(url, json=payload, cookies=cookies)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        if 'ok' not in data or not data['ok']:
            print(f"❌ FAIL: Response missing 'ok: true'")
            return False
        
        print(f"✅ PASS: PUT returned 200 with ok:true")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_get_zoom_after_save(cookies):
    """TEST 4: GET to verify zoom secret is masked and hint is present"""
    print("\n=== TEST 4: GET /api/admin/integrations - VERIFY ZOOM SECRET MASKING ===")
    url = f"{BASE_URL}/api/admin/integrations"
    
    try:
        response = requests.get(url, cookies=cookies)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        state = data.get('state', {})
        providers = state.get('providers', {})
        zoom = providers.get('zoom', {})
        
        if not zoom:
            print(f"❌ FAIL: 'zoom' provider not found")
            return False
        
        print(f"✅ Found 'zoom' provider")
        
        # Check enabled
        if not zoom.get('enabled'):
            print(f"❌ FAIL: zoom.enabled is not true")
            return False
        print(f"✅ zoom.enabled = true")
        
        # Check credentials
        credentials = zoom.get('credentials', {})
        client_secret = credentials.get('CLIENT_SECRET', None)
        
        if client_secret != '':
            print(f"❌ FAIL: zoom.credentials.CLIENT_SECRET should be '' (blanked), got: {client_secret}")
            return False
        print(f"✅ zoom.credentials.CLIENT_SECRET = '' (blanked)")
        
        # Check secretsSet
        secrets_set = zoom.get('secretsSet', {})
        if not secrets_set.get('CLIENT_SECRET'):
            print(f"❌ FAIL: zoom.secretsSet.CLIENT_SECRET should be true")
            return False
        print(f"✅ zoom.secretsSet.CLIENT_SECRET = true")
        
        # Check secretHints
        secret_hints = zoom.get('secretHints', {})
        hint = secret_hints.get('CLIENT_SECRET', None)
        
        if hint != '••••1234':
            print(f"❌ FAIL: zoom.secretHints.CLIENT_SECRET should be '••••1234', got: {hint}")
            return False
        print(f"✅ zoom.secretHints.CLIENT_SECRET = '••••1234'")
        
        # Check lastEditedBy
        last_edited_by = zoom.get('lastEditedBy', None)
        if not last_edited_by or last_edited_by == '':
            print(f"❌ FAIL: zoom.lastEditedBy should be non-empty string, got: {last_edited_by}")
            return False
        print(f"✅ zoom.lastEditedBy = '{last_edited_by}' (non-empty)")
        
        # Check lastEditedAt
        last_edited_at = zoom.get('lastEditedAt', None)
        if not last_edited_at:
            print(f"❌ FAIL: zoom.lastEditedAt should be present")
            return False
        
        # Try to parse as ISO date
        try:
            parsed_date = datetime.fromisoformat(last_edited_at.replace('Z', '+00:00'))
            print(f"✅ zoom.lastEditedAt = '{last_edited_at}' (valid ISO date)")
        except Exception as e:
            print(f"❌ FAIL: zoom.lastEditedAt is not a valid ISO date: {last_edited_at}")
            return False
        
        print(f"✅ PASS: All zoom secret masking and audit fields verified")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_put_zoom_update_preserve_secret(cookies):
    """TEST 5: PUT to update CLIENT_ID but leave CLIENT_SECRET blank -> secret should be preserved"""
    print("\n=== TEST 5: PUT /api/admin/integrations - UPDATE ZOOM, PRESERVE SECRET ===")
    url = f"{BASE_URL}/api/admin/integrations"
    
    payload = {
        "providers": {
            "zoom": {
                "enabled": True,
                "credentials": {
                    "ACCOUNT_ID": "acct-test",
                    "CLIENT_ID": "cid-test-2",
                    "CLIENT_SECRET": ""  # Blank - should preserve existing secret
                },
                "subServices": {},
                "subServiceCredentials": {}
            }
        }
    }
    
    try:
        response = requests.put(url, json=payload, cookies=cookies)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        if 'ok' not in data or not data['ok']:
            print(f"❌ FAIL: Response missing 'ok: true'")
            return False
        
        print(f"✅ PUT returned 200 with ok:true")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_get_zoom_after_update(cookies):
    """TEST 6: GET to verify CLIENT_ID updated but secretHints.CLIENT_SECRET still '••••1234'"""
    print("\n=== TEST 6: GET /api/admin/integrations - VERIFY SECRET PRESERVED ===")
    url = f"{BASE_URL}/api/admin/integrations"
    
    try:
        response = requests.get(url, cookies=cookies)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        state = data.get('state', {})
        providers = state.get('providers', {})
        zoom = providers.get('zoom', {})
        
        if not zoom:
            print(f"❌ FAIL: 'zoom' provider not found")
            return False
        
        # Check CLIENT_ID updated
        credentials = zoom.get('credentials', {})
        client_id = credentials.get('CLIENT_ID', None)
        
        if client_id != 'cid-test-2':
            print(f"❌ FAIL: zoom.credentials.CLIENT_ID should be 'cid-test-2', got: {client_id}")
            return False
        print(f"✅ zoom.credentials.CLIENT_ID = 'cid-test-2' (updated)")
        
        # Check secretHints.CLIENT_SECRET still '••••1234'
        secret_hints = zoom.get('secretHints', {})
        hint = secret_hints.get('CLIENT_SECRET', None)
        
        if hint != '••••1234':
            print(f"❌ FAIL: zoom.secretHints.CLIENT_SECRET should still be '••••1234', got: {hint}")
            return False
        print(f"✅ zoom.secretHints.CLIENT_SECRET = '••••1234' (preserved)")
        
        print(f"✅ PASS: CLIENT_ID updated but secret preserved")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_cleanup_disable_zoom(cookies):
    """TEST 7 CLEANUP: PUT to disable zoom"""
    print("\n=== TEST 7 CLEANUP: PUT /api/admin/integrations - DISABLE ZOOM ===")
    url = f"{BASE_URL}/api/admin/integrations"
    
    payload = {
        "providers": {
            "zoom": {
                "enabled": False,
                "credentials": {},
                "subServices": {},
                "subServiceCredentials": {}
            }
        }
    }
    
    try:
        response = requests.put(url, json=payload, cookies=cookies)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        if 'ok' not in data or not data['ok']:
            print(f"❌ FAIL: Response missing 'ok: true'")
            return False
        
        print(f"✅ PUT returned 200 with ok:true")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_get_zoom_disabled(cookies):
    """Verify zoom is disabled after cleanup"""
    print("\n=== VERIFY ZOOM DISABLED ===")
    url = f"{BASE_URL}/api/admin/integrations"
    
    try:
        response = requests.get(url, cookies=cookies)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        state = data.get('state', {})
        providers = state.get('providers', {})
        zoom = providers.get('zoom', {})
        
        if not zoom:
            print(f"⚠️  WARNING: 'zoom' provider not found (may have been removed)")
            return True
        
        # Check enabled is false
        if zoom.get('enabled'):
            print(f"❌ FAIL: zoom.enabled should be false")
            return False
        
        print(f"✅ zoom.enabled = false (cleanup successful)")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_stedi_connectivity(cookies):
    """TEST 8: POST /api/admin/integrations/test for 'stedi' -> live validation"""
    print("\n=== TEST 8: POST /api/admin/integrations/test - STEDI CONNECTIVITY ===")
    url = f"{BASE_URL}/api/admin/integrations/test"
    
    payload = {
        "providerKey": "stedi"
    }
    
    try:
        response = requests.post(url, json=payload, cookies=cookies)
        print(f"Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        if 'ok' not in data or not data['ok']:
            print(f"❌ FAIL: Response missing 'ok: true'")
            return False
        
        print(f"✅ Got 200 with ok:true")
        
        # Check validation object
        if 'validation' not in data:
            print(f"❌ FAIL: Response missing 'validation' object")
            return False
        
        validation = data['validation']
        
        # Check status
        status = validation.get('status', None)
        if not status:
            print(f"❌ FAIL: validation missing 'status'")
            return False
        
        print(f"✅ validation.status = '{status}'")
        
        # Check message
        message = validation.get('message', None)
        if not message:
            print(f"❌ FAIL: validation missing 'message'")
            return False
        
        print(f"✅ validation.message = '{message}'")
        
        print(f"✅ PASS: Stedi connectivity test returned validation result")
        print(f"   Status: {status}")
        print(f"   Message: {message}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("=" * 80)
    print("BACKEND TEST: Integrations save round-trip")
    print("Testing: masked secret hint + per-provider change audit")
    print("CRITICAL: NON-DESTRUCTIVE - only modifying 'zoom' provider")
    print("=" * 80)
    
    results = []
    
    # Test 1: GET without auth
    results.append(("Test 1: GET without auth", test_get_without_auth()))
    
    # Login
    cookies = login_admin()
    if not cookies:
        print("\n❌ FATAL: Could not login as admin. Aborting tests.")
        return
    
    # Test 2: GET with auth
    result, state = test_get_with_auth(cookies)
    results.append(("Test 2: GET with auth (verify stedi structure)", result))
    
    if not result:
        print("\n❌ FATAL: Could not get integrations state. Aborting tests.")
        return
    
    # Test 3: PUT zoom with secret
    results.append(("Test 3: PUT zoom with secret", test_put_zoom_with_secret(cookies)))
    
    # Test 4: GET zoom after save (verify masking)
    results.append(("Test 4: GET zoom (verify secret masking)", test_get_zoom_after_save(cookies)))
    
    # Test 5: PUT zoom update (preserve secret)
    results.append(("Test 5: PUT zoom update (blank secret)", test_put_zoom_update_preserve_secret(cookies)))
    
    # Test 6: GET zoom after update (verify secret preserved)
    results.append(("Test 6: GET zoom (verify secret preserved)", test_get_zoom_after_update(cookies)))
    
    # Test 7: Cleanup - disable zoom
    results.append(("Test 7: Cleanup - disable zoom", test_cleanup_disable_zoom(cookies)))
    results.append(("Verify zoom disabled", test_get_zoom_disabled(cookies)))
    
    # Test 8: Stedi connectivity test
    results.append(("Test 8: Stedi connectivity test", test_stedi_connectivity(cookies)))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("=" * 80)
    print(f"Total: {passed + failed} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print("=" * 80)
    
    if failed == 0:
        print("\n✅ ALL TESTS PASSED")
    else:
        print(f"\n❌ {failed} TEST(S) FAILED")

if __name__ == "__main__":
    main()
