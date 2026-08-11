#!/usr/bin/env python3
"""
Backend test for EMR Import Feature 3: Clinical Import (C-CDA XML / FHIR JSON)
Tests POST /api/admin/import/clinical/preview and POST /api/admin/import/clinical/commit
"""

import requests
import json
import sys

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Admin credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def read_fixture(filename):
    """Read test fixture file"""
    try:
        with open(f"/app/test_fixtures/{filename}", "r") as f:
            return f.read()
    except Exception as e:
        print(f"❌ ERROR reading fixture {filename}: {e}")
        sys.exit(1)

def login_admin():
    """Login as admin and return session cookie"""
    try:
        print("\n🔐 Logging in as admin...")
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Login failed: {response.text}")
            sys.exit(1)
        
        cookie = response.cookies.get("proactive_session")
        if not cookie:
            print("❌ No session cookie received")
            sys.exit(1)
        
        print(f"✅ Login successful, cookie: {cookie[:20]}...")
        return {"proactive_session": cookie}
    except Exception as e:
        print(f"❌ Login exception: {e}")
        sys.exit(1)

def test_preview_no_auth():
    """TEST 1: Preview without auth should return 401"""
    print("\n" + "="*80)
    print("TEST 1: POST /api/admin/import/clinical/preview WITHOUT auth cookie")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/preview",
            json={"content": "test"},
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ TEST 1 PASSED: Correctly returns 401 Unauthorized")
            return True
        else:
            print(f"❌ TEST 1 FAILED: Expected 401, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 EXCEPTION: {e}")
        return False

def test_preview_ccda(cookies, ccda_content):
    """TEST 2: Preview C-CDA XML"""
    print("\n" + "="*80)
    print("TEST 2: POST /api/admin/import/clinical/preview with C-CDA XML")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/preview",
            json={"content": ccda_content},
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 2 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Verify format
        if data.get("format") != "ccda":
            print(f"❌ TEST 2 FAILED: Expected format='ccda', got '{data.get('format')}'")
            return False
        print(f"✅ format='ccda'")
        
        # Verify patient data
        patient = data.get("patient", {})
        print(f"\nPatient data:")
        print(f"  firstName: {patient.get('firstName')}")
        print(f"  lastName: {patient.get('lastName')}")
        print(f"  mrn: {patient.get('mrn')}")
        print(f"  sex: {patient.get('sex')}")
        print(f"  dob: {patient.get('dob')}")
        
        checks = [
            (patient.get("firstName") == "Marco", f"firstName='Marco' (got '{patient.get('firstName')}')"),
            (patient.get("lastName") == "Verdana", f"lastName='Verdana' (got '{patient.get('lastName')}')"),
            (patient.get("mrn") == "CCDA-5001", f"mrn='CCDA-5001' (got '{patient.get('mrn')}')"),
            (patient.get("sex") == "M", f"sex='M' (got '{patient.get('sex')}')"),
            (patient.get("dob") == "1977-08-15", f"dob='1977-08-15' (got '{patient.get('dob')}')"),
        ]
        
        for check, msg in checks:
            if check:
                print(f"✅ {msg}")
            else:
                print(f"❌ {msg}")
                return False
        
        # Verify counts
        counts = data.get("counts", {})
        print(f"\nCounts:")
        print(f"  problems: {counts.get('problems')}")
        print(f"  medications: {counts.get('medications')}")
        print(f"  allergies: {counts.get('allergies')}")
        
        count_checks = [
            (counts.get("problems") == 2, f"problems=2 (got {counts.get('problems')})"),
            (counts.get("medications") == 2, f"medications=2 (got {counts.get('medications')})"),
            (counts.get("allergies") == 1, f"allergies=1 (got {counts.get('allergies')})"),
        ]
        
        for check, msg in count_checks:
            if check:
                print(f"✅ {msg}")
            else:
                print(f"❌ {msg}")
                return False
        
        # Verify first problem has icd10
        problems = data.get("problems", [])
        if len(problems) > 0:
            icd10 = problems[0].get("icd10")
            print(f"\nFirst problem ICD-10: {icd10}")
            if icd10 == "E11.9":
                print(f"✅ problems[0].icd10='E11.9'")
            else:
                print(f"❌ Expected problems[0].icd10='E11.9', got '{icd10}'")
                return False
        else:
            print(f"❌ No problems in response")
            return False
        
        # Verify missingRequired is empty
        missing = data.get("missingRequired", [])
        print(f"\nmissingRequired: {missing}")
        if len(missing) == 0:
            print(f"✅ missingRequired is empty")
        else:
            print(f"❌ Expected empty missingRequired, got {missing}")
            return False
        
        # Verify match is null (new patient)
        match = data.get("match")
        print(f"\nmatch: {match}")
        if match is None:
            print(f"✅ match is null (new patient)")
        else:
            print(f"❌ Expected match=null, got {match}")
            return False
        
        print("\n✅ TEST 2 PASSED: C-CDA preview successful with all expected fields")
        return True
        
    except Exception as e:
        print(f"❌ TEST 2 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_preview_fhir(cookies, fhir_content):
    """TEST 3: Preview FHIR JSON"""
    print("\n" + "="*80)
    print("TEST 3: POST /api/admin/import/clinical/preview with FHIR JSON")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/preview",
            json={"content": fhir_content},
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 3 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Verify format
        if data.get("format") != "fhir":
            print(f"❌ TEST 3 FAILED: Expected format='fhir', got '{data.get('format')}'")
            return False
        print(f"✅ format='fhir'")
        
        # Verify patient MRN
        patient = data.get("patient", {})
        print(f"\nPatient data:")
        print(f"  firstName: {patient.get('firstName')}")
        print(f"  lastName: {patient.get('lastName')}")
        print(f"  mrn: {patient.get('mrn')}")
        
        if patient.get("mrn") == "FHIR-6001":
            print(f"✅ mrn='FHIR-6001'")
        else:
            print(f"❌ Expected mrn='FHIR-6001', got '{patient.get('mrn')}'")
            return False
        
        # Verify counts
        counts = data.get("counts", {})
        print(f"\nCounts:")
        print(f"  problems: {counts.get('problems')}")
        print(f"  medications: {counts.get('medications')}")
        print(f"  allergies: {counts.get('allergies')}")
        
        count_checks = [
            (counts.get("problems") == 2, f"problems=2 (got {counts.get('problems')})"),
            (counts.get("medications") == 1, f"medications=1 (got {counts.get('medications')})"),
            (counts.get("allergies") == 1, f"allergies=1 (got {counts.get('allergies')})"),
        ]
        
        for check, msg in count_checks:
            if check:
                print(f"✅ {msg}")
            else:
                print(f"❌ {msg}")
                return False
        
        print("\n✅ TEST 3 PASSED: FHIR preview successful with all expected fields")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_commit_ccda_first(cookies, ccda_content):
    """TEST 4: Commit C-CDA first time"""
    print("\n" + "="*80)
    print("TEST 4: POST /api/admin/import/clinical/commit with C-CDA XML (first time)")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": ccda_content},
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 4 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        print(f"\nResponse data:")
        print(f"  patientCreated: {data.get('patientCreated')}")
        print(f"  patientId: {data.get('patientId')}")
        print(f"  created: {data.get('created')}")
        print(f"  skipped: {data.get('skipped')}")
        
        # Verify patientCreated
        if data.get("patientCreated") != True:
            print(f"❌ Expected patientCreated=true, got {data.get('patientCreated')}")
            return False, None
        print(f"✅ patientCreated=true")
        
        # Verify counts
        counts = data.get("counts", {})
        print(f"\nCounts:")
        print(f"  problems.created: {counts.get('problems', {}).get('created')}")
        print(f"  medications.created: {counts.get('medications', {}).get('created')}")
        print(f"  allergies.created: {counts.get('allergies', {}).get('created')}")
        
        count_checks = [
            (counts.get("problems", {}).get("created") == 2, f"problems.created=2 (got {counts.get('problems', {}).get('created')})"),
            (counts.get("medications", {}).get("created") == 2, f"medications.created=2 (got {counts.get('medications', {}).get('created')})"),
            (counts.get("allergies", {}).get("created") == 1, f"allergies.created=1 (got {counts.get('allergies', {}).get('created')})"),
        ]
        
        for check, msg in count_checks:
            if check:
                print(f"✅ {msg}")
            else:
                print(f"❌ {msg}")
                return False, None
        
        # Verify total created
        total_created = data.get("created")
        if total_created == 5:
            print(f"✅ total created=5")
        else:
            print(f"❌ Expected total created=5, got {total_created}")
            return False, None
        
        patient_id = data.get("patientId")
        print(f"\n✅ TEST 4 PASSED: C-CDA commit successful, patient created with ID: {patient_id}")
        return True, patient_id
        
    except Exception as e:
        print(f"❌ TEST 4 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False, None

def test_commit_ccda_idempotent(cookies, ccda_content):
    """TEST 5: Commit C-CDA again (idempotency test)"""
    print("\n" + "="*80)
    print("TEST 5: POST /api/admin/import/clinical/commit with SAME C-CDA XML (idempotency)")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": ccda_content},
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 5 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"\nResponse data:")
        print(f"  patientCreated: {data.get('patientCreated')}")
        print(f"  created: {data.get('created')}")
        print(f"  skipped: {data.get('skipped')}")
        
        # Verify patientCreated is false (matched by MRN)
        if data.get("patientCreated") != False:
            print(f"❌ Expected patientCreated=false (matched by MRN), got {data.get('patientCreated')}")
            return False
        print(f"✅ patientCreated=false (matched by MRN CCDA-5001)")
        
        # Verify counts - all created should be 0
        counts = data.get("counts", {})
        print(f"\nCounts:")
        print(f"  problems.created: {counts.get('problems', {}).get('created')}")
        print(f"  problems.skipped: {counts.get('problems', {}).get('skipped')}")
        print(f"  medications.created: {counts.get('medications', {}).get('created')}")
        print(f"  medications.skipped: {counts.get('medications', {}).get('skipped')}")
        print(f"  allergies.created: {counts.get('allergies', {}).get('created')}")
        print(f"  allergies.skipped: {counts.get('allergies', {}).get('skipped')}")
        
        created_checks = [
            (counts.get("problems", {}).get("created") == 0, f"problems.created=0 (got {counts.get('problems', {}).get('created')})"),
            (counts.get("medications", {}).get("created") == 0, f"medications.created=0 (got {counts.get('medications', {}).get('created')})"),
            (counts.get("allergies", {}).get("created") == 0, f"allergies.created=0 (got {counts.get('allergies', {}).get('created')})"),
        ]
        
        for check, msg in created_checks:
            if check:
                print(f"✅ {msg}")
            else:
                print(f"❌ {msg}")
                return False
        
        # Verify skipped totals > 0
        total_skipped = data.get("skipped")
        print(f"\nTotal skipped: {total_skipped}")
        if total_skipped > 0:
            print(f"✅ total skipped > 0 (idempotent dedupe working)")
        else:
            print(f"❌ Expected total skipped > 0, got {total_skipped}")
            return False
        
        print("\n✅ TEST 5 PASSED: Idempotency verified - all records skipped (deduped)")
        return True
        
    except Exception as e:
        print(f"❌ TEST 5 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_commit_fhir(cookies, fhir_content):
    """TEST 6: Commit FHIR JSON"""
    print("\n" + "="*80)
    print("TEST 6: POST /api/admin/import/clinical/commit with FHIR JSON")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": fhir_content},
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ TEST 6 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"\nResponse data:")
        print(f"  patientCreated: {data.get('patientCreated')}")
        print(f"  patientId: {data.get('patientId')}")
        print(f"  created: {data.get('created')}")
        print(f"  skipped: {data.get('skipped')}")
        
        # Verify patientCreated
        if data.get("patientCreated") != True:
            print(f"❌ Expected patientCreated=true, got {data.get('patientCreated')}")
            return False
        print(f"✅ patientCreated=true")
        
        # Verify total created = 4 (2 problems + 1 med + 1 allergy)
        total_created = data.get("created")
        if total_created == 4:
            print(f"✅ total created=4 (2 problems + 1 med + 1 allergy)")
        else:
            print(f"❌ Expected total created=4, got {total_created}")
            return False
        
        print("\n✅ TEST 6 PASSED: FHIR commit successful, patient created")
        return True
        
    except Exception as e:
        print(f"❌ TEST 6 EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_preview_garbage(cookies):
    """TEST 7: Preview with garbage content"""
    print("\n" + "="*80)
    print("TEST 7: POST /api/admin/import/clinical/preview with garbage content")
    print("="*80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/preview",
            json={"content": "hello world"},
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 400:
            print(f"✅ TEST 7 PASSED: Correctly returns 400 for unrecognized format")
            print(f"Response: {response.text}")
            return True
        else:
            print(f"❌ TEST 7 FAILED: Expected 400, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
    except Exception as e:
        print(f"❌ TEST 7 EXCEPTION: {e}")
        return False

def main():
    print("\n" + "="*80)
    print("BACKEND TEST: EMR Import Feature 3 - Clinical Import (C-CDA / FHIR)")
    print("="*80)
    
    # Read fixtures
    print("\n📁 Reading test fixtures...")
    ccda_content = read_fixture("sample_ccda.xml")
    fhir_content = read_fixture("sample_fhir.json")
    print(f"✅ C-CDA fixture: {len(ccda_content)} bytes")
    print(f"✅ FHIR fixture: {len(fhir_content)} bytes")
    
    # Run tests
    results = []
    
    # Test 1: Preview without auth
    results.append(("TEST 1: Preview no auth", test_preview_no_auth()))
    
    # Login
    cookies = login_admin()
    
    # Test 2: Preview C-CDA
    results.append(("TEST 2: Preview C-CDA", test_preview_ccda(cookies, ccda_content)))
    
    # Test 3: Preview FHIR
    results.append(("TEST 3: Preview FHIR", test_preview_fhir(cookies, fhir_content)))
    
    # Test 4: Commit C-CDA first time
    test4_result, patient_id = test_commit_ccda_first(cookies, ccda_content)
    results.append(("TEST 4: Commit C-CDA first", test4_result))
    
    # Test 5: Commit C-CDA again (idempotency)
    results.append(("TEST 5: Commit C-CDA idempotent", test_commit_ccda_idempotent(cookies, ccda_content)))
    
    # Test 6: Commit FHIR
    results.append(("TEST 6: Commit FHIR", test_commit_fhir(cookies, fhir_content)))
    
    # Test 7: Preview garbage
    results.append(("TEST 7: Preview garbage", test_preview_garbage(cookies)))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
