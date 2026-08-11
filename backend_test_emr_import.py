#!/usr/bin/env python3
"""
Backend test for Admin EMR Data Import endpoints.
Tests POST /api/admin/import/preview and POST /api/admin/import/commit
"""
import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Test CSV with UNIQUE names to avoid collisions with seeded data
TEST_CSV = """First Name,Last Name,DOB,Sex,Email,Phone,Address,City,State,Zip,MRN,Primary Insurance,Member ID
Zebulon,Testarossa,05/14/1985,M,zeb@example.com,210-555-0111,100 Main St,San Antonio,TX,78205,PFTEST-9001,UnitedHealthcare,UHC900001
Ophelia,Quibblesworth,1990-03-22,F,,,,,,,PFTEST-9002,Aetna,AET900002"""

INVALID_CSV = """foo,bar
1,2"""

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

def test_preview_no_auth():
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

def test_preview_valid_csv(cookie):
    """Test 2: POST /api/admin/import/preview as admin with valid CSV -> expect 200 with correct mapping"""
    print("\n=== TEST 2: Preview with valid Practice Fusion CSV (expect 200) ===")
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
        
        # Check required fields in response
        if not data.get("ok"):
            print(f"❌ TEST 2 FAILED: ok field is not true")
            return False
        
        mapping = data.get("mapping", {})
        print(f"Mapping: {json.dumps(mapping, indent=2)}")
        
        # Assert: mapping object contains required keys
        required_keys = ["firstName", "lastName", "dob", "mrn", "insurerName", "memberId"]
        missing_keys = [k for k in required_keys if k not in mapping]
        if missing_keys:
            print(f"❌ TEST 2 FAILED: Missing mapping keys: {missing_keys}")
            return False
        print(f"✅ All required mapping keys present: {required_keys}")
        
        # Check rowCount
        row_count = data.get("rowCount")
        if row_count != 2:
            print(f"❌ TEST 2 FAILED: Expected rowCount=2, got {row_count}")
            return False
        print(f"✅ rowCount = {row_count}")
        
        # Check missingRequired is empty
        missing_required = data.get("missingRequired", [])
        if missing_required:
            print(f"❌ TEST 2 FAILED: missingRequired should be empty, got {missing_required}")
            return False
        print(f"✅ missingRequired is empty")
        
        # Check sample data
        sample = data.get("sample", [])
        if len(sample) < 2:
            print(f"❌ TEST 2 FAILED: Expected at least 2 sample rows, got {len(sample)}")
            return False
        
        # Check first sample row
        first = sample[0]
        print(f"First sample row: {json.dumps(first, indent=2)}")
        if first.get("firstName") != "Zebulon":
            print(f"❌ TEST 2 FAILED: Expected firstName='Zebulon', got '{first.get('firstName')}'")
            return False
        print(f"✅ sample[0].firstName = 'Zebulon'")
        
        # Check DOB normalization (MM/DD/YYYY -> YYYY-MM-DD)
        first_dob = first.get("dob")
        if first_dob != "1985-05-14":
            print(f"❌ TEST 2 FAILED: Expected dob='1985-05-14' (normalized from 05/14/1985), got '{first_dob}'")
            return False
        print(f"✅ sample[0].dob = '1985-05-14' (MM/DD/YYYY normalized to ISO)")
        
        # Check second sample row DOB (already in ISO format)
        second = sample[1]
        print(f"Second sample row: {json.dumps(second, indent=2)}")
        second_dob = second.get("dob")
        if second_dob != "1990-03-22":
            print(f"❌ TEST 2 FAILED: Expected dob='1990-03-22', got '{second_dob}'")
            return False
        print(f"✅ sample[1].dob = '1990-03-22'")
        
        print("✅ TEST 2 PASSED: Preview returned correct mapping, rowCount, and normalized DOB")
        return True
        
    except Exception as e:
        print(f"❌ TEST 2 ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_preview_invalid_csv(cookie):
    """Test 3: POST /api/admin/import/preview with invalid CSV -> expect 200 but missingRequired includes firstName/lastName"""
    print("\n=== TEST 3: Preview with invalid CSV (expect 200 with missingRequired) ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/import/preview",
            json={"source": "csv", "csv": INVALID_CSV},
            cookies={"proactive_session": cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        missing_required = data.get("missingRequired", [])
        print(f"missingRequired: {missing_required}")
        
        if "firstName" not in missing_required or "lastName" not in missing_required:
            print(f"❌ TEST 3 FAILED: Expected missingRequired to include 'firstName' and 'lastName', got {missing_required}")
            return False
        
        print("✅ TEST 3 PASSED: Invalid CSV correctly identified missing firstName and lastName")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 ERROR: {e}")
        return False

def test_commit_first_time(cookie):
    """Test 4: POST /api/admin/import/commit as admin -> expect 200 with created:2, skipped:0"""
    print("\n=== TEST 4: Commit import (first time, expect created:2, skipped:0) ===")
    
    # First, clean up any existing test patients to ensure fresh import
    print("Cleaning up existing test patients (PFTEST-9001, PFTEST-9002)...")
    try:
        # Search for existing test patients
        for mrn in ["PFTEST-9001", "PFTEST-9002"]:
            search_resp = requests.get(
                f"{BASE_URL}/api/patients/search?q={mrn}",
                cookies={"proactive_session": cookie},
                timeout=10
            )
            if search_resp.status_code == 200:
                data = search_resp.json()
                patients = data.get("patients") or data.get("results", [])
                for p in patients:
                    if p.get("mrn") == mrn:
                        # Delete this patient
                        print(f"  Deleting existing patient {mrn} (ID: {p.get('id')})")
                        del_resp = requests.delete(
                            f"{BASE_URL}/api/patients/{p.get('id')}",
                            cookies={"proactive_session": cookie},
                            timeout=10
                        )
                        if del_resp.status_code in [200, 204]:
                            print(f"  ✅ Deleted {mrn}")
                        else:
                            print(f"  ⚠️  Could not delete {mrn}: {del_resp.status_code}")
    except Exception as e:
        print(f"  ⚠️  Cleanup error (non-fatal): {e}")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/import/commit",
            json={"source": "practice_fusion", "csv": TEST_CSV},
            cookies={"proactive_session": cookie},
            timeout=15
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 4 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check status
        status = data.get("status")
        if status != "completed":
            print(f"❌ TEST 4 FAILED: Expected status='completed', got '{status}'")
            return False
        print(f"✅ status = 'completed'")
        
        # Check created count
        created = data.get("created")
        if created != 2:
            print(f"❌ TEST 4 FAILED: Expected created=2, got {created}")
            return False
        print(f"✅ created = 2")
        
        # Check skipped count
        skipped = data.get("skipped")
        if skipped != 0:
            print(f"❌ TEST 4 FAILED: Expected skipped=0, got {skipped}")
            return False
        print(f"✅ skipped = 0")
        
        # Check failed count
        failed = data.get("failed")
        if failed != 0:
            print(f"❌ TEST 4 FAILED: Expected failed=0, got {failed}")
            return False
        print(f"✅ failed = 0")
        
        # Check jobId is not null
        job_id = data.get("jobId")
        if not job_id:
            print(f"❌ TEST 4 FAILED: Expected non-null jobId, got {job_id}")
            return False
        print(f"✅ jobId = {job_id}")
        
        print("✅ TEST 4 PASSED: Import committed successfully with 2 patients created")
        return True
        
    except Exception as e:
        print(f"❌ TEST 4 ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_commit_duplicate(cookie):
    """Test 5: POST /api/admin/import/commit with SAME CSV again -> expect 200 with created:0, skipped:2 (dedupe)"""
    print("\n=== TEST 5: Commit same CSV again (expect created:0, skipped:2 - dedupe) ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/import/commit",
            json={"source": "practice_fusion", "csv": TEST_CSV},
            cookies={"proactive_session": cookie},
            timeout=15
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 5 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check created count (should be 0 - dedupe)
        created = data.get("created")
        if created != 0:
            print(f"❌ TEST 5 FAILED: Expected created=0 (dedupe), got {created}")
            return False
        print(f"✅ created = 0 (dedupe working)")
        
        # Check skipped count (should be 2 - both patients already exist)
        skipped = data.get("skipped")
        if skipped != 2:
            print(f"❌ TEST 5 FAILED: Expected skipped=2 (both patients exist), got {skipped}")
            return False
        print(f"✅ skipped = 2 (both patients already exist)")
        
        print("✅ TEST 5 PASSED: Dedupe working correctly - no duplicates created")
        return True
        
    except Exception as e:
        print(f"❌ TEST 5 ERROR: {e}")
        return False

def test_get_jobs(cookie):
    """Test 6: GET /api/admin/import/commit as admin -> expect 200 with jobs list"""
    print("\n=== TEST 6: Get import jobs list (expect 200 with jobs array) ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/admin/import/commit",
            cookies={"proactive_session": cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 6 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        jobs = data.get("jobs", [])
        print(f"Number of jobs: {len(jobs)}")
        
        if not isinstance(jobs, list):
            print(f"❌ TEST 6 FAILED: Expected jobs to be an array, got {type(jobs)}")
            return False
        
        # Should have at least 2 jobs from our tests
        if len(jobs) < 2:
            print(f"❌ TEST 6 FAILED: Expected at least 2 jobs (from our 2 commit calls), got {len(jobs)}")
            return False
        
        # Check first job structure
        if jobs:
            first_job = jobs[0]
            print(f"First job: {json.dumps(first_job, indent=2, default=str)}")
            
            required_fields = ["id", "source", "status", "created", "skipped", "failed"]
            missing_fields = [f for f in required_fields if f not in first_job]
            if missing_fields:
                print(f"❌ TEST 6 FAILED: Job missing fields: {missing_fields}")
                return False
            print(f"✅ Job has all required fields")
        
        print(f"✅ TEST 6 PASSED: Jobs list returned with {len(jobs)} jobs")
        return True
        
    except Exception as e:
        print(f"❌ TEST 6 ERROR: {e}")
        return False

def test_verify_import(cookie):
    """Test 7: Verify import worked via GET /api/patients/search?q=Quibblesworth"""
    print("\n=== TEST 7: Verify imported patient via search (expect Ophelia Quibblesworth) ===")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/patients/search?q=Quibblesworth",
            cookies={"proactive_session": cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 7 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2, default=str)}")
        
        # Handle both "patients" and "results" keys
        patients = data.get("patients") or data.get("results", [])
        if not patients:
            print(f"❌ TEST 7 FAILED: No patients found with name 'Quibblesworth'")
            return False
        
        # Find Ophelia Quibblesworth
        ophelia = None
        for p in patients:
            if p.get("firstName") == "Ophelia" and p.get("lastName") == "Quibblesworth":
                ophelia = p
                break
        
        if not ophelia:
            print(f"❌ TEST 7 FAILED: Patient 'Ophelia Quibblesworth' not found in search results")
            found_names = [f"{p.get('firstName')} {p.get('lastName')}" for p in patients]
            print(f"Found patients: {found_names}")
            return False
        
        print(f"✅ Found patient: {ophelia.get('firstName')} {ophelia.get('lastName')}")
        
        # Check MRN
        mrn = ophelia.get("mrn")
        if mrn != "PFTEST-9002":
            print(f"❌ TEST 7 FAILED: Expected MRN='PFTEST-9002', got '{mrn}'")
            return False
        print(f"✅ MRN = 'PFTEST-9002'")
        
        # Check other fields
        print(f"Patient details:")
        print(f"  - Name: {ophelia.get('firstName')} {ophelia.get('lastName')}")
        print(f"  - MRN: {ophelia.get('mrn')}")
        print(f"  - DOB: {ophelia.get('dob')}")
        print(f"  - Sex: {ophelia.get('sex')}")
        print(f"  - Insurer: {ophelia.get('insurerName')}")
        print(f"  - Member ID: {ophelia.get('memberId')}")
        
        print("✅ TEST 7 PASSED: Imported patient verified successfully")
        return True
        
    except Exception as e:
        print(f"❌ TEST 7 ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 80)
    print("BACKEND TEST: Admin EMR Data Import Endpoints")
    print("=" * 80)
    
    results = []
    
    # Test 1: Preview without auth
    results.append(("Test 1: Preview without auth (401)", test_preview_no_auth()))
    
    # Login as admin
    cookie = login_admin()
    if not cookie:
        print("\n❌ FATAL: Could not login as admin. Aborting tests.")
        sys.exit(1)
    
    # Test 2: Preview with valid CSV
    results.append(("Test 2: Preview valid CSV", test_preview_valid_csv(cookie)))
    
    # Test 3: Preview with invalid CSV
    results.append(("Test 3: Preview invalid CSV", test_preview_invalid_csv(cookie)))
    
    # Test 4: Commit first time
    results.append(("Test 4: Commit first time", test_commit_first_time(cookie)))
    
    # Test 5: Commit duplicate (dedupe)
    results.append(("Test 5: Commit duplicate (dedupe)", test_commit_duplicate(cookie)))
    
    # Test 6: Get jobs list
    results.append(("Test 6: Get jobs list", test_get_jobs(cookie)))
    
    # Test 7: Verify import
    results.append(("Test 7: Verify import via search", test_verify_import(cookie)))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {name}")
    
    total = len(results)
    passed = sum(1 for _, p in results if p)
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
