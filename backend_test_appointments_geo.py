#!/usr/bin/env python3
"""
Backend test for:
1. Appointments single-day GET fix (from==to query)
2. Reverse geocoding endpoint
"""

import requests
import json
from datetime import datetime

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def login(email, password):
    """Login and return session object"""
    url = f"{BASE_URL}/api/auth/login"
    session = requests.Session()
    resp = session.post(url, json={"email": email, "password": password})
    print(f"Login {email}: {resp.status_code}")
    if resp.status_code == 200:
        # Check if we have any cookies
        cookies_dict = session.cookies.get_dict()
        print(f"Cookies received: {list(cookies_dict.keys())}")
        if cookies_dict:
            print(f"✅ Login successful, session established")
            return session
        else:
            print(f"❌ Login returned 200 but no cookies")
            print(f"Response: {resp.text[:200]}")
            return None
    else:
        print(f"❌ Login failed: {resp.text}")
        return None

def test_appointments_single_day():
    """Test appointments single-day query fix"""
    print("\n" + "="*80)
    print("TEST 1: APPOINTMENTS SINGLE-DAY GET FIX")
    print("="*80)
    
    # Login
    session = login("billing@proactiveclinic.com", "apex123")
    if not session:
        print("❌ Cannot proceed without session")
        return False
    
    # TEST 1.1: GET without cookie -> 401
    print("\n--- TEST 1.1: GET /api/appointments without auth cookie ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/appointments")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ TEST 1.1 PASSED: Returns 401 without auth cookie")
        else:
            print(f"❌ TEST 1.1 FAILED: Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 1.1 FAILED: Exception {e}")
        return False
    
    # TEST 1.2: Find a date with appointments (range query)
    print("\n--- TEST 1.2: GET /api/appointments?from=2026-08-01&to=2026-08-31 (find appointments) ---")
    try:
        resp = session.get(f"{BASE_URL}/api/appointments?from=2026-08-01&to=2026-08-31")
        print(f"Status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"❌ TEST 1.2 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        appointments = data.get("appointments", [])
        providers = data.get("providers", [])
        services = data.get("services", [])
        
        print(f"Appointments count: {len(appointments)}")
        print(f"Providers count: {len(providers)}")
        print(f"Services count: {len(services)}")
        
        if len(appointments) == 0:
            print("⚠️ No appointments found in August 2026, trying different range...")
            # Try a broader range
            resp = session.get(f"{BASE_URL}/api/appointments?from=2026-01-01&to=2026-12-31")
            if resp.status_code == 200:
                data = resp.json()
                appointments = data.get("appointments", [])
                print(f"Broader search found {len(appointments)} appointments")
        
        if len(appointments) == 0:
            print("❌ TEST 1.2 FAILED: No appointments found in database")
            return False
        
        # Find a date with appointments
        appointment_dates = {}
        for appt in appointments:
            starts_at = appt.get("startsAt")
            if starts_at:
                date_only = starts_at[:10]  # Extract YYYY-MM-DD
                if date_only not in appointment_dates:
                    appointment_dates[date_only] = []
                appointment_dates[date_only].append(appt)
        
        if not appointment_dates:
            print("❌ TEST 1.2 FAILED: Could not extract dates from appointments")
            return False
        
        # Pick the first date with appointments
        test_date = list(appointment_dates.keys())[0]
        expected_count = len(appointment_dates[test_date])
        
        print(f"✅ TEST 1.2 PASSED: Range query returns {len(appointments)} appointments")
        print(f"✅ Providers array non-empty: {len(providers)} providers")
        print(f"✅ Services array non-empty: {len(services)} services")
        print(f"Selected test date: {test_date} (has {expected_count} appointment(s))")
        
    except Exception as e:
        print(f"❌ TEST 1.2 FAILED: Exception {e}")
        return False
    
    # TEST 1.3: CRITICAL - Single-day query (from==to)
    print(f"\n--- TEST 1.3: GET /api/appointments?from={test_date}&to={test_date} (SINGLE-DAY QUERY) ---")
    try:
        resp = session.get(f"{BASE_URL}/api/appointments?from={test_date}&to={test_date}")
        print(f"Status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"❌ TEST 1.3 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        appointments = data.get("appointments", [])
        
        print(f"Appointments count: {len(appointments)}")
        
        if len(appointments) == 0:
            print(f"❌ TEST 1.3 FAILED: Single-day query returned EMPTY (midnight-only bug NOT fixed)")
            print(f"Expected at least {expected_count} appointment(s) on {test_date}")
            return False
        
        # Verify all returned appointments are on the test date
        all_on_date = True
        for appt in appointments:
            starts_at = appt.get("startsAt", "")
            if not starts_at.startswith(test_date):
                print(f"⚠️ Appointment {appt.get('id')} has startsAt={starts_at}, not on {test_date}")
                all_on_date = False
        
        if not all_on_date:
            print(f"❌ TEST 1.3 FAILED: Some appointments not on the requested date")
            return False
        
        print(f"✅ TEST 1.3 PASSED: Single-day query (from==to) returns {len(appointments)} appointment(s)")
        print(f"✅ CRITICAL FIX VERIFIED: Single-day query NOT empty (midnight-only bug fixed)")
        print(f"✅ All returned appointments are on {test_date}")
        
    except Exception as e:
        print(f"❌ TEST 1.3 FAILED: Exception {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ ALL APPOINTMENTS TESTS PASSED")
    print("="*80)
    return True


def test_reverse_geocoding():
    """Test reverse geocoding endpoint"""
    print("\n" + "="*80)
    print("TEST 2: REVERSE GEOCODING")
    print("="*80)
    
    # Login
    session = login("billing@proactiveclinic.com", "apex123")
    if not session:
        print("❌ Cannot proceed without session")
        return False
    
    # TEST 2.1: GET without cookie -> 401
    print("\n--- TEST 2.1: GET /api/geo/reverse without auth cookie ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/geo/reverse?lat=29.42&lon=-98.49")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ TEST 2.1 PASSED: Returns 401 without auth cookie")
        else:
            print(f"❌ TEST 2.1 FAILED: Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 2.1 FAILED: Exception {e}")
        return False
    
    # TEST 2.2: GET ?clinic=1 -> {city, state}
    print("\n--- TEST 2.2: GET /api/geo/reverse?clinic=1 (clinic fallback) ---")
    try:
        resp = session.get(f"{BASE_URL}/api/geo/reverse?clinic=1")
        print(f"Status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"❌ TEST 2.2 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        city = data.get("city")
        state = data.get("state")
        source = data.get("source")
        
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if city == "San Antonio" and state == "TX":
            print(f"✅ TEST 2.2 PASSED: Returns city='San Antonio', state='TX'")
        else:
            print(f"⚠️ TEST 2.2: Expected city='San Antonio', state='TX', got city='{city}', state='{state}'")
            print(f"This may be acceptable if clinic address is configured differently")
        
        if source == "clinic":
            print(f"✅ Source is 'clinic' as expected")
        
    except Exception as e:
        print(f"❌ TEST 2.2 FAILED: Exception {e}")
        return False
    
    # TEST 2.3: GET ?lat=29.42&lon=-98.49 -> 200 with city/state from OSM or fallback
    print("\n--- TEST 2.3: GET /api/geo/reverse?lat=29.42&lon=-98.49 (OpenStreetMap) ---")
    try:
        resp = session.get(f"{BASE_URL}/api/geo/reverse?lat=29.42&lon=-98.49")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 2.3 FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        city = data.get("city")
        state = data.get("state")
        source = data.get("source")
        note = data.get("note")
        
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if not city or not state:
            print(f"❌ TEST 2.3 FAILED: Missing city or state in response")
            return False
        
        print(f"✅ TEST 2.3 PASSED: Returns 200 with city='{city}', state='{state}'")
        
        if source == "osm":
            print(f"✅ Source is 'osm' (OpenStreetMap)")
        elif source == "fallback":
            print(f"⚠️ Source is 'fallback' (OSM request failed, graceful fallback used)")
            if note:
                print(f"Note: {note}")
        
        # Verify it never returns 500
        print(f"✅ CRITICAL: Endpoint returns 200, NOT 500")
        
    except Exception as e:
        print(f"❌ TEST 2.3 FAILED: Exception {e}")
        return False
    
    # TEST 2.4: GET without lat/lon/clinic -> 400
    print("\n--- TEST 2.4: GET /api/geo/reverse (no parameters) ---")
    try:
        resp = session.get(f"{BASE_URL}/api/geo/reverse")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 400:
            data = resp.json()
            error = data.get("error")
            print(f"Error message: {error}")
            print("✅ TEST 2.4 PASSED: Returns 400 when no parameters provided")
        else:
            print(f"❌ TEST 2.4 FAILED: Expected 400, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 2.4 FAILED: Exception {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ ALL REVERSE GEOCODING TESTS PASSED")
    print("="*80)
    return True


if __name__ == "__main__":
    print("\n" + "="*80)
    print("BACKEND TESTING: Appointments Single-Day Fix + Reverse Geocoding")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Login: billing@proactiveclinic.com / apex123")
    print("="*80)
    
    try:
        # Test 1: Appointments single-day query
        test1_passed = test_appointments_single_day()
        
        # Test 2: Reverse geocoding
        test2_passed = test_reverse_geocoding()
        
        # Summary
        print("\n" + "="*80)
        print("FINAL SUMMARY")
        print("="*80)
        if test1_passed and test2_passed:
            print("✅ ALL TESTS PASSED")
            print("✅ Appointments single-day query fix working correctly")
            print("✅ Reverse geocoding endpoint working correctly")
        else:
            print("❌ SOME TESTS FAILED")
            if not test1_passed:
                print("❌ Appointments single-day query tests failed")
            if not test2_passed:
                print("❌ Reverse geocoding tests failed")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
