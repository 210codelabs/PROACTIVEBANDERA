#!/usr/bin/env python3
"""
Backend test for Iteration 27: Patient Copay/payment + Adjustments/Write-offs + Statement PDF
Tests POST/DELETE /api/patients/[id]/ledger and GET /api/patients/[id]/statement
"""
import requests
import json

# Use HTTPS URL because session cookie has secure:true flag
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_ledger_and_statement():
    print("=" * 80)
    print("ITERATION 27: Patient Copay + Adjustments + Statement PDF Backend Test")
    print("=" * 80)
    
    session = requests.Session()
    
    # ========== STEP 0: Staff Login ==========
    print("\n[STEP 0] Staff login...")
    try:
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "andy.manzano@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        print(f"  Status: {login_resp.status_code}")
        if login_resp.status_code == 200:
            print(f"  ✅ Staff login successful")
            print(f"  Cookies: {list(session.cookies.keys())}")
        else:
            print(f"  ❌ Staff login failed: {login_resp.text}")
            return
    except Exception as e:
        print(f"  ❌ Staff login error: {e}")
        return
    
    # ========== STEP 1: Search for Adams patient ==========
    print("\n[STEP 1] GET /api/patients/search?q=Adams")
    try:
        search_resp = session.get(f"{BASE_URL}/api/patients/search?q=Adams", timeout=10)
        print(f"  Status: {search_resp.status_code}")
        if search_resp.status_code == 200:
            data = search_resp.json()
            if data.get("results") and len(data["results"]) > 0:
                patient = data["results"][0]
                patient_id = patient["id"]
                print(f"  ✅ Found patient: {patient.get('firstName')} {patient.get('lastName')} (MRN: {patient.get('mrn')}, ID: {patient_id})")
            else:
                print(f"  ❌ No patients found with query 'Adams'")
                return
        else:
            print(f"  ❌ Search failed: {search_resp.text}")
            return
    except Exception as e:
        print(f"  ❌ Search error: {e}")
        return
    
    # ========== STEP 2: Get initial ledger balance ==========
    print(f"\n[STEP 2] GET /api/patients/{patient_id}/ledger (initial balance)")
    try:
        ledger_resp = session.get(f"{BASE_URL}/api/patients/{patient_id}/ledger", timeout=10)
        print(f"  Status: {ledger_resp.status_code}")
        if ledger_resp.status_code == 200:
            ledger_data = ledger_resp.json()
            initial_balance = ledger_data["totals"]["balanceCents"]
            initial_payments = ledger_data["totals"]["payments"]
            initial_adjustments = ledger_data["totals"]["adjustments"]
            print(f"  ✅ Initial balance (B0): {initial_balance} cents")
            print(f"  Initial payments: {initial_payments} cents")
            print(f"  Initial adjustments: {initial_adjustments} cents")
            print(f"  Initial charges: {ledger_data['totals']['charges']} cents")
        else:
            print(f"  ❌ Get ledger failed: {ledger_resp.text}")
            return
    except Exception as e:
        print(f"  ❌ Get ledger error: {e}")
        return
    
    # ========== STEP 3: Create copay/payment $25 ==========
    print(f"\n[STEP 3] POST /api/patients/{patient_id}/ledger (copay/payment $25)")
    try:
        payment_resp = session.post(
            f"{BASE_URL}/api/patients/{patient_id}/ledger",
            json={"type": "payment", "amountDollars": 25, "method": "card", "description": "Copay"},
            timeout=10
        )
        print(f"  Status: {payment_resp.status_code}")
        if payment_resp.status_code == 200:
            payment_data = payment_resp.json()
            if payment_data.get("ok") and payment_data.get("entry"):
                entry = payment_data["entry"]
                payment_entry_id = entry["id"]
                print(f"  ✅ Payment created successfully")
                print(f"  Entry ID: {payment_entry_id}")
                print(f"  Entry type: {entry['type']}")
                print(f"  Entry amountCents: {entry['amountCents']}")
                if entry["type"] == "payment":
                    print(f"  ✅ Entry type is 'payment' (correct)")
                else:
                    print(f"  ❌ Entry type is '{entry['type']}' (expected 'payment')")
                if entry["amountCents"] == 2500:
                    print(f"  ✅ Entry amountCents is 2500 (correct)")
                else:
                    print(f"  ❌ Entry amountCents is {entry['amountCents']} (expected 2500)")
            else:
                print(f"  ❌ Payment response missing ok/entry: {payment_data}")
        else:
            print(f"  ❌ Payment creation failed: {payment_resp.text}")
            return
    except Exception as e:
        print(f"  ❌ Payment creation error: {e}")
        return
    
    # ========== STEP 4: Create adjustment/write-off $10 ==========
    print(f"\n[STEP 4] POST /api/patients/{patient_id}/ledger (adjustment/write-off $10)")
    try:
        adjustment_resp = session.post(
            f"{BASE_URL}/api/patients/{patient_id}/ledger",
            json={"type": "adjustment", "amountDollars": 10, "description": "Write-off"},
            timeout=10
        )
        print(f"  Status: {adjustment_resp.status_code}")
        if adjustment_resp.status_code == 200:
            adjustment_data = adjustment_resp.json()
            if adjustment_data.get("ok") and adjustment_data.get("entry"):
                entry = adjustment_data["entry"]
                adjustment_entry_id = entry["id"]
                print(f"  ✅ Adjustment created successfully")
                print(f"  Entry ID: {adjustment_entry_id}")
                print(f"  Entry type: {entry['type']}")
                print(f"  Entry amountCents: {entry['amountCents']}")
                if entry["type"] == "adjustment":
                    print(f"  ✅ Entry type is 'adjustment' (correct)")
                else:
                    print(f"  ❌ Entry type is '{entry['type']}' (expected 'adjustment')")
                if entry["amountCents"] == 1000:
                    print(f"  ✅ Entry amountCents is 1000 (correct)")
                else:
                    print(f"  ❌ Entry amountCents is {entry['amountCents']} (expected 1000)")
            else:
                print(f"  ❌ Adjustment response missing ok/entry: {adjustment_data}")
        else:
            print(f"  ❌ Adjustment creation failed: {adjustment_resp.text}")
            return
    except Exception as e:
        print(f"  ❌ Adjustment creation error: {e}")
        return
    
    # ========== STEP 5: Verify balance math ==========
    print(f"\n[STEP 5] GET /api/patients/{patient_id}/ledger (verify balance math)")
    try:
        ledger_resp2 = session.get(f"{BASE_URL}/api/patients/{patient_id}/ledger", timeout=10)
        print(f"  Status: {ledger_resp2.status_code}")
        if ledger_resp2.status_code == 200:
            ledger_data2 = ledger_resp2.json()
            new_balance = ledger_data2["totals"]["balanceCents"]
            new_payments = ledger_data2["totals"]["payments"]
            new_adjustments = ledger_data2["totals"]["adjustments"]
            expected_balance = initial_balance - 2500 - 1000
            print(f"  New balance: {new_balance} cents")
            print(f"  Expected balance (B0 - 2500 - 1000): {expected_balance} cents")
            print(f"  New payments: {new_payments} cents (increased by {new_payments - initial_payments})")
            print(f"  New adjustments: {new_adjustments} cents (increased by {new_adjustments - initial_adjustments})")
            
            if new_balance == expected_balance:
                print(f"  ✅ Balance math correct: {new_balance} == {expected_balance}")
            else:
                print(f"  ❌ Balance math incorrect: {new_balance} != {expected_balance}")
            
            if new_payments >= initial_payments + 2500:
                print(f"  ✅ Payments increased by at least 2500")
            else:
                print(f"  ❌ Payments did not increase by 2500 (increased by {new_payments - initial_payments})")
            
            if new_adjustments >= initial_adjustments + 1000:
                print(f"  ✅ Adjustments increased by at least 1000")
            else:
                print(f"  ❌ Adjustments did not increase by 1000 (increased by {new_adjustments - initial_adjustments})")
        else:
            print(f"  ❌ Get ledger failed: {ledger_resp2.text}")
    except Exception as e:
        print(f"  ❌ Get ledger error: {e}")
    
    # ========== STEP 6: Validation - $0 payment should fail ==========
    print(f"\n[STEP 6] POST /api/patients/{patient_id}/ledger (validation: $0 payment)")
    try:
        validation_resp = session.post(
            f"{BASE_URL}/api/patients/{patient_id}/ledger",
            json={"type": "payment", "amountDollars": 0},
            timeout=10
        )
        print(f"  Status: {validation_resp.status_code}")
        if validation_resp.status_code == 400:
            print(f"  ✅ Validation working: $0 payment correctly rejected with 400")
            print(f"  Error message: {validation_resp.json().get('error', 'N/A')}")
        else:
            print(f"  ❌ Validation failed: Expected 400, got {validation_resp.status_code}")
            print(f"  Response: {validation_resp.text}")
    except Exception as e:
        print(f"  ❌ Validation test error: {e}")
    
    # ========== STEP 7a: Delete manual entry (adjustment) ==========
    print(f"\n[STEP 7a] DELETE /api/patients/{patient_id}/ledger?entryId={adjustment_entry_id} (manual entry)")
    try:
        delete_manual_resp = session.delete(
            f"{BASE_URL}/api/patients/{patient_id}/ledger?entryId={adjustment_entry_id}",
            timeout=10
        )
        print(f"  Status: {delete_manual_resp.status_code}")
        if delete_manual_resp.status_code == 200:
            delete_data = delete_manual_resp.json()
            if delete_data.get("ok"):
                print(f"  ✅ Manual entry deleted successfully")
            else:
                print(f"  ❌ Delete response missing 'ok': {delete_data}")
        else:
            print(f"  ❌ Delete manual entry failed: {delete_manual_resp.text}")
    except Exception as e:
        print(f"  ❌ Delete manual entry error: {e}")
    
    # ========== STEP 7b: Find or create an auto charge entry ==========
    print(f"\n[STEP 7b] Find or create an auto charge entry for delete validation test")
    auto_charge_entry_id = None
    try:
        # Get current ledger to find an auto charge entry
        ledger_resp3 = session.get(f"{BASE_URL}/api/patients/{patient_id}/ledger", timeout=10)
        if ledger_resp3.status_code == 200:
            ledger_data3 = ledger_resp3.json()
            entries = ledger_data3.get("entries", [])
            # Look for an entry with type='charge' and refKey starting with 'charge:'
            for entry in entries:
                if entry.get("type") == "charge" and entry.get("refKey", "").startswith("charge:"):
                    auto_charge_entry_id = entry["id"]
                    print(f"  Found existing auto charge entry: {auto_charge_entry_id}")
                    break
            
            if not auto_charge_entry_id:
                print(f"  No auto charge entry found. Creating one via POST /api/stedi/claims...")
                # Create a claim to generate an auto charge entry
                claim_resp = session.post(
                    f"{BASE_URL}/api/stedi/claims",
                    json={
                        "patientId": patient_id,
                        "patientName": "Adams, Eleanor",
                        "payerId": "87726",
                        "serviceLines": [{"procedureCode": "99213", "chargeCents": 15000, "units": 1}],
                        "diagnoses": [{"code": "I10"}]
                    },
                    timeout=10
                )
                print(f"  Claim creation status: {claim_resp.status_code}")
                if claim_resp.status_code == 200:
                    print(f"  ✅ Claim created successfully")
                    # Re-fetch ledger to get the new auto charge entry
                    ledger_resp4 = session.get(f"{BASE_URL}/api/patients/{patient_id}/ledger", timeout=10)
                    if ledger_resp4.status_code == 200:
                        ledger_data4 = ledger_resp4.json()
                        entries = ledger_data4.get("entries", [])
                        for entry in entries:
                            if entry.get("type") == "charge" and entry.get("refKey", "").startswith("charge:"):
                                auto_charge_entry_id = entry["id"]
                                print(f"  Found new auto charge entry: {auto_charge_entry_id}")
                                break
                else:
                    print(f"  ❌ Claim creation failed: {claim_resp.text}")
        else:
            print(f"  ❌ Get ledger failed: {ledger_resp3.text}")
    except Exception as e:
        print(f"  ❌ Find/create auto charge entry error: {e}")
    
    # ========== STEP 7c: Try to delete auto charge entry (should fail) ==========
    if auto_charge_entry_id:
        print(f"\n[STEP 7c] DELETE /api/patients/{patient_id}/ledger?entryId={auto_charge_entry_id} (auto entry - should fail)")
        try:
            delete_auto_resp = session.delete(
                f"{BASE_URL}/api/patients/{patient_id}/ledger?entryId={auto_charge_entry_id}",
                timeout=10
            )
            print(f"  Status: {delete_auto_resp.status_code}")
            if delete_auto_resp.status_code == 400:
                error_msg = delete_auto_resp.json().get("error", "")
                print(f"  ✅ Auto entry delete correctly rejected with 400")
                print(f"  Error message: {error_msg}")
                if "manual" in error_msg.lower():
                    print(f"  ✅ Error message mentions 'manual entries' (correct)")
                else:
                    print(f"  ⚠️  Error message doesn't mention 'manual entries'")
            else:
                print(f"  ❌ Expected 400, got {delete_auto_resp.status_code}")
                print(f"  Response: {delete_auto_resp.text}")
        except Exception as e:
            print(f"  ❌ Delete auto entry test error: {e}")
    else:
        print(f"\n[STEP 7c] ⚠️  Skipping auto entry delete test (no auto charge entry found)")
    
    # ========== STEP 8a: Statement PDF with auth ==========
    print(f"\n[STEP 8a] GET /api/patients/{patient_id}/statement (with auth)")
    try:
        statement_resp = session.get(f"{BASE_URL}/api/patients/{patient_id}/statement", timeout=10)
        print(f"  Status: {statement_resp.status_code}")
        if statement_resp.status_code == 200:
            content_type = statement_resp.headers.get("Content-Type", "")
            print(f"  Content-Type: {content_type}")
            if content_type == "application/pdf":
                print(f"  ✅ Content-Type is 'application/pdf' (correct)")
            else:
                print(f"  ❌ Content-Type is '{content_type}' (expected 'application/pdf')")
            
            # Check if body starts with '%PDF'
            body = statement_resp.content
            if body[:4] == b'%PDF':
                print(f"  ✅ PDF body starts with '%PDF' (correct)")
                print(f"  PDF size: {len(body)} bytes")
            else:
                print(f"  ❌ PDF body does not start with '%PDF'")
                print(f"  First 20 bytes: {body[:20]}")
        else:
            print(f"  ❌ Statement PDF request failed: {statement_resp.text}")
    except Exception as e:
        print(f"  ❌ Statement PDF request error: {e}")
    
    # ========== STEP 8b: Statement PDF without auth ==========
    print(f"\n[STEP 8b] GET /api/patients/{patient_id}/statement (without auth)")
    try:
        statement_noauth_resp = requests.get(f"{BASE_URL}/api/patients/{patient_id}/statement", timeout=10)
        print(f"  Status: {statement_noauth_resp.status_code}")
        if statement_noauth_resp.status_code == 401:
            print(f"  ✅ Statement PDF correctly blocked with 401 (no auth)")
        else:
            print(f"  ❌ Expected 401, got {statement_noauth_resp.status_code}")
            print(f"  Response: {statement_noauth_resp.text[:200]}")
    except Exception as e:
        print(f"  ❌ Statement PDF no-auth test error: {e}")
    
    # ========== STEP 9: Auth test - POST ledger without cookie ==========
    print(f"\n[STEP 9] POST /api/patients/{patient_id}/ledger (without auth)")
    try:
        ledger_noauth_resp = requests.post(
            f"{BASE_URL}/api/patients/{patient_id}/ledger",
            json={"type": "payment", "amountDollars": 10},
            timeout=10
        )
        print(f"  Status: {ledger_noauth_resp.status_code}")
        if ledger_noauth_resp.status_code == 401:
            print(f"  ✅ POST ledger correctly blocked with 401 (no auth)")
        else:
            print(f"  ❌ Expected 401, got {ledger_noauth_resp.status_code}")
            print(f"  Response: {ledger_noauth_resp.text[:200]}")
    except Exception as e:
        print(f"  ❌ POST ledger no-auth test error: {e}")
    
    print("\n" + "=" * 80)
    print("ITERATION 27 BACKEND TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    test_ledger_and_statement()
