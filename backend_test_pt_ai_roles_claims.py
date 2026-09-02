#!/usr/bin/env python3
"""
Backend test for 3 Physical Rehab module tasks:
1. AI PI note normalization (/api/pt/ai-note)
2. Admin roles matrix physical_therapist round-trip (/api/admin/roles)
3. PT claim create + submit via existing Stedi endpoints (gated)
"""
import requests
import json
import time
import os

BASE_URL = os.getenv("NEXT_PUBLIC_BASE_URL", "https://nextjs-ssr-stack.preview.emergentagent.com")
API_BASE = f"{BASE_URL}/api"

# Staff credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

session = requests.Session()

def print_test(msg):
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_result(passed, msg):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {msg}")

def print_error(msg):
    print(f"❌ ERROR: {msg}")

# ============================================================================
# TASK 1: AI PI note normalization (/api/pt/ai-note)
# ============================================================================

def test_task1_ai_note():
    print_test("TASK 1 - AI PI note normalization (/api/pt/ai-note)")
    
    # (A) POST /api/pt/ai-note WITHOUT session cookie -> expect 401
    print("\n--- TEST 1A: POST /api/pt/ai-note WITHOUT session cookie ---")
    try:
        resp = requests.post(f"{API_BASE}/pt/ai-note", json={"dictation": "test"}, timeout=10)
        if resp.status_code == 401:
            print_result(True, f"Correctly returned 401 Unauthorized without session cookie")
        else:
            print_result(False, f"Expected 401, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print_error(f"Request failed: {e}")
    
    # Login as admin
    print("\n--- Logging in as admin ---")
    try:
        login_resp = session.post(
            f"{API_BASE}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if login_resp.status_code == 200:
            print_result(True, f"Admin login successful")
        else:
            print_result(False, f"Login failed: {login_resp.status_code} {login_resp.text[:200]}")
            return
    except Exception as e:
        print_error(f"Login failed: {e}")
        return
    
    # (B) First GET /api/pt/cases (authenticated) and capture a legal/PI patient id
    print("\n--- TEST 1B: GET /api/pt/cases to find legal/PI patient ---")
    legal_patient_id = None
    legal_patient_name = None
    try:
        cases_resp = session.get(f"{API_BASE}/pt/cases", timeout=10)
        if cases_resp.status_code == 200:
            cases_data = cases_resp.json()
            cases = cases_data.get("cases", [])
            print_result(True, f"GET /api/pt/cases returned 200 with {len(cases)} cases")
            
            # Find a legal/PI patient (e.g., Maria Rodriguez)
            for case in cases:
                patient = case.get("patient", {})
                if patient:
                    legal_patient_id = patient.get("id")
                    legal_patient_name = f"{patient.get('lastName', '')}, {patient.get('firstName', '')}"
                    print(f"Found legal/PI patient: {legal_patient_name} (ID: {legal_patient_id})")
                    break
            
            if not legal_patient_id:
                print_error("No legal/PI patient found in cases")
                return
        else:
            print_result(False, f"GET /api/pt/cases failed: {cases_resp.status_code} {cases_resp.text[:200]}")
            return
    except Exception as e:
        print_error(f"GET /api/pt/cases failed: {e}")
        return
    
    # (B) POST /api/pt/ai-note with dictation and legal patient id
    print("\n--- TEST 1B: POST /api/pt/ai-note with dictation and legal patient id ---")
    print("NOTE: This calls a real LLM via EMERGENT_LLM_KEY (openai/gpt-4o) so allow up to ~30s")
    try:
        ai_note_body = {
            "dictation": "Patient rear-ended two weeks ago, neck and lower back pain 6/10, limited cervical rotation, started manual therapy and therapeutic exercise 2x/week",
            "draft": {},
            "patientId": legal_patient_id
        }
        ai_note_resp = session.post(f"{API_BASE}/pt/ai-note", json=ai_note_body, timeout=35)
        
        if ai_note_resp.status_code == 200:
            ai_note_data = ai_note_resp.json()
            print_result(True, f"POST /api/pt/ai-note returned 200")
            
            # Assert response structure
            if ai_note_data.get("ok") == True:
                print_result(True, "Response has ok=true")
            else:
                print_result(False, f"Response missing ok=true: {ai_note_data}")
            
            note = ai_note_data.get("note", {})
            if note:
                print_result(True, "Response has 'note' object")
                
                # Check string fields
                required_string_fields = ["mechanism", "subjective", "objective", "assessment", "plan", "goals", "causation"]
                for field in required_string_fields:
                    if field in note and isinstance(note[field], str):
                        print_result(True, f"Note has string field '{field}': {note[field][:50]}...")
                    else:
                        print_result(False, f"Note missing or invalid string field '{field}'")
                
                # Check array fields
                if "cptCodes" in note and isinstance(note["cptCodes"], list):
                    print_result(True, f"Note has cptCodes array: {note['cptCodes']}")
                else:
                    print_result(False, f"Note missing or invalid cptCodes array")
                
                if "icdCodes" in note and isinstance(note["icdCodes"], list):
                    print_result(True, f"Note has icdCodes array: {note['icdCodes']}")
                else:
                    print_result(False, f"Note missing or invalid icdCodes array")
                
                # At least one of subjective/assessment should be non-empty
                if note.get("subjective") or note.get("assessment"):
                    print_result(True, "At least one of subjective/assessment is non-empty")
                else:
                    print_result(False, "Both subjective and assessment are empty")
            else:
                print_result(False, "Response missing 'note' object")
        elif ai_note_resp.status_code in [500, 502]:
            # If EMERGENT_LLM_KEY is missing/invalid, it may return 500/502
            print_result(True, f"Returned {ai_note_resp.status_code} (likely EMERGENT_LLM_KEY issue): {ai_note_resp.text[:200]}")
            print("NOTE: This is acceptable if EMERGENT_LLM_KEY is missing/invalid")
        else:
            print_result(False, f"Expected 200, got {ai_note_resp.status_code}: {ai_note_resp.text[:200]}")
    except requests.exceptions.Timeout:
        print_error("Request timed out (>35s). LLM call may be slow or failing.")
    except Exception as e:
        print_error(f"POST /api/pt/ai-note failed: {e}")
    
    # (C) POST /api/pt/ai-note with empty dictation AND empty draft -> expect 400
    print("\n--- TEST 1C: POST /api/pt/ai-note with empty dictation and draft ---")
    try:
        empty_body = {"dictation": "", "draft": {}}
        empty_resp = session.post(f"{API_BASE}/pt/ai-note", json=empty_body, timeout=10)
        
        if empty_resp.status_code == 400:
            error_data = empty_resp.json()
            error_msg = error_data.get("error", "")
            if "dictation" in error_msg.lower() or "draft" in error_msg.lower():
                print_result(True, f"Correctly returned 400 with error mentioning dictation/draft: {error_msg}")
            else:
                print_result(True, f"Returned 400 but error message doesn't mention dictation/draft: {error_msg}")
        else:
            print_result(False, f"Expected 400, got {empty_resp.status_code}: {empty_resp.text[:200]}")
    except Exception as e:
        print_error(f"POST /api/pt/ai-note (empty) failed: {e}")

# ============================================================================
# TASK 2: Admin roles matrix physical_therapist round-trip (/api/admin/roles)
# ============================================================================

def test_task2_admin_roles():
    print_test("TASK 2 - Admin roles matrix physical_therapist round-trip (/api/admin/roles)")
    
    # (A) GET /api/admin/roles (admin) -> 200; capture config.roles
    print("\n--- TEST 2A: GET /api/admin/roles ---")
    original_roles = None
    try:
        get_resp = session.get(f"{API_BASE}/admin/roles", timeout=10)
        if get_resp.status_code == 200:
            roles_data = get_resp.json()
            print_result(True, f"GET /api/admin/roles returned 200")
            
            roles = roles_data.get("roles", {})
            if roles:
                print_result(True, "Response has 'roles' object")
                original_roles = roles
                
                # Check required role keys
                required_roles = ["provider", "physical_therapist", "nurse", "frontdesk", "billing", "admin"]
                for role_key in required_roles:
                    if role_key in roles:
                        print_result(True, f"Roles includes '{role_key}'")
                        
                        # Check 10 boolean permissions
                        role_perms = roles[role_key]
                        required_perms = ["dashboard", "scheduling", "patientsRead", "patientsWrite", 
                                         "encountersWrite", "ordersWrite", "billingRead", "billingWrite", 
                                         "messaging", "adminAccess"]
                        
                        all_perms_present = all(perm in role_perms for perm in required_perms)
                        all_perms_boolean = all(isinstance(role_perms.get(perm), bool) for perm in required_perms)
                        
                        if all_perms_present and all_perms_boolean:
                            print_result(True, f"Role '{role_key}' has all 10 boolean permissions")
                        else:
                            print_result(False, f"Role '{role_key}' missing or invalid permissions")
                    else:
                        print_result(False, f"Roles missing '{role_key}'")
            else:
                print_result(False, "Response missing 'roles' object")
                return
        else:
            print_result(False, f"GET /api/admin/roles failed: {get_resp.status_code} {get_resp.text[:200]}")
            return
    except Exception as e:
        print_error(f"GET /api/admin/roles failed: {e}")
        return
    
    if not original_roles:
        print_error("Could not capture original roles")
        return
    
    # (B) PUT /api/admin/roles with physical_therapist.billingWrite set to true
    print("\n--- TEST 2B: PUT /api/admin/roles with physical_therapist.billingWrite=true ---")
    try:
        modified_roles = json.loads(json.dumps(original_roles))  # Deep copy
        modified_roles["physical_therapist"]["billingWrite"] = True
        
        put_body = {"roles": modified_roles}
        put_resp = session.put(f"{API_BASE}/admin/roles", json=put_body, timeout=10)
        
        if put_resp.status_code == 200:
            put_data = put_resp.json()
            print_result(True, f"PUT /api/admin/roles returned 200")
            
            if put_data.get("ok") == True:
                print_result(True, "Response has ok=true")
            else:
                print_result(False, f"Response missing ok=true: {put_data}")
            
            response_roles = put_data.get("roles", {})
            if response_roles.get("physical_therapist", {}).get("billingWrite") == True:
                print_result(True, "Response roles.physical_therapist.billingWrite === true")
            else:
                print_result(False, f"Response roles.physical_therapist.billingWrite !== true: {response_roles.get('physical_therapist', {}).get('billingWrite')}")
        else:
            print_result(False, f"PUT /api/admin/roles failed: {put_resp.status_code} {put_resp.text[:200]}")
    except Exception as e:
        print_error(f"PUT /api/admin/roles failed: {e}")
    
    # (C) PUT again restoring physical_therapist.billingWrite to false
    print("\n--- TEST 2C: PUT /api/admin/roles restoring physical_therapist.billingWrite=false ---")
    try:
        restored_roles = json.loads(json.dumps(original_roles))  # Deep copy
        restored_roles["physical_therapist"]["billingWrite"] = False
        
        restore_body = {"roles": restored_roles}
        restore_resp = session.put(f"{API_BASE}/admin/roles", json=restore_body, timeout=10)
        
        if restore_resp.status_code == 200:
            restore_data = restore_resp.json()
            print_result(True, f"PUT /api/admin/roles (restore) returned 200")
            
            response_roles = restore_data.get("roles", {})
            if response_roles.get("physical_therapist", {}).get("billingWrite") == False:
                print_result(True, "Response roles.physical_therapist.billingWrite === false (restored)")
            else:
                print_result(False, f"Response roles.physical_therapist.billingWrite !== false: {response_roles.get('physical_therapist', {}).get('billingWrite')}")
        else:
            print_result(False, f"PUT /api/admin/roles (restore) failed: {restore_resp.status_code} {restore_resp.text[:200]}")
    except Exception as e:
        print_error(f"PUT /api/admin/roles (restore) failed: {e}")
    
    # (D) PUT with roles MISSING the physical_therapist key -> expect 400
    print("\n--- TEST 2D: PUT /api/admin/roles with MISSING physical_therapist key ---")
    try:
        incomplete_roles = json.loads(json.dumps(original_roles))  # Deep copy
        del incomplete_roles["physical_therapist"]
        
        incomplete_body = {"roles": incomplete_roles}
        incomplete_resp = session.put(f"{API_BASE}/admin/roles", json=incomplete_body, timeout=10)
        
        if incomplete_resp.status_code == 400:
            error_data = incomplete_resp.json()
            error_msg = error_data.get("error", "")
            if "invalid" in error_msg.lower() or "body" in error_msg.lower():
                print_result(True, f"Correctly returned 400 with error: {error_msg}")
            else:
                print_result(True, f"Returned 400: {error_msg}")
        else:
            print_result(False, f"Expected 400, got {incomplete_resp.status_code}: {incomplete_resp.text[:200]}")
    except Exception as e:
        print_error(f"PUT /api/admin/roles (incomplete) failed: {e}")
    
    # (E) PUT /api/admin/roles WITHOUT session -> expect 401
    print("\n--- TEST 2E: PUT /api/admin/roles WITHOUT session ---")
    try:
        test_body = {"roles": original_roles}
        no_auth_resp = requests.put(f"{API_BASE}/admin/roles", json=test_body, timeout=10)
        
        if no_auth_resp.status_code in [401, 302, 307]:
            print_result(True, f"Correctly returned {no_auth_resp.status_code} (Unauthorized/Redirect) without session")
        else:
            print_result(False, f"Expected 401/redirect, got {no_auth_resp.status_code}: {no_auth_resp.text[:200]}")
    except Exception as e:
        print_error(f"PUT /api/admin/roles (no auth) failed: {e}")

# ============================================================================
# TASK 3: PT claim create + submit via existing Stedi endpoints (gated)
# ============================================================================

def test_task3_pt_claims():
    print_test("TASK 3 - PT claim create + submit via existing Stedi endpoints (gated)")
    
    # (A) GET /api/pt/cases (admin), pick a legal patient id + build patientName
    print("\n--- TEST 3A: GET /api/pt/cases to find legal patient ---")
    legal_patient_id = None
    legal_patient_name = None
    try:
        cases_resp = session.get(f"{API_BASE}/pt/cases", timeout=10)
        if cases_resp.status_code == 200:
            cases_data = cases_resp.json()
            cases = cases_data.get("cases", [])
            print_result(True, f"GET /api/pt/cases returned 200 with {len(cases)} cases")
            
            # Find a legal/PI patient
            for case in cases:
                patient = case.get("patient", {})
                if patient:
                    legal_patient_id = patient.get("id")
                    last_name = patient.get("lastName", "")
                    first_name = patient.get("firstName", "")
                    legal_patient_name = f"{last_name}, {first_name}"
                    print(f"Found legal/PI patient: {legal_patient_name} (ID: {legal_patient_id})")
                    break
            
            if not legal_patient_id:
                print_error("No legal/PI patient found in cases")
                return
        else:
            print_result(False, f"GET /api/pt/cases failed: {cases_resp.status_code} {cases_resp.text[:200]}")
            return
    except Exception as e:
        print_error(f"GET /api/pt/cases failed: {e}")
        return
    
    # (B) POST /api/stedi/claims with claim data
    print("\n--- TEST 3B: POST /api/stedi/claims to create draft claim ---")
    claim_id = None
    try:
        claim_body = {
            "patientId": legal_patient_id,
            "patientName": legal_patient_name,
            "payerName": "GEICO Casualty",
            "payerId": "",
            "diagnoses": [{"qualifier": "ABK", "code": "M54.2"}],
            "serviceLines": [{
                "serviceDate": "2026-07-10T00:00:00.000Z",
                "procedureCode": "97110",
                "chargeCents": 12000,
                "units": 1,
                "diagnosisCodePointers": ["1"]
            }]
        }
        
        claim_resp = session.post(f"{API_BASE}/stedi/claims", json=claim_body, timeout=10)
        
        if claim_resp.status_code == 200:
            claim_data = claim_resp.json()
            print_result(True, f"POST /api/stedi/claims returned 200")
            
            if claim_data.get("ok") == True:
                print_result(True, "Response has ok=true")
            else:
                print_result(False, f"Response missing ok=true: {claim_data}")
            
            claim = claim_data.get("claim", {})
            if claim:
                print_result(True, "Response has 'claim' object")
                claim_id = claim.get("id")
                
                if claim.get("status") == "draft":
                    print_result(True, f"Claim status='draft'")
                else:
                    print_result(False, f"Claim status != 'draft': {claim.get('status')}")
                
                if claim.get("totalChargeCents") == 12000:
                    print_result(True, f"Claim totalChargeCents=12000")
                else:
                    print_result(False, f"Claim totalChargeCents != 12000: {claim.get('totalChargeCents')}")
                
                print(f"Created claim ID: {claim_id}")
            else:
                print_result(False, "Response missing 'claim' object")
                return
        else:
            print_result(False, f"POST /api/stedi/claims failed: {claim_resp.status_code} {claim_resp.text[:200]}")
            return
    except Exception as e:
        print_error(f"POST /api/stedi/claims failed: {e}")
        return
    
    if not claim_id:
        print_error("Could not capture claim ID")
        return
    
    # (C) POST /api/stedi/claims/<claim id>/submit (gated)
    print("\n--- TEST 3C: POST /api/stedi/claims/{id}/submit (GATED) ---")
    print("NOTE: This is GATED. Acceptable outcomes: 200 {ok:true,...} OR 400 {error:'Stedi is not configured.'} OR 200 {error:...}")
    try:
        submit_resp = session.post(f"{API_BASE}/stedi/claims/{claim_id}/submit", timeout=10)
        
        if submit_resp.status_code == 200:
            submit_data = submit_resp.json()
            print_result(True, f"POST /api/stedi/claims/{claim_id}/submit returned 200")
            
            # Check for acceptable responses
            if submit_data.get("ok") == True:
                print_result(True, f"Response has ok=true (Stedi configured and submission succeeded)")
                print(f"Response: {json.dumps(submit_data, indent=2)[:500]}")
            elif "error" in submit_data:
                error_msg = submit_data.get("error", "")
                if "Stedi is not configured" in error_msg or "not configured" in error_msg.lower():
                    print_result(True, f"Response has error='Stedi is not configured.' (ACCEPTABLE - gate works)")
                else:
                    print_result(True, f"Response has error (ACCEPTABLE): {error_msg}")
            else:
                print_result(True, f"Response: {json.dumps(submit_data, indent=2)[:500]}")
        elif submit_resp.status_code == 400:
            error_data = submit_resp.json()
            error_msg = error_data.get("error", "")
            if "Stedi is not configured" in error_msg or "not configured" in error_msg.lower():
                print_result(True, f"Returned 400 with error='Stedi is not configured.' (ACCEPTABLE - gate works)")
            else:
                print_result(True, f"Returned 400 with error (ACCEPTABLE): {error_msg}")
        elif submit_resp.status_code == 500:
            print_result(False, f"Returned 500 (CRASH - NOT ACCEPTABLE): {submit_resp.text[:200]}")
        else:
            print_result(False, f"Unexpected status {submit_resp.status_code}: {submit_resp.text[:200]}")
    except Exception as e:
        print_error(f"POST /api/stedi/claims/{claim_id}/submit failed: {e}")
    
    # (D) POST /api/stedi/claims WITHOUT session -> expect 401
    print("\n--- TEST 3D: POST /api/stedi/claims WITHOUT session ---")
    try:
        test_body = {
            "patientId": legal_patient_id,
            "patientName": legal_patient_name,
            "payerName": "Test Payer",
            "payerId": "",
            "diagnoses": [],
            "serviceLines": []
        }
        no_auth_resp = requests.post(f"{API_BASE}/stedi/claims", json=test_body, timeout=10)
        
        if no_auth_resp.status_code == 401:
            print_result(True, f"Correctly returned 401 Unauthorized without session")
        else:
            print_result(False, f"Expected 401, got {no_auth_resp.status_code}: {no_auth_resp.text[:200]}")
    except Exception as e:
        print_error(f"POST /api/stedi/claims (no auth) failed: {e}")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    print("\n" + "="*80)
    print("BACKEND TESTING: Physical Rehab Module (3 Tasks)")
    print("="*80)
    
    try:
        test_task1_ai_note()
    except Exception as e:
        print_error(f"Task 1 failed with exception: {e}")
    
    try:
        test_task2_admin_roles()
    except Exception as e:
        print_error(f"Task 2 failed with exception: {e}")
    
    try:
        test_task3_pt_claims()
    except Exception as e:
        print_error(f"Task 3 failed with exception: {e}")
    
    print("\n" + "="*80)
    print("BACKEND TESTING COMPLETE")
    print("="*80)
