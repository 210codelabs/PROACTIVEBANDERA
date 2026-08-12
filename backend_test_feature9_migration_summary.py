#!/usr/bin/env python3
"""
Backend test for EMR Import Feature 9: Migration Summary (per-category recap on bulk job)
Tests the per-category breakdown object in bulk import jobs.

This is a small additive change on top of Feature 8 (SMART Backend Services + Bulk Data $export).
The bulk worker now aggregates per-category counts (problems/medications/allergies/vitals/immunizations/encounters)
into a FhirBulkJob.breakdown field, and the GET bulk-import job response exposes job.breakdown.

GOAL: Verify the bulk-import job returns a per-category `breakdown` object, and that the per-category
`created` counts sum to `recordsCreated`.
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
    
    # Delete veradigm FhirConnection
    result = db.FhirConnection.delete_many({"provider": "veradigm"})
    print(f"Deleted {result.deleted_count} FhirConnection docs (veradigm)")
    
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
    
    # Delete veradigm FhirConnection
    result = db.FhirConnection.delete_many({"provider": "veradigm"})
    print(f"Deleted {result.deleted_count} FhirConnection docs (veradigm)")
    
    print("✅ Cleanup completed")

def test_feature9_migration_summary(cookies):
    """
    Test Feature 9: Migration Summary (per-category breakdown)
    
    Reuses the EXACT same live setup from Feature 8 (SMART Bulk Data reference server).
    """
    print("\n" + "="*80)
    print("EMR Import Feature 9: Migration Summary (per-category breakdown)")
    print("="*80)
    
    # STEP 1: POST /api/admin/fhir/connections (system mode, no clientId yet)
    print("\n--- STEP 1: POST /api/admin/fhir/connections (system mode) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/fhir/connections",
            json={
                "provider": "veradigm",
                "authMode": "system",
                "baseUrl": BULK_DATA_FHIR,
                "tokenUrl": BULK_DATA_TOKEN,
                "scopes": "system/*.read"
            },
            cookies=cookies
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"Response: {resp.text}")
            print(f"❌ STEP 1 FAILED: Expected 200, got {resp.status_code}")
            return False, None
        
        data = resp.json()
        connection = data.get("connection", {})
        print(f"✅ STEP 1 PASSED: System config saved, status={connection.get('status')}")
        
    except Exception as e:
        print(f"❌ STEP 1 FAILED with exception: {e}")
        return False, None
    
    # STEP 2: GET /api/fhir/jwks/veradigm (public) -> capture public JWK
    print("\n--- STEP 2: GET /api/fhir/jwks/veradigm (PUBLIC) ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/fhir/jwks/veradigm")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"Response: {resp.text}")
            print(f"❌ STEP 2 FAILED: Expected 200, got {resp.status_code}")
            return False, None
        
        data = resp.json()
        keys = data.get("keys", [])
        if not keys:
            print(f"❌ STEP 2 FAILED: keys array is empty")
            return False, None
        
        public_jwk = keys[0]
        print(f"✅ STEP 2 PASSED: Public JWK captured, kid={public_jwk.get('kid')}")
        
    except Exception as e:
        print(f"❌ STEP 2 FAILED with exception: {e}")
        return False, None
    
    # STEP 3: Register with SMART Bulk Data reference server
    print("\n--- STEP 3: Register public JWK with reference server ---")
    try:
        jwks_payload = {"keys": [public_jwk]}
        jwks_json = json.dumps(jwks_payload)
        
        resp = requests.post(
            BULK_DATA_REGISTER,
            data={"jwks": jwks_json},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        print(f"Registration status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ STEP 3 FAILED: Registration failed with status {resp.status_code}")
            print(f"Response body: {resp.text}")
            return False, None
        
        # Response body IS the client_id (a JWT)
        client_id = resp.text.strip()
        print(f"✅ STEP 3 PASSED: Registered, client_id length: {len(client_id)}")
        
    except Exception as e:
        print(f"❌ STEP 3 FAILED with exception: {e}")
        return False, None
    
    # STEP 4: POST /api/admin/fhir/connections again with clientId
    print("\n--- STEP 4: POST /api/admin/fhir/connections with clientId ---")
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
            print(f"❌ STEP 4 FAILED: Expected 200, got {resp.status_code}")
            return False, None
        
        print(f"✅ STEP 4 PASSED: Config saved with clientId")
        
    except Exception as e:
        print(f"❌ STEP 4 FAILED with exception: {e}")
        return False, None
    
    # STEP 5: POST /api/admin/fhir/veradigm/system/test -> 200 (real token)
    print("\n--- STEP 5: POST /api/admin/fhir/veradigm/system/test ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/admin/fhir/veradigm/system/test",
            cookies=cookies
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"Response: {resp.text}")
            print(f"❌ STEP 5 FAILED: Expected 200, got {resp.status_code}")
            return False, None
        
        data = resp.json()
        granted_scope = data.get("grantedScope", "")
        print(f"Granted scope: {granted_scope}")
        print(f"✅ STEP 5 PASSED: System token obtained")
        
    except Exception as e:
        print(f"❌ STEP 5 FAILED with exception: {e}")
        return False, None
    
    # STEP 6: Snapshot Patient _ids, then POST bulk-import {limit:3}
    print("\n--- STEP 6: POST /api/admin/fhir/veradigm/bulk-import {limit:3} ---")
    
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
            print(f"❌ STEP 6 FAILED: Expected 200, got {resp.status_code}")
            return False, snapshot_ids
        
        data = resp.json()
        job_id = data.get("jobId")
        print(f"Job ID: {job_id}")
        
        if not job_id:
            print(f"❌ STEP 6 FAILED: No jobId in response")
            return False, snapshot_ids
        
        # Poll until completed
        print("\nPolling job status every 2 seconds...")
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
                print(f"\nFinal job data:")
                print(json.dumps(job, indent=2))
                
                # CRITICAL ASSERTIONS FOR FEATURE 9
                print("\n" + "="*80)
                print("FEATURE 9 ASSERTIONS: Per-category breakdown")
                print("="*80)
                
                # Verify basic job completion
                if status != "completed":
                    print(f"❌ ASSERTION FAILED: Expected status='completed', got '{status}'")
                    return False, snapshot_ids
                
                if processed != 3:
                    print(f"❌ ASSERTION FAILED: Expected processed=3, got {processed}")
                    return False, snapshot_ids
                
                print(f"✅ status == 'completed'")
                print(f"✅ processed == 3")
                
                # CRITICAL: Verify breakdown object exists and is non-null
                breakdown = job.get("breakdown")
                if breakdown is None:
                    print(f"❌ ASSERTION FAILED: breakdown is NULL or missing")
                    return False, snapshot_ids
                
                print(f"\n✅ breakdown is present and NON-NULL")
                print(f"\nBreakdown object:")
                print(json.dumps(breakdown, indent=2))
                
                # Verify breakdown has all 6 categories
                expected_categories = ["problems", "medications", "allergies", "vitals", "immunizations", "encounters"]
                for category in expected_categories:
                    if category not in breakdown:
                        print(f"❌ ASSERTION FAILED: breakdown missing category '{category}'")
                        return False, snapshot_ids
                    
                    cat_data = breakdown[category]
                    if not isinstance(cat_data, dict):
                        print(f"❌ ASSERTION FAILED: breakdown[{category}] is not an object")
                        return False, snapshot_ids
                    
                    if "created" not in cat_data or "skipped" not in cat_data:
                        print(f"❌ ASSERTION FAILED: breakdown[{category}] missing 'created' or 'skipped'")
                        return False, snapshot_ids
                    
                    if not isinstance(cat_data["created"], (int, float)):
                        print(f"❌ ASSERTION FAILED: breakdown[{category}].created is not numeric")
                        return False, snapshot_ids
                    
                    if not isinstance(cat_data["skipped"], (int, float)):
                        print(f"❌ ASSERTION FAILED: breakdown[{category}].skipped is not numeric")
                        return False, snapshot_ids
                
                print(f"\n✅ breakdown has all 6 categories (problems, medications, allergies, vitals, immunizations, encounters)")
                print(f"✅ Each category has numeric 'created' and 'skipped' fields")
                
                # CRITICAL: Verify sum of breakdown[cat].created == recordsCreated
                records_created = job.get("recordsCreated", 0)
                
                breakdown_sum = sum(
                    breakdown[cat]["created"]
                    for cat in expected_categories
                )
                
                print(f"\n--- Per-category created counts ---")
                for category in expected_categories:
                    created = breakdown[category]["created"]
                    skipped = breakdown[category]["skipped"]
                    print(f"  {category:15s}: created={created:3d}, skipped={skipped:3d}")
                
                print(f"\n--- Sum verification ---")
                print(f"  Sum of breakdown[cat].created: {breakdown_sum}")
                print(f"  job.recordsCreated:            {records_created}")
                
                if breakdown_sum != records_created:
                    print(f"\n❌ ASSERTION FAILED: Sum of breakdown[cat].created ({breakdown_sum}) != recordsCreated ({records_created})")
                    return False, snapshot_ids
                
                print(f"\n✅ CRITICAL ASSERTION PASSED: Sum of breakdown[cat].created == recordsCreated")
                
                # Additional info
                patients_created = job.get("patientsCreated", 0)
                patients_merged = job.get("patientsMerged", 0)
                records_skipped = job.get("recordsSkipped", 0)
                
                print(f"\n--- Additional job stats ---")
                print(f"  patientsCreated: {patients_created}")
                print(f"  patientsMerged:  {patients_merged}")
                print(f"  recordsCreated:  {records_created}")
                print(f"  recordsSkipped:  {records_skipped}")
                
                print("\n" + "="*80)
                print("✅ ALL FEATURE 9 ASSERTIONS PASSED")
                print("="*80)
                
                return True, snapshot_ids
        
        print(f"❌ STEP 6 FAILED: Job did not complete within {max_polls * 2} seconds")
        return False, snapshot_ids
        
    except Exception as e:
        print(f"❌ STEP 6 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False, snapshot_ids

def main():
    print("="*80)
    print("EMR Import Feature 9: Migration Summary (per-category breakdown)")
    print("="*80)
    print("\nThis test verifies that the bulk-import job now returns a per-category")
    print("`breakdown` object, and that the per-category `created` counts sum to")
    print("`recordsCreated`.")
    
    # Initial cleanup
    snapshot_ids = cleanup_db()
    
    # Login
    cookies = login_admin()
    if not cookies:
        print("❌ FAILED: Could not login")
        return
    
    # Run Feature 9 test
    success, final_snapshot = test_feature9_migration_summary(cookies)
    
    if success:
        print("\n" + "="*80)
        print("✅ FEATURE 9 TEST PASSED")
        print("="*80)
        print("\nSUMMARY:")
        print("✅ System config saved (authMode='system', generates signing key)")
        print("✅ Public JWK endpoint accessible (no auth required)")
        print("✅ Registered with SMART Bulk Data reference server (client_id obtained)")
        print("✅ Config updated with clientId")
        print("✅ System token obtained (real client_credentials grant)")
        print("✅ Bulk import completed (limit:3, status='completed', processed=3)")
        print("\n🎉 FEATURE 9 CRITICAL ASSERTIONS:")
        print("   ✅ breakdown object is present and NON-NULL")
        print("   ✅ breakdown has all 6 categories with numeric created/skipped")
        print("   ✅ Sum of breakdown[cat].created == job.recordsCreated")
        print("\nThe per-category migration summary feature is working correctly!")
    else:
        print("\n❌ FEATURE 9 TEST FAILED")
    
    # Cleanup
    if final_snapshot is not None:
        cleanup_new_patients(final_snapshot)
        print("\n✅ Cleanup completed - database restored to initial state")
    else:
        print("\n⚠️ Cleanup skipped - test failed before snapshot")

if __name__ == "__main__":
    main()
