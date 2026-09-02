#!/usr/bin/env python3
"""
Backend test for Round 4 PT module (3 tasks):
1. AI codes check (/api/pt/ai-codes)
2. Attorney records packet PDF (/api/pt/patients/[patientId]/packet/pdf)
3. Single-note PDF after refactor (/api/pt/notes/[id]/pdf)

Base URL from .env: NEXT_PUBLIC_BASE_URL
Auth: POST /api/auth/login with admin@proactiveclinic.com / apex123
"""

import requests
import sys
import time

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def login():
    """Login as admin and return session cookie"""
    print("\n=== LOGIN ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"},
            timeout=30
        )
        print(f"Login status: {resp.status_code}")
        if resp.status_code == 200:
            print("✅ Login successful")
            return resp.cookies
        else:
            print(f"❌ Login failed: {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_ai_codes_check(cookies):
    """
    TASK 1 — AI codes check (/api/pt/ai-codes) [HIGH]
    (A) POST WITHOUT session -> 401
    (B) POST (session) with deliberate mismatch -> 200 {ok:true, flags:[...], summary}
    (C) POST (session) with empty codes -> 400
    """
    print("\n" + "="*80)
    print("TASK 1 — AI codes check (/api/pt/ai-codes)")
    print("="*80)
    
    # TEST A: POST without session -> 401
    print("\n[TEST A] POST /api/pt/ai-codes WITHOUT session -> expect 401")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/pt/ai-codes",
            json={"note": {"subjective": "test"}, "cptCodes": ["97110"], "icdCodes": ["M54.2"]},
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ TEST A PASSED: Correctly returns 401 without session")
        else:
            print(f"❌ TEST A FAILED: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ TEST A ERROR: {e}")
    
    # TEST B: POST with session and deliberate mismatch
    print("\n[TEST B] POST /api/pt/ai-codes WITH session (deliberate mismatch) -> expect 200 with flags")
    print("Note: Neck pain after MVA, cervical strain")
    print("CPT codes: 97110 (therapeutic exercise), 97140 (manual therapy), 97535 (self-care - NOT documented)")
    print("ICD codes: M54.2 (cervicalgia), E11.9 (diabetes - NOT documented)")
    print("Expected: Flags for 97535 and/or E11.9 as unsupported")
    print("Note: This uses gpt-5, may take up to ~45 seconds...")
    
    try:
        start_time = time.time()
        resp = requests.post(
            f"{BASE_URL}/api/pt/ai-codes",
            json={
                "note": {
                    "subjective": "Neck pain after MVA, limited cervical rotation.",
                    "objective": "Cervical AROM reduced.",
                    "assessment": "Cervical strain",
                    "plan": "Manual therapy and therapeutic exercise 2x/week",
                    "mechanism": "",
                    "goals": "",
                    "causation": ""
                },
                "cptCodes": ["97110", "97140", "97535"],
                "icdCodes": ["M54.2", "E11.9"]
            },
            cookies=cookies,
            timeout=60
        )
        elapsed = time.time() - start_time
        print(f"Status: {resp.status_code} (took {elapsed:.1f}s)")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Check required fields
            if "ok" in data and "flags" in data and "summary" in data:
                print(f"✅ Response has required fields: ok={data.get('ok')}, flags (array), summary")
                
                # Check flags structure
                flags = data.get("flags", [])
                print(f"\nFlags array length: {len(flags)}")
                
                if isinstance(flags, list):
                    print("✅ flags is an array")
                    
                    # Check each flag structure
                    for i, flag in enumerate(flags):
                        print(f"\nFlag {i+1}: {flag}")
                        if all(k in flag for k in ["code", "type", "severity", "issue"]):
                            print(f"  ✅ Flag has all required keys: code={flag.get('code')}, type={flag.get('type')}, severity={flag.get('severity')}")
                            print(f"     Issue: {flag.get('issue')}")
                        else:
                            print(f"  ❌ Flag missing required keys. Has: {list(flag.keys())}")
                    
                    # Check if expected codes are flagged
                    flagged_codes = [f.get("code") for f in flags]
                    print(f"\nFlagged codes: {flagged_codes}")
                    
                    if "97535" in flagged_codes or "E11.9" in flagged_codes:
                        print("✅ Expected codes flagged (97535 self-care and/or E11.9 diabetes)")
                    else:
                        print("⚠️  Neither 97535 nor E11.9 was flagged (AI may have different interpretation)")
                    
                    print(f"\nSummary: {data.get('summary')}")
                    print("✅ TEST B PASSED: Returns 200 with correct structure")
                else:
                    print(f"❌ TEST B FAILED: flags is not an array, type: {type(flags)}")
            else:
                print(f"❌ TEST B FAILED: Missing required fields. Has: {list(data.keys())}")
                print(f"Response: {resp.text[:500]}")
        elif resp.status_code in [500, 502]:
            print(f"❌ TEST B FAILED: Server error {resp.status_code}")
            print(f"Error response: {resp.text[:500]}")
        else:
            print(f"❌ TEST B FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
    except requests.exceptions.Timeout:
        print(f"❌ TEST B ERROR: Request timed out after 60 seconds")
    except Exception as e:
        print(f"❌ TEST B ERROR: {e}")
    
    # TEST C: POST with empty codes -> 400
    print("\n[TEST C] POST /api/pt/ai-codes WITH session (empty codes) -> expect 400")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/pt/ai-codes",
            json={
                "note": {"subjective": "x"},
                "cptCodes": [],
                "icdCodes": []
            },
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 400:
            data = resp.json()
            error_msg = data.get("error", "")
            print(f"Error message: {error_msg}")
            if "code" in error_msg.lower():
                print("✅ TEST C PASSED: Returns 400 with message mentioning 'code'")
            else:
                print(f"⚠️  TEST C PASSED: Returns 400 but message doesn't mention 'code': {error_msg}")
        else:
            print(f"❌ TEST C FAILED: Expected 400, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ TEST C ERROR: {e}")

def test_attorney_packet_pdf(cookies):
    """
    TASK 2 — Attorney records packet PDF (/api/pt/patients/[patientId]/packet/pdf) [HIGH]
    (A) GET /api/pt/notes (session); find a note with status==="signed" and capture its patientId
    (B) GET /api/pt/patients/<patientId>/packet/pdf WITH session -> 200, Content-Type application/pdf, %PDF, length > 1000
    (C) GET /api/pt/patients/nope123/packet/pdf (session) -> 404
    (D) GET the packet WITHOUT session -> 401 or 302
    """
    print("\n" + "="*80)
    print("TASK 2 — Attorney records packet PDF (/api/pt/patients/[patientId]/packet/pdf)")
    print("="*80)
    
    # TEST A: Get notes and find a signed note
    print("\n[TEST A] GET /api/pt/notes to find a signed note")
    patient_id = None
    note_id = None
    
    try:
        resp = requests.get(
            f"{BASE_URL}/api/pt/notes",
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            notes = data.get("notes", [])
            print(f"Found {len(notes)} notes")
            
            # Find a signed note
            for note in notes:
                if note.get("status") == "signed":
                    patient_id = note.get("patientId")
                    note_id = note.get("id")
                    print(f"✅ Found signed note: ID={note_id}, patientId={patient_id}, status={note.get('status')}")
                    break
            
            if not patient_id:
                print("❌ TEST A FAILED: No signed notes found")
                return
        else:
            print(f"❌ TEST A FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return
    except Exception as e:
        print(f"❌ TEST A ERROR: {e}")
        return
    
    # TEST B: GET packet PDF with session
    print(f"\n[TEST B] GET /api/pt/patients/{patient_id}/packet/pdf WITH session -> expect 200 PDF")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/pt/patients/{patient_id}/packet/pdf",
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            content_type = resp.headers.get("Content-Type", "")
            print(f"Content-Type: {content_type}")
            
            # Check Content-Type
            if content_type == "application/pdf":
                print("✅ Content-Type is 'application/pdf'")
            else:
                print(f"❌ Content-Type is not 'application/pdf': {content_type}")
            
            # Check PDF magic bytes
            content = resp.content
            if len(content) >= 4:
                first_4_bytes = content[:4]
                print(f"First 4 bytes (hex): {first_4_bytes.hex()}")
                print(f"First 4 bytes (text): {first_4_bytes}")
                
                if first_4_bytes == b"%PDF":
                    print("✅ Body starts with '%PDF' (valid PDF magic bytes)")
                else:
                    print(f"❌ Body does NOT start with '%PDF': {first_4_bytes}")
            
            # Check length
            pdf_length = len(content)
            print(f"PDF size: {pdf_length:,} bytes")
            
            if pdf_length > 1000:
                print(f"✅ PDF size > 1000 bytes")
                print("✅ TEST B PASSED: Returns 200 with valid PDF")
            else:
                print(f"❌ PDF size <= 1000 bytes")
        else:
            print(f"❌ TEST B FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
    except Exception as e:
        print(f"❌ TEST B ERROR: {e}")
    
    # TEST C: GET packet with bogus patient ID -> 404
    print("\n[TEST C] GET /api/pt/patients/nope123/packet/pdf WITH session -> expect 404")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/pt/patients/nope123/packet/pdf",
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 404:
            print("✅ TEST C PASSED: Returns 404 for bogus patient ID")
        else:
            print(f"❌ TEST C FAILED: Expected 404, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ TEST C ERROR: {e}")
    
    # TEST D: GET packet without session -> 401 or 302
    print("\n[TEST D] GET /api/pt/patients/{patient_id}/packet/pdf WITHOUT session -> expect 401 or 302")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/pt/patients/{patient_id}/packet/pdf",
            allow_redirects=False,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code in [401, 302]:
            print(f"✅ TEST D PASSED: Returns {resp.status_code} without session")
        else:
            print(f"❌ TEST D FAILED: Expected 401 or 302, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ TEST D ERROR: {e}")
    
    # Return note_id for use in Task 3
    return note_id

def test_single_note_pdf(cookies, note_id):
    """
    TASK 3 — Single-note PDF after refactor (/api/pt/notes/[id]/pdf) [MEDIUM]
    (A) Using a note id from Task 2A, GET /api/pt/notes/<id>/pdf WITH session -> 200, Content-Type application/pdf, %PDF, length > 1000
    (B) GET /api/pt/notes/bogus123/pdf (session) -> 404
    (C) WITHOUT session -> 401 or 302
    """
    print("\n" + "="*80)
    print("TASK 3 — Single-note PDF after refactor (/api/pt/notes/[id]/pdf)")
    print("="*80)
    
    if not note_id:
        print("❌ TASK 3 SKIPPED: No note ID from Task 2")
        return
    
    # TEST A: GET single note PDF with session
    print(f"\n[TEST A] GET /api/pt/notes/{note_id}/pdf WITH session -> expect 200 PDF")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/pt/notes/{note_id}/pdf",
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            content_type = resp.headers.get("Content-Type", "")
            print(f"Content-Type: {content_type}")
            
            # Check Content-Type
            if content_type == "application/pdf":
                print("✅ Content-Type is 'application/pdf'")
            else:
                print(f"❌ Content-Type is not 'application/pdf': {content_type}")
            
            # Check PDF magic bytes
            content = resp.content
            if len(content) >= 4:
                first_4_bytes = content[:4]
                print(f"First 4 bytes (hex): {first_4_bytes.hex()}")
                print(f"First 4 bytes (text): {first_4_bytes}")
                
                if first_4_bytes == b"%PDF":
                    print("✅ Body starts with '%PDF' (valid PDF magic bytes)")
                else:
                    print(f"❌ Body does NOT start with '%PDF': {first_4_bytes}")
            
            # Check length
            pdf_length = len(content)
            print(f"PDF size: {pdf_length:,} bytes")
            
            if pdf_length > 1000:
                print(f"✅ PDF size > 1000 bytes")
                print("✅ TEST A PASSED: Returns 200 with valid PDF")
            else:
                print(f"❌ PDF size <= 1000 bytes")
        else:
            print(f"❌ TEST A FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
    except Exception as e:
        print(f"❌ TEST A ERROR: {e}")
    
    # TEST B: GET with bogus note ID -> 404
    print("\n[TEST B] GET /api/pt/notes/bogus123/pdf WITH session -> expect 404")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/pt/notes/bogus123/pdf",
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 404:
            print("✅ TEST B PASSED: Returns 404 for bogus note ID")
        else:
            print(f"❌ TEST B FAILED: Expected 404, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ TEST B ERROR: {e}")
    
    # TEST C: GET without session -> 401 or 302
    print(f"\n[TEST C] GET /api/pt/notes/{note_id}/pdf WITHOUT session -> expect 401 or 302")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/pt/notes/{note_id}/pdf",
            allow_redirects=False,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code in [401, 302]:
            print(f"✅ TEST C PASSED: Returns {resp.status_code} without session")
        else:
            print(f"❌ TEST C FAILED: Expected 401 or 302, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ TEST C ERROR: {e}")

def main():
    print("="*80)
    print("BACKEND TEST - Round 4 PT Module (3 tasks)")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Auth: admin@proactiveclinic.com / apex123")
    
    # Login
    cookies = login()
    if not cookies:
        print("\n❌ FATAL: Login failed, cannot proceed with tests")
        sys.exit(1)
    
    # Run tests
    test_ai_codes_check(cookies)
    note_id = test_attorney_packet_pdf(cookies)
    test_single_note_pdf(cookies, note_id)
    
    print("\n" + "="*80)
    print("BACKEND TEST COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
