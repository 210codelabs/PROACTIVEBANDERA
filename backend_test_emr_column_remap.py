#!/usr/bin/env python3
"""
Backend test for EMR Import Feature 1: Column Remap
Tests POST /api/admin/import/preview with mapping override and sampleRows
"""
import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Test CSV with UNIQUE names
TEST_CSV = """First Name,Last Name,DOB,Sex,Email,Phone,Address,City,State,Zip,MRN,Primary Insurance,Member ID
Zebulon,Testarossa,05/14/1985,M,zeb@example.com,210-555-0111,100 Main St,San Antonio,TX,78205,PFTEST-9001,UnitedHealthcare,UHC900001
Ophelia,Quibblesworth,1990-03-22,F,,,,,,,PFTEST-9002,Aetna,AET900002"""

def login_admin():
    """Login as admin and return session cookie"""
    print("\n=== SETUP: Admin Login ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        print(f"Login status: {resp.status_code}")
        if resp.status_code == 200:
            cookie = resp.cookies.get("proactive_session")
            if cookie:
                print(f"✅ Admin login successful, got session cookie")
                return cookie
            else:
                print("❌ No session cookie returned")
                return None
        else:
            print(f"❌ Login failed: {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_1_preview_no_auth():
    """Test 1: POST /api/admin/import/preview WITHOUT auth cookie -> expect 401"""
    print("\n=== TEST 1: Preview without auth (expect 401) ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/import/preview",
            json={"source": "practice_fusion", "csv": TEST_CSV},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        
        if resp.status_code == 401:
            print("✅ TEST 1 PASSED: Correctly returned 401 Unauthorized")
            return True
        else:
            print(f"❌ TEST 1 FAILED: Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 ERROR: {e}")
        return False

def test_2_preview_no_mapping_with_sample_rows(cookie):
    """Test 2: Preview as admin (no mapping) -> expect 200 with sampleRows array and auto-detected mapping"""
    print("\n=== TEST 2: Preview with no mapping override (expect 200 with sampleRows) ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/import/preview",
            json={"source": "practice_fusion", "csv": TEST_CSV},
            cookies={"proactive_session": cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 2 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check sampleRows exists and is an array
        sample_rows = data.get("sampleRows")
        if not isinstance(sample_rows, list):
            print(f"❌ TEST 2 FAILED: sampleRows is not an array")
            return False
        
        print(f"sampleRows length: {len(sample_rows)}")
        if len(sample_rows) != 2:
            print(f"❌ TEST 2 FAILED: Expected 2 sampleRows, got {len(sample_rows)}")
            return False
        
        # Check first row is raw string array
        first_row = sample_rows[0]
        if not isinstance(first_row, list):
            print(f"❌ TEST 2 FAILED: sampleRows[0] is not an array")
            return False
        
        print(f"sampleRows[0]: {first_row}")
        if first_row[0] != "Zebulon":
            print(f"❌ TEST 2 FAILED: sampleRows[0][0] should be 'Zebulon', got '{first_row[0]}'")
            return False
        
        print(f"✅ sampleRows[0][0] = 'Zebulon' (raw first column)")
        
        # Check mapping auto-detected
        mapping = data.get("mapping", {})
        print(f"Auto-detected mapping: {json.dumps(mapping, indent=2)}")
        
        if "firstName" not in mapping or "lastName" not in mapping:
            print(f"❌ TEST 2 FAILED: Auto-detected mapping missing firstName or lastName")
            return False
        
        print(f"✅ Auto-detected mapping includes firstName (col {mapping['firstName']}) and lastName (col {mapping['lastName']})")
        print("✅ TEST 2 PASSED: sampleRows array returned with auto-detected mapping")
        return True
        
    except Exception as e:
        print(f"❌ TEST 2 ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_3_preview_with_override_mapping(cookie):
    """Test 3: Preview with override mapping (firstName:1, lastName:0 swapped) -> expect override respected"""
    print("\n=== TEST 3: Preview with override mapping (swapped firstName/lastName) ===")
    try:
        # Deliberately swap firstName and lastName columns
        override_mapping = {
            "firstName": 1,  # Last Name column
            "lastName": 0    # First Name column
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/admin/import/preview",
            json={
                "source": "practice_fusion",
                "csv": TEST_CSV,
                "mapping": override_mapping
            },
            cookies={"proactive_session": cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        
        # Check that response.mapping equals the override exactly
        response_mapping = data.get("mapping", {})
        print(f"Response mapping: {json.dumps(response_mapping, indent=2)}")
        
        if response_mapping.get("firstName") != 1:
            print(f"❌ TEST 3 FAILED: mapping.firstName should be 1, got {response_mapping.get('firstName')}")
            return False
        
        if response_mapping.get("lastName") != 0:
            print(f"❌ TEST 3 FAILED: mapping.lastName should be 0, got {response_mapping.get('lastName')}")
            return False
        
        print(f"✅ Override mapping respected: firstName=1, lastName=0")
        
        # Check that sample[0].firstName is 'Testarossa' (column 1 value)
        sample = data.get("sample", [])
        if not sample:
            print(f"❌ TEST 3 FAILED: No sample data returned")
            return False
        
        first_sample = sample[0]
        print(f"sample[0]: {json.dumps(first_sample, indent=2)}")
        
        if first_sample.get("firstName") != "Testarossa":
            print(f"❌ TEST 3 FAILED: sample[0].firstName should be 'Testarossa' (from column 1), got '{first_sample.get('firstName')}'")
            return False
        
        print(f"✅ sample[0].firstName = 'Testarossa' (proving override mapping applied)")
        print("✅ TEST 3 PASSED: Override mapping respected and applied to sample output")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_4_preview_partial_mapping(cookie):
    """Test 4: Preview with partial mapping (only firstName, omit lastName) -> expect missingRequired includes lastName"""
    print("\n=== TEST 4: Preview with partial mapping (omit lastName) ===")
    try:
        # Only map firstName, omit lastName
        partial_mapping = {
            "firstName": 0
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/admin/import/preview",
            json={
                "source": "practice_fusion",
                "csv": TEST_CSV,
                "mapping": partial_mapping
            },
            cookies={"proactive_session": cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 4 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        
        # Check missingRequired includes 'lastName'
        missing_required = data.get("missingRequired", [])
        print(f"missingRequired: {missing_required}")
        
        if "lastName" not in missing_required:
            print(f"❌ TEST 4 FAILED: missingRequired should include 'lastName', got {missing_required}")
            return False
        
        print(f"✅ missingRequired includes 'lastName' as expected")
        print("✅ TEST 4 PASSED: Partial mapping validation working correctly")
        return True
        
    except Exception as e:
        print(f"❌ TEST 4 ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 80)
    print("EMR Import Feature 1: Column Remap - Backend Test")
    print("Testing POST /api/admin/import/preview with mapping override and sampleRows")
    print("=" * 80)
    
    results = []
    
    # Test 1: No auth
    results.append(("Test 1: No auth -> 401", test_1_preview_no_auth()))
    
    # Login as admin
    cookie = login_admin()
    if not cookie:
        print("\n❌ FATAL: Could not login as admin. Aborting tests.")
        sys.exit(1)
    
    # Test 2: No mapping override
    results.append(("Test 2: No mapping (sampleRows + auto-detect)", test_2_preview_no_mapping_with_sample_rows(cookie)))
    
    # Test 3: Override mapping (swapped)
    results.append(("Test 3: Override mapping (swapped)", test_3_preview_with_override_mapping(cookie)))
    
    # Test 4: Partial mapping
    results.append(("Test 4: Partial mapping (missing lastName)", test_4_preview_partial_mapping(cookie)))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
