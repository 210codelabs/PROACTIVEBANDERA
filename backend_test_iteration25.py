#!/usr/bin/env python3
"""
Backend test for Iteration 25: Stedi Phase 2/3 + Payer Directory APIs
Tests all endpoints with exact status codes and key JSON fields.
"""
import requests
import json

# NOTE: Using HTTPS URL because session cookie has secure:true flag
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_iteration_25():
    print("=" * 80)
    print("ITERATION 25: Stedi Phase 2/3 + Payer Directory APIs Backend Test")
    print("=" * 80)
    
    # ========================================================================
    # TEST 1: AUTH - All endpoints without cookie should return 401
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST 1: AUTH - Endpoints without cookie should return 401")
    print("=" * 80)
    
    endpoints_to_test = [
        ("GET", f"{BASE_URL}/api/stedi/payers"),
        ("POST", f"{BASE_URL}/api/stedi/payers"),
        ("GET", f"{BASE_URL}/api/stedi/fee-schedule"),
        ("GET", f"{BASE_URL}/api/stedi/claims"),
        ("GET", f"{BASE_URL}/api/stedi/enrollments"),
        ("GET", f"{BASE_URL}/api/stedi/remittances"),
    ]
    
    for method, url in endpoints_to_test:
        try:
            if method == "GET":
                r = requests.get(url, timeout=10)
            else:
                r = requests.post(url, json={}, timeout=10)
            
            if r.status_code == 401:
                print(f"✅ {method} {url.split('/api')[1]} -> 401 (Unauthorized)")
            else:
                print(f"❌ {method} {url.split('/api')[1]} -> {r.status_code} (expected 401)")
                print(f"   Response: {r.text[:200]}")
        except Exception as e:
            print(f"❌ {method} {url.split('/api')[1]} -> ERROR: {e}")
    
    # ========================================================================
    # STAFF LOGIN
    # ========================================================================
    print("\n" + "=" * 80)
    print("STAFF LOGIN")
    print("=" * 80)
    
    login_url = f"{BASE_URL}/api/auth/login"
    login_data = {
        "email": "andy.manzano@proactiveclinic.com",
        "password": "apex123"
    }
    
    try:
        r = requests.post(login_url, json=login_data, timeout=10)
        if r.status_code == 200:
            cookies = r.cookies
            print(f"✅ Staff login successful (200)")
            print(f"   Cookie: {cookies.get('proactive_session', 'NOT SET')[:50]}...")
        else:
            print(f"❌ Staff login failed: {r.status_code}")
            print(f"   Response: {r.text[:200]}")
            return
    except Exception as e:
        print(f"❌ Staff login ERROR: {e}")
        return
    
    # ========================================================================
    # TEST 2: PAYERS - POST, GET, DELETE
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST 2: PAYERS - POST, GET, DELETE")
    print("=" * 80)
    
    # POST create payer
    payer_url = f"{BASE_URL}/api/stedi/payers"
    payer_data = {
        "name": "Aetna Test",
        "stediId": "60054",
        "supportsClaims": True
    }
    
    try:
        r = requests.post(payer_url, json=payer_data, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("ok") and "payer" in data and "id" in data["payer"]:
                payer_id = data["payer"]["id"]
                print(f"✅ POST /api/stedi/payers -> 200 {{ok:true, payer:{{id:'{payer_id}'}}}}")
                print(f"   Payer name: {data['payer'].get('name')}")
                print(f"   Payer stediId: {data['payer'].get('stediId')}")
            else:
                print(f"❌ POST /api/stedi/payers -> 200 but missing ok/payer/id")
                print(f"   Response: {json.dumps(data, indent=2)[:300]}")
                return
        else:
            print(f"❌ POST /api/stedi/payers -> {r.status_code} (expected 200)")
            print(f"   Response: {r.text[:200]}")
            return
    except Exception as e:
        print(f"❌ POST /api/stedi/payers ERROR: {e}")
        return
    
    # GET payers list
    try:
        r = requests.get(payer_url, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if "payers" in data:
                payers = data["payers"]
                aetna_found = any(p.get("name") == "Aetna Test" for p in payers)
                if aetna_found:
                    print(f"✅ GET /api/stedi/payers -> 200 {{payers:[...]}} contains 'Aetna Test'")
                else:
                    print(f"❌ GET /api/stedi/payers -> 200 but 'Aetna Test' not found")
                    print(f"   Payers: {[p.get('name') for p in payers[:5]]}")
            else:
                print(f"❌ GET /api/stedi/payers -> 200 but missing 'payers' key")
                print(f"   Response: {json.dumps(data, indent=2)[:300]}")
        else:
            print(f"❌ GET /api/stedi/payers -> {r.status_code} (expected 200)")
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ GET /api/stedi/payers ERROR: {e}")
    
    # DELETE payer
    delete_url = f"{BASE_URL}/api/stedi/payers?id={payer_id}"
    try:
        r = requests.delete(delete_url, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("ok"):
                print(f"✅ DELETE /api/stedi/payers?id={payer_id} -> 200 {{ok:true}}")
            else:
                print(f"❌ DELETE /api/stedi/payers -> 200 but ok not true")
                print(f"   Response: {json.dumps(data, indent=2)}")
        else:
            print(f"❌ DELETE /api/stedi/payers -> {r.status_code} (expected 200)")
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ DELETE /api/stedi/payers ERROR: {e}")
    
    # Verify deletion
    try:
        r = requests.get(payer_url, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            payers = data.get("payers", [])
            aetna_found = any(p.get("name") == "Aetna Test" for p in payers)
            if not aetna_found:
                print(f"✅ GET /api/stedi/payers confirms 'Aetna Test' removed")
            else:
                print(f"❌ GET /api/stedi/payers still shows 'Aetna Test' after deletion")
    except Exception as e:
        print(f"❌ Verify deletion ERROR: {e}")
    
    # ========================================================================
    # TEST 3: FEE SCHEDULE - POST, GET, UPDATE (upsert-by-code), DELETE
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST 3: FEE SCHEDULE - POST, GET, UPDATE (upsert-by-code), DELETE")
    print("=" * 80)
    
    fee_url = f"{BASE_URL}/api/stedi/fee-schedule"
    
    # POST create fee schedule item
    fee_data = {
        "code": "99213",
        "description": "Office visit",
        "feeDollars": 150
    }
    
    try:
        r = requests.post(fee_url, json=fee_data, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("ok") and "item" in data:
                item = data["item"]
                fee_id = item.get("id")
                fee_cents = item.get("feeCents")
                if fee_cents == 15000:
                    print(f"✅ POST /api/stedi/fee-schedule -> 200 {{ok:true, item}} with item.feeCents == 15000")
                    print(f"   Item id: {fee_id}")
                    print(f"   Item code: {item.get('code')}")
                    print(f"   Item description: {item.get('description')}")
                else:
                    print(f"❌ POST /api/stedi/fee-schedule -> 200 but feeCents is {fee_cents} (expected 15000)")
                    print(f"   Response: {json.dumps(data, indent=2)[:300]}")
            else:
                print(f"❌ POST /api/stedi/fee-schedule -> 200 but missing ok/item")
                print(f"   Response: {json.dumps(data, indent=2)[:300]}")
                return
        else:
            print(f"❌ POST /api/stedi/fee-schedule -> {r.status_code} (expected 200)")
            print(f"   Response: {r.text[:200]}")
            return
    except Exception as e:
        print(f"❌ POST /api/stedi/fee-schedule ERROR: {e}")
        return
    
    # GET fee schedule
    try:
        r = requests.get(fee_url, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if "items" in data:
                items = data["items"]
                code_99213 = [i for i in items if i.get("code") == "99213"]
                if code_99213:
                    print(f"✅ GET /api/stedi/fee-schedule -> 200 {{items:[...]}} contains 99213")
                    print(f"   99213 count: {len(code_99213)} (should be 1)")
                else:
                    print(f"❌ GET /api/stedi/fee-schedule -> 200 but 99213 not found")
            else:
                print(f"❌ GET /api/stedi/fee-schedule -> 200 but missing 'items' key")
                print(f"   Response: {json.dumps(data, indent=2)[:300]}")
        else:
            print(f"❌ GET /api/stedi/fee-schedule -> {r.status_code} (expected 200)")
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ GET /api/stedi/fee-schedule ERROR: {e}")
    
    # POST again with same code (should UPDATE, not duplicate)
    fee_data_update = {
        "code": "99213",
        "description": "Office visit est",
        "feeDollars": 175
    }
    
    try:
        r = requests.post(fee_url, json=fee_data_update, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("ok") and "item" in data:
                item = data["item"]
                fee_cents = item.get("feeCents")
                if fee_cents == 17500:
                    print(f"✅ POST /api/stedi/fee-schedule (update) -> 200 with item.feeCents == 17500")
                    print(f"   Item description updated to: {item.get('description')}")
                else:
                    print(f"❌ POST /api/stedi/fee-schedule (update) -> 200 but feeCents is {fee_cents} (expected 17500)")
            else:
                print(f"❌ POST /api/stedi/fee-schedule (update) -> 200 but missing ok/item")
        else:
            print(f"❌ POST /api/stedi/fee-schedule (update) -> {r.status_code} (expected 200)")
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ POST /api/stedi/fee-schedule (update) ERROR: {e}")
    
    # GET again to verify UPDATE (not duplicate)
    try:
        r = requests.get(fee_url, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            items = data.get("items", [])
            code_99213 = [i for i in items if i.get("code") == "99213"]
            if len(code_99213) == 1:
                item = code_99213[0]
                if item.get("feeCents") == 17500:
                    print(f"✅ GET /api/stedi/fee-schedule confirms ONLY ONE 99213 item with feeCents 17500 (UPDATE worked, no duplicate)")
                else:
                    print(f"❌ GET /api/stedi/fee-schedule shows 99213 but feeCents is {item.get('feeCents')} (expected 17500)")
            elif len(code_99213) > 1:
                print(f"❌ GET /api/stedi/fee-schedule shows {len(code_99213)} items with code 99213 (DUPLICATE created, should be 1)")
                print(f"   Items: {json.dumps(code_99213, indent=2)[:500]}")
            else:
                print(f"❌ GET /api/stedi/fee-schedule shows no 99213 items")
        else:
            print(f"❌ GET /api/stedi/fee-schedule -> {r.status_code} (expected 200)")
    except Exception as e:
        print(f"❌ GET /api/stedi/fee-schedule (verify update) ERROR: {e}")
    
    # DELETE fee schedule item
    delete_fee_url = f"{BASE_URL}/api/stedi/fee-schedule?id={fee_id}"
    try:
        r = requests.delete(delete_fee_url, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("ok"):
                print(f"✅ DELETE /api/stedi/fee-schedule?id={fee_id} -> 200 {{ok:true}}")
            else:
                print(f"❌ DELETE /api/stedi/fee-schedule -> 200 but ok not true")
        else:
            print(f"❌ DELETE /api/stedi/fee-schedule -> {r.status_code} (expected 200)")
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ DELETE /api/stedi/fee-schedule ERROR: {e}")
    
    # ========================================================================
    # TEST 4: CLAIMS - Create manual claim
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST 4: CLAIMS - Create manual claim")
    print("=" * 80)
    
    claims_url = f"{BASE_URL}/api/stedi/claims"
    claim_data = {
        "patientName": "User, Test",
        "payerId": "87726",
        "serviceLines": [
            {
                "procedureCode": "99213",
                "chargeCents": 15000,
                "units": 1
            }
        ],
        "diagnoses": [
            {
                "code": "I10"
            }
        ]
    }
    
    try:
        r = requests.post(claims_url, json=claim_data, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("ok") and "claim" in data:
                claim = data["claim"]
                claim_id = claim.get("id")
                status = claim.get("status")
                total_charge = claim.get("totalChargeCents")
                pcn = claim.get("patientControlNumber")
                
                checks = []
                checks.append(("status == 'draft'", status == "draft"))
                checks.append(("totalChargeCents == 15000", total_charge == 15000))
                checks.append(("patientControlNumber starts with 'CLM-'", pcn and pcn.startswith("CLM-")))
                
                all_pass = all(c[1] for c in checks)
                if all_pass:
                    print(f"✅ POST /api/stedi/claims -> 200 {{ok:true, claim}}")
                    print(f"   Claim id: {claim_id}")
                    print(f"   Claim status: {status} ✅")
                    print(f"   Claim totalChargeCents: {total_charge} ✅")
                    print(f"   Claim patientControlNumber: {pcn} ✅")
                else:
                    print(f"❌ POST /api/stedi/claims -> 200 but some checks failed:")
                    for check_name, check_result in checks:
                        status_icon = "✅" if check_result else "❌"
                        print(f"   {status_icon} {check_name}")
                    print(f"   Response: {json.dumps(claim, indent=2)[:500]}")
            else:
                print(f"❌ POST /api/stedi/claims -> 200 but missing ok/claim")
                print(f"   Response: {json.dumps(data, indent=2)[:300]}")
                return
        else:
            print(f"❌ POST /api/stedi/claims -> {r.status_code} (expected 200)")
            print(f"   Response: {r.text[:200]}")
            return
    except Exception as e:
        print(f"❌ POST /api/stedi/claims ERROR: {e}")
        return
    
    # GET claims list
    try:
        r = requests.get(claims_url, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if "claims" in data:
                claims = data["claims"]
                claim_found = any(c.get("id") == claim_id for c in claims)
                if claim_found:
                    print(f"✅ GET /api/stedi/claims -> 200 {{claims:[...]}} contains the created claim")
                else:
                    print(f"❌ GET /api/stedi/claims -> 200 but created claim not found")
            else:
                print(f"❌ GET /api/stedi/claims -> 200 but missing 'claims' key")
        else:
            print(f"❌ GET /api/stedi/claims -> {r.status_code} (expected 200)")
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ GET /api/stedi/claims ERROR: {e}")
    
    # ========================================================================
    # TEST 5: CLAIMS submit (Stedi disabled - expect 400)
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST 5: CLAIMS submit (Stedi disabled - expect 400)")
    print("=" * 80)
    
    submit_url = f"{BASE_URL}/api/stedi/claims/{claim_id}/submit"
    try:
        r = requests.post(submit_url, json={}, cookies=cookies, timeout=10)
        if r.status_code == 400:
            data = r.json()
            error = data.get("error", "")
            if "not configured" in error.lower():
                print(f"✅ POST /api/stedi/claims/{claim_id}/submit -> 400 with error containing 'not configured'")
                print(f"   Error: {error}")
            else:
                print(f"❌ POST /api/stedi/claims/{claim_id}/submit -> 400 but error doesn't contain 'not configured'")
                print(f"   Error: {error}")
        else:
            print(f"❌ POST /api/stedi/claims/{claim_id}/submit -> {r.status_code} (expected 400)")
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ POST /api/stedi/claims/{claim_id}/submit ERROR: {e}")
    
    # ========================================================================
    # TEST 6: CLAIMS status (Stedi disabled - expect 400)
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST 6: CLAIMS status (Stedi disabled - expect 400)")
    print("=" * 80)
    
    status_url = f"{BASE_URL}/api/stedi/claims/{claim_id}/status"
    try:
        r = requests.get(status_url, cookies=cookies, timeout=10)
        if r.status_code == 400:
            data = r.json()
            error = data.get("error", "")
            if "not configured" in error.lower():
                print(f"✅ GET /api/stedi/claims/{claim_id}/status -> 400 with error containing 'not configured'")
                print(f"   Error: {error}")
            else:
                print(f"❌ GET /api/stedi/claims/{claim_id}/status -> 400 but error doesn't contain 'not configured'")
                print(f"   Error: {error}")
        else:
            print(f"❌ GET /api/stedi/claims/{claim_id}/status -> {r.status_code} (expected 400)")
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ GET /api/stedi/claims/{claim_id}/status ERROR: {e}")
    
    # ========================================================================
    # TEST 7: ENROLLMENTS - GET (should work), POST (expect 400)
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST 7: ENROLLMENTS - GET (should work), POST (expect 400)")
    print("=" * 80)
    
    enrollments_url = f"{BASE_URL}/api/stedi/enrollments"
    
    # GET enrollments
    try:
        r = requests.get(enrollments_url, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if "enrollments" in data:
                enrollments = data["enrollments"]
                print(f"✅ GET /api/stedi/enrollments -> 200 {{enrollments:[...]}} (array with {len(enrollments)} items)")
            else:
                print(f"❌ GET /api/stedi/enrollments -> 200 but missing 'enrollments' key")
                print(f"   Response: {json.dumps(data, indent=2)[:300]}")
        else:
            print(f"❌ GET /api/stedi/enrollments -> {r.status_code} (expected 200)")
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ GET /api/stedi/enrollments ERROR: {e}")
    
    # POST enrollment (Stedi disabled - expect 400)
    enrollment_data = {
        "payerIdOrAlias": "87726",
        "transactions": {
            "claims": True
        }
    }
    
    try:
        r = requests.post(enrollments_url, json=enrollment_data, cookies=cookies, timeout=10)
        if r.status_code == 400:
            data = r.json()
            error = data.get("error", "")
            if "not configured" in error.lower():
                print(f"✅ POST /api/stedi/enrollments -> 400 with error containing 'not configured'")
                print(f"   Error: {error}")
            else:
                print(f"❌ POST /api/stedi/enrollments -> 400 but error doesn't contain 'not configured'")
                print(f"   Error: {error}")
        else:
            print(f"❌ POST /api/stedi/enrollments -> {r.status_code} (expected 400)")
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ POST /api/stedi/enrollments ERROR: {e}")
    
    # ========================================================================
    # TEST 8: REMITTANCES - GET (should work), POST (expect 400)
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST 8: REMITTANCES - GET (should work), POST (expect 400)")
    print("=" * 80)
    
    remittances_url = f"{BASE_URL}/api/stedi/remittances"
    
    # GET remittances
    try:
        r = requests.get(remittances_url, cookies=cookies, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if "remittances" in data:
                remittances = data["remittances"]
                print(f"✅ GET /api/stedi/remittances -> 200 {{remittances:[...]}} (array with {len(remittances)} items)")
            else:
                print(f"❌ GET /api/stedi/remittances -> 200 but missing 'remittances' key")
                print(f"   Response: {json.dumps(data, indent=2)[:300]}")
        else:
            print(f"❌ GET /api/stedi/remittances -> {r.status_code} (expected 200)")
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ GET /api/stedi/remittances ERROR: {e}")
    
    # POST remittances (Stedi disabled - expect 400)
    try:
        r = requests.post(remittances_url, json={}, cookies=cookies, timeout=10)
        if r.status_code == 400:
            data = r.json()
            error = data.get("error", "")
            if "not configured" in error.lower():
                print(f"✅ POST /api/stedi/remittances -> 400 with error containing 'not configured'")
                print(f"   Error: {error}")
            else:
                print(f"❌ POST /api/stedi/remittances -> 400 but error doesn't contain 'not configured'")
                print(f"   Error: {error}")
        else:
            print(f"❌ POST /api/stedi/remittances -> {r.status_code} (expected 400)")
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ POST /api/stedi/remittances ERROR: {e}")
    
    print("\n" + "=" * 80)
    print("ITERATION 25 BACKEND TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    test_iteration_25()
