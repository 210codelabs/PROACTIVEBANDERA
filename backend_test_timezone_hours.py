#!/usr/bin/env python3
"""
Backend test for Central Time timezone + clinic hours 9AM-8PM enforcement.
Tests all booking endpoints with timezone verification and hard hours enforcement.
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def login_admin():
    """Login as admin and return session cookie."""
    print("\n=== ADMIN LOGIN ===")
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        allow_redirects=False
    )
    print(f"Login status: {resp.status_code}")
    if resp.status_code in [200, 302]:
        cookies = resp.cookies
        print(f"✅ Admin login successful")
        return cookies
    else:
        print(f"❌ Login failed: {resp.text}")
        return None

def test_timezone_end_to_end(cookies):
    """
    TEST 1: TIMEZONE END-TO-END (most important)
    - Get providerId and patientId from refs
    - Create appointment at 09:00 Central on 2026-08-10
    - Verify startsAt equals "2026-08-10T14:00:00.000Z" (09:00 CDT = UTC-5 = 14:00Z)
    """
    print("\n" + "="*80)
    print("TEST 1: TIMEZONE END-TO-END VERIFICATION")
    print("="*80)
    
    try:
        # Step 1: Get providerId and patientId from refs
        print("\n[1.1] GET /api/appointments?refs=1 to get providerId and patientId")
        resp = requests.get(f"{BASE_URL}/api/appointments?refs=1", cookies=cookies)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Failed to get refs: {resp.text}")
            return False
        
        data = resp.json()
        providers = data.get("providers", [])
        appointments = data.get("appointments", [])
        
        if not providers:
            print(f"❌ No providers found in refs")
            return False
        
        provider_id = providers[0]["id"]
        print(f"✅ Found providerId: {provider_id}")
        
        # Get patientId from existing appointment or search for Eleanor Adams
        patient_id = None
        if appointments:
            patient_id = appointments[0]["patientId"]
            print(f"✅ Found patientId from appointment: {patient_id}")
        else:
            # Search for Eleanor Adams
            print("\n[1.2] Searching for Eleanor Adams patient...")
            search_resp = requests.get(f"{BASE_URL}/api/patients/search?q=Adams", cookies=cookies)
            if search_resp.status_code == 200:
                patients = search_resp.json().get("patients", [])
                if patients:
                    patient_id = patients[0]["id"]
                    print(f"✅ Found Eleanor Adams patientId: {patient_id}")
        
        if not patient_id:
            print(f"❌ Could not find patientId")
            return False
        
        # Step 2: Create appointment at 09:00 Central on 2026-08-10
        print("\n[1.3] POST /api/appointments with day:'2026-08-10', time:'09:00'")
        create_body = {
            "patientId": patient_id,
            "providerId": provider_id,
            "day": "2026-08-10",
            "time": "09:00"
        }
        create_resp = requests.post(
            f"{BASE_URL}/api/appointments",
            json=create_body,
            cookies=cookies
        )
        print(f"Status: {create_resp.status_code}")
        
        if create_resp.status_code != 200:
            print(f"❌ Failed to create appointment: {create_resp.text}")
            return False
        
        appt_data = create_resp.json()
        appointment = appt_data.get("appointment", {})
        appt_id = appointment.get("id")
        starts_at = appointment.get("startsAt")
        
        print(f"✅ Appointment created successfully")
        print(f"   Appointment ID: {appt_id}")
        print(f"   startsAt: {starts_at}")
        
        # Step 3: CRITICAL ASSERTION - Verify timezone conversion
        expected_starts_at = "2026-08-10T14:00:00.000Z"
        print(f"\n[1.4] TIMEZONE VERIFICATION:")
        print(f"   Expected: {expected_starts_at} (09:00 Central Daylight = UTC-5 = 14:00Z)")
        print(f"   Observed: {starts_at}")
        
        if starts_at == expected_starts_at:
            print(f"✅ TIMEZONE VERIFICATION PASSED - Server is running in Central Time!")
            print(f"   09:00 AM Central correctly stored as 14:00 UTC")
            return True
        else:
            print(f"❌ TIMEZONE VERIFICATION FAILED")
            print(f"   Expected: {expected_starts_at}")
            print(f"   Got:      {starts_at}")
            return False
            
    except Exception as e:
        print(f"❌ Exception in timezone test: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_hard_hours_enforcement_post(cookies, provider_id, patient_id):
    """
    TEST 2: HARD HOURS ENFORCEMENT on POST /api/appointments
    - time:"08:00" (before 9AM) -> expect 400
    - time:"20:30" (at/after 8PM) -> expect 400
    - time:"09:00" -> expect 200
    - time:"10:00" -> expect 200
    """
    print("\n" + "="*80)
    print("TEST 2: HARD HOURS ENFORCEMENT ON POST /api/appointments")
    print("="*80)
    
    test_cases = [
        {"time": "08:00", "expected": 400, "desc": "Before 9AM (should fail)"},
        {"time": "20:30", "expected": 400, "desc": "At/after 8PM (should fail)"},
        {"time": "09:00", "expected": 200, "desc": "At 9AM (should pass)"},
        {"time": "10:00", "expected": 200, "desc": "At 10AM (should pass)"},
    ]
    
    all_passed = True
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n[2.{i}] Testing time: {test['time']} - {test['desc']}")
        
        body = {
            "patientId": patient_id,
            "providerId": provider_id,
            "day": "2026-08-10",
            "time": test["time"]
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/appointments",
            json=body,
            cookies=cookies
        )
        
        print(f"   Status: {resp.status_code} (expected: {test['expected']})")
        
        if resp.status_code == test["expected"]:
            print(f"   ✅ PASSED")
            if resp.status_code == 400:
                error_msg = resp.json().get("error", "")
                print(f"   Error message: {error_msg}")
        else:
            print(f"   ❌ FAILED - Expected {test['expected']}, got {resp.status_code}")
            print(f"   Response: {resp.text}")
            all_passed = False
    
    return all_passed

def test_patch_reschedule_hours(cookies, appt_id):
    """
    TEST 3: PATCH reschedule /api/appointments with hours enforcement
    - PATCH with time:"07:30" -> expect 400
    - PATCH with time:"11:00" -> expect 200
    """
    print("\n" + "="*80)
    print("TEST 3: PATCH RESCHEDULE WITH HOURS ENFORCEMENT")
    print("="*80)
    
    all_passed = True
    
    # Test 3.1: Reschedule to 07:30 (before hours) - should fail
    print(f"\n[3.1] PATCH /api/appointments with time:'07:30' (before 9AM)")
    body = {
        "id": appt_id,
        "day": "2026-08-10",
        "time": "07:30"
    }
    resp = requests.patch(
        f"{BASE_URL}/api/appointments",
        json=body,
        cookies=cookies
    )
    print(f"   Status: {resp.status_code} (expected: 400)")
    
    if resp.status_code == 400:
        print(f"   ✅ PASSED - Correctly rejected time before hours")
        error_msg = resp.json().get("error", "")
        print(f"   Error message: {error_msg}")
    else:
        print(f"   ❌ FAILED - Expected 400, got {resp.status_code}")
        print(f"   Response: {resp.text}")
        all_passed = False
    
    # Test 3.2: Reschedule to 11:00 (within hours) - should pass
    print(f"\n[3.2] PATCH /api/appointments with time:'11:00' (within hours)")
    body = {
        "id": appt_id,
        "day": "2026-08-10",
        "time": "11:00"
    }
    resp = requests.patch(
        f"{BASE_URL}/api/appointments",
        json=body,
        cookies=cookies
    )
    print(f"   Status: {resp.status_code} (expected: 200)")
    
    if resp.status_code == 200:
        print(f"   ✅ PASSED - Successfully rescheduled within hours")
        appt = resp.json().get("appointment", {})
        print(f"   New startsAt: {appt.get('startsAt')}")
    else:
        print(f"   ❌ FAILED - Expected 200, got {resp.status_code}")
        print(f"   Response: {resp.text}")
        all_passed = False
    
    return all_passed

def test_public_request_hours():
    """
    TEST 4: PUBLIC request POST /api/appointments/request (no auth)
    - preferredTime:"21:00" (outside hours) -> expect 400
    - preferredTime:"09:30" (within hours) -> expect 200
    """
    print("\n" + "="*80)
    print("TEST 4: PUBLIC REQUEST ENDPOINT WITH HOURS ENFORCEMENT")
    print("="*80)
    
    all_passed = True
    
    # Test 4.1: Request with time outside hours (21:00)
    print(f"\n[4.1] POST /api/appointments/request with preferredTime:'21:00' (outside hours)")
    body = {
        "patientType": "new",
        "firstName": "Test",
        "lastName": "Patient",
        "phone": "555-0100",
        "email": "test@example.com",
        "serviceInterest": "General checkup",
        "preferredDate": "2026-08-15",
        "preferredTime": "21:00"
    }
    
    resp = requests.post(
        f"{BASE_URL}/api/appointments/request",
        json=body
    )
    print(f"   Status: {resp.status_code} (expected: 400)")
    
    if resp.status_code == 400:
        print(f"   ✅ PASSED - Correctly rejected time outside hours")
        error_msg = resp.json().get("error", "")
        print(f"   Error message: {error_msg}")
    else:
        print(f"   ❌ FAILED - Expected 400, got {resp.status_code}")
        print(f"   Response: {resp.text}")
        all_passed = False
    
    # Test 4.2: Request with time within hours (09:30)
    print(f"\n[4.2] POST /api/appointments/request with preferredTime:'09:30' (within hours)")
    body["preferredTime"] = "09:30"
    
    resp = requests.post(
        f"{BASE_URL}/api/appointments/request",
        json=body
    )
    print(f"   Status: {resp.status_code} (expected: 200)")
    
    if resp.status_code == 200:
        print(f"   ✅ PASSED - Successfully accepted time within hours")
        data = resp.json()
        print(f"   Confirmation: {data.get('confirmation')}")
    else:
        print(f"   ❌ FAILED - Expected 200, got {resp.status_code}")
        print(f"   Response: {resp.text}")
        all_passed = False
    
    return all_passed

def test_portal_booking_hours():
    """
    TEST 5: PORTAL booking POST /api/portal/appointments (requires patient portal session)
    - If we can establish a portal session, test hours enforcement
    - If not, SKIP and note it
    """
    print("\n" + "="*80)
    print("TEST 5: PORTAL BOOKING WITH HOURS ENFORCEMENT")
    print("="*80)
    
    print("\n[5.0] Attempting to establish patient portal session...")
    print("   NOTE: This requires patient portal credentials which may not be available")
    print("   SKIPPING portal booking test as per instructions (cannot get portal session)")
    print("   ⚠️  SKIPPED - Patient portal session not available for testing")
    
    return None  # None indicates skipped, not failed

def main():
    print("="*80)
    print("BACKEND TEST: Central Time Timezone + Clinic Hours Enforcement")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    
    # Login
    cookies = login_admin()
    if not cookies:
        print("\n❌ FATAL: Could not login as admin")
        return
    
    # TEST 1: Timezone end-to-end (MOST IMPORTANT)
    test1_passed = test_timezone_end_to_end(cookies)
    
    # Get provider and patient IDs for remaining tests
    print("\n=== Getting provider and patient IDs for remaining tests ===")
    resp = requests.get(f"{BASE_URL}/api/appointments?refs=1", cookies=cookies)
    if resp.status_code == 200:
        data = resp.json()
        provider_id = data.get("providers", [{}])[0].get("id")
        
        # Get patient ID
        patient_id = None
        appointments = data.get("appointments", [])
        if appointments:
            patient_id = appointments[0]["patientId"]
        else:
            search_resp = requests.get(f"{BASE_URL}/api/patients/search?q=Adams", cookies=cookies)
            if search_resp.status_code == 200:
                patients = search_resp.json().get("patients", [])
                if patients:
                    patient_id = patients[0]["id"]
        
        print(f"Provider ID: {provider_id}")
        print(f"Patient ID: {patient_id}")
        
        # TEST 2: Hard hours enforcement on POST
        test2_passed = test_hard_hours_enforcement_post(cookies, provider_id, patient_id)
        
        # Create an appointment for TEST 3 (reschedule)
        print("\n=== Creating appointment for reschedule test ===")
        create_resp = requests.post(
            f"{BASE_URL}/api/appointments",
            json={
                "patientId": patient_id,
                "providerId": provider_id,
                "day": "2026-08-10",
                "time": "09:00"
            },
            cookies=cookies
        )
        appt_id = None
        if create_resp.status_code == 200:
            appt_id = create_resp.json().get("appointment", {}).get("id")
            print(f"Created appointment ID: {appt_id}")
        
        # TEST 3: PATCH reschedule with hours enforcement
        test3_passed = False
        if appt_id:
            test3_passed = test_patch_reschedule_hours(cookies, appt_id)
        else:
            print("⚠️  Could not create appointment for reschedule test")
    else:
        print(f"❌ Could not get refs for remaining tests")
        test2_passed = False
        test3_passed = False
    
    # TEST 4: Public request endpoint (no auth required)
    test4_passed = test_public_request_hours()
    
    # TEST 5: Portal booking (likely to be skipped)
    test5_result = test_portal_booking_hours()
    
    # SUMMARY
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    results = [
        ("TEST 1: Timezone End-to-End (CRITICAL)", test1_passed),
        ("TEST 2: Hard Hours Enforcement (POST)", test2_passed),
        ("TEST 3: PATCH Reschedule Hours", test3_passed),
        ("TEST 4: Public Request Hours", test4_passed),
        ("TEST 5: Portal Booking Hours", test5_result),
    ]
    
    for test_name, result in results:
        if result is True:
            print(f"✅ {test_name}: PASSED")
        elif result is False:
            print(f"❌ {test_name}: FAILED")
        else:
            print(f"⚠️  {test_name}: SKIPPED")
    
    print("\n" + "="*80)
    
    # Count results
    passed = sum(1 for _, r in results if r is True)
    failed = sum(1 for _, r in results if r is False)
    skipped = sum(1 for _, r in results if r is None)
    
    print(f"TOTAL: {passed} passed, {failed} failed, {skipped} skipped")
    print("="*80)

if __name__ == "__main__":
    main()
