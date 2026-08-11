#!/usr/bin/env python3
"""
Backend test for EMR Import Feature 3b: Vitals & Immunizations
Tests the extended C-CDA/FHIR clinical importer that now also extracts Vital signs and Immunizations.
"""
import requests
import json
import sys
from pymongo import MongoClient

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def login_admin():
    """Login as admin and return session cookie"""
    print("\n=== ADMIN LOGIN ===")
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    print(f"POST /api/auth/login -> {resp.status_code}")
    if resp.status_code != 200:
        print(f"ERROR: Login failed: {resp.text}")
        sys.exit(1)
    cookie = resp.cookies.get("proactive_session")
    if not cookie:
        print("ERROR: No session cookie returned")
        sys.exit(1)
    print(f"✅ Admin login successful, session cookie obtained")
    return {"proactive_session": cookie}

def cleanup_test_patients():
    """Delete patients MRN CCDA-5001 and FHIR-6001 + their clinical child records"""
    print("\n=== CLEANUP: DELETE TEST PATIENTS ===")
    try:
        client = MongoClient("mongodb://localhost:27017")
        db = client["proactive_clinic"]
        
        # Find patients by MRN
        ccda_patient = db.Patient.find_one({"mrn": "CCDA-5001"})
        fhir_patient = db.Patient.find_one({"mrn": "FHIR-6001"})
        
        deleted_counts = {"patients": 0, "problems": 0, "medications": 0, "allergies": 0, "vitals": 0, "immunizations": 0}
        
        for patient in [ccda_patient, fhir_patient]:
            if patient:
                pid = patient["id"]
                mrn = patient["mrn"]
                print(f"Found patient {mrn} (ID: {pid}), deleting child records...")
                
                # Delete child records
                deleted_counts["problems"] += db.Problem.delete_many({"patientId": pid}).deleted_count
                deleted_counts["medications"] += db.Medication.delete_many({"patientId": pid}).deleted_count
                deleted_counts["allergies"] += db.Allergy.delete_many({"patientId": pid}).deleted_count
                deleted_counts["vitals"] += db.Vital.delete_many({"patientId": pid}).deleted_count
                deleted_counts["immunizations"] += db.Immunization.delete_many({"patientId": pid}).deleted_count
                
                # Delete patient
                db.Patient.delete_one({"id": pid})
                deleted_counts["patients"] += 1
                print(f"✅ Deleted patient {mrn} and all child records")
        
        if deleted_counts["patients"] == 0:
            print("✅ No test patients found (clean state)")
        else:
            print(f"✅ Cleanup complete: {deleted_counts}")
        
        client.close()
    except Exception as e:
        print(f"⚠️  Cleanup error (non-critical): {e}")

def read_fixture(path):
    """Read fixture file content"""
    with open(path, 'r') as f:
        return f.read()

def test_preview_ccda(cookies):
    """TEST 2: Preview C-CDA - verify counts and vital values"""
    print("\n=== TEST 2: PREVIEW C-CDA ===")
    content = read_fixture("/app/test_fixtures/sample_ccda.xml")
    
    resp = requests.post(
        f"{BASE_URL}/api/admin/import/clinical/preview",
        json={"content": content},
        cookies=cookies
    )
    print(f"POST /api/admin/import/clinical/preview (C-CDA) -> {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    
    # Verify counts
    counts = data.get("counts", {})
    print(f"Counts: {counts}")
    
    errors = []
    if counts.get("problems") != 2:
        errors.append(f"Expected counts.problems=2, got {counts.get('problems')}")
    if counts.get("medications") != 2:
        errors.append(f"Expected counts.medications=2, got {counts.get('medications')}")
    if counts.get("allergies") != 1:
        errors.append(f"Expected counts.allergies=1, got {counts.get('allergies')}")
    if counts.get("vitals") != 1:
        errors.append(f"Expected counts.vitals=1, got {counts.get('vitals')}")
    if counts.get("immunizations") != 2:
        errors.append(f"Expected counts.immunizations=2, got {counts.get('immunizations')}")
    
    # Verify vital values
    vitals = data.get("vitals", [])
    if len(vitals) > 0:
        v = vitals[0]
        print(f"Vital reading: {v}")
        
        if v.get("systolic") != 128:
            errors.append(f"Expected systolic=128, got {v.get('systolic')}")
        if v.get("diastolic") != 82:
            errors.append(f"Expected diastolic=82, got {v.get('diastolic')}")
        if v.get("pulse") != 72:
            errors.append(f"Expected pulse=72, got {v.get('pulse')}")
        if v.get("weightKg") != 82:
            errors.append(f"Expected weightKg=82, got {v.get('weightKg')}")
        if v.get("heightCm") != 180:
            errors.append(f"Expected heightCm=180, got {v.get('heightCm')}")
        if v.get("temperatureC") != 37:
            errors.append(f"Expected temperatureC=37, got {v.get('temperatureC')}")
        if v.get("respRate") != 16:
            errors.append(f"Expected respRate=16, got {v.get('respRate')}")
        if v.get("spo2") != 98:
            errors.append(f"Expected spo2=98, got {v.get('spo2')}")
        if v.get("bmi") != 25.3:
            errors.append(f"Expected bmi=25.3, got {v.get('bmi')}")
    else:
        errors.append("No vitals returned")
    
    # Verify immunizations
    immunizations = data.get("immunizations", [])
    print(f"Immunizations: {immunizations}")
    if len(immunizations) != 2:
        errors.append(f"Expected 2 immunizations, got {len(immunizations)}")
    else:
        cvx_codes = [im.get("cvxCode") for im in immunizations]
        if "140" not in cvx_codes:
            errors.append(f"Expected cvxCode='140' (Influenza) in immunizations, got {cvx_codes}")
        if "208" not in cvx_codes:
            errors.append(f"Expected cvxCode='208' (COVID-19 Pfizer) in immunizations, got {cvx_codes}")
    
    if errors:
        print(f"❌ FAILED: {len(errors)} errors:")
        for e in errors:
            print(f"  - {e}")
        return False
    
    print("✅ PASSED: C-CDA preview correct (counts + vital values + immunizations)")
    return True

def test_preview_fhir(cookies):
    """TEST 3: Preview FHIR - verify counts and vital values (unit conversions)"""
    print("\n=== TEST 3: PREVIEW FHIR ===")
    content = read_fixture("/app/test_fixtures/sample_fhir.json")
    
    resp = requests.post(
        f"{BASE_URL}/api/admin/import/clinical/preview",
        json={"content": content},
        cookies=cookies
    )
    print(f"POST /api/admin/import/clinical/preview (FHIR) -> {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    print(f"Response keys: {list(data.keys())}")
    
    # Verify counts
    counts = data.get("counts", {})
    print(f"Counts: {counts}")
    
    errors = []
    if counts.get("problems") != 2:
        errors.append(f"Expected counts.problems=2, got {counts.get('problems')}")
    if counts.get("medications") != 1:
        errors.append(f"Expected counts.medications=1, got {counts.get('medications')}")
    if counts.get("allergies") != 1:
        errors.append(f"Expected counts.allergies=1, got {counts.get('allergies')}")
    if counts.get("vitals") != 1:
        errors.append(f"Expected counts.vitals=1, got {counts.get('vitals')}")
    if counts.get("immunizations") != 1:
        errors.append(f"Expected counts.immunizations=1, got {counts.get('immunizations')}")
    
    # Verify vital values (with unit conversions)
    vitals = data.get("vitals", [])
    if len(vitals) > 0:
        v = vitals[0]
        print(f"Vital reading: {v}")
        
        if v.get("systolic") != 122:
            errors.append(f"Expected systolic=122, got {v.get('systolic')}")
        if v.get("diastolic") != 78:
            errors.append(f"Expected diastolic=78, got {v.get('diastolic')}")
        if v.get("pulse") != 68:
            errors.append(f"Expected pulse=68, got {v.get('pulse')}")
        
        # Weight conversion: 135 lb -> 61.2 kg (135 * 0.45359237 = 61.235)
        weight = v.get("weightKg")
        if weight is None or abs(weight - 61.2) > 0.1:
            errors.append(f"Expected weightKg=61.2 (converted from 135 lb), got {weight}")
        
        # Temperature conversion: 98.6 F -> 37 C ((98.6 - 32) * 5/9 = 37)
        temp = v.get("temperatureC")
        if temp is None or abs(temp - 37) > 0.1:
            errors.append(f"Expected temperatureC=37 (converted from 98.6 F), got {temp}")
        
        if v.get("spo2") != 99:
            errors.append(f"Expected spo2=99, got {v.get('spo2')}")
    else:
        errors.append("No vitals returned")
    
    # Verify immunization
    immunizations = data.get("immunizations", [])
    print(f"Immunizations: {immunizations}")
    if len(immunizations) != 1:
        errors.append(f"Expected 1 immunization, got {len(immunizations)}")
    else:
        cvx_code = immunizations[0].get("cvxCode")
        if cvx_code != "115":
            errors.append(f"Expected cvxCode='115' (Tdap), got {cvx_code}")
    
    if errors:
        print(f"❌ FAILED: {len(errors)} errors:")
        for e in errors:
            print(f"  - {e}")
        return False
    
    print("✅ PASSED: FHIR preview correct (counts + vital values with unit conversions + immunization)")
    return True

def test_commit_ccda_first(cookies):
    """TEST 4: Commit C-CDA first time - verify patientCreated=true, counts.vitals.created=1, counts.immunizations.created=2, total created=8"""
    print("\n=== TEST 4: COMMIT C-CDA FIRST TIME ===")
    content = read_fixture("/app/test_fixtures/sample_ccda.xml")
    
    resp = requests.post(
        f"{BASE_URL}/api/admin/import/clinical/commit",
        json={"content": content},
        cookies=cookies
    )
    print(f"POST /api/admin/import/clinical/commit (C-CDA) -> {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    errors = []
    if data.get("patientCreated") != True:
        errors.append(f"Expected patientCreated=true, got {data.get('patientCreated')}")
    
    counts = data.get("counts", {})
    if counts.get("problems", {}).get("created") != 2:
        errors.append(f"Expected counts.problems.created=2, got {counts.get('problems', {}).get('created')}")
    if counts.get("medications", {}).get("created") != 2:
        errors.append(f"Expected counts.medications.created=2, got {counts.get('medications', {}).get('created')}")
    if counts.get("allergies", {}).get("created") != 1:
        errors.append(f"Expected counts.allergies.created=1, got {counts.get('allergies', {}).get('created')}")
    if counts.get("vitals", {}).get("created") != 1:
        errors.append(f"Expected counts.vitals.created=1, got {counts.get('vitals', {}).get('created')}")
    if counts.get("immunizations", {}).get("created") != 2:
        errors.append(f"Expected counts.immunizations.created=2, got {counts.get('immunizations', {}).get('created')}")
    
    total_created = data.get("created")
    if total_created != 8:
        errors.append(f"Expected total created=8 (2+2+1+1+2), got {total_created}")
    
    if errors:
        print(f"❌ FAILED: {len(errors)} errors:")
        for e in errors:
            print(f"  - {e}")
        return False
    
    print("✅ PASSED: C-CDA first commit created patient + 8 records (2 problems + 2 meds + 1 allergy + 1 vital + 2 immunizations)")
    return True

def test_commit_ccda_idempotent(cookies):
    """TEST 5: Commit C-CDA again - verify patientCreated=false, all created=0, total skipped=8 (idempotency)"""
    print("\n=== TEST 5: COMMIT C-CDA AGAIN (IDEMPOTENCY) ===")
    content = read_fixture("/app/test_fixtures/sample_ccda.xml")
    
    resp = requests.post(
        f"{BASE_URL}/api/admin/import/clinical/commit",
        json={"content": content},
        cookies=cookies
    )
    print(f"POST /api/admin/import/clinical/commit (C-CDA AGAIN) -> {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    errors = []
    if data.get("patientCreated") != False:
        errors.append(f"Expected patientCreated=false (matched by MRN), got {data.get('patientCreated')}")
    
    counts = data.get("counts", {})
    if counts.get("problems", {}).get("created") != 0:
        errors.append(f"Expected counts.problems.created=0 (idempotent), got {counts.get('problems', {}).get('created')}")
    if counts.get("medications", {}).get("created") != 0:
        errors.append(f"Expected counts.medications.created=0 (idempotent), got {counts.get('medications', {}).get('created')}")
    if counts.get("allergies", {}).get("created") != 0:
        errors.append(f"Expected counts.allergies.created=0 (idempotent), got {counts.get('allergies', {}).get('created')}")
    if counts.get("vitals", {}).get("created") != 0:
        errors.append(f"Expected counts.vitals.created=0 (idempotent), got {counts.get('vitals', {}).get('created')}")
    if counts.get("immunizations", {}).get("created") != 0:
        errors.append(f"Expected counts.immunizations.created=0 (idempotent), got {counts.get('immunizations', {}).get('created')}")
    
    total_created = data.get("created")
    if total_created != 0:
        errors.append(f"Expected total created=0 (fully idempotent), got {total_created}")
    
    total_skipped = data.get("skipped")
    if total_skipped != 8:
        errors.append(f"Expected total skipped=8, got {total_skipped}")
    
    if errors:
        print(f"❌ FAILED: {len(errors)} errors:")
        for e in errors:
            print(f"  - {e}")
        return False
    
    print("✅ PASSED: C-CDA second commit fully idempotent (all created=0, all skipped=8)")
    return True

def test_commit_fhir_first(cookies):
    """TEST 6: Commit FHIR first time - verify patientCreated=true, counts.vitals.created=1, counts.immunizations.created=1, total created=6"""
    print("\n=== TEST 6: COMMIT FHIR FIRST TIME ===")
    content = read_fixture("/app/test_fixtures/sample_fhir.json")
    
    resp = requests.post(
        f"{BASE_URL}/api/admin/import/clinical/commit",
        json={"content": content},
        cookies=cookies
    )
    print(f"POST /api/admin/import/clinical/commit (FHIR) -> {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    errors = []
    if data.get("patientCreated") != True:
        errors.append(f"Expected patientCreated=true, got {data.get('patientCreated')}")
    
    counts = data.get("counts", {})
    if counts.get("problems", {}).get("created") != 2:
        errors.append(f"Expected counts.problems.created=2, got {counts.get('problems', {}).get('created')}")
    if counts.get("medications", {}).get("created") != 1:
        errors.append(f"Expected counts.medications.created=1, got {counts.get('medications', {}).get('created')}")
    if counts.get("allergies", {}).get("created") != 1:
        errors.append(f"Expected counts.allergies.created=1, got {counts.get('allergies', {}).get('created')}")
    if counts.get("vitals", {}).get("created") != 1:
        errors.append(f"Expected counts.vitals.created=1, got {counts.get('vitals', {}).get('created')}")
    if counts.get("immunizations", {}).get("created") != 1:
        errors.append(f"Expected counts.immunizations.created=1, got {counts.get('immunizations', {}).get('created')}")
    
    total_created = data.get("created")
    if total_created != 6:
        errors.append(f"Expected total created=6 (2+1+1+1+1), got {total_created}")
    
    if errors:
        print(f"❌ FAILED: {len(errors)} errors:")
        for e in errors:
            print(f"  - {e}")
        return False
    
    print("✅ PASSED: FHIR first commit created patient + 6 records (2 problems + 1 med + 1 allergy + 1 vital + 1 immunization)")
    return True

def test_commit_fhir_idempotent(cookies):
    """TEST 7: Commit FHIR again - verify total created=0 (idempotency)"""
    print("\n=== TEST 7: COMMIT FHIR AGAIN (IDEMPOTENCY) ===")
    content = read_fixture("/app/test_fixtures/sample_fhir.json")
    
    resp = requests.post(
        f"{BASE_URL}/api/admin/import/clinical/commit",
        json={"content": content},
        cookies=cookies
    )
    print(f"POST /api/admin/import/clinical/commit (FHIR AGAIN) -> {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    print(f"Response: {json.dumps(data, indent=2)}")
    
    errors = []
    if data.get("patientCreated") != False:
        errors.append(f"Expected patientCreated=false (matched by MRN), got {data.get('patientCreated')}")
    
    total_created = data.get("created")
    if total_created != 0:
        errors.append(f"Expected total created=0 (fully idempotent), got {total_created}")
    
    total_skipped = data.get("skipped")
    if total_skipped != 6:
        errors.append(f"Expected total skipped=6, got {total_skipped}")
    
    if errors:
        print(f"❌ FAILED: {len(errors)} errors:")
        for e in errors:
            print(f"  - {e}")
        return False
    
    print("✅ PASSED: FHIR second commit fully idempotent (all created=0, all skipped=6)")
    return True

def main():
    print("=" * 80)
    print("BACKEND TEST: EMR Import Feature 3b - Vitals & Immunizations")
    print("=" * 80)
    
    # Step 1: Cleanup
    cleanup_test_patients()
    
    # Login
    cookies = login_admin()
    
    # Run tests
    results = []
    results.append(("TEST 2: Preview C-CDA", test_preview_ccda(cookies)))
    results.append(("TEST 3: Preview FHIR", test_preview_fhir(cookies)))
    results.append(("TEST 4: Commit C-CDA first time", test_commit_ccda_first(cookies)))
    results.append(("TEST 5: Commit C-CDA idempotent", test_commit_ccda_idempotent(cookies)))
    results.append(("TEST 6: Commit FHIR first time", test_commit_fhir_first(cookies)))
    results.append(("TEST 7: Commit FHIR idempotent", test_commit_fhir_idempotent(cookies)))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
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
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
