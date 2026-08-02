#!/usr/bin/env python3
"""
Backend test for NEW public website scheduling endpoints:
- POST /api/appointments/request (PUBLIC)
- GET /api/appointments/request (STAFF-ONLY)
- PATCH /api/appointments/request/[id] (STAFF-ONLY)

Base URL: https://nextjs-ssr-stack.preview.emergentagent.com (HTTPS required for secure cookies)
"""

import requests
import re
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_post_new_patient_valid():
    """Test 1: POST new patient with valid data -> 200 with confirmation"""
    print("\n=== TEST 1: POST /api/appointments/request - NEW patient valid ===")
    try:
        payload = {
            "patientType": "new",
            "firstName": "Jane",
            "lastName": "Doe",
            "phone": "210-555-0100",
            "email": "jane@example.com",
            "serviceInterest": "Primary Care",
            "preferredDate": "2026-07-15",
            "preferredTime": "10:00"
        }
        resp = requests.post(f"{BASE_URL}/api/appointments/request", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {data}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert data.get("ok") is True, "Expected ok:true"
        assert "confirmation" in data, "Expected confirmation field"
        confirmation = data["confirmation"]
        assert re.match(r"^PC-[0-9]{6}$", confirmation), f"Confirmation format invalid: {confirmation}"
        assert data.get("priorityCheckin") is False, "Expected priorityCheckin:false for new patient"
        
        print(f"✅ PASS: New patient request created with confirmation {confirmation}, priorityCheckin=False")
        return confirmation
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return None

def test_post_new_patient_missing_name():
    """Test 2: POST new patient missing name -> 400"""
    print("\n=== TEST 2: POST /api/appointments/request - NEW patient missing name ===")
    try:
        payload = {"patientType": "new"}
        resp = requests.post(f"{BASE_URL}/api/appointments/request", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {data}")
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        assert "error" in data, "Expected error field"
        assert "name" in data["error"].lower(), "Expected error about name"
        
        print(f"✅ PASS: Missing name correctly returns 400 with error: {data['error']}")
    except Exception as e:
        print(f"❌ FAIL: {e}")

def test_post_existing_patient_valid():
    """Test 3: POST existing patient with valid MRN/DOB -> 200 with priorityCheckin:true"""
    print("\n=== TEST 3: POST /api/appointments/request - EXISTING patient valid ===")
    try:
        payload = {
            "patientType": "existing",
            "mrn": "PC-100000",
            "dob": "1958-04-12",
            "firstName": "Eleanor",
            "lastName": "Adams",
            "serviceInterest": "Follow-up Visit"
        }
        resp = requests.post(f"{BASE_URL}/api/appointments/request", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {data}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert data.get("ok") is True, "Expected ok:true"
        assert "confirmation" in data, "Expected confirmation field"
        confirmation = data["confirmation"]
        assert re.match(r"^PC-[0-9]{6}$", confirmation), f"Confirmation format invalid: {confirmation}"
        assert data.get("priorityCheckin") is True, "Expected priorityCheckin:true for existing patient"
        
        print(f"✅ PASS: Existing patient request created with confirmation {confirmation}, priorityCheckin=True")
        return confirmation
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return None

def test_post_existing_patient_wrong_dob():
    """Test 4: POST existing patient with wrong DOB -> 404"""
    print("\n=== TEST 4: POST /api/appointments/request - EXISTING patient wrong DOB ===")
    try:
        payload = {
            "patientType": "existing",
            "mrn": "PC-100000",
            "dob": "1999-01-01",
            "firstName": "Eleanor",
            "lastName": "Adams"
        }
        resp = requests.post(f"{BASE_URL}/api/appointments/request", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {data}")
        
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        assert "error" in data, "Expected error field"
        
        print(f"✅ PASS: Wrong DOB correctly returns 404 with error: {data['error']}")
    except Exception as e:
        print(f"❌ FAIL: {e}")

def test_post_existing_patient_unknown_mrn():
    """Test 5: POST existing patient with unknown MRN -> 404"""
    print("\n=== TEST 5: POST /api/appointments/request - EXISTING patient unknown MRN ===")
    try:
        payload = {
            "patientType": "existing",
            "mrn": "PC-000000",
            "dob": "1958-04-12",
            "firstName": "X",
            "lastName": "Y"
        }
        resp = requests.post(f"{BASE_URL}/api/appointments/request", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {data}")
        
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        assert "error" in data, "Expected error field"
        
        print(f"✅ PASS: Unknown MRN correctly returns 404 with error: {data['error']}")
    except Exception as e:
        print(f"❌ FAIL: {e}")

def test_post_existing_patient_missing_mrn_dob():
    """Test 6: POST existing patient missing MRN/DOB -> 400"""
    print("\n=== TEST 6: POST /api/appointments/request - EXISTING patient missing MRN/DOB ===")
    try:
        payload = {
            "patientType": "existing",
            "firstName": "A",
            "lastName": "B"
        }
        resp = requests.post(f"{BASE_URL}/api/appointments/request", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {data}")
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        assert "error" in data, "Expected error field"
        assert "mrn" in data["error"].lower() or "date of birth" in data["error"].lower(), "Expected error about MRN/DOB"
        
        print(f"✅ PASS: Missing MRN/DOB correctly returns 400 with error: {data['error']}")
    except Exception as e:
        print(f"❌ FAIL: {e}")

def test_get_without_session():
    """Test 7: GET /api/appointments/request without session -> 401"""
    print("\n=== TEST 7: GET /api/appointments/request - without session ===")
    try:
        resp = requests.get(f"{BASE_URL}/api/appointments/request", timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {data}")
        
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        assert "error" in data or "Unauthorized" in str(data), "Expected error or Unauthorized"
        
        print(f"✅ PASS: GET without session correctly returns 401")
    except Exception as e:
        print(f"❌ FAIL: {e}")

def staff_login():
    """Helper: Staff login to get session cookie"""
    print("\n=== STAFF LOGIN ===")
    try:
        payload = {
            "email": "andy.manzano@proactiveclinic.com",
            "password": "apex123"
        }
        resp = requests.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {data}")
        
        assert resp.status_code == 200, f"Login failed with status {resp.status_code}"
        assert data.get("ok") is True, "Login failed"
        
        cookies = resp.cookies
        assert "proactive_session" in cookies, "Session cookie not set"
        
        print(f"✅ Staff login successful, session cookie: {cookies.get('proactive_session')[:20]}...")
        return cookies
    except Exception as e:
        print(f"❌ Staff login failed: {e}")
        return None

def test_get_with_staff_session(cookies, expected_confirmations):
    """Test 8: GET /api/appointments/request with staff session -> 200 with requests array"""
    print("\n=== TEST 8: GET /api/appointments/request - with staff session ===")
    try:
        resp = requests.get(f"{BASE_URL}/api/appointments/request", cookies=cookies, timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response keys: {data.keys()}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert "requests" in data, "Expected requests field"
        assert isinstance(data["requests"], list), "Expected requests to be an array"
        
        print(f"✅ PASS: GET with staff session returns 200 with {len(data['requests'])} requests")
        
        # Verify our created requests are in the list
        confirmations_found = [r.get("confirmation") for r in data["requests"]]
        for conf in expected_confirmations:
            if conf in confirmations_found:
                print(f"  ✓ Found request with confirmation {conf}")
        
        return data["requests"]
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return []

def test_get_with_status_filter(cookies):
    """Test 9: GET /api/appointments/request?status=pending -> 200 with filtered results"""
    print("\n=== TEST 9: GET /api/appointments/request?status=pending ===")
    try:
        resp = requests.get(f"{BASE_URL}/api/appointments/request?status=pending", cookies=cookies, timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert "requests" in data, "Expected requests field"
        
        # Verify all returned items have status 'pending'
        for req in data["requests"]:
            assert req.get("status") == "pending", f"Expected status 'pending', got {req.get('status')}"
        
        print(f"✅ PASS: GET with status=pending returns {len(data['requests'])} pending requests, all have status 'pending'")
    except Exception as e:
        print(f"❌ FAIL: {e}")

def test_patch_without_session(request_id):
    """Test 10: PATCH /api/appointments/request/[id] without session -> 401"""
    print("\n=== TEST 10: PATCH /api/appointments/request/[id] - without session ===")
    try:
        payload = {"status": "confirmed"}
        resp = requests.patch(f"{BASE_URL}/api/appointments/request/{request_id}", json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {data}")
        
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        assert "error" in data or "Unauthorized" in str(data), "Expected error or Unauthorized"
        
        print(f"✅ PASS: PATCH without session correctly returns 401")
    except Exception as e:
        print(f"❌ FAIL: {e}")

def test_patch_with_staff_session_valid(cookies, request_id):
    """Test 11: PATCH /api/appointments/request/[id] with staff session and valid status -> 200"""
    print("\n=== TEST 11: PATCH /api/appointments/request/[id] - with staff session, status=confirmed ===")
    try:
        payload = {"status": "confirmed"}
        resp = requests.patch(f"{BASE_URL}/api/appointments/request/{request_id}", json=payload, cookies=cookies, timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {data}")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        assert data.get("ok") is True, "Expected ok:true"
        assert "request" in data, "Expected request field"
        assert data["request"].get("status") == "confirmed", f"Expected status 'confirmed', got {data['request'].get('status')}"
        
        print(f"✅ PASS: PATCH with staff session successfully updated status to 'confirmed'")
    except Exception as e:
        print(f"❌ FAIL: {e}")

def test_patch_with_invalid_status(cookies, request_id):
    """Test 12: PATCH /api/appointments/request/[id] with invalid status -> 400"""
    print("\n=== TEST 12: PATCH /api/appointments/request/[id] - invalid status ===")
    try:
        payload = {"status": "bogus"}
        resp = requests.patch(f"{BASE_URL}/api/appointments/request/{request_id}", json=payload, cookies=cookies, timeout=10)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {data}")
        
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        assert "error" in data, "Expected error field"
        assert "status" in data["error"].lower() or "invalid" in data["error"].lower(), "Expected error about invalid status"
        
        print(f"✅ PASS: Invalid status correctly returns 400 with error: {data['error']}")
    except Exception as e:
        print(f"❌ FAIL: {e}")

def main():
    print("=" * 80)
    print("BACKEND TEST: Public Website Scheduling Endpoints")
    print("Base URL:", BASE_URL)
    print("=" * 80)
    
    # Track created confirmations
    confirmations = []
    
    # Test POST endpoints (PUBLIC - no auth required)
    conf1 = test_post_new_patient_valid()
    if conf1:
        confirmations.append(conf1)
    
    test_post_new_patient_missing_name()
    
    conf2 = test_post_existing_patient_valid()
    if conf2:
        confirmations.append(conf2)
    
    test_post_existing_patient_wrong_dob()
    test_post_existing_patient_unknown_mrn()
    test_post_existing_patient_missing_mrn_dob()
    
    # Test GET without session (should fail)
    test_get_without_session()
    
    # Staff login
    cookies = staff_login()
    if not cookies:
        print("\n❌ CRITICAL: Staff login failed, cannot continue with staff-only tests")
        sys.exit(1)
    
    # Test GET with staff session
    requests_list = test_get_with_staff_session(cookies, confirmations)
    
    # Test GET with status filter
    test_get_with_status_filter(cookies)
    
    # Test PATCH endpoints
    # Find a request ID from our created requests
    request_id = None
    if requests_list:
        # Find one of our created requests by confirmation number
        for req in requests_list:
            if req.get("confirmation") in confirmations:
                request_id = req.get("id")
                print(f"\nUsing request ID {request_id} (confirmation {req.get('confirmation')}) for PATCH tests")
                break
    
    if not request_id and requests_list:
        # Fallback: use any pending request
        for req in requests_list:
            if req.get("status") == "pending":
                request_id = req.get("id")
                print(f"\nUsing fallback request ID {request_id} for PATCH tests")
                break
    
    if request_id:
        test_patch_without_session(request_id)
        test_patch_with_staff_session_valid(cookies, request_id)
        test_patch_with_invalid_status(cookies, request_id)
    else:
        print("\n⚠️  WARNING: No request ID found for PATCH tests")
    
    print("\n" + "=" * 80)
    print("BACKEND TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    main()
