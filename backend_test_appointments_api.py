#!/usr/bin/env python3
"""
Backend test for rewritten Appointments API (schedule views + chart booking)
Tests GET list+refs, POST create, PATCH reschedule/cancel
"""

import requests
import json
from datetime import datetime

# Base URL from .env: NEXT_PUBLIC_BASE_URL
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def print_test(step, description):
    print(f"\n{'='*80}")
    print(f"TEST {step}: {description}")
    print('='*80)

def print_result(success, message, response=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if response:
        print(f"Status: {response.status_code}")
        try:
            print(f"Response: {json.dumps(response.json(), indent=2)[:500]}")
        except Exception:
            print(f"Response text: {response.text[:500]}")

# Step 0: Login as admin to get session cookie
print_test("0", "Login as admin@proactiveclinic.com to get session cookie")
try:
    login_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@proactiveclinic.com", "password": "apex123"},
        timeout=10
    )
    if login_resp.status_code == 200:
        session_cookie = login_resp.cookies.get("proactive_session")
        if session_cookie:
            print_result(True, f"Login successful, got session cookie", login_resp)
            cookies = {"proactive_session": session_cookie}
        else:
            print_result(False, "Login returned 200 but no session cookie found", login_resp)
            exit(1)
    else:
        print_result(False, f"Login failed with status {login_resp.status_code}", login_resp)
        exit(1)
except Exception as e:
    print_result(False, f"Login request failed: {str(e)}")
    exit(1)

# Test 1: GET /api/appointments WITHOUT auth cookie -> expect 401
print_test("1", "GET /api/appointments WITHOUT auth cookie -> expect 401")
try:
    resp = requests.get(f"{BASE_URL}/api/appointments", timeout=10)
    if resp.status_code == 401:
        print_result(True, "Correctly returned 401 Unauthorized without auth cookie", resp)
    else:
        print_result(False, f"Expected 401, got {resp.status_code}", resp)
except Exception as e:
    print_result(False, f"Request failed: {str(e)}")

# Test 2: GET /api/appointments (with cookie) -> expect 200 with appointments[], providers[], services[]
print_test("2", "GET /api/appointments (with cookie) -> expect 200 with appointments[], providers[], services[]")
try:
    resp = requests.get(f"{BASE_URL}/api/appointments", cookies=cookies, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        has_appointments = "appointments" in data and isinstance(data["appointments"], list)
        has_providers = "providers" in data and isinstance(data["providers"], list) and len(data["providers"]) > 0
        has_services = "services" in data and isinstance(data["services"], list) and len(data["services"]) > 0
        
        if has_appointments and has_providers and has_services:
            print_result(True, f"Got 200 with appointments[{len(data['appointments'])}], providers[{len(data['providers'])}], services[{len(data['services'])}]", resp)
            
            # Capture one provider id and one service id for later tests
            PROV = data["providers"][0]["id"]
            SVC = data["services"][0]["id"]
            SVC_DURATION = data["services"][0]["durationMin"]
            
            print(f"\n📋 Captured for later tests:")
            print(f"   Provider ID (PROV): {PROV}")
            print(f"   Service ID (SVC): {SVC}")
            print(f"   Service Duration: {SVC_DURATION} minutes")
        else:
            print_result(False, f"Missing required keys or empty arrays. appointments:{has_appointments}, providers:{has_providers}, services:{has_services}", resp)
            exit(1)
    else:
        print_result(False, f"Expected 200, got {resp.status_code}", resp)
        exit(1)
except Exception as e:
    print_result(False, f"Request failed: {str(e)}")
    exit(1)

# Test 3: GET /api/patients/search?q=Adams -> capture patient id
print_test("3", "GET /api/patients/search?q=Adams -> capture patient id (PID)")
try:
    resp = requests.get(f"{BASE_URL}/api/patients/search?q=Adams", cookies=cookies, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        # Handle both array and {results: []} formats
        results = data if isinstance(data, list) else data.get("results", [])
        if len(results) > 0:
            PID = results[0]["id"]
            patient_name = f"{results[0].get('firstName', '')} {results[0].get('lastName', '')}"
            print_result(True, f"Found patient: {patient_name} (ID: {PID})", resp)
        else:
            print_result(False, "No patients found with 'Adams'", resp)
            exit(1)
    else:
        print_result(False, f"Expected 200, got {resp.status_code}", resp)
        exit(1)
except Exception as e:
    print_result(False, f"Request failed: {str(e)}")
    exit(1)

# Test 4: GET /api/appointments?patientId=PID -> expect 200
print_test("4", f"GET /api/appointments?patientId={PID} -> expect 200 with appointments for that patient")
try:
    resp = requests.get(f"{BASE_URL}/api/appointments?patientId={PID}", cookies=cookies, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        appointments = data.get("appointments", [])
        # All appointments should belong to PID
        all_match = all(appt.get("patientId") == PID for appt in appointments)
        if all_match:
            print_result(True, f"Got 200 with {len(appointments)} appointments, all belong to patient {PID}", resp)
        else:
            print_result(False, f"Some appointments don't belong to patient {PID}", resp)
    else:
        print_result(False, f"Expected 200, got {resp.status_code}", resp)
except Exception as e:
    print_result(False, f"Request failed: {str(e)}")

# Test 5: POST /api/appointments with valid data -> expect 200 with appointment details
print_test("5", f"POST /api/appointments with valid data -> expect 200 with appointment.id, startsAt, endsAt")
try:
    post_data = {
        "patientId": PID,
        "providerId": PROV,
        "serviceTypeId": SVC,
        "day": "2026-08-20",
        "time": "10:00"
    }
    resp = requests.post(f"{BASE_URL}/api/appointments", json=post_data, cookies=cookies, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok") and "appointment" in data:
            appt = data["appointment"]
            AID = appt["id"]
            starts_at = appt["startsAt"]
            ends_at = appt["endsAt"]
            
            # Verify duration calculation
            start_time = datetime.fromisoformat(starts_at.replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(ends_at.replace('Z', '+00:00'))
            duration_minutes = (end_time - start_time).total_seconds() / 60
            
            if duration_minutes == SVC_DURATION:
                print_result(True, f"Created appointment {AID}. Duration calculation correct: {duration_minutes} min == {SVC_DURATION} min", resp)
                print(f"\n📋 Captured Appointment ID (AID): {AID}")
                print(f"   startsAt: {starts_at}")
                print(f"   endsAt: {ends_at}")
            else:
                print_result(False, f"Duration mismatch: got {duration_minutes} min, expected {SVC_DURATION} min", resp)
        else:
            print_result(False, "Response missing 'ok' or 'appointment'", resp)
            exit(1)
    else:
        print_result(False, f"Expected 200, got {resp.status_code}", resp)
        exit(1)
except Exception as e:
    print_result(False, f"Request failed: {str(e)}")
    exit(1)

# Test 6: POST /api/appointments with missing fields -> expect 400
print_test("6", "POST /api/appointments with missing providerId/day/time -> expect 400")
try:
    post_data = {"patientId": PID}  # Missing providerId, day, time
    resp = requests.post(f"{BASE_URL}/api/appointments", json=post_data, cookies=cookies, timeout=10)
    if resp.status_code == 400:
        print_result(True, "Correctly returned 400 for missing required fields", resp)
    else:
        print_result(False, f"Expected 400, got {resp.status_code}", resp)
except Exception as e:
    print_result(False, f"Request failed: {str(e)}")

# Test 7: PATCH /api/appointments with reschedule -> expect 200
print_test("7", f"PATCH /api/appointments to reschedule to 2026-08-21 14:00 -> expect 200")
try:
    patch_data = {
        "id": AID,
        "day": "2026-08-21",
        "time": "14:00"
    }
    resp = requests.patch(f"{BASE_URL}/api/appointments", json=patch_data, cookies=cookies, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok") and "appointment" in data:
            appt = data["appointment"]
            starts_at = appt["startsAt"]
            ends_at = appt["endsAt"]
            
            # Verify the new time
            start_time = datetime.fromisoformat(starts_at.replace('Z', '+00:00'))
            expected_date = "2026-08-21"
            expected_time = "14:00"
            
            # Check if date and time match (accounting for timezone)
            actual_date = start_time.strftime("%Y-%m-%d")
            actual_time = start_time.strftime("%H:%M")
            
            # Calculate duration
            end_time = datetime.fromisoformat(ends_at.replace('Z', '+00:00'))
            duration_minutes = (end_time - start_time).total_seconds() / 60
            
            print_result(True, f"Rescheduled successfully. New startsAt: {starts_at} (date: {actual_date}, time: {actual_time}), duration: {duration_minutes} min", resp)
            print(f"   Expected: {expected_date} {expected_time}")
            print(f"   Got: {actual_date} {actual_time}")
        else:
            print_result(False, "Response missing 'ok' or 'appointment'", resp)
    else:
        print_result(False, f"Expected 200, got {resp.status_code}", resp)
except Exception as e:
    print_result(False, f"Request failed: {str(e)}")

# Test 8: PATCH /api/appointments with status change -> expect 200
print_test("8", f"PATCH /api/appointments to set status='cancelled' -> expect 200")
try:
    patch_data = {
        "id": AID,
        "status": "cancelled"
    }
    resp = requests.patch(f"{BASE_URL}/api/appointments", json=patch_data, cookies=cookies, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok") and "appointment" in data:
            appt = data["appointment"]
            status = appt.get("status")
            if status == "cancelled":
                print_result(True, f"Status updated to 'cancelled' successfully", resp)
            else:
                print_result(False, f"Status is '{status}', expected 'cancelled'", resp)
        else:
            print_result(False, "Response missing 'ok' or 'appointment'", resp)
    else:
        print_result(False, f"Expected 200, got {resp.status_code}", resp)
except Exception as e:
    print_result(False, f"Request failed: {str(e)}")

# Test 9: PATCH /api/appointments with bogus id -> expect 404
print_test("9", "PATCH /api/appointments with bogus id -> expect 404")
try:
    patch_data = {
        "id": "bogus123",
        "status": "completed"
    }
    resp = requests.patch(f"{BASE_URL}/api/appointments", json=patch_data, cookies=cookies, timeout=10)
    if resp.status_code == 404:
        print_result(True, "Correctly returned 404 for non-existent appointment", resp)
    else:
        print_result(False, f"Expected 404, got {resp.status_code}", resp)
except Exception as e:
    print_result(False, f"Request failed: {str(e)}")

# Test 10: PATCH /api/appointments without id -> expect 400
print_test("10", "PATCH /api/appointments without id -> expect 400")
try:
    patch_data = {"status": "completed"}  # Missing id
    resp = requests.patch(f"{BASE_URL}/api/appointments", json=patch_data, cookies=cookies, timeout=10)
    if resp.status_code == 400:
        print_result(True, "Correctly returned 400 for missing id", resp)
    else:
        print_result(False, f"Expected 400, got {resp.status_code}", resp)
except Exception as e:
    print_result(False, f"Request failed: {str(e)}")

print("\n" + "="*80)
print("ALL TESTS COMPLETED")
print("="*80)
