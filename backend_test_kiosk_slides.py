#!/usr/bin/env python3
"""
Backend test for Kiosk Slide Configuration API
Endpoint: /api/kiosk/slides
Base URL: http://localhost:3000
"""

import requests
import json

# Use HTTPS URL because session cookie has secure:true flag
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def print_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"  {details}")

def test_case_a_get_public_no_auth():
    """(A) GET /api/kiosk/slides with NO auth -> expect 200 JSON with config and catalog"""
    print("\n=== TEST CASE A: GET /api/kiosk/slides (no auth) ===")
    try:
        response = requests.get(f"{BASE_URL}/api/kiosk/slides")
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_test("GET without auth returns 200", False, f"Got {response.status_code}")
            return False
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check structure
        if "config" not in data:
            print_test("Response has 'config' field", False, "Missing 'config'")
            return False
        print_test("Response has 'config' field", True)
        
        if "catalog" not in data:
            print_test("Response has 'catalog' field", False, "Missing 'catalog'")
            return False
        print_test("Response has 'catalog' field", True)
        
        # Check config is array
        if not isinstance(data["config"], list):
            print_test("config is array", False, f"Got {type(data['config'])}")
            return False
        print_test("config is array", True)
        
        # Check catalog is array
        if not isinstance(data["catalog"], list):
            print_test("catalog is array", False, f"Got {type(data['catalog'])}")
            return False
        print_test("catalog is array", True)
        
        # Check default config has 9 slides
        config = data["config"]
        if len(config) != 9:
            print_test("Default config has 9 slides", False, f"Got {len(config)} slides")
            return False
        print_test("Default config has 9 slides", True)
        
        # Check all slides are enabled
        all_enabled = all(item.get("enabled") == True for item in config)
        if not all_enabled:
            print_test("All slides enabled by default", False, "Some slides disabled")
            return False
        print_test("All slides enabled by default", True)
        
        # Check order: welcome, dot, physical, pain, chiropractic, iv, telehealth, primary, security
        expected_order = ["welcome", "dot", "physical", "pain", "chiropractic", "iv", "telehealth", "primary", "security"]
        actual_order = [item.get("id") for item in config]
        if actual_order != expected_order:
            print_test("Default order correct", False, f"Expected {expected_order}, got {actual_order}")
            return False
        print_test("Default order correct", True, f"Order: {actual_order}")
        
        # Check catalog structure
        catalog = data["catalog"]
        if len(catalog) != 9:
            print_test("Catalog has 9 entries", False, f"Got {len(catalog)} entries")
            return False
        print_test("Catalog has 9 entries", True)
        
        # Check catalog items have id, label, kind
        for item in catalog:
            if not all(k in item for k in ["id", "label", "kind"]):
                print_test("Catalog items have id/label/kind", False, f"Missing fields in {item}")
                return False
        print_test("Catalog items have id/label/kind", True)
        
        print_test("TEST CASE A", True, "GET without auth works correctly")
        return True
        
    except Exception as e:
        print_test("TEST CASE A", False, f"Exception: {str(e)}")
        return False

def test_case_b_put_no_auth():
    """(B) PUT /api/kiosk/slides with NO auth -> expect 401"""
    print("\n=== TEST CASE B: PUT /api/kiosk/slides (no auth) ===")
    try:
        payload = {"config": [{"id": "welcome", "enabled": True}]}
        response = requests.put(f"{BASE_URL}/api/kiosk/slides", json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 401:
            print_test("PUT without auth returns 401", False, f"Got {response.status_code}")
            return False
        
        print_test("TEST CASE B", True, "PUT without auth correctly blocked with 401")
        return True
        
    except Exception as e:
        print_test("TEST CASE B", False, f"Exception: {str(e)}")
        return False

def staff_login():
    """Helper: Login as staff and return session cookie"""
    print("\n=== Staff Login ===")
    try:
        payload = {
            "email": "andy.manzano@proactiveclinic.com",
            "password": "apex123"
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        print(f"Login status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Login failed: {response.text}")
            return None
        
        # Get the proactive_session cookie
        cookies = response.cookies
        if "proactive_session" not in cookies:
            print("No proactive_session cookie in response")
            return None
        
        print("✅ Staff login successful")
        return cookies
        
    except Exception as e:
        print(f"Login exception: {str(e)}")
        return None

def test_case_c_put_with_auth_reorder():
    """(C) Staff login, PUT with reorder, verify persisted config"""
    print("\n=== TEST CASE C: PUT /api/kiosk/slides (authenticated, reorder) ===")
    try:
        # Login
        cookies = staff_login()
        if not cookies:
            print_test("TEST CASE C", False, "Staff login failed")
            return False
        
        # PUT with chiropractic first, welcome disabled
        payload = {
            "config": [
                {"id": "chiropractic", "enabled": True},
                {"id": "welcome", "enabled": False}
            ]
        }
        response = requests.put(f"{BASE_URL}/api/kiosk/slides", json=payload, cookies=cookies)
        print(f"PUT status: {response.status_code}")
        print(f"PUT response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code != 200:
            print_test("PUT with auth returns 200", False, f"Got {response.status_code}")
            return False
        print_test("PUT with auth returns 200", True)
        
        data = response.json()
        if not data.get("ok"):
            print_test("Response has ok:true", False, f"Got {data}")
            return False
        print_test("Response has ok:true", True)
        
        if "config" not in data:
            print_test("Response has config", False, "Missing config")
            return False
        print_test("Response has config", True)
        
        # Verify the returned config
        config = data["config"]
        print(f"Returned config: {json.dumps(config, indent=2)}")
        
        # Check total is 9 entries
        if len(config) != 9:
            print_test("Config has 9 entries", False, f"Got {len(config)} entries")
            return False
        print_test("Config has 9 entries", True)
        
        # Check chiropractic is FIRST
        if config[0].get("id") != "chiropractic":
            print_test("chiropractic is first", False, f"First is {config[0].get('id')}")
            return False
        print_test("chiropractic is first", True)
        
        # Check chiropractic is enabled
        if config[0].get("enabled") != True:
            print_test("chiropractic is enabled", False, f"enabled={config[0].get('enabled')}")
            return False
        print_test("chiropractic is enabled", True)
        
        # Find welcome in config
        welcome_item = next((item for item in config if item.get("id") == "welcome"), None)
        if not welcome_item:
            print_test("welcome is in config", False, "welcome not found")
            return False
        print_test("welcome is in config", True)
        
        # Check welcome is disabled
        if welcome_item.get("enabled") != False:
            print_test("welcome is disabled", False, f"enabled={welcome_item.get('enabled')}")
            return False
        print_test("welcome is disabled", True)
        
        # Check all other 7 slides are present and enabled
        other_slides = ["dot", "physical", "pain", "iv", "telehealth", "primary", "security"]
        config_ids = [item.get("id") for item in config]
        for slide_id in other_slides:
            if slide_id not in config_ids:
                print_test(f"{slide_id} is in config", False, f"{slide_id} not found")
                return False
            item = next(item for item in config if item.get("id") == slide_id)
            if item.get("enabled") != True:
                print_test(f"{slide_id} is enabled", False, f"{slide_id} enabled={item.get('enabled')}")
                return False
        print_test("All other 7 slides present and enabled", True)
        
        # Verify persistence with a follow-up GET
        print("\n--- Follow-up GET to verify persistence ---")
        get_response = requests.get(f"{BASE_URL}/api/kiosk/slides")
        if get_response.status_code != 200:
            print_test("Follow-up GET returns 200", False, f"Got {get_response.status_code}")
            return False
        
        get_data = get_response.json()
        persisted_config = get_data.get("config", [])
        print(f"Persisted config: {json.dumps(persisted_config, indent=2)}")
        
        # Verify persisted config matches
        if len(persisted_config) != 9:
            print_test("Persisted config has 9 entries", False, f"Got {len(persisted_config)}")
            return False
        
        if persisted_config[0].get("id") != "chiropractic":
            print_test("Persisted: chiropractic is first", False, f"First is {persisted_config[0].get('id')}")
            return False
        
        welcome_persisted = next((item for item in persisted_config if item.get("id") == "welcome"), None)
        if not welcome_persisted or welcome_persisted.get("enabled") != False:
            print_test("Persisted: welcome is disabled", False, f"welcome={welcome_persisted}")
            return False
        
        print_test("Persisted config matches", True)
        
        print_test("TEST CASE C", True, "PUT with auth, reorder, and persistence all working")
        return True
        
    except Exception as e:
        print_test("TEST CASE C", False, f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_case_d_put_invalid_body():
    """(D) PUT with invalid body -> expect 400"""
    print("\n=== TEST CASE D: PUT /api/kiosk/slides (invalid body) ===")
    try:
        # Login
        cookies = staff_login()
        if not cookies:
            print_test("TEST CASE D", False, "Staff login failed")
            return False
        
        # D1: Empty body {}
        print("\n--- D1: Empty body {} ---")
        response1 = requests.put(f"{BASE_URL}/api/kiosk/slides", json={}, cookies=cookies)
        print(f"Status: {response1.status_code}")
        print(f"Response: {response1.text}")
        
        if response1.status_code != 400:
            print_test("Empty body returns 400", False, f"Got {response1.status_code}")
            return False
        print_test("Empty body returns 400", True)
        
        # D2: config is not array
        print("\n--- D2: config is not array ---")
        response2 = requests.put(f"{BASE_URL}/api/kiosk/slides", json={"config": "notarray"}, cookies=cookies)
        print(f"Status: {response2.status_code}")
        print(f"Response: {response2.text}")
        
        if response2.status_code != 400:
            print_test("config='notarray' returns 400", False, f"Got {response2.status_code}")
            return False
        print_test("config='notarray' returns 400", True)
        
        print_test("TEST CASE D", True, "Invalid body validation working")
        return True
        
    except Exception as e:
        print_test("TEST CASE D", False, f"Exception: {str(e)}")
        return False

def test_case_e_put_unknown_id():
    """(E) PUT with unknown id -> expect 200, unknown dropped, real slides present"""
    print("\n=== TEST CASE E: PUT /api/kiosk/slides (unknown id) ===")
    try:
        # Login
        cookies = staff_login()
        if not cookies:
            print_test("TEST CASE E", False, "Staff login failed")
            return False
        
        # PUT with unknown "nope" and valid "iv"
        payload = {
            "config": [
                {"id": "nope", "enabled": True},
                {"id": "iv", "enabled": True}
            ]
        }
        response = requests.put(f"{BASE_URL}/api/kiosk/slides", json=payload, cookies=cookies)
        print(f"PUT status: {response.status_code}")
        print(f"PUT response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code != 200:
            print_test("PUT with unknown id returns 200", False, f"Got {response.status_code}")
            return False
        print_test("PUT with unknown id returns 200", True)
        
        data = response.json()
        config = data.get("config", [])
        
        # Check total is 9 entries (all real slides)
        if len(config) != 9:
            print_test("Config has 9 entries", False, f"Got {len(config)} entries")
            return False
        print_test("Config has 9 entries", True)
        
        # Check "nope" is NOT in config
        config_ids = [item.get("id") for item in config]
        if "nope" in config_ids:
            print_test("Unknown 'nope' dropped", False, "'nope' found in config")
            return False
        print_test("Unknown 'nope' dropped", True)
        
        # Check iv is FIRST (only valid one given)
        if config[0].get("id") != "iv":
            print_test("iv is first", False, f"First is {config[0].get('id')}")
            return False
        print_test("iv is first", True)
        
        # Check all 9 real slide ids are present
        expected_ids = {"welcome", "dot", "physical", "pain", "chiropractic", "iv", "telehealth", "primary", "security"}
        actual_ids = set(config_ids)
        if actual_ids != expected_ids:
            print_test("All 9 real slide ids present", False, f"Expected {expected_ids}, got {actual_ids}")
            return False
        print_test("All 9 real slide ids present", True)
        
        print_test("TEST CASE E", True, "Unknown id dropped, real slides present")
        return True
        
    except Exception as e:
        print_test("TEST CASE E", False, f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def cleanup_restore_default():
    """CLEANUP: Restore default all-enabled order"""
    print("\n=== CLEANUP: Restore default all-enabled order ===")
    try:
        # Login
        cookies = staff_login()
        if not cookies:
            print_test("CLEANUP", False, "Staff login failed")
            return False
        
        # PUT default order
        default_config = [
            {"id": "welcome", "enabled": True},
            {"id": "dot", "enabled": True},
            {"id": "physical", "enabled": True},
            {"id": "pain", "enabled": True},
            {"id": "chiropractic", "enabled": True},
            {"id": "iv", "enabled": True},
            {"id": "telehealth", "enabled": True},
            {"id": "primary", "enabled": True},
            {"id": "security", "enabled": True}
        ]
        payload = {"config": default_config}
        response = requests.put(f"{BASE_URL}/api/kiosk/slides", json=payload, cookies=cookies)
        print(f"PUT status: {response.status_code}")
        
        if response.status_code != 200:
            print_test("Restore PUT returns 200", False, f"Got {response.status_code}")
            return False
        print_test("Restore PUT returns 200", True)
        
        # Verify with GET
        print("\n--- Verify restored config with GET ---")
        get_response = requests.get(f"{BASE_URL}/api/kiosk/slides")
        if get_response.status_code != 200:
            print_test("Verify GET returns 200", False, f"Got {get_response.status_code}")
            return False
        
        data = get_response.json()
        config = data.get("config", [])
        print(f"Restored config: {json.dumps(config, indent=2)}")
        
        # Check order
        expected_order = ["welcome", "dot", "physical", "pain", "chiropractic", "iv", "telehealth", "primary", "security"]
        actual_order = [item.get("id") for item in config]
        if actual_order != expected_order:
            print_test("Restored order correct", False, f"Expected {expected_order}, got {actual_order}")
            return False
        print_test("Restored order correct", True)
        
        # Check all enabled
        all_enabled = all(item.get("enabled") == True for item in config)
        if not all_enabled:
            print_test("All slides enabled", False, "Some slides disabled")
            return False
        print_test("All slides enabled", True)
        
        print_test("CLEANUP", True, "Default config restored successfully")
        return True
        
    except Exception as e:
        print_test("CLEANUP", False, f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 80)
    print("BACKEND TEST: Kiosk Slide Configuration API")
    print("Endpoint: /api/kiosk/slides")
    print("Base URL: https://nextjs-ssr-stack.preview.emergentagent.com")
    print("=" * 80)
    
    results = []
    
    # Run all test cases
    results.append(("A: GET public no auth", test_case_a_get_public_no_auth()))
    results.append(("B: PUT no auth (401)", test_case_b_put_no_auth()))
    results.append(("C: PUT with auth reorder", test_case_c_put_with_auth_reorder()))
    results.append(("D: PUT invalid body (400)", test_case_d_put_invalid_body()))
    results.append(("E: PUT unknown id", test_case_e_put_unknown_id()))
    results.append(("CLEANUP: Restore default", cleanup_restore_default()))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
    
    total = len(results)
    passed = sum(1 for _, p in results if p)
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    exit(main())
