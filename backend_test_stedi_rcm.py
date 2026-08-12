#!/usr/bin/env python3
"""
Backend test for Stedi RCM Expansion (Prior Auth 278 / Claim Status 276-277 / ERA 835 webhook)
Tests the NEW Stedi Revenue-Cycle backend endpoints for the "Proactive Clinic" Next.js app.

IMPORTANT: Stedi live transactions depend on the account API key/enrollment. Where a live Stedi 
call cannot succeed, the routes are DESIGNED to return HTTP 200 with an {error: "..."} string, 
OR 400 "Stedi is not configured." — NOT a 500. Treat a payer/Stedi rejection returned as a 
200 {error} as a PASS (the route handled it gracefully). Only a 500 / crash / wrong-status is a failure.
"""

import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
LOGIN_EMAIL = "billing@proactiveclinic.com"
LOGIN_PASSWORD = "apex123"

def login():
    """Login and return session cookie"""
    print("\n=== LOGIN ===")
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
        allow_redirects=False
    )
    print(f"Login status: {resp.status_code}")
    
    if resp.status_code not in [200, 302]:
        print(f"Login failed: {resp.text[:200]}")
        sys.exit(1)
    
    cookie = resp.cookies.get("proactive_session")
    if not cookie:
        print("No proactive_session cookie received")
        print(f"Available cookies: {list(resp.cookies.keys())}")
        sys.exit(1)
    
    print(f"✅ Login successful, session cookie obtained")
    return {"proactive_session": cookie}

def test_prior_auth(cookies):
    """Test PRIOR AUTH (278 tracker) endpoints"""
    print("\n" + "="*80)
    print("TEST 1: PRIOR AUTH (278 tracker)")
    print("="*80)
    
    # TEST 1.1: GET /api/prior-auth WITHOUT cookie -> 401
    print("\n--- TEST 1.1: GET /api/prior-auth WITHOUT cookie -> 401 ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/prior-auth")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ PASS: Returns 401 Unauthorized without cookie")
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # TEST 1.2: Get a real patientId from GET /api/patients/search?q=a&limit=5
    print("\n--- TEST 1.2: Get a real patientId ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/patients/search?q=a&limit=5", cookies=cookies)
        print(f"Status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"❌ FAIL: Patient search failed with {resp.status_code}")
            return False
        
        data = resp.json()
        if not data.get("results") or len(data["results"]) == 0:
            print(f"❌ FAIL: No patients found")
            return False
        
        patient_id = data["results"][0]["id"]
        patient_name = f"{data['results'][0].get('lastName', '')}, {data['results'][0].get('firstName', '')}"
        print(f"✅ PASS: Found patient ID: {patient_id}, name: {patient_name}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # TEST 1.3: Create: POST /api/prior-auth
    print("\n--- TEST 1.3: Create prior auth request ---")
    try:
        create_data = {
            "patientId": patient_id,
            "patientName": patient_name,
            "payerId": "87726",
            "serviceType": "MRI lumbar",
            "cptCodes": "72148",
            "status": "draft"
        }
        resp = requests.post(f"{BASE_URL}/api/prior-auth", json=create_data, cookies=cookies)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Create failed with {resp.status_code}: {resp.text[:200]}")
            return False
        
        data = resp.json()
        if not data.get("ok") or not data.get("request") or not data["request"].get("id"):
            print(f"❌ FAIL: Response missing ok:true or request.id: {json.dumps(data, indent=2)[:300]}")
            return False
        
        request_id = data["request"]["id"]
        print(f"✅ PASS: Created prior auth request with ID: {request_id}")
        print(f"   Status: {data['request'].get('status')}")
        print(f"   Service: {data['request'].get('serviceType')}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # TEST 1.4: Edit: POST /api/prior-auth with id to update
    print("\n--- TEST 1.4: Edit prior auth request (update status and authNumber) ---")
    try:
        update_data = {
            "id": request_id,
            "status": "pending",
            "authNumber": "TEST123"
        }
        resp = requests.post(f"{BASE_URL}/api/prior-auth", json=update_data, cookies=cookies)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: Update failed with {resp.status_code}: {resp.text[:200]}")
            return False
        
        data = resp.json()
        if not data.get("ok") or not data.get("request"):
            print(f"❌ FAIL: Response missing ok:true or request: {json.dumps(data, indent=2)[:300]}")
            return False
        
        # Verify the update
        if data["request"].get("status") != "pending":
            print(f"❌ FAIL: Status not updated. Expected 'pending', got '{data['request'].get('status')}'")
            return False
        
        if data["request"].get("authNumber") != "TEST123":
            print(f"❌ FAIL: authNumber not updated. Expected 'TEST123', got '{data['request'].get('authNumber')}'")
            return False
        
        print(f"✅ PASS: Updated prior auth request")
        print(f"   Status: {data['request'].get('status')}")
        print(f"   Auth Number: {data['request'].get('authNumber')}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # TEST 1.5: GET /api/prior-auth -> list includes the created request
    print("\n--- TEST 1.5: GET /api/prior-auth -> list includes created request ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/prior-auth", cookies=cookies)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: GET failed with {resp.status_code}")
            return False
        
        data = resp.json()
        requests_list = data.get("requests", [])
        
        found = False
        for req in requests_list:
            if req.get("id") == request_id:
                found = True
                print(f"✅ PASS: Found created request in list")
                print(f"   ID: {req.get('id')}")
                print(f"   Status: {req.get('status')}")
                print(f"   Auth Number: {req.get('authNumber')}")
                break
        
        if not found:
            print(f"❌ FAIL: Created request not found in list")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # TEST 1.6: Auth-required detection: POST /api/prior-auth/check-required
    print("\n--- TEST 1.6: Auth-required detection (CRITICAL: MUST be 200, never 500) ---")
    try:
        check_data = {"id": request_id}
        resp = requests.post(f"{BASE_URL}/api/prior-auth/check-required", json=check_data, cookies=cookies)
        print(f"Status: {resp.status_code}")
        
        # CRITICAL: MUST be 200 (either success or {error}), never 500
        if resp.status_code == 500:
            print(f"❌ FAIL: Returned 500 (should be 200 with error or success)")
            print(f"Response: {resp.text[:500]}")
            return False
        
        if resp.status_code == 400:
            # 400 is acceptable if Stedi is not configured
            data = resp.json()
            if "not configured" in data.get("error", "").lower():
                print(f"✅ PASS: Returns 400 'Stedi is not configured.' (acceptable)")
                print(f"   Error: {data.get('error')}")
            else:
                print(f"⚠️  WARNING: Returns 400 but not 'not configured': {data.get('error')}")
        elif resp.status_code == 200:
            data = resp.json()
            # Either {ok:true, auth:{required, detail}} OR {error:"..."}
            if data.get("error"):
                print(f"✅ PASS: Returns 200 with error (graceful handling)")
                print(f"   Error: {data.get('error')[:200]}")
            elif data.get("ok") and data.get("auth"):
                print(f"✅ PASS: Returns 200 with auth object (success)")
                print(f"   Auth Required: {data['auth'].get('required')}")
                print(f"   Detail: {data['auth'].get('detail', '')[:100]}")
            else:
                print(f"⚠️  WARNING: Returns 200 but unexpected structure: {json.dumps(data, indent=2)[:300]}")
        else:
            print(f"⚠️  WARNING: Unexpected status {resp.status_code}")
            print(f"Response: {resp.text[:300]}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # TEST 1.7: Cleanup: DELETE /api/prior-auth?id=
    print("\n--- TEST 1.7: Cleanup - DELETE prior auth request ---")
    try:
        resp = requests.delete(f"{BASE_URL}/api/prior-auth?id={request_id}", cookies=cookies)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: DELETE failed with {resp.status_code}")
            return False
        
        data = resp.json()
        if not data.get("ok"):
            print(f"❌ FAIL: Response missing ok:true: {json.dumps(data, indent=2)}")
            return False
        
        print(f"✅ PASS: Deleted prior auth request")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    print("\n✅ ALL PRIOR AUTH TESTS PASSED")
    return True

def test_claim_status(cookies):
    """Test CLAIM STATUS (276/277 normalization + history) endpoints"""
    print("\n" + "="*80)
    print("TEST 2: CLAIM STATUS (276/277 normalization + history)")
    print("="*80)
    
    # TEST 2.1: GET /api/stedi/claims -> 200 {claims:[]}
    print("\n--- TEST 2.1: GET /api/stedi/claims ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/stedi/claims", cookies=cookies)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: GET claims failed with {resp.status_code}")
            return False
        
        data = resp.json()
        claims = data.get("claims", [])
        print(f"✅ PASS: Returns 200 with {len(claims)} claims")
        
        # Find a non-draft claim to test status endpoint
        non_draft_claim = None
        for claim in claims:
            if claim.get("status") != "draft":
                non_draft_claim = claim
                break
        
        if non_draft_claim:
            print(f"   Found non-draft claim: ID={non_draft_claim.get('id')}, status={non_draft_claim.get('status')}")
            
            # TEST 2.2: GET /api/stedi/claims/<id>/status
            print("\n--- TEST 2.2: GET /api/stedi/claims/<id>/status (CRITICAL: MUST be 200, never 500) ---")
            try:
                claim_id = non_draft_claim.get("id")
                resp = requests.get(f"{BASE_URL}/api/stedi/claims/{claim_id}/status", cookies=cookies)
                print(f"Status: {resp.status_code}")
                
                # CRITICAL: MUST be 200 (either success or {error}), never 500
                if resp.status_code == 500:
                    print(f"❌ FAIL: Returned 500 (should be 200 with error or success)")
                    print(f"Response: {resp.text[:500]}")
                    return False
                
                if resp.status_code == 400:
                    # 400 is acceptable if Stedi is not configured
                    data = resp.json()
                    if "not configured" in data.get("error", "").lower():
                        print(f"✅ PASS: Returns 400 'Stedi is not configured.' (acceptable)")
                        print(f"   Error: {data.get('error')}")
                    else:
                        print(f"⚠️  WARNING: Returns 400 but not 'not configured': {data.get('error')}")
                elif resp.status_code == 200:
                    data = resp.json()
                    # Either {ok:true, summary:{category, statusText}} OR {error:"..."}
                    if data.get("error"):
                        print(f"✅ PASS: Returns 200 with error (graceful handling)")
                        print(f"   Error: {data.get('error')[:200]}")
                    elif data.get("ok") and data.get("summary"):
                        print(f"✅ PASS: Returns 200 with summary object (success)")
                        print(f"   Category: {data['summary'].get('category')}")
                        print(f"   Status Text: {data['summary'].get('statusText', '')[:100]}")
                        
                        # Verify statusHistory was appended
                        if data.get("claim") and data["claim"].get("statusHistory"):
                            print(f"   Status History entries: {len(data['claim']['statusHistory'])}")
                            print(f"✅ PASS: statusHistory appended")
                        else:
                            print(f"⚠️  WARNING: statusHistory not found in response")
                    else:
                        print(f"⚠️  WARNING: Returns 200 but unexpected structure: {json.dumps(data, indent=2)[:300]}")
                else:
                    print(f"⚠️  WARNING: Unexpected status {resp.status_code}")
                    print(f"Response: {resp.text[:300]}")
            except Exception as e:
                print(f"❌ FAIL: Exception: {e}")
                return False
        else:
            print(f"   No non-draft claims found (cannot exercise status endpoint fully)")
            print(f"   This is NOT a failure - just noting that the endpoint cannot be fully tested")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    print("\n✅ ALL CLAIM STATUS TESTS PASSED")
    return True

def test_era_webhook(cookies):
    """Test ERA 835 WEBHOOK endpoints"""
    print("\n" + "="*80)
    print("TEST 3: ERA 835 WEBHOOK")
    print("="*80)
    
    # TEST 3.1: GET /api/stedi/webhook -> 200 {ok:true}
    print("\n--- TEST 3.1: GET /api/stedi/webhook -> 200 {ok:true} ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/stedi/webhook")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: GET webhook failed with {resp.status_code}")
            return False
        
        data = resp.json()
        if not data.get("ok"):
            print(f"❌ FAIL: Response missing ok:true: {json.dumps(data, indent=2)}")
            return False
        
        print(f"✅ PASS: Returns 200 with ok:true")
        print(f"   Service: {data.get('service')}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # TEST 3.2: POST /api/stedi/webhook with NO x-stedi-webhook-secret header -> 401
    print("\n--- TEST 3.2: POST /api/stedi/webhook with NO x-stedi-webhook-secret header -> 401 ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/stedi/webhook",
            json={"transactionId": "t1"}
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 401:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        if data.get("error") != "unauthorized":
            print(f"⚠️  WARNING: Expected error:'unauthorized', got: {data.get('error')}")
        
        print(f"✅ PASS: Returns 401 unauthorized without secret header")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # TEST 3.3: POST /api/stedi/webhook with wrong x-stedi-webhook-secret -> 401
    print("\n--- TEST 3.3: POST /api/stedi/webhook with wrong x-stedi-webhook-secret -> 401 ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/stedi/webhook",
            json={"transactionId": "t1"},
            headers={"x-stedi-webhook-secret": "wrong-value"}
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 401:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        if data.get("error") != "unauthorized":
            print(f"⚠️  WARNING: Expected error:'unauthorized', got: {data.get('error')}")
        
        print(f"✅ PASS: Returns 401 unauthorized with wrong secret")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # TEST 3.4: Polling fallback: POST /api/stedi/remittances
    print("\n--- TEST 3.4: Polling fallback: POST /api/stedi/remittances (CRITICAL: never 500) ---")
    try:
        resp = requests.post(f"{BASE_URL}/api/stedi/remittances", json={}, cookies=cookies)
        print(f"Status: {resp.status_code}")
        
        # CRITICAL: MUST NOT be 500
        if resp.status_code == 500:
            print(f"❌ FAIL: Returned 500 (should be 200 or 400)")
            print(f"Response: {resp.text[:500]}")
            return False
        
        if resp.status_code == 400:
            # 400 is acceptable if Stedi is not configured
            data = resp.json()
            if "not configured" in data.get("error", "").lower():
                print(f"✅ PASS: Returns 400 'Stedi is not configured.' (acceptable)")
                print(f"   Error: {data.get('error')}")
            else:
                print(f"⚠️  WARNING: Returns 400 but not 'not configured': {data.get('error')}")
        elif resp.status_code == 200:
            data = resp.json()
            # Either {ok:true, scanned, processed} OR {error:"..."}
            if data.get("error"):
                print(f"✅ PASS: Returns 200 with error (graceful handling)")
                print(f"   Error: {data.get('error')[:200]}")
            elif data.get("ok"):
                print(f"✅ PASS: Returns 200 with ok:true (success)")
                print(f"   Scanned: {data.get('scanned')}")
                print(f"   Processed: {data.get('processed')}")
            else:
                print(f"⚠️  WARNING: Returns 200 but unexpected structure: {json.dumps(data, indent=2)[:300]}")
        else:
            print(f"⚠️  WARNING: Unexpected status {resp.status_code}")
            print(f"Response: {resp.text[:300]}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    # TEST 3.5: GET /api/stedi/remittances -> 200 {remittances:[]}
    print("\n--- TEST 3.5: GET /api/stedi/remittances -> 200 {remittances:[]} ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/stedi/remittances", cookies=cookies)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAIL: GET remittances failed with {resp.status_code}")
            return False
        
        data = resp.json()
        remittances = data.get("remittances", [])
        print(f"✅ PASS: Returns 200 with {len(remittances)} remittances")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
        return False
    
    print("\n✅ ALL ERA WEBHOOK TESTS PASSED")
    return True

def main():
    print("="*80)
    print("STEDI RCM EXPANSION - BACKEND TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Login: {LOGIN_EMAIL}")
    
    # Login
    cookies = login()
    
    # Run all tests
    results = []
    
    try:
        results.append(("Prior Auth (278 tracker)", test_prior_auth(cookies)))
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR in Prior Auth tests: {e}")
        results.append(("Prior Auth (278 tracker)", False))
    
    try:
        results.append(("Claim Status (276/277)", test_claim_status(cookies)))
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR in Claim Status tests: {e}")
        results.append(("Claim Status (276/277)", False))
    
    try:
        results.append(("ERA 835 Webhook", test_era_webhook(cookies)))
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR in ERA Webhook tests: {e}")
        results.append(("ERA 835 Webhook", False))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(result[1] for result in results)
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
