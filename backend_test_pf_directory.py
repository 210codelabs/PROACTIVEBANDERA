#!/usr/bin/env python3
"""
Backend test for EMR Import Feature 6: Practice Fusion Service Base URL directory search.
Tests the NEW admin-only GET /api/admin/fhir/directory?q=... endpoint.
"""

import requests
import sys

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_pf_directory():
    """Test Practice Fusion directory search endpoint"""
    
    print("=" * 80)
    print("BACKEND TEST: Practice Fusion Directory Search (Feature 6)")
    print("=" * 80)
    
    # Admin credentials
    admin_email = "admin@proactiveclinic.com"
    admin_password = "apex123"
    
    session = requests.Session()
    
    # ========================================================================
    # STEP 1: GET /api/admin/fhir/directory?q=Practice WITHOUT auth cookie -> expect 401
    # ========================================================================
    print("\n[STEP 1] GET /api/admin/fhir/directory?q=Practice WITHOUT auth cookie")
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/fhir/directory?q=Practice", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print("✅ PASS: Correctly returns 401 Unauthorized without auth cookie")
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception during request: {e}")
        return False
    
    # ========================================================================
    # Login as admin
    # ========================================================================
    print("\n[LOGIN] Authenticating as admin...")
    try:
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": admin_email, "password": admin_password},
            timeout=10
        )
        print(f"Login status: {login_resp.status_code}")
        
        if login_resp.status_code != 200:
            print(f"❌ FAIL: Login failed with status {login_resp.status_code}")
            print(f"Response: {login_resp.text[:200]}")
            return False
        
        login_data = login_resp.json()
        if not login_data.get("ok"):
            print(f"❌ FAIL: Login response ok=false")
            print(f"Response: {login_data}")
            return False
        
        print("✅ Login successful, session cookie set")
    except Exception as e:
        print(f"❌ FAIL: Login exception: {e}")
        return False
    
    # ========================================================================
    # STEP 2: GET /api/admin/fhir/directory as admin with NO q param (or q of length 1)
    # -> expect 200 with practices === [] (empty, because min 2 chars) and total === 3398
    # ========================================================================
    print("\n[STEP 2] GET /api/admin/fhir/directory with NO q param (empty query)")
    try:
        resp = session.get(f"{BASE_URL}/api/admin/fhir/directory", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        print(f"total: {data.get('total')}")
        print(f"count: {data.get('count')}")
        print(f"practices length: {len(data.get('practices', []))}")
        
        # Verify total === 3398
        if data.get("total") != 3398:
            print(f"❌ FAIL: Expected total=3398, got {data.get('total')}")
            return False
        
        # Verify practices is empty (min 2 chars required)
        if len(data.get("practices", [])) != 0:
            print(f"❌ FAIL: Expected practices=[] (empty), got {len(data.get('practices', []))} practices")
            return False
        
        print("✅ PASS: Returns 200 with practices=[] (empty) and total=3398")
    except Exception as e:
        print(f"❌ FAIL: Exception during request: {e}")
        return False
    
    # Test with q of length 1 (should also return empty)
    print("\n[STEP 2b] GET /api/admin/fhir/directory?q=a (single char)")
    try:
        resp = session.get(f"{BASE_URL}/api/admin/fhir/directory?q=a", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"total: {data.get('total')}")
        print(f"count: {data.get('count')}")
        print(f"practices length: {len(data.get('practices', []))}")
        
        if data.get("total") != 3398:
            print(f"❌ FAIL: Expected total=3398, got {data.get('total')}")
            return False
        
        if len(data.get("practices", [])) != 0:
            print(f"❌ FAIL: Expected practices=[] (empty) for single char, got {len(data.get('practices', []))} practices")
            return False
        
        print("✅ PASS: Returns 200 with practices=[] (empty) for single char query")
    except Exception as e:
        print(f"❌ FAIL: Exception during request: {e}")
        return False
    
    # ========================================================================
    # STEP 3: GET /api/admin/fhir/directory?q=practice as admin
    # -> expect 200; count > 0; verify every returned practice has a non-empty name and orgId,
    # and base starts with "https://api.practicefusion.com/fhir/r4/v1/"
    # ========================================================================
    print("\n[STEP 3] GET /api/admin/fhir/directory?q=practice (search by name)")
    try:
        resp = session.get(f"{BASE_URL}/api/admin/fhir/directory?q=practice", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        print(f"total: {data.get('total')}")
        print(f"count: {data.get('count')}")
        practices = data.get("practices", [])
        print(f"practices length: {len(practices)}")
        
        # Verify count > 0
        if data.get("count", 0) <= 0:
            print(f"❌ FAIL: Expected count > 0, got {data.get('count')}")
            return False
        
        # Verify every practice has non-empty name, orgId, and base starts with correct URL
        for i, practice in enumerate(practices):
            if not practice.get("name"):
                print(f"❌ FAIL: Practice {i} has empty name: {practice}")
                return False
            
            if not practice.get("orgId"):
                print(f"❌ FAIL: Practice {i} has empty orgId: {practice}")
                return False
            
            base = practice.get("base", "")
            if not base.startswith("https://api.practicefusion.com/fhir/r4/v1/"):
                print(f"❌ FAIL: Practice {i} base URL does not start with 'https://api.practicefusion.com/fhir/r4/v1/': {base}")
                return False
        
        print(f"✅ PASS: Returns {len(practices)} practices, all with non-empty name/orgId and correct base URL")
        print(f"Sample practice: name='{practices[0].get('name')}', orgId='{practices[0].get('orgId')}', base='{practices[0].get('base')}'")
    except Exception as e:
        print(f"❌ FAIL: Exception during request: {e}")
        return False
    
    # ========================================================================
    # STEP 4: GET /api/admin/fhir/directory?q=1234567893 as admin (NPI search)
    # -> expect 200; at least one result has npi === "1234567893" and its base contains "/fhir/r4/v1/"
    # ========================================================================
    print("\n[STEP 4] GET /api/admin/fhir/directory?q=1234567893 (search by NPI)")
    try:
        resp = session.get(f"{BASE_URL}/api/admin/fhir/directory?q=1234567893", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        print(f"total: {data.get('total')}")
        print(f"count: {data.get('count')}")
        practices = data.get("practices", [])
        print(f"practices length: {len(practices)}")
        
        # Find at least one practice with npi === "1234567893"
        found = False
        for practice in practices:
            if practice.get("npi") == "1234567893":
                found = True
                base = practice.get("base", "")
                print(f"Found practice with NPI 1234567893: name='{practice.get('name')}', orgId='{practice.get('orgId')}', base='{base}'")
                
                # Verify base contains "/fhir/r4/v1/"
                if "/fhir/r4/v1/" not in base:
                    print(f"❌ FAIL: Practice base URL does not contain '/fhir/r4/v1/': {base}")
                    return False
                
                break
        
        if not found:
            print(f"❌ FAIL: No practice found with npi='1234567893'")
            print(f"Returned practices: {practices}")
            return False
        
        print("✅ PASS: Found practice with NPI 1234567893 and correct base URL")
    except Exception as e:
        print(f"❌ FAIL: Exception during request: {e}")
        return False
    
    # ========================================================================
    # STEP 5: Verify the number of returned practices for a broad query is capped at 25
    # ========================================================================
    print("\n[STEP 5] Verify results are capped at 25 (broad query)")
    try:
        # Use a very broad query that should match many practices
        resp = session.get(f"{BASE_URL}/api/admin/fhir/directory?q=medical", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        print(f"total: {data.get('total')}")
        print(f"count: {data.get('count')}")
        practices = data.get("practices", [])
        print(f"practices length: {len(practices)}")
        
        # Verify count <= 25
        if len(practices) > 25:
            print(f"❌ FAIL: Expected practices length <= 25, got {len(practices)}")
            return False
        
        if data.get("count", 0) > 25:
            print(f"❌ FAIL: Expected count <= 25, got {data.get('count')}")
            return False
        
        print(f"✅ PASS: Results capped at {len(practices)} practices (max 25)")
    except Exception as e:
        print(f"❌ FAIL: Exception during request: {e}")
        return False
    
    # ========================================================================
    # All tests passed
    # ========================================================================
    print("\n" + "=" * 80)
    print("✅ ALL 5 TEST STEPS PASSED")
    print("=" * 80)
    return True

if __name__ == "__main__":
    success = test_pf_directory()
    sys.exit(0 if success else 1)
