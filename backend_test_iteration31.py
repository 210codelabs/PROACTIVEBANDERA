#!/usr/bin/env python3
"""
Backend test for Iteration 31: Appointment check-in endpoint
POST /api/appointments/[id]/checkin

Test cases:
1. POST without auth cookie -> 401
2. POST with bogus appointment id -> 404 with {error:"Appointment not found"}
3. Find a real appointment (Eleanor Adams on 2026-08-15), POST -> 200, status "checked-in"
4. POST same id again -> 200, still "checked-in"
"""

import requests
import json
from pymongo import MongoClient

# Base URL - using HTTPS because session cookie has secure:true flag
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Staff credentials
STAFF_EMAIL = "admin@proactiveclinic.com"
STAFF_PASSWORD = "apex123"

def print_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {name}")
    if details:
        print(f"  {details}")

def staff_login():
    """Login as staff and return session cookie"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
            timeout=10
        )
        print(f"\nStaff login: {resp.status_code}")
        if resp.status_code == 200:
            cookie = resp.cookies.get("proactive_session")
            print(f"  Got session cookie: {cookie[:20]}..." if cookie else "  No cookie!")
            return cookie
        else:
            print(f"  Login failed: {resp.text}")
            return None
    except Exception as e:
        print(f"  Login error: {e}")
        return None

def find_eleanor_appointment():
    """Find Eleanor Adams' appointment via MongoDB"""
    try:
        client = MongoClient("mongodb://localhost:27017/proactive_clinic?replicaSet=rs0")
        db = client.proactive_clinic
        
        # First find Eleanor Adams
        patient = db.Patient.find_one({"lastName": {"$regex": "Adams", "$options": "i"}})
        if not patient:
            print("  Eleanor Adams not found in database")
            return None
        
        patient_id = patient["_id"]
        print(f"\n  Found Eleanor Adams: {patient['firstName']} {patient['lastName']} (ID: {patient_id})")
        
        # Find an appointment for Eleanor on 2026-08-15
        appointments = list(db.Appointment.find({"patientId": patient_id}).sort("startsAt", -1))
        print(f"  Found {len(appointments)} appointments for Eleanor")
        
        if appointments:
            # Return the first appointment
            appt = appointments[0]
            print(f"  Using appointment ID: {appt['_id']}")
            print(f"  Appointment date: {appt.get('startsAt')}")
            print(f"  Current status: {appt.get('status')}")
            return appt["_id"]
        else:
            print("  No appointments found for Eleanor")
            return None
            
    except Exception as e:
        print(f"  Database error: {e}")
        return None

def main():
    print("=" * 80)
    print("ITERATION 31: Appointment Check-in Endpoint Test")
    print("=" * 80)
    
    # Test 1: POST without auth -> 401
    print("\n" + "=" * 80)
    print("TEST 1: POST /api/appointments/nope123/checkin WITHOUT auth cookie")
    print("=" * 80)
    try:
        resp = requests.post(
            f"{BASE_URL}/api/appointments/nope123/checkin",
            json={},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
        
        passed = resp.status_code == 401
        print_test(
            "POST without auth returns 401",
            passed,
            f"Expected 401, got {resp.status_code}"
        )
    except Exception as e:
        print_test("POST without auth returns 401", False, f"Error: {e}")
    
    # Login as staff
    print("\n" + "=" * 80)
    print("STAFF LOGIN")
    print("=" * 80)
    session_cookie = staff_login()
    if not session_cookie:
        print("\n❌ CRITICAL: Staff login failed. Cannot continue tests.")
        return
    
    cookies = {"proactive_session": session_cookie}
    
    # Test 2: POST with bogus id -> 404
    print("\n" + "=" * 80)
    print("TEST 2: POST /api/appointments/nope123/checkin WITH auth (bogus ID)")
    print("=" * 80)
    try:
        resp = requests.post(
            f"{BASE_URL}/api/appointments/nope123/checkin",
            json={},
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
        
        passed = resp.status_code == 404
        if passed and resp.headers.get("content-type", "").startswith("application/json"):
            data = resp.json()
            has_error = "error" in data and "not found" in data["error"].lower()
            print_test(
                "POST with bogus ID returns 404 with error message",
                has_error,
                f"Response: {data}"
            )
        else:
            print_test(
                "POST with bogus ID returns 404",
                passed,
                f"Expected 404, got {resp.status_code}"
            )
    except Exception as e:
        print_test("POST with bogus ID returns 404", False, f"Error: {e}")
    
    # Test 3: Find real appointment and check-in
    print("\n" + "=" * 80)
    print("TEST 3: Find Eleanor Adams' appointment and check-in")
    print("=" * 80)
    
    appointment_id = find_eleanor_appointment()
    if not appointment_id:
        print("\n❌ CRITICAL: Could not find Eleanor's appointment. Cannot continue.")
        return
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/appointments/{appointment_id}/checkin",
            json={},
            cookies=cookies,
            timeout=10
        )
        print(f"\nStatus: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"\nFull response structure:")
            print(f"  ok: {data.get('ok')}")
            print(f"  appointment.status: {data.get('appointment', {}).get('status')}")
            print(f"  coverage: {data.get('coverage')}")
            print(f"  coverageNote: {data.get('coverageNote')}")
            
            # Check status is "checked-in"
            status_ok = data.get("appointment", {}).get("status") == "checked-in"
            print_test(
                "Appointment status set to 'checked-in'",
                status_ok,
                f"Status: {data.get('appointment', {}).get('status')}"
            )
            
            # Check coverage or coverageNote exists
            has_coverage_info = data.get("coverage") is not None or data.get("coverageNote") is not None
            print_test(
                "Response includes coverage or coverageNote",
                has_coverage_info,
                f"coverage: {data.get('coverage')}, coverageNote: {data.get('coverageNote')}"
            )
            
            # Overall success
            print_test(
                "Check-in endpoint returns 200 (not 500)",
                True,
                "Endpoint working correctly"
            )
        else:
            print_test(
                "Check-in endpoint returns 200",
                False,
                f"Expected 200, got {resp.status_code}: {resp.text}"
            )
    except Exception as e:
        print_test("Check-in with real ID", False, f"Error: {e}")
    
    # Test 4: POST same id again -> should still 200
    print("\n" + "=" * 80)
    print("TEST 4: POST same appointment ID again (idempotent check)")
    print("=" * 80)
    try:
        resp = requests.post(
            f"{BASE_URL}/api/appointments/{appointment_id}/checkin",
            json={},
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            status_ok = data.get("appointment", {}).get("status") == "checked-in"
            print_test(
                "Second check-in returns 200 and status remains 'checked-in'",
                status_ok,
                f"Status: {data.get('appointment', {}).get('status')}"
            )
        else:
            print_test(
                "Second check-in returns 200",
                False,
                f"Expected 200, got {resp.status_code}"
            )
    except Exception as e:
        print_test("Second check-in", False, f"Error: {e}")
    
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print("All critical test cases completed.")
    print("Review the results above for any failures.")

if __name__ == "__main__":
    main()
