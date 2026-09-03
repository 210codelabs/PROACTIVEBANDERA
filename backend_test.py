#!/usr/bin/env python3
"""
Backend test for: Working hours editor API (GET/PUT /api/providers/hours) + recurring series + waitlist
Tests A/B/C steps as specified in test_result.md
"""
import requests
import json
import time
from datetime import datetime

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com/api"

# Test data storage
test_data = {
    "session_cookie": None,
    "provider_id": None,
    "service_type_id": None,
    "patient_id": None,
    "created_appointments": [],
    "waitlist_entries": []
}

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def login():
    """Authenticate and get session cookie"""
    log("=== AUTHENTICATION ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        log(f"POST /api/auth/login -> {resp.status_code}")
        if resp.status_code == 200:
            # Get session cookie
            cookies = resp.cookies
            if cookies:
                test_data["session_cookie"] = cookies
                log(f"✅ Authentication successful, session cookie obtained")
                return True
        log(f"❌ Authentication failed: {resp.status_code} {resp.text[:200]}")
        return False
    except Exception as e:
        log(f"❌ Authentication error: {e}")
        return False

def setup_test_data():
    """Get providerId, serviceTypeId, and patientId for tests"""
    log("\n=== SETUP: Getting test data ===")
    
    # Get providerId and serviceTypeId from appointments endpoint
    try:
        resp = requests.get(
            f"{BASE_URL}/appointments?from=2100-01-01&to=2100-01-01",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"GET /api/appointments?from=2100-01-01&to=2100-01-01 -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("providers") and len(data["providers"]) > 0:
                test_data["provider_id"] = data["providers"][0]["id"]
                log(f"✅ Provider ID: {test_data['provider_id']}")
            if data.get("services") and len(data["services"]) > 0:
                test_data["service_type_id"] = data["services"][0]["id"]
                log(f"✅ Service Type ID: {test_data['service_type_id']}")
        else:
            log(f"❌ Failed to get appointments data: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ Error getting appointments data: {e}")
        return False
    
    # Get patientId from patients search
    try:
        resp = requests.get(
            f"{BASE_URL}/patients/search?q=a&limit=1",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"GET /api/patients/search?q=a&limit=1 -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("results") and len(data["results"]) > 0:
                test_data["patient_id"] = data["results"][0]["id"]
                log(f"✅ Patient ID: {test_data['patient_id']}")
            else:
                log(f"❌ No patients found in search results")
                return False
        else:
            log(f"❌ Failed to get patient data: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ Error getting patient data: {e}")
        return False
    
    return True

def test_working_hours():
    """Test A: Working hours editor API"""
    log("\n=== TEST A: WORKING HOURS ===")
    
    # A1: GET /api/providers/hours -> 200 with workingHours null initially, clinicDefault
    log("\nA1: GET /api/providers/hours (initial state)")
    try:
        resp = requests.get(
            f"{BASE_URL}/providers/hours",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"GET /api/providers/hours -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            # Check structure
            if "clinicDefault" in data and data["clinicDefault"].get("open") == 540 and data["clinicDefault"].get("close") == 1200:
                log(f"✅ A1 PASS: clinicDefault correct (open:540, close:1200)")
            else:
                log(f"❌ A1 FAIL: clinicDefault incorrect: {data.get('clinicDefault')}")
            # workingHours can be null or an object
            log(f"   workingHours: {data.get('workingHours')}")
        else:
            log(f"❌ A1 FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ A1 ERROR: {e}")
    
    # A2: GET without session -> 401
    log("\nA2: GET /api/providers/hours without session")
    try:
        resp = requests.get(f"{BASE_URL}/providers/hours", timeout=10)
        log(f"GET /api/providers/hours (no auth) -> {resp.status_code}")
        if resp.status_code == 401:
            log(f"✅ A2 PASS: 401 Unauthorized without session")
        else:
            log(f"❌ A2 FAIL: Expected 401, got {resp.status_code}")
    except Exception as e:
        log(f"❌ A2 ERROR: {e}")
    
    # A3: PUT /api/providers/hours with custom Monday hours
    log("\nA3: PUT /api/providers/hours with custom Monday hours (open:600/10:00, close:900/15:00)")
    try:
        resp = requests.put(
            f"{BASE_URL}/providers/hours",
            json={
                "providerId": test_data["provider_id"],
                "workingHours": {
                    "1": {"open": 600, "close": 900, "closed": False}
                }
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"PUT /api/providers/hours -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            if data.get("ok") and data.get("workingHours", {}).get("1", {}).get("open") == 600:
                log(f"✅ A3 PASS: Custom Monday hours set (open:600, close:900)")
            else:
                log(f"❌ A3 FAIL: workingHours not set correctly: {data}")
        else:
            log(f"❌ A3 FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ A3 ERROR: {e}")
    
    # A4: GET /api/providers/hours?providerId= reflects custom hours
    log("\nA4: GET /api/providers/hours?providerId= (verify custom hours)")
    try:
        resp = requests.get(
            f"{BASE_URL}/providers/hours?providerId={test_data['provider_id']}",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"GET /api/providers/hours?providerId={test_data['provider_id']} -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response workingHours: {json.dumps(data.get('workingHours'), indent=2)}")
            if data.get("workingHours", {}).get("1", {}).get("open") == 600 and data.get("workingHours", {}).get("1", {}).get("close") == 900:
                log(f"✅ A4 PASS: Custom Monday hours reflected (open:600, close:900)")
            else:
                log(f"❌ A4 FAIL: Custom hours not reflected: {data.get('workingHours')}")
        else:
            log(f"❌ A4 FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ A4 ERROR: {e}")
    
    # A5: Verify appointment guard honors custom hours
    log("\nA5: Verify appointment guard honors custom Monday hours")
    
    # Try to book at 15:30 (outside Monday hours 10:00-15:00) -> should be 400
    log("A5a: POST appointment on Monday 2026-07-20 at 15:30 (outside hours)")
    try:
        resp = requests.post(
            f"{BASE_URL}/appointments",
            json={
                "patientId": test_data["patient_id"],
                "providerId": test_data["provider_id"],
                "day": "2026-07-20",  # Monday
                "time": "15:30"
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"POST /api/appointments (15:30) -> {resp.status_code}")
        log(f"Response: {resp.text[:300]}")
        if resp.status_code == 400:
            log(f"✅ A5a PASS: 400 for time outside working hours (15:30)")
        else:
            log(f"❌ A5a FAIL: Expected 400, got {resp.status_code}")
    except Exception as e:
        log(f"❌ A5a ERROR: {e}")
    
    # Try to book at 10:00 (within Monday hours 10:00-15:00) -> should be 200
    log("A5b: POST appointment on Monday 2026-07-20 at 10:00 (within hours)")
    try:
        resp = requests.post(
            f"{BASE_URL}/appointments",
            json={
                "patientId": test_data["patient_id"],
                "providerId": test_data["provider_id"],
                "day": "2026-07-20",  # Monday
                "time": "10:00"
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"POST /api/appointments (10:00) -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            if data.get("ok") and data.get("appointment", {}).get("id"):
                appt_id = data["appointment"]["id"]
                test_data["created_appointments"].append(appt_id)
                log(f"✅ A5b PASS: 200 for time within working hours (10:00), appointment ID: {appt_id}")
            else:
                log(f"❌ A5b FAIL: Response missing ok/appointment.id: {data}")
        else:
            log(f"❌ A5b FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ A5b ERROR: {e}")
    
    # A6: PUT workingHours:null to reset to clinic default
    log("\nA6: PUT /api/providers/hours with workingHours:null (reset to clinic default)")
    try:
        resp = requests.put(
            f"{BASE_URL}/providers/hours",
            json={
                "providerId": test_data["provider_id"],
                "workingHours": None
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"PUT /api/providers/hours (reset) -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            if data.get("ok") and data.get("workingHours") is None:
                log(f"✅ A6 PASS: workingHours reset to null (clinic default)")
            else:
                log(f"❌ A6 FAIL: workingHours not null: {data}")
        else:
            log(f"❌ A6 FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ A6 ERROR: {e}")

def test_recurring_series():
    """Test B: Recurring series"""
    log("\n=== TEST B: RECURRING SERIES ===")
    
    # B1: POST /api/appointments/series with freq:'weekly', occurrences:4
    log("\nB1: POST /api/appointments/series (weekly, 4 occurrences)")
    try:
        resp = requests.post(
            f"{BASE_URL}/appointments/series",
            json={
                "patientId": test_data["patient_id"],
                "providerId": test_data["provider_id"],
                "day": "2026-08-03",
                "time": "09:00",
                "freq": "weekly",
                "occurrences": 4,
                "autoShift": True
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"POST /api/appointments/series -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            if data.get("ok") and data.get("createdCount") == 4:
                log(f"✅ B1 PASS: createdCount=4")
                # Check days are 7 apart
                created = data.get("created", [])
                if len(created) == 4:
                    days = [c["day"] for c in created]
                    log(f"   Created days: {days}")
                    # Expected: 2026-08-03, 08-10, 08-17, 08-24
                    expected_days = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"]
                    if days == expected_days:
                        log(f"✅ B1 PASS: Days are 7 apart (weekly): {days}")
                    else:
                        log(f"⚠️ B1 WARNING: Days don't match expected weekly pattern. Expected: {expected_days}, Got: {days}")
                    # Store IDs for cleanup
                    for c in created:
                        test_data["created_appointments"].append(c["id"])
                else:
                    log(f"❌ B1 FAIL: Expected 4 created appointments, got {len(created)}")
            else:
                log(f"❌ B1 FAIL: Expected ok:true and createdCount:4, got: {data}")
        else:
            log(f"❌ B1 FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ B1 ERROR: {e}")
    
    # B2: POST /api/appointments/series with freq:'biweekly', occurrences:3
    log("\nB2: POST /api/appointments/series (biweekly, 3 occurrences)")
    try:
        resp = requests.post(
            f"{BASE_URL}/appointments/series",
            json={
                "patientId": test_data["patient_id"],
                "providerId": test_data["provider_id"],
                "day": "2026-09-07",
                "time": "11:00",
                "freq": "biweekly",
                "occurrences": 3,
                "autoShift": True
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"POST /api/appointments/series -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            if data.get("ok") and data.get("createdCount") == 3:
                log(f"✅ B2 PASS: createdCount=3")
                # Check days are 14 apart
                created = data.get("created", [])
                if len(created) == 3:
                    days = [c["day"] for c in created]
                    log(f"   Created days: {days}")
                    # Expected: 2026-09-07, 09-21, 10-05 (14 days apart)
                    expected_days = ["2026-09-07", "2026-09-21", "2026-10-05"]
                    if days == expected_days:
                        log(f"✅ B2 PASS: Days are 14 apart (biweekly): {days}")
                    else:
                        log(f"⚠️ B2 WARNING: Days don't match expected biweekly pattern. Expected: {expected_days}, Got: {days}")
                    # Store IDs for cleanup
                    for c in created:
                        test_data["created_appointments"].append(c["id"])
                else:
                    log(f"❌ B2 FAIL: Expected 3 created appointments, got {len(created)}")
            else:
                log(f"❌ B2 FAIL: Expected ok:true and createdCount:3, got: {data}")
        else:
            log(f"❌ B2 FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ B2 ERROR: {e}")
    
    # B3: POST /api/appointments/series missing providerId -> 400
    log("\nB3: POST /api/appointments/series missing providerId (validation)")
    try:
        resp = requests.post(
            f"{BASE_URL}/appointments/series",
            json={
                "patientId": test_data["patient_id"],
                # Missing providerId
                "day": "2026-10-01",
                "time": "14:00",
                "freq": "weekly",
                "occurrences": 2
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"POST /api/appointments/series (missing providerId) -> {resp.status_code}")
        if resp.status_code == 400:
            log(f"✅ B3 PASS: 400 for missing providerId")
        else:
            log(f"❌ B3 FAIL: Expected 400, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ B3 ERROR: {e}")

def test_waitlist():
    """Test C: Waitlist + cancel-offer"""
    log("\n=== TEST C: WAITLIST + CANCEL-OFFER ===")
    
    # C1: POST /api/waitlist
    log("\nC1: POST /api/waitlist (create waitlist entry)")
    waitlist_id = None
    try:
        resp = requests.post(
            f"{BASE_URL}/waitlist",
            json={
                "patientId": test_data["patient_id"],
                "providerId": test_data["provider_id"],
                "reason": "wants earlier PT"
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"POST /api/waitlist -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            if data.get("ok") and data.get("id"):
                waitlist_id = data["id"]
                test_data["waitlist_entries"].append(waitlist_id)
                log(f"✅ C1 PASS: Waitlist entry created, ID: {waitlist_id}")
            else:
                log(f"❌ C1 FAIL: Response missing ok/id: {data}")
        else:
            log(f"❌ C1 FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ C1 ERROR: {e}")
    
    if not waitlist_id:
        log("⚠️ Skipping C2-C6 because waitlist entry was not created")
        return
    
    # C2: GET /api/waitlist -> includes entry with names
    log("\nC2: GET /api/waitlist (verify entry with names)")
    try:
        resp = requests.get(
            f"{BASE_URL}/waitlist",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"GET /api/waitlist -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            entries = data.get("entries", [])
            log(f"Response: {len(entries)} entries")
            # Find our entry
            our_entry = next((e for e in entries if e["id"] == waitlist_id), None)
            if our_entry:
                log(f"✅ C2 PASS: Waitlist entry found")
                log(f"   Entry: {json.dumps(our_entry, indent=2)}")
                if our_entry.get("patientName") and our_entry.get("providerName"):
                    log(f"✅ C2 PASS: Entry has patientName and providerName")
                else:
                    log(f"❌ C2 FAIL: Entry missing patientName or providerName")
            else:
                log(f"❌ C2 FAIL: Waitlist entry {waitlist_id} not found in list")
        else:
            log(f"❌ C2 FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ C2 ERROR: {e}")
    
    # C3: Create appointment then cancel -> waitlistOffer
    log("\nC3: Create appointment then cancel (verify waitlistOffer)")
    appt_id = None
    
    # Create appointment
    log("C3a: Create appointment for 2026-08-05 at 13:00")
    try:
        resp = requests.post(
            f"{BASE_URL}/appointments",
            json={
                "patientId": test_data["patient_id"],
                "providerId": test_data["provider_id"],
                "day": "2026-08-05",
                "time": "13:00"
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"POST /api/appointments -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("appointment", {}).get("id"):
                appt_id = data["appointment"]["id"]
                test_data["created_appointments"].append(appt_id)
                log(f"✅ C3a PASS: Appointment created, ID: {appt_id}")
            else:
                log(f"❌ C3a FAIL: Response missing ok/appointment.id: {data}")
        else:
            log(f"❌ C3a FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ C3a ERROR: {e}")
    
    if not appt_id:
        log("⚠️ Skipping C3b-C6 because appointment was not created")
        return
    
    # Cancel appointment
    log("C3b: Cancel appointment (verify waitlistOffer)")
    try:
        resp = requests.patch(
            f"{BASE_URL}/appointments",
            json={
                "id": appt_id,
                "status": "cancelled"
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"PATCH /api/appointments (cancel) -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            if data.get("ok"):
                log(f"✅ C3b PASS: Appointment cancelled")
                # Check waitlistOffer
                waitlist_offer = data.get("waitlistOffer")
                if waitlist_offer:
                    log(f"✅ C3b PASS: waitlistOffer is non-null")
                    log(f"   waitlistOffer: {json.dumps(waitlist_offer, indent=2)}")
                    if waitlist_offer.get("entryId") == waitlist_id:
                        log(f"✅ C3b PASS: waitlistOffer.entryId matches our waitlist entry ({waitlist_id})")
                    else:
                        log(f"❌ C3b FAIL: waitlistOffer.entryId ({waitlist_offer.get('entryId')}) doesn't match our entry ({waitlist_id})")
                    if waitlist_offer.get("day") == "2026-08-05" and waitlist_offer.get("time") == "13:00":
                        log(f"✅ C3b PASS: waitlistOffer day/time match cancelled appointment (2026-08-05/13:00)")
                    else:
                        log(f"❌ C3b FAIL: waitlistOffer day/time don't match: {waitlist_offer.get('day')}/{waitlist_offer.get('time')}")
                else:
                    log(f"❌ C3b FAIL: waitlistOffer is null or missing")
            else:
                log(f"❌ C3b FAIL: Response missing ok: {data}")
        else:
            log(f"❌ C3b FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ C3b ERROR: {e}")
    
    # C4: PATCH /api/waitlist/{id} {status:'filled'}
    log("\nC4: PATCH /api/waitlist/{id} (mark as filled)")
    try:
        resp = requests.patch(
            f"{BASE_URL}/waitlist/{waitlist_id}",
            json={
                "status": "filled",
                "filledApptId": "test"
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"PATCH /api/waitlist/{waitlist_id} -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            if data.get("ok"):
                log(f"✅ C4 PASS: Waitlist entry marked as filled")
            else:
                log(f"❌ C4 FAIL: Response missing ok: {data}")
        else:
            log(f"❌ C4 FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ C4 ERROR: {e}")
    
    # C5: GET /api/waitlist -> entry no longer listed
    log("\nC5: GET /api/waitlist (verify entry no longer listed)")
    try:
        resp = requests.get(
            f"{BASE_URL}/waitlist",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"GET /api/waitlist -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            entries = data.get("entries", [])
            log(f"Response: {len(entries)} entries")
            # Check our entry is NOT in the list
            our_entry = next((e for e in entries if e["id"] == waitlist_id), None)
            if not our_entry:
                log(f"✅ C5 PASS: Waitlist entry {waitlist_id} no longer in list (status=filled)")
            else:
                log(f"❌ C5 FAIL: Waitlist entry {waitlist_id} still in list: {our_entry}")
        else:
            log(f"❌ C5 FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ C5 ERROR: {e}")
    
    # C6: DELETE /api/waitlist/{id}
    log("\nC6: DELETE /api/waitlist/{id}")
    try:
        resp = requests.delete(
            f"{BASE_URL}/waitlist/{waitlist_id}",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"DELETE /api/waitlist/{waitlist_id} -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            if data.get("ok"):
                log(f"✅ C6 PASS: Waitlist entry deleted")
                # Remove from cleanup list
                if waitlist_id in test_data["waitlist_entries"]:
                    test_data["waitlist_entries"].remove(waitlist_id)
            else:
                log(f"❌ C6 FAIL: Response missing ok: {data}")
        else:
            log(f"❌ C6 FAIL: Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log(f"❌ C6 ERROR: {e}")

def cleanup():
    """Cancel all created appointments and delete waitlist entries"""
    log("\n=== CLEANUP ===")
    
    # Cancel appointments
    for appt_id in test_data["created_appointments"]:
        try:
            log(f"Cancelling appointment {appt_id}")
            resp = requests.patch(
                f"{BASE_URL}/appointments",
                json={"id": appt_id, "status": "cancelled"},
                cookies=test_data["session_cookie"],
                timeout=10
            )
            if resp.status_code == 200:
                log(f"✅ Cancelled appointment {appt_id}")
            else:
                log(f"⚠️ Failed to cancel appointment {appt_id}: {resp.status_code}")
        except Exception as e:
            log(f"⚠️ Error cancelling appointment {appt_id}: {e}")
    
    # Delete waitlist entries
    for entry_id in test_data["waitlist_entries"]:
        try:
            log(f"Deleting waitlist entry {entry_id}")
            resp = requests.delete(
                f"{BASE_URL}/waitlist/{entry_id}",
                cookies=test_data["session_cookie"],
                timeout=10
            )
            if resp.status_code == 200:
                log(f"✅ Deleted waitlist entry {entry_id}")
            else:
                log(f"⚠️ Failed to delete waitlist entry {entry_id}: {resp.status_code}")
        except Exception as e:
            log(f"⚠️ Error deleting waitlist entry {entry_id}: {e}")
    
    log(f"\n✅ Cleanup complete. Cancelled {len(test_data['created_appointments'])} appointments, deleted {len(test_data['waitlist_entries'])} waitlist entries.")

def main():
    log("=" * 80)
    log("BACKEND TEST: Working hours + recurring series + waitlist")
    log("=" * 80)
    
    # Step 1: Login
    if not login():
        log("\n❌ FATAL: Authentication failed, cannot proceed")
        return
    
    # Step 2: Setup test data
    if not setup_test_data():
        log("\n❌ FATAL: Failed to get test data, cannot proceed")
        return
    
    # Step 3: Run tests
    test_working_hours()
    test_recurring_series()
    test_waitlist()
    
    # Step 4: Cleanup
    cleanup()
    
    log("\n" + "=" * 80)
    log("TEST COMPLETE")
    log("=" * 80)

if __name__ == "__main__":
    main()
