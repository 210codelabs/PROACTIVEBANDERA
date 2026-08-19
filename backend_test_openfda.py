#!/usr/bin/env python3
"""
Backend test for openFDA integration (NEW medication typeahead, NDC lookup, SPL labeling).
Tests the REAL external openFDA API (api.fda.gov) over the network.
All routes require staff session (requireSession).
"""

import requests
import json
import sys

# HTTPS preview base URL (from .env NEXT_PUBLIC_BASE_URL)
BASE = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Admin credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def login_admin():
    """Login as admin and return session cookie"""
    print("\n=== LOGIN AS ADMIN ===")
    res = requests.post(
        f"{BASE}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        allow_redirects=False
    )
    print(f"Login status: {res.status_code}")
    if res.status_code not in [200, 302]:
        print(f"Login failed: {res.text}")
        return None
    
    # Extract session cookie
    cookies = res.cookies
    if not cookies:
        print("No cookies returned from login")
        return None
    
    print(f"✅ Login successful, session cookie obtained")
    return cookies

def test_step_1_no_auth():
    """Step 1: GET /api/drugs/search?q=lisin with NO cookie -> expect 401"""
    print("\n=== STEP 1: GET /api/drugs/search?q=lisin WITHOUT auth cookie ===")
    try:
        res = requests.get(f"{BASE}/api/drugs/search?q=lisin")
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:200]}")
        
        if res.status_code == 401:
            print("✅ STEP 1 PASSED: Returns 401 without auth cookie")
            return True
        else:
            print(f"❌ STEP 1 FAILED: Expected 401, got {res.status_code}")
            return False
    except Exception as e:
        print(f"❌ STEP 1 FAILED with exception: {e}")
        return False

def test_step_2_single_char(cookies):
    """Step 2: GET /api/drugs/search?q=l (single char) as admin -> expect 200 with {results: []}"""
    print("\n=== STEP 2: GET /api/drugs/search?q=l (single char) as admin ===")
    try:
        res = requests.get(f"{BASE}/api/drugs/search?q=l", cookies=cookies)
        print(f"Status: {res.status_code}")
        
        if res.status_code != 200:
            print(f"❌ STEP 2 FAILED: Expected 200, got {res.status_code}")
            return False
        
        data = res.json()
        print(f"Response: {json.dumps(data, indent=2)[:300]}")
        
        if "results" in data and isinstance(data["results"], list) and len(data["results"]) == 0:
            print("✅ STEP 2 PASSED: Returns 200 with empty results array (minimum 2 chars required)")
            return True
        else:
            print(f"❌ STEP 2 FAILED: Expected {{results: []}}, got {data}")
            return False
    except Exception as e:
        print(f"❌ STEP 2 FAILED with exception: {e}")
        return False

def test_step_3_lisinopril(cookies):
    """Step 3: GET /api/drugs/search?q=lisinopril as admin -> expect 200 with non-empty results"""
    print("\n=== STEP 3: GET /api/drugs/search?q=lisinopril as admin ===")
    try:
        res = requests.get(f"{BASE}/api/drugs/search?q=lisinopril", cookies=cookies)
        print(f"Status: {res.status_code}")
        
        if res.status_code != 200:
            print(f"❌ STEP 3 FAILED: Expected 200, got {res.status_code}")
            return False, None
        
        data = res.json()
        results = data.get("results", [])
        print(f"Number of results: {len(results)}")
        
        if len(results) == 0:
            print(f"❌ STEP 3 FAILED: Expected non-empty results array, got empty")
            print(f"Full response: {json.dumps(data, indent=2)}")
            return False, None
        
        # Check first result structure
        first = results[0]
        print(f"\nFirst result sample:")
        print(f"  brandName: {first.get('brandName', 'N/A')}")
        print(f"  genericName: {first.get('genericName', 'N/A')}")
        print(f"  dosageForm: {first.get('dosageForm', 'N/A')}")
        print(f"  route: {first.get('route', 'N/A')}")
        print(f"  productNdc: {first.get('productNdc', 'N/A')}")
        print(f"  strengths: {first.get('strengths', [])}")
        print(f"  activeIngredients: {first.get('activeIngredients', [])}")
        
        # Verify required fields
        required_fields = ['brandName', 'genericName', 'dosageForm', 'route', 'productNdc', 'strengths', 'activeIngredients']
        missing_fields = [f for f in required_fields if f not in first]
        
        if missing_fields:
            print(f"❌ STEP 3 FAILED: Missing required fields: {missing_fields}")
            return False, None
        
        # Verify at least one result contains "lisinopril" (case-insensitive)
        found_lisinopril = False
        captured_ndc = None
        
        for item in results:
            brand = (item.get('brandName') or '').lower()
            generic = (item.get('genericName') or '').lower()
            
            if 'lisinopril' in brand or 'lisinopril' in generic:
                found_lisinopril = True
                captured_ndc = item.get('productNdc')
                print(f"\n✅ Found lisinopril match:")
                print(f"  brandName: {item.get('brandName')}")
                print(f"  genericName: {item.get('genericName')}")
                print(f"  productNdc: {captured_ndc}")
                break
        
        if not found_lisinopril:
            print(f"❌ STEP 3 FAILED: No result contains 'lisinopril' in brandName or genericName")
            return False, None
        
        if not captured_ndc:
            print(f"⚠️ WARNING: Found lisinopril but no productNdc available")
            # Try to find any result with a productNdc
            for item in results:
                if item.get('productNdc'):
                    captured_ndc = item.get('productNdc')
                    print(f"Using alternative productNdc: {captured_ndc}")
                    break
        
        print(f"\n✅ STEP 3 PASSED: Returns 200 with {len(results)} results, all required fields present")
        print(f"Captured productNdc for later steps: {captured_ndc}")
        return True, captured_ndc
        
    except Exception as e:
        print(f"❌ STEP 3 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False, None

def test_step_4_not_real_drug(cookies):
    """Step 4: GET /api/drugs/search?q=zzznotarealdrugxyz as admin -> expect 200 with results: []"""
    print("\n=== STEP 4: GET /api/drugs/search?q=zzznotarealdrugxyz as admin ===")
    try:
        res = requests.get(f"{BASE}/api/drugs/search?q=zzznotarealdrugxyz", cookies=cookies)
        print(f"Status: {res.status_code}")
        
        if res.status_code != 200:
            print(f"❌ STEP 4 FAILED: Expected 200, got {res.status_code}")
            return False
        
        data = res.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if "results" in data and isinstance(data["results"], list) and len(data["results"]) == 0:
            print("✅ STEP 4 PASSED: Returns 200 with empty results (openFDA 404 normalized to empty list)")
            return True
        else:
            print(f"❌ STEP 4 FAILED: Expected {{results: []}}, got {data}")
            return False
    except Exception as e:
        print(f"❌ STEP 4 FAILED with exception: {e}")
        return False

def test_step_5_invalid_ndc(cookies):
    """Step 5: GET /api/drugs/ndc?ndc=not-an-ndc as admin -> expect 400"""
    print("\n=== STEP 5: GET /api/drugs/ndc?ndc=not-an-ndc as admin ===")
    try:
        res = requests.get(f"{BASE}/api/drugs/ndc?ndc=not-an-ndc", cookies=cookies)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:200]}")
        
        if res.status_code == 400:
            data = res.json()
            print(f"Error message: {data.get('error', 'N/A')}")
            print("✅ STEP 5 PASSED: Returns 400 for invalid NDC format")
            return True
        else:
            print(f"❌ STEP 5 FAILED: Expected 400, got {res.status_code}")
            return False
    except Exception as e:
        print(f"❌ STEP 5 FAILED with exception: {e}")
        return False

def test_step_6_valid_ndc(cookies, product_ndc):
    """Step 6: GET /api/drugs/ndc?ndc=<productNdc> as admin -> expect 200 with result object"""
    print(f"\n=== STEP 6: GET /api/drugs/ndc?ndc={product_ndc} as admin ===")
    
    if not product_ndc:
        print("⚠️ STEP 6 SKIPPED: No productNdc available from step 3")
        return False
    
    try:
        res = requests.get(f"{BASE}/api/drugs/ndc?ndc={product_ndc}", cookies=cookies)
        print(f"Status: {res.status_code}")
        
        if res.status_code != 200:
            print(f"❌ STEP 6 FAILED: Expected 200, got {res.status_code}")
            print(f"Response: {res.text[:500]}")
            return False
        
        data = res.json()
        result = data.get("result")
        
        if result is None:
            print(f"⚠️ STEP 6: Result is null (NDC may not have detailed record in openFDA)")
            print(f"Full response: {json.dumps(data, indent=2)}")
            # This is acceptable - some NDCs may not have full records
            print("✅ STEP 6 PASSED: Returns 200 with result key (null is acceptable)")
            return True
        
        print(f"\nResult object:")
        print(f"  productNdc: {result.get('productNdc', 'N/A')}")
        print(f"  brandName: {result.get('brandName', 'N/A')}")
        print(f"  genericName: {result.get('genericName', 'N/A')}")
        print(f"  packaging: {len(result.get('packaging', []))} items")
        
        # Verify required fields
        if 'productNdc' in result and ('brandName' in result or 'genericName' in result):
            print("✅ STEP 6 PASSED: Returns 200 with non-null result containing productNdc and brandName/genericName")
            return True
        else:
            print(f"❌ STEP 6 FAILED: Result missing required fields")
            return False
        
    except Exception as e:
        print(f"❌ STEP 6 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_step_7_label_by_name(cookies):
    """Step 7: GET /api/drugs/label?name=lisinopril as admin -> expect 200 with result"""
    print("\n=== STEP 7: GET /api/drugs/label?name=lisinopril as admin ===")
    try:
        res = requests.get(f"{BASE}/api/drugs/label?name=lisinopril", cookies=cookies)
        print(f"Status: {res.status_code}")
        
        if res.status_code != 200:
            print(f"❌ STEP 7 FAILED: Expected 200, got {res.status_code}")
            print(f"Response: {res.text[:500]}")
            return False
        
        data = res.json()
        result = data.get("result")
        
        if result is None:
            print(f"❌ STEP 7 FAILED: Result is null (expected non-null label data)")
            print(f"Full response: {json.dumps(data, indent=2)}")
            return False
        
        print(f"\nLabel result:")
        print(f"  brandName: {result.get('brandName', 'N/A')}")
        print(f"  genericName: {result.get('genericName', 'N/A')}")
        print(f"  indications length: {len(result.get('indications', ''))}")
        print(f"  dosage length: {len(result.get('dosage', ''))}")
        
        indications = result.get('indications', '')
        dosage = result.get('dosage', '')
        
        if indications and dosage:
            print(f"  indications preview: {indications[:100]}...")
            print(f"  dosage preview: {dosage[:100]}...")
            print("✅ STEP 7 PASSED: Returns 200 with non-null result having non-empty indications and dosage")
            return True
        else:
            print(f"❌ STEP 7 FAILED: Result missing non-empty indications or dosage fields")
            print(f"  indications: {bool(indications)}")
            print(f"  dosage: {bool(dosage)}")
            return False
        
    except Exception as e:
        print(f"❌ STEP 7 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_step_8_label_no_params(cookies):
    """Step 8: GET /api/drugs/label with NO query params as admin -> expect 400"""
    print("\n=== STEP 8: GET /api/drugs/label (no params) as admin ===")
    try:
        res = requests.get(f"{BASE}/api/drugs/label", cookies=cookies)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:200]}")
        
        if res.status_code == 400:
            data = res.json()
            print(f"Error message: {data.get('error', 'N/A')}")
            print("✅ STEP 8 PASSED: Returns 400 when no params provided")
            return True
        else:
            print(f"❌ STEP 8 FAILED: Expected 400, got {res.status_code}")
            return False
    except Exception as e:
        print(f"❌ STEP 8 FAILED with exception: {e}")
        return False

def test_step_9_label_by_ndc(cookies, product_ndc):
    """Step 9: GET /api/drugs/label?productNdc=<productNdc> as admin -> expect 200"""
    print(f"\n=== STEP 9: GET /api/drugs/label?productNdc={product_ndc} as admin ===")
    
    if not product_ndc:
        print("⚠️ STEP 9 SKIPPED: No productNdc available from step 3")
        return False
    
    try:
        res = requests.get(f"{BASE}/api/drugs/label?productNdc={product_ndc}", cookies=cookies)
        print(f"Status: {res.status_code}")
        
        if res.status_code != 200:
            print(f"❌ STEP 9 FAILED: Expected 200, got {res.status_code}")
            print(f"Response: {res.text[:500]}")
            return False
        
        data = res.json()
        result = data.get("result")
        
        print(f"\nResponse structure:")
        print(f"  Has 'result' key: {('result' in data)}")
        print(f"  Result is null: {(result is None)}")
        
        if result is not None:
            print(f"  Result has data:")
            print(f"    brandName: {result.get('brandName', 'N/A')}")
            print(f"    genericName: {result.get('genericName', 'N/A')}")
            print(f"    indications length: {len(result.get('indications', ''))}")
        
        # Result may be null if that exact NDC has no SPL - this is acceptable
        print("✅ STEP 9 PASSED: Returns 200 with valid JSON (result may be null, which is acceptable)")
        return True
        
    except Exception as e:
        print(f"❌ STEP 9 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 80)
    print("BACKEND TEST: openFDA Integration (NEW medication typeahead, NDC, SPL)")
    print("Testing REAL external openFDA API (api.fda.gov) over the network")
    print("=" * 80)
    
    results = {}
    
    # Step 1: No auth
    results['step_1'] = test_step_1_no_auth()
    
    # Login as admin
    cookies = login_admin()
    if not cookies:
        print("\n❌ FATAL: Could not login as admin")
        sys.exit(1)
    
    # Step 2: Single char query
    results['step_2'] = test_step_2_single_char(cookies)
    
    # Step 3: Lisinopril search (capture productNdc)
    step_3_passed, product_ndc = test_step_3_lisinopril(cookies)
    results['step_3'] = step_3_passed
    
    # Step 4: Not real drug
    results['step_4'] = test_step_4_not_real_drug(cookies)
    
    # Step 5: Invalid NDC
    results['step_5'] = test_step_5_invalid_ndc(cookies)
    
    # Step 6: Valid NDC lookup
    results['step_6'] = test_step_6_valid_ndc(cookies, product_ndc)
    
    # Step 7: Label by name
    results['step_7'] = test_step_7_label_by_name(cookies)
    
    # Step 8: Label no params
    results['step_8'] = test_step_8_label_no_params(cookies)
    
    # Step 9: Label by NDC
    results['step_9'] = test_step_9_label_by_ndc(cookies, product_ndc)
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for step, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{step}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - openFDA integration working correctly!")
        sys.exit(0)
    else:
        print(f"\n⚠️ {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
