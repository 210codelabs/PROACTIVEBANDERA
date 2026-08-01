#!/usr/bin/env python3
"""
Backend test for Iteration 7: White-label Setup Wizard endpoints
- /api/site-config (GET/PUT, admin only)
- /api/site-config/assets (POST, admin only)
- /api/branding/[key] (GET, public)
"""

import requests
import json
import base64

# MUST use HTTPS because session cookie has secure:true
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Admin credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

# Provider (non-admin) credentials
PROVIDER_EMAIL = "andy.manzano@proactiveclinic.com"
PROVIDER_PASSWORD = "apex123"

def login_admin():
    """Login as admin and return session"""
    print("\n=== Admin Login ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        print(f"Admin login status: {resp.status_code}")
        if resp.status_code == 200:
            cookies = resp.cookies
            print(f"Admin login successful, cookie: {cookies.get('proactive_session')[:20] if cookies.get('proactive_session') else 'None'}...")
            return requests.Session(), cookies
        else:
            print(f"Admin login failed: {resp.text}")
            return None, None
    except Exception as e:
        print(f"Admin login error: {e}")
        return None, None

def login_provider():
    """Login as provider (non-admin) and return session"""
    print("\n=== Provider Login ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": PROVIDER_EMAIL, "password": PROVIDER_PASSWORD},
            timeout=10
        )
        print(f"Provider login status: {resp.status_code}")
        if resp.status_code == 200:
            cookies = resp.cookies
            print(f"Provider login successful, cookie: {cookies.get('proactive_session')[:20] if cookies.get('proactive_session') else 'None'}...")
            return requests.Session(), cookies
        else:
            print(f"Provider login failed: {resp.text}")
            return None, None
    except Exception as e:
        print(f"Provider login error: {e}")
        return None, None

def test_site_config_get_admin(session, cookies):
    """Test A: Admin GET /api/site-config -> 200 with config"""
    print("\n=== Test A: Admin GET /api/site-config ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/site-config",
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response keys: {list(data.keys())}")
            
            if 'config' in data:
                config = data['config']
                print(f"Config keys: {list(config.keys())}")
                
                # Verify required fields
                checks = []
                checks.append(('identity' in config, "config.identity exists"))
                checks.append(('colors' in config, "config.colors exists"))
                checks.append(('modules' in config, "config.modules exists"))
                checks.append(('setupComplete' in config, "config.setupComplete exists"))
                
                if 'identity' in config:
                    checks.append(('clinicName' in config['identity'], "config.identity.clinicName exists"))
                    print(f"clinicName: {config['identity'].get('clinicName')}")
                
                if 'colors' in config:
                    checks.append(('primary' in config['colors'], "config.colors.primary exists"))
                    print(f"colors.primary: {config['colors'].get('primary')}")
                
                for passed, msg in checks:
                    print(f"  {'✅' if passed else '❌'} {msg}")
                
                if all(c[0] for c in checks):
                    print("✅ Test A PASSED: Admin GET returns config with all required fields")
                    return True, config
                else:
                    print("❌ Test A FAILED: Missing required fields")
                    return False, None
            else:
                print("❌ Test A FAILED: No 'config' in response")
                return False, None
        else:
            print(f"❌ Test A FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False, None
    except Exception as e:
        print(f"❌ Test A ERROR: {e}")
        return False, None

def test_site_config_put_deep_merge(session, cookies):
    """Test B: Admin PUT with partial update, verify deep merge"""
    print("\n=== Test B: Admin PUT /api/site-config (deep merge) ===")
    try:
        # First, PUT a partial update
        update_data = {
            "identity": {"clinicName": "Test Clinic"},
            "colors": {"primary": "#7c3aed"}
        }
        
        print(f"Sending PUT with: {json.dumps(update_data)}")
        resp = requests.put(
            f"{BASE_URL}/api/site-config",
            json=update_data,
            cookies=cookies,
            timeout=10
        )
        print(f"PUT status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"PUT response keys: {list(data.keys())}")
            
            if 'ok' in data and data['ok'] and 'config' in data:
                print("✅ PUT returned {ok:true, config}")
                
                # Now GET to verify deep merge
                print("\nVerifying deep merge with GET...")
                resp_get = requests.get(
                    f"{BASE_URL}/api/site-config",
                    cookies=cookies,
                    timeout=10
                )
                
                if resp_get.status_code == 200:
                    get_data = resp_get.json()
                    config = get_data.get('config', {})
                    
                    # Verify updated fields
                    clinic_name = config.get('identity', {}).get('clinicName')
                    primary_color = config.get('colors', {}).get('primary')
                    
                    print(f"clinicName after PUT: {clinic_name}")
                    print(f"colors.primary after PUT: {primary_color}")
                    
                    # Verify preserved fields (deep merge)
                    phone = config.get('identity', {}).get('phone')
                    city = config.get('identity', {}).get('city')
                    division = config.get('identity', {}).get('division')
                    secondary = config.get('colors', {}).get('secondary')
                    accent = config.get('colors', {}).get('accent')
                    
                    print(f"\nPreserved fields (should NOT be wiped):")
                    print(f"  identity.phone: {phone}")
                    print(f"  identity.city: {city}")
                    print(f"  identity.division: {division}")
                    print(f"  colors.secondary: {secondary}")
                    print(f"  colors.accent: {accent}")
                    
                    checks = [
                        (clinic_name == "Test Clinic", "clinicName updated to 'Test Clinic'"),
                        (primary_color == "#7c3aed", "colors.primary updated to '#7c3aed'"),
                        (phone is not None and phone != "", "identity.phone preserved"),
                        (city is not None and city != "", "identity.city preserved"),
                        (division is not None and division != "", "identity.division preserved"),
                        (secondary is not None and secondary != "", "colors.secondary preserved"),
                        (accent is not None and accent != "", "colors.accent preserved")
                    ]
                    
                    for passed, msg in checks:
                        print(f"  {'✅' if passed else '❌'} {msg}")
                    
                    if all(c[0] for c in checks):
                        print("✅ Test B PASSED: Deep merge working correctly")
                        return True
                    else:
                        print("❌ Test B FAILED: Deep merge not working correctly")
                        return False
                else:
                    print(f"❌ Test B FAILED: GET after PUT returned {resp_get.status_code}")
                    return False
            else:
                print(f"❌ Test B FAILED: PUT response missing ok:true or config: {data}")
                return False
        else:
            print(f"❌ Test B FAILED: PUT returned {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Test B ERROR: {e}")
        return False

def test_site_config_provider_403(provider_session, provider_cookies):
    """Test C: Provider (non-admin) GET/PUT -> 403"""
    print("\n=== Test C: Provider (non-admin) GET/PUT -> 403 ===")
    try:
        # Test GET
        print("Testing Provider GET...")
        resp_get = requests.get(
            f"{BASE_URL}/api/site-config",
            cookies=provider_cookies,
            timeout=10
        )
        print(f"Provider GET status: {resp_get.status_code}")
        
        get_passed = resp_get.status_code == 403
        print(f"  {'✅' if get_passed else '❌'} Provider GET returns 403")
        
        # Test PUT
        print("\nTesting Provider PUT...")
        resp_put = requests.put(
            f"{BASE_URL}/api/site-config",
            json={"identity": {"clinicName": "Hacker Clinic"}},
            cookies=provider_cookies,
            timeout=10
        )
        print(f"Provider PUT status: {resp_put.status_code}")
        
        put_passed = resp_put.status_code == 403
        print(f"  {'✅' if put_passed else '❌'} Provider PUT returns 403")
        
        if get_passed and put_passed:
            print("✅ Test C PASSED: Provider correctly blocked with 403")
            return True
        else:
            print("❌ Test C FAILED: Provider not blocked correctly")
            return False
    except Exception as e:
        print(f"❌ Test C ERROR: {e}")
        return False

def test_site_config_no_session_401():
    """Test D: No session GET/PUT -> 401"""
    print("\n=== Test D: No session GET/PUT -> 401 ===")
    try:
        # Test GET without session
        print("Testing GET without session...")
        resp_get = requests.get(
            f"{BASE_URL}/api/site-config",
            timeout=10
        )
        print(f"No-session GET status: {resp_get.status_code}")
        
        get_passed = resp_get.status_code == 401
        print(f"  {'✅' if get_passed else '❌'} No-session GET returns 401")
        
        # Test PUT without session
        print("\nTesting PUT without session...")
        resp_put = requests.put(
            f"{BASE_URL}/api/site-config",
            json={"identity": {"clinicName": "Hacker Clinic"}},
            timeout=10
        )
        print(f"No-session PUT status: {resp_put.status_code}")
        
        put_passed = resp_put.status_code == 401
        print(f"  {'✅' if put_passed else '❌'} No-session PUT returns 401")
        
        if get_passed and put_passed:
            print("✅ Test D PASSED: No session correctly blocked with 401")
            return True
        else:
            print("❌ Test D FAILED: No session not blocked correctly")
            return False
    except Exception as e:
        print(f"❌ Test D ERROR: {e}")
        return False

def test_asset_upload_admin(session, cookies):
    """Test E: Admin POST /api/site-config/assets with valid PNG"""
    print("\n=== Test E: Admin POST /api/site-config/assets ===")
    try:
        # Create a minimal 1x1 PNG (valid PNG header + IDAT + IEND)
        # This is a valid 1x1 transparent PNG
        png_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        png_base64 = base64.b64encode(png_bytes).decode('utf-8')
        
        print(f"PNG base64 length: {len(png_base64)} chars")
        
        upload_data = {
            "key": "logo-header",
            "dataBase64": png_base64,
            "mimeType": "image/png",
            "size": len(png_bytes)
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/site-config/assets",
            json=upload_data,
            cookies=cookies,
            timeout=10
        )
        print(f"POST status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            checks = [
                ('ok' in data and data['ok'], "ok:true"),
                ('key' in data and data['key'] == 'logo-header', "key:'logo-header'"),
                ('url' in data and '/api/branding/logo-header' in data['url'], "url contains '/api/branding/logo-header'")
            ]
            
            for passed, msg in checks:
                print(f"  {'✅' if passed else '❌'} {msg}")
            
            if all(c[0] for c in checks):
                print("✅ Test E PASSED: Admin asset upload successful")
                return True, data.get('url')
            else:
                print("❌ Test E FAILED: Response missing required fields")
                return False, None
        else:
            print(f"❌ Test E FAILED: Expected 200, got {resp.status_code}: {resp.text}")
            return False, None
    except Exception as e:
        print(f"❌ Test E ERROR: {e}")
        return False, None

def test_asset_public_serve():
    """Test F: GET /api/branding/logo-header with NO session -> 200 image/png"""
    print("\n=== Test F: GET /api/branding/logo-header (public, no session) ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/branding/logo-header",
            timeout=10
        )
        print(f"GET status: {resp.status_code}")
        print(f"Content-Type: {resp.headers.get('Content-Type')}")
        print(f"Content-Length: {resp.headers.get('Content-Length')}")
        print(f"Body length: {len(resp.content)} bytes")
        
        checks = [
            (resp.status_code == 200, "Status 200"),
            ('image/png' in resp.headers.get('Content-Type', ''), "Content-Type is image/png"),
            (len(resp.content) > 0, "Body contains data")
        ]
        
        for passed, msg in checks:
            print(f"  {'✅' if passed else '❌'} {msg}")
        
        if all(c[0] for c in checks):
            print("✅ Test F PASSED: Public asset serving working")
            return True
        else:
            print("❌ Test F FAILED: Public asset serving not working correctly")
            return False
    except Exception as e:
        print(f"❌ Test F ERROR: {e}")
        return False

def test_asset_upload_missing_data(session, cookies):
    """Test G: Admin POST missing dataBase64 -> 400"""
    print("\n=== Test G: Admin POST missing dataBase64 -> 400 ===")
    try:
        upload_data = {
            "key": "logo-header",
            "mimeType": "image/png"
            # Missing dataBase64
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/site-config/assets",
            json=upload_data,
            cookies=cookies,
            timeout=10
        )
        print(f"POST status: {resp.status_code}")
        
        if resp.status_code == 400:
            print(f"Response: {resp.text}")
            print("✅ Test G PASSED: Missing dataBase64 returns 400")
            return True
        else:
            print(f"❌ Test G FAILED: Expected 400, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Test G ERROR: {e}")
        return False

def test_asset_upload_provider_403(provider_session, provider_cookies):
    """Test H: Provider POST -> 403"""
    print("\n=== Test H: Provider POST /api/site-config/assets -> 403 ===")
    try:
        png_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        png_base64 = base64.b64encode(png_bytes).decode('utf-8')
        
        upload_data = {
            "key": "test-logo",
            "dataBase64": png_base64,
            "mimeType": "image/png",
            "size": len(png_bytes)
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/site-config/assets",
            json=upload_data,
            cookies=provider_cookies,
            timeout=10
        )
        print(f"Provider POST status: {resp.status_code}")
        
        if resp.status_code == 403:
            print("✅ Test H PASSED: Provider POST returns 403")
            return True
        else:
            print(f"❌ Test H FAILED: Expected 403, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Test H ERROR: {e}")
        return False

def test_asset_upload_no_session_401():
    """Test I: No session POST -> 401"""
    print("\n=== Test I: No session POST /api/site-config/assets -> 401 ===")
    try:
        png_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        png_base64 = base64.b64encode(png_bytes).decode('utf-8')
        
        upload_data = {
            "key": "test-logo",
            "dataBase64": png_base64,
            "mimeType": "image/png",
            "size": len(png_bytes)
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/site-config/assets",
            json=upload_data,
            timeout=10
        )
        print(f"No-session POST status: {resp.status_code}")
        
        if resp.status_code == 401:
            print("✅ Test I PASSED: No session POST returns 401")
            return True
        else:
            print(f"❌ Test I FAILED: Expected 401, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Test I ERROR: {e}")
        return False

def test_asset_nonexistent_404():
    """Test J: GET /api/branding/nonexistent-key-xyz -> 404"""
    print("\n=== Test J: GET /api/branding/nonexistent-key-xyz -> 404 ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/branding/nonexistent-key-xyz",
            timeout=10
        )
        print(f"GET status: {resp.status_code}")
        
        if resp.status_code == 404:
            print("✅ Test J PASSED: Nonexistent asset returns 404")
            return True
        else:
            print(f"❌ Test J FAILED: Expected 404, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Test J ERROR: {e}")
        return False

def cleanup_restore_defaults(session, cookies):
    """Cleanup: Restore site_config to defaults"""
    print("\n=== CLEANUP: Restore site_config to defaults ===")
    try:
        default_config = {
            "identity": {"clinicName": "Proactive Clinic"},
            "colors": {"primary": "#1872f0"},
            "setupComplete": False
        }
        
        resp = requests.put(
            f"{BASE_URL}/api/site-config",
            json=default_config,
            cookies=cookies,
            timeout=10
        )
        print(f"Restore PUT status: {resp.status_code}")
        
        if resp.status_code == 200:
            # Verify restoration
            resp_get = requests.get(
                f"{BASE_URL}/api/site-config",
                cookies=cookies,
                timeout=10
            )
            
            if resp_get.status_code == 200:
                config = resp_get.json().get('config', {})
                clinic_name = config.get('identity', {}).get('clinicName')
                primary = config.get('colors', {}).get('primary')
                setup_complete = config.get('setupComplete')
                
                print(f"Restored clinicName: {clinic_name}")
                print(f"Restored colors.primary: {primary}")
                print(f"Restored setupComplete: {setup_complete}")
                
                if clinic_name == "Proactive Clinic" and primary == "#1872f0" and setup_complete == False:
                    print("✅ CLEANUP: site_config restored to defaults")
                    return True
                else:
                    print("⚠️ CLEANUP: site_config may not be fully restored")
                    return False
            else:
                print(f"⚠️ CLEANUP: Could not verify restoration (GET returned {resp_get.status_code})")
                return False
        else:
            print(f"⚠️ CLEANUP: Restore failed ({resp.status_code}): {resp.text}")
            return False
    except Exception as e:
        print(f"⚠️ CLEANUP ERROR: {e}")
        return False

def main():
    print("=" * 80)
    print("Backend Test: Iteration 7 - White-label Setup Wizard")
    print("=" * 80)
    
    results = []
    
    # Login as admin
    admin_session, admin_cookies = login_admin()
    if not admin_session or not admin_cookies:
        print("\n❌ FATAL: Admin login failed, cannot continue")
        return
    
    # Login as provider
    provider_session, provider_cookies = login_provider()
    if not provider_session or not provider_cookies:
        print("\n❌ FATAL: Provider login failed, cannot continue")
        return
    
    # Test site-config endpoints
    print("\n" + "=" * 80)
    print("TESTING /api/site-config")
    print("=" * 80)
    
    passed, original_config = test_site_config_get_admin(admin_session, admin_cookies)
    results.append(("Test A: Admin GET /api/site-config", passed))
    
    passed = test_site_config_put_deep_merge(admin_session, admin_cookies)
    results.append(("Test B: Admin PUT deep merge", passed))
    
    passed = test_site_config_provider_403(provider_session, provider_cookies)
    results.append(("Test C: Provider GET/PUT -> 403", passed))
    
    passed = test_site_config_no_session_401()
    results.append(("Test D: No session GET/PUT -> 401", passed))
    
    # Test asset upload endpoints
    print("\n" + "=" * 80)
    print("TESTING /api/site-config/assets and /api/branding/[key]")
    print("=" * 80)
    
    passed, asset_url = test_asset_upload_admin(admin_session, admin_cookies)
    results.append(("Test E: Admin POST asset upload", passed))
    
    passed = test_asset_public_serve()
    results.append(("Test F: Public GET /api/branding/logo-header", passed))
    
    passed = test_asset_upload_missing_data(admin_session, admin_cookies)
    results.append(("Test G: POST missing dataBase64 -> 400", passed))
    
    passed = test_asset_upload_provider_403(provider_session, provider_cookies)
    results.append(("Test H: Provider POST -> 403", passed))
    
    passed = test_asset_upload_no_session_401()
    results.append(("Test I: No session POST -> 401", passed))
    
    passed = test_asset_nonexistent_404()
    results.append(("Test J: GET nonexistent asset -> 404", passed))
    
    # Cleanup
    print("\n" + "=" * 80)
    print("CLEANUP")
    print("=" * 80)
    
    cleanup_passed = cleanup_restore_defaults(admin_session, admin_cookies)
    results.append(("Cleanup: Restore defaults", cleanup_passed))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for test_name, passed in results:
        print(f"{'✅' if passed else '❌'} {test_name}")
    
    print(f"\nTotal: {passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️ {total_count - passed_count} test(s) failed")

if __name__ == "__main__":
    main()
