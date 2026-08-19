#!/usr/bin/env python3
"""
Backend test for Encounter Meds — in-note medication entry API
POST/GET /api/patients/:id/medications

Test cases:
1. POST without auth cookie -> 401
2. GET without auth cookie -> 401
3. POST as admin with {} (no name) -> 400
4. POST as admin with full medication data -> 201
5. GET as admin -> 200 with medications array containing the created med
6. POST as admin minimal {name:"Ibuprofen"} -> 201
"""

import requests
import json
from pymongo import MongoClient

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def main():
    print("=" * 80)
    print("BACKEND TEST: Encounter Meds API (POST/GET /api/patients/:id/medications)")
    print("=" * 80)
    
    # Connect to MongoDB to find Eleanor Adams
    print("\n[SETUP] Connecting to MongoDB to find Eleanor Adams (MRN PC-100000)...")
    try:
        client = MongoClient("mongodb://localhost:27017/proactive_clinic?replicaSet=rs0")
        db = client["proactive_clinic"]
        patient = db.Patient.find_one({"mrn": "PC-100000"})
        if not patient:
            print("❌ ERROR: Patient Eleanor Adams (MRN PC-100000) not found in database")
            return
        # Prisma uses 'id' field in the document (not '_id')
        patient_id = patient.get("id") or patient.get("_id")
        if not patient_id:
            print(f"❌ ERROR: Patient found but no id field. Keys: {list(patient.keys())}")
            return
        print(f"✅ Found Eleanor Adams: ID={patient_id}, MRN={patient['mrn']}")
    except Exception as e:
        print(f"❌ ERROR connecting to MongoDB: {e}")
        return
    
    # Test 1: POST without auth cookie -> 401
    print("\n" + "=" * 80)
    print("TEST 1: POST /api/patients/{id}/medications WITHOUT auth cookie -> expect 401")
    print("=" * 80)
    try:
        url = f"{BASE_URL}/api/patients/{patient_id}/medications"
        response = requests.post(url, json={"name": "Test"}, timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code == 401:
            print("✅ TEST 1 PASSED: Correctly returns 401 Unauthorized without auth cookie")
        else:
            print(f"❌ TEST 1 FAILED: Expected 401, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
    except Exception as e:
        print(f"❌ TEST 1 ERROR: {e}")
    
    # Test 2: GET without auth cookie -> 401
    print("\n" + "=" * 80)
    print("TEST 2: GET /api/patients/{id}/medications WITHOUT auth cookie -> expect 401")
    print("=" * 80)
    try:
        url = f"{BASE_URL}/api/patients/{patient_id}/medications"
        response = requests.get(url, timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code == 401:
            print("✅ TEST 2 PASSED: Correctly returns 401 Unauthorized without auth cookie")
        else:
            print(f"❌ TEST 2 FAILED: Expected 401, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
    except Exception as e:
        print(f"❌ TEST 2 ERROR: {e}")
    
    # Login as admin to get session cookie
    print("\n" + "=" * 80)
    print("SETUP: Login as admin to get session cookie")
    print("=" * 80)
    try:
        login_url = f"{BASE_URL}/api/auth/login"
        login_data = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        session = requests.Session()
        response = session.post(login_url, json=login_data, timeout=10)
        print(f"Login status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Login successful, session cookie set")
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return
    except Exception as e:
        print(f"❌ Login ERROR: {e}")
        return
    
    # Test 3: POST as admin with {} (no name) -> 400
    print("\n" + "=" * 80)
    print("TEST 3: POST as admin with {} (no name) -> expect 400")
    print("=" * 80)
    try:
        url = f"{BASE_URL}/api/patients/{patient_id}/medications"
        response = session.post(url, json={}, timeout=10)
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        if response.status_code == 400 and "name" in data.get("error", "").lower():
            print("✅ TEST 3 PASSED: Correctly returns 400 with 'name required' error")
        else:
            print(f"❌ TEST 3 FAILED: Expected 400 with 'name required', got {response.status_code}")
    except Exception as e:
        print(f"❌ TEST 3 ERROR: {e}")
    
    # Test 4: POST as admin with full medication data -> 201
    print("\n" + "=" * 80)
    print("TEST 4: POST as admin with full medication data -> expect 201")
    print("=" * 80)
    try:
        url = f"{BASE_URL}/api/patients/{patient_id}/medications"
        med_data = {
            "name": "Atorvastatin",
            "strength": "20 mg",
            "form": "TABLET, FILM COATED",
            "route": "ORAL",
            "sig": "1 tab PO daily",
            "ndc": "71335-1507"
        }
        response = session.post(url, json=med_data, timeout=10)
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 201:
            medication = data.get("medication", {})
            med_id = medication.get("id")
            med_name = medication.get("name")
            med_ndc = medication.get("ndc")
            med_status = medication.get("status")
            med_start_date = medication.get("startDate")
            
            print(f"\nAssertion checks:")
            print(f"  medication.id present: {bool(med_id)} ✅" if med_id else "  medication.id present: False ❌")
            print(f"  medication.name === 'Atorvastatin': {med_name == 'Atorvastatin'} ✅" if med_name == 'Atorvastatin' else f"  medication.name === 'Atorvastatin': False (got '{med_name}') ❌")
            print(f"  medication.ndc === '71335-1507': {med_ndc == '71335-1507'} ✅" if med_ndc == '71335-1507' else f"  medication.ndc === '71335-1507': False (got '{med_ndc}') ❌")
            print(f"  medication.status === 'active': {med_status == 'active'} ✅" if med_status == 'active' else f"  medication.status === 'active': False (got '{med_status}') ❌")
            print(f"  medication.startDate is set: {bool(med_start_date)} ✅" if med_start_date else "  medication.startDate is set: False ❌")
            
            if all([med_id, med_name == 'Atorvastatin', med_ndc == '71335-1507', med_status == 'active', med_start_date]):
                print("\n✅ TEST 4 PASSED: All assertions passed")
                created_med_id = med_id
            else:
                print("\n❌ TEST 4 FAILED: Some assertions failed")
                created_med_id = med_id
        else:
            print(f"❌ TEST 4 FAILED: Expected 201, got {response.status_code}")
            created_med_id = None
    except Exception as e:
        print(f"❌ TEST 4 ERROR: {e}")
        created_med_id = None
    
    # Test 5: GET as admin -> 200 with medications array containing the created med
    print("\n" + "=" * 80)
    print("TEST 5: GET as admin -> expect 200 with medications array")
    print("=" * 80)
    try:
        url = f"{BASE_URL}/api/patients/{patient_id}/medications"
        response = session.get(url, timeout=10)
        print(f"Status: {response.status_code}")
        data = response.json()
        
        if response.status_code == 200:
            medications = data.get("medications", [])
            print(f"Total medications: {len(medications)}")
            
            # Find the Atorvastatin medication we just created
            atorvastatin_found = False
            for med in medications:
                if med.get("name") == "Atorvastatin" and med.get("ndc") == "71335-1507":
                    atorvastatin_found = True
                    print(f"\n✅ Found created medication:")
                    print(f"  ID: {med.get('id')}")
                    print(f"  Name: {med.get('name')}")
                    print(f"  NDC: {med.get('ndc')}")
                    print(f"  Strength: {med.get('strength')}")
                    print(f"  Form: {med.get('form')}")
                    print(f"  Route: {med.get('route')}")
                    print(f"  Sig: {med.get('sig')}")
                    print(f"  Status: {med.get('status')}")
                    break
            
            if atorvastatin_found:
                print("\n✅ TEST 5 PASSED: GET returns medications array with the created Atorvastatin medication")
            else:
                print("\n❌ TEST 5 FAILED: Created Atorvastatin medication not found in GET response")
                print(f"Medications in response: {[m.get('name') for m in medications]}")
        else:
            print(f"❌ TEST 5 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
    except Exception as e:
        print(f"❌ TEST 5 ERROR: {e}")
    
    # Test 6: POST as admin minimal {name:"Ibuprofen"} -> 201
    print("\n" + "=" * 80)
    print("TEST 6: POST as admin minimal {name:'Ibuprofen'} -> expect 201")
    print("=" * 80)
    try:
        url = f"{BASE_URL}/api/patients/{patient_id}/medications"
        med_data = {"name": "Ibuprofen"}
        response = session.post(url, json=med_data, timeout=10)
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if response.status_code == 201:
            medication = data.get("medication", {})
            med_name = medication.get("name")
            med_status = medication.get("status")
            med_strength = medication.get("strength")
            med_form = medication.get("form")
            med_route = medication.get("route")
            
            print(f"\nAssertion checks:")
            print(f"  medication.name === 'Ibuprofen': {med_name == 'Ibuprofen'} ✅" if med_name == 'Ibuprofen' else f"  medication.name === 'Ibuprofen': False (got '{med_name}') ❌")
            print(f"  medication.status === 'active': {med_status == 'active'} ✅" if med_status == 'active' else f"  medication.status === 'active': False (got '{med_status}') ❌")
            print(f"  Optional fields are null: strength={med_strength}, form={med_form}, route={med_route}")
            
            if med_name == 'Ibuprofen' and med_status == 'active':
                print("\n✅ TEST 6 PASSED: Minimal medication created successfully with status 'active'")
            else:
                print("\n❌ TEST 6 FAILED: Some assertions failed")
        else:
            print(f"❌ TEST 6 FAILED: Expected 201, got {response.status_code}")
    except Exception as e:
        print(f"❌ TEST 6 ERROR: {e}")
    
    print("\n" + "=" * 80)
    print("ALL TESTS COMPLETED")
    print("=" * 80)

if __name__ == "__main__":
    main()
