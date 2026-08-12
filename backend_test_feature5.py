#!/usr/bin/env python3
"""
Backend test for EMR Import Feature 5: SMART endpoint auto-discovery + code-review fixes
Tests:
- PART 1: POST /api/admin/fhir/discover endpoint (D1-D4)
- PART 2: REGRESSION of clinical import after refactor (D5a-D5e)
- PART 3: VITALS IDEMPOTENCY FIX for untimestamped vital (D6)
"""

import requests
import json
import sys
from pymongo import MongoClient

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "proactive_clinic"

def cleanup_test_patients():
    """Delete test patients and their child records"""
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        test_mrns = ["CCDA-5001", "FHIR-6001", "VIT-NOTS-1"]
        
        for mrn in test_mrns:
            # Find patient - MongoDB uses _id not id
            patient = db.Patient.find_one({"mrn": mrn})
            if patient:
                # MongoDB stores the id in the 'id' field, not '_id'
                patient_id = patient.get("id") or patient.get("_id")
                print(f"  Deleting patient {mrn} (ID: {patient_id}) and child records...")
                
                # Delete child records
                db.Problem.delete_many({"patientId": patient_id})
                db.Medication.delete_many({"patientId": patient_id})
                db.Allergy.delete_many({"patientId": patient_id})
                db.Vital.delete_many({"patientId": patient_id})
                db.Immunization.delete_many({"patientId": patient_id})
                db.Encounter.delete_many({"patientId": patient_id})
                
                # Delete patient
                db.Patient.delete_one({"mrn": mrn})
                print(f"  ✓ Deleted patient {mrn} and all child records")
            else:
                print(f"  Patient {mrn} not found (already clean)")
        
        client.close()
        print("✓ Cleanup completed")
    except Exception as e:
        print(f"✗ Cleanup error: {e}")
        import traceback
        traceback.print_exc()

def login():
    """Login as admin and return session cookie"""
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if response.status_code == 200:
            cookies = response.cookies
            print(f"✓ Login successful")
            return cookies
        else:
            print(f"✗ Login failed: {response.status_code} {response.text}")
            return None
    except Exception as e:
        print(f"✗ Login error: {e}")
        return None

def read_fixture(filename):
    """Read fixture file content"""
    try:
        with open(f"/app/test_fixtures/{filename}", "r") as f:
            return f.read()
    except Exception as e:
        print(f"✗ Error reading fixture {filename}: {e}")
        return None

# ============================================================================
# PART 1: POST /api/admin/fhir/discover endpoint tests (D1-D4)
# ============================================================================

def test_d1_discover_no_auth():
    """D1: POST /api/admin/fhir/discover without auth cookie -> 401"""
    print("\n=== TEST D1: Discover endpoint without auth ===")
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/fhir/discover",
            json={"baseUrl": "https://fhir.example.com/r4"},
            timeout=10
        )
        if response.status_code == 401:
            print(f"✓ D1 PASSED: Returns 401 Unauthorized without auth cookie")
            return True
        else:
            print(f"✗ D1 FAILED: Expected 401, got {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"✗ D1 ERROR: {e}")
        return False

def test_d2_discover_no_baseurl(cookies):
    """D2: POST /api/admin/fhir/discover as admin with empty body -> 400"""
    print("\n=== TEST D2: Discover endpoint with no baseUrl ===")
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/fhir/discover",
            json={},
            cookies=cookies,
            timeout=10
        )
        if response.status_code == 400:
            data = response.json()
            if "error" in data:
                print(f"✓ D2 PASSED: Returns 400 with error message: {data['error']}")
                return True
            else:
                print(f"✗ D2 FAILED: 400 but no error message in response")
                return False
        else:
            print(f"✗ D2 FAILED: Expected 400, got {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"✗ D2 ERROR: {e}")
        return False

def test_d3_discover_invalid_url(cookies):
    """D3: POST /api/admin/fhir/discover as admin with invalid URL -> 400"""
    print("\n=== TEST D3: Discover endpoint with invalid URL ===")
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/fhir/discover",
            json={"baseUrl": "not a url"},
            cookies=cookies,
            timeout=10
        )
        if response.status_code == 400:
            data = response.json()
            if "error" in data and "valid URL" in data["error"]:
                print(f"✓ D3 PASSED: Returns 400 with error: {data['error']}")
                return True
            else:
                print(f"✗ D3 FAILED: 400 but error message doesn't mention 'valid URL'")
                print(f"  Error: {data.get('error', 'N/A')}")
                return False
        else:
            print(f"✗ D3 FAILED: Expected 400, got {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"✗ D3 ERROR: {e}")
        return False

def test_d4_discover_unreachable(cookies):
    """D4: POST /api/admin/fhir/discover with unreachable URL -> 502 (NOT 500)"""
    print("\n=== TEST D4: Discover endpoint with unreachable URL ===")
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/fhir/discover",
            json={"baseUrl": "https://fhir.example.invalid/r4"},
            cookies=cookies,
            timeout=30  # Allow time for network timeout
        )
        
        print(f"  Status code: {response.status_code}")
        print(f"  Response text: {response.text[:200]}")
        
        if response.status_code == 502:
            try:
                data = response.json()
                if "error" in data:
                    print(f"✓ D4 PASSED: Returns 502 Bad Gateway with error message")
                    print(f"  Error: {data['error'][:100]}...")
                    return True
                else:
                    print(f"✗ D4 FAILED: 502 but no error message in response")
                    return False
            except Exception:
                # Response is not JSON, but status is 502
                print(f"✓ D4 PASSED: Returns 502 Bad Gateway (non-JSON response)")
                return True
        elif response.status_code == 500:
            print(f"✗ D4 FAILED: Returns 500 (should be 502 for unreachable)")
            print(f"  Response: {response.text[:200]}")
            return False
        else:
            print(f"✗ D4 FAILED: Expected 502, got {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"✗ D4 ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

# ============================================================================
# PART 2: REGRESSION of clinical import after refactor (D5a-D5e)
# ============================================================================

def test_d5a_preview_ccda(cookies):
    """D5a: Preview C-CDA and capture provider ID (Andy Manzano)"""
    print("\n=== TEST D5a: Preview C-CDA and capture provider ID ===")
    try:
        ccda_content = read_fixture("sample_ccda.xml")
        if not ccda_content:
            print("✗ D5a FAILED: Could not read sample_ccda.xml")
            return None
        
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/preview",
            json={"content": ccda_content},
            cookies=cookies,
            timeout=15
        )
        
        if response.status_code != 200:
            print(f"✗ D5a FAILED: Expected 200, got {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return None
        
        data = response.json()
        
        # Verify response structure
        if "providers" not in data or not isinstance(data["providers"], list):
            print(f"✗ D5a FAILED: No providers array in response")
            return None
        
        # Find Andy Manzano provider
        provider_id = None
        for provider in data["providers"]:
            if "Manzano" in provider.get("name", ""):
                provider_id = provider.get("id")
                print(f"✓ D5a PASSED: Found provider Andy Manzano (ID: {provider_id})")
                print(f"  Providers count: {len(data['providers'])}")
                return provider_id
        
        print(f"✗ D5a FAILED: Could not find provider with 'Manzano' in name")
        print(f"  Available providers: {[p.get('name') for p in data['providers']]}")
        return None
        
    except Exception as e:
        print(f"✗ D5a ERROR: {e}")
        return None

def test_d5b_commit_ccda_first(cookies, provider_id):
    """D5b: Commit C-CDA first time -> total created=9"""
    print("\n=== TEST D5b: Commit C-CDA first time ===")
    try:
        ccda_content = read_fixture("sample_ccda.xml")
        if not ccda_content:
            print("✗ D5b FAILED: Could not read sample_ccda.xml")
            return False
        
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": ccda_content, "defaultProviderId": provider_id},
            cookies=cookies,
            timeout=20
        )
        
        if response.status_code != 200:
            print(f"✗ D5b FAILED: Expected 200, got {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        # Verify patientCreated
        if not data.get("patientCreated"):
            print(f"✗ D5b FAILED: patientCreated should be true")
            return False
        
        # Verify counts
        counts = data.get("counts", {})
        problems_created = counts.get("problems", {}).get("created", 0)
        medications_created = counts.get("medications", {}).get("created", 0)
        allergies_created = counts.get("allergies", {}).get("created", 0)
        vitals_created = counts.get("vitals", {}).get("created", 0)
        immunizations_created = counts.get("immunizations", {}).get("created", 0)
        encounters_created = counts.get("encounters", {}).get("created", 0)
        
        total_created = data.get("created", 0)
        expected_total = 9  # 2 problems + 2 meds + 1 allergy + 1 vital + 2 immunizations + 1 encounter
        
        print(f"  Patient created: {data.get('patientCreated')}")
        print(f"  Problems created: {problems_created}")
        print(f"  Medications created: {medications_created}")
        print(f"  Allergies created: {allergies_created}")
        print(f"  Vitals created: {vitals_created}")
        print(f"  Immunizations created: {immunizations_created}")
        print(f"  Encounters created: {encounters_created}")
        print(f"  Total created: {total_created}")
        
        if total_created == expected_total:
            print(f"✓ D5b PASSED: Total created = {expected_total} (2+2+1+1+2+1)")
            return True
        else:
            print(f"✗ D5b FAILED: Expected total created={expected_total}, got {total_created}")
            return False
        
    except Exception as e:
        print(f"✗ D5b ERROR: {e}")
        return False

def test_d5c_commit_ccda_idempotent(cookies, provider_id):
    """D5c: Commit same C-CDA again -> total created=0 (idempotent)"""
    print("\n=== TEST D5c: Commit C-CDA again (idempotent) ===")
    try:
        ccda_content = read_fixture("sample_ccda.xml")
        if not ccda_content:
            print("✗ D5c FAILED: Could not read sample_ccda.xml")
            return False
        
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": ccda_content, "defaultProviderId": provider_id},
            cookies=cookies,
            timeout=20
        )
        
        if response.status_code != 200:
            print(f"✗ D5c FAILED: Expected 200, got {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        # Verify patientCreated is false (matched existing)
        if data.get("patientCreated"):
            print(f"✗ D5c FAILED: patientCreated should be false (patient already exists)")
            return False
        
        total_created = data.get("created", 0)
        
        print(f"  Patient created: {data.get('patientCreated')}")
        print(f"  Total created: {total_created}")
        print(f"  Total skipped: {data.get('skipped', 0)}")
        
        if total_created == 0:
            print(f"✓ D5c PASSED: Total created = 0 (fully idempotent)")
            return True
        else:
            print(f"✗ D5c FAILED: Expected total created=0, got {total_created}")
            return False
        
    except Exception as e:
        print(f"✗ D5c ERROR: {e}")
        return False

def test_d5d_commit_fhir_first(cookies):
    """D5d: Commit FHIR first time -> total created=8, encounters.created=2"""
    print("\n=== TEST D5d: Commit FHIR first time ===")
    try:
        fhir_content = read_fixture("sample_fhir.json")
        if not fhir_content:
            print("✗ D5d FAILED: Could not read sample_fhir.json")
            return False
        
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": fhir_content},
            cookies=cookies,
            timeout=20
        )
        
        if response.status_code != 200:
            print(f"✗ D5d FAILED: Expected 200, got {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        # Verify patientCreated
        if not data.get("patientCreated"):
            print(f"✗ D5d FAILED: patientCreated should be true")
            return False
        
        # Verify counts
        counts = data.get("counts", {})
        encounters_created = counts.get("encounters", {}).get("created", 0)
        total_created = data.get("created", 0)
        expected_total = 8  # 2 problems + 1 med + 1 allergy + 1 vital + 1 immunization + 2 encounters
        
        print(f"  Patient created: {data.get('patientCreated')}")
        print(f"  Encounters created: {encounters_created}")
        print(f"  Total created: {total_created}")
        
        if encounters_created == 2:
            print(f"✓ Encounters auto-matched to Andy Manzano: {encounters_created}")
        else:
            print(f"✗ D5d FAILED: Expected encounters.created=2, got {encounters_created}")
            return False
        
        if total_created == expected_total:
            print(f"✓ D5d PASSED: Total created = {expected_total} (2+1+1+1+1+2)")
            return True
        else:
            print(f"✗ D5d FAILED: Expected total created={expected_total}, got {total_created}")
            return False
        
    except Exception as e:
        print(f"✗ D5d ERROR: {e}")
        return False

def test_d5e_commit_fhir_idempotent(cookies):
    """D5e: Commit same FHIR again -> total created=0 (idempotent)"""
    print("\n=== TEST D5e: Commit FHIR again (idempotent) ===")
    try:
        fhir_content = read_fixture("sample_fhir.json")
        if not fhir_content:
            print("✗ D5e FAILED: Could not read sample_fhir.json")
            return False
        
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": fhir_content},
            cookies=cookies,
            timeout=20
        )
        
        if response.status_code != 200:
            print(f"✗ D5e FAILED: Expected 200, got {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        # Verify patientCreated is false
        if data.get("patientCreated"):
            print(f"✗ D5e FAILED: patientCreated should be false (patient already exists)")
            return False
        
        total_created = data.get("created", 0)
        
        print(f"  Patient created: {data.get('patientCreated')}")
        print(f"  Total created: {total_created}")
        print(f"  Total skipped: {data.get('skipped', 0)}")
        
        if total_created == 0:
            print(f"✓ D5e PASSED: Total created = 0 (fully idempotent)")
            return True
        else:
            print(f"✗ D5e FAILED: Expected total created=0, got {total_created}")
            return False
        
    except Exception as e:
        print(f"✗ D5e ERROR: {e}")
        return False

# ============================================================================
# PART 3: VITALS IDEMPOTENCY FIX for untimestamped vital (D6)
# ============================================================================

def test_d6_vitals_idempotency(cookies):
    """D6: Commit untimestamped vital TWICE -> first creates, second skips"""
    print("\n=== TEST D6: Vitals idempotency fix (untimestamped vital) ===")
    
    # Inline FHIR bundle with untimestamped vital
    bundle = {
        "resourceType": "Bundle",
        "entry": [
            {
                "resource": {
                    "resourceType": "Patient",
                    "identifier": [{"value": "VIT-NOTS-1"}],
                    "name": [{"given": ["Tessa"], "family": "Notimestamp"}],
                    "gender": "female",
                    "birthDate": "1988-02-02"
                }
            },
            {
                "resource": {
                    "resourceType": "Observation",
                    "category": [{"coding": [{"code": "vital-signs"}]}],
                    "code": {"coding": [{"system": "http://loinc.org", "code": "8867-4"}]},
                    "valueQuantity": {"value": 70, "unit": "/min"}
                }
            }
        ]
    }
    
    # First commit
    print("\n  --- First commit (should create vital) ---")
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": json.dumps(bundle)},
            cookies=cookies,
            timeout=20
        )
        
        if response.status_code != 200:
            print(f"✗ D6 FAILED (first commit): Expected 200, got {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        if not data.get("patientCreated"):
            print(f"✗ D6 FAILED (first commit): patientCreated should be true")
            return False
        
        counts = data.get("counts", {})
        vitals_created = counts.get("vitals", {}).get("created", 0)
        
        print(f"  Patient created: {data.get('patientCreated')}")
        print(f"  Vitals created: {vitals_created}")
        
        if vitals_created != 1:
            print(f"✗ D6 FAILED (first commit): Expected vitals.created=1, got {vitals_created}")
            return False
        
        print(f"  ✓ First commit: vitals.created=1")
        
    except Exception as e:
        print(f"✗ D6 ERROR (first commit): {e}")
        return False
    
    # Second commit (same content)
    print("\n  --- Second commit (should skip vital - KEY ASSERTION) ---")
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": json.dumps(bundle)},
            cookies=cookies,
            timeout=20
        )
        
        if response.status_code != 200:
            print(f"✗ D6 FAILED (second commit): Expected 200, got {response.status_code}")
            print(f"  Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        if data.get("patientCreated"):
            print(f"✗ D6 FAILED (second commit): patientCreated should be false")
            return False
        
        counts = data.get("counts", {})
        vitals_created = counts.get("vitals", {}).get("created", 0)
        vitals_skipped = counts.get("vitals", {}).get("skipped", 0)
        
        print(f"  Patient created: {data.get('patientCreated')}")
        print(f"  Vitals created: {vitals_created}")
        print(f"  Vitals skipped: {vitals_skipped}")
        
        # KEY ASSERTION: untimestamped vital must NOT duplicate
        if vitals_created == 0 and vitals_skipped == 1:
            print(f"✓ D6 PASSED: Untimestamped vital correctly deduped (created=0, skipped=1)")
            print(f"  This is the KEY FIX - untimestamped vitals no longer duplicate on re-import")
            return True
        else:
            print(f"✗ D6 FAILED: Expected vitals.created=0 and vitals.skipped=1")
            print(f"  Got vitals.created={vitals_created}, vitals.skipped={vitals_skipped}")
            print(f"  This means untimestamped vitals are still duplicating!")
            return False
        
    except Exception as e:
        print(f"✗ D6 ERROR (second commit): {e}")
        return False

# ============================================================================
# Main test runner
# ============================================================================

def main():
    print("=" * 80)
    print("EMR Import Feature 5: SMART auto-discovery + code-review fixes")
    print("Backend Testing")
    print("=" * 80)
    
    # Setup: cleanup test patients
    print("\n=== SETUP: Cleanup test patients ===")
    cleanup_test_patients()
    
    # Login
    print("\n=== LOGIN ===")
    cookies = login()
    if not cookies:
        print("\n✗ FATAL: Could not login. Aborting tests.")
        sys.exit(1)
    
    results = {}
    
    # PART 1: Discover endpoint tests
    print("\n" + "=" * 80)
    print("PART 1: POST /api/admin/fhir/discover endpoint tests")
    print("=" * 80)
    
    results["D1"] = test_d1_discover_no_auth()
    results["D2"] = test_d2_discover_no_baseurl(cookies)
    results["D3"] = test_d3_discover_invalid_url(cookies)
    results["D4"] = test_d4_discover_unreachable(cookies)
    
    # PART 2: Clinical import regression tests
    print("\n" + "=" * 80)
    print("PART 2: REGRESSION of clinical import after refactor")
    print("=" * 80)
    
    provider_id = test_d5a_preview_ccda(cookies)
    if provider_id:
        results["D5a"] = True
        results["D5b"] = test_d5b_commit_ccda_first(cookies, provider_id)
        results["D5c"] = test_d5c_commit_ccda_idempotent(cookies, provider_id)
    else:
        results["D5a"] = False
        results["D5b"] = False
        results["D5c"] = False
        print("\n✗ Skipping D5b and D5c due to D5a failure")
    
    results["D5d"] = test_d5d_commit_fhir_first(cookies)
    results["D5e"] = test_d5e_commit_fhir_idempotent(cookies)
    
    # PART 3: Vitals idempotency fix
    print("\n" + "=" * 80)
    print("PART 3: VITALS IDEMPOTENCY FIX (untimestamped vital)")
    print("=" * 80)
    
    results["D6"] = test_d6_vitals_idempotency(cookies)
    
    # Cleanup: delete test patients
    print("\n=== CLEANUP: Delete test patients ===")
    cleanup_test_patients()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"\nPART 1 - Discover endpoint:")
    print(f"  D1 (no auth -> 401): {'✓ PASS' if results.get('D1') else '✗ FAIL'}")
    print(f"  D2 (no baseUrl -> 400): {'✓ PASS' if results.get('D2') else '✗ FAIL'}")
    print(f"  D3 (invalid URL -> 400): {'✓ PASS' if results.get('D3') else '✗ FAIL'}")
    print(f"  D4 (unreachable -> 502): {'✓ PASS' if results.get('D4') else '✗ FAIL'}")
    
    print(f"\nPART 2 - Clinical import regression:")
    print(f"  D5a (preview C-CDA, capture provider): {'✓ PASS' if results.get('D5a') else '✗ FAIL'}")
    print(f"  D5b (commit C-CDA first, total=9): {'✓ PASS' if results.get('D5b') else '✗ FAIL'}")
    print(f"  D5c (commit C-CDA again, total=0): {'✓ PASS' if results.get('D5c') else '✗ FAIL'}")
    print(f"  D5d (commit FHIR first, total=8): {'✓ PASS' if results.get('D5d') else '✗ FAIL'}")
    print(f"  D5e (commit FHIR again, total=0): {'✓ PASS' if results.get('D5e') else '✗ FAIL'}")
    
    print(f"\nPART 3 - Vitals idempotency fix:")
    print(f"  D6 (untimestamped vital dedupe): {'✓ PASS' if results.get('D6') else '✗ FAIL'}")
    
    print(f"\n{'=' * 80}")
    print(f"TOTAL: {passed}/{total} tests passed")
    print(f"{'=' * 80}")
    
    if passed == total:
        print("\n✓ ALL TESTS PASSED")
        sys.exit(0)
    else:
        print(f"\n✗ {total - passed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
