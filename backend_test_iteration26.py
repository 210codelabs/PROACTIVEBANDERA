#!/usr/bin/env python3
"""
Backend test for Iteration 26: Superbill PDF + Denials (claim update) + Payment Posting (patient ledger)
Tests:
1. Patient search
2. Claim creation with payment posting to ledger
3. Patient ledger verification
4. Superbill PDF generation (auth, content-type, PDF format)
5. Claim update (denials workflow - payerId and serviceLines)
6. Auth gating on ledger and claim endpoints
"""

import requests
import json
import sys

# Base URL - using HTTPS because session cookie is secure
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_iteration26():
    print("=" * 80)
    print("ITERATION 26 BACKEND TEST: Superbill PDF + Denials + Payment Posting")
    print("=" * 80)
    
    session = requests.Session()
    
    # ========================================================================
    # STEP 0: Staff Login
    # ========================================================================
    print("\n[STEP 0] Staff Login")
    try:
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "andy.manzano@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        print(f"  Status: {login_resp.status_code}")
        if login_resp.status_code == 200:
            print("  ✅ Staff login successful")
            cookies = session.cookies.get_dict()
            if 'proactive_session' in cookies:
                print(f"  ✅ Session cookie 'proactive_session' set")
            else:
                print(f"  ⚠️  Session cookie not found in response. Available cookies: {list(cookies.keys())}")
        else:
            print(f"  ❌ Staff login failed: {login_resp.text}")
            return False
    except Exception as e:
        print(f"  ❌ Staff login exception: {e}")
        return False
    
    # ========================================================================
    # STEP 1: GET /api/patients/search?q=Adams -> pick patient id PID
    # ========================================================================
    print("\n[STEP 1] Patient Search: GET /api/patients/search?q=Adams")
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
        patient_name = f"{patient.get('lastName', '')}, {patient.get('firstName', '')}"
        
        print(f"  ✅ Found patient: {patient_name} (ID: {PID})")
        
    except Exception as e:
        print(f"  ❌ Patient search exception: {e}")
        return False
    
    # ========================================================================
    # STEP 2: POST /api/stedi/claims - Create claim with payment posting
    # ========================================================================
    print("\n[STEP 2] Claim Creation: POST /api/stedi/claims")
    claim_payload = {
        "patientId": PID,
        "patientName": "Adams, Eleanor",
        "payerId": "87726",
        "serviceLines": [
            {
                "procedureCode": "99214",
                "chargeCents": 21000,
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
        claim_resp = session.post(
            f"{BASE_URL}/api/stedi/claims",
            json=claim_payload,
            timeout=10
        )
        print(f"  Status: {claim_resp.status_code}")
        
        if claim_resp.status_code != 200:
            print(f"  ❌ Expected 200, got {claim_resp.status_code}: {claim_resp.text}")
            return False
        
        claim_data = claim_resp.json()
        
        if not claim_data.get('ok'):
            print(f"  ❌ Response missing 'ok' field: {claim_data}")
            return False
        
        claim = claim_data.get('claim')
        if not claim:
            print(f"  ❌ Response missing 'claim' field: {claim_data}")
            return False
        
        CID = claim.get('id')
        total_charge = claim.get('totalChargeCents')
        pcn = claim.get('patientControlNumber')
        
        print(f"  ✅ Claim created: ID={CID}, PCN={pcn}")
        print(f"  ✅ totalChargeCents: {total_charge}")
        
        if total_charge != 21000:
            print(f"  ❌ Expected totalChargeCents=21000, got {total_charge}")
            return False
        
        print(f"  ✅ totalChargeCents == 21000 (correct)")
        
    except Exception as e:
        print(f"  ❌ Claim creation exception: {e}")
        return False
    
    # ========================================================================
    # STEP 3: GET /api/patients/PID/ledger - Verify charge posted
    # ========================================================================
    print("\n[STEP 3] Patient Ledger: GET /api/patients/{PID}/ledger")
    try:
        ledger_resp = session.get(f"{BASE_URL}/api/patients/{PID}/ledger", timeout=10)
        print(f"  Status: {ledger_resp.status_code}")
        
        if ledger_resp.status_code != 200:
            print(f"  ❌ Expected 200, got {ledger_resp.status_code}: {ledger_resp.text}")
            return False
        
        ledger_data = ledger_resp.json()
        entries = ledger_data.get('entries', [])
        totals = ledger_data.get('totals', {})
        
        print(f"  ✅ Ledger retrieved: {len(entries)} entries")
        print(f"  Totals: charges={totals.get('charges')}, payments={totals.get('payments')}, adjustments={totals.get('adjustments')}, balanceCents={totals.get('balanceCents')}")
        
        # Find the charge entry for this claim
        charge_entry = None
        for entry in entries:
            if entry.get('type') == 'charge' and entry.get('claimId') == CID:
                charge_entry = entry
                break
        
        if not charge_entry:
            print(f"  ❌ No 'charge' entry found for claim {CID}")
            print(f"  Available entries: {json.dumps(entries, indent=2)}")
            return False
        
        charge_amount = charge_entry.get('amountCents')
        print(f"  ✅ Found charge entry: amountCents={charge_amount}, description='{charge_entry.get('description')}'")
        
        if charge_amount != 21000:
            print(f"  ❌ Expected charge amountCents=21000, got {charge_amount}")
            return False
        
        print(f"  ✅ Charge entry amountCents == 21000 (correct)")
        
        # Verify totals
        if totals.get('charges', 0) < 21000:
            print(f"  ❌ Expected totals.charges >= 21000, got {totals.get('charges')}")
            return False
        
        print(f"  ✅ totals.charges >= 21000 (correct)")
        
        if totals.get('balanceCents', 0) < 21000:
            print(f"  ❌ Expected totals.balanceCents >= 21000, got {totals.get('balanceCents')}")
            return False
        
        print(f"  ✅ totals.balanceCents >= 21000 (correct)")
        
    except Exception as e:
        print(f"  ❌ Ledger retrieval exception: {e}")
        return False
    
    # ========================================================================
    # STEP 4: GET /api/stedi/claims/CID/superbill - Superbill PDF
    # ========================================================================
    print("\n[STEP 4] Superbill PDF: GET /api/stedi/claims/{CID}/superbill")
    
    # 4a. With auth - should return 200 with PDF
    print("  [4a] With auth cookie")
    try:
        superbill_resp = session.get(f"{BASE_URL}/api/stedi/claims/{CID}/superbill", timeout=10)
        print(f"    Status: {superbill_resp.status_code}")
        
        if superbill_resp.status_code != 200:
            print(f"    ❌ Expected 200, got {superbill_resp.status_code}: {superbill_resp.text}")
            return False
        
        print(f"    ✅ Status 200 (correct)")
        
        # Check Content-Type
        content_type = superbill_resp.headers.get('Content-Type', '')
        print(f"    Content-Type: {content_type}")
        
        if content_type != 'application/pdf':
            print(f"    ❌ Expected Content-Type 'application/pdf', got '{content_type}'")
            return False
        
        print(f"    ✅ Content-Type == 'application/pdf' (correct)")
        
        # Check PDF magic bytes
        pdf_bytes = superbill_resp.content
        if not pdf_bytes.startswith(b'%PDF'):
            print(f"    ❌ Response body does not start with '%PDF'. First 10 bytes: {pdf_bytes[:10]}")
            return False
        
        print(f"    ✅ Response body starts with '%PDF' (correct)")
        print(f"    PDF size: {len(pdf_bytes)} bytes")
        
    except Exception as e:
        print(f"    ❌ Superbill PDF exception: {e}")
        return False
    
    # 4b. Without auth - should return 401
    print("  [4b] Without auth cookie")
    try:
        no_auth_session = requests.Session()
        superbill_no_auth_resp = no_auth_session.get(f"{BASE_URL}/api/stedi/claims/{CID}/superbill", timeout=10)
        print(f"    Status: {superbill_no_auth_resp.status_code}")
        
        if superbill_no_auth_resp.status_code != 401:
            print(f"    ❌ Expected 401, got {superbill_no_auth_resp.status_code}: {superbill_no_auth_resp.text}")
            return False
        
        print(f"    ✅ Status 401 (correct - unauthorized)")
        
    except Exception as e:
        print(f"    ❌ Superbill no-auth exception: {e}")
        return False
    
    # 4c. Bogus claim ID - should return 404
    print("  [4c] Bogus claim ID")
    try:
        superbill_bogus_resp = session.get(f"{BASE_URL}/api/stedi/claims/nope/superbill", timeout=10)
        print(f"    Status: {superbill_bogus_resp.status_code}")
        
        if superbill_bogus_resp.status_code != 404:
            print(f"    ❌ Expected 404, got {superbill_bogus_resp.status_code}: {superbill_bogus_resp.text}")
            return False
        
        print(f"    ✅ Status 404 (correct - not found)")
        
    except Exception as e:
        print(f"    ❌ Superbill bogus ID exception: {e}")
        return False
    
    # ========================================================================
    # STEP 5: PATCH /api/stedi/claims/CID - Denials / claim update
    # ========================================================================
    print("\n[STEP 5] Claim Update (Denials): PATCH /api/stedi/claims/{CID}")
    
    # 5a. Update payerId
    print("  [5a] Update payerId to '60054'")
    try:
        patch_payer_resp = session.patch(
            f"{BASE_URL}/api/stedi/claims/{CID}",
            json={"payerId": "60054"},
            timeout=10
        )
        print(f"    Status: {patch_payer_resp.status_code}")
        
        if patch_payer_resp.status_code != 200:
            print(f"    ❌ Expected 200, got {patch_payer_resp.status_code}: {patch_payer_resp.text}")
            return False
        
        patch_payer_data = patch_payer_resp.json()
        
        if not patch_payer_data.get('ok'):
            print(f"    ❌ Response missing 'ok' field: {patch_payer_data}")
            return False
        
        updated_claim = patch_payer_data.get('claim')
        if not updated_claim:
            print(f"    ❌ Response missing 'claim' field: {patch_payer_data}")
            return False
        
        updated_payer_id = updated_claim.get('payerId')
        print(f"    ✅ Claim updated: payerId={updated_payer_id}")
        
        if updated_payer_id != '60054':
            print(f"    ❌ Expected payerId='60054', got '{updated_payer_id}'")
            return False
        
        print(f"    ✅ payerId == '60054' (correct)")
        
    except Exception as e:
        print(f"    ❌ PATCH payerId exception: {e}")
        return False
    
    # 5b. Update serviceLines
    print("  [5b] Update serviceLines (99213, 15000 cents, 2 units)")
    try:
        patch_lines_resp = session.patch(
            f"{BASE_URL}/api/stedi/claims/{CID}",
            json={
                "serviceLines": [
                    {
                        "procedureCode": "99213",
                        "chargeCents": 15000,
                        "units": 2
                    }
                ]
            },
            timeout=10
        )
        print(f"    Status: {patch_lines_resp.status_code}")
        
        if patch_lines_resp.status_code != 200:
            print(f"    ❌ Expected 200, got {patch_lines_resp.status_code}: {patch_lines_resp.text}")
            return False
        
        patch_lines_data = patch_lines_resp.json()
        
        if not patch_lines_data.get('ok'):
            print(f"    ❌ Response missing 'ok' field: {patch_lines_data}")
            return False
        
        updated_claim2 = patch_lines_data.get('claim')
        if not updated_claim2:
            print(f"    ❌ Response missing 'claim' field: {patch_lines_data}")
            return False
        
        updated_total = updated_claim2.get('totalChargeCents')
        print(f"    ✅ Claim updated: totalChargeCents={updated_total}")
        
        # Expected: 15000 * 2 = 30000
        if updated_total != 30000:
            print(f"    ❌ Expected totalChargeCents=30000 (15000 * 2), got {updated_total}")
            return False
        
        print(f"    ✅ totalChargeCents == 30000 (correct)")
        
    except Exception as e:
        print(f"    ❌ PATCH serviceLines exception: {e}")
        return False
    
    # ========================================================================
    # STEP 6: Auth gating
    # ========================================================================
    print("\n[STEP 6] Auth Gating")
    
    # 6a. GET ledger without cookie -> 401
    print("  [6a] GET /api/patients/{PID}/ledger without cookie")
    try:
        no_auth_session2 = requests.Session()
        ledger_no_auth_resp = no_auth_session2.get(f"{BASE_URL}/api/patients/{PID}/ledger", timeout=10)
        print(f"    Status: {ledger_no_auth_resp.status_code}")
        
        if ledger_no_auth_resp.status_code != 401:
            print(f"    ❌ Expected 401, got {ledger_no_auth_resp.status_code}: {ledger_no_auth_resp.text}")
            return False
        
        print(f"    ✅ Status 401 (correct - unauthorized)")
        
    except Exception as e:
        print(f"    ❌ Ledger no-auth exception: {e}")
        return False
    
    # 6b. PATCH claim without cookie -> 401
    print("  [6b] PATCH /api/stedi/claims/{CID} without cookie")
    try:
        no_auth_session3 = requests.Session()
        patch_no_auth_resp = no_auth_session3.patch(
            f"{BASE_URL}/api/stedi/claims/{CID}",
            json={"payerId": "12345"},
            timeout=10
        )
        print(f"    Status: {patch_no_auth_resp.status_code}")
        
        if patch_no_auth_resp.status_code != 401:
            print(f"    ❌ Expected 401, got {patch_no_auth_resp.status_code}: {patch_no_auth_resp.text}")
            return False
        
        print(f"    ✅ Status 401 (correct - unauthorized)")
        
    except Exception as e:
        print(f"    ❌ PATCH claim no-auth exception: {e}")
        return False
    
    # ========================================================================
    # ALL TESTS PASSED
    # ========================================================================
    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED - Iteration 26")
    print("=" * 80)
    print("\nSUMMARY:")
    print(f"  • Patient search: Found patient {patient_name} (ID: {PID})")
    print(f"  • Claim creation: Created claim {pcn} (ID: {CID}) with totalChargeCents=21000")
    print(f"  • Payment posting: Charge entry automatically posted to patient ledger")
    print(f"  • Ledger verification: Charge entry exists with amountCents=21000, totals correct")
    print(f"  • Superbill PDF: Returns 200 with Content-Type 'application/pdf', body starts with '%PDF'")
    print(f"  • Superbill auth: Returns 401 without cookie, 404 for bogus ID")
    print(f"  • Claim update: payerId updated to '60054', serviceLines updated with totalChargeCents=30000")
    print(f"  • Auth gating: Ledger and claim PATCH correctly return 401 without auth")
    print()
    
    return True

if __name__ == "__main__":
    try:
        success = test_iteration26()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
