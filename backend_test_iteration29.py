#!/usr/bin/env python3
"""
Backend test for Iteration 29: Prior Authorization + Eligibility Attach
Tests:
(A) PRIOR AUTH — /api/prior-auth:
    1. POST /api/prior-auth WITHOUT auth cookie -> expect 401
    2. GET /api/patients/search?q=Adams -> capture patient id (PID)
    3. POST /api/prior-auth create with patientId -> expect 200 {ok:true, request:{id}}
    4. POST /api/prior-auth update with id -> expect 200 (UPDATE same record, not create new)
    5. GET /api/prior-auth?patientId=PID -> expect 200 with requests array including RID
    6. DELETE /api/prior-auth?id=RID -> expect 200 {ok:true}

(B) ELIGIBILITY ATTACH — PATCH /api/stedi/eligibility:
    1. PATCH /api/stedi/eligibility WITHOUT cookie -> expect 401
    2. PATCH /api/stedi/eligibility {} (missing checkId/patientId) -> expect 400
    3. PATCH /api/stedi/eligibility {"checkId":"bogus123","patientId":PID} -> expect 404
    4. POST /api/stedi/eligibility to create check (may return error if Stedi not configured)
    5. If check.id returned, PATCH to attach to patient -> expect 200 {ok:true}
    6. GET /api/stedi/eligibility?patientId=PID should include the check
"""

import requests
import json
import sys

# Base URL - using HTTPS because session cookie is secure
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_iteration29():
    print("=" * 80)
    print("ITERATION 29 BACKEND TEST: Prior Authorization + Eligibility Attach")
    print("=" * 80)
    
    session = requests.Session()
    
    # ========================================================================
    # PART A: PRIOR AUTH TESTS
    # ========================================================================
    print("\n" + "=" * 80)
    print("PART A: PRIOR AUTH — /api/prior-auth")
    print("=" * 80)
    
    # ========================================================================
    # TEST A1: POST /api/prior-auth WITHOUT auth cookie -> expect 401
    # ========================================================================
    print("\n[TEST A1] POST /api/prior-auth WITHOUT auth cookie -> expect 401")
    try:
        unauth_resp = requests.post(
            f"{BASE_URL}/api/prior-auth",
            json={"patientId": "test", "serviceType": "PT evaluation"},
            timeout=10
        )
        print(f"  Status: {unauth_resp.status_code}")
        
        if unauth_resp.status_code == 401:
            print("  ✅ Correctly blocked with 401 Unauthorized")
        else:
            print(f"  ❌ Expected 401, got {unauth_resp.status_code}: {unauth_resp.text}")
            return False
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        return False
    
    # ========================================================================
    # STEP 0: Staff Login (admin@proactiveclinic.com)
    # ========================================================================
    print("\n[STEP 0] Staff Login (admin@proactiveclinic.com)")
    try:
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        print(f"  Status: {login_resp.status_code}")
        if login_resp.status_code == 200:
            print("  ✅ Staff login successful")
            cookies = session.cookies.get_dict()
            if 'proactive_session' in cookies:
                print(f"  ✅ Session cookie 'proactive_session' set")
            else:
                print(f"  ⚠️  Session cookie not found. Available cookies: {list(cookies.keys())}")
        else:
            print(f"  ❌ Staff login failed: {login_resp.text}")
            return False
    except Exception as e:
        print(f"  ❌ Staff login exception: {e}")
        return False
    
    # ========================================================================
    # TEST A2: GET /api/patients/search?q=Adams -> capture patient id (PID)
    # ========================================================================
    print("\n[TEST A2] GET /api/patients/search?q=Adams -> capture patient id (PID)")
    try:
        search_resp = session.get(f"{BASE_URL}/api/patients/search?q=Adams", timeout=10)
        print(f"  Status: {search_resp.status_code}")
        
        if search_resp.status_code != 200:
            print(f"  ❌ Expected 200, got {search_resp.status_code}: {search_resp.text}")
            return False
        
        search_data = search_resp.json()
        patients = search_data.get('results', [])
        
        if not patients:
            print(f"  ❌ No patients found with query 'Adams'")
            return False
        
        patient = patients[0]
        PID = patient.get('id')
        patient_name = f"{patient.get('firstName', '')} {patient.get('lastName', '')}"
        
        print(f"  ✅ Found patient: {patient_name} (ID: {PID})")
        
    except Exception as e:
        print(f"  ❌ Patient search exception: {e}")
        return False
    
    # ========================================================================
    # TEST A3: POST /api/prior-auth create -> expect 200 {ok:true, request:{id}}
    # ========================================================================
    print("\n[TEST A3] POST /api/prior-auth create with patientId -> expect 200 {ok:true, request:{id}}")
    try:
        create_payload = {
            "patientId": PID,
            "serviceType": "PT evaluation",
            "cptCodes": "97161",
            "status": "draft"
        }
        create_resp = session.post(
            f"{BASE_URL}/api/prior-auth",
            json=create_payload,
            timeout=10
        )
        print(f"  Status: {create_resp.status_code}")
        
        if create_resp.status_code != 200:
            print(f"  ❌ Expected 200, got {create_resp.status_code}: {create_resp.text}")
            return False
        
        create_data = create_resp.json()
        
        if not create_data.get('ok'):
            print(f"  ❌ Response missing 'ok:true': {json.dumps(create_data, indent=2)}")
            return False
        
        request_obj = create_data.get('request')
        if not request_obj or not request_obj.get('id'):
            print(f"  ❌ Response missing 'request.id': {json.dumps(create_data, indent=2)}")
            return False
        
        RID = request_obj['id']
        print(f"  ✅ Prior auth request created successfully")
        print(f"  ✅ Request ID (RID): {RID}")
        print(f"  ✅ Status: {request_obj.get('status')}")
        print(f"  ✅ Service Type: {request_obj.get('serviceType')}")
        print(f"  ✅ CPT Codes: {request_obj.get('cptCodes')}")
        
    except Exception as e:
        print(f"  ❌ Create prior auth exception: {e}")
        return False
    
    # ========================================================================
    # TEST A4: POST /api/prior-auth update with id -> expect 200 (UPDATE same record)
    # ========================================================================
    print("\n[TEST A4] POST /api/prior-auth update with id -> expect 200 (UPDATE same record, not create new)")
    try:
        update_payload = {
            "id": RID,
            "status": "approved",
            "authNumber": "AUTH123"
        }
        update_resp = session.post(
            f"{BASE_URL}/api/prior-auth",
            json=update_payload,
            timeout=10
        )
        print(f"  Status: {update_resp.status_code}")
        
        if update_resp.status_code != 200:
            print(f"  ❌ Expected 200, got {update_resp.status_code}: {update_resp.text}")
            return False
        
        update_data = update_resp.json()
        
        if not update_data.get('ok'):
            print(f"  ❌ Response missing 'ok:true': {json.dumps(update_data, indent=2)}")
            return False
        
        updated_request = update_data.get('request')
        if not updated_request:
            print(f"  ❌ Response missing 'request': {json.dumps(update_data, indent=2)}")
            return False
        
        # Verify it's the SAME record (same ID)
        if updated_request.get('id') != RID:
            print(f"  ❌ Expected same ID {RID}, got {updated_request.get('id')} (created new record instead of updating)")
            return False
        
        # Verify status and authNumber were updated
        if updated_request.get('status') != 'approved':
            print(f"  ❌ Expected status 'approved', got '{updated_request.get('status')}'")
            return False
        
        if updated_request.get('authNumber') != 'AUTH123':
            print(f"  ❌ Expected authNumber 'AUTH123', got '{updated_request.get('authNumber')}'")
            return False
        
        print(f"  ✅ Prior auth request updated successfully (SAME record)")
        print(f"  ✅ Request ID: {updated_request.get('id')} (matches RID: {RID})")
        print(f"  ✅ Status updated to: {updated_request.get('status')}")
        print(f"  ✅ Auth Number: {updated_request.get('authNumber')}")
        
    except Exception as e:
        print(f"  ❌ Update prior auth exception: {e}")
        return False
    
    # ========================================================================
    # TEST A5: GET /api/prior-auth?patientId=PID -> expect 200 with requests array
    # ========================================================================
    print("\n[TEST A5] GET /api/prior-auth?patientId=PID -> expect 200 with requests array including RID")
    try:
        list_resp = session.get(f"{BASE_URL}/api/prior-auth?patientId={PID}", timeout=10)
        print(f"  Status: {list_resp.status_code}")
        
        if list_resp.status_code != 200:
            print(f"  ❌ Expected 200, got {list_resp.status_code}: {list_resp.text}")
            return False
        
        list_data = list_resp.json()
        requests_array = list_data.get('requests', [])
        
        if not isinstance(requests_array, list):
            print(f"  ❌ Expected 'requests' array, got: {type(requests_array)}")
            return False
        
        # Find our request in the array
        found_request = None
        for req in requests_array:
            if req.get('id') == RID:
                found_request = req
                break
        
        if not found_request:
            print(f"  ❌ Request ID {RID} not found in requests array")
            print(f"  Available request IDs: {[r.get('id') for r in requests_array]}")
            return False
        
        # Verify the request has the updated values
        if found_request.get('status') != 'approved':
            print(f"  ❌ Expected status 'approved', got '{found_request.get('status')}'")
            return False
        
        if found_request.get('authNumber') != 'AUTH123':
            print(f"  ❌ Expected authNumber 'AUTH123', got '{found_request.get('authNumber')}'")
            return False
        
        print(f"  ✅ GET /api/prior-auth?patientId={PID} returned requests array")
        print(f"  ✅ Found request ID {RID} in array")
        print(f"  ✅ Status: {found_request.get('status')}")
        print(f"  ✅ Auth Number: {found_request.get('authNumber')}")
        print(f"  ✅ Total requests for patient: {len(requests_array)}")
        
    except Exception as e:
        print(f"  ❌ List prior auth exception: {e}")
        return False
    
    # ========================================================================
    # TEST A6: DELETE /api/prior-auth?id=RID -> expect 200 {ok:true}
    # ========================================================================
    print("\n[TEST A6] DELETE /api/prior-auth?id=RID -> expect 200 {ok:true}")
    try:
        delete_resp = session.delete(f"{BASE_URL}/api/prior-auth?id={RID}", timeout=10)
        print(f"  Status: {delete_resp.status_code}")
        
        if delete_resp.status_code != 200:
            print(f"  ❌ Expected 200, got {delete_resp.status_code}: {delete_resp.text}")
            return False
        
        delete_data = delete_resp.json()
        
        if not delete_data.get('ok'):
            print(f"  ❌ Response missing 'ok:true': {json.dumps(delete_data, indent=2)}")
            return False
        
        print(f"  ✅ DELETE /api/prior-auth?id={RID} returned 200 {{'ok':true}}")
        
        # Verify the request is no longer in the list
        verify_resp = session.get(f"{BASE_URL}/api/prior-auth?patientId={PID}", timeout=10)
        if verify_resp.status_code == 200:
            verify_data = verify_resp.json()
            verify_requests = verify_data.get('requests', [])
            
            # Check if RID is still in the list
            still_exists = any(r.get('id') == RID for r in verify_requests)
            
            if still_exists:
                print(f"  ❌ Request ID {RID} still exists after DELETE")
                return False
            else:
                print(f"  ✅ Verified: Request ID {RID} no longer in list (successfully deleted)")
        
    except Exception as e:
        print(f"  ❌ Delete prior auth exception: {e}")
        return False
    
    # ========================================================================
    # PART B: ELIGIBILITY ATTACH TESTS
    # ========================================================================
    print("\n" + "=" * 80)
    print("PART B: ELIGIBILITY ATTACH — PATCH /api/stedi/eligibility")
    print("=" * 80)
    
    # ========================================================================
    # TEST B1: PATCH /api/stedi/eligibility WITHOUT cookie -> expect 401
    # ========================================================================
    print("\n[TEST B1] PATCH /api/stedi/eligibility WITHOUT cookie -> expect 401")
    try:
        unauth_resp = requests.patch(
            f"{BASE_URL}/api/stedi/eligibility",
            json={"checkId": "test", "patientId": "test"},
            timeout=10
        )
        print(f"  Status: {unauth_resp.status_code}")
        
        if unauth_resp.status_code == 401:
            print("  ✅ Correctly blocked with 401 Unauthorized")
        else:
            print(f"  ❌ Expected 401, got {unauth_resp.status_code}: {unauth_resp.text}")
            return False
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        return False
    
    # ========================================================================
    # TEST B2: PATCH /api/stedi/eligibility {} (missing checkId/patientId) -> expect 400
    # ========================================================================
    print("\n[TEST B2] PATCH /api/stedi/eligibility {} (missing checkId/patientId) -> expect 400")
    try:
        # Test with empty body
        empty_resp = session.patch(
            f"{BASE_URL}/api/stedi/eligibility",
            json={},
            timeout=10
        )
        print(f"  Status (empty body): {empty_resp.status_code}")
        
        if empty_resp.status_code == 400:
            print("  ✅ Empty body correctly returns 400")
            print(f"  ✅ Error message: {empty_resp.json().get('error')}")
        else:
            print(f"  ❌ Expected 400, got {empty_resp.status_code}: {empty_resp.text}")
            return False
        
        # Test with only checkId (missing patientId)
        missing_patient_resp = session.patch(
            f"{BASE_URL}/api/stedi/eligibility",
            json={"checkId": "test123"},
            timeout=10
        )
        print(f"  Status (missing patientId): {missing_patient_resp.status_code}")
        
        if missing_patient_resp.status_code == 400:
            print("  ✅ Missing patientId correctly returns 400")
        else:
            print(f"  ❌ Expected 400, got {missing_patient_resp.status_code}")
            return False
        
        # Test with only patientId (missing checkId)
        missing_check_resp = session.patch(
            f"{BASE_URL}/api/stedi/eligibility",
            json={"patientId": PID},
            timeout=10
        )
        print(f"  Status (missing checkId): {missing_check_resp.status_code}")
        
        if missing_check_resp.status_code == 400:
            print("  ✅ Missing checkId correctly returns 400")
        else:
            print(f"  ❌ Expected 400, got {missing_check_resp.status_code}")
            return False
        
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        return False
    
    # ========================================================================
    # TEST B3: PATCH /api/stedi/eligibility {"checkId":"bogus123","patientId":PID} -> expect 404
    # ========================================================================
    print("\n[TEST B3] PATCH /api/stedi/eligibility with bogus checkId -> expect 404")
    try:
        bogus_resp = session.patch(
            f"{BASE_URL}/api/stedi/eligibility",
            json={"checkId": "bogus123", "patientId": PID},
            timeout=10
        )
        print(f"  Status: {bogus_resp.status_code}")
        
        if bogus_resp.status_code == 404:
            print("  ✅ Bogus checkId correctly returns 404")
            print(f"  ✅ Error message: {bogus_resp.json().get('error')}")
        else:
            print(f"  ❌ Expected 404, got {bogus_resp.status_code}: {bogus_resp.text}")
            return False
        
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        return False
    
    # ========================================================================
    # TEST B4: POST /api/stedi/eligibility to create check
    # ========================================================================
    print("\n[TEST B4] POST /api/stedi/eligibility to create check (may return error if Stedi not configured)")
    try:
        eligibility_payload = {
            "payerId": "87726",
            "memberId": "TEST123",
            "firstName": "Jane",
            "lastName": "Doe",
            "dateOfBirth": "1980-01-01"
        }
        
        eligibility_resp = session.post(
            f"{BASE_URL}/api/stedi/eligibility",
            json=eligibility_payload,
            timeout=15
        )
        print(f"  Status: {eligibility_resp.status_code}")
        
        if eligibility_resp.status_code != 200:
            print(f"  ❌ Expected 200, got {eligibility_resp.status_code}: {eligibility_resp.text}")
            return False
        
        eligibility_data = eligibility_resp.json()
        print(f"  Response keys: {list(eligibility_data.keys())}")
        
        # Check if we got a check or an error
        if 'check' in eligibility_data:
            check_obj = eligibility_data['check']
            check_id = check_obj.get('id')
            
            if not check_id:
                print(f"  ❌ Response has 'check' but missing 'id': {json.dumps(check_obj, indent=2)}")
                return False
            
            print(f"  ✅ POST /api/stedi/eligibility returned check with ID: {check_id}")
            print(f"  ✅ Check status: {check_obj.get('status')}")
            
            # ========================================================================
            # TEST B5: PATCH /api/stedi/eligibility to attach check to patient
            # ========================================================================
            print("\n[TEST B5] PATCH /api/stedi/eligibility to attach check to patient -> expect 200 {ok:true}")
            try:
                attach_payload = {
                    "checkId": check_id,
                    "patientId": PID
                }
                
                attach_resp = session.patch(
                    f"{BASE_URL}/api/stedi/eligibility",
                    json=attach_payload,
                    timeout=10
                )
                print(f"  Status: {attach_resp.status_code}")
                
                if attach_resp.status_code != 200:
                    print(f"  ❌ Expected 200, got {attach_resp.status_code}: {attach_resp.text}")
                    return False
                
                attach_data = attach_resp.json()
                
                if not attach_data.get('ok'):
                    print(f"  ❌ Response missing 'ok:true': {json.dumps(attach_data, indent=2)}")
                    return False
                
                attached_check = attach_data.get('check')
                if not attached_check:
                    print(f"  ❌ Response missing 'check': {json.dumps(attach_data, indent=2)}")
                    return False
                
                # Verify the check is now attached to the patient
                if attached_check.get('patientId') != PID:
                    print(f"  ❌ Expected patientId {PID}, got {attached_check.get('patientId')}")
                    return False
                
                print(f"  ✅ PATCH /api/stedi/eligibility returned 200 {{'ok':true}}")
                print(f"  ✅ Check ID {check_id} successfully attached to patient {PID}")
                print(f"  ✅ Patient name in check: {attached_check.get('patientName')}")
                
                # ========================================================================
                # TEST B6: GET /api/stedi/eligibility?patientId=PID should include the check
                # ========================================================================
                print("\n[TEST B6] GET /api/stedi/eligibility?patientId=PID should include the check")
                try:
                    get_checks_resp = session.get(
                        f"{BASE_URL}/api/stedi/eligibility?patientId={PID}",
                        timeout=10
                    )
                    print(f"  Status: {get_checks_resp.status_code}")
                    
                    if get_checks_resp.status_code != 200:
                        print(f"  ❌ Expected 200, got {get_checks_resp.status_code}: {get_checks_resp.text}")
                        return False
                    
                    get_checks_data = get_checks_resp.json()
                    checks_array = get_checks_data.get('checks', [])
                    
                    if not isinstance(checks_array, list):
                        print(f"  ❌ Expected 'checks' array, got: {type(checks_array)}")
                        return False
                    
                    # Find our check in the array
                    found_check = None
                    for chk in checks_array:
                        if chk.get('id') == check_id:
                            found_check = chk
                            break
                    
                    if not found_check:
                        print(f"  ❌ Check ID {check_id} not found in checks array")
                        print(f"  Available check IDs: {[c.get('id') for c in checks_array]}")
                        return False
                    
                    # Verify the check is attached to the correct patient
                    if found_check.get('patientId') != PID:
                        print(f"  ❌ Expected patientId {PID}, got {found_check.get('patientId')}")
                        return False
                    
                    print(f"  ✅ GET /api/stedi/eligibility?patientId={PID} returned checks array")
                    print(f"  ✅ Found check ID {check_id} in array")
                    print(f"  ✅ Check is attached to patient {PID}")
                    print(f"  ✅ Total checks for patient: {len(checks_array)}")
                    
                except Exception as e:
                    print(f"  ❌ GET checks exception: {e}")
                    return False
                
            except Exception as e:
                print(f"  ❌ Attach check exception: {e}")
                return False
            
        elif 'error' in eligibility_data:
            error_msg = eligibility_data['error']
            print(f"  ⚠️  POST /api/stedi/eligibility returned error (Stedi not configured or test member rejected)")
            print(f"  ⚠️  Error: {error_msg}")
            print(f"  ℹ️  This is ACCEPTABLE per test instructions (Stedi may not be configured)")
            print(f"  ℹ️  Skipping successful-attach sub-steps (B5, B6) as no check.id was returned")
            
            # Verify POST /api/stedi/eligibility itself still responds with 200
            print(f"  ✅ POST /api/stedi/eligibility responds with 200 (even with error)")
            
        else:
            print(f"  ❌ Response missing both 'check' and 'error': {json.dumps(eligibility_data, indent=2)}")
            return False
        
    except Exception as e:
        print(f"  ❌ Create eligibility check exception: {e}")
        return False
    
    # ========================================================================
    # ALL TESTS PASSED
    # ========================================================================
    print("\n" + "=" * 80)
    print("✅ ALL ITERATION 29 TESTS PASSED")
    print("=" * 80)
    return True

if __name__ == "__main__":
    try:
        success = test_iteration29()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
