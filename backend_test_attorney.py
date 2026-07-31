#!/usr/bin/env python3
"""
Attorney Portal End-to-End Backend Test
Tests the complete attorney record request flow with staff approval
"""
import requests
import json
import re
from datetime import datetime

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Test credentials
ATTORNEY_EMAIL = "attorney@example.com"
ATTORNEY_ACCESS_CODE = "PROLAW2025"
STAFF_EMAIL = "andy.manzano@proactiveclinic.com"
STAFF_PASSWORD = "apex123"
PATIENT_MRN = "PC-100000"
PATIENT_LASTNAME = "Adams"

# Separate sessions for attorney and staff
attorney_session = requests.Session()
staff_session = requests.Session()

def print_test(test_num, description):
    print(f"\n{'='*70}")
    print(f"TEST {test_num}: {description}")
    print('='*70)

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

# ============================================================================
# TEST 1: Attorney Login - Correct Credentials
# ============================================================================
print_test(1, "Attorney Login - Correct Credentials")
try:
    response = attorney_session.post(
        f"{BASE_URL}/api/attorney/auth/login",
        json={"email": ATTORNEY_EMAIL, "accessCode": ATTORNEY_ACCESS_CODE},
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get("ok") and data.get("name"):
            print_result(True, f"Login successful. Status: {response.status_code}")
            print(f"   Attorney name: {data.get('name')}")
            print(f"   Firm: {data.get('firm', 'N/A')}")
            # Check cookie
            cookies = attorney_session.cookies.get_dict()
            if "proactive_attorney_session" in cookies:
                print(f"   Cookie 'proactive_attorney_session' set: ✅")
            else:
                print(f"   WARNING: Cookie 'proactive_attorney_session' not found in session")
        else:
            print_result(False, f"Response missing 'ok' or 'name'. Data: {data}")
    else:
        print_result(False, f"Expected 200, got {response.status_code}. Response: {response.text}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# TEST 1b: Attorney Login - Wrong Access Code
# ============================================================================
print_test("1b", "Attorney Login - Wrong Access Code (expect 401)")
try:
    temp_session = requests.Session()
    response = temp_session.post(
        f"{BASE_URL}/api/attorney/auth/login",
        json={"email": ATTORNEY_EMAIL, "accessCode": "WRONGCODE"},
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 401:
        data = response.json()
        print_result(True, f"Correctly rejected with 401. Error: {data.get('error')}")
    else:
        print_result(False, f"Expected 401, got {response.status_code}. Response: {response.text}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# TEST 1c: Attorney Login - Missing Fields
# ============================================================================
print_test("1c", "Attorney Login - Missing Fields (expect 400)")
try:
    temp_session = requests.Session()
    response = temp_session.post(
        f"{BASE_URL}/api/attorney/auth/login",
        json={"email": ATTORNEY_EMAIL},  # Missing accessCode
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 400:
        data = response.json()
        print_result(True, f"Correctly rejected with 400. Error: {data.get('error')}")
    else:
        print_result(False, f"Expected 400, got {response.status_code}. Response: {response.text}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# TEST 2: GET Attorney Requests - With Cookie
# ============================================================================
print_test(2, "GET Attorney Requests - With Cookie")
try:
    response = attorney_session.get(f"{BASE_URL}/api/attorney/requests")
    
    if response.status_code == 200:
        data = response.json()
        if "attorney" in data and "requests" in data:
            print_result(True, f"Successfully retrieved requests. Status: {response.status_code}")
            print(f"   Attorney: {data['attorney'].get('name')}")
            print(f"   Number of requests: {len(data['requests'])}")
        else:
            print_result(False, f"Response missing 'attorney' or 'requests'. Data: {data}")
    else:
        print_result(False, f"Expected 200, got {response.status_code}. Response: {response.text}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# TEST 2b: GET Attorney Requests - Without Cookie
# ============================================================================
print_test("2b", "GET Attorney Requests - Without Cookie (expect 401)")
try:
    temp_session = requests.Session()
    response = temp_session.get(f"{BASE_URL}/api/attorney/requests")
    
    if response.status_code == 401:
        data = response.json()
        print_result(True, f"Correctly blocked with 401. Error: {data.get('error')}")
    else:
        print_result(False, f"Expected 401, got {response.status_code}. Response: {response.text}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# TEST 3: POST New Request - Valid
# ============================================================================
print_test(3, "POST New Request - Valid (MRN PC-100000, lastName Adams)")
request_id = None
try:
    response = attorney_session.post(
        f"{BASE_URL}/api/attorney/requests",
        json={
            "patientMrn": PATIENT_MRN,
            "patientLastName": PATIENT_LASTNAME,
            "reason": "Personal injury case - comprehensive medical records needed"
        },
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 201:
        data = response.json()
        if data.get("ok") and data.get("request"):
            request = data["request"]
            request_id = request.get("id")
            print_result(True, f"Request created successfully. Status: {response.status_code}")
            print(f"   Request ID: {request_id}")
            print(f"   Status: {request.get('status')}")
            print(f"   Patient MRN: {request.get('patientMrn')}")
            print(f"   Patient Last Name: {request.get('patientLastName')}")
            if request.get("status") != "pending":
                print(f"   WARNING: Expected status 'pending', got '{request.get('status')}'")
        else:
            print_result(False, f"Response missing 'ok' or 'request'. Data: {data}")
    else:
        print_result(False, f"Expected 201, got {response.status_code}. Response: {response.text}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# TEST 3b: POST New Request - Missing MRN
# ============================================================================
print_test("3b", "POST New Request - Missing MRN (expect 400)")
try:
    response = attorney_session.post(
        f"{BASE_URL}/api/attorney/requests",
        json={
            "patientLastName": PATIENT_LASTNAME,
            "reason": "Test"
        },
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 400:
        data = response.json()
        print_result(True, f"Correctly rejected with 400. Error: {data.get('error')}")
    else:
        print_result(False, f"Expected 400, got {response.status_code}. Response: {response.text}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# TEST 3c: POST New Request - Missing Last Name
# ============================================================================
print_test("3c", "POST New Request - Missing Last Name (expect 400)")
try:
    response = attorney_session.post(
        f"{BASE_URL}/api/attorney/requests",
        json={
            "patientMrn": PATIENT_MRN,
            "reason": "Test"
        },
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 400:
        data = response.json()
        print_result(True, f"Correctly rejected with 400. Error: {data.get('error')}")
    else:
        print_result(False, f"Expected 400, got {response.status_code}. Response: {response.text}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# TEST 4: GET Download Before Approval (expect 403)
# ============================================================================
if request_id:
    print_test(4, f"GET Download Before Approval - Request {request_id} (expect 403)")
    try:
        response = attorney_session.get(f"{BASE_URL}/api/attorney/requests/{request_id}/download")
        
        if response.status_code == 403:
            data = response.json()
            print_result(True, f"Correctly blocked with 403. Error: {data.get('error')}")
        else:
            print_result(False, f"Expected 403, got {response.status_code}. Response: {response.text[:200]}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
else:
    print_test(4, "GET Download Before Approval - SKIPPED (no request_id)")
    print_result(False, "Cannot test - request creation failed in TEST 3")

# ============================================================================
# TEST 5: Staff Login
# ============================================================================
print_test(5, "Staff Login")
try:
    response = staff_session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            print_result(True, f"Staff login successful. Status: {response.status_code}")
            print(f"   User: {data.get('user', {}).get('name', 'N/A')}")
            # Check cookie
            cookies = staff_session.cookies.get_dict()
            if "proactive_session" in cookies:
                print(f"   Cookie 'proactive_session' set: ✅")
            else:
                print(f"   WARNING: Cookie 'proactive_session' not found in session")
        else:
            print_result(False, f"Response missing 'ok'. Data: {data}")
    else:
        print_result(False, f"Expected 200, got {response.status_code}. Response: {response.text}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# TEST 5b: Staff GET Records Requests - With Cookie
# ============================================================================
print_test("5b", "Staff GET Records Requests - With Cookie")
found_request = False
try:
    response = staff_session.get(f"{BASE_URL}/api/records-requests")
    
    if response.status_code == 200:
        data = response.json()
        if "requests" in data:
            requests_list = data["requests"]
            print_result(True, f"Successfully retrieved requests. Status: {response.status_code}")
            print(f"   Total requests: {len(requests_list)}")
            
            # Check if our request is in the list
            if request_id:
                for req in requests_list:
                    if req.get("id") == request_id:
                        found_request = True
                        print(f"   ✅ Found our request ID: {request_id}")
                        print(f"      Status: {req.get('status')}")
                        print(f"      Attorney: {req.get('attorney', {}).get('name', 'N/A')}")
                        print(f"      Patient MRN: {req.get('patientMrn')}")
                        break
                
                if not found_request:
                    print(f"   ⚠️  WARNING: Our request ID {request_id} not found in list")
        else:
            print_result(False, f"Response missing 'requests'. Data: {data}")
    else:
        print_result(False, f"Expected 200, got {response.status_code}. Response: {response.text}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# TEST 5c: Staff GET Records Requests - Without Cookie
# ============================================================================
print_test("5c", "Staff GET Records Requests - Without Cookie (expect 401 or redirect)")
try:
    temp_session = requests.Session()
    response = temp_session.get(f"{BASE_URL}/api/records-requests", allow_redirects=False)
    
    if response.status_code in [401, 307, 302]:
        print_result(True, f"Correctly blocked/redirected with {response.status_code}")
        if response.status_code in [307, 302]:
            print(f"   Redirect location: {response.headers.get('Location', 'N/A')}")
    else:
        print_result(False, f"Expected 401/307/302, got {response.status_code}. Response: {response.text[:200]}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# TEST 6: Staff Approve Request
# ============================================================================
if request_id:
    print_test(6, f"Staff Approve Request - Request {request_id}")
    try:
        response = staff_session.patch(
            f"{BASE_URL}/api/records-requests/{request_id}",
            json={"status": "approved"},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") and data.get("request"):
                request = data["request"]
                print_result(True, f"Request approved successfully. Status: {response.status_code}")
                print(f"   Request ID: {request.get('id')}")
                print(f"   New Status: {request.get('status')}")
                if request.get("status") != "approved":
                    print(f"   WARNING: Expected status 'approved', got '{request.get('status')}'")
            else:
                print_result(False, f"Response missing 'ok' or 'request'. Data: {data}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}. Response: {response.text}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
else:
    print_test(6, "Staff Approve Request - SKIPPED (no request_id)")
    print_result(False, "Cannot test - request creation failed in TEST 3")

# ============================================================================
# TEST 6b: Staff PATCH - Invalid Status
# ============================================================================
if request_id:
    print_test("6b", "Staff PATCH - Invalid Status (expect 400)")
    try:
        response = staff_session.patch(
            f"{BASE_URL}/api/records-requests/{request_id}",
            json={"status": "invalid_status"},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 400:
            data = response.json()
            print_result(True, f"Correctly rejected with 400. Error: {data.get('error')}")
        else:
            print_result(False, f"Expected 400, got {response.status_code}. Response: {response.text}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
else:
    print_test("6b", "Staff PATCH - Invalid Status - SKIPPED (no request_id)")

# ============================================================================
# TEST 6c: Staff PATCH - Nonexistent ID
# ============================================================================
print_test("6c", "Staff PATCH - Nonexistent ID (expect 404)")
try:
    fake_id = "nonexistent_id_12345"
    response = staff_session.patch(
        f"{BASE_URL}/api/records-requests/{fake_id}",
        json={"status": "approved"},
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 404:
        data = response.json()
        print_result(True, f"Correctly rejected with 404. Error: {data.get('error')}")
    else:
        print_result(False, f"Expected 404, got {response.status_code}. Response: {response.text}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# TEST 7: Attorney Download After Approval
# ============================================================================
if request_id:
    print_test(7, f"Attorney Download After Approval - Request {request_id} (expect 200)")
    try:
        response = attorney_session.get(f"{BASE_URL}/api/attorney/requests/{request_id}/download")
        
        if response.status_code == 200:
            content_type = response.headers.get("Content-Type", "")
            content_disposition = response.headers.get("Content-Disposition", "")
            body = response.text
            
            # Check headers
            is_text_plain = "text/plain" in content_type
            is_attachment = "attachment" in content_disposition
            
            # Check body content
            contains_mrn = PATIENT_MRN in body
            contains_lastname = PATIENT_LASTNAME in body
            
            all_checks = is_text_plain and is_attachment and contains_mrn and contains_lastname
            
            print_result(all_checks, f"Download successful. Status: {response.status_code}")
            print(f"   Content-Type: {content_type} {'✅' if is_text_plain else '❌'}")
            print(f"   Content-Disposition: {content_disposition} {'✅' if is_attachment else '❌'}")
            print(f"   Body contains MRN '{PATIENT_MRN}': {'✅' if contains_mrn else '❌'}")
            print(f"   Body contains lastName '{PATIENT_LASTNAME}': {'✅' if contains_lastname else '❌'}")
            print(f"   Body length: {len(body)} characters")
            
            # Show first few lines
            lines = body.split('\n')[:10]
            print(f"   First 10 lines of body:")
            for line in lines:
                print(f"      {line}")
        else:
            print_result(False, f"Expected 200, got {response.status_code}. Response: {response.text[:200]}")
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
else:
    print_test(7, "Attorney Download After Approval - SKIPPED (no request_id)")
    print_result(False, "Cannot test - request creation failed in TEST 3")

# ============================================================================
# TEST 8: Negative Test - Wrong Last Name Mismatch
# ============================================================================
print_test(8, "Negative Test - Create Request with Wrong Last Name, Approve, Then Download (expect 404)")
wrong_request_id = None
try:
    # Create request with wrong lastName
    print("   Step 1: Creating request with MRN PC-100000 but WRONG lastName 'Wrong'")
    response = attorney_session.post(
        f"{BASE_URL}/api/attorney/requests",
        json={
            "patientMrn": PATIENT_MRN,
            "patientLastName": "Wrong",  # Wrong lastName
            "reason": "Test case for lastName mismatch"
        },
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 201:
        data = response.json()
        wrong_request_id = data.get("request", {}).get("id")
        print(f"   ✅ Request created with ID: {wrong_request_id}")
        
        # Approve it as staff
        print("   Step 2: Staff approving the request")
        response = staff_session.patch(
            f"{BASE_URL}/api/records-requests/{wrong_request_id}",
            json={"status": "approved"},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print(f"   ✅ Request approved")
            
            # Try to download - should fail with 404 due to lastName mismatch
            print("   Step 3: Attorney attempting download (should fail with 404)")
            response = attorney_session.get(f"{BASE_URL}/api/attorney/requests/{wrong_request_id}/download")
            
            if response.status_code == 404:
                data = response.json()
                print_result(True, f"Correctly blocked with 404 due to lastName mismatch. Error: {data.get('error')}")
            else:
                print_result(False, f"Expected 404, got {response.status_code}. Response: {response.text[:200]}")
        else:
            print_result(False, f"Failed to approve request. Status: {response.status_code}")
    else:
        print_result(False, f"Failed to create request. Status: {response.status_code}")
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "="*70)
print("ATTORNEY PORTAL END-TO-END TEST COMPLETE")
print("="*70)
print(f"Test completed at: {datetime.now().isoformat()}")
print("\nAll test cases executed. Review results above for pass/fail status.")
