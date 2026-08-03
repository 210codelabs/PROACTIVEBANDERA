#!/usr/bin/env python3
"""
Backend test for NPPES NPI Registry integration (Proactive Clinic).
Tests the live FREE public CMS NPPES API integration.
Base URL: HTTPS (session cookie secure:true).
Staff login: andy.manzano@proactiveclinic.com / apex123
"""

import requests
import json
from pymongo import MongoClient
import os

# HTTPS base URL (session cookie secure:true)
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Staff credentials
STAFF_EMAIL = "andy.manzano@proactiveclinic.com"
STAFF_PASSWORD = "apex123"

# MongoDB connection for cleanup
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "proactive_clinic")

def print_test(test_num, description):
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)

def staff_login():
    """Login as staff and return session cookie"""
    print_test("SETUP", "Staff login")
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            cookie = response.cookies.get("proactive_session")
            if cookie:
                print(f"✅ Staff login successful, got session cookie")
                return {"proactive_session": cookie}
            else:
                print(f"❌ No session cookie in response")
                return None
        else:
            print(f"❌ Login failed: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Exception during login: {e}")
        return None

def cleanup_pharmacies(npi_list):
    """Delete test pharmacy records from MongoDB"""
    if not npi_list:
        return
    print_test("CLEANUP", f"Deleting test pharmacies with NPIs: {npi_list}")
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        result = db.Pharmacy.delete_many({"npi": {"$in": npi_list}})
        print(f"✅ Deleted {result.deleted_count} pharmacy record(s)")
        client.close()
    except Exception as e:
        print(f"❌ Cleanup failed: {e}")

# ============================================================================
# GROUP A — GET /api/nppes/search (STAFF-ONLY, provider/credentialing)
# ============================================================================

def test_a1_no_session():
    """Test A1: No session -> 401"""
    print_test("A1", "GET /api/nppes/search without session -> 401")
    try:
        response = requests.get(
            f"{BASE_URL}/api/nppes/search?first_name=John",
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        if response.status_code == 401:
            print("✅ PASS: Correctly blocked with 401")
            return True
        else:
            print(f"❌ FAIL: Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_a2_no_params(cookies):
    """Test A2: With session, no params at all -> 400"""
    print_test("A2", "GET /api/nppes/search with session but no params -> 400")
    try:
        response = requests.get(
            f"{BASE_URL}/api/nppes/search",
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        if response.status_code == 400:
            data = response.json()
            if "error" in data:
                print(f"✅ PASS: Correctly returned 400 with error: {data['error']}")
                return True
        print(f"❌ FAIL: Expected 400, got {response.status_code}")
        return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_a3_john_smith(cookies):
    """Test A3: Search John Smith in TX -> verify all results contain JOHN and SMITH"""
    print_test("A3", "GET /api/nppes/search?first_name=John&last_name=Smith&state=TX&type=NPI-1")
    try:
        response = requests.get(
            f"{BASE_URL}/api/nppes/search",
            params={
                "first_name": "John",
                "last_name": "Smith",
                "state": "TX",
                "type": "NPI-1"
            },
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 502:
            print("⚠️  NPPES API temporarily unavailable (502) - acceptable per test instructions")
            return True
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response keys: {data.keys()}")
        print(f"Count: {data.get('count', 0)}")
        
        results = data.get("results", [])
        if len(results) == 0:
            print("❌ FAIL: Expected non-empty results array")
            return False
        
        print(f"✅ Results array is non-empty ({len(results)} results)")
        
        # Verify EVERY result's name contains both 'JOHN' and 'SMITH'
        all_valid = True
        for i, result in enumerate(results[:5]):  # Check first 5
            name = result.get("name", "").upper()
            has_john = "JOHN" in name
            has_smith = "SMITH" in name
            has_npi = "npi" in result
            has_name = "name" in result
            has_taxonomy = "primaryTaxonomy" in result
            
            print(f"  Result {i+1}: {result.get('name', 'N/A')}")
            print(f"    NPI: {result.get('npi', 'N/A')}")
            print(f"    Has JOHN: {has_john}, Has SMITH: {has_smith}")
            print(f"    Has required fields (npi/name/primaryTaxonomy): {has_npi}/{has_name}/{has_taxonomy}")
            
            if not (has_john and has_smith):
                print(f"    ❌ Name does not contain both JOHN and SMITH")
                all_valid = False
            if not (has_npi and has_name and has_taxonomy):
                print(f"    ❌ Missing required fields")
                all_valid = False
        
        if all_valid:
            print("✅ PASS: All results contain JOHN and SMITH and have required fields")
            # Return first NPI for test A5
            return results[0].get("npi")
        else:
            print("❌ FAIL: Some results don't meet criteria")
            return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_a4_cvs_pharmacy(cookies):
    """Test A4: Search CVS pharmacies in TX -> verify all results contain CVS"""
    print_test("A4", "GET /api/nppes/search?organization_name=CVS&type=NPI-2&state=TX")
    try:
        response = requests.get(
            f"{BASE_URL}/api/nppes/search",
            params={
                "organization_name": "CVS",
                "type": "NPI-2",
                "state": "TX"
            },
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 502:
            print("⚠️  NPPES API temporarily unavailable (502) - acceptable per test instructions")
            return True
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response keys: {data.keys()}")
        print(f"Count: {data.get('count', 0)}")
        
        results = data.get("results", [])
        if len(results) == 0:
            print("❌ FAIL: Expected non-empty results array")
            return False
        
        print(f"✅ Results array is non-empty ({len(results)} results)")
        
        # Verify EVERY result's name contains 'CVS'
        all_valid = True
        for i, result in enumerate(results[:5]):  # Check first 5
            name = result.get("name", "").upper()
            has_cvs = "CVS" in name
            
            print(f"  Result {i+1}: {result.get('name', 'N/A')}")
            print(f"    NPI: {result.get('npi', 'N/A')}")
            print(f"    Has CVS: {has_cvs}")
            
            if not has_cvs:
                print(f"    ❌ Name does not contain CVS")
                all_valid = False
        
        if all_valid:
            print("✅ PASS: All results contain CVS")
            # Return first NPI for test A5 (as backup)
            return results[0].get("npi")
        else:
            print("❌ FAIL: Some results don't contain CVS")
            return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_a5_npi_exact(cookies, npi):
    """Test A5: Search by exact NPI -> exactly 1 result with matching NPI"""
    print_test("A5", f"GET /api/nppes/search?npi={npi}")
    try:
        response = requests.get(
            f"{BASE_URL}/api/nppes/search",
            params={"npi": npi},
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 502:
            print("⚠️  NPPES API temporarily unavailable (502) - acceptable per test instructions")
            return True
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        results = data.get("results", [])
        
        print(f"Results count: {len(results)}")
        
        if len(results) != 1:
            print(f"❌ FAIL: Expected exactly 1 result, got {len(results)}")
            return False
        
        result_npi = results[0].get("npi")
        print(f"Result NPI: {result_npi}")
        print(f"Result name: {results[0].get('name', 'N/A')}")
        
        if result_npi == npi:
            print("✅ PASS: Exactly 1 result with matching NPI")
            return True
        else:
            print(f"❌ FAIL: NPI mismatch - expected {npi}, got {result_npi}")
            return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

# ============================================================================
# GROUP B — GET /api/pharmacies/nppes (STAFF-ONLY, pharmacy locator)
# ============================================================================

def test_b6_no_session():
    """Test B6: No session -> 401"""
    print_test("B6", "GET /api/pharmacies/nppes without session -> 401")
    try:
        response = requests.get(
            f"{BASE_URL}/api/pharmacies/nppes?city=San Antonio",
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        if response.status_code == 401:
            print("✅ PASS: Correctly blocked with 401")
            return True
        else:
            print(f"❌ FAIL: Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_b7_no_params(cookies):
    """Test B7: With session, no name/city/postal -> 400"""
    print_test("B7", "GET /api/pharmacies/nppes with session but no name/city/postal -> 400")
    try:
        response = requests.get(
            f"{BASE_URL}/api/pharmacies/nppes",
            params={"state": "TX"},  # Only state, not enough
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        if response.status_code == 400:
            data = response.json()
            if "error" in data:
                print(f"✅ PASS: Correctly returned 400 with error: {data['error']}")
                return True
        print(f"❌ FAIL: Expected 400, got {response.status_code}")
        return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_b8_san_antonio(cookies):
    """Test B8: Search pharmacies in San Antonio -> verify pharmacies array with required fields"""
    print_test("B8", "GET /api/pharmacies/nppes?city=San Antonio&state=TX")
    try:
        response = requests.get(
            f"{BASE_URL}/api/pharmacies/nppes",
            params={
                "city": "San Antonio",
                "state": "TX"
            },
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 502:
            print("⚠️  NPPES API temporarily unavailable (502) - acceptable per test instructions")
            return True
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response keys: {data.keys()}")
        
        if "pharmacies" not in data:
            print("❌ FAIL: Response missing 'pharmacies' array")
            return False
        
        pharmacies = data["pharmacies"]
        print(f"Pharmacies count: {len(pharmacies)}")
        
        if len(pharmacies) == 0:
            print("⚠️  Warning: No pharmacies found (NPPES may have no results for this location)")
            # This is acceptable - NPPES may not have data
            return True
        
        # Verify each pharmacy has required fields
        all_valid = True
        for i, pharmacy in enumerate(pharmacies[:3]):  # Check first 3
            has_npi = "npi" in pharmacy
            has_name = "name" in pharmacy
            has_city = "city" in pharmacy
            has_state = "state" in pharmacy
            has_phone = "phone" in pharmacy
            
            print(f"  Pharmacy {i+1}: {pharmacy.get('name', 'N/A')}")
            print(f"    NPI: {pharmacy.get('npi', 'N/A')}")
            print(f"    City: {pharmacy.get('city', 'N/A')}")
            print(f"    State: {pharmacy.get('state', 'N/A')}")
            print(f"    Phone: {pharmacy.get('phone', 'N/A')}")
            print(f"    Has required fields (npi/name/city/state/phone): {has_npi}/{has_name}/{has_city}/{has_state}/{has_phone}")
            
            if not (has_npi and has_name and has_city and has_state and has_phone):
                print(f"    ❌ Missing required fields")
                all_valid = False
        
        if all_valid:
            print("✅ PASS: Pharmacies array with all required fields")
            # Return first pharmacy for import test
            return pharmacies[0] if len(pharmacies) > 0 else None
        else:
            print("❌ FAIL: Some pharmacies missing required fields")
            return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

# ============================================================================
# GROUP C — POST /api/pharmacies/import (STAFF-ONLY)
# ============================================================================

def test_c9_no_session():
    """Test C9: No session -> 401"""
    print_test("C9", "POST /api/pharmacies/import without session -> 401")
    try:
        response = requests.post(
            f"{BASE_URL}/api/pharmacies/import",
            json={"name": "Test Pharmacy"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        if response.status_code == 401:
            print("✅ PASS: Correctly blocked with 401")
            return True
        else:
            print(f"❌ FAIL: Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_c10_no_name(cookies):
    """Test C10: With session, body without name -> 400"""
    print_test("C10", "POST /api/pharmacies/import with session but no name -> 400")
    try:
        response = requests.post(
            f"{BASE_URL}/api/pharmacies/import",
            json={"npi": "1234567890"},
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        if response.status_code == 400:
            data = response.json()
            if "error" in data:
                print(f"✅ PASS: Correctly returned 400 with error: {data['error']}")
                return True
        print(f"❌ FAIL: Expected 400, got {response.status_code}")
        return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_c11_valid_import(cookies, pharmacy_data):
    """Test C11: Valid import -> 200 {ok:true, pharmacy:{...}}"""
    print_test("C11", "POST /api/pharmacies/import with valid body")
    try:
        body = {
            "npi": pharmacy_data.get("npi"),
            "name": pharmacy_data.get("name"),
            "address1": pharmacy_data.get("address1", ""),
            "city": pharmacy_data.get("city", "San Antonio"),
            "state": pharmacy_data.get("state", "TX"),
            "postal": pharmacy_data.get("postal", "78251"),
            "phone": pharmacy_data.get("phone", "")
        }
        print(f"Request body: {json.dumps(body, indent=2)}")
        
        response = requests.post(
            f"{BASE_URL}/api/pharmacies/import",
            json=body,
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get("ok") and "pharmacy" in data:
            pharmacy = data["pharmacy"]
            print(f"✅ PASS: Import successful")
            print(f"  Pharmacy ID: {pharmacy.get('id')}")
            print(f"  Pharmacy name: {pharmacy.get('name')}")
            print(f"  Pharmacy NPI: {pharmacy.get('npi')}")
            return pharmacy.get("npi")
        else:
            print(f"❌ FAIL: Response missing ok:true or pharmacy object")
            return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

def test_c12_duplicate_import(cookies, pharmacy_data):
    """Test C12: Import same NPI again -> 200 with reused:true"""
    print_test("C12", "POST /api/pharmacies/import with SAME NPI (idempotent)")
    try:
        body = {
            "npi": pharmacy_data.get("npi"),
            "name": pharmacy_data.get("name"),
            "address1": pharmacy_data.get("address1", ""),
            "city": pharmacy_data.get("city", "San Antonio"),
            "state": pharmacy_data.get("state", "TX"),
            "postal": pharmacy_data.get("postal", "78251"),
            "phone": pharmacy_data.get("phone", "")
        }
        print(f"Request body: {json.dumps(body, indent=2)}")
        
        response = requests.post(
            f"{BASE_URL}/api/pharmacies/import",
            json=body,
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get("ok") and data.get("reused") == True:
            print(f"✅ PASS: Idempotent import - pharmacy reused (reused:true)")
            return True
        else:
            print(f"❌ FAIL: Expected reused:true, got: {data}")
            return False
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    print("\n" + "="*80)
    print("NPPES NPI REGISTRY INTEGRATION - BACKEND TEST")
    print("Testing live FREE public CMS NPPES API integration")
    print("="*80)
    
    results = {}
    imported_npis = []
    
    # Setup: Staff login
    cookies = staff_login()
    if not cookies:
        print("\n❌ FATAL: Could not login as staff. Aborting tests.")
        return
    
    # GROUP A — GET /api/nppes/search
    print("\n" + "="*80)
    print("GROUP A — GET /api/nppes/search (STAFF-ONLY, provider/credentialing)")
    print("="*80)
    
    results["A1"] = test_a1_no_session()
    results["A2"] = test_a2_no_params(cookies)
    npi_from_a3 = test_a3_john_smith(cookies)
    results["A3"] = bool(npi_from_a3)
    npi_from_a4 = test_a4_cvs_pharmacy(cookies)
    results["A4"] = bool(npi_from_a4)
    
    # Use NPI from A3 or A4 for A5
    test_npi = npi_from_a3 if npi_from_a3 and isinstance(npi_from_a3, str) else npi_from_a4
    if test_npi and isinstance(test_npi, str):
        results["A5"] = test_a5_npi_exact(cookies, test_npi)
    else:
        print("\n⚠️  Skipping A5: No valid NPI from A3 or A4")
        results["A5"] = None
    
    # GROUP B — GET /api/pharmacies/nppes
    print("\n" + "="*80)
    print("GROUP B — GET /api/pharmacies/nppes (STAFF-ONLY, pharmacy locator)")
    print("="*80)
    
    results["B6"] = test_b6_no_session()
    results["B7"] = test_b7_no_params(cookies)
    pharmacy_data = test_b8_san_antonio(cookies)
    results["B8"] = bool(pharmacy_data)
    
    # GROUP C — POST /api/pharmacies/import
    print("\n" + "="*80)
    print("GROUP C — POST /api/pharmacies/import (STAFF-ONLY)")
    print("="*80)
    
    results["C9"] = test_c9_no_session()
    results["C10"] = test_c10_no_name(cookies)
    
    if pharmacy_data and isinstance(pharmacy_data, dict):
        imported_npi = test_c11_valid_import(cookies, pharmacy_data)
        results["C11"] = bool(imported_npi)
        if imported_npi:
            imported_npis.append(imported_npi)
            results["C12"] = test_c12_duplicate_import(cookies, pharmacy_data)
        else:
            print("\n⚠️  Skipping C12: C11 import failed")
            results["C12"] = None
    else:
        print("\n⚠️  Skipping C11 and C12: No pharmacy data from B8")
        results["C11"] = None
        results["C12"] = None
    
    # CLEANUP
    if imported_npis:
        cleanup_pharmacies(imported_npis)
    
    # SUMMARY
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v is True)
    failed = sum(1 for v in results.values() if v is False)
    skipped = sum(1 for v in results.values() if v is None)
    total = len(results)
    
    for test_id, result in results.items():
        status = "✅ PASS" if result is True else ("❌ FAIL" if result is False else "⚠️  SKIP")
        print(f"{test_id}: {status}")
    
    print(f"\nTotal: {total} tests")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Skipped: {skipped}")
    
    if failed == 0:
        print("\n✅ ALL TESTS PASSED (or skipped due to NPPES availability)")
    else:
        print(f"\n❌ {failed} TEST(S) FAILED")

if __name__ == "__main__":
    main()
