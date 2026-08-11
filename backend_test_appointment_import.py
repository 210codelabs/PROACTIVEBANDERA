#!/usr/bin/env python3
"""
Backend test for EMR Import Feature 2: Appointment Import
Tests POST /api/admin/import/appointments/preview and /api/admin/import/appointments/commit
"""

import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def login_admin():
    """Login as admin and return session cookie"""
    print("\n=== ADMIN LOGIN ===")
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    
    try:
        resp = requests.post(url, json=payload, timeout=30)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            cookie = resp.cookies.get("proactive_session")
            if cookie:
                print(f"✅ Admin login successful, got session cookie")
                return cookie
            else:
                print(f"❌ No session cookie in response")
                return None
        else:
            print(f"❌ Login failed: {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_preview_no_auth():
    """TEST 1: POST /api/admin/import/appointments/preview WITHOUT auth cookie -> expect 401"""
    print("\n=== TEST 1: Preview without auth (expect 401) ===")
    url = f"{BASE_URL}/api/admin/import/appointments/preview"
    payload = {"source": "practice_fusion", "csv": "MRN,Date\nPC-100000,08/25/2026"}
    
    try:
        resp = requests.post(url, json=payload, timeout=30)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        
        if resp.status_code == 401:
            print("✅ TEST 1 PASSED: Correctly returns 401 without auth")
            return True
        else:
            print(f"❌ TEST 1 FAILED: Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 ERROR: {e}")
        return False

def test_preview_minimal_csv(cookie):
    """TEST 2: Preview with minimal CSV to get providers list and verify patient exists"""
    print("\n=== TEST 2: Preview minimal CSV + verify patient ===")
    
    # First, preview to get providers list
    print("\n--- 2a: Preview minimal CSV ---")
    url = f"{BASE_URL}/api/admin/import/appointments/preview"
    csv_content = "MRN,Date\nPC-100000,08/25/2026"
    payload = {"source": "practice_fusion", "csv": csv_content}
    
    try:
        resp = requests.post(url, json=payload, cookies={"proactive_session": cookie}, timeout=30)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 2a FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False, None
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check for providers array
        if "providers" not in data or not isinstance(data["providers"], list):
            print(f"❌ TEST 2a FAILED: No providers array in response")
            return False, None
        
        if len(data["providers"]) == 0:
            print(f"❌ TEST 2a FAILED: Providers array is empty")
            return False, None
        
        print(f"✅ Providers array has {len(data['providers'])} providers")
        
        # Find Andy Manzano (NPI 1234567890)
        provider_id = None
        for p in data["providers"]:
            print(f"  Provider: {p.get('name')} (NPI: {p.get('npi')}, ID: {p.get('id')})")
            if p.get("npi") == "1234567890" or "Manzano" in p.get("name", ""):
                provider_id = p.get("id")
                print(f"  ✅ Found Andy Manzano, ID: {provider_id}")
        
        if not provider_id:
            print(f"⚠️  Andy Manzano not found, using first provider: {data['providers'][0].get('id')}")
            provider_id = data["providers"][0].get("id")
        
        print(f"✅ TEST 2a PASSED: Preview returns providers array")
        
    except Exception as e:
        print(f"❌ TEST 2a ERROR: {e}")
        return False, None
    
    # Now verify Eleanor Adams exists
    print("\n--- 2b: Verify Eleanor Adams exists ---")
    search_url = f"{BASE_URL}/api/patients/search?q=Adams"
    
    try:
        resp = requests.get(search_url, cookies={"proactive_session": cookie}, timeout=30)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 2b FAILED: Patient search failed with {resp.status_code}")
            return False, provider_id
        
        data = resp.json()
        patients = data.get("patients", [])
        
        found_eleanor = False
        for p in patients:
            if "Adams" in p.get("lastName", "") and "Eleanor" in p.get("firstName", ""):
                print(f"✅ Found Eleanor Adams: MRN={p.get('mrn')}, ID={p.get('id')}")
                found_eleanor = True
                break
        
        if found_eleanor:
            print("✅ TEST 2b PASSED: Eleanor Adams exists")
            return True, provider_id
        else:
            print(f"❌ TEST 2b FAILED: Eleanor Adams not found in search results")
            return False, provider_id
            
    except Exception as e:
        print(f"❌ TEST 2b ERROR: {e}")
        return False, provider_id

def test_preview_full_csv(cookie):
    """TEST 3: Preview with full CSV (valid + invalid patient)"""
    print("\n=== TEST 3: Preview with full CSV (2 rows: valid + invalid patient) ===")
    url = f"{BASE_URL}/api/admin/import/appointments/preview"
    
    csv_content = """MRN,Date,Time,Provider,Visit Type,Duration,Status,Reason
PC-100000,08/25/2026,09:30 AM,Andy Manzano,Follow-up,30,scheduled,Knee recheck
NOPE-0000,08/26/2026,10:00 AM,Andy Manzano,Follow-up,30,scheduled,Bad patient"""
    
    payload = {"source": "practice_fusion", "csv": csv_content}
    
    try:
        resp = requests.post(url, json=payload, cookies={"proactive_session": cookie}, timeout=30)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check missingRequired is empty
        missing = data.get("missingRequired", [])
        if len(missing) > 0:
            print(f"❌ TEST 3 FAILED: missingRequired should be empty, got: {missing}")
            return False
        print(f"✅ missingRequired is empty")
        
        # Check rowCount
        row_count = data.get("rowCount", 0)
        if row_count != 2:
            print(f"❌ TEST 3 FAILED: Expected rowCount=2, got {row_count}")
            return False
        print(f"✅ rowCount = {row_count}")
        
        # Check sample array
        sample = data.get("sample", [])
        if len(sample) == 0:
            print(f"❌ TEST 3 FAILED: sample array is empty")
            return False
        
        print(f"✅ sample array has {len(sample)} items")
        
        # Check first sample row
        first = sample[0]
        print(f"First sample: {json.dumps(first, indent=2)}")
        
        if "PC-100000" not in first.get("patient", ""):
            print(f"❌ TEST 3 FAILED: First sample patient should contain 'PC-100000', got: {first.get('patient')}")
            return False
        print(f"✅ First sample patient contains 'PC-100000'")
        
        # Check startsAt is valid ISO datetime
        starts_at = first.get("startsAt")
        if not starts_at or not isinstance(starts_at, str):
            print(f"❌ TEST 3 FAILED: startsAt should be a string, got: {starts_at}")
            return False
        
        # Verify it's a valid ISO datetime (should contain 'T' and end with 'Z' or timezone)
        if "2026" not in starts_at or "T" not in starts_at:
            print(f"❌ TEST 3 FAILED: startsAt doesn't look like ISO datetime: {starts_at}")
            return False
        print(f"✅ startsAt is valid ISO datetime: {starts_at}")
        
        # Check providers array is non-empty
        providers = data.get("providers", [])
        if len(providers) == 0:
            print(f"❌ TEST 3 FAILED: providers array is empty")
            return False
        print(f"✅ providers array is non-empty ({len(providers)} providers)")
        
        print("✅ TEST 3 PASSED: Preview with full CSV returns correct structure")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 ERROR: {e}")
        return False

def test_commit_first_time(cookie, provider_id):
    """TEST 4: Commit CSV first time -> expect created=1, skipped=1"""
    print("\n=== TEST 4: Commit CSV first time (expect created=1, skipped=1) ===")
    url = f"{BASE_URL}/api/admin/import/appointments/commit"
    
    csv_content = """MRN,Date,Time,Provider,Visit Type,Duration,Status,Reason
PC-100000,08/25/2026,09:30 AM,Andy Manzano,Follow-up,30,scheduled,Knee recheck
NOPE-0000,08/26/2026,10:00 AM,Andy Manzano,Follow-up,30,scheduled,Bad patient"""
    
    payload = {
        "source": "practice_fusion",
        "csv": csv_content,
        "defaultProviderId": provider_id
    }
    
    try:
        resp = requests.post(url, json=payload, cookies={"proactive_session": cookie}, timeout=30)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 4 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check created count
        created = data.get("created", 0)
        if created != 1:
            print(f"❌ TEST 4 FAILED: Expected created=1, got {created}")
            return False
        print(f"✅ created = {created}")
        
        # Check skipped count
        skipped = data.get("skipped", 0)
        if skipped != 1:
            print(f"❌ TEST 4 FAILED: Expected skipped=1, got {skipped}")
            return False
        print(f"✅ skipped = {skipped}")
        
        # Check status
        status = data.get("status", "")
        if status not in ["partial", "completed"]:
            print(f"❌ TEST 4 FAILED: Expected status 'partial' or 'completed', got '{status}'")
            return False
        print(f"✅ status = '{status}'")
        
        # Check errors array mentions the not-found patient
        errors = data.get("errors", [])
        print(f"Errors array ({len(errors)} items):")
        for err in errors:
            print(f"  Row {err.get('row')}: {err.get('message')}")
        
        # Row 3 (header=row1, so data row 2 = row 3) should have error about patient not found
        found_error = False
        for err in errors:
            if err.get("row") == 3 and "not found" in err.get("message", "").lower():
                found_error = True
                print(f"✅ Found expected error for row 3 (NOPE-0000 patient not found)")
                break
        
        if not found_error:
            print(f"⚠️  Expected error for row 3 about patient not found, but errors: {errors}")
        
        print("✅ TEST 4 PASSED: First commit returns created=1, skipped=1")
        return True
        
    except Exception as e:
        print(f"❌ TEST 4 ERROR: {e}")
        return False

def test_commit_dedupe(cookie, provider_id):
    """TEST 5: Commit same CSV again -> expect created=0, skipped=2 (dedupe)"""
    print("\n=== TEST 5: Commit same CSV again (dedupe test, expect created=0, skipped=2) ===")
    url = f"{BASE_URL}/api/admin/import/appointments/commit"
    
    csv_content = """MRN,Date,Time,Provider,Visit Type,Duration,Status,Reason
PC-100000,08/25/2026,09:30 AM,Andy Manzano,Follow-up,30,scheduled,Knee recheck
NOPE-0000,08/26/2026,10:00 AM,Andy Manzano,Follow-up,30,scheduled,Bad patient"""
    
    payload = {
        "source": "practice_fusion",
        "csv": csv_content,
        "defaultProviderId": provider_id
    }
    
    try:
        resp = requests.post(url, json=payload, cookies={"proactive_session": cookie}, timeout=30)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 5 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check created count
        created = data.get("created", 0)
        if created != 0:
            print(f"❌ TEST 5 FAILED: Expected created=0 (dedupe), got {created}")
            return False
        print(f"✅ created = {created} (dedupe working)")
        
        # Check skipped count
        skipped = data.get("skipped", 0)
        if skipped != 2:
            print(f"❌ TEST 5 FAILED: Expected skipped=2, got {skipped}")
            return False
        print(f"✅ skipped = {skipped} (Row1 deduped, Row2 still not found)")
        
        print("✅ TEST 5 PASSED: Dedupe working correctly (created=0, skipped=2)")
        return True
        
    except Exception as e:
        print(f"❌ TEST 5 ERROR: {e}")
        return False

def test_provider_fallback(cookie, provider_id):
    """TEST 6: Provider fallback test with unknown provider"""
    print("\n=== TEST 6: Provider fallback test (unknown provider, different time) ===")
    url = f"{BASE_URL}/api/admin/import/appointments/commit"
    
    csv_content = """MRN,Date,Time,Provider,Visit Type,Duration,Status,Reason
PC-100000,08/25/2026,11:15 AM,Nobody Unknown,Follow-up,30,scheduled,Fallback test"""
    
    payload = {
        "source": "practice_fusion",
        "csv": csv_content,
        "defaultProviderId": provider_id
    }
    
    try:
        resp = requests.post(url, json=payload, cookies={"proactive_session": cookie}, timeout=30)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 6 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check created count
        created = data.get("created", 0)
        if created != 1:
            print(f"❌ TEST 6 FAILED: Expected created=1 (provider fallback), got {created}")
            return False
        print(f"✅ created = {created} (provider fallback working)")
        
        print("✅ TEST 6 PASSED: Provider fallback working (unknown provider -> default provider)")
        return True
        
    except Exception as e:
        print(f"❌ TEST 6 ERROR: {e}")
        return False

def test_get_jobs_list(cookie):
    """TEST 7: GET /api/admin/import/commit -> verify entity='appointments' jobs"""
    print("\n=== TEST 7: GET jobs list (verify entity='appointments') ===")
    url = f"{BASE_URL}/api/admin/import/commit"
    
    try:
        resp = requests.get(url, cookies={"proactive_session": cookie}, timeout=30)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 7 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return False
        
        data = resp.json()
        jobs = data.get("jobs", [])
        print(f"Jobs array has {len(jobs)} items")
        
        # Find jobs with entity='appointments'
        appt_jobs = [j for j in jobs if j.get("entity") == "appointments"]
        print(f"Found {len(appt_jobs)} jobs with entity='appointments'")
        
        if len(appt_jobs) == 0:
            print(f"❌ TEST 7 FAILED: No jobs with entity='appointments' found")
            return False
        
        # Show the appointment jobs
        for job in appt_jobs[:3]:  # Show first 3
            print(f"  Job ID: {job.get('id')}, source: {job.get('source')}, status: {job.get('status')}, created: {job.get('created')}, skipped: {job.get('skipped')}")
        
        print("✅ TEST 7 PASSED: Jobs list includes entity='appointments' entries")
        return True
        
    except Exception as e:
        print(f"❌ TEST 7 ERROR: {e}")
        return False

def main():
    print("=" * 80)
    print("BACKEND TEST: EMR Import Feature 2 - Appointment Import")
    print("=" * 80)
    
    results = []
    
    # TEST 1: Preview without auth
    results.append(("TEST 1: Preview without auth", test_preview_no_auth()))
    
    # Login as admin
    cookie = login_admin()
    if not cookie:
        print("\n❌ FATAL: Could not login as admin, aborting tests")
        sys.exit(1)
    
    # TEST 2: Preview minimal CSV + verify patient
    test2_result, provider_id = test_preview_minimal_csv(cookie)
    results.append(("TEST 2: Preview minimal CSV + verify patient", test2_result))
    
    if not provider_id:
        print("\n❌ FATAL: Could not get provider ID, aborting remaining tests")
        sys.exit(1)
    
    print(f"\n✅ Using provider ID: {provider_id}")
    
    # TEST 3: Preview full CSV
    results.append(("TEST 3: Preview full CSV", test_preview_full_csv(cookie)))
    
    # TEST 4: Commit first time
    results.append(("TEST 4: Commit first time", test_commit_first_time(cookie, provider_id)))
    
    # TEST 5: Commit dedupe
    results.append(("TEST 5: Commit dedupe", test_commit_dedupe(cookie, provider_id)))
    
    # TEST 6: Provider fallback
    results.append(("TEST 6: Provider fallback", test_provider_fallback(cookie, provider_id)))
    
    # TEST 7: Get jobs list
    results.append(("TEST 7: Get jobs list", test_get_jobs_list(cookie)))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = 0
    failed = 0
    for name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal: {passed} passed, {failed} failed out of {len(results)} tests")
    
    if failed == 0:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {failed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
