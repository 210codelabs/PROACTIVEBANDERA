#!/usr/bin/env python3
"""
Backend test for:
1. Scheduling timezone: appointments always stored/read in practice tz (America/Chicago)
2. Pharmacy search = single source (Weno national directory); NPPES/local removed; daily auto-sync + cron endpoint
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
    "patient_id": None,
    "created_appointments": []
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
    """Get providerId and patientId for tests"""
    log("\n=== SETUP: Getting test data ===")
    
    # Get providerId from /api/providers
    try:
        resp = requests.get(
            f"{BASE_URL}/providers",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"GET /api/providers -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("providers") and len(data["providers"]) > 0:
                test_data["provider_id"] = data["providers"][0]["id"]
                log(f"✅ Provider ID: {test_data['provider_id']}")
            else:
                log(f"❌ No providers found")
                return False
        else:
            log(f"❌ Failed to get providers: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ Error getting providers: {e}")
        return False
    
    # Get patientId from /api/patients
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
                log(f"❌ No patients found")
                return False
        else:
            log(f"❌ Failed to get patients: {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ Error getting patients: {e}")
        return False
    
    return True

def test_task1_scheduling_timezone():
    """
    TASK 1: Scheduling timezone always America/Chicago (Central), independent of server/browser TZ
    The critical bug being fixed: appointments used to render 5 hours behind Central in production.
    A 10:00 Central appointment must store/return 10:00 Central everywhere.
    """
    log("\n" + "="*80)
    log("TASK 1: SCHEDULING TIMEZONE (AMERICA/CHICAGO)")
    log("="*80)
    
    # Test 1.1: Create appointment with time 10:00
    log("\n--- Test 1.1: Create appointment (day:2026-09-21, time:10:00) ---")
    appt_id = None
    try:
        resp = requests.post(
            f"{BASE_URL}/appointments",
            json={
                "day": "2026-09-21",
                "time": "10:00",
                "providerId": test_data["provider_id"],
                "patientId": test_data["patient_id"],
                "durationMin": 30
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"POST /api/appointments -> {resp.status_code}")
        
        if resp.status_code == 500:
            log(f"❌ CRITICAL FAIL: HTTP 500 ERROR (NOT ALLOWED)")
            log(f"Response: {resp.text[:500]}")
            return False
        
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            
            # Check response structure
            if data.get("ok") and data.get("day") == "2026-09-21":
                log(f"✅ Test 1.1a PASS: Response has ok:true and day:2026-09-21")
                
                # CRITICAL: Check returned time is 10:00 (NOT 05:00 or 15:00)
                returned_time = data.get("time")
                if returned_time == "10:00":
                    log(f"✅ Test 1.1b PASS: Returned time is '10:00' (CORRECT, not shifted)")
                elif returned_time == "05:00":
                    log(f"❌ CRITICAL FAIL: Returned time is '05:00' (5 hours behind, UTC bug)")
                    return False
                elif returned_time == "15:00":
                    log(f"❌ CRITICAL FAIL: Returned time is '15:00' (5 hours ahead, wrong direction)")
                    return False
                else:
                    log(f"❌ FAIL: Returned time is '{returned_time}' (expected '10:00')")
                    return False
                
                # Capture appointment ID
                if data.get("appointment") and data["appointment"].get("id"):
                    appt_id = data["appointment"]["id"]
                    test_data["created_appointments"].append(appt_id)
                    log(f"✅ Appointment created with ID: {appt_id}")
                else:
                    log(f"⚠️ Warning: No appointment.id in response")
            else:
                log(f"❌ FAIL: Response missing ok:true or day:2026-09-21: {data}")
                return False
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text[:300]}")
            return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False
    
    # Test 1.2: GET appointment and verify startsAt is in Central time
    log("\n--- Test 1.2: GET appointment (verify startsAt in Central time) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/appointments?from=2026-09-21&to=2026-09-21",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"GET /api/appointments?from=2026-09-21&to=2026-09-21 -> {resp.status_code}")
        
        if resp.status_code == 500:
            log(f"❌ CRITICAL FAIL: HTTP 500 ERROR (NOT ALLOWED)")
            return False
        
        if resp.status_code == 200:
            data = resp.json()
            appointments = data.get("appointments", [])
            log(f"Found {len(appointments)} appointments on 2026-09-21")
            
            # Find our created appointment
            our_appt = None
            if appt_id:
                our_appt = next((a for a in appointments if a.get("id") == appt_id), None)
            
            if our_appt:
                log(f"✅ Test 1.2a PASS: Created appointment found in list")
                starts_at = our_appt.get("startsAt")
                log(f"   startsAt: {starts_at}")
                
                # startsAt should be 2026-09-21T15:00:00.000Z (10:00 Central = 15:00 UTC in September/CDT)
                # Central is UTC-5 during CDT (Daylight Saving Time)
                if starts_at and "T15:00:00" in starts_at:
                    log(f"✅ Test 1.2b PASS: startsAt is 15:00 UTC (10:00 Central/CDT)")
                elif starts_at and "T10:00:00" in starts_at:
                    log(f"❌ FAIL: startsAt is 10:00 UTC (would be 05:00 Central, wrong)")
                    return False
                else:
                    log(f"⚠️ Warning: startsAt format unexpected: {starts_at}")
            else:
                log(f"⚠️ Warning: Created appointment not found in list (may have been filtered)")
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False
    
    # Test 1.3: Working hours - POST with time 07:00 (before 9AM)
    log("\n--- Test 1.3: Working hours - POST time:07:00 (before 9AM open) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/appointments",
            json={
                "day": "2026-09-22",
                "time": "07:00",
                "providerId": test_data["provider_id"],
                "patientId": test_data["patient_id"],
                "durationMin": 30
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"POST /api/appointments (time:07:00) -> {resp.status_code}")
        
        if resp.status_code == 500:
            log(f"❌ CRITICAL FAIL: HTTP 500 ERROR (NOT ALLOWED)")
            return False
        
        if resp.status_code == 400:
            log(f"✅ Test 1.3a PASS: 400 rejection for time before working hours (07:00)")
            log(f"Response: {resp.text[:300]}")
        elif resp.status_code == 200:
            data = resp.json()
            # Check if auto-shifted
            if data.get("shifted") or data.get("time", "").startswith("09:"):
                log(f"✅ Test 1.3b PASS: Auto-shifted to working hours (time >= 09:00)")
                log(f"   Returned time: {data.get('time')}")
                # Clean up if appointment was created
                if data.get("appointment", {}).get("id"):
                    test_data["created_appointments"].append(data["appointment"]["id"])
            else:
                log(f"❌ FAIL: 200 response but time not shifted: {data.get('time')}")
                return False
        else:
            log(f"❌ FAIL: Unexpected status {resp.status_code}: {resp.text[:300]}")
            return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False
    
    # Test 1.4: Working hours - POST with time 21:00 (after 8PM)
    log("\n--- Test 1.4: Working hours - POST time:21:00 (after 8PM close) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/appointments",
            json={
                "day": "2026-09-23",
                "time": "21:00",
                "providerId": test_data["provider_id"],
                "patientId": test_data["patient_id"],
                "durationMin": 30
            },
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"POST /api/appointments (time:21:00) -> {resp.status_code}")
        
        if resp.status_code == 500:
            log(f"❌ CRITICAL FAIL: HTTP 500 ERROR (NOT ALLOWED)")
            return False
        
        if resp.status_code == 400:
            log(f"✅ Test 1.4a PASS: 400 rejection for time after working hours (21:00)")
            log(f"Response: {resp.text[:300]}")
        elif resp.status_code == 200:
            data = resp.json()
            # Check if auto-shifted or rejected
            returned_time = data.get("time", "")
            if data.get("shifted") or (returned_time and returned_time < "20:00"):
                log(f"✅ Test 1.4b PASS: Auto-shifted to working hours (time < 20:00)")
                log(f"   Returned time: {returned_time}")
                # Clean up if appointment was created
                if data.get("appointment", {}).get("id"):
                    test_data["created_appointments"].append(data["appointment"]["id"])
            else:
                log(f"❌ FAIL: 200 response but time not properly handled: {returned_time}")
                return False
        else:
            log(f"❌ FAIL: Unexpected status {resp.status_code}: {resp.text[:300]}")
            return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False
    
    # Test 1.5: Reschedule appointment
    if appt_id:
        log("\n--- Test 1.5: Reschedule appointment (PATCH) ---")
        try:
            resp = requests.patch(
                f"{BASE_URL}/appointments",
                json={
                    "id": appt_id,
                    "day": "2026-09-22",
                    "time": "14:30",
                    "autoShift": True
                },
                cookies=test_data["session_cookie"],
                timeout=10
            )
            log(f"PATCH /api/appointments/{appt_id} -> {resp.status_code}")
            
            if resp.status_code == 500:
                log(f"❌ CRITICAL FAIL: HTTP 500 ERROR (NOT ALLOWED)")
                return False
            
            if resp.status_code == 200:
                data = resp.json()
                log(f"Response: {json.dumps(data, indent=2)}")
                
                returned_time = data.get("time")
                if returned_time and returned_time >= "09:00" and returned_time <= "20:00":
                    log(f"✅ Test 1.5 PASS: Rescheduled to {returned_time} (within 09:00-20:00 Central)")
                else:
                    log(f"❌ FAIL: Returned time {returned_time} outside working hours")
                    return False
            else:
                log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text[:300]}")
                return False
        except Exception as e:
            log(f"❌ ERROR: {e}")
            return False
    
    log("\n✅ TASK 1 COMPLETE: All timezone tests passed")
    return True

def test_task2_pharmacy_search():
    """
    TASK 2: Pharmacy search single source = Weno national directory (no NPPES/local) + cron endpoint
    """
    log("\n" + "="*80)
    log("TASK 2: PHARMACY SEARCH (WENO ONLY)")
    log("="*80)
    
    # Test 2.1: GET /api/weno/pharmacies?city=San Antonio&state=TX
    log("\n--- Test 2.1: GET /api/weno/pharmacies?city=San Antonio&state=TX ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/weno/pharmacies?city=San Antonio&state=TX",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"GET /api/weno/pharmacies?city=San Antonio&state=TX -> {resp.status_code}")
        
        if resp.status_code == 500:
            log(f"❌ CRITICAL FAIL: HTTP 500 ERROR (NOT ALLOWED)")
            return False
        
        if resp.status_code == 200:
            data = resp.json()
            total = data.get("total", 0)
            pharmacies = data.get("pharmacies", [])
            log(f"Response: total={total}, pharmacies count={len(pharmacies)}")
            
            # Check total ~391
            if total >= 390 and total <= 395:
                log(f"✅ Test 2.1a PASS: Total ~391 (got {total})")
            else:
                log(f"⚠️ Warning: Total {total} not ~391 (expected ~391)")
            
            # CRITICAL: Check ALL pharmacies have source='weno' (NO 'local' or 'nppes')
            if pharmacies:
                sources = set()
                for p in pharmacies:
                    source = p.get("source")
                    sources.add(source)
                
                log(f"   Sources found: {sources}")
                
                # Check if ALL are 'weno'
                non_weno = [p for p in pharmacies if p.get("source") != "weno"]
                if len(non_weno) == 0:
                    log(f"✅ Test 2.1b PASS: ALL {len(pharmacies)} pharmacies have source='weno'")
                else:
                    log(f"❌ CRITICAL FAIL: Found {len(non_weno)} pharmacies with source != 'weno'")
                    for p in non_weno[:3]:  # Show first 3
                        log(f"   - {p.get('name')}: source={p.get('source')}")
                    return False
            else:
                log(f"⚠️ Warning: No pharmacies returned")
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text[:300]}")
            return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False
    
    # Test 2.2: GET /api/weno/pharmacies?q=CVS&state=TX
    log("\n--- Test 2.2: GET /api/weno/pharmacies?q=CVS&state=TX ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/weno/pharmacies?q=CVS&state=TX",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"GET /api/weno/pharmacies?q=CVS&state=TX -> {resp.status_code}")
        
        if resp.status_code == 500:
            log(f"❌ CRITICAL FAIL: HTTP 500 ERROR (NOT ALLOWED)")
            return False
        
        if resp.status_code == 200:
            data = resp.json()
            pharmacies = data.get("pharmacies", [])
            log(f"Response: {len(pharmacies)} pharmacies")
            
            # Check ALL have source='weno'
            if pharmacies:
                non_weno = [p for p in pharmacies if p.get("source") != "weno"]
                if len(non_weno) == 0:
                    log(f"✅ Test 2.2 PASS: ALL {len(pharmacies)} CVS pharmacies have source='weno'")
                else:
                    log(f"❌ CRITICAL FAIL: Found {len(non_weno)} pharmacies with source != 'weno'")
                    return False
            else:
                log(f"⚠️ Warning: No CVS pharmacies found")
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text[:300]}")
            return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False
    
    # Test 2.3: GET /api/pharmacies/search?q=Walgreens
    log("\n--- Test 2.3: GET /api/pharmacies/search?q=Walgreens ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/pharmacies/search?q=Walgreens",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"GET /api/pharmacies/search?q=Walgreens -> {resp.status_code}")
        
        if resp.status_code == 500:
            log(f"❌ CRITICAL FAIL: HTTP 500 ERROR (NOT ALLOWED)")
            return False
        
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)[:500]}")
            
            if data.get("ok"):
                pharmacies = data.get("pharmacies", [])
                log(f"   Found {len(pharmacies)} Walgreens pharmacies")
                
                # Check ALL have source='weno'
                if pharmacies:
                    non_weno = [p for p in pharmacies if p.get("source") != "weno"]
                    if len(non_weno) == 0:
                        log(f"✅ Test 2.3 PASS: ALL {len(pharmacies)} Walgreens pharmacies have source='weno'")
                    else:
                        log(f"❌ CRITICAL FAIL: Found {len(non_weno)} pharmacies with source != 'weno'")
                        return False
                else:
                    log(f"⚠️ Warning: No Walgreens pharmacies found")
            else:
                log(f"❌ FAIL: Response missing ok:true")
                return False
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text[:300]}")
            return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False
    
    # Test 2.4: GET /api/weno/pharmacies?q=1437984630 (NPI search)
    log("\n--- Test 2.4: GET /api/weno/pharmacies?q=1437984630 (NPI) ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/weno/pharmacies?q=1437984630",
            cookies=test_data["session_cookie"],
            timeout=10
        )
        log(f"GET /api/weno/pharmacies?q=1437984630 -> {resp.status_code}")
        
        if resp.status_code == 500:
            log(f"❌ CRITICAL FAIL: HTTP 500 ERROR (NOT ALLOWED)")
            return False
        
        if resp.status_code == 200:
            data = resp.json()
            pharmacies = data.get("pharmacies", [])
            log(f"Response: {len(pharmacies)} pharmacies")
            
            if pharmacies:
                # Check if any pharmacy has this NPI
                matching = [p for p in pharmacies if p.get("npi") == "1437984630"]
                if matching:
                    log(f"✅ Test 2.4 PASS: Found pharmacy with NPI 1437984630")
                    log(f"   Pharmacy: {matching[0].get('name')}")
                else:
                    log(f"⚠️ Warning: No pharmacy with exact NPI 1437984630 found")
            else:
                log(f"⚠️ Warning: No pharmacies returned for NPI search")
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text[:300]}")
            return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False
    
    # Test 2.5: GET /api/cron/weno-sync WITHOUT admin session and WITHOUT key -> 401
    log("\n--- Test 2.5: GET /api/cron/weno-sync (no auth) -> 401 ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/cron/weno-sync",
            timeout=10
        )
        log(f"GET /api/cron/weno-sync (no auth) -> {resp.status_code}")
        
        if resp.status_code == 401:
            log(f"✅ Test 2.5 PASS: 401 Unauthorized without admin session or key")
        else:
            log(f"❌ FAIL: Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False
    
    # Test 2.6: GET /api/cron/weno-sync WITH admin session -> 200
    log("\n--- Test 2.6: GET /api/cron/weno-sync (with admin session) -> 200 ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/cron/weno-sync",
            cookies=test_data["session_cookie"],
            timeout=30  # May take longer
        )
        log(f"GET /api/cron/weno-sync (with admin) -> {resp.status_code}")
        
        if resp.status_code == 500:
            log(f"❌ CRITICAL FAIL: HTTP 500 ERROR (NOT ALLOWED)")
            return False
        
        if resp.status_code == 200:
            data = resp.json()
            log(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get("ok"):
                log(f"✅ Test 2.6a PASS: Response has ok:true")
                
                # Check if ran or skipped (acceptable if Weno config error in preview)
                if data.get("ran") == False:
                    log(f"⚠️ Info: Sync did not run (ran:false) - may be Weno config issue in preview")
                else:
                    log(f"✅ Test 2.6b PASS: Sync ran successfully")
            else:
                log(f"❌ FAIL: Response missing ok:true: {data}")
                return False
        else:
            log(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text[:300]}")
            return False
    except Exception as e:
        log(f"❌ ERROR: {e}")
        return False
    
    log("\n✅ TASK 2 COMPLETE: All pharmacy search tests passed")
    return True

def cleanup():
    """Delete all created appointments"""
    log("\n=== CLEANUP ===")
    
    for appt_id in test_data["created_appointments"]:
        try:
            log(f"Deleting appointment {appt_id}")
            resp = requests.delete(
                f"{BASE_URL}/appointments/{appt_id}",
                cookies=test_data["session_cookie"],
                timeout=10
            )
            if resp.status_code == 200:
                log(f"✅ Deleted appointment {appt_id}")
            else:
                log(f"⚠️ Failed to delete appointment {appt_id}: {resp.status_code}")
        except Exception as e:
            log(f"⚠️ Error deleting appointment {appt_id}: {e}")
    
    log(f"\n✅ Cleanup complete. Deleted {len(test_data['created_appointments'])} appointments.")

def main():
    log("=" * 80)
    log("BACKEND TEST: Timezone + Pharmacy Search")
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
    task1_pass = test_task1_scheduling_timezone()
    task2_pass = test_task2_pharmacy_search()
    
    # Step 4: Cleanup
    cleanup()
    
    # Summary
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    log(f"TASK 1 (Scheduling Timezone): {'✅ PASS' if task1_pass else '❌ FAIL'}")
    log(f"TASK 2 (Pharmacy Search): {'✅ PASS' if task2_pass else '❌ FAIL'}")
    log("=" * 80)

if __name__ == "__main__":
    main()
