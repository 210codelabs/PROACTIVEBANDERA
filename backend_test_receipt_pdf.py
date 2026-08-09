#!/usr/bin/env python3
"""
Backend test for Payment Receipt PDF (Iteration 28)
Tests GET /api/patients/[id]/receipt endpoint
"""

import requests
import sys

# Use HTTPS URL because session cookie has secure:true flag
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_receipt_pdf():
    """Test payment receipt PDF generation endpoint"""
    print("=" * 80)
    print("BACKEND TEST: Payment Receipt PDF (Iteration 28)")
    print("=" * 80)
    
    # ============================================================================
    # STEP 0: Staff Authentication
    # ============================================================================
    print("\n[STEP 0] Staff Authentication")
    print("-" * 80)
    
    try:
        auth_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "andy.manzano@proactiveclinic.com",
                "password": "apex123"
            },
            timeout=10
        )
        print(f"✓ POST /api/auth/login -> {auth_response.status_code}")
        
        if auth_response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {auth_response.status_code}")
            print(f"  Response: {auth_response.text}")
            return False
        
        # Extract session cookie
        session_cookie = auth_response.cookies.get("proactive_session")
        if not session_cookie:
            print("✗ FAIL: No proactive_session cookie in response")
            return False
        
        print(f"✓ Session cookie obtained: proactive_session={session_cookie[:20]}...")
        cookies = {"proactive_session": session_cookie}
        
    except Exception as e:
        print(f"✗ FAIL: Staff authentication failed: {e}")
        return False
    
    # ============================================================================
    # STEP 1: Search for patient Adams
    # ============================================================================
    print("\n[STEP 1] Search for patient Adams")
    print("-" * 80)
    
    try:
        search_response = requests.get(
            f"{BASE_URL}/api/patients/search",
            params={"q": "Adams"},
            cookies=cookies,
            timeout=10
        )
        print(f"✓ GET /api/patients/search?q=Adams -> {search_response.status_code}")
        
        if search_response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {search_response.status_code}")
            print(f"  Response: {search_response.text}")
            return False
        
        search_data = search_response.json()
        if not search_data.get("results") or len(search_data["results"]) == 0:
            print("✗ FAIL: No patients found with name Adams")
            return False
        
        patient = search_data["results"][0]
        patient_id = patient["id"]
        patient_name = f"{patient['firstName']} {patient['lastName']}"
        patient_mrn = patient.get("mrn", "N/A")
        
        print(f"✓ Found patient: {patient_name} (MRN: {patient_mrn})")
        print(f"✓ Patient ID: {patient_id}")
        
    except Exception as e:
        print(f"✗ FAIL: Patient search failed: {e}")
        return False
    
    # ============================================================================
    # STEP 2: Create payment ledger entry
    # ============================================================================
    print("\n[STEP 2] Create payment ledger entry ($30 copay)")
    print("-" * 80)
    
    try:
        payment_response = requests.post(
            f"{BASE_URL}/api/patients/{patient_id}/ledger",
            json={
                "type": "payment",
                "amountDollars": 30,
                "method": "card",
                "description": "Copay"
            },
            cookies=cookies,
            timeout=10
        )
        print(f"✓ POST /api/patients/{patient_id}/ledger -> {payment_response.status_code}")
        
        if payment_response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {payment_response.status_code}")
            print(f"  Response: {payment_response.text}")
            return False
        
        payment_data = payment_response.json()
        if not payment_data.get("ok") or not payment_data.get("entry"):
            print(f"✗ FAIL: Invalid response structure: {payment_data}")
            return False
        
        entry = payment_data["entry"]
        entry_id = entry["id"]
        amount_cents = entry["amountCents"]
        
        print(f"✓ Payment entry created: {entry_id}")
        print(f"✓ Amount in cents: {amount_cents}")
        
        # Assert amountCents == 3000
        if amount_cents != 3000:
            print(f"✗ FAIL: Expected amountCents=3000, got {amount_cents}")
            return False
        
        print(f"✓ ASSERTION PASSED: amountCents == 3000")
        
    except Exception as e:
        print(f"✗ FAIL: Payment creation failed: {e}")
        return False
    
    # ============================================================================
    # STEP 3: Get receipt PDF for payment entry
    # ============================================================================
    print("\n[STEP 3] Get receipt PDF for payment entry")
    print("-" * 80)
    
    try:
        receipt_response = requests.get(
            f"{BASE_URL}/api/patients/{patient_id}/receipt",
            params={"entryId": entry_id},
            cookies=cookies,
            timeout=10
        )
        print(f"✓ GET /api/patients/{patient_id}/receipt?entryId={entry_id} -> {receipt_response.status_code}")
        
        if receipt_response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {receipt_response.status_code}")
            print(f"  Response: {receipt_response.text}")
            return False
        
        # Check Content-Type header
        content_type = receipt_response.headers.get("Content-Type", "")
        print(f"✓ Content-Type: {content_type}")
        
        if content_type != "application/pdf":
            print(f"✗ FAIL: Expected Content-Type='application/pdf', got '{content_type}'")
            return False
        
        print(f"✓ ASSERTION PASSED: Content-Type == 'application/pdf'")
        
        # Check PDF signature (body starts with '%PDF')
        pdf_bytes = receipt_response.content
        if not pdf_bytes.startswith(b'%PDF'):
            print(f"✗ FAIL: PDF body does not start with '%PDF'")
            print(f"  First 10 bytes: {pdf_bytes[:10]}")
            return False
        
        print(f"✓ ASSERTION PASSED: PDF body starts with '%PDF'")
        print(f"✓ PDF size: {len(pdf_bytes)} bytes")
        
    except Exception as e:
        print(f"✗ FAIL: Receipt PDF retrieval failed: {e}")
        return False
    
    # ============================================================================
    # STEP 4: Get receipt without entryId (expect 400)
    # ============================================================================
    print("\n[STEP 4] Get receipt without entryId (expect 400)")
    print("-" * 80)
    
    try:
        no_entry_response = requests.get(
            f"{BASE_URL}/api/patients/{patient_id}/receipt",
            cookies=cookies,
            timeout=10
        )
        print(f"✓ GET /api/patients/{patient_id}/receipt (no entryId) -> {no_entry_response.status_code}")
        
        if no_entry_response.status_code != 400:
            print(f"✗ FAIL: Expected 400, got {no_entry_response.status_code}")
            print(f"  Response: {no_entry_response.text}")
            return False
        
        print(f"✓ ASSERTION PASSED: Returns 400 when entryId is missing")
        
        # Check error message
        error_data = no_entry_response.json()
        print(f"✓ Error message: {error_data.get('error', 'N/A')}")
        
    except Exception as e:
        print(f"✗ FAIL: Test failed: {e}")
        return False
    
    # ============================================================================
    # STEP 5: Get receipt with bogus entryId (expect 404)
    # ============================================================================
    print("\n[STEP 5] Get receipt with bogus entryId (expect 404)")
    print("-" * 80)
    
    try:
        bogus_response = requests.get(
            f"{BASE_URL}/api/patients/{patient_id}/receipt",
            params={"entryId": "bogus123"},
            cookies=cookies,
            timeout=10
        )
        print(f"✓ GET /api/patients/{patient_id}/receipt?entryId=bogus123 -> {bogus_response.status_code}")
        
        if bogus_response.status_code != 404:
            print(f"✗ FAIL: Expected 404, got {bogus_response.status_code}")
            print(f"  Response: {bogus_response.text}")
            return False
        
        print(f"✓ ASSERTION PASSED: Returns 404 for nonexistent entryId")
        
        # Check error message
        error_data = bogus_response.json()
        print(f"✓ Error message: {error_data.get('error', 'N/A')}")
        
    except Exception as e:
        print(f"✗ FAIL: Test failed: {e}")
        return False
    
    # ============================================================================
    # STEP 6: Create adjustment entry and try to get receipt (expect 400)
    # ============================================================================
    print("\n[STEP 6] Create adjustment entry and try to get receipt (expect 400)")
    print("-" * 80)
    
    try:
        # Create adjustment entry
        adjustment_response = requests.post(
            f"{BASE_URL}/api/patients/{patient_id}/ledger",
            json={
                "type": "adjustment",
                "amountDollars": 5
            },
            cookies=cookies,
            timeout=10
        )
        print(f"✓ POST /api/patients/{patient_id}/ledger (adjustment) -> {adjustment_response.status_code}")
        
        if adjustment_response.status_code != 200:
            print(f"✗ FAIL: Expected 200, got {adjustment_response.status_code}")
            print(f"  Response: {adjustment_response.text}")
            return False
        
        adjustment_data = adjustment_response.json()
        adjustment_id = adjustment_data["entry"]["id"]
        print(f"✓ Adjustment entry created: {adjustment_id}")
        
        # Try to get receipt for adjustment (should fail with 400)
        adjustment_receipt_response = requests.get(
            f"{BASE_URL}/api/patients/{patient_id}/receipt",
            params={"entryId": adjustment_id},
            cookies=cookies,
            timeout=10
        )
        print(f"✓ GET /api/patients/{patient_id}/receipt?entryId={adjustment_id} -> {adjustment_receipt_response.status_code}")
        
        if adjustment_receipt_response.status_code != 400:
            print(f"✗ FAIL: Expected 400, got {adjustment_receipt_response.status_code}")
            print(f"  Response: {adjustment_receipt_response.text}")
            return False
        
        print(f"✓ ASSERTION PASSED: Returns 400 for non-payment entry")
        
        # Check error message (should say receipt only for payments)
        error_data = adjustment_receipt_response.json()
        error_message = error_data.get("error", "")
        print(f"✓ Error message: {error_message}")
        
        if "payment" not in error_message.lower():
            print(f"✗ FAIL: Error message should mention 'payment'")
            return False
        
        print(f"✓ ASSERTION PASSED: Error message mentions receipt is only for payments")
        
    except Exception as e:
        print(f"✗ FAIL: Test failed: {e}")
        return False
    
    # ============================================================================
    # STEP 7: Try to get receipt without authentication (expect 401)
    # ============================================================================
    print("\n[STEP 7] Try to get receipt without authentication (expect 401)")
    print("-" * 80)
    
    try:
        unauth_response = requests.get(
            f"{BASE_URL}/api/patients/{patient_id}/receipt",
            params={"entryId": entry_id},
            timeout=10
            # No cookies = no authentication
        )
        print(f"✓ GET /api/patients/{patient_id}/receipt?entryId={entry_id} (no cookie) -> {unauth_response.status_code}")
        
        if unauth_response.status_code != 401:
            print(f"✗ FAIL: Expected 401, got {unauth_response.status_code}")
            print(f"  Response: {unauth_response.text}")
            return False
        
        print(f"✓ ASSERTION PASSED: Returns 401 without authentication")
        
        # Check error message
        error_data = unauth_response.json()
        print(f"✓ Error message: {error_data.get('error', 'N/A')}")
        
    except Exception as e:
        print(f"✗ FAIL: Test failed: {e}")
        return False
    
    # ============================================================================
    # ALL TESTS PASSED
    # ============================================================================
    print("\n" + "=" * 80)
    print("✓ ALL TESTS PASSED")
    print("=" * 80)
    print("\nSUMMARY:")
    print("  ✓ Step 1: Patient search (Adams) -> 200")
    print("  ✓ Step 2: Create payment entry ($30) -> 200, amountCents=3000")
    print("  ✓ Step 3: Get receipt PDF -> 200, Content-Type='application/pdf', body starts with '%PDF'")
    print("  ✓ Step 4: Get receipt without entryId -> 400")
    print("  ✓ Step 5: Get receipt with bogus entryId -> 404")
    print("  ✓ Step 6: Create adjustment, try receipt -> 400 (receipt only for payments)")
    print("  ✓ Step 7: Get receipt without auth -> 401")
    print("=" * 80)
    
    return True


if __name__ == "__main__":
    try:
        success = test_receipt_pdf()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n✗ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
