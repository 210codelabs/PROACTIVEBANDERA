#!/usr/bin/env python3
"""
Backend test for TWO NEW appointment features:
1. Double-booking prevention on POST + PATCH /api/appointments (409 on provider overlap)
2. Recurring appointments — POST /api/appointments/recurring (repeating series)

Login: admin@proactiveclinic.com / apex123
Base URL: https://nextjs-ssr-stack.preview.emergentagent.com (HTTPS required for secure cookies)
"""

import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
LOGIN_EMAIL = "admin@proactiveclinic.com"
LOGIN_PASSWORD = "apex123"

session = requests.Session()

def login():
    """Login and get session cookie"""
    print("=" * 80)
    print("SETUP: Logging in as admin...")
    print("=" * 80)
    try:
        resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
            timeout=30
        )
        print(f"Login response: {resp.status_code}")
        if resp.status_code == 200:
            print("✅ Login successful")
            return True
        else:
            print(f"❌ Login failed: {resp.status_code} - {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False

def get_test_data():
    """Get providerId and patientId for testing"""
    print("\n" + "=" * 80)
    print("SETUP: Getting providerId and patientId...")
    print("=" * 80)
    
    # Get providerId from appointments refs
    try:
        resp = session.get(f"{BASE_URL}/api/appointments?refs=1", timeout=30)
        print(f"GET /api/appointments?refs=1: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            providers = data.get("providers", [])
            if providers:
                provider_id = providers[0]["id"]
                provider_name = f"{providers[0]['firstName']} {providers[0]['lastName']}"
                print(f"✅ Found providerId: {provider_id} ({provider_name})")
                print(f"   Total providers available: {len(providers)}")
                
                # Get a second provider for cross-provider test
                second_provider_id = None
                if len(providers) > 1:
                    second_provider_id = providers[1]["id"]
                    second_provider_name = f"{providers[1]['firstName']} {providers[1]['lastName']}"
                    print(f"✅ Found second providerId: {second_provider_id} ({second_provider_name})")
            else:
                print("❌ No providers found")
                return None, None, None
        else:
            print(f"❌ Failed to get providers: {resp.status_code}")
            return None, None, None
    except Exception as e:
        print(f"❌ Error getting providers: {e}")
        return None, None, None
    
    # Get patientId from search or existing appointments
    try:
        # Try search first
        resp = session.get(f"{BASE_URL}/api/patients/search?q=a", timeout=30)
        print(f"GET /api/patients/search?q=a: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            patients = data.get("patients", [])
            if patients:
                patient_id = patients[0]["id"]
                patient_name = f"{patients[0]['lastName']}, {patients[0]['firstName']}"
                print(f"✅ Found patientId: {patient_id} ({patient_name})")
                return provider_id, second_provider_id, patient_id
        
        # Fallback: get from existing appointments
        resp = session.get(f"{BASE_URL}/api/appointments", timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            appointments = data.get("appointments", [])
            if appointments:
                patient_id = appointments[0]["patientId"]
                print(f"✅ Found patientId from appointments: {patient_id}")
                return provider_id, second_provider_id, patient_id
        
        print("❌ No patients found")
        return None, None, None
    except Exception as e:
        print(f"❌ Error getting patient: {e}")
        return None, None, None

def test_double_booking_prevention(provider_id, second_provider_id, patient_id):
    """
    TEST GROUP A — Double-booking prevention (POST + PATCH /api/appointments)
    """
    print("\n" + "=" * 80)
    print("TEST GROUP A — DOUBLE-BOOKING PREVENTION")
    print("=" * 80)
    
    created_appts = []
    
    try:
        # TEST A1: Create first appointment at 10:00
        print("\n--- TEST A1: POST first appointment (2027-03-15 10:00) ---")
        resp = session.post(
            f"{BASE_URL}/api/appointments",
            json={
                "patientId": patient_id,
                "providerId": provider_id,
                "day": "2027-03-15",
                "time": "10:00"
            },
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            appt_a_id = data.get("appointment", {}).get("id")
            created_appts.append(appt_a_id)
            print(f"✅ TEST A1 PASSED: First appointment created (ID: {appt_a_id})")
        else:
            print(f"❌ TEST A1 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        # TEST A2: Try to create overlapping appointment at 10:15 (should conflict)
        print("\n--- TEST A2: POST overlapping appointment (2027-03-15 10:15) - expect 409 ---")
        resp = session.post(
            f"{BASE_URL}/api/appointments",
            json={
                "patientId": patient_id,
                "providerId": provider_id,
                "day": "2027-03-15",
                "time": "10:15"
            },
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 409:
            data = resp.json()
            if data.get("conflict") == True and "Double-booking" in data.get("error", ""):
                print(f"✅ TEST A2 PASSED: Correctly returned 409 with conflict:true")
                print(f"   Error message: {data.get('error')}")
            else:
                print(f"❌ TEST A2 FAILED: Got 409 but missing conflict:true or proper error message")
                print(f"   Response: {data}")
                return False
        else:
            print(f"❌ TEST A2 FAILED: Expected 409, got {resp.status_code}")
            return False
        
        # TEST A3: Create non-overlapping appointment at 11:30
        print("\n--- TEST A3: POST non-overlapping appointment (2027-03-15 11:30) ---")
        resp = session.post(
            f"{BASE_URL}/api/appointments",
            json={
                "patientId": patient_id,
                "providerId": provider_id,
                "day": "2027-03-15",
                "time": "11:30"
            },
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            appt_b_id = data.get("appointment", {}).get("id")
            created_appts.append(appt_b_id)
            print(f"✅ TEST A3 PASSED: Non-overlapping appointment created (ID: {appt_b_id})")
        else:
            print(f"❌ TEST A3 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        # TEST A4: Try to PATCH appointment B to overlap with A (should conflict)
        print("\n--- TEST A4: PATCH appointment B to 10:00 (onto A) - expect 409 ---")
        resp = session.patch(
            f"{BASE_URL}/api/appointments",
            json={
                "id": appt_b_id,
                "day": "2027-03-15",
                "time": "10:00"
            },
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 409:
            data = resp.json()
            if data.get("conflict") == True:
                print(f"✅ TEST A4 PASSED: PATCH correctly returned 409 with conflict:true")
            else:
                print(f"❌ TEST A4 FAILED: Got 409 but missing conflict:true")
                return False
        else:
            print(f"❌ TEST A4 FAILED: Expected 409, got {resp.status_code}")
            return False
        
        # TEST A5: PATCH appointment B to free slot at 13:00
        print("\n--- TEST A5: PATCH appointment B to 13:00 (free slot) ---")
        resp = session.patch(
            f"{BASE_URL}/api/appointments",
            json={
                "id": appt_b_id,
                "day": "2027-03-15",
                "time": "13:00"
            },
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            new_starts_at = data.get("appointment", {}).get("startsAt")
            print(f"✅ TEST A5 PASSED: Appointment B moved to 13:00")
            print(f"   New startsAt: {new_starts_at}")
        else:
            print(f"❌ TEST A5 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        # TEST A6: Cancel appointment A, then create new appointment at 10:00 (should succeed)
        print("\n--- TEST A6: Cancel A, then POST at 10:00 (cancelled must not block) ---")
        resp = session.patch(
            f"{BASE_URL}/api/appointments",
            json={
                "id": appt_a_id,
                "status": "cancelled"
            },
            timeout=30
        )
        print(f"Cancel A status: {resp.status_code}")
        
        if resp.status_code == 200:
            print(f"✅ Appointment A cancelled")
        else:
            print(f"❌ Failed to cancel appointment A: {resp.status_code}")
            return False
        
        # Now try to create at 10:00 again
        resp = session.post(
            f"{BASE_URL}/api/appointments",
            json={
                "patientId": patient_id,
                "providerId": provider_id,
                "day": "2027-03-15",
                "time": "10:00"
            },
            timeout=30
        )
        print(f"POST at 10:00 status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            appt_c_id = data.get("appointment", {}).get("id")
            created_appts.append(appt_c_id)
            print(f"✅ TEST A6 PASSED: Cancelled appointment does NOT block the slot")
            print(f"   New appointment created (ID: {appt_c_id})")
        else:
            print(f"❌ TEST A6 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        # TEST A7: Verify different provider at same time does NOT conflict
        if second_provider_id:
            print("\n--- TEST A7: POST with DIFFERENT provider at same time (13:00) ---")
            resp = session.post(
                f"{BASE_URL}/api/appointments",
                json={
                    "patientId": patient_id,
                    "providerId": second_provider_id,
                    "day": "2027-03-15",
                    "time": "13:00"
                },
                timeout=30
            )
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            
            if resp.status_code == 200:
                data = resp.json()
                appt_d_id = data.get("appointment", {}).get("id")
                created_appts.append(appt_d_id)
                print(f"✅ TEST A7 PASSED: Different provider at same time does NOT conflict")
                print(f"   Appointment created (ID: {appt_d_id})")
            else:
                print(f"❌ TEST A7 FAILED: Expected 200, got {resp.status_code}")
                return False
        else:
            print("\n--- TEST A7: SKIPPED (no second provider available) ---")
        
        # TEST A8: Verify clinic-hours still returns 400 (not 409)
        print("\n--- TEST A8: POST outside clinic hours (08:00) - expect 400 not 409 ---")
        resp = session.post(
            f"{BASE_URL}/api/appointments",
            json={
                "patientId": patient_id,
                "providerId": second_provider_id or provider_id,
                "day": "2027-03-15",
                "time": "08:00"
            },
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 400:
            data = resp.json()
            error_msg = data.get("error", "")
            if "9:00 AM" in error_msg or "8:00 PM" in error_msg or "clinic hours" in error_msg.lower():
                print(f"✅ TEST A8 PASSED: Clinic hours violation returns 400 (not 409)")
                print(f"   Error message: {error_msg}")
            else:
                print(f"⚠️  TEST A8 WARNING: Got 400 but error message unclear: {error_msg}")
        else:
            print(f"❌ TEST A8 FAILED: Expected 400, got {resp.status_code}")
            return False
        
        print("\n" + "=" * 80)
        print("✅ TEST GROUP A COMPLETE: All double-booking prevention tests PASSED")
        print("=" * 80)
        return True
        
    except Exception as e:
        print(f"\n❌ TEST GROUP A ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_recurring_appointments(provider_id, patient_id):
    """
    TEST GROUP B — Recurring series (POST /api/appointments/recurring)
    """
    print("\n" + "=" * 80)
    print("TEST GROUP B — RECURRING APPOINTMENTS")
    print("=" * 80)
    
    try:
        # TEST B1: No cookie (logout and test)
        print("\n--- TEST B1: POST /api/appointments/recurring without cookie - expect 401 ---")
        temp_session = requests.Session()
        resp = temp_session.post(
            f"{BASE_URL}/api/appointments/recurring",
            json={
                "patientId": patient_id,
                "providerId": provider_id,
                "day": "2027-04-05",
                "time": "09:00",
                "frequency": "weekly",
                "count": 4
            },
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print(f"✅ TEST B1 PASSED: Correctly returned 401 without auth cookie")
        else:
            print(f"❌ TEST B1 FAILED: Expected 401, got {resp.status_code}")
            return False
        
        # TEST B2: Create weekly recurring series (4 appointments)
        print("\n--- TEST B2: POST recurring weekly series (2027-04-05, 4 weeks) ---")
        resp = session.post(
            f"{BASE_URL}/api/appointments/recurring",
            json={
                "patientId": patient_id,
                "providerId": provider_id,
                "day": "2027-04-05",
                "time": "09:00",
                "frequency": "weekly",
                "count": 4
            },
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:1000]}")
        
        if resp.status_code == 200:
            data = resp.json()
            created = data.get("created", 0)
            skipped = data.get("skipped", 0)
            total = data.get("total", 0)
            details = data.get("details", {})
            
            print(f"   created: {created}")
            print(f"   skipped: {skipped}")
            print(f"   total: {total}")
            print(f"   details.created: {details.get('created', [])}")
            print(f"   details.skipped: {details.get('skipped', [])}")
            
            if created == 4 and skipped == 0 and total == 4:
                print(f"✅ TEST B2 PASSED: Created 4 weekly appointments, skipped 0")
            else:
                print(f"❌ TEST B2 FAILED: Expected created=4, skipped=0, total=4")
                print(f"   Got created={created}, skipped={skipped}, total={total}")
                return False
        else:
            print(f"❌ TEST B2 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        # TEST B3: POST same series again (should all be double-booked)
        print("\n--- TEST B3: POST SAME recurring series again - expect all skipped ---")
        resp = session.post(
            f"{BASE_URL}/api/appointments/recurring",
            json={
                "patientId": patient_id,
                "providerId": provider_id,
                "day": "2027-04-05",
                "time": "09:00",
                "frequency": "weekly",
                "count": 4
            },
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:1000]}")
        
        if resp.status_code == 200:
            data = resp.json()
            created = data.get("created", 0)
            skipped = data.get("skipped", 0)
            details = data.get("details", {})
            
            print(f"   created: {created}")
            print(f"   skipped: {skipped}")
            print(f"   details.skipped: {details.get('skipped', [])}")
            
            if created == 0 and skipped == 4:
                print(f"✅ TEST B3 PASSED: All 4 appointments skipped (double-booked)")
                # Verify skip reasons
                skipped_list = details.get("skipped", [])
                if all("double-booked" in s.get("reason", "") for s in skipped_list):
                    print(f"   All skip reasons correctly indicate 'double-booked'")
                else:
                    print(f"   ⚠️  Skip reasons: {skipped_list}")
            else:
                print(f"❌ TEST B3 FAILED: Expected created=0, skipped=4")
                print(f"   Got created={created}, skipped={skipped}")
                return False
        else:
            print(f"❌ TEST B3 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        # TEST B4: Missing field (omit time)
        print("\n--- TEST B4: POST recurring without 'time' field - expect 400 ---")
        resp = session.post(
            f"{BASE_URL}/api/appointments/recurring",
            json={
                "patientId": patient_id,
                "providerId": provider_id,
                "day": "2027-04-05",
                "frequency": "weekly",
                "count": 4
            },
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 400:
            data = resp.json()
            error_msg = data.get("error", "")
            if "missing" in error_msg.lower():
                print(f"✅ TEST B4 PASSED: Missing field returns 400")
                print(f"   Error: {error_msg}")
            else:
                print(f"⚠️  TEST B4 WARNING: Got 400 but error message unclear: {error_msg}")
        else:
            print(f"❌ TEST B4 FAILED: Expected 400, got {resp.status_code}")
            return False
        
        # TEST B5: Invalid frequency
        print("\n--- TEST B5: POST recurring with invalid frequency 'yearly' - expect 400 ---")
        resp = session.post(
            f"{BASE_URL}/api/appointments/recurring",
            json={
                "patientId": patient_id,
                "providerId": provider_id,
                "day": "2027-04-05",
                "time": "09:00",
                "frequency": "yearly",
                "count": 4
            },
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 400:
            data = resp.json()
            error_msg = data.get("error", "")
            if "frequency" in error_msg.lower() or "invalid" in error_msg.lower():
                print(f"✅ TEST B5 PASSED: Invalid frequency returns 400")
                print(f"   Error: {error_msg}")
            else:
                print(f"⚠️  TEST B5 WARNING: Got 400 but error message unclear: {error_msg}")
        else:
            print(f"❌ TEST B5 FAILED: Expected 400, got {resp.status_code}")
            return False
        
        # TEST B6: Clinic-hours skip (08:00 before 9AM)
        print("\n--- TEST B6: POST recurring at 08:00 (before 9AM) - expect all skipped ---")
        resp = session.post(
            f"{BASE_URL}/api/appointments/recurring",
            json={
                "patientId": patient_id,
                "providerId": provider_id,
                "day": "2027-04-06",
                "time": "08:00",
                "frequency": "daily",
                "count": 3
            },
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:1000]}")
        
        if resp.status_code == 200:
            data = resp.json()
            created = data.get("created", 0)
            skipped = data.get("skipped", 0)
            details = data.get("details", {})
            
            print(f"   created: {created}")
            print(f"   skipped: {skipped}")
            print(f"   details.skipped: {details.get('skipped', [])}")
            
            if created == 0 and skipped == 3:
                print(f"✅ TEST B6 PASSED: All 3 appointments skipped (outside clinic hours)")
                # Verify skip reasons mention hours
                skipped_list = details.get("skipped", [])
                if all("hours" in s.get("reason", "").lower() for s in skipped_list):
                    print(f"   All skip reasons correctly mention 'hours'")
                else:
                    print(f"   ⚠️  Skip reasons: {skipped_list}")
            else:
                print(f"❌ TEST B6 FAILED: Expected created=0, skipped=3")
                print(f"   Got created={created}, skipped={skipped}")
                return False
        else:
            print(f"❌ TEST B6 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        print("\n" + "=" * 80)
        print("✅ TEST GROUP B COMPLETE: All recurring appointment tests PASSED")
        print("=" * 80)
        return True
        
    except Exception as e:
        print(f"\n❌ TEST GROUP B ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "=" * 80)
    print("BACKEND TEST: Double-booking Prevention + Recurring Appointments")
    print("=" * 80)
    
    # Login
    if not login():
        print("\n❌ FATAL: Login failed")
        sys.exit(1)
    
    # Get test data
    provider_id, second_provider_id, patient_id = get_test_data()
    if not provider_id or not patient_id:
        print("\n❌ FATAL: Could not get required test data")
        sys.exit(1)
    
    # Run tests
    test_a_passed = test_double_booking_prevention(provider_id, second_provider_id, patient_id)
    test_b_passed = test_recurring_appointments(provider_id, patient_id)
    
    # Summary
    print("\n" + "=" * 80)
    print("FINAL SUMMARY")
    print("=" * 80)
    if test_a_passed and test_b_passed:
        print("✅ ALL TESTS PASSED")
        print("   - Double-booking prevention: WORKING")
        print("   - Recurring appointments: WORKING")
        sys.exit(0)
    else:
        print("❌ SOME TESTS FAILED")
        if not test_a_passed:
            print("   - Double-booking prevention: FAILED")
        if not test_b_passed:
            print("   - Recurring appointments: FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
