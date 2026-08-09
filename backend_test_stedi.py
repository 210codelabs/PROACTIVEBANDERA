#!/usr/bin/env python3
"""
Backend test for Stedi integration end-to-end verification.
Tests connectivity, eligibility, claims, remittances, and auth.
"""

import requests
import json
import sys

# Use HTTPS URL because cookies are secure
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def print_test(msg):
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_result(success, msg):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {msg}")

def print_response(resp, show_body=True):
    print(f"Status: {resp.status_code}")
    if show_body:
        try:
            body = resp.json()
            print(f"Body: {json.dumps(body, indent=2)}")
        except Exception:
            print(f"Body (text): {resp.text[:500]}")

# ============================================================================
# SETUP: Login as admin and staff
# ============================================================================

print_test("SETUP: Admin login")
admin_session = requests.Session()
resp = admin_session.post(f"{BASE_URL}/api/auth/login", json={
    "email": "admin@proactiveclinic.com",
    "password": "apex123"
})
print_response(resp)
if resp.status_code == 200:
    print_result(True, "Admin login successful")
    admin_cookies = admin_session.cookies
else:
    print_result(False, "Admin login failed")
    sys.exit(1)

print_test("SETUP: Staff login")
staff_session = requests.Session()
resp = staff_session.post(f"{BASE_URL}/api/auth/login", json={
    "email": "andy.manzano@proactiveclinic.com",
    "password": "apex123"
})
print_response(resp)
if resp.status_code == 200:
    print_result(True, "Staff login successful")
    staff_cookies = staff_session.cookies
else:
    print_result(False, "Staff login failed")
    sys.exit(1)

# ============================================================================
# TEST 1: CONNECTIVITY - POST /api/admin/integrations/test as ADMIN
# ============================================================================

print_test("TEST 1: CONNECTIVITY - POST /api/admin/integrations/test as ADMIN")
resp = admin_session.post(f"{BASE_URL}/api/admin/integrations/test", json={
    "providerKey": "stedi"
})
print_response(resp)

try:
    data = resp.json()
    if resp.status_code == 200 and data.get("ok") == True:
        validation = data.get("validation", {})
        status = validation.get("status")
        message = validation.get("message", "")
        
        print(f"\nValidation Status: {status}")
        print(f"Validation Message: {message}")
        
        if status == "success":
            print_result(True, f"Connectivity test passed. Status: {status}, Message: {message}")
            if "Live connection" in message or "verified" in message.lower():
                print_result(True, "Message confirms live connection verified")
        else:
            print_result(False, f"Connectivity test returned status: {status}")
    else:
        print_result(False, f"Connectivity test failed with status {resp.status_code}")
except Exception as e:
    print_result(False, f"Error parsing connectivity response: {e}")

# ============================================================================
# TEST 2: ELIGIBILITY - POST /api/stedi/eligibility as STAFF (dummy member)
# ============================================================================

print_test("TEST 2: ELIGIBILITY - POST /api/stedi/eligibility as STAFF (dummy member)")
eligibility_payload = {
    "payerId": "ABHDB",
    "firstName": "Jane",
    "lastName": "Doe",
    "dateOfBirth": "1980-01-01",
    "memberId": "123456789"
}
resp = staff_session.post(f"{BASE_URL}/api/stedi/eligibility", json=eligibility_payload)
print_response(resp)

try:
    data = resp.json()
    if resp.status_code == 200:
        check = data.get("check", {})
        check_status = check.get("status")
        payer_name = check.get("payerName")
        
        print(f"\nCheck Status: {check_status}")
        print(f"Payer Name: {payer_name}")
        
        if check_status == "error":
            print_result(True, f"Eligibility check returned expected 'error' status (fake member). Status: {check_status}, Payer: {payer_name}")
            
            # Check if it's the expected AAA error
            summary = check.get("summary", [])
            if summary:
                print(f"Summary: {json.dumps(summary, indent=2)}")
                rejection_msg = next((s.get("value", "") for s in summary if s.get("label") == "Rejection"), "")
                if "Invalid" in rejection_msg or "Participant" in rejection_msg:
                    print_result(True, f"Expected AAA rejection found: {rejection_msg}")
            
            if payer_name and "Community Health Plan" in payer_name:
                print_result(True, f"Payer name is correct: {payer_name}")
        else:
            print_result(False, f"Unexpected check status: {check_status}")
        
        # Now verify it's saved in history
        print("\nVerifying eligibility check saved in history...")
        resp_get = staff_session.get(f"{BASE_URL}/api/stedi/eligibility")
        print_response(resp_get, show_body=False)
        
        if resp_get.status_code == 200:
            checks_data = resp_get.json()
            checks = checks_data.get("checks", [])
            print(f"Found {len(checks)} checks in history")
            
            # Look for our check
            found = False
            for c in checks:
                if c.get("payerId") == "ABHDB" and c.get("memberId") == "123456789":
                    found = True
                    print_result(True, f"Eligibility check found in history with status: {c.get('status')}")
                    break
            
            if not found:
                print_result(False, "Eligibility check not found in history")
        else:
            print_result(False, f"Failed to retrieve eligibility history: {resp_get.status_code}")
    else:
        print_result(False, f"Eligibility check failed with status {resp.status_code}")
except Exception as e:
    print_result(False, f"Error in eligibility test: {e}")

# ============================================================================
# TEST 3: CLAIM - POST /api/stedi/claims as STAFF, then submit (test mode limitation)
# ============================================================================

print_test("TEST 3a: CLAIM - POST /api/stedi/claims as STAFF (create draft)")
claim_payload = {
    "patientName": "Doe, Jane",
    "payerId": "ABHDB",
    "serviceLines": [
        {
            "procedureCode": "99213",
            "chargeCents": 15000,
            "units": 1,
            "serviceDate": "2026-01-15"
        }
    ],
    "diagnoses": [
        {
            "code": "I10"
        }
    ]
}
resp = staff_session.post(f"{BASE_URL}/api/stedi/claims", json=claim_payload)
print_response(resp)

claim_id = None
try:
    data = resp.json()
    if resp.status_code == 200 and data.get("ok") == True:
        claim = data.get("claim", {})
        claim_id = claim.get("id")
        claim_status = claim.get("status")
        
        print(f"\nClaim ID: {claim_id}")
        print(f"Claim Status: {claim_status}")
        
        if claim_id and claim_status == "draft":
            print_result(True, f"Draft claim created successfully. ID: {claim_id}, Status: {claim_status}")
        else:
            print_result(False, f"Unexpected claim response: {claim}")
    else:
        print_result(False, f"Failed to create claim: {resp.status_code}")
except Exception as e:
    print_result(False, f"Error creating claim: {e}")

# Now submit the claim
if claim_id:
    print_test("TEST 3b: CLAIM - POST /api/stedi/claims/{id}/submit (expect test mode limitation)")
    resp = staff_session.post(f"{BASE_URL}/api/stedi/claims/{claim_id}/submit")
    print_response(resp)
    
    try:
        data = resp.json()
        if resp.status_code == 200:
            # Check if there's an error field (expected for test mode)
            error = data.get("error", "")
            
            if error and "not available in Test Mode" in error:
                print_result(True, f"Expected test mode limitation error: {error}")
                
                # Verify claim status became "rejected"
                print("\nVerifying claim status became 'rejected'...")
                resp_get = staff_session.get(f"{BASE_URL}/api/stedi/claims")
                if resp_get.status_code == 200:
                    claims_data = resp_get.json()
                    claims = claims_data.get("claims", [])
                    
                    for c in claims:
                        if c.get("id") == claim_id:
                            final_status = c.get("status")
                            print(f"Claim status: {final_status}")
                            if final_status == "rejected":
                                print_result(True, f"Claim status correctly became 'rejected'")
                            else:
                                print_result(False, f"Claim status is '{final_status}', expected 'rejected'")
                            break
            elif data.get("ok") == True:
                print_result(False, "Claim submission succeeded unexpectedly (should fail in test mode)")
            else:
                print_result(False, f"Unexpected response: {data}")
        else:
            print_result(False, f"Claim submission failed with status {resp.status_code}")
    except Exception as e:
        print_result(False, f"Error submitting claim: {e}")
else:
    print_result(False, "Skipping claim submission test (no claim ID)")

# ============================================================================
# TEST 4: REMITTANCES - POST /api/stedi/remittances as STAFF
# ============================================================================

print_test("TEST 4: REMITTANCES - POST /api/stedi/remittances as STAFF")
resp = staff_session.post(f"{BASE_URL}/api/stedi/remittances", json={})
print_response(resp)

try:
    data = resp.json()
    if resp.status_code == 200:
        # In test mode, we expect either:
        # - ok:true with processed:0 (no ERAs available)
        # - or an error message about test mode
        
        if data.get("ok") == True:
            scanned = data.get("scanned", 0)
            processed = data.get("processed", 0)
            print(f"\nScanned: {scanned}, Processed: {processed}")
            print_result(True, f"Remittances endpoint working. Scanned: {scanned}, Processed: {processed} (expected 0 in test mode)")
        elif data.get("error"):
            error = data.get("error", "")
            print(f"\nError: {error}")
            print_result(True, f"Remittances returned error (expected in test mode): {error}")
        else:
            print_result(False, f"Unexpected remittances response: {data}")
    else:
        print_result(False, f"Remittances failed with status {resp.status_code}")
except Exception as e:
    print_result(False, f"Error in remittances test: {e}")

# ============================================================================
# TEST 5: AUTH - POST /api/admin/integrations/test as staff (non-admin) should fail
# ============================================================================

print_test("TEST 5: AUTH - POST /api/admin/integrations/test as staff (non-admin) should fail")
resp = staff_session.post(f"{BASE_URL}/api/admin/integrations/test", json={
    "providerKey": "stedi"
})
print_response(resp)

if resp.status_code in [401, 403]:
    print_result(True, f"Staff correctly blocked from admin endpoint with status {resp.status_code}")
else:
    print_result(False, f"Staff should be blocked but got status {resp.status_code}")

# ============================================================================
# SUMMARY
# ============================================================================

print("\n" + "="*80)
print("STEDI INTEGRATION TEST SUMMARY")
print("="*80)
print("""
Expected Results:
1. CONNECTIVITY: ✅ 200 {ok:true, validation:{status:'success', message about live connection}}
2. ELIGIBILITY: ✅ 200 with check.status='error' (fake member, AAA rejection), payerName='Community Health Plan of Washington'
3. CLAIM: ✅ Draft created, submit returns error 'not available in Test Mode', status becomes 'rejected'
4. REMITTANCES: ✅ 200 with processed:0 or error (test mode has no ERAs)
5. AUTH: ✅ 401/403 (staff blocked from admin endpoint)

What works LIVE: Connectivity + Eligibility (real 270/271 pipeline)
What's blocked by test mode: Claims submission + ERA remittances
""")

print("\nTest completed. Review results above.")
