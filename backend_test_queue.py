#!/usr/bin/env python3
"""
Backend test for Patient Queue / Waiting-Room Tracker
Tests all queue endpoints: GET/POST /api/queue, PATCH/DELETE /api/queue/[id]
"""

import requests
import json
from datetime import datetime, timedelta

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
STAFF_EMAIL = "admin@proactiveclinic.com"
STAFF_PASSWORD = "apex123"

def get_today():
    """Get today's date in YYYY-MM-DD format"""
    return datetime.now().strftime("%Y-%m-%d")

def login_staff():
    """Login as staff and return session"""
    session = requests.Session()
    response = session.post(
        f"{API_BASE}/auth/login",
        json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    if response.status_code != 200:
        print(f"❌ Staff login failed: {response.status_code} {response.text}")
        return None
    print(f"✅ Staff login successful")
    return session

def test_step_1_no_auth():
    """Step 1: GET /api/queue with NO cookie -> expect 401"""
    print("\n=== STEP 1: GET /api/queue without auth ===")
    try:
        response = requests.get(f"{API_BASE}/queue")
        if response.status_code == 401:
            print(f"✅ STEP 1 PASSED: GET /api/queue without auth returns 401")
            return True
        else:
            print(f"❌ STEP 1 FAILED: Expected 401, got {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ STEP 1 FAILED with exception: {e}")
        return False

def test_step_2_get_queue(session):
    """Step 2: Login as staff. GET /api/queue?day=<today> -> 200 with {day, entries, scheduled}"""
    print("\n=== STEP 2: GET /api/queue as staff ===")
    try:
        today = get_today()
        response = session.get(f"{API_BASE}/queue?day={today}")
        
        if response.status_code != 200:
            print(f"❌ STEP 2 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return False
        
        data = response.json()
        
        # Verify response structure
        if "day" not in data or "entries" not in data or "scheduled" not in data:
            print(f"❌ STEP 2 FAILED: Missing required fields in response")
            print(f"Response keys: {data.keys()}")
            return False
        
        if data["day"] != today:
            print(f"❌ STEP 2 FAILED: Expected day={today}, got {data['day']}")
            return False
        
        if not isinstance(data["entries"], list):
            print(f"❌ STEP 2 FAILED: entries is not an array")
            return False
        
        if not isinstance(data["scheduled"], list):
            print(f"❌ STEP 2 FAILED: scheduled is not an array")
            return False
        
        print(f"✅ STEP 2 PASSED: GET /api/queue returns 200 with day={today}, entries={len(data['entries'])}, scheduled={len(data['scheduled'])}")
        return True
        
    except Exception as e:
        print(f"❌ STEP 2 FAILED with exception: {e}")
        return False

def test_step_3_find_patient(session):
    """Step 3: Get a real patientId via search"""
    print("\n=== STEP 3: Find a real patient ===")
    try:
        # Try searching for 'a' first
        response = session.get(f"{API_BASE}/patients/search?q=a&limit=5")
        
        if response.status_code != 200:
            print(f"❌ STEP 3 FAILED: Search failed with {response.status_code}")
            return None
        
        data = response.json()
        
        if "results" in data and len(data["results"]) > 0:
            patient_id = data["results"][0]["id"]
            patient_name = f"{data['results'][0].get('firstName', '')} {data['results'][0].get('lastName', '')}"
            print(f"✅ STEP 3 PASSED: Found patient {patient_name} (ID: {patient_id})")
            return patient_id
        
        # Try 'Adams' if 'a' returns nothing
        response = session.get(f"{API_BASE}/patients/search?q=Adams&limit=5")
        if response.status_code == 200:
            data = response.json()
            if "results" in data and len(data["results"]) > 0:
                patient_id = data["results"][0]["id"]
                patient_name = f"{data['results'][0].get('firstName', '')} {data['results'][0].get('lastName', '')}"
                print(f"✅ STEP 3 PASSED: Found patient {patient_name} (ID: {patient_id})")
                return patient_id
        
        print(f"❌ STEP 3 FAILED: No patients found")
        return None
        
    except Exception as e:
        print(f"❌ STEP 3 FAILED with exception: {e}")
        return None

def test_step_4_create_queue_entry(session, patient_id):
    """Step 4: POST /api/queue {patientId, kind:'walkin', day:<today>} -> 200"""
    print("\n=== STEP 4: POST /api/queue (create walk-in entry) ===")
    try:
        today = get_today()
        response = session.post(
            f"{API_BASE}/queue",
            json={
                "patientId": patient_id,
                "kind": "walkin",
                "day": today
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 200:
            print(f"❌ STEP 4 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return None
        
        data = response.json()
        
        if not data.get("ok"):
            print(f"❌ STEP 4 FAILED: ok is not true")
            return None
        
        entry = data.get("entry")
        if not entry:
            print(f"❌ STEP 4 FAILED: No entry in response")
            return None
        
        # Verify entry fields
        if entry.get("status") != "waiting":
            print(f"❌ STEP 4 FAILED: Expected status='waiting', got {entry.get('status')}")
            return None
        
        if entry.get("kind") != "walkin":
            print(f"❌ STEP 4 FAILED: Expected kind='walkin', got {entry.get('kind')}")
            return None
        
        if not entry.get("patientName"):
            print(f"❌ STEP 4 FAILED: patientName is missing")
            return None
        
        if not entry.get("checkInAt"):
            print(f"❌ STEP 4 FAILED: checkInAt is missing")
            return None
        
        entry_id = entry.get("id")
        if not entry_id:
            print(f"❌ STEP 4 FAILED: entry id is missing")
            return None
        
        print(f"✅ STEP 4 PASSED: Created queue entry (ID: {entry_id}, status: {entry['status']}, kind: {entry['kind']}, patient: {entry['patientName']})")
        return entry_id
        
    except Exception as e:
        print(f"❌ STEP 4 FAILED with exception: {e}")
        return None

def test_step_5_duplicate_entry(session, patient_id):
    """Step 5: POST /api/queue again with SAME patientId+day -> 409"""
    print("\n=== STEP 5: POST /api/queue (duplicate check) ===")
    try:
        today = get_today()
        response = session.post(
            f"{API_BASE}/queue",
            json={
                "patientId": patient_id,
                "kind": "walkin",
                "day": today
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 409:
            data = response.json()
            if "error" in data:
                print(f"✅ STEP 5 PASSED: Duplicate entry correctly returns 409 with error: {data['error']}")
                return True
            else:
                print(f"❌ STEP 5 FAILED: 409 returned but no error message")
                return False
        else:
            print(f"❌ STEP 5 FAILED: Expected 409, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
    except Exception as e:
        print(f"❌ STEP 5 FAILED with exception: {e}")
        return False

def test_step_6_nonexistent_patient(session):
    """Step 6: POST /api/queue {patientId:'nonexistent-xyz', kind:'walkin'} -> 404"""
    print("\n=== STEP 6: POST /api/queue (nonexistent patient) ===")
    try:
        today = get_today()
        response = session.post(
            f"{API_BASE}/queue",
            json={
                "patientId": "nonexistent-xyz-12345",
                "kind": "walkin",
                "day": today
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 404:
            data = response.json()
            if "error" in data:
                print(f"✅ STEP 6 PASSED: Nonexistent patient correctly returns 404 with error: {data['error']}")
                return True
            else:
                print(f"❌ STEP 6 FAILED: 404 returned but no error message")
                return False
        else:
            print(f"❌ STEP 6 FAILED: Expected 404, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
    except Exception as e:
        print(f"❌ STEP 6 FAILED with exception: {e}")
        return False

def test_step_7_verify_entry_in_list(session, entry_id):
    """Step 7: GET /api/queue?day=<today> -> entries includes the created entry"""
    print("\n=== STEP 7: Verify entry appears in queue list ===")
    try:
        today = get_today()
        response = session.get(f"{API_BASE}/queue?day={today}")
        
        if response.status_code != 200:
            print(f"❌ STEP 7 FAILED: Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        entries = data.get("entries", [])
        
        # Find our entry
        found = False
        for entry in entries:
            if entry.get("id") == entry_id:
                found = True
                if entry.get("status") != "waiting":
                    print(f"❌ STEP 7 FAILED: Entry found but status is {entry.get('status')}, expected 'waiting'")
                    return False
                print(f"✅ STEP 7 PASSED: Entry {entry_id} found in queue with status 'waiting'")
                break
        
        if not found:
            print(f"❌ STEP 7 FAILED: Entry {entry_id} not found in queue list")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ STEP 7 FAILED with exception: {e}")
        return False

def test_step_8_patch_in_room(session, entry_id):
    """Step 8: PATCH /api/queue/{entryId} {status:'in-room'} -> 200"""
    print("\n=== STEP 8: PATCH /api/queue/{id} (status: in-room) ===")
    try:
        response = session.patch(
            f"{API_BASE}/queue/{entry_id}",
            json={"status": "in-room"},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 200:
            print(f"❌ STEP 8 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        entry = data.get("entry")
        
        if not entry:
            print(f"❌ STEP 8 FAILED: No entry in response")
            return False
        
        if entry.get("status") != "in-room":
            print(f"❌ STEP 8 FAILED: Expected status='in-room', got {entry.get('status')}")
            return False
        
        if not entry.get("inRoomAt"):
            print(f"❌ STEP 8 FAILED: inRoomAt is not set")
            return False
        
        print(f"✅ STEP 8 PASSED: Entry status updated to 'in-room', inRoomAt={entry['inRoomAt']}")
        return True
        
    except Exception as e:
        print(f"❌ STEP 8 FAILED with exception: {e}")
        return False

def test_step_9_patch_checked_out(session, entry_id):
    """Step 9: PATCH /api/queue/{entryId} {status:'checked-out'} -> 200"""
    print("\n=== STEP 9: PATCH /api/queue/{id} (status: checked-out) ===")
    try:
        response = session.patch(
            f"{API_BASE}/queue/{entry_id}",
            json={"status": "checked-out"},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 200:
            print(f"❌ STEP 9 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        entry = data.get("entry")
        
        if not entry:
            print(f"❌ STEP 9 FAILED: No entry in response")
            return False
        
        if entry.get("status") != "checked-out":
            print(f"❌ STEP 9 FAILED: Expected status='checked-out', got {entry.get('status')}")
            return False
        
        if not entry.get("checkOutAt"):
            print(f"❌ STEP 9 FAILED: checkOutAt is not set")
            return False
        
        print(f"✅ STEP 9 PASSED: Entry status updated to 'checked-out', checkOutAt={entry['checkOutAt']}")
        return True
        
    except Exception as e:
        print(f"❌ STEP 9 FAILED with exception: {e}")
        return False

def test_step_10_patch_invalid_status(session, entry_id):
    """Step 10: PATCH /api/queue/{entryId} {status:'bogus'} -> 400"""
    print("\n=== STEP 10: PATCH /api/queue/{id} (invalid status) ===")
    try:
        response = session.patch(
            f"{API_BASE}/queue/{entry_id}",
            json={"status": "bogus"},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 400:
            data = response.json()
            if "error" in data:
                print(f"✅ STEP 10 PASSED: Invalid status correctly returns 400 with error: {data['error']}")
                return True
            else:
                print(f"❌ STEP 10 FAILED: 400 returned but no error message")
                return False
        else:
            print(f"❌ STEP 10 FAILED: Expected 400, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
    except Exception as e:
        print(f"❌ STEP 10 FAILED with exception: {e}")
        return False

def test_step_11_scheduled_appointment(session):
    """Step 11: OPTIONAL - Test scheduled appointment check-in flow"""
    print("\n=== STEP 11: Scheduled appointment check-in (OPTIONAL) ===")
    try:
        today = get_today()
        
        # Get today's queue to see if there are any scheduled appointments
        response = session.get(f"{API_BASE}/queue?day={today}")
        if response.status_code != 200:
            print(f"⚠️ STEP 11 SKIPPED: Could not fetch queue")
            return True
        
        data = response.json()
        scheduled = data.get("scheduled", [])
        
        if len(scheduled) == 0:
            print(f"⚠️ STEP 11 SKIPPED: No scheduled appointments today")
            return True
        
        # Find a scheduled appointment that's not already queued
        appt = None
        for s in scheduled:
            if not s.get("alreadyQueued"):
                appt = s
                break
        
        if not appt:
            print(f"⚠️ STEP 11 SKIPPED: All scheduled appointments already queued")
            return True
        
        appt_id = appt["id"]
        patient_id = appt["patientId"]
        
        print(f"Found scheduled appointment: {appt_id} for patient {appt['patientName']}")
        
        # Check in the scheduled appointment
        response = session.post(
            f"{API_BASE}/queue",
            json={
                "patientId": patient_id,
                "appointmentId": appt_id,
                "kind": "scheduled",
                "day": today
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 200:
            print(f"❌ STEP 11 FAILED: Could not check in scheduled appointment: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        entry = data.get("entry")
        queue_entry_id = entry.get("id")
        
        print(f"✅ Created queue entry {queue_entry_id} for scheduled appointment")
        
        # Verify appointment status changed to 'checked-in'
        response = session.get(f"{API_BASE}/appointments?from={today}&to={today}")
        if response.status_code != 200:
            print(f"❌ STEP 11 FAILED: Could not fetch appointments")
            return False
        
        appts_data = response.json()
        appointments = appts_data.get("appointments", [])
        
        found_appt = None
        for a in appointments:
            if a.get("id") == appt_id:
                found_appt = a
                break
        
        if not found_appt:
            print(f"❌ STEP 11 FAILED: Could not find appointment {appt_id}")
            return False
        
        if found_appt.get("status") != "checked-in":
            print(f"❌ STEP 11 FAILED: Appointment status is {found_appt.get('status')}, expected 'checked-in'")
            return False
        
        print(f"✅ Appointment status is 'checked-in'")
        
        # Check out the queue entry
        response = session.patch(
            f"{API_BASE}/queue/{queue_entry_id}",
            json={"status": "checked-out"},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code != 200:
            print(f"❌ STEP 11 FAILED: Could not check out queue entry")
            return False
        
        print(f"✅ Checked out queue entry")
        
        # Verify appointment status changed to 'completed'
        response = session.get(f"{API_BASE}/appointments?from={today}&to={today}")
        if response.status_code != 200:
            print(f"❌ STEP 11 FAILED: Could not fetch appointments after checkout")
            return False
        
        appts_data = response.json()
        appointments = appts_data.get("appointments", [])
        
        found_appt = None
        for a in appointments:
            if a.get("id") == appt_id:
                found_appt = a
                break
        
        if not found_appt:
            print(f"❌ STEP 11 FAILED: Could not find appointment after checkout")
            return False
        
        if found_appt.get("status") != "completed":
            print(f"❌ STEP 11 FAILED: Appointment status is {found_appt.get('status')}, expected 'completed'")
            return False
        
        print(f"✅ STEP 11 PASSED: Scheduled appointment check-in flow works correctly")
        
        # Clean up
        session.delete(f"{API_BASE}/queue/{queue_entry_id}")
        
        return True
        
    except Exception as e:
        print(f"⚠️ STEP 11 SKIPPED with exception: {e}")
        return True  # Optional step, don't fail the whole test

def test_step_12_delete_entry(session, entry_id):
    """Step 12: DELETE /api/queue/{entryId} -> 200"""
    print("\n=== STEP 12: DELETE /api/queue/{id} ===")
    try:
        response = session.delete(f"{API_BASE}/queue/{entry_id}")
        
        if response.status_code != 200:
            print(f"❌ STEP 12 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        
        if not data.get("ok"):
            print(f"❌ STEP 12 FAILED: ok is not true")
            return False
        
        print(f"✅ STEP 12 PASSED: Queue entry {entry_id} deleted successfully")
        return True
        
    except Exception as e:
        print(f"❌ STEP 12 FAILED with exception: {e}")
        return False

def main():
    print("=" * 80)
    print("PATIENT QUEUE / WAITING-ROOM TRACKER - BACKEND TEST")
    print("=" * 80)
    
    results = []
    
    # Step 1: No auth
    results.append(("Step 1: GET /api/queue without auth", test_step_1_no_auth()))
    
    # Login
    session = login_staff()
    if not session:
        print("\n❌ CRITICAL: Could not login as staff. Aborting tests.")
        return
    
    # Step 2: Get queue
    results.append(("Step 2: GET /api/queue as staff", test_step_2_get_queue(session)))
    
    # Step 3: Find patient
    patient_id = test_step_3_find_patient(session)
    if not patient_id:
        print("\n❌ CRITICAL: Could not find a patient. Aborting tests.")
        return
    
    # Step 4: Create queue entry
    entry_id = test_step_4_create_queue_entry(session, patient_id)
    if not entry_id:
        print("\n❌ CRITICAL: Could not create queue entry. Aborting tests.")
        return
    
    # Step 5: Duplicate check
    results.append(("Step 5: Duplicate entry check", test_step_5_duplicate_entry(session, patient_id)))
    
    # Step 6: Nonexistent patient
    results.append(("Step 6: Nonexistent patient", test_step_6_nonexistent_patient(session)))
    
    # Step 7: Verify entry in list
    results.append(("Step 7: Verify entry in queue list", test_step_7_verify_entry_in_list(session, entry_id)))
    
    # Step 8: Patch to in-room
    results.append(("Step 8: PATCH status to in-room", test_step_8_patch_in_room(session, entry_id)))
    
    # Step 9: Patch to checked-out
    results.append(("Step 9: PATCH status to checked-out", test_step_9_patch_checked_out(session, entry_id)))
    
    # Step 10: Invalid status
    results.append(("Step 10: PATCH invalid status", test_step_10_patch_invalid_status(session, entry_id)))
    
    # Step 11: Scheduled appointment (optional)
    results.append(("Step 11: Scheduled appointment flow (OPTIONAL)", test_step_11_scheduled_appointment(session)))
    
    # Step 12: Delete entry
    results.append(("Step 12: DELETE queue entry", test_step_12_delete_entry(session, entry_id)))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️ {total - passed} test(s) failed")

if __name__ == "__main__":
    main()
