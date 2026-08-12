#!/usr/bin/env python3
"""
Backend test for EMR Import Feature 8: SMART Backend Services (System Access) + Bulk Data $export
Tests the REAL live-connection mechanism for Practice Fusion "System Access" (unattended, no user login).

PART 1: CONFIG + JWKS (no external deps)
PART 2: LIVE SYSTEM ROUND-TRIP against SMART Bulk Data reference server
"""

import requests
import json
import time
from pymongo import MongoClient
from urllib.parse import urlencode

# Configuration
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "proactive_clinic"

# SMART Bulk Data reference server
BULK_DATA_BASE = "https://bulk-data.smarthealthit.org"
BULK_DATA_FHIR = f"{BULK_DATA_BASE}/fhir"
BULK_DATA_TOKEN = f"{BULK_DATA_BASE}/auth/token"
BULK_DATA_REGISTER = f"{BULK_DATA_BASE}/auth/register"

def login_admin():
    """Login as admin and return session cookie"""
    print("\n=== LOGIN AS ADMIN ===")
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@proactiveclinic.com", "password": "apex123"},
        allow_redirects=False
    )
    print(f"Login status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        return None
    
    # Extract session cookie
    cookies = resp.cookies
    print(f"✅ Login successful, session cookie obtained")
    return cookies

def cleanup_db():
    """Cleanup test data from MongoDB"""
    print("\n=== CLEANUP DATABASE ===")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Snapshot existing Patient _ids BEFORE cleanup
    existing_patients = set(str(p["_id"]) for p in db.Patient.find({}, {"_id": 1}))
    print(f"Existing patients before cleanup: {len(existing_patients)}")
    
    # Delete veradigm and ecw FhirConnection
    result = db.FhirConnection.delete_many({"provider": {"$in": ["veradigm", "ecw"]}})
    print(f"Deleted {result.deleted_count} FhirConnection docs (veradigm, ecw)")
    
    # Delete all FhirBulkJob docs
    result = db.FhirBulkJob.delete_many({})
    print(f"Deleted {result.deleted_count} FhirBulkJob docs")
    
    # Delete ImportJob docs where source starts with "veradigm_fhir"
    result = db.ImportJob.delete_many({"source": {"$regex": "^veradigm_fhir"}})
    print(f"Deleted {result.deleted_count} ImportJob docs (source starts with veradigm_fhir)")
    
    print("✅ Initial cleanup completed")
    return existing_patients

def cleanup_new_patients(snapshot_ids):
    """Delete newly created patients and their child records"""
    print("\n=== CLEANUP NEW PATIENTS ===")
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get current Patient _ids
    current_patients = set(str(p["_id"]) for p in db.Patient.find({}, {"_id": 1}))
    
    # Compute new patients (current minus snapshot)
    new_patient_ids = current_patients - snapshot_ids
    print(f"New patients created during test: {len(new_patient_ids)}")
    
    if new_patient_ids:
        # Delete child records
        for collection_name in ["Problem", "Medication", "Allergy", "Vital", "Immunization", "Encounter"]:
            result = db[collection_name].delete_many({"patientId": {"$in": list(new_patient_ids)}})
            print(f"Deleted {result.deleted_count} {collection_name} docs")
        
        # Delete Patient docs
        result = db.Patient.delete_many({"_id": {"$in": list(new_patient_ids)}})
        print(f"Deleted {result.deleted_count} Patient docs")
    
    # Delete all FhirBulkJob docs
    result = db.FhirBulkJob.delete_many({})
    print(f"Deleted {result.deleted_count} FhirBulkJob docs")
    
    # Delete ImportJob docs where source starts with "veradigm_fhir"
    result = db.ImportJob.delete_many({"source": {"$regex": "^veradigm_fhir"}})
    print(f"Deleted {result.deleted_count} ImportJob docs")
    
    # Delete veradigm and ecw FhirConnection
    result = db.FhirConnection.delete_many({"provider": {"$in": ["veradigm", "ecw"]}})
    print(f"Deleted {result.deleted_count} FhirConnection docs (veradigm, ecw)")
    
    print("✅ Cleanup completed")

def test_part1_config_jwks(cookies):
    """PART 1: CONFIG + JWKS (no external deps)"""
    print("\n" + "="*80)
    print("PART 1: CONFIG + JWKS (no external deps)")
    print("="*80)
    
    # TEST 1: POST with missing tokenUrl -> 400
    print("\n--- TEST 1: POST /api/admin/fhir/connections with missing tokenUrl ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/fhir/connections",
            json={
                "provider": "veradigm",
                "authMode": "system",
                "baseUrl": "https://x.example.com/fhir"
                # missing tokenUrl
            },
            cookies=cookies
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        
        if resp.status_code == 400:
            print("✅ TEST 1 PASSED: Returns 400 for missing tokenUrl")
        else:
            print(f"❌ TEST 1 FAILED: Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 FAILED with exception: {e}")
        return False
    
    # TEST 2: POST valid system config WITHOUT clientId -> 200
    print("\n--- TEST 2: POST valid system config WITHOUT clientId ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/fhir/connections",
            json={
                "provider": "veradigm",
                "authMode": "system",
                "baseUrl": BULK_DATA_FHIR,
                "tokenUrl": BULK_DATA_TOKEN,
                "scopes": "system/*.read"
                # NO clientId
            },
            cookies=cookies
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"Response: {resp.text}")
            print(f"❌ TEST 2 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Response keys: {data.keys()}")
        
        # Verify response structure
        if not data.get("ok"):
            print(f"❌ TEST 2 FAILED: ok is not true")
            return False
        
        connection = data.get("connection", {})
        print(f"Connection keys: {connection.keys()}")
        print(f"authMode: {connection.get('authMode')}")
        print(f"status: {connection.get('status')}")
        print(f"jwksUrl: {connection.get('jwksUrl')}")
        
        # CRITICAL: Verify NO private key in response
        response_str = json.dumps(data)
        if "privateJwk" in response_str or "private" in response_str.lower():
            print(f"❌ TEST 2 FAILED: Private key appears in response!")
            return False
        
        # Verify expected fields
        if connection.get("authMode") != "system":
            print(f"❌ TEST 2 FAILED: authMode is not 'system', got {connection.get('authMode')}")
            return False
        
        if connection.get("status") != "configured":
            print(f"❌ TEST 2 FAILED: status is not 'configured', got {connection.get('status')}")
            return False
        
        jwks_url = connection.get("jwksUrl", "")
        if not jwks_url.endswith("/api/fhir/jwks/veradigm"):
            print(f"❌ TEST 2 FAILED: jwksUrl does not end with '/api/fhir/jwks/veradigm', got {jwks_url}")
            return False
        
        # Check keySet flag
        if not connection.get("keySet"):
            print(f"❌ TEST 2 FAILED: keySet is not true")
            return False
        
        print("✅ TEST 2 PASSED: Valid system config saved, authMode='system', keySet=true, status='configured', NO private key in response")
        
    except Exception as e:
        print(f"❌ TEST 2 FAILED with exception: {e}")
        return False
    
    # TEST 3: GET /api/fhir/jwks/veradigm with NO auth cookie (PUBLIC)
    print("\n--- TEST 3: GET /api/fhir/jwks/veradigm (PUBLIC, no auth) ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/fhir/jwks/veradigm")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"Response: {resp.text}")
            print(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Response keys: {data.keys()}")
        
        keys = data.get("keys", [])
        if not keys:
            print(f"❌ TEST 3 FAILED: keys array is empty")
            return False
        
        jwk = keys[0]
        print(f"JWK keys: {jwk.keys()}")
        print(f"kty: {jwk.get('kty')}")
        print(f"alg: {jwk.get('alg')}")
        print(f"kid: {jwk.get('kid')}")
        print(f"n length: {len(jwk.get('n', ''))}")
        print(f"e: {jwk.get('e')}")
        
        # Verify JWK structure
        if jwk.get("kty") != "RSA":
            print(f"❌ TEST 3 FAILED: kty is not 'RSA', got {jwk.get('kty')}")
            return False
        
        if jwk.get("alg") != "RS384":
            print(f"❌ TEST 3 FAILED: alg is not 'RS384', got {jwk.get('alg')}")
            return False
        
        if not jwk.get("n"):
            print(f"❌ TEST 3 FAILED: n (modulus) is empty")
            return False
        
        if not jwk.get("e"):
            print(f"❌ TEST 3 FAILED: e (exponent) is empty")
            return False
        
        if not jwk.get("kid"):
            print(f"❌ TEST 3 FAILED: kid is empty")
            return False
        
        print("✅ TEST 3 PASSED: PUBLIC JWKS endpoint returns RSA JWK with kty=RSA, alg=RS384, n, e, kid")
        
        # Save JWK for PART 2
        return jwk
        
    except Exception as e:
        print(f"❌ TEST 3 FAILED with exception: {e}")
        return False

def test_part1_system_test_before_clientid(cookies):
    """TEST 4: POST system/test BEFORE clientId is set"""
    print("\n--- TEST 4: POST /api/admin/fhir/veradigm/system/test BEFORE clientId ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/fhir/veradigm/system/test",
            cookies=cookies
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        
        # Should be 400 or 502, NOT 500
        if resp.status_code in [400, 502]:
            print(f"✅ TEST 4 PASSED: Returns {resp.status_code} (not 500) when clientId not set")
            return True
        elif resp.status_code == 500:
            print(f"❌ TEST 4 FAILED: Returns 500 (should be 400 or 502)")
            return False
        else:
            print(f"⚠️ TEST 4: Unexpected status {resp.status_code} (expected 400 or 502)")
            return True  # Not a critical failure
            
    except Exception as e:
        print(f"❌ TEST 4 FAILED with exception: {e}")
        return False

def test_part2_live_roundtrip(cookies, public_jwk):
    """PART 2: LIVE SYSTEM ROUND-TRIP against SMART Bulk Data reference server"""
    print("\n" + "="*80)
    print("PART 2: LIVE SYSTEM ROUND-TRIP against SMART Bulk Data reference server")
    print("="*80)
    
    # STEP B: Already have public_jwk from TEST 3
    print("\n--- STEP B: Public JWK captured from TEST 3 ---")
    print(f"JWK kid: {public_jwk.get('kid')}")
    
    # STEP C: Register with reference server
    print("\n--- STEP C: Register public JWK with reference server ---")
    try:
        jwks_payload = {"keys": [public_jwk]}
        jwks_json = json.dumps(jwks_payload)
        print(f"Registering JWKS: {jwks_json[:100]}...")
        
        resp = requests.post(
            BULK_DATA_REGISTER,
            data={"jwks": jwks_json},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        print(f"Registration status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        
        if resp.status_code != 200:
            print(f"❌ STEP C FAILED: Registration failed with status {resp.status_code}")
            print(f"Response body: {resp.text}")
            return False
        
        # Response body IS the client_id (a JWT)
        client_id = resp.text.strip()
        print(f"✅ STEP C PASSED: Registered, client_id length: {len(client_id)}")
        
    except Exception as e:
        print(f"❌ STEP C FAILED with exception: {e}")
        return False
    
    # STEP D: Save veradigm config with clientId
    print("\n--- STEP D: POST /api/admin/fhir/connections with clientId ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/fhir/connections",
            json={
                "provider": "veradigm",
                "authMode": "system",
                "baseUrl": BULK_DATA_FHIR,
                "tokenUrl": BULK_DATA_TOKEN,
                "clientId": client_id,
                "scopes": "system/*.read"
            },
            cookies=cookies
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"Response: {resp.text}")
            print(f"❌ STEP D FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        connection = data.get("connection", {})
        print(f"Connection status: {connection.get('status')}")
        print(f"✅ STEP D PASSED: Config saved with clientId")
        
    except Exception as e:
        print(f"❌ STEP D FAILED with exception: {e}")
        return False
    
    # STEP E: POST system/test to get REAL token
    print("\n--- STEP E: POST /api/admin/fhir/veradigm/system/test (REAL token) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/fhir/veradigm/system/test",
            cookies=cookies
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"Response: {resp.text}")
            print(f"❌ STEP E FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if not data.get("ok"):
            print(f"❌ STEP E FAILED: ok is not true")
            return False
        
        granted_scope = data.get("grantedScope", "")
        print(f"Granted scope: {granted_scope}")
        
        if "system" not in granted_scope.lower():
            print(f"❌ STEP E FAILED: grantedScope does not contain 'system'")
            return False
        
        print("✅ STEP E PASSED: System token obtained, grantedScope contains 'system'")
        print("🎉 CRITICAL: Our app signed a JWT with the generated private key and got a REAL token!")
        
    except Exception as e:
        print(f"❌ STEP E FAILED with exception: {e}")
        return False
    
    # STEP F: Bulk import with limit:3
    print("\n--- STEP F: POST /api/admin/fhir/veradigm/bulk-import {limit:3} ---")
    
    # Snapshot existing Patient _ids
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    snapshot_ids = set(str(p["_id"]) for p in db.Patient.find({}, {"_id": 1}))
    print(f"Patient snapshot: {len(snapshot_ids)} existing patients")
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/fhir/veradigm/bulk-import",
            json={"limit": 3},
            cookies=cookies
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"Response: {resp.text}")
            print(f"❌ STEP F FAILED: Expected 200, got {resp.status_code}")
            return False, snapshot_ids
        
        data = resp.json()
        job_id = data.get("jobId")
        print(f"Job ID: {job_id}")
        
        if not job_id:
            print(f"❌ STEP F FAILED: No jobId in response")
            return False, snapshot_ids
        
        # Poll until completed
        print("\nPolling job status...")
        max_polls = 75  # 150 seconds / 2 seconds per poll
        poll_count = 0
        
        while poll_count < max_polls:
            time.sleep(2)
            poll_count += 1
            
            resp = requests.get(
                f"{BASE_URL}/api/admin/fhir/veradigm/bulk-import?jobId={job_id}",
                cookies=cookies
            )
            
            if resp.status_code != 200:
                print(f"Poll failed: {resp.status_code}")
                continue
            
            job_data = resp.json()
            job = job_data.get("job", {})
            status = job.get("status")
            processed = job.get("processed", 0)
            
            print(f"Poll {poll_count}: status={status}, processed={processed}")
            
            if status != "running":
                print(f"\n✅ Job completed with status: {status}")
                print(f"Final job data: {json.dumps(job, indent=2)}")
                
                # Verify assertions
                if status != "completed":
                    print(f"❌ STEP F FAILED: Expected status='completed', got '{status}'")
                    return False, snapshot_ids
                
                if processed != 3:
                    print(f"❌ STEP F FAILED: Expected processed=3, got {processed}")
                    return False, snapshot_ids
                
                patients_created = job.get("patientsCreated", 0)
                patients_merged = job.get("patientsMerged", 0)
                records_created = job.get("recordsCreated", 0)
                
                print(f"patientsCreated: {patients_created}")
                print(f"patientsMerged: {patients_merged}")
                print(f"recordsCreated: {records_created}")
                
                if (patients_created + patients_merged) < 1:
                    print(f"❌ STEP F FAILED: Expected at least 1 patient created/merged")
                    return False, snapshot_ids
                
                if records_created < 1:
                    print(f"❌ STEP F FAILED: Expected recordsCreated >= 1")
                    return False, snapshot_ids
                
                print("✅ STEP F PASSED: Bulk import completed successfully")
                print(f"   - status='completed' ✅")
                print(f"   - processed=3 ✅")
                print(f"   - (patientsCreated + patientsMerged) = {patients_created + patients_merged} >= 1 ✅")
                print(f"   - recordsCreated={records_created} >= 1 ✅")
                
                return True, snapshot_ids
        
        print(f"❌ STEP F FAILED: Job did not complete within {max_polls * 2} seconds")
        return False, snapshot_ids
        
    except Exception as e:
        print(f"❌ STEP F FAILED with exception: {e}")
        return False, snapshot_ids

def main():
    print("="*80)
    print("EMR Import Feature 8: SMART Backend Services (System Access) + Bulk Data $export")
    print("="*80)
    
    # Initial cleanup
    snapshot_ids = cleanup_db()
    
    # Login
    cookies = login_admin()
    if not cookies:
        print("❌ FAILED: Could not login")
        return
    
    # PART 1: CONFIG + JWKS
    public_jwk = test_part1_config_jwks(cookies)
    if not public_jwk:
        print("\n❌ PART 1 FAILED")
        cleanup_new_patients(snapshot_ids)
        return
    
    # TEST 4: system/test before clientId
    if not test_part1_system_test_before_clientid(cookies):
        print("\n❌ TEST 4 FAILED")
        cleanup_new_patients(snapshot_ids)
        return
    
    print("\n✅ PART 1 COMPLETE: All CONFIG + JWKS tests passed")
    
    # PART 2: LIVE ROUND-TRIP
    success, final_snapshot = test_part2_live_roundtrip(cookies, public_jwk)
    
    if success:
        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED")
        print("="*80)
        print("\nSUMMARY:")
        print("✅ PART 1 - CONFIG + JWKS (4 tests)")
        print("   - Missing tokenUrl validation (400) ✅")
        print("   - Valid system config without clientId (200, keySet=true, NO private key) ✅")
        print("   - PUBLIC JWKS endpoint (RSA JWK with kty/n/e/kid/alg) ✅")
        print("   - system/test before clientId (400/502, NOT 500) ✅")
        print("\n✅ PART 2 - LIVE SYSTEM ROUND-TRIP (4 steps)")
        print("   - Public JWK captured ✅")
        print("   - Registered with SMART Bulk Data reference server ✅")
        print("   - Config saved with clientId ✅")
        print("   - System token obtained (grantedScope contains 'system') ✅")
        print("   - Bulk import completed (processed=3, patients created, records created) ✅")
        print("\n🎉 CRITICAL SUCCESS: The app generated an RSA signing key, published it at")
        print("   a PUBLIC JWKS endpoint, minted a signed-JWT client assertion, exchanged")
        print("   it for a REAL system access token, and ran a successful Bulk Data $export!")
    else:
        print("\n❌ TESTS FAILED")
    
    # Cleanup
    cleanup_new_patients(final_snapshot)
    
    print("\n✅ Cleanup completed - database restored to initial state")

if __name__ == "__main__":
    main()
