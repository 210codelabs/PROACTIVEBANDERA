#!/usr/bin/env python3
"""
Backend test for Patient Care-Team endpoints (Proactive Clinic).
Tests /api/patients/[id]/care-team (GET/POST/DELETE) - STAFF-ONLY.

Base URL: https://nextjs-ssr-stack.preview.emergentagent.com (session cookie secure:true)
Staff login: andy.manzano@proactiveclinic.com / apex123
"""

import requests
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def main():
    print("=" * 80)
    print("BACKEND TEST: Patient Care-Team Endpoints")
    print("=" * 80)
    
    # Step 0: Staff login to get session cookie
    print("\n[SETUP] Staff login...")
    try:
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "andy.manzano@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        if login_resp.status_code != 200:
            print(f"❌ Staff login failed: {login_resp.status_code} {login_resp.text}")
            sys.exit(1)
        staff_cookies = login_resp.cookies
        print(f"✅ Staff login successful (cookie: {staff_cookies.get('proactive_session')[:20]}...)")
    except Exception as e:
        print(f"❌ Staff login exception: {e}")
        sys.exit(1)
    
    # Step 1: Get patient id (Eleanor Adams via search)
    print("\n[SETUP] Get patient id (Eleanor Adams)...")
    try:
        search_resp = requests.get(
            f"{BASE_URL}/api/patients/search?q=Eleanor",
            cookies=staff_cookies,
            timeout=10
        )
        if search_resp.status_code != 200:
            print(f"❌ Patient search failed: {search_resp.status_code} {search_resp.text}")
            sys.exit(1)
        search_data = search_resp.json()
        if not search_data.get("results") or len(search_data["results"]) == 0:
            print(f"❌ No patients found for 'Eleanor'")
            sys.exit(1)
        patient = search_data["results"][0]
        patient_id = patient["id"]
        patient_name = f"{patient.get('firstName', '')} {patient.get('lastName', '')}"
        print(f"✅ Found patient: {patient_name} (id: {patient_id})")
    except Exception as e:
        print(f"❌ Patient search exception: {e}")
        sys.exit(1)
    
    # Test Case 1: GET without session -> 401
    print("\n[TEST 1] GET /api/patients/[id]/care-team without session -> 401")
    try:
        resp = requests.get(f"{BASE_URL}/api/patients/{patient_id}/care-team", timeout=10)
        if resp.status_code == 401:
            print(f"✅ PASS: GET without session correctly returns 401")
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # Test Case 2: POST with session, valid body -> 200
    print("\n[TEST 2] POST with session, valid body -> 200")
    member_id = None
    try:
        post_body = {
            "npi": "1770589525",
            "name": "Test Referral MD",
            "credential": "MD",
            "specialty": "Cardiology",
            "role": "Referring",
            "phone": "210-555-0170"
        }
        resp = requests.post(
            f"{BASE_URL}/api/patients/{patient_id}/care-team",
            json=post_body,
            cookies=staff_cookies,
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("member"):
                member = data["member"]
                member_id = member.get("id")
                if (member.get("role") == "Referring" and 
                    member.get("npi") == "1770589525" and 
                    member.get("name") == "Test Referral MD"):
                    print(f"✅ PASS: POST with session returns 200 {{ok:true, member:{{id:'{member_id}', role:'Referring', npi:'1770589525', name:'Test Referral MD'}}}}")
                else:
                    print(f"❌ FAIL: Member data incorrect: {member}")
            else:
                print(f"❌ FAIL: Response missing ok/member: {data}")
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # Test Case 3: GET with session -> 200 with members array
    print("\n[TEST 3] GET with session -> 200 with members array")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/patients/{patient_id}/care-team",
            cookies=staff_cookies,
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            if "members" in data and isinstance(data["members"], list):
                found = any(m.get("id") == member_id for m in data["members"])
                if found:
                    print(f"✅ PASS: GET with session returns 200 with members array including the member from TEST 2")
                else:
                    print(f"❌ FAIL: Member from TEST 2 not found in members array")
            else:
                print(f"❌ FAIL: Response missing members array: {data}")
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # Test Case 4: POST same npi again -> 409 (duplicate)
    print("\n[TEST 4] POST same npi again for same patient -> 409 (duplicate)")
    try:
        post_body = {
            "npi": "1770589525",
            "name": "Another Doctor",
            "role": "Specialist"
        }
        resp = requests.post(
            f"{BASE_URL}/api/patients/{patient_id}/care-team",
            json=post_body,
            cookies=staff_cookies,
            timeout=10
        )
        if resp.status_code == 409:
            print(f"✅ PASS: POST with duplicate npi correctly returns 409")
        else:
            print(f"❌ FAIL: Expected 409, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # Test Case 5: POST with session but no name -> 400
    print("\n[TEST 5] POST with session but no name -> 400")
    try:
        post_body = {"npi": "1999999999"}
        resp = requests.post(
            f"{BASE_URL}/api/patients/{patient_id}/care-team",
            json=post_body,
            cookies=staff_cookies,
            timeout=10
        )
        if resp.status_code == 400:
            print(f"✅ PASS: POST without name correctly returns 400")
        else:
            print(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # Test Case 6: POST to nonexistent patient id -> 404
    print("\n[TEST 6] POST to nonexistent patient id 'nope123' -> 404")
    try:
        post_body = {"name": "X"}
        resp = requests.post(
            f"{BASE_URL}/api/patients/nope123/care-team",
            json=post_body,
            cookies=staff_cookies,
            timeout=10
        )
        if resp.status_code == 404:
            print(f"✅ PASS: POST to nonexistent patient correctly returns 404")
        else:
            print(f"❌ FAIL: Expected 404, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # Test Case 7a: DELETE with session and memberId -> 200
    print("\n[TEST 7a] DELETE with session ?memberId=<id> -> 200")
    try:
        if not member_id:
            print(f"⚠️  SKIP: No member_id from TEST 2")
        else:
            resp = requests.delete(
                f"{BASE_URL}/api/patients/{patient_id}/care-team?memberId={member_id}",
                cookies=staff_cookies,
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    print(f"✅ PASS: DELETE with memberId correctly returns 200 {{ok:true}}")
                else:
                    print(f"❌ FAIL: Response missing ok: {data}")
            else:
                print(f"❌ FAIL: Expected 200, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # Test Case 7b: DELETE without memberId query param -> 400
    print("\n[TEST 7b] DELETE without memberId query param -> 400")
    try:
        resp = requests.delete(
            f"{BASE_URL}/api/patients/{patient_id}/care-team",
            cookies=staff_cookies,
            timeout=10
        )
        if resp.status_code == 400:
            print(f"✅ PASS: DELETE without memberId correctly returns 400")
        else:
            print(f"❌ FAIL: Expected 400, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # Test Case 7c: DELETE with nonexistent memberId -> 404
    print("\n[TEST 7c] DELETE ?memberId=doesnotexist -> 404")
    try:
        resp = requests.delete(
            f"{BASE_URL}/api/patients/{patient_id}/care-team?memberId=doesnotexist",
            cookies=staff_cookies,
            timeout=10
        )
        if resp.status_code == 404:
            print(f"✅ PASS: DELETE with nonexistent memberId correctly returns 404")
        else:
            print(f"❌ FAIL: Expected 404, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # Test Case 8a: POST without session -> 401
    print("\n[TEST 8a] POST without session -> 401")
    try:
        post_body = {"name": "Test"}
        resp = requests.post(
            f"{BASE_URL}/api/patients/{patient_id}/care-team",
            json=post_body,
            timeout=10
        )
        if resp.status_code == 401:
            print(f"✅ PASS: POST without session correctly returns 401")
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # Test Case 8b: DELETE without session -> 401
    print("\n[TEST 8b] DELETE without session -> 401")
    try:
        resp = requests.delete(
            f"{BASE_URL}/api/patients/{patient_id}/care-team?memberId=test",
            timeout=10
        )
        if resp.status_code == 401:
            print(f"✅ PASS: DELETE without session correctly returns 401")
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # CLEANUP: Ensure no care-team members remain for Eleanor Adams
    print("\n[CLEANUP] Removing any remaining care-team members for Eleanor Adams...")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/patients/{patient_id}/care-team",
            cookies=staff_cookies,
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            members = data.get("members", [])
            if len(members) == 0:
                print(f"✅ CLEANUP: No care-team members remain (already clean)")
            else:
                print(f"⚠️  Found {len(members)} care-team member(s), deleting...")
                for member in members:
                    mid = member.get("id")
                    del_resp = requests.delete(
                        f"{BASE_URL}/api/patients/{patient_id}/care-team?memberId={mid}",
                        cookies=staff_cookies,
                        timeout=10
                    )
                    if del_resp.status_code == 200:
                        print(f"   ✅ Deleted member {mid}")
                    else:
                        print(f"   ⚠️  Failed to delete member {mid}: {del_resp.status_code}")
                print(f"✅ CLEANUP: All care-team members removed")
        else:
            print(f"⚠️  CLEANUP: Could not fetch members: {resp.status_code}")
    except Exception as e:
        print(f"⚠️  CLEANUP exception: {e}")
    
    print("\n" + "=" * 80)
    print("BACKEND TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    main()
