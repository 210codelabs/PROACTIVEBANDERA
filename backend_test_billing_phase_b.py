#!/usr/bin/env python3
"""
Backend test for Bank & EFT billing endpoints (Phase B)
Tests bank-accounts and eft-enrollments endpoints with role-based access control
"""
import asyncio
import aiohttp
import json
from datetime import datetime

# Base URL - use HTTPS for secure cookies
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"
PROVIDER_EMAIL = "andy.manzano@proactiveclinic.com"
PROVIDER_PASSWORD = "apex123"

async def login(session, email, password):
    """Login and return session cookie"""
    try:
        url = f"{BASE_URL}/api/auth/login"
        payload = {"email": email, "password": password}
        async with session.post(url, json=payload) as resp:
            if resp.status == 200:
                data = await resp.json()
                print(f"✅ Login successful for {email}")
                return True
            else:
                text = await resp.text()
                print(f"❌ Login failed for {email}: {resp.status} - {text}")
                return False
    except Exception as e:
        print(f"❌ Login exception for {email}: {e}")
        return False

async def test_bank_accounts():
    """Test bank accounts endpoints"""
    print("\n" + "="*80)
    print("TESTING BANK ACCOUNTS ENDPOINTS")
    print("="*80)
    
    # Create separate sessions for admin and provider
    admin_session = aiohttp.ClientSession()
    provider_session = aiohttp.ClientSession()
    no_auth_session = aiohttp.ClientSession()
    
    try:
        # Login as admin
        await login(admin_session, ADMIN_EMAIL, ADMIN_PASSWORD)
        
        # Login as provider
        await login(provider_session, PROVIDER_EMAIL, PROVIDER_PASSWORD)
        
        # TEST 1: GET /api/billing/bank-accounts WITHOUT cookie -> 401
        print("\n[TEST 1] GET /api/billing/bank-accounts WITHOUT auth cookie")
        try:
            async with no_auth_session.get(f"{BASE_URL}/api/billing/bank-accounts") as resp:
                status = resp.status
                data = await resp.json()
                if status == 401:
                    print(f"✅ PASS: Returns 401 Unauthorized as expected")
                    print(f"   Response: {data}")
                else:
                    print(f"❌ FAIL: Expected 401, got {status}")
                    print(f"   Response: {data}")
        except Exception as e:
            print(f"❌ FAIL: Exception - {e}")
        
        # TEST 2: GET as provider (andy) -> 403
        print("\n[TEST 2] GET /api/billing/bank-accounts as provider (should be FORBIDDEN)")
        try:
            async with provider_session.get(f"{BASE_URL}/api/billing/bank-accounts") as resp:
                status = resp.status
                data = await resp.json()
                if status == 403:
                    print(f"✅ PASS: Returns 403 Forbidden as expected")
                    print(f"   Response: {data}")
                else:
                    print(f"❌ FAIL: Expected 403, got {status}")
                    print(f"   Response: {data}")
        except Exception as e:
            print(f"❌ FAIL: Exception - {e}")
        
        # TEST 3: GET as admin -> 200 with {accounts:[...]}
        print("\n[TEST 3] GET /api/billing/bank-accounts as admin")
        try:
            async with admin_session.get(f"{BASE_URL}/api/billing/bank-accounts") as resp:
                status = resp.status
                data = await resp.json()
                if status == 200 and "accounts" in data:
                    print(f"✅ PASS: Returns 200 with accounts array")
                    print(f"   Number of accounts: {len(data['accounts'])}")
                    if data['accounts']:
                        print(f"   Sample account keys: {list(data['accounts'][0].keys())}")
                else:
                    print(f"❌ FAIL: Expected 200 with accounts, got {status}")
                    print(f"   Response: {data}")
        except Exception as e:
            print(f"❌ FAIL: Exception - {e}")
        
        # TEST 4: POST as admin - create bank account with MASKED sensitive data
        print("\n[TEST 4] POST /api/billing/bank-accounts as admin (create with masking)")
        bank_payload = {
            "label": "Operating",
            "bankName": "Frost Bank",
            "accountHolder": "Proactive Clinic",
            "routingNumber": "114000093",
            "accountNumber": "12345678",
            "accountType": "checking",
            "isDefault": True
        }
        try:
            async with admin_session.post(f"{BASE_URL}/api/billing/bank-accounts", json=bank_payload) as resp:
                status = resp.status
                data = await resp.json()
                if status == 200 and data.get("ok"):
                    account = data.get("account", {})
                    print(f"✅ PASS: Bank account created successfully")
                    print(f"   Account ID: {account.get('id')}")
                    print(f"   Label: {account.get('label')}")
                    print(f"   Bank Name: {account.get('bankName')}")
                    
                    # CRITICAL: Check masking
                    routing_masked = account.get("routingMasked")
                    account_masked = account.get("accountMasked")
                    
                    print(f"\n   🔒 MASKING CHECK:")
                    print(f"   routingMasked: {routing_masked}")
                    print(f"   accountMasked: {account_masked}")
                    
                    # Check that raw numbers are NOT in response
                    response_str = json.dumps(data)
                    has_raw_routing = "114000093" in response_str
                    has_raw_account = "12345678" in response_str
                    
                    if routing_masked == "••••0093" and account_masked == "••••5678":
                        print(f"   ✅ Masking format correct (••••0093, ••••5678)")
                    else:
                        print(f"   ❌ Masking format incorrect")
                    
                    if not has_raw_routing and not has_raw_account:
                        print(f"   ✅ Raw routing/account numbers NOT present in response")
                    else:
                        print(f"   ❌ SECURITY ISSUE: Raw numbers found in response!")
                        if has_raw_routing:
                            print(f"      - Raw routing number '114000093' found")
                        if has_raw_account:
                            print(f"      - Raw account number '12345678' found")
                    
                    # Check that routingNumber and accountNumber keys are NOT in account object
                    if "routingNumber" not in account and "accountNumber" not in account:
                        print(f"   ✅ Raw field keys (routingNumber, accountNumber) NOT in response")
                    else:
                        print(f"   ❌ SECURITY ISSUE: Raw field keys present in response!")
                        if "routingNumber" in account:
                            print(f"      - 'routingNumber' key found: {account.get('routingNumber')}")
                        if "accountNumber" in account:
                            print(f"      - 'accountNumber' key found: {account.get('accountNumber')}")
                    
                    # Store BID for later tests
                    global BID
                    BID = account.get("id")
                    print(f"\n   📝 Captured BID: {BID}")
                else:
                    print(f"❌ FAIL: Expected 200 with ok:true, got {status}")
                    print(f"   Response: {data}")
        except Exception as e:
            print(f"❌ FAIL: Exception - {e}")
        
        # TEST 5: POST as admin with invalid routing (must be 9 digits) -> 400
        print("\n[TEST 5] POST /api/billing/bank-accounts with invalid routing number")
        invalid_payload = {
            "label": "Bad",
            "routingNumber": "123"
        }
        try:
            async with admin_session.post(f"{BASE_URL}/api/billing/bank-accounts", json=invalid_payload) as resp:
                status = resp.status
                data = await resp.json()
                if status == 400:
                    print(f"✅ PASS: Returns 400 for invalid routing number")
                    print(f"   Error: {data.get('error')}")
                else:
                    print(f"❌ FAIL: Expected 400, got {status}")
                    print(f"   Response: {data}")
        except Exception as e:
            print(f"❌ FAIL: Exception - {e}")
        
    finally:
        await admin_session.close()
        await provider_session.close()
        await no_auth_session.close()

async def test_eft_enrollments():
    """Test EFT enrollments endpoints"""
    print("\n" + "="*80)
    print("TESTING EFT ENROLLMENTS ENDPOINTS")
    print("="*80)
    
    admin_session = aiohttp.ClientSession()
    
    try:
        # Login as admin
        await login(admin_session, ADMIN_EMAIL, ADMIN_PASSWORD)
        
        # TEST 6: POST as admin - create EFT enrollment
        print("\n[TEST 6] POST /api/billing/eft-enrollments as admin (create)")
        eft_payload = {
            "payerName": "UnitedHealthcare",
            "payerId": "87726",
            "enrollmentType": "eft",
            "bankAccountId": BID,
            "status": "submitted"
        }
        try:
            async with admin_session.post(f"{BASE_URL}/api/billing/eft-enrollments", json=eft_payload) as resp:
                status = resp.status
                data = await resp.json()
                if status == 200 and data.get("ok"):
                    enrollment = data.get("enrollment", {})
                    print(f"✅ PASS: EFT enrollment created successfully")
                    print(f"   Enrollment ID: {enrollment.get('id')}")
                    print(f"   Payer Name: {enrollment.get('payerName')}")
                    print(f"   Payer ID: {enrollment.get('payerId')}")
                    print(f"   Status: {enrollment.get('status')}")
                    print(f"   Bank Account ID: {enrollment.get('bankAccountId')}")
                    
                    # Store EID for later tests
                    global EID
                    EID = enrollment.get("id")
                    print(f"\n   📝 Captured EID: {EID}")
                else:
                    print(f"❌ FAIL: Expected 200 with ok:true, got {status}")
                    print(f"   Response: {data}")
        except Exception as e:
            print(f"❌ FAIL: Exception - {e}")
        
        # TEST 7: POST as admin with id - UPDATE existing enrollment
        print("\n[TEST 7] POST /api/billing/eft-enrollments with id (update to 'active')")
        update_payload = {
            "id": EID,
            "status": "active"
        }
        try:
            async with admin_session.post(f"{BASE_URL}/api/billing/eft-enrollments", json=update_payload) as resp:
                status = resp.status
                data = await resp.json()
                if status == 200 and data.get("ok"):
                    enrollment = data.get("enrollment", {})
                    print(f"✅ PASS: EFT enrollment updated successfully")
                    print(f"   Enrollment ID: {enrollment.get('id')}")
                    print(f"   Status: {enrollment.get('status')}")
                    
                    # Verify it's the SAME record (same ID)
                    if enrollment.get("id") == EID:
                        print(f"   ✅ Confirmed: Same record updated (ID matches)")
                    else:
                        print(f"   ❌ ERROR: Different ID returned (expected {EID}, got {enrollment.get('id')})")
                    
                    # Verify status is 'active'
                    if enrollment.get("status") == "active":
                        print(f"   ✅ Status updated to 'active'")
                    else:
                        print(f"   ❌ Status not updated correctly (got '{enrollment.get('status')}')")
                else:
                    print(f"❌ FAIL: Expected 200 with ok:true, got {status}")
                    print(f"   Response: {data}")
        except Exception as e:
            print(f"❌ FAIL: Exception - {e}")
        
        # TEST 8: GET /api/billing/eft-enrollments as admin
        print("\n[TEST 8] GET /api/billing/eft-enrollments as admin")
        try:
            async with admin_session.get(f"{BASE_URL}/api/billing/eft-enrollments") as resp:
                status = resp.status
                data = await resp.json()
                if status == 200 and "enrollments" in data:
                    enrollments = data.get("enrollments", [])
                    print(f"✅ PASS: Returns 200 with enrollments array")
                    print(f"   Number of enrollments: {len(enrollments)}")
                    
                    # Find our enrollment
                    our_enrollment = next((e for e in enrollments if e.get("id") == EID), None)
                    if our_enrollment:
                        print(f"   ✅ Found our enrollment (EID: {EID})")
                        print(f"      Status: {our_enrollment.get('status')}")
                        if our_enrollment.get("status") == "active":
                            print(f"      ✅ Status is 'active' as expected")
                        else:
                            print(f"      ❌ Status is not 'active' (got '{our_enrollment.get('status')}')")
                    else:
                        print(f"   ❌ Our enrollment (EID: {EID}) not found in list")
                else:
                    print(f"❌ FAIL: Expected 200 with enrollments, got {status}")
                    print(f"   Response: {data}")
        except Exception as e:
            print(f"❌ FAIL: Exception - {e}")
        
        # TEST 9: DELETE /api/billing/eft-enrollments?id=EID as admin
        print("\n[TEST 9] DELETE /api/billing/eft-enrollments?id={EID} as admin")
        try:
            async with admin_session.delete(f"{BASE_URL}/api/billing/eft-enrollments?id={EID}") as resp:
                status = resp.status
                data = await resp.json()
                if status == 200 and data.get("ok"):
                    print(f"✅ PASS: EFT enrollment deleted successfully")
                    print(f"   Response: {data}")
                else:
                    print(f"❌ FAIL: Expected 200 with ok:true, got {status}")
                    print(f"   Response: {data}")
        except Exception as e:
            print(f"❌ FAIL: Exception - {e}")
        
        # TEST 10: DELETE /api/billing/bank-accounts?id=BID as admin (soft delete)
        print("\n[TEST 10] DELETE /api/billing/bank-accounts?id={BID} as admin (soft delete)")
        try:
            async with admin_session.delete(f"{BASE_URL}/api/billing/bank-accounts?id={BID}") as resp:
                status = resp.status
                data = await resp.json()
                if status == 200 and data.get("ok"):
                    print(f"✅ PASS: Bank account soft-deleted successfully")
                    print(f"   Response: {data}")
                    
                    # Verify it's no longer in GET list
                    print(f"\n   Verifying soft-delete: GET /api/billing/bank-accounts")
                    async with admin_session.get(f"{BASE_URL}/api/billing/bank-accounts") as verify_resp:
                        verify_data = await verify_resp.json()
                        accounts = verify_data.get("accounts", [])
                        deleted_account = next((a for a in accounts if a.get("id") == BID), None)
                        if deleted_account is None:
                            print(f"   ✅ Confirmed: BID {BID} NOT in accounts list (soft-deleted)")
                        else:
                            print(f"   ❌ ERROR: BID {BID} still in accounts list")
                            print(f"      Account: {deleted_account}")
                else:
                    print(f"❌ FAIL: Expected 200 with ok:true, got {status}")
                    print(f"   Response: {data}")
        except Exception as e:
            print(f"❌ FAIL: Exception - {e}")
        
    finally:
        await admin_session.close()

async def main():
    """Run all tests"""
    print("="*80)
    print("BANK & EFT BILLING ENDPOINTS TEST (PHASE B)")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print(f"Provider: {PROVIDER_EMAIL}")
    print(f"Started at: {datetime.now().isoformat()}")
    
    try:
        await test_bank_accounts()
        await test_eft_enrollments()
        
        print("\n" + "="*80)
        print("ALL TESTS COMPLETED")
        print("="*80)
        print(f"Finished at: {datetime.now().isoformat()}")
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
