#!/usr/bin/env python3
"""
Backend test for Scheduling upgrades: slot suggestions, working-hours guard, drag auto-shift, double-book override
Tests steps A-J as specified in the review request.
"""

import requests
import json
import re
from typing import Dict, Any, Optional

# Base URL from .env: NEXT_PUBLIC_BASE_URL
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Staff credentials for authentication
STAFF_EMAIL = "admin@proactiveclinic.com"
STAFF_PASSWORD = "apex123"

session = requests.Session()

def login_staff() -> bool:
    """Login as staff to get session cookie"""
    try:
        print("\n=== STAFF LOGIN ===")
        url = f"{BASE_URL}/api/auth/login"
        payload = {"email": STAFF_EMAIL, "password": STAFF_PASSWORD}
        resp = session.post(url, json=payload, timeout=30)
        print(f"POST {url}")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            print("✅ Staff login successful")
            return True
        else:
            print(f"❌ Staff login failed: {resp.status_code} {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Staff login exception: {e}")
        return False

def get_setup_data() -> Dict[str, Any]:
    """Get providerId, serviceTypeId, and patientId for testing"""
    try:
        print("\n=== SETUP: GET PROVIDER, SERVICE, PATIENT ===")
        
        # Get providers and services
        url = f"{BASE_URL}/api/appointments?from=2100-01-01&to=2100-01-01"
        resp = session.get(url, timeout=30)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Failed to get appointments data: {resp.status_code}")
            return {}
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        providers = data.get("providers", [])
        services = data.get("services", [])
        
        print(f"Providers count: {len(providers)}")
        print(f"Services count: {len(services)}")
        
        if not providers:
            print("❌ No providers found")
            return {}
        
        provider_id = providers[0]["id"]
        print(f"Selected providerId: {provider_id}")
        
        service_id = services[0]["id"] if services else None
        if service_id:
            print(f"Selected serviceTypeId: {service_id}")
        
        # Get a patient
        url = f"{BASE_URL}/api/patients/search?q=a&limit=1"
        resp = session.get(url, timeout=30)
        print(f"\nGET {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ Failed to get patient: {resp.status_code}")
            return {}
        
        data = resp.json()
        patients = data.get("results", [])
        if not patients or len(patients) == 0:
            print("❌ No patients found")
            return {}
        
        patient_id = patients[0]["id"]
        print(f"Selected patientId: {patient_id}")
        
        print("✅ Setup data obtained successfully")
        return {
            "providerId": provider_id,
            "serviceTypeId": service_id,
            "patientId": patient_id
        }
    except Exception as e:
        print(f"❌ Setup exception: {e}")
        return {}

def test_step_a_slots(provider_id: str) -> bool:
    """(A) SLOTS: GET /api/appointments/slots?providerId=<pid>&day=2026-07-15&duration=30"""
    try:
        print("\n=== STEP A: SLOTS ENDPOINT ===")
        url = f"{BASE_URL}/api/appointments/slots?providerId={provider_id}&day=2026-07-15&duration=30"
        resp = session.get(url, timeout=30)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
        
        if resp.status_code != 200:
            print(f"❌ STEP A FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        
        # Assert response structure
        if "hours" not in data:
            print("❌ STEP A FAILED: Missing 'hours' in response")
            return False
        
        hours = data["hours"]
        if not isinstance(hours, dict) or "open" not in hours or "close" not in hours or "closed" not in hours:
            print(f"❌ STEP A FAILED: Invalid hours structure: {hours}")
            return False
        
        print(f"✅ hours structure valid: open={hours['open']}, close={hours['close']}, closed={hours['closed']}")
        
        if "slots" not in data or not isinstance(data["slots"], list):
            print("❌ STEP A FAILED: Missing or invalid 'slots' array")
            return False
        
        slots = data["slots"]
        if len(slots) == 0:
            print("❌ STEP A FAILED: slots array is empty")
            return False
        
        print(f"✅ slots array non-empty: {len(slots)} slots")
        
        # Check first slot structure
        first_slot = slots[0]
        if "time" not in first_slot or "label" not in first_slot or "free" not in first_slot or "min" not in first_slot:
            print(f"❌ STEP A FAILED: Invalid slot structure: {first_slot}")
            return False
        
        print(f"✅ First slot structure valid: {first_slot}")
        
        # Assert first slot time is '09:00'
        if first_slot["time"] != "09:00":
            print(f"❌ STEP A FAILED: Expected first slot.time='09:00', got '{first_slot['time']}'")
            return False
        
        print(f"✅ First slot.time === '09:00'")
        
        if "suggestions" not in data or not isinstance(data["suggestions"], list):
            print("❌ STEP A FAILED: Missing or invalid 'suggestions' array")
            return False
        
        suggestions = data["suggestions"]
        print(f"✅ suggestions array present: {len(suggestions)} suggestions")
        
        if len(suggestions) > 5:
            print(f"❌ STEP A FAILED: suggestions length {len(suggestions)} > 5")
            return False
        
        print(f"✅ suggestions length <= 5")
        
        if "duration" not in data or data["duration"] != 30:
            print(f"❌ STEP A FAILED: Expected duration=30, got {data.get('duration')}")
            return False
        
        print(f"✅ duration === 30")
        
        print("✅ STEP A PASSED: All assertions passed")
        return True
    except Exception as e:
        print(f"❌ STEP A EXCEPTION: {e}")
        return False

def test_step_b_slots_auth(provider_id: str) -> bool:
    """(B) SLOTS AUTH: same GET WITHOUT session -> 401"""
    try:
        print("\n=== STEP B: SLOTS AUTH (NO SESSION) ===")
        url = f"{BASE_URL}/api/appointments/slots?providerId={provider_id}&day=2026-07-15&duration=30"
        
        # Create a new session without cookies
        no_auth_session = requests.Session()
        resp = no_auth_session.get(url, timeout=30)
        print(f"GET {url} (no session)")
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        
        if resp.status_code != 401:
            print(f"❌ STEP B FAILED: Expected 401, got {resp.status_code}")
            return False
        
        print("✅ STEP B PASSED: Correctly returns 401 without session")
        return True
    except Exception as e:
        print(f"❌ STEP B EXCEPTION: {e}")
        return False

def test_step_c_slots_validation(provider_id: str) -> bool:
    """(C) SLOTS VALIDATION: GET /api/appointments/slots?providerId=<pid>&day=bad -> 400"""
    try:
        print("\n=== STEP C: SLOTS VALIDATION (INVALID DAY) ===")
        url = f"{BASE_URL}/api/appointments/slots?providerId={provider_id}&day=bad&duration=30"
        resp = session.get(url, timeout=30)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        
        if resp.status_code != 400:
            print(f"❌ STEP C FAILED: Expected 400, got {resp.status_code}")
            return False
        
        print("✅ STEP C PASSED: Correctly returns 400 for invalid day")
        return True
    except Exception as e:
        print(f"❌ STEP C EXCEPTION: {e}")
        return False

def test_step_d_create(provider_id: str, patient_id: str) -> Optional[str]:
    """(D) CREATE: POST /api/appointments {patientId, providerId, day, time} -> 200"""
    try:
        print("\n=== STEP D: CREATE APPOINTMENT ===")
        url = f"{BASE_URL}/api/appointments"
        payload = {
            "patientId": patient_id,
            "providerId": provider_id,
            "day": "2026-07-16",
            "time": "10:00"
        }
        resp = session.post(url, json=payload, timeout=30)
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
        
        if resp.status_code != 200:
            print(f"❌ STEP D FAILED: Expected 200, got {resp.status_code}")
            return None
        
        data = resp.json()
        
        if not data.get("ok"):
            print(f"❌ STEP D FAILED: ok is not true")
            return None
        
        if data.get("shifted") != False:
            print(f"❌ STEP D FAILED: Expected shifted=false, got {data.get('shifted')}")
            return None
        
        if data.get("time") != "10:00":
            print(f"❌ STEP D FAILED: Expected time='10:00', got '{data.get('time')}'")
            return None
        
        appointment_id = data.get("appointment", {}).get("id")
        if not appointment_id:
            print(f"❌ STEP D FAILED: No appointment.id in response")
            return None
        
        print(f"✅ STEP D PASSED: Appointment created with id={appointment_id}, shifted=false, time='10:00'")
        return appointment_id
    except Exception as e:
        print(f"❌ STEP D EXCEPTION: {e}")
        return None

def test_step_e_double_book_block(provider_id: str, patient_id: str) -> bool:
    """(E) DOUBLE-BOOK BLOCK: POST same time -> 409"""
    try:
        print("\n=== STEP E: DOUBLE-BOOK BLOCK ===")
        url = f"{BASE_URL}/api/appointments"
        payload = {
            "patientId": patient_id,
            "providerId": provider_id,
            "day": "2026-07-16",
            "time": "10:00"
        }
        resp = session.post(url, json=payload, timeout=30)
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
        
        if resp.status_code != 409:
            print(f"❌ STEP E FAILED: Expected 409, got {resp.status_code}")
            return False
        
        data = resp.json()
        
        if not data.get("conflict"):
            print(f"❌ STEP E FAILED: Expected conflict=true")
            return False
        
        error = data.get("error", "")
        if "Double-booking" not in error:
            print(f"❌ STEP E FAILED: Expected error to contain 'Double-booking', got '{error}'")
            return False
        
        print(f"✅ STEP E PASSED: Correctly returns 409 with conflict=true and error contains 'Double-booking'")
        return True
    except Exception as e:
        print(f"❌ STEP E EXCEPTION: {e}")
        return False

def test_step_f_double_book_override(provider_id: str, patient_id: str) -> Optional[str]:
    """(F) DOUBLE-BOOK OVERRIDE: POST same body + allowDoubleBook:true -> 200"""
    try:
        print("\n=== STEP F: DOUBLE-BOOK OVERRIDE ===")
        url = f"{BASE_URL}/api/appointments"
        payload = {
            "patientId": patient_id,
            "providerId": provider_id,
            "day": "2026-07-16",
            "time": "10:00",
            "allowDoubleBook": True
        }
        resp = session.post(url, json=payload, timeout=30)
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
        
        if resp.status_code != 200:
            print(f"❌ STEP F FAILED: Expected 200, got {resp.status_code}")
            return None
        
        data = resp.json()
        
        if not data.get("ok"):
            print(f"❌ STEP F FAILED: ok is not true")
            return None
        
        appointment_id = data.get("appointment", {}).get("id")
        if not appointment_id:
            print(f"❌ STEP F FAILED: No appointment.id in response")
            return None
        
        print(f"✅ STEP F PASSED: Double-book override successful, appointment id={appointment_id}")
        return appointment_id
    except Exception as e:
        print(f"❌ STEP F EXCEPTION: {e}")
        return None

def test_step_g_auto_shift_create(provider_id: str, patient_id: str) -> Optional[str]:
    """(G) AUTO-SHIFT create: POST with autoShift:true -> 200 with shifted:true"""
    try:
        print("\n=== STEP G: AUTO-SHIFT CREATE ===")
        url = f"{BASE_URL}/api/appointments"
        payload = {
            "patientId": patient_id,
            "providerId": provider_id,
            "day": "2026-07-16",
            "time": "10:00",
            "autoShift": True
        }
        resp = session.post(url, json=payload, timeout=30)
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
        
        if resp.status_code != 200:
            print(f"❌ STEP G FAILED: Expected 200, got {resp.status_code}")
            return None
        
        data = resp.json()
        
        if not data.get("ok"):
            print(f"❌ STEP G FAILED: ok is not true")
            return None
        
        if not data.get("shifted"):
            print(f"❌ STEP G FAILED: Expected shifted=true, got {data.get('shifted')}")
            return None
        
        time = data.get("time")
        if time == "10:00":
            print(f"❌ STEP G FAILED: Expected time != '10:00' (should be shifted), got '{time}'")
            return None
        
        appointment_id = data.get("appointment", {}).get("id")
        if not appointment_id:
            print(f"❌ STEP G FAILED: No appointment.id in response")
            return None
        
        print(f"✅ STEP G PASSED: Auto-shift create successful, id={appointment_id}, shifted=true, time='{time}' (shifted from 10:00)")
        return appointment_id
    except Exception as e:
        print(f"❌ STEP G EXCEPTION: {e}")
        return None

def test_step_h_reschedule_auto_shift(appt_id: str) -> bool:
    """(H) RESCHEDULE auto-shift: PATCH with autoShift:true -> 200"""
    try:
        print("\n=== STEP H: RESCHEDULE AUTO-SHIFT ===")
        url = f"{BASE_URL}/api/appointments"
        payload = {
            "id": appt_id,
            "day": "2026-07-16",
            "time": "10:30",
            "autoShift": True
        }
        resp = session.patch(url, json=payload, timeout=30)
        print(f"PATCH {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
        
        if resp.status_code != 200:
            print(f"❌ STEP H FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        
        if not data.get("ok"):
            print(f"❌ STEP H FAILED: ok is not true")
            return False
        
        # shifted can be true or false, both are fine
        shifted = data.get("shifted")
        print(f"✅ STEP H PASSED: Reschedule auto-shift successful, shifted={shifted}")
        return True
    except Exception as e:
        print(f"❌ STEP H EXCEPTION: {e}")
        return False

def test_step_i_reschedule_double_book(appt_id_a1: str, appt_id_a2: str) -> bool:
    """(I) RESCHEDULE double-book block then override"""
    try:
        print("\n=== STEP I: RESCHEDULE DOUBLE-BOOK BLOCK ===")
        url = f"{BASE_URL}/api/appointments"
        
        # First try without allowDoubleBook - should get 409
        payload = {
            "id": appt_id_a1,
            "day": "2026-07-16",
            "time": "10:00"
        }
        resp = session.patch(url, json=payload, timeout=30)
        print(f"PATCH {url} (without allowDoubleBook)")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
        
        if resp.status_code != 409:
            print(f"❌ STEP I (block) FAILED: Expected 409, got {resp.status_code}")
            return False
        
        data = resp.json()
        if not data.get("conflict"):
            print(f"❌ STEP I (block) FAILED: Expected conflict=true")
            return False
        
        print(f"✅ STEP I (block) PASSED: Correctly returns 409 with conflict=true")
        
        # Now try with allowDoubleBook - should succeed
        print("\n=== STEP I: RESCHEDULE DOUBLE-BOOK OVERRIDE ===")
        payload["allowDoubleBook"] = True
        resp = session.patch(url, json=payload, timeout=30)
        print(f"PATCH {url} (with allowDoubleBook)")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
        
        if resp.status_code != 200:
            print(f"❌ STEP I (override) FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        if not data.get("ok"):
            print(f"❌ STEP I (override) FAILED: ok is not true")
            return False
        
        print(f"✅ STEP I (override) PASSED: Double-book override successful")
        print("✅ STEP I PASSED: Both block and override working correctly")
        return True
    except Exception as e:
        print(f"❌ STEP I EXCEPTION: {e}")
        return False

def test_step_j_working_hours_out_of_range(provider_id: str, patient_id: str) -> bool:
    """(J) WORKING HOURS out-of-range: POST with time='21:00' -> 400"""
    try:
        print("\n=== STEP J: WORKING HOURS OUT-OF-RANGE ===")
        url = f"{BASE_URL}/api/appointments"
        payload = {
            "patientId": patient_id,
            "providerId": provider_id,
            "day": "2026-07-16",
            "time": "21:00"
        }
        resp = session.post(url, json=payload, timeout=30)
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {resp.status_code}")
        print(f"Response: {json.dumps(resp.json(), indent=2)}")
        
        if resp.status_code != 400:
            print(f"❌ STEP J FAILED: Expected 400, got {resp.status_code}")
            return False
        
        data = resp.json()
        error = data.get("error", "")
        # Should mention working hours, outside hours, or time restrictions (9:00 AM - 8:00 PM)
        if not any(keyword in error.lower() for keyword in ["hours", "between", "outside", "9:00", "8:00"]):
            print(f"❌ STEP J FAILED: Expected error to mention time restrictions, got '{error}'")
            return False
        
        print(f"✅ STEP J PASSED: Correctly returns 400 for out-of-hours time, error: '{error}'")
        return True
    except Exception as e:
        print(f"❌ STEP J EXCEPTION: {e}")
        return False

def cleanup_appointments(appt_ids: list) -> None:
    """Cleanup: PATCH each created appt {id, status:'cancelled'}"""
    try:
        print("\n=== CLEANUP: CANCEL APPOINTMENTS ===")
        url = f"{BASE_URL}/api/appointments"
        for appt_id in appt_ids:
            if appt_id:
                payload = {"id": appt_id, "status": "cancelled"}
                resp = session.patch(url, json=payload, timeout=30)
                print(f"PATCH {url} - Cancel {appt_id}: {resp.status_code}")
        print("✅ Cleanup completed")
    except Exception as e:
        print(f"⚠️ Cleanup exception: {e}")

def main():
    print("=" * 80)
    print("BACKEND TEST: Scheduling upgrades")
    print("=" * 80)
    
    # Login
    if not login_staff():
        print("\n❌ TEST SUITE FAILED: Could not login")
        return
    
    # Setup
    setup = get_setup_data()
    if not setup or not setup.get("providerId") or not setup.get("patientId"):
        print("\n❌ TEST SUITE FAILED: Could not get setup data")
        return
    
    provider_id = setup["providerId"]
    patient_id = setup["patientId"]
    
    # Track created appointments for cleanup
    created_appts = []
    
    # Run tests
    results = {}
    
    # Step A: Slots endpoint
    results["A"] = test_step_a_slots(provider_id)
    
    # Step B: Slots auth
    results["B"] = test_step_b_slots_auth(provider_id)
    
    # Step C: Slots validation
    results["C"] = test_step_c_slots_validation(provider_id)
    
    # Step D: Create appointment
    appt_a1 = test_step_d_create(provider_id, patient_id)
    results["D"] = appt_a1 is not None
    if appt_a1:
        created_appts.append(appt_a1)
    
    # Step E: Double-book block
    results["E"] = test_step_e_double_book_block(provider_id, patient_id)
    
    # Step F: Double-book override
    appt_a2 = test_step_f_double_book_override(provider_id, patient_id)
    results["F"] = appt_a2 is not None
    if appt_a2:
        created_appts.append(appt_a2)
    
    # Step G: Auto-shift create
    appt_a3 = test_step_g_auto_shift_create(provider_id, patient_id)
    results["G"] = appt_a3 is not None
    if appt_a3:
        created_appts.append(appt_a3)
    
    # Step H: Reschedule auto-shift
    if appt_a1:
        results["H"] = test_step_h_reschedule_auto_shift(appt_a1)
    else:
        results["H"] = False
        print("\n⚠️ STEP H SKIPPED: No appointment from step D")
    
    # Step I: Reschedule double-book block then override
    if appt_a1 and appt_a2:
        results["I"] = test_step_i_reschedule_double_book(appt_a1, appt_a2)
    else:
        results["I"] = False
        print("\n⚠️ STEP I SKIPPED: Missing appointments from steps D or F")
    
    # Step J: Working hours out-of-range
    results["J"] = test_step_j_working_hours_out_of_range(provider_id, patient_id)
    
    # Cleanup
    cleanup_appointments(created_appts)
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    for step, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"Step {step}: {status}")
    
    all_passed = all(results.values())
    print("\n" + "=" * 80)
    if all_passed:
        print("✅ ALL TESTS PASSED")
    else:
        print("❌ SOME TESTS FAILED")
    print("=" * 80)

if __name__ == "__main__":
    main()
