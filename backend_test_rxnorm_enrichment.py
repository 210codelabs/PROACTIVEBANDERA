#!/usr/bin/env python3
"""
Backend test for Registration Enrichment — GET /api/enrichment/rxnorm
Tests the public RxNorm/RxNav + MedlinePlus medication enrichment endpoint.
"""

import requests
import json
import sys
from urllib.parse import quote

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Staff credentials
STAFF_EMAIL = "admin@proactiveclinic.com"
STAFF_PASSWORD = "apex123"

def print_test(test_name, passed, details=""):
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"\n{status}: {test_name}")
    if details:
        print(f"  {details}")

def main():
    print("=" * 80)
    print("BACKEND TEST: Registration Enrichment — GET /api/enrichment/rxnorm")
    print("=" * 80)
    
    session = requests.Session()
    
    # ========================================================================
    # TEST 1: GET /api/enrichment/rxnorm?q=lisinopril WITHOUT auth cookie -> 401
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST 1: Auth guard - GET without cookie should return 401")
    print("=" * 80)
    
    try:
        # Use a fresh session without auth cookie
        no_auth_session = requests.Session()
        url = f"{BASE_URL}/api/enrichment/rxnorm?q=lisinopril"
        resp = no_auth_session.get(url)
        
        print(f"Request: GET {url}")
        print(f"Response status: {resp.status_code}")
        print(f"Response body: {resp.text[:200]}")
        
        if resp.status_code == 401:
            print_test("TEST 1 - Auth guard", True, "Correctly returns 401 Unauthorized without auth cookie")
        else:
            print_test("TEST 1 - Auth guard", False, f"Expected 401, got {resp.status_code}")
            
    except Exception as e:
        print_test("TEST 1 - Auth guard", False, f"Exception: {str(e)}")
    
    # ========================================================================
    # LOGIN as staff to get auth cookie for remaining tests
    # ========================================================================
    print("\n" + "=" * 80)
    print("SETUP: Login as staff to get auth cookie")
    print("=" * 80)
    
    try:
        login_url = f"{BASE_URL}/api/auth/login"
        login_data = {"email": STAFF_EMAIL, "password": STAFF_PASSWORD}
        login_resp = session.post(login_url, json=login_data)
        
        print(f"Request: POST {login_url}")
        print(f"Response status: {login_resp.status_code}")
        
        if login_resp.status_code == 200:
            print("✅ Login successful, auth cookie set")
        else:
            print(f"❌ Login failed with status {login_resp.status_code}")
            print(f"Response: {login_resp.text[:200]}")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Login exception: {str(e)}")
        sys.exit(1)
    
    # ========================================================================
    # TEST 2: GET /api/enrichment/rxnorm?q=a as admin -> 400 (Query too short)
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST 2: Validation - query too short (1 char) should return 400")
    print("=" * 80)
    
    try:
        url = f"{BASE_URL}/api/enrichment/rxnorm?q=a"
        resp = session.get(url)
        
        print(f"Request: GET {url}")
        print(f"Response status: {resp.status_code}")
        print(f"Response body: {resp.text}")
        
        if resp.status_code == 400:
            try:
                data = resp.json()
                if "error" in data and "too short" in data["error"].lower():
                    print_test("TEST 2 - Query too short", True, f"Correctly returns 400 with error: '{data['error']}'")
                else:
                    print_test("TEST 2 - Query too short", True, f"Returns 400 but error message: {data}")
            except Exception:
                print_test("TEST 2 - Query too short", True, "Returns 400 (non-JSON response)")
        else:
            print_test("TEST 2 - Query too short", False, f"Expected 400, got {resp.status_code}")
            
    except Exception as e:
        print_test("TEST 2 - Query too short", False, f"Exception: {str(e)}")
    
    # ========================================================================
    # TEST 3: GET /api/enrichment/rxnorm?q=lisinopril 10 mg as admin -> 200
    # Assert: matched not null, rxcui is numeric string, name contains 'lisinopril',
    # classes is array, education is array with {title, url}
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST 3: Valid medication query - 'lisinopril 10 mg' should return 200 with enrichment data")
    print("=" * 80)
    
    try:
        # URL-encode the space in "lisinopril 10 mg"
        query = "lisinopril 10 mg"
        url = f"{BASE_URL}/api/enrichment/rxnorm?q={quote(query)}"
        resp = session.get(url)
        
        print(f"Request: GET {url}")
        print(f"Response status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response body (formatted):")
            print(json.dumps(data, indent=2)[:1000])
            
            # Assertions
            assertions_passed = []
            assertions_failed = []
            
            # Check matched is not null
            if data.get("matched") is not None:
                assertions_passed.append("matched is not null")
            else:
                assertions_failed.append("matched is null (expected non-null for common drug)")
            
            # Check matched.rxcui is a numeric string
            if data.get("matched") and isinstance(data["matched"].get("rxcui"), str):
                rxcui = data["matched"]["rxcui"]
                if rxcui.isdigit():
                    assertions_passed.append(f"matched.rxcui is numeric string: '{rxcui}'")
                else:
                    assertions_failed.append(f"matched.rxcui is not numeric: '{rxcui}'")
            else:
                assertions_failed.append("matched.rxcui is missing or not a string")
            
            # Check matched.name contains 'lisinopril' (case-insensitive)
            if data.get("matched") and isinstance(data["matched"].get("name"), str):
                name = data["matched"]["name"]
                if "lisinopril" in name.lower():
                    assertions_passed.append(f"matched.name contains 'lisinopril': '{name}'")
                else:
                    assertions_failed.append(f"matched.name does not contain 'lisinopril': '{name}'")
            else:
                assertions_failed.append("matched.name is missing or not a string")
            
            # Check classes is an array
            if isinstance(data.get("classes"), list):
                assertions_passed.append(f"classes is an array with {len(data['classes'])} items")
                if len(data["classes"]) > 0:
                    print(f"  Sample classes: {data['classes'][:3]}")
            else:
                assertions_failed.append(f"classes is not an array: {type(data.get('classes'))}")
            
            # Check education is an array
            if isinstance(data.get("education"), list):
                assertions_passed.append(f"education is an array with {len(data['education'])} items")
                # Check that items have {title, url} structure
                if len(data["education"]) > 0:
                    first_edu = data["education"][0]
                    if isinstance(first_edu, dict) and "title" in first_edu and "url" in first_edu:
                        assertions_passed.append(f"education items have {{title, url}} structure")
                        print(f"  Sample education: title='{first_edu['title'][:50]}...', url='{first_edu['url'][:50]}...'")
                    else:
                        assertions_failed.append(f"education items missing title/url: {first_edu}")
            else:
                assertions_failed.append(f"education is not an array: {type(data.get('education'))}")
            
            # Check source field
            if "source" in data:
                assertions_passed.append(f"source field present: '{data['source']}'")
            else:
                assertions_failed.append("source field missing")
            
            # Print results
            print("\n  Assertions passed:")
            for a in assertions_passed:
                print(f"    ✅ {a}")
            
            if assertions_failed:
                print("\n  Assertions failed:")
                for a in assertions_failed:
                    print(f"    ❌ {a}")
                print_test("TEST 3 - Valid medication query", False, f"{len(assertions_failed)} assertion(s) failed")
            else:
                print_test("TEST 3 - Valid medication query", True, f"All {len(assertions_passed)} assertions passed")
        else:
            print_test("TEST 3 - Valid medication query", False, f"Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            
    except Exception as e:
        print_test("TEST 3 - Valid medication query", False, f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # ========================================================================
    # TEST 4: GET /api/enrichment/rxnorm?q=zzqwerasdfnotarealdrug as admin -> 200
    # with matched:null, classes:[], education:[] (graceful no-match, NOT 500)
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST 4: Nonsense query - should return 200 with matched:null (graceful, NOT 500)")
    print("=" * 80)
    
    try:
        query = "zzqwerasdfnotarealdrug"
        url = f"{BASE_URL}/api/enrichment/rxnorm?q={query}"
        resp = session.get(url)
        
        print(f"Request: GET {url}")
        print(f"Response status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response body (formatted):")
            print(json.dumps(data, indent=2))
            
            # Assertions
            assertions_passed = []
            assertions_failed = []
            
            # Check matched is null
            if data.get("matched") is None:
                assertions_passed.append("matched is null (expected for nonsense query)")
            else:
                assertions_failed.append(f"matched is not null: {data.get('matched')}")
            
            # Check classes is empty array
            if isinstance(data.get("classes"), list) and len(data["classes"]) == 0:
                assertions_passed.append("classes is empty array []")
            else:
                assertions_failed.append(f"classes is not empty array: {data.get('classes')}")
            
            # Check education is empty array
            if isinstance(data.get("education"), list) and len(data["education"]) == 0:
                assertions_passed.append("education is empty array []")
            else:
                assertions_failed.append(f"education is not empty array: {data.get('education')}")
            
            # Check query field
            if data.get("query") == query:
                assertions_passed.append(f"query field matches: '{query}'")
            else:
                assertions_failed.append(f"query field mismatch: expected '{query}', got '{data.get('query')}'")
            
            # Print results
            print("\n  Assertions passed:")
            for a in assertions_passed:
                print(f"    ✅ {a}")
            
            if assertions_failed:
                print("\n  Assertions failed:")
                for a in assertions_failed:
                    print(f"    ❌ {a}")
                print_test("TEST 4 - Nonsense query graceful handling", False, f"{len(assertions_failed)} assertion(s) failed")
            else:
                print_test("TEST 4 - Nonsense query graceful handling", True, f"All {len(assertions_passed)} assertions passed - endpoint handles no-match gracefully")
        elif resp.status_code == 500:
            print_test("TEST 4 - Nonsense query graceful handling", False, "CRITICAL: Returns 500 instead of graceful 200 with matched:null")
            print(f"Response: {resp.text[:500]}")
        else:
            print_test("TEST 4 - Nonsense query graceful handling", False, f"Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            
    except Exception as e:
        print_test("TEST 4 - Nonsense query graceful handling", False, f"Exception: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print("All 4 test cases completed.")
    print("Review the results above for pass/fail status.")
    print("=" * 80)

if __name__ == "__main__":
    main()
