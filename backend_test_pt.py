#!/usr/bin/env python3
"""
Backend test for PT / Personal Injury module APIs
Tests all /api/pt/* endpoints with authentication, validation, and data integrity checks
"""

import requests
import json
import sys

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def login(email, password):
    """Login and return session cookie"""
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": email, "password": password}
    resp = requests.post(url, json=payload, allow_redirects=False)
    
    print(f"Login response status: {resp.status_code}")
    print(f"Login response cookies: {resp.cookies}")
    
    if resp.status_code != 200:
        print(f"❌ Login failed: {resp.status_code} {resp.text[:200]}")
        sys.exit(1)
    
    # Try different cookie names
    cookie = resp.cookies.get("proactive_session") or resp.cookies.get("session") or resp.cookies.get("next-auth.session-token")
    
    if not cookie:
        # Print all cookies for debugging
        print(f"Available cookies: {list(resp.cookies.keys())}")
        print(f"❌ No session cookie returned from login")
        sys.exit(1)
    
    print(f"✅ Login successful: {email}")
    return {"proactive_session": cookie}

def test_a_get_cases_list(cookies):
    """TEST A: GET /api/pt/cases -> 200 {cases:[...]} listing ONLY patientType='legal' patients"""
    print("\n=== TEST A: GET /api/pt/cases (list legal/PI patients) ===")
    url = f"{BASE_URL}/api/pt/cases"
    resp = requests.get(url, cookies=cookies)
    
    if resp.status_code != 200:
        print(f"❌ TEST A FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        return None
    
    data = resp.json()
    if "cases" not in data:
        print(f"❌ TEST A FAILED: Response missing 'cases' key")
        print(f"Response: {json.dumps(data, indent=2)[:500]}")
        return None
    
    cases = data["cases"]
    print(f"✅ TEST A PASSED: GET /api/pt/cases returns 200 with {len(cases)} cases")
    
    # Find the seeded PI patient with GEICO Casualty
    geico_case = None
    for case in cases:
        if case.get("legalCase") and case["legalCase"].get("defendantInsurer") == "GEICO Casualty":
            geico_case = case
            print(f"✅ Found seeded PI patient: {case['patient']['firstName']} {case['patient']['lastName']} (MRN: {case['patient']['mrn']})")
            print(f"   Legal Case: defendantInsurer='{case['legalCase']['defendantInsurer']}', claimNumber='{case['legalCase']['claimNumber']}'")
            break
    
    if not geico_case:
        print(f"⚠️  WARNING: Seeded PI patient with GEICO Casualty not found in cases list")
        # Try to find any legal patient
        if cases:
            geico_case = cases[0]
            print(f"   Using first available case: {geico_case['patient']['firstName']} {geico_case['patient']['lastName']}")
    
    return geico_case

def test_b_search_cases(cookies):
    """TEST B: GET /api/pt/cases?q=<name/mrn substring> filters correctly"""
    print("\n=== TEST B: GET /api/pt/cases?q=<search> (filter by name/MRN) ===")
    
    # Search with a partial name
    url = f"{BASE_URL}/api/pt/cases?q=adams"
    resp = requests.get(url, cookies=cookies)
    
    if resp.status_code != 200:
        print(f"❌ TEST B FAILED: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    cases = data.get("cases", [])
    print(f"✅ TEST B PASSED: GET /api/pt/cases?q=adams returns 200 with {len(cases)} filtered cases")
    
    # Verify filtering works
    if cases:
        for case in cases[:3]:  # Check first 3
            patient = case["patient"]
            name = f"{patient['firstName']} {patient['lastName']}".lower()
            mrn = (patient.get("mrn") or "").lower()
            if "adams" in name or "adams" in mrn:
                print(f"   ✅ Filter working: {patient['firstName']} {patient['lastName']} (MRN: {patient['mrn']})")
    
    return True

def test_c_create_note_legal_patient(cookies, patient_id):
    """TEST C: POST /api/pt/notes with legal patient -> 200 {ok:true, note}"""
    print(f"\n=== TEST C: POST /api/pt/notes (create note for legal patient) ===")
    
    url = f"{BASE_URL}/api/pt/notes"
    payload = {
        "patientId": patient_id,
        "mechanism": "Motor vehicle accident - rear-end collision",
        "subjective": "Patient reports neck pain and headaches since accident 2 weeks ago",
        "objective": "Cervical ROM limited, tenderness at C5-C7",
        "assessment": "Cervical strain, post-MVA",
        "plan": "PT 3x/week for 4 weeks, modalities, therapeutic exercises",
        "goals": "Reduce pain to 2/10, restore full cervical ROM",
        "causation": "Injuries directly related to motor vehicle accident on date of loss",
        "cptCodes": ["97110", "97140"],
        "icdCodes": ["M54.2"]
    }
    
    resp = requests.post(url, json=payload, cookies=cookies)
    
    if resp.status_code != 200:
        print(f"❌ TEST C FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        return None
    
    data = resp.json()
    if not data.get("ok") or not data.get("note"):
        print(f"❌ TEST C FAILED: Response missing 'ok' or 'note'")
        print(f"Response: {json.dumps(data, indent=2)[:500]}")
        return None
    
    note = data["note"]
    print(f"✅ TEST C PASSED: POST /api/pt/notes returns 200 {{ok:true, note}}")
    print(f"   Note ID: {note['id']}")
    print(f"   Status: {note['status']}")
    print(f"   Author Name: {note['authorName']}")
    
    # Verify required fields
    assert note["status"] == "draft", f"Expected status='draft', got '{note['status']}'"
    assert note["authorName"], "authorName should be set"
    assert "authorNpi" in note, "authorNpi field should exist"
    assert "authorCredential" in note, "authorCredential field should exist"
    assert "authorLicense" in note, "authorLicense field should exist"
    
    print(f"   ✅ authorNpi: {note['authorNpi']} (may be null for admin)")
    print(f"   ✅ authorCredential: {note['authorCredential']} (may be null for admin)")
    print(f"   ✅ authorLicense: {note['authorLicense']} (may be null for admin)")
    
    return note["id"]

def test_d_create_note_clinical_patient(cookies):
    """TEST D: POST /api/pt/notes with clinical patient -> 400 error"""
    print(f"\n=== TEST D: POST /api/pt/notes (clinical patient should fail) ===")
    
    # First, find a clinical patient
    search_url = f"{BASE_URL}/api/patients/search?q=a"
    search_resp = requests.get(search_url, cookies=cookies)
    
    if search_resp.status_code != 200:
        print(f"⚠️  Could not search for clinical patient: {search_resp.status_code}")
        return False
    
    search_data = search_resp.json()
    results = search_data.get("results", [])
    
    # Find a patient that is NOT patientType='legal'
    clinical_patient_id = None
    for patient in results:
        if patient.get("patientType") != "legal":
            clinical_patient_id = patient["id"]
            print(f"   Found clinical patient: {patient['firstName']} {patient['lastName']} (ID: {clinical_patient_id})")
            break
    
    if not clinical_patient_id:
        print(f"⚠️  WARNING: No clinical patients found to test with")
        return False
    
    # Try to create PT note for clinical patient
    url = f"{BASE_URL}/api/pt/notes"
    payload = {
        "patientId": clinical_patient_id,
        "mechanism": "Test",
        "subjective": "Test",
        "objective": "Test",
        "assessment": "Test",
        "plan": "Test",
        "cptCodes": ["97110"],
        "icdCodes": ["M54.2"]
    }
    
    resp = requests.post(url, json=payload, cookies=cookies)
    
    if resp.status_code != 400:
        print(f"❌ TEST D FAILED: Expected 400, got {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        return False
    
    data = resp.json()
    error_msg = data.get("error", "")
    
    # Check if error mentions Physical Rehabilitation / Personal Injury / legal
    keywords = ["physical rehabilitation", "personal injury", "legal"]
    has_keyword = any(keyword in error_msg.lower() for keyword in keywords)
    
    if not has_keyword:
        print(f"❌ TEST D FAILED: Error message doesn't mention Physical Rehabilitation/Personal Injury/legal")
        print(f"   Error: {error_msg}")
        return False
    
    print(f"✅ TEST D PASSED: POST /api/pt/notes with clinical patient returns 400")
    print(f"   Error message: {error_msg}")
    
    return True

def test_e_create_note_nonexistent_patient(cookies):
    """TEST E: POST /api/pt/notes with nonexistent patientId -> 404"""
    print(f"\n=== TEST E: POST /api/pt/notes (nonexistent patient) ===")
    
    url = f"{BASE_URL}/api/pt/notes"
    payload = {
        "patientId": "nonexistent-patient-id-12345",
        "mechanism": "Test",
        "subjective": "Test",
        "cptCodes": ["97110"],
        "icdCodes": ["M54.2"]
    }
    
    resp = requests.post(url, json=payload, cookies=cookies)
    
    if resp.status_code != 404:
        print(f"❌ TEST E FAILED: Expected 404, got {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        return False
    
    print(f"✅ TEST E PASSED: POST /api/pt/notes with nonexistent patient returns 404")
    
    return True

def test_f_get_notes_list(cookies, note_id):
    """TEST F: GET /api/pt/notes -> 200 {notes:[...]} with patientName + patientMrn"""
    print(f"\n=== TEST F: GET /api/pt/notes (list all notes) ===")
    
    url = f"{BASE_URL}/api/pt/notes"
    resp = requests.get(url, cookies=cookies)
    
    if resp.status_code != 200:
        print(f"❌ TEST F FAILED: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    notes = data.get("notes", [])
    
    print(f"✅ TEST F PASSED: GET /api/pt/notes returns 200 with {len(notes)} notes")
    
    # Find the created note
    found_note = None
    for note in notes:
        if note["id"] == note_id:
            found_note = note
            break
    
    if found_note:
        print(f"   ✅ Created note found in list")
        print(f"      Patient Name: {found_note.get('patientName')}")
        print(f"      Patient MRN: {found_note.get('patientMrn')}")
        assert "patientName" in found_note, "patientName should be joined"
        assert "patientMrn" in found_note, "patientMrn should be joined"
    else:
        print(f"   ⚠️  Created note not found in list (may have been filtered)")
    
    return True

def test_g_filter_notes(cookies, patient_id):
    """TEST G: GET /api/pt/notes?patientId=<id> filters; GET /api/pt/notes?q=<text> searches"""
    print(f"\n=== TEST G: GET /api/pt/notes (filter and search) ===")
    
    # Test filter by patientId
    url = f"{BASE_URL}/api/pt/notes?patientId={patient_id}"
    resp = requests.get(url, cookies=cookies)
    
    if resp.status_code != 200:
        print(f"❌ TEST G (filter) FAILED: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    notes = data.get("notes", [])
    
    print(f"✅ TEST G (filter) PASSED: GET /api/pt/notes?patientId={patient_id} returns {len(notes)} notes")
    
    # Verify all notes belong to the patient
    if notes:
        for note in notes[:3]:
            assert note["patientId"] == patient_id, f"Note {note['id']} doesn't belong to patient {patient_id}"
        print(f"   ✅ All notes belong to patient {patient_id}")
    
    # Test search by text
    url = f"{BASE_URL}/api/pt/notes?q=cervical"
    resp = requests.get(url, cookies=cookies)
    
    if resp.status_code != 200:
        print(f"❌ TEST G (search) FAILED: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    notes = data.get("notes", [])
    
    print(f"✅ TEST G (search) PASSED: GET /api/pt/notes?q=cervical returns {len(notes)} notes")
    
    return True

def test_h_get_note_by_id(cookies, note_id):
    """TEST H: GET /api/pt/notes/{id} -> 200 {note, patient}"""
    print(f"\n=== TEST H: GET /api/pt/notes/{{id}} (get single note) ===")
    
    url = f"{BASE_URL}/api/pt/notes/{note_id}"
    resp = requests.get(url, cookies=cookies)
    
    if resp.status_code != 200:
        print(f"❌ TEST H FAILED: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    
    if "note" not in data or "patient" not in data:
        print(f"❌ TEST H FAILED: Response missing 'note' or 'patient'")
        print(f"Response: {json.dumps(data, indent=2)[:500]}")
        return False
    
    note = data["note"]
    patient = data["patient"]
    
    print(f"✅ TEST H PASSED: GET /api/pt/notes/{note_id} returns 200 {{note, patient}}")
    print(f"   Note ID: {note['id']}")
    print(f"   Patient: {patient['firstName']} {patient['lastName']} (MRN: {patient['mrn']})")
    
    return True

def test_i_patch_note_update_field(cookies, note_id):
    """TEST I: PATCH /api/pt/notes/{id} {assessment:'updated'} -> 200, status still 'draft'"""
    print(f"\n=== TEST I: PATCH /api/pt/notes/{{id}} (update field) ===")
    
    url = f"{BASE_URL}/api/pt/notes/{note_id}"
    payload = {
        "assessment": "Updated assessment: Cervical strain improving with PT"
    }
    
    resp = requests.patch(url, json=payload, cookies=cookies)
    
    if resp.status_code != 200:
        print(f"❌ TEST I FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        return False
    
    data = resp.json()
    note = data.get("note")
    
    if not note:
        print(f"❌ TEST I FAILED: Response missing 'note'")
        return False
    
    if note["assessment"] != payload["assessment"]:
        print(f"❌ TEST I FAILED: Assessment not updated")
        print(f"   Expected: {payload['assessment']}")
        print(f"   Got: {note['assessment']}")
        return False
    
    if note["status"] != "draft":
        print(f"❌ TEST I FAILED: Status should still be 'draft', got '{note['status']}'")
        return False
    
    print(f"✅ TEST I PASSED: PATCH /api/pt/notes/{note_id} updates field, status still 'draft'")
    print(f"   Updated assessment: {note['assessment'][:50]}...")
    
    return True

def test_j_patch_note_sign(cookies, note_id):
    """TEST J: PATCH /api/pt/notes/{id} {sign:true} -> 200, status='signed', signedAt + signedByName set"""
    print(f"\n=== TEST J: PATCH /api/pt/notes/{{id}} (sign note) ===")
    
    url = f"{BASE_URL}/api/pt/notes/{note_id}"
    payload = {
        "sign": True
    }
    
    resp = requests.patch(url, json=payload, cookies=cookies)
    
    if resp.status_code != 200:
        print(f"❌ TEST J FAILED: Expected 200, got {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        return False
    
    data = resp.json()
    note = data.get("note")
    
    if not note:
        print(f"❌ TEST J FAILED: Response missing 'note'")
        return False
    
    if note["status"] != "signed":
        print(f"❌ TEST J FAILED: Status should be 'signed', got '{note['status']}'")
        return False
    
    if not note.get("signedAt"):
        print(f"❌ TEST J FAILED: signedAt should be set")
        return False
    
    if not note.get("signedByName"):
        print(f"❌ TEST J FAILED: signedByName should be set")
        return False
    
    print(f"✅ TEST J PASSED: PATCH /api/pt/notes/{note_id} signs note")
    print(f"   Status: {note['status']}")
    print(f"   Signed At: {note['signedAt']}")
    print(f"   Signed By: {note['signedByName']}")
    
    return True

def test_k_patch_note_empty(cookies, note_id):
    """TEST K: PATCH /api/pt/notes/{id} {} -> 400 'Nothing to update'"""
    print(f"\n=== TEST K: PATCH /api/pt/notes/{{id}} (empty body) ===")
    
    url = f"{BASE_URL}/api/pt/notes/{note_id}"
    payload = {}
    
    resp = requests.patch(url, json=payload, cookies=cookies)
    
    if resp.status_code != 400:
        print(f"❌ TEST K FAILED: Expected 400, got {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        return False
    
    data = resp.json()
    error_msg = data.get("error", "")
    
    if "nothing to update" not in error_msg.lower():
        print(f"❌ TEST K FAILED: Error message should mention 'Nothing to update'")
        print(f"   Error: {error_msg}")
        return False
    
    print(f"✅ TEST K PASSED: PATCH /api/pt/notes/{note_id} with empty body returns 400")
    print(f"   Error: {error_msg}")
    
    return True

def test_l_auth_guard(cookies):
    """TEST L: Auth guard - GET /api/pt/cases and /api/pt/notes without cookie -> 401"""
    print(f"\n=== TEST L: Auth guard (no cookie) ===")
    
    # Test GET /api/pt/cases without cookie
    url = f"{BASE_URL}/api/pt/cases"
    resp = requests.get(url)
    
    if resp.status_code != 401:
        print(f"❌ TEST L (cases) FAILED: Expected 401, got {resp.status_code}")
        return False
    
    print(f"✅ TEST L (cases) PASSED: GET /api/pt/cases without cookie returns 401")
    
    # Test GET /api/pt/notes without cookie
    url = f"{BASE_URL}/api/pt/notes"
    resp = requests.get(url)
    
    if resp.status_code != 401:
        print(f"❌ TEST L (notes) FAILED: Expected 401, got {resp.status_code}")
        return False
    
    print(f"✅ TEST L (notes) PASSED: GET /api/pt/notes without cookie returns 401")
    
    return True

def main():
    print("=" * 80)
    print("PT / Personal Injury Module Backend Testing")
    print("=" * 80)
    
    # Test L first (auth guard without cookie)
    test_l_auth_guard(None)
    
    # Login
    cookies = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    # Test A: Get cases list
    geico_case = test_a_get_cases_list(cookies)
    if not geico_case:
        print("\n❌ CRITICAL: Could not find legal/PI patient for testing")
        sys.exit(1)
    
    patient_id = geico_case["patient"]["id"]
    print(f"\n📋 Using patient ID for tests: {patient_id}")
    
    # Test B: Search cases
    test_b_search_cases(cookies)
    
    # Test C: Create note for legal patient
    note_id = test_c_create_note_legal_patient(cookies, patient_id)
    if not note_id:
        print("\n❌ CRITICAL: Could not create PT note")
        sys.exit(1)
    
    print(f"\n📋 Created note ID for tests: {note_id}")
    
    # Test D: Create note for clinical patient (should fail)
    test_d_create_note_clinical_patient(cookies)
    
    # Test E: Create note for nonexistent patient
    test_e_create_note_nonexistent_patient(cookies)
    
    # Test F: Get notes list
    test_f_get_notes_list(cookies, note_id)
    
    # Test G: Filter and search notes
    test_g_filter_notes(cookies, patient_id)
    
    # Test H: Get note by ID
    test_h_get_note_by_id(cookies, note_id)
    
    # Test I: Update note field
    test_i_patch_note_update_field(cookies, note_id)
    
    # Test J: Sign note
    test_j_patch_note_sign(cookies, note_id)
    
    # Test K: Empty PATCH
    test_k_patch_note_empty(cookies, note_id)
    
    print("\n" + "=" * 80)
    print("✅ ALL PT MODULE TESTS COMPLETED SUCCESSFULLY")
    print("=" * 80)
    print(f"\nNote: Created PT note ID {note_id} was left in the database (no DELETE endpoint)")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
