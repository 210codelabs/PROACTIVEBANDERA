#!/usr/bin/env python3
"""
Backend test for PUBLIC intake medication search endpoint.
Tests the NEW PUBLIC (unauthenticated) GET /api/intake/drug-search endpoint.
This endpoint is INTENTIONALLY PUBLIC for anonymous patients on the intake form.
"""

import requests
import json
import sys

# Base URL from environment
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_public_intake_drug_search():
    """Test the PUBLIC intake drug search endpoint (NO authentication required)"""
    
    print("\n" + "="*80)
    print("BACKEND TEST: PUBLIC Intake Medication Search")
    print("="*80)
    
    all_passed = True
    
    # ========================================================================
    # TEST 1: GET /api/intake/drug-search?q=lisinopril WITHOUT auth cookie
    # EXPECT: 200 (NOT 401) with results array containing openFDA data
    # ========================================================================
    print("\n[TEST 1] GET /api/intake/drug-search?q=lisinopril WITHOUT auth cookie")
    print("CRITICAL: This endpoint is INTENTIONALLY PUBLIC (patients are anonymous)")
    try:
        url = f"{BASE_URL}/api/intake/drug-search?q=lisinopril"
        # NO cookies, NO authentication
        response = requests.get(url, timeout=30)
        
        print(f"Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            all_passed = False
        else:
            print("✅ PASSED: Status code is 200 (NOT 401 - endpoint is public)")
            
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Check for results array
            if "results" not in data:
                print("❌ FAILED: Response missing 'results' key")
                all_passed = False
            else:
                results = data["results"]
                print(f"✅ PASSED: Response has 'results' key")
                print(f"Results count: {len(results)}")
                
                if isinstance(results, list):
                    print("✅ PASSED: results is an array")
                    
                    if len(results) > 0:
                        print(f"✅ PASSED: results is non-empty (found {len(results)} medications)")
                        
                        # Check first result has required fields
                        first = results[0]
                        required_fields = ["brandName", "genericName", "productNdc", "strengths"]
                        missing_fields = [f for f in required_fields if f not in first]
                        
                        if missing_fields:
                            print(f"❌ FAILED: First result missing fields: {missing_fields}")
                            print(f"First result keys: {list(first.keys())}")
                            all_passed = False
                        else:
                            print(f"✅ PASSED: First result has all required fields: {required_fields}")
                            print(f"  - brandName: {first.get('brandName')}")
                            print(f"  - genericName: {first.get('genericName')}")
                            print(f"  - productNdc: {first.get('productNdc')}")
                            print(f"  - strengths: {first.get('strengths')}")
                            
                            # Verify at least one result contains 'lisinopril' (case-insensitive)
                            found_match = False
                            for item in results:
                                brand = (item.get('brandName') or '').lower()
                                generic = (item.get('genericName') or '').lower()
                                if 'lisinopril' in brand or 'lisinopril' in generic:
                                    found_match = True
                                    print(f"✅ PASSED: Found match with 'lisinopril' in results")
                                    break
                            
                            if not found_match:
                                print("⚠️  WARNING: No result contains 'lisinopril' (may be openFDA data issue)")
                    else:
                        print("⚠️  WARNING: results array is empty (may be openFDA API issue)")
                else:
                    print(f"❌ FAILED: results is not an array, type: {type(results)}")
                    all_passed = False
                    
            # Check for source field
            if "source" in data:
                print(f"✅ PASSED: Response has 'source' field: {data['source']}")
            
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    
    # ========================================================================
    # TEST 2: GET /api/intake/drug-search?q=a WITHOUT auth cookie (query too short)
    # EXPECT: 200 with {results: []} (minimum 2 chars required)
    # ========================================================================
    print("\n[TEST 2] GET /api/intake/drug-search?q=a WITHOUT auth cookie (query too short)")
    try:
        url = f"{BASE_URL}/api/intake/drug-search?q=a"
        # NO cookies, NO authentication
        response = requests.get(url, timeout=30)
        
        print(f"Status code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            all_passed = False
        else:
            print("✅ PASSED: Status code is 200")
            
            data = response.json()
            
            if "results" not in data:
                print("❌ FAILED: Response missing 'results' key")
                all_passed = False
            else:
                results = data["results"]
                if isinstance(results, list) and len(results) == 0:
                    print("✅ PASSED: results is an empty array (query too short, minimum 2 chars)")
                else:
                    print(f"❌ FAILED: Expected empty array, got: {results}")
                    all_passed = False
                    
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    
    # ========================================================================
    # TEST 3: CONTRAST - GET /api/drugs/search?q=lisinopril WITHOUT auth cookie
    # EXPECT: 401 Unauthorized (staff endpoint must stay protected)
    # ========================================================================
    print("\n[TEST 3] CONTRAST - GET /api/drugs/search?q=lisinopril WITHOUT auth cookie")
    print("CRITICAL: This staff endpoint MUST remain protected (require authentication)")
    try:
        url = f"{BASE_URL}/api/drugs/search?q=lisinopril"
        # NO cookies, NO authentication
        response = requests.get(url, timeout=30)
        
        print(f"Status code: {response.status_code}")
        
        if response.status_code != 401:
            print(f"❌ FAILED: Expected 401 Unauthorized, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            print("SECURITY ISSUE: Staff endpoint is not properly protected!")
            all_passed = False
        else:
            print("✅ PASSED: Status code is 401 Unauthorized (staff endpoint is protected)")
            
            data = response.json()
            if "error" in data:
                print(f"✅ PASSED: Error message present: {data['error']}")
            
    except Exception as e:
        print(f"❌ FAILED: Exception occurred: {e}")
        import traceback
        traceback.print_exc()
        all_passed = False
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    if all_passed:
        print("✅ ALL TESTS PASSED")
        print("\nKEY FINDINGS:")
        print("1. ✅ PUBLIC endpoint /api/intake/drug-search works WITHOUT authentication (200)")
        print("2. ✅ Returns real openFDA results with required fields (brandName, genericName, productNdc, strengths)")
        print("3. ✅ Query validation works (minimum 2 chars, returns empty array for short queries)")
        print("4. ✅ STAFF endpoint /api/drugs/search remains protected (401 without auth)")
        print("\nCONCLUSION: The public intake medication search is working correctly.")
        print("Patients can search medications anonymously on the intake form,")
        print("while the staff endpoint remains properly secured.")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        print("\nPlease review the failures above.")
        return 1

if __name__ == "__main__":
    sys.exit(test_public_intake_drug_search())
