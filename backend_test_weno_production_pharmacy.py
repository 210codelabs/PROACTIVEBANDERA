#!/usr/bin/env python3
"""
Backend test for: Weno PRODUCTION pharmacy selection — no TEST pharmacies anywhere
Tests that all Weno test pharmacies are removed from production pharmacy selection.
"""
import requests
import json
import sys
from pymongo import MongoClient

# Configuration
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "proactive_clinic"

# Session storage
session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

def login_admin():
    """Login as admin and capture session cookie"""
    print("\n=== ADMIN LOGIN ===")
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    resp = session.post(url, json=payload)
    print(f"POST {url}")
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        print(f"Response: ok={data.get('ok')}")
        print(f"Session cookie captured: {bool(session.cookies.get('proactive_session'))}")
        return True
    else:
        print(f"ERROR: Login failed with status {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        return False

def test_step_1():
    """
    STEP 1: GET /api/weno/pharmacies?q=test and ?q=1234567
    Should return NO test pharmacies (no isTest:true, no ncpdpId 1234567, no name containing 'Test Pharmacy')
    """
    print("\n=== STEP 1: Search for test pharmacies (should return NONE) ===")
    
    # Test 1a: Search by 'test'
    print("\n--- Test 1a: GET /api/weno/pharmacies?q=test ---")
    url = f"{BASE_URL}/api/weno/pharmacies?q=test"
    resp = session.get(url)
    print(f"GET {url}")
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    pharmacies = data.get("pharmacies", [])
    print(f"Response: {len(pharmacies)} pharmacies returned")
    
    # Check for test pharmacies
    test_pharmacies = [p for p in pharmacies if p.get("isTest") or p.get("ncpdpId") == "1234567" or "test pharmacy" in str(p.get("name", "")).lower()]
    if test_pharmacies:
        print(f"❌ FAIL: Found {len(test_pharmacies)} test pharmacies in results:")
        for p in test_pharmacies[:3]:
            print(f"  - {p.get('name')} (NCPDP: {p.get('ncpdpId')}, isTest: {p.get('isTest')})")
        return False
    print("✅ PASS: No test pharmacies found in search results")
    
    # Test 1b: Search by NCPDP '1234567'
    print("\n--- Test 1b: GET /api/weno/pharmacies?q=1234567 ---")
    url = f"{BASE_URL}/api/weno/pharmacies?q=1234567"
    resp = session.get(url)
    print(f"GET {url}")
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    pharmacies = data.get("pharmacies", [])
    print(f"Response: {len(pharmacies)} pharmacies returned")
    
    # Check for NCPDP 1234567
    test_ncpdp = [p for p in pharmacies if p.get("ncpdpId") == "1234567"]
    if test_ncpdp:
        print(f"❌ FAIL: Found test pharmacy with NCPDP 1234567:")
        print(f"  - {test_ncpdp[0].get('name')} (NCPDP: {test_ncpdp[0].get('ncpdpId')})")
        return False
    print("✅ PASS: No pharmacy with NCPDP 1234567 found")
    
    return True

def test_step_2():
    """
    STEP 2: GET /api/weno/pharmacies?state=FL -> total in thousands (~6.7k)
    GET /api/weno/pharmacies?q=walgreens&state=TX -> returns results
    """
    print("\n=== STEP 2: Verify large directory and specific searches ===")
    
    # Test 2a: Florida search (should return thousands)
    print("\n--- Test 2a: GET /api/weno/pharmacies?state=FL ---")
    url = f"{BASE_URL}/api/weno/pharmacies?state=FL"
    resp = session.get(url)
    print(f"GET {url}")
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    total = data.get("total", 0)
    shown = data.get("shown", 0)
    print(f"Response: total={total}, shown={shown}")
    
    if total < 5000:
        print(f"❌ FAIL: Expected total >= 5000 (thousands of FL pharmacies), got {total}")
        return False
    print(f"✅ PASS: Florida has {total} pharmacies (in thousands as expected)")
    
    # Test 2b: Walgreens in Texas
    print("\n--- Test 2b: GET /api/weno/pharmacies?q=walgreens&state=TX ---")
    url = f"{BASE_URL}/api/weno/pharmacies?q=walgreens&state=TX"
    resp = session.get(url)
    print(f"GET {url}")
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    pharmacies = data.get("pharmacies", [])
    print(f"Response: {len(pharmacies)} pharmacies returned")
    
    if len(pharmacies) == 0:
        print(f"❌ FAIL: Expected Walgreens results in TX, got 0")
        return False
    
    # Verify at least one result contains 'walgreens'
    walgreens_found = any("walgreens" in str(p.get("name", "")).lower() for p in pharmacies)
    if not walgreens_found:
        print(f"❌ FAIL: No pharmacy name contains 'walgreens'")
        return False
    
    print(f"✅ PASS: Found {len(pharmacies)} Walgreens pharmacies in TX")
    sample = pharmacies[0]
    print(f"  Sample: {sample.get('name')} (NCPDP: {sample.get('ncpdpId')}, {sample.get('city')}, {sample.get('state')})")
    
    return True

def test_step_3():
    """
    STEP 3: GET /api/pharmacies/search?q=test -> should return NO test pharmacies
    """
    print("\n=== STEP 3: Pharmacy search endpoint (should return NO test pharmacies) ===")
    
    url = f"{BASE_URL}/api/pharmacies/search?q=test"
    resp = session.get(url)
    print(f"GET {url}")
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    pharmacies = data.get("pharmacies", [])
    print(f"Response: {len(pharmacies)} pharmacies returned")
    
    # Check for test pharmacies
    test_pharmacies = [p for p in pharmacies if p.get("ncpdpId") == "1234567" or "test pharmacy" in str(p.get("name", "")).lower()]
    if test_pharmacies:
        print(f"❌ FAIL: Found {len(test_pharmacies)} test pharmacies in results:")
        for p in test_pharmacies[:3]:
            print(f"  - {p.get('name')} (NCPDP: {p.get('ncpdpId')})")
        return False
    
    print("✅ PASS: No test pharmacies found in /api/pharmacies/search")
    return True

def test_step_4():
    """
    STEP 4: DB check - WenoPharmacy should have 0 rows with services containing 'test' or ncpdpId '1234567'
    No Patient should have primaryPharmacyNcpdp/alternativePharmacyNcpdp='1234567'
    """
    print("\n=== STEP 4: MongoDB verification ===")
    
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Check WenoPharmacy for test pharmacies
        print("\n--- Check WenoPharmacy collection ---")
        test_pharmacy_count = db.WenoPharmacy.count_documents({
            "$or": [
                {"services": {"$regex": "test", "$options": "i"}},
                {"ncpdpId": "1234567"},
                {"name": {"$regex": "test pharmacy", "$options": "i"}}
            ]
        })
        print(f"WenoPharmacy rows with test markers: {test_pharmacy_count}")
        
        if test_pharmacy_count > 0:
            print(f"❌ FAIL: Found {test_pharmacy_count} test pharmacy rows in WenoPharmacy")
            # Show samples
            samples = list(db.WenoPharmacy.find({
                "$or": [
                    {"services": {"$regex": "test", "$options": "i"}},
                    {"ncpdpId": "1234567"}
                ]
            }).limit(3))
            for s in samples:
                print(f"  - {s.get('name')} (NCPDP: {s.get('ncpdpId')}, services: {s.get('services')})")
            return False
        print("✅ PASS: No test pharmacies in WenoPharmacy collection")
        
        # Check Patient collection for references to test pharmacy
        print("\n--- Check Patient collection ---")
        patients_with_test_primary = db.Patient.count_documents({"primaryPharmacyNcpdp": "1234567"})
        patients_with_test_alt = db.Patient.count_documents({"alternativePharmacyNcpdp": "1234567"})
        print(f"Patients with primaryPharmacyNcpdp='1234567': {patients_with_test_primary}")
        print(f"Patients with alternativePharmacyNcpdp='1234567': {patients_with_test_alt}")
        
        if patients_with_test_primary > 0 or patients_with_test_alt > 0:
            print(f"❌ FAIL: Found patients with test pharmacy NCPDP 1234567")
            return False
        print("✅ PASS: No patients reference test pharmacy NCPDP 1234567")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ FAIL: MongoDB check failed with error: {e}")
        return False

def test_step_5():
    """
    STEP 5: Insert a test pharmacy and verify search endpoints filter it out, then delete it
    """
    print("\n=== STEP 5: Seed check - insert test pharmacy and verify filtering ===")
    
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Insert a test pharmacy
        print("\n--- Insert test pharmacy ---")
        test_pharmacy = {
            "ncpdpId": "9999999",
            "name": "ZZ Weno Test Pharmacy",
            "services": "weno,test",
            "active": True,
            "source": "qa",
            "city": "Test City",
            "state": "TX",
            "zip": "78201",
            "phone": "210-555-0000",
            "npi": "9999999999",
            "address": "123 Test St"
        }
        result = db.WenoPharmacy.insert_one(test_pharmacy)
        print(f"Inserted test pharmacy with _id: {result.inserted_id}")
        
        # Verify it's in the database
        found = db.WenoPharmacy.find_one({"ncpdpId": "9999999"})
        if not found:
            print("❌ FAIL: Could not verify test pharmacy was inserted")
            return False
        print(f"✅ Verified: Test pharmacy exists in DB")
        
        # Test that search endpoints filter it out
        print("\n--- Test search endpoints filter out test pharmacy ---")
        
        # Test /api/weno/pharmacies
        url = f"{BASE_URL}/api/weno/pharmacies?q=9999999"
        resp = session.get(url)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            db.WenoPharmacy.delete_one({"ncpdpId": "9999999"})
            client.close()
            return False
        
        data = resp.json()
        pharmacies = data.get("pharmacies", [])
        found_test = any(p.get("ncpdpId") == "9999999" for p in pharmacies)
        
        if found_test:
            print(f"❌ FAIL: Test pharmacy 9999999 was NOT filtered out by /api/weno/pharmacies")
            db.WenoPharmacy.delete_one({"ncpdpId": "9999999"})
            client.close()
            return False
        print("✅ PASS: Test pharmacy filtered out by /api/weno/pharmacies")
        
        # Test /api/pharmacies/search
        url = f"{BASE_URL}/api/pharmacies/search?q=ZZ Weno Test"
        resp = session.get(url)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            db.WenoPharmacy.delete_one({"ncpdpId": "9999999"})
            client.close()
            return False
        
        data = resp.json()
        pharmacies = data.get("pharmacies", [])
        found_test = any(p.get("ncpdpId") == "9999999" for p in pharmacies)
        
        if found_test:
            print(f"❌ FAIL: Test pharmacy 9999999 was NOT filtered out by /api/pharmacies/search")
            db.WenoPharmacy.delete_one({"ncpdpId": "9999999"})
            client.close()
            return False
        print("✅ PASS: Test pharmacy filtered out by /api/pharmacies/search")
        
        # Clean up - delete the test pharmacy
        print("\n--- Clean up test pharmacy ---")
        delete_result = db.WenoPharmacy.delete_one({"ncpdpId": "9999999"})
        print(f"Deleted {delete_result.deleted_count} test pharmacy row")
        
        if delete_result.deleted_count != 1:
            print(f"⚠️ WARNING: Expected to delete 1 row, deleted {delete_result.deleted_count}")
        else:
            print("✅ PASS: Test pharmacy cleaned up successfully")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ FAIL: Seed check failed with error: {e}")
        # Try to clean up
        try:
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            db.WenoPharmacy.delete_one({"ncpdpId": "9999999"})
            client.close()
        except:
            pass
        return False

def test_step_6():
    """
    STEP 6: Set a patient's primaryPharmacyNcpdp to a real NCPDP,
    GET /api/weno/iframe-url/<id> -> should return environment production, testPatient N
    Then restore the patient's pharmacy
    """
    print("\n=== STEP 6: Patient pharmacy assignment and ComposeRx iframe ===")
    
    try:
        # Get a patient ID
        print("\n--- Get patient ID ---")
        url = f"{BASE_URL}/api/patients/search?q=adams&limit=1"
        resp = session.get(url)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Could not get patient, status {resp.status_code}")
            return False
        
        data = resp.json()
        results = data.get("results", [])
        if not results:
            print(f"❌ FAIL: No patients found")
            return False
        
        patient = results[0]
        patient_id = patient.get("id")
        print(f"Patient: {patient.get('firstName')} {patient.get('lastName')} (ID: {patient_id})")
        
        # Get current pharmacy to restore later
        url = f"{BASE_URL}/api/patients/{patient_id}"
        resp = session.get(url)
        if resp.status_code == 200:
            patient_data = resp.json()
            original_pharmacy = patient_data.get("patient", {}).get("primaryPharmacyNcpdp")
            print(f"Original primaryPharmacyNcpdp: {original_pharmacy}")
        else:
            original_pharmacy = None
            print(f"Could not get original pharmacy (will set to null on restore)")
        
        # Get a real pharmacy NCPDP from the directory
        print("\n--- Get a real pharmacy NCPDP ---")
        url = f"{BASE_URL}/api/weno/pharmacies?state=TX&q=cvs"
        resp = session.get(url)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Could not get pharmacies, status {resp.status_code}")
            return False
        
        data = resp.json()
        pharmacies = data.get("pharmacies", [])
        if not pharmacies:
            print(f"❌ FAIL: No pharmacies found")
            return False
        
        real_pharmacy = pharmacies[0]
        real_ncpdp = real_pharmacy.get("ncpdpId")
        print(f"Real pharmacy: {real_pharmacy.get('name')} (NCPDP: {real_ncpdp})")
        
        # Set patient's primaryPharmacyNcpdp
        print("\n--- Set patient's primaryPharmacyNcpdp ---")
        url = f"{BASE_URL}/api/patients/{patient_id}"
        payload = {"primaryPharmacyNcpdp": real_ncpdp}
        resp = session.patch(url, json=payload)
        print(f"PATCH {url}")
        print(f"Payload: {payload}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Could not update patient pharmacy, status {resp.status_code}")
            return False
        print("✅ Patient pharmacy updated")
        
        # Get Weno iframe URL
        print("\n--- Get Weno iframe URL ---")
        url = f"{BASE_URL}/api/weno/iframe-url/{patient_id}"
        resp = session.get(url)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Could not get iframe URL, status {resp.status_code}")
            # Restore patient pharmacy before returning
            restore_url = f"{BASE_URL}/api/patients/{patient_id}"
            restore_payload = {"primaryPharmacyNcpdp": original_pharmacy}
            session.patch(restore_url, json=restore_payload)
            return False
        
        data = resp.json()
        environment = data.get("environment")
        test_patient = data.get("testPatient")
        iframe_url = data.get("iframeUrl")
        
        print(f"Response: environment={environment}, testPatient={test_patient}")
        print(f"iframeUrl present: {bool(iframe_url)}")
        
        # Verify environment is production and testPatient is N
        if environment != "production":
            print(f"❌ FAIL: Expected environment='production', got '{environment}'")
            # Restore patient pharmacy before returning
            restore_url = f"{BASE_URL}/api/patients/{patient_id}"
            restore_payload = {"primaryPharmacyNcpdp": original_pharmacy}
            session.patch(restore_url, json=restore_payload)
            return False
        
        if test_patient != "N":
            print(f"❌ FAIL: Expected testPatient='N', got '{test_patient}'")
            # Restore patient pharmacy before returning
            restore_url = f"{BASE_URL}/api/patients/{patient_id}"
            restore_payload = {"primaryPharmacyNcpdp": original_pharmacy}
            session.patch(restore_url, json=restore_payload)
            return False
        
        print("✅ PASS: environment='production', testPatient='N'")
        
        # Restore patient's original pharmacy
        print("\n--- Restore patient's original pharmacy ---")
        url = f"{BASE_URL}/api/patients/{patient_id}"
        payload = {"primaryPharmacyNcpdp": original_pharmacy}
        resp = session.patch(url, json=payload)
        print(f"PATCH {url}")
        print(f"Payload: {payload}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"⚠️ WARNING: Could not restore patient pharmacy, status {resp.status_code}")
        else:
            print("✅ Patient pharmacy restored")
        
        return True
        
    except Exception as e:
        print(f"❌ FAIL: Step 6 failed with error: {e}")
        return False

def test_step_7():
    """
    STEP 7: Regression tests
    GET /api/erx/weno-status -> 200 production
    GET /api/erx -> 200 (Rx history)
    No 500s anywhere
    """
    print("\n=== STEP 7: Regression tests ===")
    
    # Test weno-status
    print("\n--- Test GET /api/erx/weno-status ---")
    url = f"{BASE_URL}/api/erx/weno-status"
    resp = session.get(url)
    print(f"GET {url}")
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    environment = data.get("environment")
    print(f"Response: environment={environment}, enabled={data.get('enabled')}, configured={data.get('configured')}")
    
    if environment != "production":
        print(f"❌ FAIL: Expected environment='production', got '{environment}'")
        return False
    print("✅ PASS: /api/erx/weno-status returns environment='production'")
    
    # Test Rx history
    print("\n--- Test GET /api/erx (Rx history) ---")
    url = f"{BASE_URL}/api/erx"
    resp = session.get(url)
    print(f"GET {url}")
    print(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    prescriptions = data.get("prescriptions", [])
    print(f"Response: {len(prescriptions)} prescriptions returned")
    print("✅ PASS: /api/erx returns 200")
    
    return True

def main():
    """Run all test steps"""
    print("=" * 80)
    print("BACKEND TEST: Weno PRODUCTION pharmacy selection — no TEST pharmacies anywhere")
    print("=" * 80)
    
    # Login
    if not login_admin():
        print("\n❌ OVERALL FAIL: Could not login as admin")
        sys.exit(1)
    
    # Run all test steps
    results = {
        "Step 1: Search for test pharmacies": test_step_1(),
        "Step 2: Large directory and specific searches": test_step_2(),
        "Step 3: Pharmacy search endpoint": test_step_3(),
        "Step 4: MongoDB verification": test_step_4(),
        "Step 5: Seed check with filtering": test_step_5(),
        "Step 6: Patient pharmacy and iframe": test_step_6(),
        "Step 7: Regression tests": test_step_7(),
    }
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    for step, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {step}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n✅ ALL TESTS PASSED")
        print("\nCRITICAL ASSERTIONS VERIFIED:")
        print("  - NO test pharmacies in /api/weno/pharmacies search results")
        print("  - NO test pharmacies in /api/pharmacies/search results")
        print("  - NO test pharmacies in WenoPharmacy MongoDB collection")
        print("  - NO patients reference test pharmacy NCPDP 1234567")
        print("  - Search endpoints filter out test pharmacies (verified with seed)")
        print("  - ComposeRx iframe returns environment='production', testPatient='N'")
        print("  - All regression endpoints return 200 (no 500s)")
        print("\nFeature is PRODUCTION-READY: Weno pharmacy selection is PRODUCTION-ONLY (no test pharmacies)")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED")
        failed_steps = [step for step, passed in results.items() if not passed]
        print(f"\nFailed steps ({len(failed_steps)}):")
        for step in failed_steps:
            print(f"  - {step}")
        sys.exit(1)

if __name__ == "__main__":
    main()
