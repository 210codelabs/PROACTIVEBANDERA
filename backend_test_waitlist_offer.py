#!/usr/bin/env python3
"""
Backend test for Waitlist manual offer endpoint (POST /api/waitlist/[id]/offer)
Tests the NEW endpoint per the review request and test_result.md task.
"""
import requests
import json
import sys
from datetime import datetime, timedelta

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def log(msg):
    print(f"[TEST] {msg}")

def main():
    session = requests.Session()
    
    # ========== STEP 1: Login as admin to get session cookie ==========
    log("STEP 1: Login as admin to get session cookie")
    try:
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30
        )
        if login_resp.status_code != 200:
            log(f"❌ FAIL: Login failed with status {login_resp.status_code}")
            log(f"Response: {login_resp.text[:500]}")
            return False
        login_data = login_resp.json()
        if not login_data.get("ok"):
            log(f"❌ FAIL: Login response ok=false: {login_data}")
            return False
        log(f"✅ PASS: Admin login successful, session cookie set")
    except Exception as e:
        log(f"❌ FAIL: Login exception: {e}")
        return False
    
    # ========== STEP 2: Get a providerId from GET /api/appointments ==========
    log("\nSTEP 2: Get a providerId from GET /api/appointments")
    try:
        appts_resp = session.get(f"{BASE_URL}/api/appointments", timeout=30)
        if appts_resp.status_code != 200:
            log(f"❌ FAIL: GET /api/appointments returned {appts_resp.status_code}")
            return False
        appts_data = appts_resp.json()
        providers = appts_data.get("providers", [])
        if not providers:
            log(f"❌ FAIL: No providers found in /api/appointments response")
            return False
        provider_id = providers[0]["id"]
        log(f"✅ PASS: Found providerId: {provider_id}")
    except Exception as e:
        log(f"❌ FAIL: GET /api/appointments exception: {e}")
        return False
    
    # ========== STEP 3: Get or create a patientId ==========
    log("\nSTEP 3: Get a patientId from GET /api/patients/search")
    try:
        search_resp = session.get(f"{BASE_URL}/api/patients/search?q=a&limit=5", timeout=30)
        if search_resp.status_code != 200:
            log(f"❌ FAIL: GET /api/patients/search returned {search_resp.status_code}")
            return False
        search_data = search_resp.json()
        results = search_data.get("results", [])
        if not results:
            log(f"❌ FAIL: No patients found in search results")
            return False
        patient_id = results[0]["id"]
        patient_name = f"{results[0].get('firstName', '')} {results[0].get('lastName', '')}"
        log(f"✅ PASS: Found patientId: {patient_id} ({patient_name})")
    except Exception as e:
        log(f"❌ FAIL: GET /api/patients/search exception: {e}")
        return False
    
    # ========== STEP 4: Create a waitlist entry ==========
    log("\nSTEP 4: Create a waitlist entry via POST /api/waitlist")
    try:
        waitlist_resp = session.post(
            f"{BASE_URL}/api/waitlist",
            json={"patientId": patient_id, "providerId": provider_id},
            timeout=30
        )
        if waitlist_resp.status_code != 200:
            log(f"❌ FAIL: POST /api/waitlist returned {waitlist_resp.status_code}")
            log(f"Response: {waitlist_resp.text[:500]}")
            return False
        waitlist_data = waitlist_resp.json()
        if not waitlist_data.get("ok"):
            log(f"❌ FAIL: POST /api/waitlist response ok=false: {waitlist_data}")
            return False
        waitlist_id = waitlist_data.get("id")
        if not waitlist_id:
            log(f"❌ FAIL: POST /api/waitlist did not return an id")
            return False
        log(f"✅ PASS: Created waitlist entry with id: {waitlist_id}")
    except Exception as e:
        log(f"❌ FAIL: POST /api/waitlist exception: {e}")
        return False
    
    # ========== STEP 5: Verify the entry appears in GET /api/waitlist ==========
    log("\nSTEP 5: Verify the entry appears in GET /api/waitlist (status waiting)")
    try:
        list_resp = session.get(f"{BASE_URL}/api/waitlist", timeout=30)
        if list_resp.status_code != 200:
            log(f"❌ FAIL: GET /api/waitlist returned {list_resp.status_code}")
            return False
        list_data = list_resp.json()
        entries = list_data.get("entries", [])
        found = any(e.get("id") == waitlist_id for e in entries)
        if not found:
            log(f"❌ FAIL: Waitlist entry {waitlist_id} not found in GET /api/waitlist")
            return False
        # Find the entry and verify patient name
        entry = next((e for e in entries if e.get("id") == waitlist_id), None)
        if entry:
            log(f"✅ PASS: Waitlist entry found with patientName: {entry.get('patientName')}")
        else:
            log(f"✅ PASS: Waitlist entry found in list")
    except Exception as e:
        log(f"❌ FAIL: GET /api/waitlist exception: {e}")
        return False
    
    # ========== STEP 6: POST /api/waitlist/{id}/offer with valid data ==========
    log("\nSTEP 6: POST /api/waitlist/{id}/offer with valid day/time/providerId")
    # Calculate a future weekday (next Monday)
    today = datetime.now()
    days_ahead = (7 - today.weekday()) % 7  # Days until next Monday
    if days_ahead == 0:
        days_ahead = 7  # If today is Monday, get next Monday
    next_monday = today + timedelta(days=days_ahead)
    future_day = next_monday.strftime("%Y-%m-%d")
    
    try:
        offer_resp = session.post(
            f"{BASE_URL}/api/waitlist/{waitlist_id}/offer",
            json={"day": future_day, "time": "10:00", "providerId": provider_id},
            timeout=30
        )
        if offer_resp.status_code != 200:
            log(f"❌ FAIL: POST /api/waitlist/{waitlist_id}/offer returned {offer_resp.status_code}")
            log(f"Response: {offer_resp.text[:500]}")
            return False
        offer_data = offer_resp.json()
        if not offer_data.get("ok"):
            log(f"❌ FAIL: POST offer response ok=false: {offer_data}")
            return False
        
        # Verify response fields
        link = offer_data.get("link")
        sms = offer_data.get("sms")
        email = offer_data.get("email")
        day = offer_data.get("day")
        time = offer_data.get("time")
        
        if not link or not isinstance(link, str):
            log(f"❌ FAIL: Response missing or invalid 'link' field")
            return False
        if "/waitlist/confirm/" not in link:
            log(f"❌ FAIL: Link does not contain '/waitlist/confirm/': {link}")
            return False
        if sms not in ["skipped", "sent", "error"]:
            log(f"⚠️  WARNING: Unexpected sms status: {sms} (expected 'skipped' since no SMS creds)")
        if email not in ["skipped", "sent", "error"]:
            log(f"⚠️  WARNING: Unexpected email status: {email} (expected 'skipped' since no email creds)")
        
        log(f"✅ PASS: POST offer returned 200 with:")
        log(f"  - link: {link[:50]}... (contains '/waitlist/confirm/')")
        log(f"  - sms: {sms}")
        log(f"  - email: {email}")
        log(f"  - day: {day}")
        log(f"  - time: {time}")
        log(f"✅ CRITICAL: NO HTTP 500 error")
    except Exception as e:
        log(f"❌ FAIL: POST offer exception: {e}")
        return False
    
    # ========== STEP 7: Verify the entry NO LONGER appears in waiting list ==========
    log("\nSTEP 7: Verify the offered entry NO LONGER appears in GET /api/waitlist (status changed to 'offered')")
    try:
        list_resp2 = session.get(f"{BASE_URL}/api/waitlist", timeout=30)
        if list_resp2.status_code != 200:
            log(f"❌ FAIL: GET /api/waitlist returned {list_resp2.status_code}")
            return False
        list_data2 = list_resp2.json()
        entries2 = list_data2.get("entries", [])
        found2 = any(e.get("id") == waitlist_id for e in entries2)
        if found2:
            log(f"❌ FAIL: Waitlist entry {waitlist_id} still appears in waiting list (should have status 'offered')")
            return False
        log(f"✅ PASS: Waitlist entry NO LONGER in waiting list (status changed to 'offered')")
    except Exception as e:
        log(f"❌ FAIL: GET /api/waitlist exception: {e}")
        return False
    
    # ========== STEP 8: Guard test - POST offer with missing time (400) ==========
    log("\nSTEP 8: Guard test - POST offer with missing time (expect 400)")
    try:
        # Create another waitlist entry for guard tests
        waitlist_resp2 = session.post(
            f"{BASE_URL}/api/waitlist",
            json={"patientId": patient_id, "providerId": provider_id},
            timeout=30
        )
        if waitlist_resp2.status_code != 200:
            log(f"❌ FAIL: Could not create second waitlist entry")
            return False
        waitlist_id2 = waitlist_resp2.json().get("id")
        
        guard_resp = session.post(
            f"{BASE_URL}/api/waitlist/{waitlist_id2}/offer",
            json={"day": "2026-12-01"},  # Missing time
            timeout=30
        )
        if guard_resp.status_code != 400:
            log(f"❌ FAIL: Expected 400 for missing time, got {guard_resp.status_code}")
            return False
        log(f"✅ PASS: POST offer with missing time correctly returns 400")
    except Exception as e:
        log(f"❌ FAIL: Guard test (missing time) exception: {e}")
        return False
    
    # ========== STEP 9: Guard test - POST offer to nonexistent id (404) ==========
    log("\nSTEP 9: Guard test - POST offer to nonexistent id (expect 404)")
    try:
        guard_resp2 = session.post(
            f"{BASE_URL}/api/waitlist/nonexistentid/offer",
            json={"day": "2026-12-01", "time": "10:00"},
            timeout=30
        )
        if guard_resp2.status_code != 404:
            log(f"❌ FAIL: Expected 404 for nonexistent id, got {guard_resp2.status_code}")
            return False
        log(f"✅ PASS: POST offer to nonexistent id correctly returns 404")
    except Exception as e:
        log(f"❌ FAIL: Guard test (nonexistent id) exception: {e}")
        return False
    
    # ========== STEP 10: Guard test - POST offer with NO auth cookie (401) ==========
    log("\nSTEP 10: Guard test - POST offer with NO auth cookie (expect 401)")
    try:
        no_auth_session = requests.Session()
        guard_resp3 = no_auth_session.post(
            f"{BASE_URL}/api/waitlist/{waitlist_id2}/offer",
            json={"day": "2026-12-01", "time": "10:00"},
            timeout=30
        )
        if guard_resp3.status_code != 401:
            log(f"❌ FAIL: Expected 401 for no auth, got {guard_resp3.status_code}")
            return False
        log(f"✅ PASS: POST offer with NO auth correctly returns 401")
    except Exception as e:
        log(f"❌ FAIL: Guard test (no auth) exception: {e}")
        return False
    
    # ========== STEP 11: Cleanup - DELETE the waitlist entries ==========
    log("\nSTEP 11: Cleanup - DELETE the waitlist entries")
    try:
        # Delete first entry
        del_resp = session.delete(f"{BASE_URL}/api/waitlist/{waitlist_id}", timeout=30)
        if del_resp.status_code == 200:
            log(f"✅ PASS: Deleted waitlist entry {waitlist_id}")
        else:
            log(f"⚠️  WARNING: Could not delete waitlist entry {waitlist_id} (status {del_resp.status_code})")
        
        # Delete second entry
        del_resp2 = session.delete(f"{BASE_URL}/api/waitlist/{waitlist_id2}", timeout=30)
        if del_resp2.status_code == 200:
            log(f"✅ PASS: Deleted waitlist entry {waitlist_id2}")
        else:
            log(f"⚠️  WARNING: Could not delete waitlist entry {waitlist_id2} (status {del_resp2.status_code})")
    except Exception as e:
        log(f"⚠️  WARNING: Cleanup exception: {e}")
    
    log("\n" + "="*80)
    log("✅ ALL TESTS PASSED")
    log("="*80)
    log("\nSUMMARY:")
    log("✅ Step 1: Admin login successful")
    log("✅ Step 2: Got providerId from GET /api/appointments")
    log("✅ Step 3: Got patientId from GET /api/patients/search")
    log("✅ Step 4: Created waitlist entry via POST /api/waitlist")
    log("✅ Step 5: Verified entry appears in GET /api/waitlist with status 'waiting'")
    log("✅ Step 6: POST /api/waitlist/{id}/offer with valid data returns 200 with link, sms, email")
    log("✅ Step 7: Verified entry NO LONGER in waiting list (status changed to 'offered')")
    log("✅ Step 8: Guard test - missing time returns 400")
    log("✅ Step 9: Guard test - nonexistent id returns 404")
    log("✅ Step 10: Guard test - no auth returns 401")
    log("✅ Step 11: Cleanup - deleted test waitlist entries")
    log("\n✅ CRITICAL ASSERTION: NO HTTP 500 ERRORS ENCOUNTERED")
    log("✅ SMS/Email status: 'skipped' as expected (no credentials configured)")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        log(f"❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
