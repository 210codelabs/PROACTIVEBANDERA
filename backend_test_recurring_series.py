#!/usr/bin/env python3
"""
Backend test for Recurring series management (bulk reschedule/cancel) + seriesId linkage
Tests all 9 steps as specified in the review request.
"""

import requests
import json
import sys
from datetime import datetime

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def print_step(step_num, description):
    """Print a formatted step header"""
    print(f"\n{'='*80}")
    print(f"STEP {step_num}: {description}")
    print('='*80)

def print_result(success, message):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def main():
    session = requests.Session()
    
    # Login to get session cookie
    print_step(0, "LOGIN - Get session cookie")
    try:
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30
        )
        print(f"Login status: {login_resp.status_code}")
        if login_resp.status_code != 200:
            print(f"Login failed: {login_resp.text}")
            return False
        print_result(True, f"Logged in as {ADMIN_EMAIL}")
    except Exception as e:
        print_result(False, f"Login error: {e}")
        return False
    
    # Setup: Get provider IDs and patient ID
    print_step("SETUP", "Get provider IDs and patient ID")
    try:
        # Get providers
        appts_resp = session.get(
            f"{BASE_URL}/api/appointments?from=2100-01-01&to=2100-01-01",
            timeout=30
        )
        print(f"Get appointments status: {appts_resp.status_code}")
        if appts_resp.status_code != 200:
            print_result(False, f"Failed to get appointments: {appts_resp.text}")
            return False
        
        appts_data = appts_resp.json()
        providers = appts_data.get('providers', [])
        if len(providers) < 2:
            print_result(False, f"Need at least 2 providers, found {len(providers)}")
            return False
        
        pid1 = providers[0]['id']
        pid2 = providers[1]['id']
        print(f"Provider 1 ID: {pid1}")
        print(f"Provider 2 ID: {pid2}")
        
        # Get patient
        patient_resp = session.get(
            f"{BASE_URL}/api/patients/search?q=a&limit=1",
            timeout=30
        )
        print(f"Get patient status: {patient_resp.status_code}")
        if patient_resp.status_code != 200:
            print_result(False, f"Failed to get patient: {patient_resp.text}")
            return False
        
        patient_data = patient_resp.json()
        patients = patient_data.get('results', [])
        if not patients:
            print_result(False, "No patients found")
            return False
        
        patient_id = patients[0]['id']
        print(f"Patient ID: {patient_id}")
        print_result(True, f"Setup complete: pid1={pid1}, pid2={pid2}, patientId={patient_id}")
        
    except Exception as e:
        print_result(False, f"Setup error: {e}")
        return False
    
    # STEP 1: CREATE SERIES
    print_step(1, "CREATE SERIES")
    try:
        create_body = {
            "patientId": patient_id,
            "providerId": pid1,
            "day": "2026-10-05",
            "time": "09:00",
            "freq": "weekly",
            "occurrences": 4,
            "autoShift": True
        }
        create_resp = session.post(
            f"{BASE_URL}/api/appointments/series",
            json=create_body,
            timeout=30
        )
        print(f"Status: {create_resp.status_code}")
        print(f"Response: {create_resp.text[:500]}")
        
        if create_resp.status_code != 200:
            print_result(False, f"Expected 200, got {create_resp.status_code}")
            return False
        
        create_data = create_resp.json()
        if not create_data.get('ok'):
            print_result(False, f"Response ok is not true: {create_data}")
            return False
        
        series_id = create_data.get('seriesId')
        created_count = create_data.get('createdCount')
        
        if not series_id:
            print_result(False, "No seriesId in response")
            return False
        
        if created_count != 4:
            print_result(False, f"Expected createdCount=4, got {created_count}")
            return False
        
        print(f"Series ID: {series_id}")
        print(f"Created count: {created_count}")
        print_result(True, f"Series created with seriesId={series_id}, createdCount={created_count}")
        
    except Exception as e:
        print_result(False, f"Create series error: {e}")
        return False
    
    # STEP 2: SERIES SUMMARY
    print_step(2, "SERIES SUMMARY")
    try:
        summary_resp = session.get(
            f"{BASE_URL}/api/appointments/series/{series_id}",
            timeout=30
        )
        print(f"Status: {summary_resp.status_code}")
        print(f"Response: {summary_resp.text[:500]}")
        
        if summary_resp.status_code != 200:
            print_result(False, f"Expected 200, got {summary_resp.status_code}")
            return False
        
        summary_data = summary_resp.json()
        total = summary_data.get('total')
        upcoming_count = summary_data.get('upcomingCount')
        occurrences = summary_data.get('occurrences', [])
        
        if total != 4:
            print_result(False, f"Expected total=4, got {total}")
            return False
        
        if upcoming_count != 4:
            print_result(False, f"Expected upcomingCount=4, got {upcoming_count}")
            return False
        
        if len(occurrences) != 4:
            print_result(False, f"Expected 4 occurrences, got {len(occurrences)}")
            return False
        
        print(f"Total: {total}, Upcoming: {upcoming_count}, Occurrences: {len(occurrences)}")
        print_result(True, f"Series summary correct: total={total}, upcomingCount={upcoming_count}")
        
    except Exception as e:
        print_result(False, f"Series summary error: {e}")
        return False
    
    # STEP 3: BULK RESCHEDULE TIME
    print_step(3, "BULK RESCHEDULE TIME to 11:00")
    try:
        reschedule_body = {
            "time": "11:00",
            "autoShift": True
        }
        reschedule_resp = session.patch(
            f"{BASE_URL}/api/appointments/series/{series_id}",
            json=reschedule_body,
            timeout=30
        )
        print(f"Status: {reschedule_resp.status_code}")
        print(f"Response: {reschedule_resp.text[:500]}")
        
        if reschedule_resp.status_code != 200:
            print_result(False, f"Expected 200, got {reschedule_resp.status_code}")
            return False
        
        reschedule_data = reschedule_resp.json()
        if not reschedule_data.get('ok'):
            print_result(False, f"Response ok is not true: {reschedule_data}")
            return False
        
        updated = reschedule_data.get('updated')
        skipped_count = reschedule_data.get('skippedCount')
        
        if updated != 4:
            print_result(False, f"Expected updated=4, got {updated}")
            return False
        
        if skipped_count != 0:
            print_result(False, f"Expected skippedCount=0, got {skipped_count}")
            return False
        
        # Verify all occurrences now start at 11:00
        verify_resp = session.get(
            f"{BASE_URL}/api/appointments/series/{series_id}",
            timeout=30
        )
        if verify_resp.status_code == 200:
            verify_data = verify_resp.json()
            occurrences = verify_data.get('occurrences', [])
            all_at_11 = True
            for occ in occurrences:
                starts_at = occ.get('startsAt')
                if starts_at:
                    # Parse ISO datetime and check hour
                    dt = datetime.fromisoformat(starts_at.replace('Z', '+00:00'))
                    if dt.hour != 11:
                        all_at_11 = False
                        print(f"Occurrence {occ.get('id')} starts at hour {dt.hour}, not 11")
            
            if not all_at_11:
                print_result(False, "Not all occurrences start at hour 11")
                return False
            
            print("Verified: All occurrences now start at hour 11 (11:00)")
        
        print_result(True, f"Bulk reschedule time successful: updated={updated}, skippedCount={skipped_count}")
        
    except Exception as e:
        print_result(False, f"Bulk reschedule time error: {e}")
        return False
    
    # STEP 4: BULK SHIFT DAYS
    print_step(4, "BULK SHIFT DAYS by +1")
    try:
        shift_body = {
            "shiftDays": 1,
            "autoShift": True
        }
        shift_resp = session.patch(
            f"{BASE_URL}/api/appointments/series/{series_id}",
            json=shift_body,
            timeout=30
        )
        print(f"Status: {shift_resp.status_code}")
        print(f"Response: {shift_resp.text[:500]}")
        
        if shift_resp.status_code != 200:
            print_result(False, f"Expected 200, got {shift_resp.status_code}")
            return False
        
        shift_data = shift_resp.json()
        if not shift_data.get('ok'):
            print_result(False, f"Response ok is not true: {shift_data}")
            return False
        
        updated = shift_data.get('updated')
        
        if updated != 4:
            print_result(False, f"Expected updated=4, got {updated}")
            return False
        
        # Verify dates shifted by 1 day (2026-10-06, 10-13, 10-20, 10-27)
        verify_resp = session.get(
            f"{BASE_URL}/api/appointments/series/{series_id}",
            timeout=30
        )
        if verify_resp.status_code == 200:
            verify_data = verify_resp.json()
            occurrences = verify_data.get('occurrences', [])
            expected_dates = ["2026-10-06", "2026-10-13", "2026-10-20", "2026-10-27"]
            actual_dates = []
            for occ in occurrences:
                starts_at = occ.get('startsAt')
                if starts_at:
                    dt = datetime.fromisoformat(starts_at.replace('Z', '+00:00'))
                    actual_dates.append(dt.strftime('%Y-%m-%d'))
            
            actual_dates.sort()
            print(f"Expected dates: {expected_dates}")
            print(f"Actual dates: {actual_dates}")
            
            if actual_dates != expected_dates:
                print_result(False, f"Dates don't match expected after +1 day shift")
                return False
            
            print("Verified: All occurrences moved +1 day")
        
        print_result(True, f"Bulk shift days successful: updated={updated}")
        
    except Exception as e:
        print_result(False, f"Bulk shift days error: {e}")
        return False
    
    # STEP 5: BULK CHANGE PROVIDER
    print_step(5, "BULK CHANGE PROVIDER")
    try:
        provider_body = {
            "providerId": pid2,
            "autoShift": True
        }
        provider_resp = session.patch(
            f"{BASE_URL}/api/appointments/series/{series_id}",
            json=provider_body,
            timeout=30
        )
        print(f"Status: {provider_resp.status_code}")
        print(f"Response: {provider_resp.text[:500]}")
        
        if provider_resp.status_code != 200:
            print_result(False, f"Expected 200, got {provider_resp.status_code}")
            return False
        
        provider_data = provider_resp.json()
        if not provider_data.get('ok'):
            print_result(False, f"Response ok is not true: {provider_data}")
            return False
        
        updated = provider_data.get('updated')
        
        if updated != 4:
            print_result(False, f"Expected updated=4, got {updated}")
            return False
        
        print_result(True, f"Bulk change provider successful: updated={updated}")
        
    except Exception as e:
        print_result(False, f"Bulk change provider error: {e}")
        return False
    
    # STEP 6: NOTHING TO CHANGE
    print_step(6, "NOTHING TO CHANGE (empty body)")
    try:
        empty_body = {}
        empty_resp = session.patch(
            f"{BASE_URL}/api/appointments/series/{series_id}",
            json=empty_body,
            timeout=30
        )
        print(f"Status: {empty_resp.status_code}")
        print(f"Response: {empty_resp.text[:500]}")
        
        if empty_resp.status_code != 400:
            print_result(False, f"Expected 400, got {empty_resp.status_code}")
            return False
        
        print_result(True, "Empty body correctly returns 400")
        
    except Exception as e:
        print_result(False, f"Nothing to change error: {e}")
        return False
    
    # STEP 7: AUTH - No session
    print_step(7, "AUTH - PATCH without session")
    try:
        no_auth_session = requests.Session()
        auth_body = {
            "time": "10:00",
            "autoShift": True
        }
        auth_resp = no_auth_session.patch(
            f"{BASE_URL}/api/appointments/series/{series_id}",
            json=auth_body,
            timeout=30
        )
        print(f"Status: {auth_resp.status_code}")
        print(f"Response: {auth_resp.text[:500]}")
        
        if auth_resp.status_code != 401:
            print_result(False, f"Expected 401, got {auth_resp.status_code}")
            return False
        
        print_result(True, "No session correctly returns 401")
        
    except Exception as e:
        print_result(False, f"Auth test error: {e}")
        return False
    
    # STEP 8: CANCEL SERIES
    print_step(8, "CANCEL WHOLE SERIES")
    try:
        cancel_resp = session.delete(
            f"{BASE_URL}/api/appointments/series/{series_id}",
            timeout=30
        )
        print(f"Status: {cancel_resp.status_code}")
        print(f"Response: {cancel_resp.text[:500]}")
        
        if cancel_resp.status_code != 200:
            print_result(False, f"Expected 200, got {cancel_resp.status_code}")
            return False
        
        cancel_data = cancel_resp.json()
        if not cancel_data.get('ok'):
            print_result(False, f"Response ok is not true: {cancel_data}")
            return False
        
        cancelled = cancel_data.get('cancelled')
        
        if cancelled != 4:
            print_result(False, f"Expected cancelled=4, got {cancelled}")
            return False
        
        # Verify upcomingCount is now 0
        verify_resp = session.get(
            f"{BASE_URL}/api/appointments/series/{series_id}",
            timeout=30
        )
        if verify_resp.status_code == 200:
            verify_data = verify_resp.json()
            upcoming_count = verify_data.get('upcomingCount')
            
            if upcoming_count != 0:
                print_result(False, f"Expected upcomingCount=0 after cancel, got {upcoming_count}")
                return False
            
            print("Verified: upcomingCount is now 0 (all cancelled)")
        
        print_result(True, f"Cancel series successful: cancelled={cancelled}, upcomingCount=0")
        
    except Exception as e:
        print_result(False, f"Cancel series error: {e}")
        return False
    
    # STEP 9: seriesId LINKAGE
    print_step(9, "seriesId LINKAGE - Verify appointments carry seriesId")
    try:
        linkage_resp = session.get(
            f"{BASE_URL}/api/appointments?patientId={patient_id}",
            timeout=30
        )
        print(f"Status: {linkage_resp.status_code}")
        
        if linkage_resp.status_code != 200:
            print_result(False, f"Expected 200, got {linkage_resp.status_code}")
            return False
        
        linkage_data = linkage_resp.json()
        appointments = linkage_data.get('appointments', [])
        
        # Find appointments with our seriesId
        series_appts = [a for a in appointments if a.get('seriesId') == series_id]
        
        if len(series_appts) != 4:
            print_result(False, f"Expected 4 appointments with seriesId={series_id}, found {len(series_appts)}")
            return False
        
        # Verify all have the correct seriesId
        all_correct = all(a.get('seriesId') == series_id for a in series_appts)
        if not all_correct:
            print_result(False, "Not all appointments have the correct seriesId")
            return False
        
        print(f"Found {len(series_appts)} appointments with seriesId={series_id}")
        print_result(True, f"seriesId linkage verified: 4 appointments carry seriesId={series_id}")
        
    except Exception as e:
        print_result(False, f"seriesId linkage error: {e}")
        return False
    
    # All tests passed
    print("\n" + "="*80)
    print("✅ ALL 9 STEPS PASSED SUCCESSFULLY")
    print("="*80)
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
