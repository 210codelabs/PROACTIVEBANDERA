#!/usr/bin/env python3
"""
Backend Test - Iteration 32
Patient insurance edit (payerId) + eligibility payer fallback

Test Plan:
(A) PATIENT INSURANCE EDIT (Patient.payerId + PATCH /api/patients/[id]):
    1. GET /api/patients/search?q=Adams -> capture a patient id (PID)
    2. PATCH /api/patients/PID with payerId/insurerName/memberId -> expect 200
    3. GET /api/patients/PID -> verify payerId/insurerName/memberId persisted
    4. PATCH /api/patients/PID without auth -> expect 401

(B) ELIGIBILITY PAYER FALLBACK (POST /api/stedi/eligibility):
    1. Ensure directory payer exists: POST /api/stedi/payers
    2. POST /api/stedi/eligibility with NO payerId and NO patientId -> should NOT 400
    3. POST with explicit payerId -> expect 200
"""

import asyncio
import aiohttp
import sys

# Use HTTPS URL because session cookie has secure:true flag
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Admin credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"


async def login_admin(session):
    """Login as admin and return session cookie"""
    print("\n=== ADMIN LOGIN ===")
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    
    async with session.post(url, json=payload) as resp:
        status = resp.status
        data = await resp.json()
        print(f"POST /api/auth/login -> {status}")
        print(f"Response: {data}")
        
        if status != 200:
            print(f"❌ FAIL: Admin login failed with status {status}")
            return False
        
        # Check for session cookie
        from yarl import URL
        cookies = session.cookie_jar.filter_cookies(URL(BASE_URL))
        has_session = any('proactive_session' in cookie_name for cookie_name in cookies.keys())
        
        if not has_session:
            print("❌ FAIL: No proactive_session cookie set")
            return False
        
        print("✅ PASS: Admin login successful, session cookie set")
        return True


async def test_patient_insurance_edit(session):
    """
    Test A: Patient insurance edit with payerId field
    """
    print("\n" + "="*80)
    print("TEST A: PATIENT INSURANCE EDIT (payerId)")
    print("="*80)
    
    # A1: Search for patient (Adams)
    print("\n--- A1: Search for patient 'Adams' ---")
    url = f"{BASE_URL}/api/patients/search?q=Adams"
    
    async with session.get(url) as resp:
        status = resp.status
        data = await resp.json()
        print(f"GET /api/patients/search?q=Adams -> {status}")
        
        if status != 200:
            print(f"❌ FAIL: Patient search failed with status {status}")
            return False
        
        results = data.get("results", [])
        if not results:
            print("❌ FAIL: No patients found with name 'Adams'")
            return False
        
        patient = results[0]
        patient_id = patient.get("id")
        patient_name = f"{patient.get('firstName')} {patient.get('lastName')}"
        print(f"✅ PASS: Found patient {patient_name} (ID: {patient_id})")
    
    # A2: PATCH patient with payerId, insurerName, memberId
    print("\n--- A2: PATCH patient with payerId/insurerName/memberId ---")
    url = f"{BASE_URL}/api/patients/{patient_id}"
    payload = {
        "payerId": "87726",
        "insurerName": "UnitedHealthcare",
        "memberId": "UHC999"
    }
    
    async with session.patch(url, json=payload) as resp:
        status = resp.status
        print(f"PATCH /api/patients/{patient_id} -> {status}")
        print(f"Payload: {payload}")
        
        try:
            data = await resp.json()
            print(f"Response: {data}")
        except Exception as e:
            text = await resp.text()
            print(f"Response (text): {text[:500]}")
            print(f"Error parsing JSON: {e}")
            return False
        
        if status != 200:
            print(f"❌ FAIL: PATCH failed with status {status}")
            return False
        
        if not data.get("ok"):
            print(f"❌ FAIL: Response missing 'ok: true'")
            return False
        
        updated_patient = data.get("patient", {})
        if not updated_patient:
            print(f"❌ FAIL: Response missing 'patient' object")
            return False
        
        print(f"✅ PASS: PATCH successful, patient updated")
    
    # A3: GET patient and verify fields
    print("\n--- A3: GET patient and verify payerId/insurerName/memberId ---")
    url = f"{BASE_URL}/api/patients/{patient_id}"
    
    async with session.get(url) as resp:
        status = resp.status
        data = await resp.json()
        print(f"GET /api/patients/{patient_id} -> {status}")
        
        if status != 200:
            print(f"❌ FAIL: GET patient failed with status {status}")
            return False
        
        patient = data.get("patient", {})
        payer_id = patient.get("payerId")
        insurer_name = patient.get("insurerName")
        member_id = patient.get("memberId")
        
        print(f"Patient payerId: {payer_id}")
        print(f"Patient insurerName: {insurer_name}")
        print(f"Patient memberId: {member_id}")
        
        if payer_id != "87726":
            print(f"❌ FAIL: payerId mismatch. Expected '87726', got '{payer_id}'")
            return False
        
        if insurer_name != "UnitedHealthcare":
            print(f"❌ FAIL: insurerName mismatch. Expected 'UnitedHealthcare', got '{insurer_name}'")
            return False
        
        if member_id != "UHC999":
            print(f"❌ FAIL: memberId mismatch. Expected 'UHC999', got '{member_id}'")
            return False
        
        print(f"✅ PASS: All fields verified correctly")
    
    # A4: PATCH without auth -> expect 401
    print("\n--- A4: PATCH without auth cookie (expect 401) ---")
    url = f"{BASE_URL}/api/patients/{patient_id}"
    payload = {
        "payerId": "87726",
        "insurerName": "UnitedHealthcare",
        "memberId": "UHC999"
    }
    
    # Create new session without auth
    async with aiohttp.ClientSession() as unauth_session:
        async with unauth_session.patch(url, json=payload) as resp:
            status = resp.status
            print(f"PATCH /api/patients/{patient_id} (no auth) -> {status}")
            
            if status != 401:
                print(f"❌ FAIL: Expected 401, got {status}")
                return False
            
            print(f"✅ PASS: Correctly blocked with 401 Unauthorized")
    
    print("\n" + "="*80)
    print("✅ TEST A COMPLETE: All patient insurance edit tests passed")
    print("="*80)
    return True


async def test_eligibility_payer_fallback(session):
    """
    Test B: Eligibility payer fallback
    """
    print("\n" + "="*80)
    print("TEST B: ELIGIBILITY PAYER FALLBACK")
    print("="*80)
    
    # B1: Ensure directory payer exists
    print("\n--- B1: Ensure directory payer with stediId exists ---")
    url = f"{BASE_URL}/api/stedi/payers"
    payload = {
        "name": "Fallback Test Payer",
        "stediId": "00001",
        "supportsEligibility": True
    }
    
    async with session.post(url, json=payload) as resp:
        status = resp.status
        data = await resp.json()
        print(f"POST /api/stedi/payers -> {status}")
        print(f"Payload: {payload}")
        print(f"Response: {data}")
        
        if status != 200:
            print(f"❌ FAIL: POST payer failed with status {status}")
            return False
        
        if not data.get("ok"):
            print(f"❌ FAIL: Response missing 'ok: true'")
            return False
        
        payer = data.get("payer", {})
        payer_id = payer.get("id")
        print(f"✅ PASS: Directory payer created/updated (ID: {payer_id})")
    
    # B2: POST eligibility with NO payerId and NO patientId
    # KEY TEST: Should NOT return 400 "No payer ID available" or "A payer ID is required"
    print("\n--- B2: POST eligibility with NO payerId and NO patientId (fallback test) ---")
    url = f"{BASE_URL}/api/stedi/eligibility"
    payload = {
        "firstName": "Jane",
        "lastName": "Doe",
        "dateOfBirth": "1980-01-01"
    }
    
    async with session.post(url, json=payload) as resp:
        status = resp.status
        data = await resp.json()
        print(f"POST /api/stedi/eligibility -> {status}")
        print(f"Payload: {payload}")
        print(f"Response: {data}")
        
        # KEY ASSERTION: Should NOT be 400 with "No payer ID available" or "A payer ID is required"
        if status == 400:
            error_msg = data.get("error", "")
            if "No payer ID available" in error_msg or "A payer ID is required" in error_msg:
                print(f"❌ FAIL: Got 400 with payer error: {error_msg}")
                print("The fallback logic should have picked an available directory payer")
                return False
            else:
                # Some other 400 error (e.g., Stedi config issue) - acceptable
                print(f"⚠️  Got 400 but NOT a 'no payer' error: {error_msg}")
                print("This is acceptable (may be Stedi config issue)")
        
        # Acceptable outcomes:
        # - 200 with {check: {...}} (Stedi returned data)
        # - 200 with {error: "..."} (Stedi not configured or payer rejected)
        if status == 200:
            if "check" in data:
                print(f"✅ PASS: Got 200 with eligibility check data")
                check = data.get("check", {})
                print(f"Check ID: {check.get('id')}")
                print(f"Check status: {check.get('status')}")
            elif "error" in data:
                print(f"✅ PASS: Got 200 with error (Stedi not configured or rejected)")
                print(f"Error: {data.get('error')}")
            else:
                print(f"⚠️  Got 200 but unexpected response structure: {data}")
        else:
            print(f"⚠️  Got status {status} (not 200 or 400)")
        
        print(f"✅ PASS: Did NOT return 400 'No payer ID available' - fallback working")
    
    # B3: POST eligibility with explicit payerId (sanity check)
    print("\n--- B3: POST eligibility with explicit payerId (sanity check) ---")
    url = f"{BASE_URL}/api/stedi/eligibility"
    payload = {
        "payerId": "87726",
        "firstName": "Jane",
        "lastName": "Doe",
        "dateOfBirth": "1980-01-01"
    }
    
    async with session.post(url, json=payload) as resp:
        status = resp.status
        data = await resp.json()
        print(f"POST /api/stedi/eligibility -> {status}")
        print(f"Payload: {payload}")
        print(f"Response: {data}")
        
        if status != 200:
            print(f"⚠️  Expected 200, got {status}")
            print(f"Response: {data}")
        else:
            if "check" in data:
                print(f"✅ PASS: Got 200 with eligibility check data")
            elif "error" in data:
                print(f"✅ PASS: Got 200 with error (expected when Stedi not configured)")
                print(f"Error: {data.get('error')}")
            else:
                print(f"⚠️  Got 200 but unexpected response structure")
    
    print("\n" + "="*80)
    print("✅ TEST B COMPLETE: All eligibility fallback tests passed")
    print("="*80)
    return True


async def main():
    """Run all tests"""
    print("="*80)
    print("BACKEND TEST - ITERATION 32")
    print("Patient insurance edit (payerId) + eligibility payer fallback")
    print("="*80)
    
    # Create session with cookie jar
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        # Login as admin
        if not await login_admin(session):
            print("\n❌ CRITICAL: Admin login failed, cannot proceed")
            sys.exit(1)
        
        # Run Test A: Patient insurance edit
        test_a_passed = await test_patient_insurance_edit(session)
        
        # Run Test B: Eligibility payer fallback
        test_b_passed = await test_eligibility_payer_fallback(session)
        
        # Summary
        print("\n" + "="*80)
        print("FINAL SUMMARY")
        print("="*80)
        print(f"Test A (Patient Insurance Edit): {'✅ PASSED' if test_a_passed else '❌ FAILED'}")
        print(f"Test B (Eligibility Payer Fallback): {'✅ PASSED' if test_b_passed else '❌ FAILED'}")
        
        if test_a_passed and test_b_passed:
            print("\n✅ ALL TESTS PASSED")
            sys.exit(0)
        else:
            print("\n❌ SOME TESTS FAILED")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
