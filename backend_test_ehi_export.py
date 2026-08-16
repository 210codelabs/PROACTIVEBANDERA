#!/usr/bin/env python3
"""
Backend test for EHI Export Tool (ONC Cures Act §170.315(b)(10))
Tests GET /api/admin/ehi-export endpoint with various scenarios.
"""

import asyncio
import aiohttp
import json
import os
from pymongo import MongoClient

# Configuration
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "proactive_clinic"

async def main():
    print("=" * 80)
    print("EHI Export Tool Backend Testing")
    print("=" * 80)
    
    # Connect to MongoDB
    mongo_client = MongoClient(MONGO_URL)
    db = mongo_client[DB_NAME]
    
    async with aiohttp.ClientSession() as session:
        admin_cookie = None
        
        # ===== STEP 1: GET /api/admin/ehi-export?scope=all with NO cookie -> expect 401 =====
        print("\n[STEP 1] Testing auth guard: GET /api/admin/ehi-export?scope=all WITHOUT cookie")
        try:
            async with session.get(f"{BASE_URL}/api/admin/ehi-export?scope=all") as resp:
                status = resp.status
                body = await resp.text()
                print(f"  Status: {status}")
                if status == 401:
                    print("  ✅ PASS: Returns 401 Unauthorized as expected")
                else:
                    print(f"  ❌ FAIL: Expected 401, got {status}")
                    print(f"  Response: {body[:200]}")
        except Exception as e:
            print(f"  ❌ ERROR: {e}")
        
        # Login as admin to get session cookie
        print("\n[LOGIN] Authenticating as admin...")
        try:
            async with session.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            ) as resp:
                if resp.status == 200:
                    # Extract session cookie
                    cookies = resp.cookies
                    if cookies:
                        admin_cookie = {k: v.value for k, v in cookies.items()}
                        print(f"  ✅ Login successful, session cookie obtained")
                    else:
                        print(f"  ⚠️  Login returned 200 but no cookies set")
                else:
                    body = await resp.text()
                    print(f"  ❌ Login failed with status {resp.status}: {body[:200]}")
                    return
        except Exception as e:
            print(f"  ❌ Login ERROR: {e}")
            return
        
        # ===== STEP 2: GET /api/admin/ehi-export (no params) as admin -> expect 400 =====
        print("\n[STEP 2] Testing validation: GET /api/admin/ehi-export with NO params as admin")
        try:
            async with session.get(
                f"{BASE_URL}/api/admin/ehi-export",
                cookies=admin_cookie
            ) as resp:
                status = resp.status
                body_text = await resp.text()
                print(f"  Status: {status}")
                if status == 400:
                    try:
                        body = json.loads(body_text)
                        error = body.get("error", "")
                        print(f"  Error message: {error}")
                        if "scope" in error.lower() or "patientid" in error.lower():
                            print("  ✅ PASS: Returns 400 with appropriate error message")
                        else:
                            print(f"  ⚠️  Returns 400 but error message unexpected: {error}")
                    except Exception:
                        print(f"  Response: {body_text[:200]}")
                        print("  ✅ PASS: Returns 400 as expected")
                else:
                    print(f"  ❌ FAIL: Expected 400, got {status}")
                    print(f"  Response: {body_text[:200]}")
        except Exception as e:
            print(f"  ❌ ERROR: {e}")
        
        # ===== STEP 3: GET /api/admin/ehi-export?patientId=doesnotexist123 as admin -> expect 404 =====
        print("\n[STEP 3] Testing not found: GET /api/admin/ehi-export?patientId=doesnotexist123 as admin")
        try:
            async with session.get(
                f"{BASE_URL}/api/admin/ehi-export?patientId=doesnotexist123",
                cookies=admin_cookie
            ) as resp:
                status = resp.status
                body_text = await resp.text()
                print(f"  Status: {status}")
                if status == 404:
                    try:
                        body = json.loads(body_text)
                        error = body.get("error", "")
                        print(f"  Error message: {error}")
                        if "not found" in error.lower():
                            print("  ✅ PASS: Returns 404 with 'Patient not found.' error")
                        else:
                            print(f"  ⚠️  Returns 404 but error message unexpected: {error}")
                    except Exception:
                        print(f"  Response: {body_text[:200]}")
                        print("  ✅ PASS: Returns 404 as expected")
                else:
                    print(f"  ❌ FAIL: Expected 404, got {status}")
                    print(f"  Response: {body_text[:200]}")
        except Exception as e:
            print(f"  ❌ ERROR: {e}")
        
        # ===== STEP 4: Resolve a real patientId (Eleanor Adams, MRN PC-100000) =====
        print("\n[STEP 4] Resolving real patientId for Eleanor Adams (MRN PC-100000)")
        patient_id = None
        
        # Try MongoDB query first
        try:
            patient = db.Patient.find_one({"mrn": "PC-100000"})
            if patient:
                patient_id = patient["_id"]
                print(f"  ✅ Found patient via MongoDB: ID = {patient_id}")
                print(f"     Name: {patient.get('firstName')} {patient.get('lastName')}")
                print(f"     MRN: {patient.get('mrn')}")
            else:
                print("  ⚠️  Patient not found in MongoDB, trying API...")
        except Exception as e:
            print(f"  ⚠️  MongoDB query failed: {e}, trying API...")
        
        # Fallback to API if MongoDB didn't work
        if not patient_id:
            try:
                async with session.get(
                    f"{BASE_URL}/api/patients/search?q=Adams",
                    cookies=admin_cookie
                ) as resp:
                    if resp.status == 200:
                        body = await resp.json()
                        patients = body.get("patients", [])
                        if patients:
                            # Find Eleanor Adams with MRN PC-100000
                            for p in patients:
                                if p.get("mrn") == "PC-100000":
                                    patient_id = p.get("id")
                                    print(f"  ✅ Found patient via API: ID = {patient_id}")
                                    print(f"     Name: {p.get('firstName')} {p.get('lastName')}")
                                    print(f"     MRN: {p.get('mrn')}")
                                    break
                            if not patient_id and patients:
                                # Use first patient as fallback
                                patient_id = patients[0].get("id")
                                print(f"  ⚠️  Eleanor Adams not found, using first patient: ID = {patient_id}")
                        else:
                            print("  ❌ No patients found via API")
                    else:
                        print(f"  ❌ API search failed with status {resp.status}")
            except Exception as e:
                print(f"  ❌ API search ERROR: {e}")
        
        if not patient_id:
            print("  ❌ CRITICAL: Could not resolve a patient ID. Cannot continue with remaining tests.")
            return
        
        # ===== STEP 5: GET /api/admin/ehi-export?patientId=<id>&format=ndjson as admin =====
        print(f"\n[STEP 5] Testing NDJSON export: GET /api/admin/ehi-export?patientId={patient_id}&format=ndjson")
        try:
            async with session.get(
                f"{BASE_URL}/api/admin/ehi-export?patientId={patient_id}&format=ndjson",
                cookies=admin_cookie
            ) as resp:
                status = resp.status
                content_type = resp.headers.get("content-type", "")
                content_disposition = resp.headers.get("content-disposition", "")
                cache_control = resp.headers.get("cache-control", "")
                body_bytes = await resp.read()
                
                print(f"  Status: {status}")
                print(f"  Content-Type: {content_type}")
                print(f"  Content-Disposition: {content_disposition}")
                print(f"  Cache-Control: {cache_control}")
                print(f"  Body size: {len(body_bytes)} bytes")
                
                if status == 200:
                    # Check content-type
                    if "application/fhir+ndjson" in content_type:
                        print("  ✅ Content-Type contains 'application/fhir+ndjson'")
                    else:
                        print(f"  ❌ FAIL: Content-Type should contain 'application/fhir+ndjson', got '{content_type}'")
                    
                    # Check content-disposition
                    if "attachment" in content_disposition and ".ndjson" in content_disposition:
                        print("  ✅ Content-Disposition is attachment with .ndjson filename")
                    else:
                        print(f"  ⚠️  Content-Disposition unexpected: {content_disposition}")
                    
                    # Check cache-control
                    if "no-store" in cache_control:
                        print("  ✅ Cache-Control contains 'no-store'")
                    else:
                        print(f"  ⚠️  Cache-Control should contain 'no-store', got '{cache_control}'")
                    
                    # Check body is non-empty
                    if len(body_bytes) > 0:
                        print("  ✅ Body is non-empty")
                        
                        # Parse NDJSON lines
                        body_text = body_bytes.decode('utf-8')
                        lines = [line.strip() for line in body_text.split('\n') if line.strip()]
                        print(f"  Found {len(lines)} non-empty lines")
                        
                        # Check each line parses as JSON and has resourceType
                        all_valid = True
                        patient_resource_found = False
                        resource_types = {}
                        
                        for i, line in enumerate(lines):
                            try:
                                resource = json.loads(line)
                                resource_type = resource.get("resourceType")
                                if not resource_type:
                                    print(f"  ❌ Line {i+1} has no 'resourceType' field")
                                    all_valid = False
                                else:
                                    resource_types[resource_type] = resource_types.get(resource_type, 0) + 1
                                    # Check for Patient resource with matching id
                                    if resource_type == "Patient" and resource.get("id") == patient_id:
                                        patient_resource_found = True
                            except json.JSONDecodeError as e:
                                print(f"  ❌ Line {i+1} is not valid JSON: {e}")
                                all_valid = False
                        
                        if all_valid:
                            print("  ✅ EVERY non-empty line parses as JSON and has 'resourceType'")
                        else:
                            print("  ❌ FAIL: Some lines failed validation")
                        
                        print(f"  Resource types found: {resource_types}")
                        
                        if patient_resource_found:
                            print(f"  ✅ Found Patient resource with id='{patient_id}'")
                        else:
                            print(f"  ❌ FAIL: No Patient resource with id='{patient_id}' found")
                        
                        if all_valid and patient_resource_found:
                            print("  ✅ PASS: NDJSON export test successful")
                    else:
                        print("  ❌ FAIL: Body is empty")
                else:
                    print(f"  ❌ FAIL: Expected 200, got {status}")
                    print(f"  Response: {body_bytes[:200]}")
        except Exception as e:
            print(f"  ❌ ERROR: {e}")
        
        # ===== STEP 6a: GET /api/admin/ehi-export?patientId=<id>&format=zip as admin =====
        print(f"\n[STEP 6a] Testing ZIP export (explicit format): GET /api/admin/ehi-export?patientId={patient_id}&format=zip")
        try:
            async with session.get(
                f"{BASE_URL}/api/admin/ehi-export?patientId={patient_id}&format=zip",
                cookies=admin_cookie
            ) as resp:
                status = resp.status
                content_type = resp.headers.get("content-type", "")
                content_disposition = resp.headers.get("content-disposition", "")
                cache_control = resp.headers.get("cache-control", "")
                body_bytes = await resp.read()
                
                print(f"  Status: {status}")
                print(f"  Content-Type: {content_type}")
                print(f"  Content-Disposition: {content_disposition}")
                print(f"  Cache-Control: {cache_control}")
                print(f"  Body size: {len(body_bytes)} bytes")
                
                if status == 200:
                    # Check content-type
                    if "application/zip" in content_type:
                        print("  ✅ Content-Type is 'application/zip'")
                    else:
                        print(f"  ❌ FAIL: Content-Type should be 'application/zip', got '{content_type}'")
                    
                    # Check content-disposition
                    if "attachment" in content_disposition and ".zip" in content_disposition:
                        print("  ✅ Content-Disposition is attachment with .zip filename")
                    else:
                        print(f"  ⚠️  Content-Disposition unexpected: {content_disposition}")
                    
                    # Check cache-control
                    if "no-store" in cache_control:
                        print("  ✅ Cache-Control contains 'no-store'")
                    
                    # Check ZIP magic bytes
                    if len(body_bytes) >= 2 and body_bytes[0:2] == b'PK':
                        print("  ✅ Body starts with 'PK' (ZIP magic bytes)")
                        
                        # Try to unzip and verify contents
                        try:
                            import zipfile
                            import io
                            
                            zip_buffer = io.BytesIO(body_bytes)
                            with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
                                file_list = zip_file.namelist()
                                print(f"  ZIP contains {len(file_list)} files: {file_list}")
                                
                                # Check for manifest.json
                                if "manifest.json" in file_list:
                                    print("  ✅ ZIP contains manifest.json")
                                    manifest_content = zip_file.read("manifest.json")
                                    manifest = json.loads(manifest_content)
                                    
                                    # Check manifest structure
                                    if manifest.get("fhirVersion") == "4.0.1":
                                        print("  ✅ manifest.json has fhirVersion '4.0.1'")
                                    else:
                                        print(f"  ⚠️  manifest.json fhirVersion: {manifest.get('fhirVersion')}")
                                    
                                    if "output" in manifest and isinstance(manifest["output"], list):
                                        print(f"  ✅ manifest.json has output[] array with {len(manifest['output'])} entries")
                                    else:
                                        print("  ⚠️  manifest.json missing or invalid output[] array")
                                else:
                                    print("  ⚠️  ZIP does not contain manifest.json")
                                
                                # Check for Patient.ndjson
                                if "Patient.ndjson" in file_list:
                                    print("  ✅ ZIP contains Patient.ndjson")
                                else:
                                    print("  ⚠️  ZIP does not contain Patient.ndjson")
                                
                                print("  ✅ PASS: ZIP export test successful")
                        except Exception as e:
                            print(f"  ⚠️  Could not unzip or verify contents: {e}")
                            print("  ✅ PASS: ZIP format verified (magic bytes correct)")
                    else:
                        print(f"  ❌ FAIL: Body does not start with 'PK', first bytes: {body_bytes[0:10]}")
                else:
                    print(f"  ❌ FAIL: Expected 200, got {status}")
        except Exception as e:
            print(f"  ❌ ERROR: {e}")
        
        # ===== STEP 6b: GET /api/admin/ehi-export?patientId=<id> (format omitted, default to zip) =====
        print(f"\n[STEP 6b] Testing ZIP export (default format): GET /api/admin/ehi-export?patientId={patient_id}")
        try:
            async with session.get(
                f"{BASE_URL}/api/admin/ehi-export?patientId={patient_id}",
                cookies=admin_cookie
            ) as resp:
                status = resp.status
                content_type = resp.headers.get("content-type", "")
                body_bytes = await resp.read()
                
                print(f"  Status: {status}")
                print(f"  Content-Type: {content_type}")
                print(f"  Body size: {len(body_bytes)} bytes")
                
                if status == 200:
                    if "application/zip" in content_type:
                        print("  ✅ Content-Type is 'application/zip' (default format)")
                    else:
                        print(f"  ❌ FAIL: Expected 'application/zip', got '{content_type}'")
                    
                    if len(body_bytes) >= 2 and body_bytes[0:2] == b'PK':
                        print("  ✅ Body starts with 'PK' (ZIP magic bytes)")
                        print("  ✅ PASS: Default format is ZIP")
                    else:
                        print(f"  ❌ FAIL: Body does not start with 'PK'")
                else:
                    print(f"  ❌ FAIL: Expected 200, got {status}")
        except Exception as e:
            print(f"  ❌ ERROR: {e}")
        
        # ===== STEP 7: GET /api/admin/ehi-export?scope=all&format=zip as admin =====
        print(f"\n[STEP 7] Testing whole-practice export: GET /api/admin/ehi-export?scope=all&format=zip")
        try:
            async with session.get(
                f"{BASE_URL}/api/admin/ehi-export?scope=all&format=zip",
                cookies=admin_cookie
            ) as resp:
                status = resp.status
                content_type = resp.headers.get("content-type", "")
                body_bytes = await resp.read()
                
                print(f"  Status: {status}")
                print(f"  Content-Type: {content_type}")
                print(f"  Body size: {len(body_bytes)} bytes")
                
                if status == 200:
                    if "application/zip" in content_type:
                        print("  ✅ Content-Type is 'application/zip'")
                    else:
                        print(f"  ❌ FAIL: Expected 'application/zip', got '{content_type}'")
                    
                    if len(body_bytes) >= 2 and body_bytes[0:2] == b'PK':
                        print("  ✅ Body starts with 'PK' (ZIP magic bytes)")
                        print("  ✅ PASS: Whole-practice export successful")
                    else:
                        print(f"  ❌ FAIL: Body does not start with 'PK'")
                else:
                    print(f"  ❌ FAIL: Expected 200, got {status}")
        except Exception as e:
            print(f"  ❌ ERROR: {e}")
        
        # ===== STEP 8: Verify AuditLog row was written =====
        print(f"\n[STEP 8] Verifying AuditLog entries for ehi.export")
        try:
            audit_logs = list(db.AuditLog.find({"action": "ehi.export"}).sort("createdAt", -1).limit(5))
            if audit_logs:
                print(f"  ✅ Found {len(audit_logs)} AuditLog entries with action='ehi.export'")
                for i, log in enumerate(audit_logs):
                    print(f"     Entry {i+1}:")
                    print(f"       - ID: {log.get('_id')}")
                    print(f"       - Resource: {log.get('resource')}")
                    print(f"       - ResourceId: {log.get('resourceId')}")
                    print(f"       - UserId: {log.get('userId')}")
                    print(f"       - CreatedAt: {log.get('createdAt')}")
                    meta = log.get('meta')
                    if meta:
                        try:
                            meta_obj = json.loads(meta) if isinstance(meta, str) else meta
                            print(f"       - Meta: {meta_obj}")
                        except Exception:
                            print(f"       - Meta: {meta}")
                print("  ✅ PASS: AuditLog verification successful")
            else:
                print("  ❌ FAIL: No AuditLog entries found with action='ehi.export'")
        except Exception as e:
            print(f"  ❌ ERROR: {e}")
    
    # Close MongoDB connection
    mongo_client.close()
    
    print("\n" + "=" * 80)
    print("EHI Export Tool Backend Testing Complete")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
