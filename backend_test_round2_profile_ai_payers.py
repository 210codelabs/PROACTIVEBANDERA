#!/usr/bin/env python3
"""
Backend test for Round 2: Provider self-profile, AI PI note (gpt-5), Stedi payers casualty flag
Tests 3 backend tasks for Physical Rehab module in Next.js EHR app
"""
import requests
import os
import sys
import time

# Base URL from environment
BASE_URL = os.getenv("NEXT_PUBLIC_BASE_URL", "https://nextjs-ssr-stack.preview.emergentagent.com")
API_BASE = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def login_staff():
    """Login as staff and return session cookies"""
    print("\n=== STAFF LOGIN ===")
    try:
        resp = requests.post(
            f"{API_BASE}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        print(f"Login status: {resp.status_code}")
        if resp.status_code == 200:
            print("✅ Staff login successful")
            return resp.cookies
        else:
            print(f"❌ Login failed: {resp.status_code} {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_task1_provider_profile(cookies):
    """
    TASK 1 — Provider self-profile (/api/me/profile) [HIGH]
    (A) GET without session -> 401
    (B) GET with session -> 200 with profile fields, record original npi
    (C) PATCH with valid data -> 200, assert npi/licenseNo updated
    (D) PATCH with invalid npi -> 400 (mentions 10 digits)
    (E) GET again -> confirm persisted
    (F) Cleanup: restore original npi
    """
    print("\n" + "="*80)
    print("TASK 1 — Provider self-profile (/api/me/profile)")
    print("="*80)
    
    original_npi = None
    
    # TEST A: GET without session -> 401
    print("\n[TEST A] GET /api/me/profile WITHOUT session cookie")
    try:
        resp = requests.get(f"{API_BASE}/me/profile", timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ TEST A PASSED: Correctly returns 401 without session")
        else:
            print(f"❌ TEST A FAILED: Expected 401, got {resp.status_code}")
    except Exception as e:
        print(f"❌ TEST A ERROR: {e}")
    
    # TEST B: GET with session -> 200 with profile
    print("\n[TEST B] GET /api/me/profile WITH session")
    try:
        resp = requests.get(f"{API_BASE}/me/profile", cookies=cookies, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            profile = data.get("profile", {})
            print(f"Profile fields: {list(profile.keys())}")
            
            # Check required fields
            required_fields = ["firstName", "lastName", "email", "role", "credential", "specialty", "npi", "dea", "licenseNo"]
            missing = [f for f in required_fields if f not in profile]
            if missing:
                print(f"❌ TEST B FAILED: Missing fields: {missing}")
            else:
                print(f"✅ All required fields present")
                print(f"Profile: firstName={profile.get('firstName')}, lastName={profile.get('lastName')}, email={profile.get('email')}, role={profile.get('role')}")
                print(f"Credentials: credential={profile.get('credential')}, specialty={profile.get('specialty')}")
                print(f"NPI={profile.get('npi')}, DEA={profile.get('dea')}, licenseNo={profile.get('licenseNo')}")
                
                # Record original NPI for cleanup
                original_npi = profile.get("npi", "")
                print(f"📝 ORIGINAL NPI recorded: '{original_npi}'")
                print("✅ TEST B PASSED: GET with session returns 200 with all required fields")
        else:
            print(f"❌ TEST B FAILED: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ TEST B ERROR: {e}")
    
    # TEST C: PATCH with valid data
    print("\n[TEST C] PATCH /api/me/profile with valid data")
    try:
        payload = {
            "npi": "1234567890",
            "licenseNo": "PT-999888",
            "credential": "DPT",
            "specialty": "Physical Therapy"
        }
        resp = requests.patch(f"{API_BASE}/me/profile", json=payload, cookies=cookies, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {data}")
            if data.get("ok") and data.get("profile"):
                profile = data["profile"]
                npi_match = profile.get("npi") == "1234567890"
                license_match = profile.get("licenseNo") == "PT-999888"
                print(f"NPI match: {npi_match} (expected '1234567890', got '{profile.get('npi')}')")
                print(f"LicenseNo match: {license_match} (expected 'PT-999888', got '{profile.get('licenseNo')}')")
                
                if npi_match and license_match:
                    print("✅ TEST C PASSED: PATCH successful, npi and licenseNo updated correctly")
                else:
                    print("❌ TEST C FAILED: Values not updated correctly")
            else:
                print(f"❌ TEST C FAILED: Response missing ok or profile: {data}")
        else:
            print(f"❌ TEST C FAILED: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ TEST C ERROR: {e}")
    
    # TEST D: PATCH with invalid npi (only 3 digits)
    print("\n[TEST D] PATCH /api/me/profile with invalid NPI (3 digits)")
    try:
        payload = {"npi": "123"}
        resp = requests.patch(f"{API_BASE}/me/profile", json=payload, cookies=cookies, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 400:
            data = resp.json()
            error = data.get("error", "")
            print(f"Error message: {error}")
            if "10 digits" in error or "10" in error:
                print("✅ TEST D PASSED: Correctly returns 400 with error mentioning 10 digits")
            else:
                print(f"❌ TEST D FAILED: Error doesn't mention 10 digits: {error}")
        else:
            print(f"❌ TEST D FAILED: Expected 400, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ TEST D ERROR: {e}")
    
    # TEST E: GET again to confirm persistence
    print("\n[TEST E] GET /api/me/profile again to confirm persistence")
    try:
        resp = requests.get(f"{API_BASE}/me/profile", cookies=cookies, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            profile = data.get("profile", {})
            npi = profile.get("npi")
            license = profile.get("licenseNo")
            print(f"Current NPI: {npi}")
            print(f"Current licenseNo: {license}")
            
            if npi == "1234567890" and license == "PT-999888":
                print("✅ TEST E PASSED: Values persisted correctly from TEST C")
            else:
                print(f"❌ TEST E FAILED: Values not persisted (expected npi='1234567890', licenseNo='PT-999888')")
        else:
            print(f"❌ TEST E FAILED: Expected 200, got {resp.status_code}")
    except Exception as e:
        print(f"❌ TEST E ERROR: {e}")
    
    # TEST F: Cleanup - restore original NPI
    print("\n[TEST F] Cleanup: PATCH NPI back to original value")
    try:
        payload = {"npi": original_npi if original_npi else ""}
        resp = requests.patch(f"{API_BASE}/me/profile", json=payload, cookies=cookies, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            restored_npi = data.get("profile", {}).get("npi", "")
            print(f"Restored NPI: '{restored_npi}' (original was '{original_npi}')")
            print("✅ TEST F PASSED: Cleanup successful, NPI restored")
        else:
            print(f"⚠️ TEST F WARNING: Cleanup failed with status {resp.status_code}")
    except Exception as e:
        print(f"⚠️ TEST F WARNING: Cleanup error: {e}")

def test_task2_ai_note_gpt5(cookies):
    """
    TASK 2 — AI PI note now uses gpt-5 (/api/pt/ai-note) [HIGH]
    First GET /api/pt/cases to get a legal patient id
    Then POST /api/pt/ai-note with dictation and legal patient id
    Expect 200 with structured note (mechanism, subjective, objective, assessment, plan, goals, causation, cptCodes, icdCodes)
    Uses gpt-5 model which can take up to ~40s - use 60s timeout
    CRITICAL: if 500/502 or error, report EXACT status + error text
    """
    print("\n" + "="*80)
    print("TASK 2 — AI PI note now uses gpt-5 (/api/pt/ai-note)")
    print("="*80)
    
    # First, get a legal patient ID from /api/pt/cases
    print("\n[STEP 1] GET /api/pt/cases to find a legal patient")
    legal_patient_id = None
    legal_patient_name = None
    try:
        resp = requests.get(f"{API_BASE}/pt/cases", cookies=cookies, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            cases = data.get("cases", [])
            print(f"Found {len(cases)} cases")
            
            # The /api/pt/cases response structure has nested patient and legalCase objects
            # Each case has: { patient: { id, firstName, lastName, mrn, dob }, legalCase: {...} }
            if cases:
                case = cases[0]
                patient = case.get("patient", {})
                legal_case = case.get("legalCase", {})
                
                legal_patient_id = patient.get("id")
                legal_patient_name = f"{patient.get('firstName', '')} {patient.get('lastName', '')}".strip()
                
                print(f"✅ Found legal/PI patient: {legal_patient_name} (ID: {legal_patient_id})")
                print(f"   MRN: {patient.get('mrn')}")
                print(f"   Legal case: {legal_case.get('caseType')} - {legal_case.get('defendantInsurer')}")
            
            if not legal_patient_id:
                print("❌ No patients found in cases")
                return
        else:
            print(f"❌ Failed to get cases: {resp.status_code}: {resp.text[:200]}")
            return
    except Exception as e:
        print(f"❌ Error getting cases: {e}")
        return
    
    # Now test the AI note generation with gpt-5
    print(f"\n[STEP 2] POST /api/pt/ai-note with dictation and legal patient ID")
    print(f"Using patient: {legal_patient_name} (ID: {legal_patient_id})")
    print("⏱️  NOTE: gpt-5 can take up to ~40s (reasoning tokens), using 60s timeout")
    
    try:
        payload = {
            "dictation": "Patient rear-ended, neck and low back pain 6/10, limited cervical rotation, started manual therapy and therapeutic exercise 2x/week",
            "draft": {},
            "patientId": legal_patient_id
        }
        
        start_time = time.time()
        resp = requests.post(f"{API_BASE}/pt/ai-note", json=payload, cookies=cookies, timeout=60)
        elapsed = time.time() - start_time
        
        print(f"Status: {resp.status_code}")
        print(f"Response time: {elapsed:.1f}s")
        
        # CRITICAL: Report exact status and error for any failure
        if resp.status_code in [500, 502, 503, 504]:
            print(f"❌ CRITICAL ERROR: Server error {resp.status_code}")
            print(f"EXACT ERROR RESPONSE: {resp.text}")
            print(f"This may indicate Emergent's catalog rejected the 'gpt-5' model id")
            return
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response keys: {list(data.keys())}")
            
            if not data.get("ok"):
                print(f"❌ Response has ok=false or missing")
                if "error" in data:
                    print(f"EXACT ERROR: {data.get('error')}")
                return
            
            note = data.get("note")
            if not note:
                print(f"❌ Response missing 'note' field")
                return
            
            print(f"\n📝 Note structure:")
            print(f"  - mechanism: {len(note.get('mechanism', ''))} chars")
            print(f"  - subjective: {len(note.get('subjective', ''))} chars")
            print(f"  - objective: {len(note.get('objective', ''))} chars")
            print(f"  - assessment: {len(note.get('assessment', ''))} chars")
            print(f"  - plan: {len(note.get('plan', ''))} chars")
            print(f"  - goals: {len(note.get('goals', ''))} chars")
            print(f"  - causation: {len(note.get('causation', ''))} chars")
            print(f"  - cptCodes: {note.get('cptCodes', [])} (type: {type(note.get('cptCodes', [])).__name__})")
            print(f"  - icdCodes: {note.get('icdCodes', [])} (type: {type(note.get('icdCodes', [])).__name__})")
            
            # Verify all required fields are present
            required_string_fields = ["mechanism", "subjective", "objective", "assessment", "plan", "goals", "causation"]
            required_array_fields = ["cptCodes", "icdCodes"]
            
            missing_fields = []
            for field in required_string_fields:
                if field not in note:
                    missing_fields.append(field)
            for field in required_array_fields:
                if field not in note:
                    missing_fields.append(field)
            
            if missing_fields:
                print(f"❌ TEST FAILED: Missing required fields: {missing_fields}")
                return
            
            # Check that at least subjective OR assessment is non-empty
            subjective = note.get("subjective", "")
            assessment = note.get("assessment", "")
            
            if not subjective and not assessment:
                print(f"❌ TEST FAILED: Both subjective and assessment are empty")
                return
            
            # Verify array fields are actually arrays
            cpt_codes = note.get("cptCodes", [])
            icd_codes = note.get("icdCodes", [])
            
            if not isinstance(cpt_codes, list):
                print(f"❌ TEST FAILED: cptCodes is not an array (type: {type(cpt_codes).__name__})")
                return
            
            if not isinstance(icd_codes, list):
                print(f"❌ TEST FAILED: icdCodes is not an array (type: {type(icd_codes).__name__})")
                return
            
            print(f"\n✅ TEST PASSED: AI PI note generation successful")
            print(f"   - All required string fields present: {required_string_fields}")
            print(f"   - All required array fields present: {required_array_fields}")
            print(f"   - At least one of subjective/assessment is non-empty ✓")
            print(f"   - Response time: {elapsed:.1f}s (within acceptable range for gpt-5)")
            print(f"   - Model gpt-5 integration working correctly")
            
        else:
            print(f"❌ TEST FAILED: Expected 200, got {resp.status_code}")
            print(f"EXACT ERROR RESPONSE: {resp.text}")
            
    except requests.exceptions.Timeout:
        print(f"❌ TEST FAILED: Request timed out after 60s")
        print(f"This may indicate an issue with the gpt-5 model or Emergent API")
    except Exception as e:
        print(f"❌ TEST ERROR: {e}")

def test_task3_stedi_payers_casualty(cookies):
    """
    TASK 3 — Stedi payers casualty flag (/api/stedi/payers) [MEDIUM]
    (A) POST with casualty=true -> 200, verify casualty===true
    (B) GET -> verify created payer is present with casualty===true
    (C) DELETE -> 200 (cleanup)
    (D) POST without session -> 401
    """
    print("\n" + "="*80)
    print("TASK 3 — Stedi payers casualty flag (/api/stedi/payers)")
    print("="*80)
    
    created_payer_id = None
    
    # TEST A: POST with casualty=true
    print("\n[TEST A] POST /api/stedi/payers with casualty=true")
    try:
        payload = {
            "name": "GEICO Casualty TEST",
            "stediId": "CAS_TEST_1",
            "casualty": True,
            "supportsClaims": True
        }
        resp = requests.post(f"{API_BASE}/stedi/payers", json=payload, cookies=cookies, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {data}")
            
            if data.get("ok") and data.get("payer"):
                payer = data["payer"]
                created_payer_id = payer.get("id")
                casualty = payer.get("casualty")
                stedi_id = payer.get("stediId")
                
                print(f"Created payer ID: {created_payer_id}")
                print(f"Payer casualty: {casualty} (type: {type(casualty).__name__})")
                print(f"Payer stediId: {stedi_id}")
                
                if casualty is True and stedi_id == "CAS_TEST_1":
                    print("✅ TEST A PASSED: Payer created with casualty===true and stediId==='CAS_TEST_1'")
                else:
                    print(f"❌ TEST A FAILED: casualty={casualty} (expected True), stediId={stedi_id} (expected 'CAS_TEST_1')")
            else:
                print(f"❌ TEST A FAILED: Response missing ok or payer: {data}")
        else:
            print(f"❌ TEST A FAILED: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ TEST A ERROR: {e}")
    
    # TEST B: GET to verify payer is present
    print("\n[TEST B] GET /api/stedi/payers to verify created payer")
    try:
        resp = requests.get(f"{API_BASE}/stedi/payers", cookies=cookies, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            payers = data.get("payers", [])
            print(f"Found {len(payers)} payers")
            
            # Find our created payer
            found_payer = None
            for payer in payers:
                if payer.get("id") == created_payer_id:
                    found_payer = payer
                    break
            
            if found_payer:
                print(f"✅ Found created payer: {found_payer.get('name')}")
                casualty = found_payer.get("casualty")
                print(f"Payer casualty: {casualty} (type: {type(casualty).__name__})")
                
                if casualty is True:
                    print("✅ TEST B PASSED: Created payer present with casualty===true")
                else:
                    print(f"❌ TEST B FAILED: casualty={casualty} (expected True)")
            else:
                print(f"❌ TEST B FAILED: Created payer not found in list")
        else:
            print(f"❌ TEST B FAILED: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ TEST B ERROR: {e}")
    
    # TEST C: DELETE for cleanup
    print("\n[TEST C] DELETE /api/stedi/payers?id={id} (cleanup)")
    if created_payer_id:
        try:
            resp = requests.delete(f"{API_BASE}/stedi/payers?id={created_payer_id}", cookies=cookies, timeout=10)
            print(f"Status: {resp.status_code}")
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    print("✅ TEST C PASSED: Payer deleted successfully (cleanup complete)")
                else:
                    print(f"⚠️ TEST C WARNING: Response missing ok: {data}")
            else:
                print(f"⚠️ TEST C WARNING: Expected 200, got {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            print(f"⚠️ TEST C WARNING: Cleanup error: {e}")
    else:
        print("⚠️ TEST C SKIPPED: No payer ID to delete")
    
    # TEST D: POST without session -> 401
    print("\n[TEST D] POST /api/stedi/payers WITHOUT session cookie")
    try:
        payload = {
            "name": "Test Payer",
            "stediId": "TEST_1",
            "casualty": False,
            "supportsClaims": True
        }
        resp = requests.post(f"{API_BASE}/stedi/payers", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print("✅ TEST D PASSED: Correctly returns 401 without session")
        else:
            print(f"❌ TEST D FAILED: Expected 401, got {resp.status_code}")
    except Exception as e:
        print(f"❌ TEST D ERROR: {e}")

def main():
    print("="*80)
    print("BACKEND TEST - ROUND 2: Provider Profile, AI PI Note (gpt-5), Stedi Payers")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    
    # Login first
    cookies = login_staff()
    if not cookies:
        print("\n❌ FATAL: Could not login, aborting tests")
        sys.exit(1)
    
    # Run all 3 tasks
    test_task1_provider_profile(cookies)
    test_task2_ai_note_gpt5(cookies)
    test_task3_stedi_payers_casualty(cookies)
    
    print("\n" + "="*80)
    print("ALL TESTS COMPLETED")
    print("="*80)

if __name__ == "__main__":
    main()
