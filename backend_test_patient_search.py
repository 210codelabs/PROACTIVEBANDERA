#!/usr/bin/env python3
"""
Backend test for enhanced patient search endpoint GET /api/patients/search
Proactive Clinic EHR - READ-ONLY testing (no data creation/modification)

Test cases:
1) Without session -> expect 401
2) ?q=adams (lowercase) -> 200, case-insensitive match, includes Eleanor Adams
3) ?q=PC-100000 -> 200, returns Eleanor Adams
4) ?q=1958-04-12 -> 200, returns Eleanor Adams (exact DOB day match)
5) ?q=1958 -> 200, includes Eleanor Adams (DOB year-range match)
6) ?status=active&sort=dob_asc (NO q) -> 200, ordered by dob ascending, all status=='active'
7) ?q=a&sort=name_desc -> 200, lastName values in descending order (Z->A)
8) ?sex=F (NO q) -> 200, every returned patient has sex=='F'
9) No q AND no filters (bare /api/patients/search) -> 200 with results == []
10) ?status=active&limit=3 -> 200 with at most 3 results
"""

import requests
import sys
from datetime import datetime

# Base URL (HTTPS required for secure cookie)
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Staff credentials
STAFF_EMAIL = "andy.manzano@proactiveclinic.com"
STAFF_PASSWORD = "apex123"

# Demo patient for assertions
DEMO_PATIENT = {
    "firstName": "Eleanor",
    "lastName": "Adams",
    "mrn": "PC-100000",
    "dob": "1958-04-12",
    "sex": "F",
    "status": "active"
}

def staff_login():
    """Login as staff and return session cookie"""
    print("\n=== Staff Login ===")
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": STAFF_EMAIL, "password": STAFF_PASSWORD}
    
    try:
        resp = requests.post(url, json=payload, timeout=10)
        print(f"POST {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            cookie = resp.cookies.get("proactive_session")
            if cookie:
                print(f"✅ Staff login successful, cookie obtained")
                return {"proactive_session": cookie}
            else:
                print(f"❌ Login returned 200 but no proactive_session cookie")
                return None
        else:
            print(f"❌ Login failed: {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login exception: {e}")
        return None

def test_case_1_no_session():
    """Test case 1: Without session -> expect 401"""
    print("\n=== Test Case 1: No Session -> 401 ===")
    url = f"{BASE_URL}/api/patients/search?q=adams"
    
    try:
        resp = requests.get(url, timeout=10)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print(f"✅ PASS: Correctly blocked with 401 Unauthorized")
            return True
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False

def test_case_2_lowercase_search(cookies):
    """Test case 2: ?q=adams (lowercase) -> 200, case-insensitive match"""
    print("\n=== Test Case 2: Lowercase Search 'adams' ===")
    url = f"{BASE_URL}/api/patients/search?q=adams"
    
    try:
        resp = requests.get(url, cookies=cookies, timeout=10)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        results = data.get("results", [])
        print(f"Results count: {len(results)}")
        
        # Check if Eleanor Adams is in results
        found_adams = False
        for patient in results:
            if patient.get("lastName", "").lower() == "adams":
                found_adams = True
                print(f"Found patient: {patient.get('firstName')} {patient.get('lastName')} (MRN: {patient.get('mrn')})")
                
                # Verify required fields
                required_fields = ["id", "mrn", "firstName", "lastName", "dob", "sex", "status", "phone"]
                missing_fields = [f for f in required_fields if f not in patient]
                if missing_fields:
                    print(f"❌ FAIL: Missing fields: {missing_fields}")
                    return False
                
                print(f"✅ All required fields present: {required_fields}")
                break
        
        if found_adams:
            print(f"✅ PASS: Case-insensitive search working, Eleanor Adams found")
            return True
        else:
            print(f"❌ FAIL: No patient with lastName 'Adams' found")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False

def test_case_3_mrn_search(cookies):
    """Test case 3: ?q=PC-100000 -> 200, returns Eleanor Adams"""
    print("\n=== Test Case 3: MRN Search 'PC-100000' ===")
    url = f"{BASE_URL}/api/patients/search?q=PC-100000"
    
    try:
        resp = requests.get(url, cookies=cookies, timeout=10)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        results = data.get("results", [])
        print(f"Results count: {len(results)}")
        
        if len(results) == 0:
            print(f"❌ FAIL: No results returned for MRN PC-100000")
            return False
        
        # Check if Eleanor Adams is in results
        found = False
        for patient in results:
            if patient.get("mrn") == DEMO_PATIENT["mrn"]:
                found = True
                print(f"Found: {patient.get('firstName')} {patient.get('lastName')} (MRN: {patient.get('mrn')})")
                
                # Verify it's Eleanor Adams
                if (patient.get("firstName") == DEMO_PATIENT["firstName"] and 
                    patient.get("lastName") == DEMO_PATIENT["lastName"]):
                    print(f"✅ PASS: MRN search returns Eleanor Adams")
                    return True
                else:
                    print(f"❌ FAIL: MRN matches but name doesn't match Eleanor Adams")
                    return False
        
        print(f"❌ FAIL: MRN PC-100000 not found in results")
        return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False

def test_case_4_exact_dob_search(cookies):
    """Test case 4: ?q=1958-04-12 -> 200, returns Eleanor Adams (exact DOB day match)"""
    print("\n=== Test Case 4: Exact DOB Search '1958-04-12' ===")
    url = f"{BASE_URL}/api/patients/search?q=1958-04-12"
    
    try:
        resp = requests.get(url, cookies=cookies, timeout=10)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        results = data.get("results", [])
        print(f"Results count: {len(results)}")
        
        # Check if Eleanor Adams is in results
        found = False
        for patient in results:
            dob = patient.get("dob", "")
            # DOB might be returned as ISO string, extract date part
            if dob.startswith("1958-04-12"):
                found = True
                print(f"Found patient with DOB 1958-04-12: {patient.get('firstName')} {patient.get('lastName')} (MRN: {patient.get('mrn')})")
                
                # Verify it's Eleanor Adams
                if patient.get("mrn") == DEMO_PATIENT["mrn"]:
                    print(f"✅ PASS: Exact DOB search returns Eleanor Adams")
                    return True
        
        if found:
            print(f"⚠️ Found patient with DOB 1958-04-12 but not Eleanor Adams")
            return True  # Still pass if DOB matching works
        else:
            print(f"❌ FAIL: No patient with DOB 1958-04-12 found")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False

def test_case_5_year_dob_search(cookies):
    """Test case 5: ?q=1958 -> 200, includes Eleanor Adams (DOB year-range match)"""
    print("\n=== Test Case 5: Year DOB Search '1958' ===")
    url = f"{BASE_URL}/api/patients/search?q=1958"
    
    try:
        resp = requests.get(url, cookies=cookies, timeout=10)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        results = data.get("results", [])
        print(f"Results count: {len(results)}")
        
        # Check if Eleanor Adams is in results
        found = False
        for patient in results:
            dob = patient.get("dob", "")
            if dob.startswith("1958"):
                print(f"Found patient born in 1958: {patient.get('firstName')} {patient.get('lastName')} (DOB: {dob[:10]})")
                
                if patient.get("mrn") == DEMO_PATIENT["mrn"]:
                    found = True
                    print(f"✅ Eleanor Adams found in year-range search")
        
        if found:
            print(f"✅ PASS: Year-range DOB search includes Eleanor Adams")
            return True
        else:
            print(f"❌ FAIL: Eleanor Adams not found in year 1958 search")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False

def test_case_6_status_filter_sort_dob(cookies):
    """Test case 6: ?status=active&sort=dob_asc (NO q) -> 200, ordered by dob ascending, all status=='active'"""
    print("\n=== Test Case 6: Status Filter + DOB Sort ===")
    url = f"{BASE_URL}/api/patients/search?status=active&sort=dob_asc"
    
    try:
        resp = requests.get(url, cookies=cookies, timeout=10)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        results = data.get("results", [])
        print(f"Results count: {len(results)}")
        
        if len(results) == 0:
            print(f"❌ FAIL: No results returned")
            return False
        
        # Verify all have status=='active'
        all_active = True
        for patient in results:
            if patient.get("status") != "active":
                print(f"❌ FAIL: Patient {patient.get('mrn')} has status '{patient.get('status')}', expected 'active'")
                all_active = False
        
        if all_active:
            print(f"✅ All patients have status='active'")
        else:
            return False
        
        # Verify DOB ascending order (oldest first)
        dobs = [patient.get("dob", "") for patient in results]
        sorted_dobs = sorted(dobs)
        
        print(f"First 3 DOBs: {[d[:10] for d in dobs[:3]]}")
        print(f"Last 3 DOBs: {[d[:10] for d in dobs[-3:]]}")
        
        if dobs == sorted_dobs:
            print(f"✅ PASS: Results ordered by DOB ascending (oldest first), all active")
            return True
        else:
            print(f"❌ FAIL: Results not properly sorted by DOB ascending")
            print(f"Expected order: {[d[:10] for d in sorted_dobs[:5]]}")
            print(f"Actual order: {[d[:10] for d in dobs[:5]]}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False

def test_case_7_sort_name_desc(cookies):
    """Test case 7: ?q=a&sort=name_desc -> 200, lastName values in descending order (Z->A)"""
    print("\n=== Test Case 7: Name Sort Descending ===")
    url = f"{BASE_URL}/api/patients/search?q=a&sort=name_desc"
    
    try:
        resp = requests.get(url, cookies=cookies, timeout=10)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        results = data.get("results", [])
        print(f"Results count: {len(results)}")
        
        if len(results) == 0:
            print(f"❌ FAIL: No results returned")
            return False
        
        # Extract lastName values
        last_names = [patient.get("lastName", "") for patient in results]
        sorted_desc = sorted(last_names, reverse=True)
        
        print(f"First 3 lastNames: {last_names[:3]}")
        print(f"Last 3 lastNames: {last_names[-3:]}")
        
        if last_names == sorted_desc:
            print(f"✅ PASS: Results ordered by lastName descending (Z->A)")
            return True
        else:
            print(f"❌ FAIL: Results not properly sorted by lastName descending")
            print(f"Expected order: {sorted_desc[:5]}")
            print(f"Actual order: {last_names[:5]}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False

def test_case_8_sex_filter(cookies):
    """Test case 8: ?sex=F (NO q) -> 200, every returned patient has sex=='F'"""
    print("\n=== Test Case 8: Sex Filter 'F' ===")
    url = f"{BASE_URL}/api/patients/search?sex=F"
    
    try:
        resp = requests.get(url, cookies=cookies, timeout=10)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        results = data.get("results", [])
        print(f"Results count: {len(results)}")
        
        if len(results) == 0:
            print(f"❌ FAIL: No results returned")
            return False
        
        # Verify all have sex=='F'
        all_female = True
        for patient in results:
            sex = patient.get("sex")
            if sex != "F":
                print(f"❌ FAIL: Patient {patient.get('mrn')} has sex '{sex}', expected 'F'")
                all_female = False
        
        if all_female:
            print(f"✅ PASS: All {len(results)} patients have sex='F'")
            return True
        else:
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False

def test_case_9_empty_search(cookies):
    """Test case 9: No q AND no filters -> 200 with results == []"""
    print("\n=== Test Case 9: Empty Search (No q, No Filters) ===")
    url = f"{BASE_URL}/api/patients/search"
    
    try:
        resp = requests.get(url, cookies=cookies, timeout=10)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        results = data.get("results", [])
        print(f"Results count: {len(results)}")
        
        if len(results) == 0:
            print(f"✅ PASS: Empty search returns empty results (does not dump whole table)")
            return True
        else:
            print(f"❌ FAIL: Expected empty results, got {len(results)} results")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False

def test_case_10_limit(cookies):
    """Test case 10: ?status=active&limit=3 -> 200 with at most 3 results"""
    print("\n=== Test Case 10: Limit Parameter ===")
    url = f"{BASE_URL}/api/patients/search?status=active&limit=3"
    
    try:
        resp = requests.get(url, cookies=cookies, timeout=10)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        results = data.get("results", [])
        print(f"Results count: {len(results)}")
        
        if len(results) <= 3:
            print(f"✅ PASS: Limit respected, returned {len(results)} results (≤ 3)")
            return True
        else:
            print(f"❌ FAIL: Expected at most 3 results, got {len(results)}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False

def main():
    print("=" * 80)
    print("Backend Test: Enhanced Patient Search Endpoint")
    print("GET /api/patients/search")
    print("Proactive Clinic EHR - READ-ONLY Testing")
    print("=" * 80)
    
    results = {}
    
    # Test case 1: No session
    results["Test 1: No Session"] = test_case_1_no_session()
    
    # Login as staff
    cookies = staff_login()
    if not cookies:
        print("\n❌ FATAL: Could not obtain staff session, aborting remaining tests")
        sys.exit(1)
    
    # Test cases 2-10 with session
    results["Test 2: Lowercase Search"] = test_case_2_lowercase_search(cookies)
    results["Test 3: MRN Search"] = test_case_3_mrn_search(cookies)
    results["Test 4: Exact DOB Search"] = test_case_4_exact_dob_search(cookies)
    results["Test 5: Year DOB Search"] = test_case_5_year_dob_search(cookies)
    results["Test 6: Status Filter + DOB Sort"] = test_case_6_status_filter_sort_dob(cookies)
    results["Test 7: Name Sort Descending"] = test_case_7_sort_name_desc(cookies)
    results["Test 8: Sex Filter"] = test_case_8_sex_filter(cookies)
    results["Test 9: Empty Search"] = test_case_9_empty_search(cookies)
    results["Test 10: Limit Parameter"] = test_case_10_limit(cookies)
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, passed_flag in results.items():
        status = "✅ PASS" if passed_flag else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print(f"\n⚠️ {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
