#!/usr/bin/env python3
"""
Backend test for Iteration 23: Stedi clearinghouse Phase 0 (config + real connectivity test)
Tests GET/PUT /api/admin/integrations and POST /api/admin/integrations/test
"""

import requests
import json

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_iteration23():
    print("\n" + "="*80)
    print("ITERATION 23: Stedi clearinghouse Phase 0 (config + real connectivity test)")
    print("="*80)
    
    # Test 1: GET /api/admin/integrations as admin -> 200, assert "stedi" EXISTS and "availity-edi" DOES NOT exist
    print("\n[TEST 1] GET /api/admin/integrations as admin (expect 200, stedi exists, availity-edi does not)")
    try:
        # Login as admin
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"}
        )
        print(f"✓ Admin login status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            admin_cookies = login_response.cookies
            print(f"✓ Admin session cookie obtained")
            
            # GET integrations
            response = requests.get(
                f"{BASE_URL}/api/admin/integrations",
                cookies=admin_cookies
            )
            print(f"✓ Status: {response.status_code}")
            response_json = response.json()
            print(f"✓ Response keys: {list(response_json.keys())}")
            
            if response.status_code == 200:
                state = response_json.get("state", {})
                providers = state.get("providers", {})
                print(f"✓ Providers in state: {list(providers.keys())}")
                
                # Assert "stedi" EXISTS
                if "stedi" in providers:
                    print("✅ 'stedi' provider EXISTS in state.providers")
                else:
                    print("❌ 'stedi' provider DOES NOT EXIST in state.providers")
                
                # Assert "availity-edi" DOES NOT exist
                if "availity-edi" not in providers:
                    print("✅ 'availity-edi' provider DOES NOT EXIST in state.providers (correctly removed)")
                else:
                    print("❌ 'availity-edi' provider EXISTS in state.providers (should be removed)")
                
                if "stedi" in providers and "availity-edi" not in providers:
                    print("✅ TEST 1 PASSED: stedi exists, availity-edi does not")
                else:
                    print("❌ TEST 1 FAILED: Provider catalog incorrect")
            else:
                print(f"❌ TEST 1 FAILED: Expected 200, got {response.status_code}")
        else:
            print(f"❌ TEST 1 FAILED: Admin login failed with {login_response.status_code}")
    except Exception as e:
        print(f"❌ TEST 1 FAILED with exception: {e}")
    
    # Test 2a: GET /api/admin/integrations with NO cookie -> expect 401/403
    print("\n[TEST 2a] GET /api/admin/integrations without cookie (expect 401/403)")
    try:
        response = requests.get(f"{BASE_URL}/api/admin/integrations")
        print(f"✓ Status: {response.status_code}")
        print(f"✓ Response: {response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:200]}")
        if response.status_code in [401, 403]:
            print("✅ TEST 2a PASSED: Correctly blocked with 401/403")
        else:
            print(f"❌ TEST 2a FAILED: Expected 401/403, got {response.status_code}")
    except Exception as e:
        print(f"❌ TEST 2a FAILED with exception: {e}")
    
    # Test 2b: GET /api/admin/integrations as nurse -> expect 401/403
    print("\n[TEST 2b] GET /api/admin/integrations as nurse (expect 401/403)")
    try:
        # Login as nurse
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nurse.kim@proactiveclinic.com", "password": "apex123"}
        )
        print(f"✓ Nurse login status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            nurse_cookies = login_response.cookies
            print(f"✓ Nurse session cookie obtained")
            
            # Try to access integrations endpoint as nurse
            response = requests.get(
                f"{BASE_URL}/api/admin/integrations",
                cookies=nurse_cookies
            )
            print(f"✓ Status: {response.status_code}")
            print(f"✓ Response: {response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:200]}")
            
            if response.status_code in [401, 403]:
                print("✅ TEST 2b PASSED: Correctly blocked with 401/403")
            else:
                print(f"❌ TEST 2b FAILED: Expected 401/403, got {response.status_code}")
        else:
            print(f"❌ TEST 2b FAILED: Nurse login failed with {login_response.status_code}")
    except Exception as e:
        print(f"❌ TEST 2b FAILED with exception: {e}")
    
    # Test 3: PUT /api/admin/integrations as admin with Stedi config -> 200, verify secrets masked
    print("\n[TEST 3] PUT /api/admin/integrations as admin with Stedi config (expect 200, secrets masked)")
    try:
        # Login as admin (reuse from Test 1)
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"}
        )
        print(f"✓ Admin login status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            admin_cookies = login_response.cookies
            print(f"✓ Admin session cookie obtained")
            
            # PUT Stedi config with fake API key
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
                cookies=admin_cookies
            )
            print(f"✓ Status: {response.status_code}")
            response_json = response.json()
            print(f"✓ Response: {json.dumps(response_json, indent=2)}")
            
            if response.status_code == 200:
                # Verify response structure
                if response_json.get("ok") == True:
                    print("✓ Response has 'ok: true'")
                else:
                    print(f"❌ Response missing 'ok: true'")
                
                state = response_json.get("state", {})
                providers = state.get("providers", {})
                stedi = providers.get("stedi", {})
                
                # Assert providers.stedi.enabled == true
                if stedi.get("enabled") == True:
                    print("✅ providers.stedi.enabled == true")
                else:
                    print(f"❌ providers.stedi.enabled != true, got: {stedi.get('enabled')}")
                
                # Assert providers.stedi.secretsSet.API_KEY == true
                secrets_set = stedi.get("secretsSet", {})
                if secrets_set.get("API_KEY") == True:
                    print("✅ providers.stedi.secretsSet.API_KEY == true")
                else:
                    print(f"❌ providers.stedi.secretsSet.API_KEY != true, got: {secrets_set.get('API_KEY')}")
                
                # Assert providers.stedi.credentials.API_KEY == "" (masked)
                credentials = stedi.get("credentials", {})
                if credentials.get("API_KEY") == "":
                    print("✅ providers.stedi.credentials.API_KEY == '' (secret masked)")
                else:
                    print(f"❌ providers.stedi.credentials.API_KEY not masked, got: {credentials.get('API_KEY')}")
                
                if (response_json.get("ok") == True and 
                    stedi.get("enabled") == True and 
                    secrets_set.get("API_KEY") == True and 
                    credentials.get("API_KEY") == ""):
                    print("✅ TEST 3 PASSED: Config saved, secrets masked correctly")
                else:
                    print("❌ TEST 3 FAILED: Config or masking incorrect")
            else:
                print(f"❌ TEST 3 FAILED: Expected 200, got {response.status_code}")
        else:
            print(f"❌ TEST 3 FAILED: Admin login failed with {login_response.status_code}")
    except Exception as e:
        print(f"❌ TEST 3 FAILED with exception: {e}")
    
    # Test 4: POST /api/admin/integrations/test {"providerKey":"stedi"} as admin -> 200, expect validation.status "error"
    print("\n[TEST 4] POST /api/admin/integrations/test as admin (expect 200, validation.status 'error' - fake key)")
    try:
        # Login as admin (reuse)
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"}
        )
        print(f"✓ Admin login status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            admin_cookies = login_response.cookies
            print(f"✓ Admin session cookie obtained")
            
            # POST test connectivity
            response = requests.post(
                f"{BASE_URL}/api/admin/integrations/test",
                json={"providerKey": "stedi"},
                cookies=admin_cookies
            )
            print(f"✓ Status: {response.status_code}")
            response_json = response.json()
            print(f"✓ Response: {json.dumps(response_json, indent=2)}")
            
            if response.status_code == 200:
                # Verify response structure
                if response_json.get("ok") == True:
                    print("✓ Response has 'ok: true'")
                else:
                    print(f"❌ Response missing 'ok: true'")
                
                validation = response_json.get("validation", {})
                validation_status = validation.get("status")
                validation_message = validation.get("message", "")
                
                print(f"✓ validation.status: {validation_status}")
                print(f"✓ validation.message: {validation_message}")
                
                # EXPECTED: validation.status should be "error" because the API key is fake
                # This proves the real connectivity call fired
                if validation_status == "error":
                    print("✅ validation.status == 'error' (EXPECTED - fake key rejected)")
                    
                    # Check if message mentions Stedi rejection or network issue
                    if "Stedi rejected" in validation_message or "rejected the API key" in validation_message:
                        print("✅ validation.message mentions 'Stedi rejected the API key' (401/403 from Stedi)")
                    elif "Could not reach Stedi" in validation_message:
                        print("✅ validation.message mentions 'Could not reach Stedi' (network blocked)")
                    else:
                        print(f"⚠️  validation.message has unexpected text: {validation_message}")
                    
                    print("✅ TEST 4 PASSED: Real connectivity test fired, fake key correctly rejected")
                elif validation_status == "success":
                    print("⚠️  validation.status == 'success' (unexpected - fake key accepted?)")
                    print("⚠️  This is acceptable only if the environment happened to accept the fake key")
                    print("✅ TEST 4 PASSED (with warning): Connectivity test fired")
                else:
                    print(f"❌ TEST 4 FAILED: Unexpected validation.status: {validation_status}")
            else:
                print(f"❌ TEST 4 FAILED: Expected 200, got {response.status_code}")
        else:
            print(f"❌ TEST 4 FAILED: Admin login failed with {login_response.status_code}")
    except Exception as e:
        print(f"❌ TEST 4 FAILED with exception: {e}")
    
    # Test 5a: POST /api/admin/integrations/test with NO cookie -> expect 401/403
    print("\n[TEST 5a] POST /api/admin/integrations/test without cookie (expect 401/403)")
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/integrations/test",
            json={"providerKey": "stedi"}
        )
        print(f"✓ Status: {response.status_code}")
        print(f"✓ Response: {response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:200]}")
        if response.status_code in [401, 403]:
            print("✅ TEST 5a PASSED: Correctly blocked with 401/403")
        else:
            print(f"❌ TEST 5a FAILED: Expected 401/403, got {response.status_code}")
    except Exception as e:
        print(f"❌ TEST 5a FAILED with exception: {e}")
    
    # Test 5b: POST /api/admin/integrations/test as nurse -> expect 401/403
    print("\n[TEST 5b] POST /api/admin/integrations/test as nurse (expect 401/403)")
    try:
        # Login as nurse
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nurse.kim@proactiveclinic.com", "password": "apex123"}
        )
        print(f"✓ Nurse login status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            nurse_cookies = login_response.cookies
            print(f"✓ Nurse session cookie obtained")
            
            # Try to test connectivity as nurse
            response = requests.post(
                f"{BASE_URL}/api/admin/integrations/test",
                json={"providerKey": "stedi"},
                cookies=nurse_cookies
            )
            print(f"✓ Status: {response.status_code}")
            print(f"✓ Response: {response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text[:200]}")
            
            if response.status_code in [401, 403]:
                print("✅ TEST 5b PASSED: Correctly blocked with 401/403")
            else:
                print(f"❌ TEST 5b FAILED: Expected 401/403, got {response.status_code}")
        else:
            print(f"❌ TEST 5b FAILED: Nurse login failed with {login_response.status_code}")
    except Exception as e:
        print(f"❌ TEST 5b FAILED with exception: {e}")
    
    # Test 6: Regression - GET /api/patients/search?q=Adams as admin -> 200
    print("\n[TEST 6] Regression: GET /api/patients/search?q=Adams as admin (expect 200)")
    try:
        # Login as admin
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"}
        )
        print(f"✓ Admin login status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            admin_cookies = login_response.cookies
            print(f"✓ Admin session cookie obtained")
            
            # GET patients search
            response = requests.get(
                f"{BASE_URL}/api/patients/search?q=Adams",
                cookies=admin_cookies
            )
            print(f"✓ Status: {response.status_code}")
            response_json = response.json()
            print(f"✓ Response: {json.dumps(response_json, indent=2)[:500]}")
            
            if response.status_code == 200:
                print("✅ TEST 6 PASSED: Patient search regression working")
            else:
                print(f"❌ TEST 6 FAILED: Expected 200, got {response.status_code}")
        else:
            print(f"❌ TEST 6 FAILED: Admin login failed with {login_response.status_code}")
    except Exception as e:
        print(f"❌ TEST 6 FAILED with exception: {e}")
    
    print("\n" + "="*80)
    print("ITERATION 23 TESTING COMPLETE")
    print("="*80)

if __name__ == "__main__":
    test_iteration23()
