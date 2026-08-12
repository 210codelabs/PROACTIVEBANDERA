#!/usr/bin/env python3
"""
Backend test for EMR Import Feature 7: Bulk Patient Import
Tests POST/GET/DELETE /api/admin/fhir/[provider]/bulk-import endpoints
"""

import asyncio
import httpx
import os
from pymongo import MongoClient
from datetime import datetime, timedelta

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "proactive_clinic")

async def main():
    print("=" * 80)
    print("BACKEND TEST: EMR Import Feature 7 - Bulk Patient Import")
    print("=" * 80)
    
    # Connect to MongoDB
    mongo_client = MongoClient(MONGO_URL)
    db = mongo_client[DB_NAME]
    
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=False) as client:
        # ===== LOGIN =====
        print("\n[SETUP] Logging in as admin...")
        login_resp = await client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"}
        )
        print(f"Login status: {login_resp.status_code}")
        if login_resp.status_code != 200:
            print(f"Login failed: {login_resp.text}")
            return
        
        # Extract session cookie
        cookies = login_resp.cookies
        print(f"Session cookie set: {bool(cookies)}")
        
        # ===== PART 1: GUARDS =====
        print("\n" + "=" * 80)
        print("PART 1: GUARDS (no external dependencies)")
        print("=" * 80)
        
        # TEST 1: POST without auth cookie -> 401
        print("\n[TEST 1] POST /api/admin/fhir/veradigm/bulk-import WITHOUT auth cookie")
        try:
            resp = await httpx.AsyncClient(timeout=30.0).post(
                f"{BASE_URL}/api/admin/fhir/veradigm/bulk-import",
                json={}
            )
            print(f"Status: {resp.status_code}")
            if resp.status_code == 401:
                print("✅ TEST 1 PASSED: Correctly returns 401 Unauthorized")
            else:
                print(f"❌ TEST 1 FAILED: Expected 401, got {resp.status_code}")
                print(f"Response: {resp.text}")
        except Exception as e:
            print(f"❌ TEST 1 ERROR: {e}")
        
        # TEST 2: POST with bogus provider -> 400 "Unknown provider."
        print("\n[TEST 2] POST /api/admin/fhir/bogus/bulk-import as admin")
        try:
            resp = await client.post(
                f"{BASE_URL}/api/admin/fhir/bogus/bulk-import",
                json={},
                cookies=cookies
            )
            print(f"Status: {resp.status_code}")
            data = resp.json()
            print(f"Response: {data}")
            if resp.status_code == 400 and "Unknown provider" in data.get("error", ""):
                print("✅ TEST 2 PASSED: Correctly returns 400 'Unknown provider.'")
            else:
                print(f"❌ TEST 2 FAILED: Expected 400 with 'Unknown provider', got {resp.status_code}")
        except Exception as e:
            print(f"❌ TEST 2 ERROR: {e}")
        
        # TEST 3: Ensure ecw is NOT configured, then POST -> 400 "not configured yet"
        print("\n[TEST 3] Ensure ecw is NOT configured, then POST /api/admin/fhir/ecw/bulk-import")
        try:
            # Delete ecw FhirConnection if it exists
            result = db.FhirConnection.delete_many({"provider": "ecw"})
            print(f"Deleted {result.deleted_count} ecw FhirConnection doc(s)")
            
            resp = await client.post(
                f"{BASE_URL}/api/admin/fhir/ecw/bulk-import",
                json={},
                cookies=cookies
            )
            print(f"Status: {resp.status_code}")
            data = resp.json()
            print(f"Response: {data}")
            if resp.status_code == 400 and "not configured yet" in data.get("error", ""):
                print("✅ TEST 3 PASSED: Correctly returns 400 'not configured yet'")
            else:
                print(f"❌ TEST 3 FAILED: Expected 400 with 'not configured yet', got {resp.status_code}")
        except Exception as e:
            print(f"❌ TEST 3 ERROR: {e}")
        
        # TEST 4: Configure veradigm but DON'T connect -> 400 "Not connected"
        print("\n[TEST 4] Configure veradigm but DON'T connect, then POST bulk-import")
        try:
            # First, configure veradigm (but not connected)
            config_resp = await client.post(
                f"{BASE_URL}/api/admin/fhir/connections",
                json={
                    "provider": "veradigm",
                    "baseUrl": "https://fhir.example.com/r4",
                    "authUrl": "https://a.example.com/x",
                    "tokenUrl": "https://a.example.com/t",
                    "clientId": "c"
                },
                cookies=cookies
            )
            print(f"Config status: {config_resp.status_code}")
            if config_resp.status_code == 200:
                print("Veradigm configured (status should be 'configured', not 'connected')")
            
            # Now try to POST bulk-import
            resp = await client.post(
                f"{BASE_URL}/api/admin/fhir/veradigm/bulk-import",
                json={},
                cookies=cookies
            )
            print(f"Status: {resp.status_code}")
            data = resp.json()
            print(f"Response: {data}")
            if resp.status_code == 400 and "Not connected" in data.get("error", ""):
                print("✅ TEST 4 PASSED: Correctly returns 400 'Not connected'")
            else:
                print(f"❌ TEST 4 FAILED: Expected 400 with 'Not connected', got {resp.status_code}")
        except Exception as e:
            print(f"❌ TEST 4 ERROR: {e}")
        
        # TEST 5: GET with no job created yet -> 200 {ok:true, job:null}
        print("\n[TEST 5] GET /api/admin/fhir/veradigm/bulk-import (no job yet)")
        try:
            resp = await client.get(
                f"{BASE_URL}/api/admin/fhir/veradigm/bulk-import",
                cookies=cookies
            )
            print(f"Status: {resp.status_code}")
            data = resp.json()
            print(f"Response: {data}")
            if resp.status_code == 200 and data.get("ok") is True and data.get("job") is None:
                print("✅ TEST 5 PASSED: Correctly returns 200 {ok:true, job:null}")
            else:
                print(f"❌ TEST 5 FAILED: Expected 200 with job:null, got {resp.status_code}")
        except Exception as e:
            print(f"❌ TEST 5 ERROR: {e}")
        
        # TEST 6: DELETE without jobId -> 400 "jobId is required."
        print("\n[TEST 6] DELETE /api/admin/fhir/veradigm/bulk-import WITHOUT jobId")
        try:
            resp = await client.delete(
                f"{BASE_URL}/api/admin/fhir/veradigm/bulk-import",
                cookies=cookies
            )
            print(f"Status: {resp.status_code}")
            data = resp.json()
            print(f"Response: {data}")
            if resp.status_code == 400 and "jobId is required" in data.get("error", ""):
                print("✅ TEST 6 PASSED: Correctly returns 400 'jobId is required.'")
            else:
                print(f"❌ TEST 6 FAILED: Expected 400 with 'jobId is required', got {resp.status_code}")
        except Exception as e:
            print(f"❌ TEST 6 ERROR: {e}")
        
        # ===== PART 2: LIVE TRIAL RUN =====
        print("\n" + "=" * 80)
        print("PART 2: LIVE TRIAL RUN against OPEN SMART sandbox")
        print("=" * 80)
        
        # SNAPSHOT existing Patient _ids
        print("\n[SETUP] Snapshotting existing Patient _ids...")
        existing_patient_ids = set(str(p["_id"]) for p in db.Patient.find({}, {"_id": 1}))
        print(f"Existing patients count: {len(existing_patient_ids)}")
        
        # UPSERT veradigm FhirConnection to CONNECTED state pointing at open sandbox
        print("\n[SETUP] Upserting veradigm FhirConnection to CONNECTED state (open sandbox)...")
        far_future = datetime.now() + timedelta(days=365*4)  # year 2030
        db.FhirConnection.update_one(
            {"provider": "veradigm"},
            {
                "$set": {
                    "provider": "veradigm",
                    "baseUrl": "https://r4.smarthealthit.org",
                    "authUrl": "https://r4.smarthealthit.org/auth/authorize",
                    "tokenUrl": "https://r4.smarthealthit.org/auth/token",
                    "clientId": "sandbox",
                    "scopes": "user/*.read",
                    "status": "connected",
                    "accessToken": "sandbox-open",
                    "expiresAt": far_future,
                    "updatedAt": datetime.now()
                }
            },
            upsert=True
        )
        print("✅ Veradigm FhirConnection upserted to CONNECTED state")
        
        # TEST 7: POST bulk-import with limit:3
        print("\n[TEST 7] POST /api/admin/fhir/veradigm/bulk-import with {limit:3}")
        try:
            resp = await client.post(
                f"{BASE_URL}/api/admin/fhir/veradigm/bulk-import",
                json={"limit": 3},
                cookies=cookies
            )
            print(f"Status: {resp.status_code}")
            data = resp.json()
            print(f"Response: {data}")
            
            if resp.status_code != 200:
                print(f"❌ TEST 7 FAILED: Expected 200, got {resp.status_code}")
            else:
                job_id = data.get("jobId")
                job = data.get("job")
                print(f"Job ID: {job_id}")
                print(f"Job: {job}")
                
                if not job_id:
                    print("❌ TEST 7 FAILED: No jobId returned")
                else:
                    print("✅ TEST 7 PASSED: Bulk import started successfully")
                    
                    # TEST 8: POLL until job.status != "running"
                    print("\n[TEST 8] POLLING job status every 2 seconds (up to 90 seconds)...")
                    max_polls = 45  # 90 seconds / 2 seconds
                    poll_count = 0
                    final_job = None
                    
                    while poll_count < max_polls:
                        await asyncio.sleep(2)
                        poll_count += 1
                        
                        poll_resp = await client.get(
                            f"{BASE_URL}/api/admin/fhir/veradigm/bulk-import?jobId={job_id}",
                            cookies=cookies
                        )
                        
                        if poll_resp.status_code != 200:
                            print(f"❌ POLL {poll_count} FAILED: Status {poll_resp.status_code}")
                            break
                        
                        poll_data = poll_resp.json()
                        final_job = poll_data.get("job")
                        
                        if not final_job:
                            print(f"❌ POLL {poll_count} FAILED: No job in response")
                            break
                        
                        status = final_job.get("status")
                        processed = final_job.get("processed", 0)
                        current = final_job.get("currentPatient", "")
                        
                        print(f"Poll {poll_count}: status={status}, processed={processed}, current={current[:50] if current else 'N/A'}")
                        
                        if status != "running":
                            print(f"\n✅ Job finished with status: {status}")
                            break
                    
                    if final_job:
                        print("\n[TEST 8] FINAL JOB STATE:")
                        print(f"Full job JSON: {final_job}")
                        
                        # ASSERT final job
                        status = final_job.get("status")
                        processed = final_job.get("processed", 0)
                        patients_created = final_job.get("patientsCreated", 0)
                        patients_merged = final_job.get("patientsMerged", 0)
                        records_created = final_job.get("recordsCreated", 0)
                        failed = final_job.get("failed", 0)
                        
                        print(f"\nASSERTIONS:")
                        print(f"  status: {status} (expected: 'completed')")
                        print(f"  processed: {processed} (expected: 3)")
                        print(f"  patientsCreated: {patients_created}")
                        print(f"  patientsMerged: {patients_merged}")
                        print(f"  patientsCreated + patientsMerged: {patients_created + patients_merged} (expected: >= 1 and <= 3)")
                        print(f"  recordsCreated: {records_created} (expected: >= 1)")
                        print(f"  failed: {failed}")
                        
                        all_passed = True
                        
                        if status != "completed":
                            print(f"❌ ASSERTION FAILED: status is '{status}', expected 'completed'")
                            all_passed = False
                        else:
                            print("✅ status == 'completed'")
                        
                        if processed != 3:
                            print(f"❌ ASSERTION FAILED: processed is {processed}, expected 3")
                            all_passed = False
                        else:
                            print("✅ processed == 3")
                        
                        total_patients = patients_created + patients_merged
                        if total_patients < 1 or total_patients > 3:
                            print(f"❌ ASSERTION FAILED: patientsCreated + patientsMerged = {total_patients}, expected >= 1 and <= 3")
                            all_passed = False
                        else:
                            print(f"✅ patientsCreated + patientsMerged = {total_patients} (within expected range)")
                        
                        if records_created < 1:
                            print(f"❌ ASSERTION FAILED: recordsCreated is {records_created}, expected >= 1")
                            all_passed = False
                        else:
                            print(f"✅ recordsCreated = {records_created} (>= 1)")
                        
                        if all_passed:
                            print("\n✅ TEST 8 PASSED: All assertions passed")
                        else:
                            print("\n❌ TEST 8 FAILED: Some assertions failed")
                        
                        # TEST 9: VERIFY persistence
                        print("\n[TEST 9] VERIFY persistence: Check new Patient docs created")
                        current_patient_ids = set(str(p["_id"]) for p in db.Patient.find({}, {"_id": 1}))
                        new_patient_ids = current_patient_ids - existing_patient_ids
                        print(f"New patients created: {len(new_patient_ids)}")
                        
                        if len(new_patient_ids) >= 1:
                            print(f"✅ TEST 9 PASSED: {len(new_patient_ids)} new Patient doc(s) created")
                            print(f"New patient IDs: {list(new_patient_ids)[:5]}")  # Show first 5
                        else:
                            print("❌ TEST 9 FAILED: No new Patient docs created")
                    else:
                        print("❌ TEST 8 FAILED: No final job state available")
        except Exception as e:
            print(f"❌ TEST 7-9 ERROR: {e}")
            import traceback
            traceback.print_exc()
        
        # ===== PART 3: CANCEL (optional but preferred) =====
        print("\n" + "=" * 80)
        print("PART 3: CANCEL (optional)")
        print("=" * 80)
        
        # TEST 10: Start another run WITHOUT limit, then cancel
        print("\n[TEST 10] Start bulk import WITHOUT limit, then cancel")
        try:
            # Start a new run
            resp = await client.post(
                f"{BASE_URL}/api/admin/fhir/veradigm/bulk-import",
                json={},
                cookies=cookies
            )
            print(f"Start status: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                cancel_job_id = data.get("jobId")
                print(f"Started job ID: {cancel_job_id}")
                
                # Immediately DELETE to cancel
                print("Immediately sending DELETE to cancel...")
                cancel_resp = await client.delete(
                    f"{BASE_URL}/api/admin/fhir/veradigm/bulk-import?jobId={cancel_job_id}",
                    cookies=cookies
                )
                print(f"Cancel status: {cancel_resp.status_code}")
                cancel_data = cancel_resp.json()
                print(f"Cancel response: {cancel_data}")
                
                if cancel_resp.status_code == 200:
                    print("✅ Cancel request sent successfully")
                    
                    # Poll until status == "cancelled"
                    print("\nPolling until status == 'cancelled' (up to 30 seconds)...")
                    max_cancel_polls = 15  # 30 seconds / 2 seconds
                    cancel_poll_count = 0
                    cancelled = False
                    
                    while cancel_poll_count < max_cancel_polls:
                        await asyncio.sleep(2)
                        cancel_poll_count += 1
                        
                        poll_resp = await client.get(
                            f"{BASE_URL}/api/admin/fhir/veradigm/bulk-import?jobId={cancel_job_id}",
                            cookies=cookies
                        )
                        
                        if poll_resp.status_code == 200:
                            poll_data = poll_resp.json()
                            job = poll_data.get("job")
                            if job:
                                status = job.get("status")
                                print(f"Poll {cancel_poll_count}: status={status}")
                                
                                if status == "cancelled":
                                    print(f"\n✅ TEST 10 PASSED: Job cancelled successfully")
                                    cancelled = True
                                    break
                    
                    if not cancelled:
                        print(f"\n⚠️ TEST 10 PARTIAL: Job did not reach 'cancelled' status within 30 seconds (may still be processing)")
                else:
                    print(f"❌ TEST 10 FAILED: Cancel request failed with status {cancel_resp.status_code}")
            elif resp.status_code == 409:
                print("⚠️ TEST 10 SKIPPED: Another job is already running (409 conflict)")
            else:
                print(f"❌ TEST 10 FAILED: Could not start job, status {resp.status_code}")
        except Exception as e:
            print(f"❌ TEST 10 ERROR: {e}")
        
        # TEST 11: Verify 409 when a run is in progress
        print("\n[TEST 11] Verify 409 when trying to start a second run while one is in progress")
        try:
            # Check if there's a running job
            running_job = db.FhirBulkJob.find_one({"provider": "veradigm", "status": "running"})
            
            if running_job:
                print("Found a running job, attempting to start another...")
                resp = await client.post(
                    f"{BASE_URL}/api/admin/fhir/veradigm/bulk-import",
                    json={},
                    cookies=cookies
                )
                print(f"Status: {resp.status_code}")
                data = resp.json()
                print(f"Response: {data}")
                
                if resp.status_code == 409 and "already running" in data.get("error", ""):
                    print("✅ TEST 11 PASSED: Correctly returns 409 when a run is in progress")
                else:
                    print(f"❌ TEST 11 FAILED: Expected 409, got {resp.status_code}")
            else:
                print("⚠️ TEST 11 SKIPPED: No running job found (timing issue)")
        except Exception as e:
            print(f"❌ TEST 11 ERROR: {e}")
        
        # ===== CLEANUP =====
        print("\n" + "=" * 80)
        print("CLEANUP (MANDATORY)")
        print("=" * 80)
        
        print("\n[CLEANUP] Computing new Patient _ids...")
        current_patient_ids = set(str(p["_id"]) for p in db.Patient.find({}, {"_id": 1}))
        new_patient_ids = current_patient_ids - existing_patient_ids
        print(f"New patient IDs to delete: {len(new_patient_ids)}")
        
        if new_patient_ids:
            print(f"Sample new patient IDs: {list(new_patient_ids)[:5]}")
            
            # Delete new Patient docs
            print("\n[CLEANUP] Deleting new Patient docs...")
            result = db.Patient.delete_many({"_id": {"$in": list(new_patient_ids)}})
            print(f"Deleted {result.deleted_count} Patient doc(s)")
            
            # Delete child records
            print("\n[CLEANUP] Deleting child records (Problem, Medication, Allergy, Vital, Immunization, Encounter)...")
            
            problem_result = db.Problem.delete_many({"patientId": {"$in": list(new_patient_ids)}})
            print(f"Deleted {problem_result.deleted_count} Problem doc(s)")
            
            medication_result = db.Medication.delete_many({"patientId": {"$in": list(new_patient_ids)}})
            print(f"Deleted {medication_result.deleted_count} Medication doc(s)")
            
            allergy_result = db.Allergy.delete_many({"patientId": {"$in": list(new_patient_ids)}})
            print(f"Deleted {allergy_result.deleted_count} Allergy doc(s)")
            
            vital_result = db.Vital.delete_many({"patientId": {"$in": list(new_patient_ids)}})
            print(f"Deleted {vital_result.deleted_count} Vital doc(s)")
            
            immunization_result = db.Immunization.delete_many({"patientId": {"$in": list(new_patient_ids)}})
            print(f"Deleted {immunization_result.deleted_count} Immunization doc(s)")
            
            encounter_result = db.Encounter.delete_many({"patientId": {"$in": list(new_patient_ids)}})
            print(f"Deleted {encounter_result.deleted_count} Encounter doc(s)")
        else:
            print("No new patients to clean up")
        
        # Delete ALL FhirBulkJob docs
        print("\n[CLEANUP] Deleting ALL FhirBulkJob docs...")
        bulk_job_result = db.FhirBulkJob.delete_many({})
        print(f"Deleted {bulk_job_result.deleted_count} FhirBulkJob doc(s)")
        
        # Delete ImportJob docs where source == "veradigm_fhir_bulk"
        print("\n[CLEANUP] Deleting ImportJob docs where source == 'veradigm_fhir_bulk'...")
        import_job_result = db.ImportJob.delete_many({"source": "veradigm_fhir_bulk"})
        print(f"Deleted {import_job_result.deleted_count} ImportJob doc(s)")
        
        # Reset veradigm FhirConnection
        print("\n[CLEANUP] Resetting veradigm FhirConnection...")
        db.FhirConnection.update_one(
            {"provider": "veradigm"},
            {
                "$set": {
                    "status": "configured",
                    "accessToken": None,
                    "refreshToken": None,
                    "expiresAt": None,
                    "updatedAt": datetime.now()
                }
            }
        )
        print("✅ Veradigm FhirConnection reset to 'configured' status")
        
        # Ensure ecw config is removed
        print("\n[CLEANUP] Ensuring ecw FhirConnection is removed...")
        ecw_result = db.FhirConnection.delete_many({"provider": "ecw"})
        print(f"Deleted {ecw_result.deleted_count} ecw FhirConnection doc(s)")
        
        print("\n✅ CLEANUP COMPLETE")
    
    mongo_client.close()
    
    print("\n" + "=" * 80)
    print("BACKEND TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
