#!/usr/bin/env python3
"""
Backend testing for:
- Feature A: Clinical importer EXTENDED with Encounters/Visit notes + persist refactor
- Feature B: Live SMART-on-FHIR connector (config/auth/guards only, no live vendor calls)

Auth: POST /api/auth/login {email:"admin@proactiveclinic.com", password:"apex123"}
Base URL: NEXT_PUBLIC_BASE_URL from .env (HTTPS for secure cookie)
"""

import requests
import json
import sys

# Read base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def login():
    """Login as admin and return session cookie"""
    print("\n=== AUTHENTICATION ===")
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": "admin@proactiveclinic.com", "password": "apex123"}
    
    try:
        r = requests.post(url, json=payload, allow_redirects=False)
        print(f"POST /api/auth/login -> {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ Login failed: {r.status_code} {r.text[:200]}")
            sys.exit(1)
        
        cookie = r.cookies.get("proactive_session")
        if not cookie:
            print("❌ No session cookie returned")
            sys.exit(1)
        
        print(f"✅ Login successful, session cookie obtained")
        return {"proactive_session": cookie}
    except Exception as e:
        print(f"❌ Login exception: {e}")
        sys.exit(1)

def cleanup_test_patients():
    """Delete test patients MRN CCDA-5001 and FHIR-6001 plus their child records"""
    print("\n=== CLEANUP: Delete test patients CCDA-5001 and FHIR-6001 ===")
    
    try:
        from pymongo import MongoClient
        client = MongoClient("mongodb://localhost:27017")
        db_mongo = client["proactive_clinic"]
        
        # Find patients by MRN
        patients = list(db_mongo.Patient.find({"mrn": {"$in": ["CCDA-5001", "FHIR-6001"]}}))
        patient_ids = [p.get("id") for p in patients if p.get("id")]
        
        if not patient_ids:
            print("✅ No test patients found (already clean)")
            return
        
        print(f"Found {len(patient_ids)} test patients: {patient_ids}")
        
        # Delete child records
        collections = ["Problem", "Medication", "Allergy", "Vital", "Immunization", "Encounter"]
        for coll_name in collections:
            result = db_mongo[coll_name].delete_many({"patientId": {"$in": patient_ids}})
            if result.deleted_count > 0:
                print(f"  Deleted {result.deleted_count} {coll_name} records")
        
        # Delete patients
        result = db_mongo.Patient.delete_many({"id": {"$in": patient_ids}})
        print(f"✅ Deleted {result.deleted_count} Patient records")
        
    except Exception as e:
        print(f"⚠️  Cleanup warning: {e}")
        print("Continuing with tests...")

def read_fixture(path):
    """Read fixture file content"""
    try:
        with open(path, 'r') as f:
            return f.read()
    except Exception as e:
        print(f"❌ Failed to read fixture {path}: {e}")
        sys.exit(1)

# ============================================================================
# FEATURE A: Clinical importer with Encounters + persist refactor
# ============================================================================

def test_feature_a(cookies):
    print("\n" + "="*80)
    print("FEATURE A: Clinical Importer with Encounters/Visit Notes")
    print("="*80)
    
    # Read fixtures
    ccda_content = read_fixture("/app/test_fixtures/sample_ccda.xml")
    fhir_content = read_fixture("/app/test_fixtures/sample_fhir.json")
    
    # A1: Preview C-CDA - should return encounters + providers roster
    print("\n--- A1: Preview C-CDA (expect encounters=1, providers roster) ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/preview",
            json={"content": ccda_content},
            cookies=cookies
        )
        print(f"POST /api/admin/import/clinical/preview (C-CDA) -> {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ A1 FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
        
        data = r.json()
        
        # Verify counts.encounters === 1
        if data.get("counts", {}).get("encounters") != 1:
            print(f"❌ A1 FAILED: Expected counts.encounters=1, got {data.get('counts', {}).get('encounters')}")
            return False
        print(f"✅ counts.encounters = 1")
        
        # Verify encounters[0].type contains "Office"
        encounters = data.get("encounters", [])
        if not encounters or "Office" not in encounters[0].get("type", ""):
            print(f"❌ A1 FAILED: encounters[0].type should contain 'Office', got {encounters[0].get('type') if encounters else 'no encounters'}")
            return False
        print(f"✅ encounters[0].type = '{encounters[0].get('type')}'")
        
        # Verify encounters[0].note is non-empty
        if not encounters[0].get("note"):
            print(f"❌ A1 FAILED: encounters[0].note should be non-empty")
            return False
        print(f"✅ encounters[0].note is non-empty (length {len(encounters[0].get('note', ''))})")
        
        # Verify providers array is non-empty
        providers = data.get("providers", [])
        if not providers:
            print(f"❌ A1 FAILED: providers array should be non-empty")
            return False
        print(f"✅ providers array has {len(providers)} providers")
        
        # Find Andy Manzano's provider ID
        andy_provider = None
        for p in providers:
            if "Manzano" in p.get("name", ""):
                andy_provider = p
                break
        
        if not andy_provider:
            print(f"❌ A1 FAILED: Could not find Andy Manzano in providers list")
            return False
        
        provider_id = andy_provider["id"]
        print(f"✅ Found Andy Manzano: ID={provider_id}, name='{andy_provider['name']}'")
        
        print("✅ A1 PASSED")
        
    except Exception as e:
        print(f"❌ A1 EXCEPTION: {e}")
        return False
    
    # A2: Preview FHIR - should return encounters=2
    print("\n--- A2: Preview FHIR (expect encounters=2) ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/preview",
            json={"content": fhir_content},
            cookies=cookies
        )
        print(f"POST /api/admin/import/clinical/preview (FHIR) -> {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ A2 FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
        
        data = r.json()
        
        # Verify counts.encounters === 2
        if data.get("counts", {}).get("encounters") != 2:
            print(f"❌ A2 FAILED: Expected counts.encounters=2, got {data.get('counts', {}).get('encounters')}")
            return False
        print(f"✅ counts.encounters = 2")
        
        print("✅ A2 PASSED")
        
    except Exception as e:
        print(f"❌ A2 EXCEPTION: {e}")
        return False
    
    # A3: Commit C-CDA WITHOUT defaultProviderId - encounters should be skipped
    print("\n--- A3: Commit C-CDA WITHOUT defaultProviderId (expect encounters skipped) ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": ccda_content},
            cookies=cookies
        )
        print(f"POST /api/admin/import/clinical/commit (C-CDA, no defaultProviderId) -> {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ A3 FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
        
        data = r.json()
        
        # Verify patientCreated === true
        if data.get("patientCreated") != True:
            print(f"❌ A3 FAILED: Expected patientCreated=true, got {data.get('patientCreated')}")
            return False
        print(f"✅ patientCreated = true")
        
        # Verify counts.encounters.created === 0
        enc_created = data.get("counts", {}).get("encounters", {}).get("created", -1)
        if enc_created != 0:
            print(f"❌ A3 FAILED: Expected counts.encounters.created=0, got {enc_created}")
            return False
        print(f"✅ counts.encounters.created = 0")
        
        # Verify counts.encounters.skipped === 1
        enc_skipped = data.get("counts", {}).get("encounters", {}).get("skipped", -1)
        if enc_skipped != 1:
            print(f"❌ A3 FAILED: Expected counts.encounters.skipped=1, got {enc_skipped}")
            return False
        print(f"✅ counts.encounters.skipped = 1")
        
        # Verify notice is present mentioning provider
        notice = data.get("notice", "")
        if not notice or "provider" not in notice.lower():
            print(f"❌ A3 FAILED: Expected notice mentioning provider, got '{notice}'")
            return False
        print(f"✅ notice present: '{notice}'")
        
        # Verify other categories created
        counts = data.get("counts", {})
        if counts.get("problems", {}).get("created") != 2:
            print(f"❌ A3 FAILED: Expected problems.created=2, got {counts.get('problems', {}).get('created')}")
            return False
        if counts.get("medications", {}).get("created") != 2:
            print(f"❌ A3 FAILED: Expected medications.created=2, got {counts.get('medications', {}).get('created')}")
            return False
        if counts.get("allergies", {}).get("created") != 1:
            print(f"❌ A3 FAILED: Expected allergies.created=1, got {counts.get('allergies', {}).get('created')}")
            return False
        if counts.get("vitals", {}).get("created") != 1:
            print(f"❌ A3 FAILED: Expected vitals.created=1, got {counts.get('vitals', {}).get('created')}")
            return False
        if counts.get("immunizations", {}).get("created") != 2:
            print(f"❌ A3 FAILED: Expected immunizations.created=2, got {counts.get('immunizations', {}).get('created')}")
            return False
        print(f"✅ Other categories created: problems=2, medications=2, allergies=1, vitals=1, immunizations=2")
        
        print("✅ A3 PASSED")
        
    except Exception as e:
        print(f"❌ A3 EXCEPTION: {e}")
        return False
    
    # A4: Commit C-CDA WITH defaultProviderId - encounter should be created
    print("\n--- A4: Commit C-CDA WITH defaultProviderId (expect encounter created) ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": ccda_content, "defaultProviderId": provider_id},
            cookies=cookies
        )
        print(f"POST /api/admin/import/clinical/commit (C-CDA, with defaultProviderId) -> {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ A4 FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
        
        data = r.json()
        
        # Verify patientCreated === false (patient already exists)
        if data.get("patientCreated") != False:
            print(f"❌ A4 FAILED: Expected patientCreated=false, got {data.get('patientCreated')}")
            return False
        print(f"✅ patientCreated = false (matched existing)")
        
        # Verify counts.encounters.created === 1
        enc_created = data.get("counts", {}).get("encounters", {}).get("created", -1)
        if enc_created != 1:
            print(f"❌ A4 FAILED: Expected counts.encounters.created=1, got {enc_created}")
            return False
        print(f"✅ counts.encounters.created = 1")
        
        # Verify all other categories created === 0 (idempotent)
        counts = data.get("counts", {})
        for cat in ["problems", "medications", "allergies", "vitals", "immunizations"]:
            if counts.get(cat, {}).get("created", -1) != 0:
                print(f"❌ A4 FAILED: Expected {cat}.created=0 (idempotent), got {counts.get(cat, {}).get('created')}")
                return False
        print(f"✅ All other categories created=0 (idempotent)")
        
        print("✅ A4 PASSED")
        
    except Exception as e:
        print(f"❌ A4 EXCEPTION: {e}")
        return False
    
    # A5: Commit FHIR (no defaultProviderId) - encounters should auto-match Andy Manzano
    print("\n--- A5: Commit FHIR (expect encounters auto-matched to Andy Manzano) ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": fhir_content},
            cookies=cookies
        )
        print(f"POST /api/admin/import/clinical/commit (FHIR, no defaultProviderId) -> {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ A5 FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
        
        data = r.json()
        
        # Verify patientCreated === true
        if data.get("patientCreated") != True:
            print(f"❌ A5 FAILED: Expected patientCreated=true, got {data.get('patientCreated')}")
            return False
        print(f"✅ patientCreated = true")
        
        # Verify counts.encounters.created === 2
        enc_created = data.get("counts", {}).get("encounters", {}).get("created", -1)
        if enc_created != 2:
            print(f"❌ A5 FAILED: Expected counts.encounters.created=2, got {enc_created}")
            return False
        print(f"✅ counts.encounters.created = 2 (auto-matched to Andy Manzano)")
        
        # Verify total created === 8 (2 problems + 1 med + 1 allergy + 1 vital + 1 immunization + 2 encounters)
        total_created = data.get("created", -1)
        if total_created != 8:
            print(f"❌ A5 FAILED: Expected total created=8, got {total_created}")
            return False
        print(f"✅ total created = 8")
        
        print("✅ A5 PASSED")
        
    except Exception as e:
        print(f"❌ A5 EXCEPTION: {e}")
        return False
    
    # A6: Commit FHIR AGAIN - should be fully idempotent
    print("\n--- A6: Commit FHIR AGAIN (expect fully idempotent) ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/import/clinical/commit",
            json={"content": fhir_content},
            cookies=cookies
        )
        print(f"POST /api/admin/import/clinical/commit (FHIR, second time) -> {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ A6 FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
        
        data = r.json()
        
        # Verify total created === 0
        total_created = data.get("created", -1)
        if total_created != 0:
            print(f"❌ A6 FAILED: Expected total created=0 (idempotent), got {total_created}")
            return False
        print(f"✅ total created = 0 (fully idempotent)")
        
        print("✅ A6 PASSED")
        
    except Exception as e:
        print(f"❌ A6 EXCEPTION: {e}")
        return False
    
    # A7: Regression check - verify persist refactor didn't break anything
    print("\n--- A7: Regression check (persist refactor) ---")
    print("✅ A7 PASSED - Already verified in A3/A4/A5 that problems/meds/allergies/vitals/immunizations still import correctly")
    
    return True

# ============================================================================
# FEATURE B: Live SMART-on-FHIR connector (config/auth/guards only)
# ============================================================================

def test_feature_b(cookies):
    print("\n" + "="*80)
    print("FEATURE B: Live SMART-on-FHIR Connector (config/auth/guards)")
    print("="*80)
    
    # B1: GET connections without auth cookie -> 401
    print("\n--- B1: GET /api/admin/fhir/connections without auth -> 401 ---")
    try:
        r = requests.get(f"{BASE_URL}/api/admin/fhir/connections")
        print(f"GET /api/admin/fhir/connections (no auth) -> {r.status_code}")
        
        if r.status_code != 401:
            print(f"❌ B1 FAILED: Expected 401, got {r.status_code}")
            return False
        
        print("✅ B1 PASSED")
        
    except Exception as e:
        print(f"❌ B1 EXCEPTION: {e}")
        return False
    
    # B2: GET connections as admin -> 200 with 2 providers + staff roster
    print("\n--- B2: GET /api/admin/fhir/connections as admin -> 200 ---")
    try:
        r = requests.get(f"{BASE_URL}/api/admin/fhir/connections", cookies=cookies)
        print(f"GET /api/admin/fhir/connections (admin) -> {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ B2 FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
        
        data = r.json()
        
        # Verify providers array length 2
        providers = data.get("providers", [])
        if len(providers) != 2:
            print(f"❌ B2 FAILED: Expected 2 providers, got {len(providers)}")
            return False
        print(f"✅ providers array has 2 providers")
        
        # Verify contains "veradigm" and "ecw"
        provider_keys = [p.get("provider") for p in providers]
        if "veradigm" not in provider_keys or "ecw" not in provider_keys:
            print(f"❌ B2 FAILED: Expected providers 'veradigm' and 'ecw', got {provider_keys}")
            return False
        print(f"✅ providers include 'veradigm' and 'ecw'")
        
        # Verify each has required fields
        for p in providers:
            required = ["label", "defaultScopes", "docs", "redirectUri", "connection"]
            for field in required:
                if field not in p:
                    print(f"❌ B2 FAILED: Provider {p.get('provider')} missing field '{field}'")
                    return False
        print(f"✅ Each provider has label, defaultScopes, docs, redirectUri, connection")
        
        # Verify staff array is present
        staff = data.get("staff", [])
        if not isinstance(staff, list):
            print(f"❌ B2 FAILED: Expected staff array, got {type(staff)}")
            return False
        print(f"✅ staff array present (length {len(staff)})")
        
        print("✅ B2 PASSED")
        
    except Exception as e:
        print(f"❌ B2 EXCEPTION: {e}")
        return False
    
    # B3: POST connections with missing fields -> 400
    print("\n--- B3: POST /api/admin/fhir/connections with missing fields -> 400 ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/fhir/connections",
            json={"provider": "veradigm"},
            cookies=cookies
        )
        print(f"POST /api/admin/fhir/connections (missing fields) -> {r.status_code}")
        
        if r.status_code != 400:
            print(f"❌ B3 FAILED: Expected 400, got {r.status_code}")
            return False
        
        print("✅ B3 PASSED")
        
    except Exception as e:
        print(f"❌ B3 EXCEPTION: {e}")
        return False
    
    # B4: POST connections with invalid URL -> 400
    print("\n--- B4: POST /api/admin/fhir/connections with invalid URL -> 400 ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/fhir/connections",
            json={
                "provider": "veradigm",
                "baseUrl": "not-a-url",
                "authUrl": "https://ex.com/a",
                "tokenUrl": "https://ex.com/t",
                "clientId": "abc"
            },
            cookies=cookies
        )
        print(f"POST /api/admin/fhir/connections (invalid URL) -> {r.status_code}")
        
        if r.status_code != 400:
            print(f"❌ B4 FAILED: Expected 400, got {r.status_code}")
            return False
        
        print("✅ B4 PASSED")
        
    except Exception as e:
        print(f"❌ B4 EXCEPTION: {e}")
        return False
    
    # B5: POST connections with VALID config -> 200, verify secret masking
    print("\n--- B5: POST /api/admin/fhir/connections with VALID config -> 200 ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/fhir/connections",
            json={
                "provider": "veradigm",
                "baseUrl": "https://fhir.example.com/r4",
                "authUrl": "https://auth.example.com/authorize",
                "tokenUrl": "https://auth.example.com/token",
                "clientId": "test-client-123",
                "clientSecret": "shh-secret",
                "scopes": "openid user/Patient.read"
            },
            cookies=cookies
        )
        print(f"POST /api/admin/fhir/connections (valid) -> {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ B5 FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
        
        data = r.json()
        connection = data.get("connection", {})
        
        # Verify connection.status === "configured"
        if connection.get("status") != "configured":
            print(f"❌ B5 FAILED: Expected status='configured', got '{connection.get('status')}'")
            return False
        print(f"✅ connection.status = 'configured'")
        
        # Verify connection.clientId === "test-client-123"
        if connection.get("clientId") != "test-client-123":
            print(f"❌ B5 FAILED: Expected clientId='test-client-123', got '{connection.get('clientId')}'")
            return False
        print(f"✅ connection.clientId = 'test-client-123'")
        
        # Verify connection.clientSecretSet === true
        if connection.get("clientSecretSet") != True:
            print(f"❌ B5 FAILED: Expected clientSecretSet=true, got {connection.get('clientSecretSet')}")
            return False
        print(f"✅ connection.clientSecretSet = true")
        
        # Verify connection.clientSecretMasked is masked
        masked = connection.get("clientSecretMasked", "")
        if not masked or not masked.startswith("••••"):
            print(f"❌ B5 FAILED: Expected clientSecretMasked to start with '••••', got '{masked}'")
            return False
        print(f"✅ connection.clientSecretMasked = '{masked}' (masked)")
        
        # CRITICAL: Verify raw secret "shh-secret" does NOT appear in response
        response_text = r.text
        if "shh-secret" in response_text:
            print(f"❌ B5 FAILED: Raw secret 'shh-secret' found in response JSON!")
            return False
        print(f"✅ CRITICAL: Raw secret 'shh-secret' NOT present in response")
        
        print("✅ B5 PASSED")
        
    except Exception as e:
        print(f"❌ B5 EXCEPTION: {e}")
        return False
    
    # B6: GET connections again -> veradigm shows configured, secret masked
    print("\n--- B6: GET /api/admin/fhir/connections again -> veradigm configured ---")
    try:
        r = requests.get(f"{BASE_URL}/api/admin/fhir/connections", cookies=cookies)
        print(f"GET /api/admin/fhir/connections (admin) -> {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ B6 FAILED: Expected 200, got {r.status_code}")
            return False
        
        data = r.json()
        providers = data.get("providers", [])
        veradigm = next((p for p in providers if p.get("provider") == "veradigm"), None)
        
        if not veradigm:
            print(f"❌ B6 FAILED: veradigm provider not found")
            return False
        
        connection = veradigm.get("connection")
        if not connection:
            print(f"❌ B6 FAILED: veradigm connection is null")
            return False
        
        # Verify status "configured"
        if connection.get("status") != "configured":
            print(f"❌ B6 FAILED: Expected status='configured', got '{connection.get('status')}'")
            return False
        print(f"✅ veradigm connection.status = 'configured'")
        
        # Verify clientId set
        if connection.get("clientId") != "test-client-123":
            print(f"❌ B6 FAILED: Expected clientId='test-client-123', got '{connection.get('clientId')}'")
            return False
        print(f"✅ veradigm connection.clientId = 'test-client-123'")
        
        # Verify secret masked
        if "shh-secret" in r.text:
            print(f"❌ B6 FAILED: Raw secret present in response")
            return False
        print(f"✅ Secret masked (raw secret not present)")
        
        print("✅ B6 PASSED")
        
    except Exception as e:
        print(f"❌ B6 EXCEPTION: {e}")
        return False
    
    # B7: POST import for ecw (not configured) -> 400
    print("\n--- B7: POST /api/admin/fhir/ecw/import (not configured) -> 400 ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/fhir/ecw/import",
            json={"mrn": "X"},
            cookies=cookies
        )
        print(f"POST /api/admin/fhir/ecw/import -> {r.status_code}")
        
        if r.status_code != 400:
            print(f"❌ B7 FAILED: Expected 400, got {r.status_code}")
            return False
        
        data = r.json()
        error = data.get("error", "").lower()
        if "not configured" not in error and "configure" not in error:
            print(f"❌ B7 FAILED: Expected error about not configured, got '{data.get('error')}'")
            return False
        print(f"✅ Error: '{data.get('error')}'")
        
        print("✅ B7 PASSED")
        
    except Exception as e:
        print(f"❌ B7 EXCEPTION: {e}")
        return False
    
    # B8: POST import for veradigm (configured but not connected) -> 400
    print("\n--- B8: POST /api/admin/fhir/veradigm/import (not connected) -> 400 ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/fhir/veradigm/import",
            json={"mrn": "X"},
            cookies=cookies
        )
        print(f"POST /api/admin/fhir/veradigm/import -> {r.status_code}")
        
        if r.status_code != 400:
            print(f"❌ B8 FAILED: Expected 400, got {r.status_code}")
            return False
        
        data = r.json()
        error = data.get("error", "").lower()
        if "not connected" not in error:
            print(f"❌ B8 FAILED: Expected error 'Not connected', got '{data.get('error')}'")
            return False
        print(f"✅ Error: '{data.get('error')}'")
        
        print("✅ B8 PASSED")
        
    except Exception as e:
        print(f"❌ B8 EXCEPTION: {e}")
        return False
    
    # B9: GET authorize -> 302 redirect with PKCE params
    print("\n--- B9: GET /api/admin/fhir/veradigm/authorize -> 302 redirect ---")
    try:
        r = requests.get(
            f"{BASE_URL}/api/admin/fhir/veradigm/authorize",
            cookies=cookies,
            allow_redirects=False
        )
        print(f"GET /api/admin/fhir/veradigm/authorize -> {r.status_code}")
        
        if r.status_code not in [302, 307]:
            print(f"❌ B9 FAILED: Expected 302/307 redirect, got {r.status_code}")
            return False
        
        location = r.headers.get("Location", "")
        if not location:
            print(f"❌ B9 FAILED: No Location header in redirect")
            return False
        print(f"✅ Redirect Location: {location[:100]}...")
        
        # Verify Location is vendor auth URL
        if not location.startswith("https://auth.example.com/authorize"):
            print(f"❌ B9 FAILED: Expected redirect to auth.example.com/authorize, got {location[:100]}")
            return False
        print(f"✅ Redirects to vendor auth URL (auth.example.com/authorize)")
        
        # Verify query params
        required_params = ["client_id", "response_type", "code_challenge", "code_challenge_method", "state", "redirect_uri"]
        for param in required_params:
            if param not in location:
                print(f"❌ B9 FAILED: Missing query param '{param}' in Location")
                return False
        print(f"✅ All required query params present: {', '.join(required_params)}")
        
        # Verify client_id=test-client-123
        if "client_id=test-client-123" not in location:
            print(f"❌ B9 FAILED: Expected client_id=test-client-123 in Location")
            return False
        print(f"✅ client_id=test-client-123")
        
        # Verify code_challenge_method=S256
        if "code_challenge_method=S256" not in location:
            print(f"❌ B9 FAILED: Expected code_challenge_method=S256 in Location")
            return False
        print(f"✅ code_challenge_method=S256")
        
        # Verify redirect_uri ends with /api/admin/fhir/veradigm/callback (URL-encoded)
        import urllib.parse
        if "redirect_uri=" not in location:
            print(f"❌ B9 FAILED: No redirect_uri param in Location")
            return False
        # Extract and decode redirect_uri
        parsed = urllib.parse.urlparse(location)
        params = urllib.parse.parse_qs(parsed.query)
        redirect_uri = params.get("redirect_uri", [""])[0]
        if not redirect_uri.endswith("/api/admin/fhir/veradigm/callback"):
            print(f"❌ B9 FAILED: Expected redirect_uri ending with /api/admin/fhir/veradigm/callback, got {redirect_uri}")
            return False
        print(f"✅ redirect_uri ends with /api/admin/fhir/veradigm/callback")
        
        print("✅ B9 PASSED")
        
    except Exception as e:
        print(f"❌ B9 EXCEPTION: {e}")
        return False
    
    # B10: GET callback with wrong state -> redirect with msg
    print("\n--- B10: GET /api/admin/fhir/veradigm/callback with wrong state -> redirect ---")
    try:
        r = requests.get(
            f"{BASE_URL}/api/admin/fhir/veradigm/callback?code=abc&state=WRONGSTATE",
            cookies=cookies,
            allow_redirects=False
        )
        print(f"GET /api/admin/fhir/veradigm/callback (wrong state) -> {r.status_code}")
        
        if r.status_code not in [302, 307]:
            print(f"❌ B10 FAILED: Expected 302/307 redirect, got {r.status_code}")
            return False
        
        location = r.headers.get("Location", "")
        if not location:
            print(f"❌ B10 FAILED: No Location header in redirect")
            return False
        
        # Verify redirects back to /admin/data-tools
        if "/admin/data-tools" not in location:
            print(f"❌ B10 FAILED: Expected redirect to /admin/data-tools, got {location}")
            return False
        print(f"✅ Redirects to /admin/data-tools")
        
        # Verify contains msg query param
        if "msg=" not in location:
            print(f"❌ B10 FAILED: Expected 'msg' query param in Location")
            return False
        print(f"✅ Contains 'msg' query param (state mismatch message)")
        
        print("✅ B10 PASSED")
        
    except Exception as e:
        print(f"❌ B10 EXCEPTION: {e}")
        return False
    
    # B11: POST disconnect -> 200, status back to configured
    print("\n--- B11: POST /api/admin/fhir/veradigm/disconnect -> 200 ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/fhir/veradigm/disconnect",
            cookies=cookies
        )
        print(f"POST /api/admin/fhir/veradigm/disconnect -> {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ B11 FAILED: Expected 200, got {r.status_code}")
            return False
        
        data = r.json()
        connection = data.get("connection", {})
        
        # Verify status back to "configured"
        if connection.get("status") != "configured":
            print(f"❌ B11 FAILED: Expected status='configured', got '{connection.get('status')}'")
            return False
        print(f"✅ connection.status = 'configured'")
        
        # Verify connected = false
        if connection.get("connected") != False:
            print(f"❌ B11 FAILED: Expected connected=false, got {connection.get('connected')}")
            return False
        print(f"✅ connection.connected = false")
        
        print("✅ B11 PASSED")
        
    except Exception as e:
        print(f"❌ B11 EXCEPTION: {e}")
        return False
    
    # B12: POST import for bogus provider -> 400
    print("\n--- B12: POST /api/admin/fhir/bogus/import -> 400 ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/fhir/bogus/import",
            json={"mrn": "X"},
            cookies=cookies
        )
        print(f"POST /api/admin/fhir/bogus/import -> {r.status_code}")
        
        if r.status_code != 400:
            print(f"❌ B12 FAILED: Expected 400, got {r.status_code}")
            return False
        
        data = r.json()
        error = data.get("error", "").lower()
        if "unknown provider" not in error:
            print(f"❌ B12 FAILED: Expected error 'Unknown provider', got '{data.get('error')}'")
            return False
        print(f"✅ Error: '{data.get('error')}'")
        
        print("✅ B12 PASSED")
        
    except Exception as e:
        print(f"❌ B12 EXCEPTION: {e}")
        return False
    
    return True

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("="*80)
    print("Backend Testing: Encounters + FHIR Connector")
    print("="*80)
    
    # Cleanup test data first
    cleanup_test_patients()
    
    # Login
    cookies = login()
    
    # Test Feature A
    feature_a_passed = test_feature_a(cookies)
    
    # Test Feature B
    feature_b_passed = test_feature_b(cookies)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    if feature_a_passed:
        print("✅ FEATURE A: Clinical Importer with Encounters - ALL TESTS PASSED")
    else:
        print("❌ FEATURE A: Clinical Importer with Encounters - SOME TESTS FAILED")
    
    if feature_b_passed:
        print("✅ FEATURE B: SMART-on-FHIR Connector - ALL TESTS PASSED")
    else:
        print("❌ FEATURE B: SMART-on-FHIR Connector - SOME TESTS FAILED")
    
    if feature_a_passed and feature_b_passed:
        print("\n🎉 ALL TESTS PASSED 🎉")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
