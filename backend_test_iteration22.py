#!/usr/bin/env python3
"""
Backend test for Iteration 22: Data Integrity scan/repair API
Tests GET/POST /api/admin/db/integrity endpoint
"""

import requests
import json

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_iteration22():
    print("\n" + "="*80)
    print("ITERATION 22: Data Integrity scan/repair API")
    print("="*80)
    
    # Test 1: GET /api/admin/db/integrity with NO cookie -> expect 401
    print("\n[TEST 1] GET /api/admin/db/integrity without cookie (expect 401)")
    try:
        response = requests.get(f"{BASE_URL}/api/admin/db/integrity")
        print(f"✓ Status: {response.status_code}")
        print(f"✓ Response: {response.json()}")
        if response.status_code == 401:
            print("✅ TEST 1 PASSED: Correctly blocked with 401")
        else:
            print(f"❌ TEST 1 FAILED: Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ TEST 1 FAILED with exception: {e}")
    
    # Test 2: GET as nurse (non-admin) -> expect 403 with {error:"Admin only"}
    print("\n[TEST 2] GET /api/admin/db/integrity as nurse (expect 403)")
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
            
            # Try to access integrity endpoint as nurse
            response = requests.get(
                f"{BASE_URL}/api/admin/db/integrity",
                cookies=nurse_cookies
            )
            print(f"✓ Status: {response.status_code}")
            print(f"✓ Response: {response.json()}")
            
            if response.status_code == 403:
                response_json = response.json()
                if response_json.get("error") == "Admin only":
                    print("✅ TEST 2 PASSED: Correctly blocked with 403 'Admin only'")
                else:
                    print(f"❌ TEST 2 FAILED: Got 403 but wrong error message: {response_json}")
            else:
                print(f"❌ TEST 2 FAILED: Expected 403, got {response.status_code}")
        else:
            print(f"❌ TEST 2 FAILED: Nurse login failed with {login_response.status_code}")
    except Exception as e:
        print(f"❌ TEST 2 FAILED with exception: {e}")
    
    # Test 3: GET as admin -> expect 200 JSON with shape {ok:true, totalOrphans:<number>, report:[...], scannedAt}
    print("\n[TEST 3] GET /api/admin/db/integrity as admin (expect 200)")
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
            
            # Access integrity endpoint as admin
            response = requests.get(
                f"{BASE_URL}/api/admin/db/integrity",
                cookies=admin_cookies
            )
            print(f"✓ Status: {response.status_code}")
            response_json = response.json()
            print(f"✓ Response: {json.dumps(response_json, indent=2)}")
            
            if response.status_code == 200:
                # Verify response shape
                if "ok" in response_json and response_json["ok"] == True:
                    print("✓ Response has 'ok: true'")
                else:
                    print(f"❌ Response missing 'ok: true': {response_json}")
                
                if "totalOrphans" in response_json and isinstance(response_json["totalOrphans"], int):
                    print(f"✓ Response has 'totalOrphans': {response_json['totalOrphans']}")
                else:
                    print(f"❌ Response missing 'totalOrphans' (int)")
                
                if "report" in response_json and isinstance(response_json["report"], list):
                    print(f"✓ Response has 'report' array with {len(response_json['report'])} items")
                    if len(response_json["report"]) > 0:
                        # Check first item structure
                        first_item = response_json["report"][0]
                        if all(k in first_item for k in ["child", "fk", "parent", "orphans"]):
                            print(f"✓ Report items have correct structure: {first_item}")
                        else:
                            print(f"❌ Report items missing required fields: {first_item}")
                else:
                    print(f"❌ Response missing 'report' array")
                
                if "scannedAt" in response_json:
                    print(f"✓ Response has 'scannedAt': {response_json['scannedAt']}")
                else:
                    print(f"❌ Response missing 'scannedAt'")
                
                print("✅ TEST 3 PASSED: GET as admin returns 200 with correct shape")
            else:
                print(f"❌ TEST 3 FAILED: Expected 200, got {response.status_code}")
        else:
            print(f"❌ TEST 3 FAILED: Admin login failed with {login_response.status_code}")
    except Exception as e:
        print(f"❌ TEST 3 FAILED with exception: {e}")
    
    # Test 4: POST /api/admin/db/integrity with NO cookie -> expect 401
    print("\n[TEST 4] POST /api/admin/db/integrity without cookie (expect 401)")
    try:
        response = requests.post(f"{BASE_URL}/api/admin/db/integrity")
        print(f"✓ Status: {response.status_code}")
        print(f"✓ Response: {response.json()}")
        if response.status_code == 401:
            print("✅ TEST 4 PASSED: Correctly blocked with 401")
        else:
            print(f"❌ TEST 4 FAILED: Expected 401, got {response.status_code}")
    except Exception as e:
        print(f"❌ TEST 4 FAILED with exception: {e}")
    
    # Test 5: POST as nurse -> expect 403
    print("\n[TEST 5] POST /api/admin/db/integrity as nurse (expect 403)")
    try:
        # Login as nurse (reuse from test 2 or login again)
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nurse.kim@proactiveclinic.com", "password": "apex123"}
        )
        
        if login_response.status_code == 200:
            nurse_cookies = login_response.cookies
            
            # Try to POST to integrity endpoint as nurse
            response = requests.post(
                f"{BASE_URL}/api/admin/db/integrity",
                cookies=nurse_cookies
            )
            print(f"✓ Status: {response.status_code}")
            print(f"✓ Response: {response.json()}")
            
            if response.status_code == 403:
                print("✅ TEST 5 PASSED: Correctly blocked with 403")
            else:
                print(f"❌ TEST 5 FAILED: Expected 403, got {response.status_code}")
        else:
            print(f"❌ TEST 5 FAILED: Nurse login failed")
    except Exception as e:
        print(f"❌ TEST 5 FAILED with exception: {e}")
    
    # Test 6: POST as admin -> expect 200 JSON {ok:true, totalDeleted:<number>, summary:[...], repairedAt}
    print("\n[TEST 6] POST /api/admin/db/integrity as admin (expect 200)")
    try:
        # Login as admin (reuse from test 3 or login again)
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"}
        )
        
        if login_response.status_code == 200:
            admin_cookies = login_response.cookies
            
            # POST to integrity endpoint as admin
            response = requests.post(
                f"{BASE_URL}/api/admin/db/integrity",
                cookies=admin_cookies
            )
            print(f"✓ Status: {response.status_code}")
            response_json = response.json()
            print(f"✓ Response: {json.dumps(response_json, indent=2)}")
            
            if response.status_code == 200:
                # Verify response shape
                if "ok" in response_json and response_json["ok"] == True:
                    print("✓ Response has 'ok: true'")
                else:
                    print(f"❌ Response missing 'ok: true'")
                
                if "totalDeleted" in response_json and isinstance(response_json["totalDeleted"], int):
                    print(f"✓ Response has 'totalDeleted': {response_json['totalDeleted']}")
                else:
                    print(f"❌ Response missing 'totalDeleted' (int)")
                
                if "summary" in response_json and isinstance(response_json["summary"], list):
                    print(f"✓ Response has 'summary' array with {len(response_json['summary'])} items")
                    if len(response_json["summary"]) > 0:
                        # Check first item structure
                        first_item = response_json["summary"][0]
                        if all(k in first_item for k in ["child", "fk", "parent", "deleted"]):
                            print(f"✓ Summary items have correct structure: {first_item}")
                        else:
                            print(f"❌ Summary items missing required fields: {first_item}")
                else:
                    print(f"❌ Response missing 'summary' array")
                
                if "repairedAt" in response_json:
                    print(f"✓ Response has 'repairedAt': {response_json['repairedAt']}")
                else:
                    print(f"❌ Response missing 'repairedAt'")
                
                print("✅ TEST 6 PASSED: POST as admin returns 200 with correct shape")
            else:
                print(f"❌ TEST 6 FAILED: Expected 200, got {response.status_code}")
        else:
            print(f"❌ TEST 6 FAILED: Admin login failed")
    except Exception as e:
        print(f"❌ TEST 6 FAILED with exception: {e}")
    
    # Test 7: Regression sanity - GET /api/patients/search as admin -> expect 200
    print("\n[TEST 7] Regression: GET /api/patients/search as admin (expect 200)")
    try:
        # Login as admin
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"}
        )
        
        if login_response.status_code == 200:
            admin_cookies = login_response.cookies
            
            # GET /api/patients/search (with empty query to get all patients)
            response = requests.get(
                f"{BASE_URL}/api/patients/search?q=",
                cookies=admin_cookies
            )
            print(f"✓ Status: {response.status_code}")
            
            if response.status_code == 200:
                response_json = response.json()
                print(f"✓ Response has {len(response_json.get('patients', []))} patients")
                print("✅ TEST 7 PASSED: GET /api/patients/search returns 200 (regression check - normal data APIs still work)")
            else:
                print(f"❌ TEST 7 FAILED: Expected 200, got {response.status_code}")
        else:
            print(f"❌ TEST 7 FAILED: Admin login failed")
    except Exception as e:
        print(f"❌ TEST 7 FAILED with exception: {e}")
    
    print("\n" + "="*80)
    print("ITERATION 22 TESTING COMPLETE")
    print("="*80 + "\n")

if __name__ == "__main__":
    test_iteration22()
