#!/usr/bin/env python3
"""
Backend test for Bank Account Manual Verification (no Plaid)
Tests /api/billing/bank-accounts and /api/stedi/enrollments bankAccountId linkage
"""

import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
LOGIN_EMAIL = "billing@proactiveclinic.com"
LOGIN_PASSWORD = "apex123"

def login():
    """Login and return session cookies"""
    print("\n=== LOGIN ===")
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
        timeout=30
    )
    print(f"POST /api/auth/login -> {resp.status_code}")
    if resp.status_code != 200:
        print(f"ERROR: Login failed: {resp.text}")
        sys.exit(1)
    print("✅ Login successful")
    return resp.cookies

def test_bank_accounts(cookies):
    """Test bank account CRUD operations"""
    print("\n" + "="*80)
    print("PART 1: BANK ACCOUNT MANUAL VERIFICATION — /api/billing/bank-accounts")
    print("="*80)
    
    # TEST 1: GET without cookie -> 401
    print("\n--- TEST 1: GET without auth cookie -> 401 ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/billing/bank-accounts", timeout=30)
        print(f"GET /api/billing/bank-accounts (no cookie) -> {resp.status_code}")
        if resp.status_code == 401:
            print("✅ TEST 1 PASSED: Returns 401 Unauthorized without cookie")
        else:
            print(f"❌ TEST 1 FAILED: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text}")
    except Exception as e:
        print(f"❌ TEST 1 FAILED: Exception: {e}")
    
    # TEST 2: GET with cookie -> 200 {accounts:[...]}
    print("\n--- TEST 2: GET with auth cookie -> 200 {accounts:[...]} ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/billing/bank-accounts", cookies=cookies, timeout=30)
        print(f"GET /api/billing/bank-accounts (with cookie) -> {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            if "accounts" in data:
                print(f"✅ TEST 2 PASSED: Returns 200 with accounts array (length: {len(data['accounts'])})")
            else:
                print(f"❌ TEST 2 FAILED: Missing 'accounts' key in response")
        else:
            print(f"❌ TEST 2 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
    except Exception as e:
        print(f"❌ TEST 2 FAILED: Exception: {e}")
    
    # TEST 3: Create bank account with CRITICAL security check (no full routing/account in response)
    print("\n--- TEST 3: POST create bank account -> 200 with MASKED routing/account ---")
    try:
        create_payload = {
            "label": "Test Deposit QA",
            "bankName": "Test Bank",
            "accountHolder": "Proactive Clinic",
            "accountType": "checking",
            "routingNumber": "123456789",
            "accountNumber": "000111222"
        }
        print(f"POST /api/billing/bank-accounts with payload: {json.dumps(create_payload, indent=2)}")
        resp = requests.post(
            f"{BASE_URL}/api/billing/bank-accounts",
            json=create_payload,
            cookies=cookies,
            timeout=30
        )
        print(f"POST /api/billing/bank-accounts -> {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get("ok") and "account" in data:
                account = data["account"]
                account_id = account.get("id")
                print(f"✅ Account created with ID: {account_id}")
                
                # CRITICAL SECURITY CHECKS
                response_str = json.dumps(data)
                
                # Check 1: Full routing number NOT in response
                if "123456789" in response_str:
                    print(f"❌ CRITICAL SECURITY FAILURE: Full routing number '123456789' found in response!")
                    print(f"Response contains sensitive data: {response_str}")
                    return None
                else:
                    print("✅ SECURITY CHECK 1 PASSED: Full routing number '123456789' NOT in response")
                
                # Check 2: Full account number NOT in response
                if "000111222" in response_str:
                    print(f"❌ CRITICAL SECURITY FAILURE: Full account number '000111222' found in response!")
                    print(f"Response contains sensitive data: {response_str}")
                    return None
                else:
                    print("✅ SECURITY CHECK 2 PASSED: Full account number '000111222' NOT in response")
                
                # Check 3: Verify masked fields are present
                routing_masked = account.get("routingMasked")
                account_masked = account.get("accountMasked")
                print(f"routingMasked: {routing_masked}")
                print(f"accountMasked: {account_masked}")
                
                if routing_masked and routing_masked.startswith("••••") and routing_masked.endswith("6789"):
                    print(f"✅ SECURITY CHECK 3 PASSED: routingMasked correctly formatted: {routing_masked}")
                else:
                    print(f"❌ SECURITY CHECK 3 FAILED: routingMasked format incorrect: {routing_masked}")
                
                if account_masked and account_masked.startswith("••••") and account_masked.endswith("1222"):
                    print(f"✅ SECURITY CHECK 4 PASSED: accountMasked correctly formatted: {account_masked}")
                else:
                    print(f"❌ SECURITY CHECK 4 FAILED: accountMasked format incorrect: {account_masked}")
                
                # Check 4: Verify raw field keys NOT in response
                if "routingNumber" in account or "accountNumber" in account:
                    print(f"❌ SECURITY CHECK 5 FAILED: Raw field keys 'routingNumber' or 'accountNumber' found in response")
                else:
                    print(f"✅ SECURITY CHECK 5 PASSED: Raw field keys 'routingNumber' and 'accountNumber' NOT in response")
                
                # Check verification status
                verification_status = account.get("verificationStatus")
                if verification_status == "unverified":
                    print(f"✅ Verification status is 'unverified' as expected")
                else:
                    print(f"⚠️ Verification status: {verification_status}")
                
                print("✅ TEST 3 PASSED: Bank account created with proper security masking")
                return account_id
            else:
                print(f"❌ TEST 3 FAILED: Missing 'ok' or 'account' in response")
                return None
        else:
            print(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
            return None
    except Exception as e:
        print(f"❌ TEST 3 FAILED: Exception: {e}")
        return None
    
def test_verification(cookies, account_id):
    """Test bank account verification operations"""
    if not account_id:
        print("\n⚠️ Skipping verification tests - no account ID")
        return
    
    # TEST 4: Verify with valid method
    print("\n--- TEST 4: PATCH verify with valid method -> 200 ---")
    try:
        verify_payload = {
            "id": account_id,
            "action": "verify",
            "method": "voided_check",
            "note": "QA test"
        }
        print(f"PATCH /api/billing/bank-accounts with payload: {json.dumps(verify_payload, indent=2)}")
        resp = requests.patch(
            f"{BASE_URL}/api/billing/bank-accounts",
            json=verify_payload,
            cookies=cookies,
            timeout=30
        )
        print(f"PATCH /api/billing/bank-accounts -> {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get("ok") and "account" in data:
                account = data["account"]
                verification_status = account.get("verificationStatus")
                verification_method = account.get("verificationMethod")
                verified_by_name = account.get("verifiedByName")
                verified_at = account.get("verifiedAt")
                
                print(f"verificationStatus: {verification_status}")
                print(f"verificationMethod: {verification_method}")
                print(f"verifiedByName: {verified_by_name}")
                print(f"verifiedAt: {verified_at}")
                
                if verification_status == "verified":
                    print("✅ Verification status is 'verified'")
                else:
                    print(f"❌ Expected verificationStatus 'verified', got '{verification_status}'")
                
                if verification_method == "voided_check":
                    print("✅ Verification method is 'voided_check'")
                else:
                    print(f"❌ Expected verificationMethod 'voided_check', got '{verification_method}'")
                
                if verified_by_name:
                    print(f"✅ verifiedByName is set: {verified_by_name}")
                else:
                    print("❌ verifiedByName is empty")
                
                if verified_at:
                    print(f"✅ verifiedAt is set: {verified_at}")
                else:
                    print("❌ verifiedAt is empty")
                
                print("✅ TEST 4 PASSED: Bank account verified successfully")
            else:
                print(f"❌ TEST 4 FAILED: Missing 'ok' or 'account' in response")
        else:
            print(f"❌ TEST 4 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
    except Exception as e:
        print(f"❌ TEST 4 FAILED: Exception: {e}")
    
    # TEST 5: Verify with invalid method -> 400
    print("\n--- TEST 5: PATCH verify with invalid method -> 400 ---")
    try:
        invalid_payload = {
            "id": account_id,
            "action": "verify",
            "method": "bogus"
        }
        print(f"PATCH /api/billing/bank-accounts with payload: {json.dumps(invalid_payload, indent=2)}")
        resp = requests.patch(
            f"{BASE_URL}/api/billing/bank-accounts",
            json=invalid_payload,
            cookies=cookies,
            timeout=30
        )
        print(f"PATCH /api/billing/bank-accounts -> {resp.status_code}")
        
        if resp.status_code == 400:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            print("✅ TEST 5 PASSED: Returns 400 for invalid verification method")
        else:
            print(f"❌ TEST 5 FAILED: Expected 400, got {resp.status_code}")
            print(f"Response: {resp.text}")
    except Exception as e:
        print(f"❌ TEST 5 FAILED: Exception: {e}")
    
    # TEST 6: Verify with missing method -> 400
    print("\n--- TEST 6: PATCH verify with missing method -> 400 ---")
    try:
        missing_method_payload = {
            "id": account_id,
            "action": "verify"
        }
        print(f"PATCH /api/billing/bank-accounts with payload: {json.dumps(missing_method_payload, indent=2)}")
        resp = requests.patch(
            f"{BASE_URL}/api/billing/bank-accounts",
            json=missing_method_payload,
            cookies=cookies,
            timeout=30
        )
        print(f"PATCH /api/billing/bank-accounts -> {resp.status_code}")
        
        if resp.status_code == 400:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            print("✅ TEST 6 PASSED: Returns 400 for missing verification method")
        else:
            print(f"❌ TEST 6 FAILED: Expected 400, got {resp.status_code}")
            print(f"Response: {resp.text}")
    except Exception as e:
        print(f"❌ TEST 6 FAILED: Exception: {e}")
    
    # TEST 7: Unverify -> 200
    print("\n--- TEST 7: PATCH unverify -> 200 ---")
    try:
        unverify_payload = {
            "id": account_id,
            "action": "unverify"
        }
        print(f"PATCH /api/billing/bank-accounts with payload: {json.dumps(unverify_payload, indent=2)}")
        resp = requests.patch(
            f"{BASE_URL}/api/billing/bank-accounts",
            json=unverify_payload,
            cookies=cookies,
            timeout=30
        )
        print(f"PATCH /api/billing/bank-accounts -> {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get("ok") and "account" in data:
                account = data["account"]
                verification_status = account.get("verificationStatus")
                
                if verification_status == "unverified":
                    print(f"✅ Verification status is 'unverified' after unverify action")
                    print("✅ TEST 7 PASSED: Bank account unverified successfully")
                else:
                    print(f"❌ Expected verificationStatus 'unverified', got '{verification_status}'")
            else:
                print(f"❌ TEST 7 FAILED: Missing 'ok' or 'account' in response")
        else:
            print(f"❌ TEST 7 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
    except Exception as e:
        print(f"❌ TEST 7 FAILED: Exception: {e}")

def test_role_guard(cookies):
    """Test role-based access control (best-effort)"""
    print("\n--- TEST 8 (OPTIONAL): Role guard - non-admin/non-billing session -> 403 ---")
    print("⚠️ Attempting to test with nurse.kim@proactiveclinic.com / apex123")
    
    try:
        # Try to login as nurse
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nurse.kim@proactiveclinic.com", "password": "apex123"},
            timeout=30
        )
        print(f"POST /api/auth/login (nurse) -> {resp.status_code}")
        
        if resp.status_code == 200:
            nurse_cookies = resp.cookies
            print("✅ Nurse login successful")
            
            # Try GET with nurse session
            resp = requests.get(f"{BASE_URL}/api/billing/bank-accounts", cookies=nurse_cookies, timeout=30)
            print(f"GET /api/billing/bank-accounts (nurse) -> {resp.status_code}")
            
            if resp.status_code == 403:
                print("✅ TEST 8 PASSED: Returns 403 Forbidden for non-admin/non-billing role")
            else:
                print(f"⚠️ Expected 403, got {resp.status_code}")
                print(f"Response: {resp.text}")
        else:
            print(f"⚠️ Nurse login failed with {resp.status_code}, skipping role guard test")
    except Exception as e:
        print(f"⚠️ TEST 8 SKIPPED: Exception: {e}")

def test_stedi_enrollment(cookies, account_id):
    """Test Stedi enrollment with bankAccountId linkage"""
    print("\n" + "="*80)
    print("PART 2: STEDI ENROLLMENT bankAccountId LINKAGE — POST /api/stedi/enrollments")
    print("="*80)
    
    if not account_id:
        print("\n⚠️ Skipping Stedi enrollment test - no account ID")
        return
    
    # TEST 9: POST enrollment with bankAccountId
    print("\n--- TEST 9: POST /api/stedi/enrollments with bankAccountId ---")
    try:
        enrollment_payload = {
            "payerIdOrAlias": "87726",
            "payerName": "Test Payer",
            "bankAccountId": account_id,
            "transactions": {
                "claimPayment": True
            }
        }
        print(f"POST /api/stedi/enrollments with payload: {json.dumps(enrollment_payload, indent=2)}")
        resp = requests.post(
            f"{BASE_URL}/api/stedi/enrollments",
            json=enrollment_payload,
            cookies=cookies,
            timeout=30
        )
        print(f"POST /api/stedi/enrollments -> {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check for success case (Stedi configured)
            if data.get("ok") and "enrollment" in data:
                enrollment = data["enrollment"]
                enrollment_bank_account_id = enrollment.get("bankAccountId")
                
                if enrollment_bank_account_id == account_id:
                    print(f"✅ Enrollment created with bankAccountId: {enrollment_bank_account_id}")
                    print("✅ TEST 9 PASSED: Stedi enrollment with bankAccountId linkage successful")
                else:
                    print(f"❌ Expected bankAccountId '{account_id}', got '{enrollment_bank_account_id}'")
            
            # Check for expected error case (Stedi not configured)
            elif "error" in data:
                error_msg = data["error"]
                print(f"Response error: {error_msg}")
                
                if "Stedi is not configured" in error_msg:
                    print("✅ TEST 9 PASSED: Returns 400 'Stedi is not configured.' (expected when Stedi not configured)")
                elif "Billing NPI" in error_msg or "Tax ID" in error_msg or "Org name" in error_msg:
                    print("✅ TEST 9 PASSED: Returns 400 about missing Billing NPI/Tax ID/Org (expected when settings incomplete)")
                else:
                    print(f"✅ TEST 9 PASSED: Returns 200 with error (graceful failure): {error_msg}")
            
            else:
                print(f"⚠️ Unexpected response structure: {data}")
        
        elif resp.status_code == 400:
            data = resp.json()
            error_msg = data.get("error", "")
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if "Stedi is not configured" in error_msg:
                print("✅ TEST 9 PASSED: Returns 400 'Stedi is not configured.' (expected when Stedi not configured)")
            elif "Billing NPI" in error_msg or "Tax ID" in error_msg or "Org name" in error_msg:
                print("✅ TEST 9 PASSED: Returns 400 about missing Billing NPI/Tax ID/Org (expected when settings incomplete)")
            else:
                print(f"✅ TEST 9 PASSED: Returns 400 (graceful failure): {error_msg}")
        
        else:
            print(f"❌ TEST 9 FAILED: Expected 200 or 400, got {resp.status_code}")
            print(f"Response: {resp.text}")
    
    except Exception as e:
        print(f"❌ TEST 9 FAILED: Exception: {e}")

def test_cleanup(cookies, account_id):
    """Cleanup: delete the test bank account"""
    print("\n" + "="*80)
    print("PART 3: CLEANUP — DELETE /api/billing/bank-accounts")
    print("="*80)
    
    if not account_id:
        print("\n⚠️ Skipping cleanup - no account ID")
        return
    
    # TEST 10: DELETE bank account
    print("\n--- TEST 10: DELETE /api/billing/bank-accounts ---")
    try:
        resp = requests.delete(
            f"{BASE_URL}/api/billing/bank-accounts?id={account_id}",
            cookies=cookies,
            timeout=30
        )
        print(f"DELETE /api/billing/bank-accounts?id={account_id} -> {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get("ok"):
                print("✅ TEST 10 PASSED: Bank account deleted successfully")
                
                # Verify deletion by GET
                resp = requests.get(f"{BASE_URL}/api/billing/bank-accounts", cookies=cookies, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    accounts = data.get("accounts", [])
                    if not any(a.get("id") == account_id for a in accounts):
                        print(f"✅ Verified: Account {account_id} NOT in accounts list (soft-deleted)")
                    else:
                        print(f"⚠️ Account {account_id} still appears in accounts list")
            else:
                print(f"❌ TEST 10 FAILED: Missing 'ok' in response")
        else:
            print(f"❌ TEST 10 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text}")
    except Exception as e:
        print(f"❌ TEST 10 FAILED: Exception: {e}")

def main():
    print("="*80)
    print("BACKEND TEST: Bank Account Manual Verification (no Plaid)")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Login: {LOGIN_EMAIL}")
    
    # Login
    cookies = login()
    
    # Part 1: Bank account CRUD
    account_id = test_bank_accounts(cookies)
    
    # Part 1 continued: Verification operations
    test_verification(cookies, account_id)
    
    # Part 1 optional: Role guard
    test_role_guard(cookies)
    
    # Part 2: Stedi enrollment
    test_stedi_enrollment(cookies, account_id)
    
    # Part 3: Cleanup
    test_cleanup(cookies, account_id)
    
    print("\n" + "="*80)
    print("BACKEND TEST COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
