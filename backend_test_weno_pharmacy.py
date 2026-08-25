#!/usr/bin/env python3
"""
Backend test for Weno pharmacy directory (search + admin sync), CancelRx, 
transmission status in Rx history.

CRITICAL CONTEXT: No real Weno credentials + IP not allowlisted, so real 
directory download / CancelRx sends WILL fail. Assert graceful JSON handling 
(no 500 crash), NOT that Weno truly connects.
"""

import asyncio
import aiohttp
import json

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

async def main():
    print("=" * 80)
    print("WENO PHARMACY DIRECTORY + CANCELRX + RX HISTORY BACKEND TEST")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print()
    
    async with aiohttp.ClientSession() as session:
        # ===== SETUP: Login as staff admin =====
        print("SETUP: Logging in as staff admin...")
        login_resp = await session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"}
        )
        print(f"  Login status: {login_resp.status}")
        if login_resp.status != 200:
            print(f"  ERROR: Login failed with status {login_resp.status}")
            login_text = await login_resp.text()
            print(f"  Response: {login_text[:500]}")
            return
        
        login_data = await login_resp.json()
        print(f"  ✅ Login successful")
        print()
        
        # ===== SETUP: Enable Weno with test environment =====
        print("SETUP: Enabling Weno integration with test environment...")
        
        # First GET to preserve existing config
        get_integrations_resp = await session.get(f"{BASE_URL}/api/admin/integrations")
        print(f"  GET /api/admin/integrations status: {get_integrations_resp.status}")
        if get_integrations_resp.status != 200:
            print(f"  ERROR: Failed to get integrations")
            return
        
        integrations_data = await get_integrations_resp.json()
        state = integrations_data.get("state", {})
        providers = state.get("providers", {})
        
        # Update Weno config
        weno_config = {
            "enabled": True,
            "credentials": {
                "ENVIRONMENT": "test",
                "PARTNER_ID": "TESTPARTNER",
                "PARTNER_PASSWORD": "testpass",
                "MD5_PASSWORD": "",
                "PRESCRIBER_ROUTING_ID": "RTR1",
                "SENDER_SOFTWARE_NAME": "ProactiveClinics EHR",
                "SENDER_SOFTWARE_VERSION": "1.0",
                "ENDPOINT_OVERRIDE": ""
            },
            "subServices": {
                "newrx": True,
                "epcs": False,
                "directory": True,
                "medhistory": False
            },
            "subServiceCredentials": {}
        }
        
        providers["weno"] = weno_config
        
        put_integrations_resp = await session.put(
            f"{BASE_URL}/api/admin/integrations",
            json={"providers": providers}
        )
        print(f"  PUT /api/admin/integrations status: {put_integrations_resp.status}")
        if put_integrations_resp.status != 200:
            print(f"  ERROR: Failed to enable Weno")
            put_text = await put_integrations_resp.text()
            print(f"  Response: {put_text[:500]}")
            return
        
        put_data = await put_integrations_resp.json()
        print(f"  ✅ Weno enabled with test environment")
        print()
        
        # ===== TEST 1: PHARMACY SEARCH =====
        print("=" * 80)
        print("TEST 1: PHARMACY SEARCH")
        print("=" * 80)
        
        # Test 1a: Search without cookie (should fail)
        print("\nTest 1a: GET /api/weno/pharmacies?q=test WITHOUT auth cookie")
        async with aiohttp.ClientSession() as no_auth_session:
            search_no_auth_resp = await no_auth_session.get(
                f"{BASE_URL}/api/weno/pharmacies?q=test"
            )
            print(f"  Status: {search_no_auth_resp.status}")
            if search_no_auth_resp.status == 401:
                print(f"  ✅ PASS: Correctly returns 401 Unauthorized")
            else:
                print(f"  ❌ FAIL: Expected 401, got {search_no_auth_resp.status}")
        
        # Test 1b: Search with auth for "test"
        print("\nTest 1b: GET /api/weno/pharmacies?q=test WITH auth cookie")
        search_test_resp = await session.get(f"{BASE_URL}/api/weno/pharmacies?q=test")
        print(f"  Status: {search_test_resp.status}")
        
        if search_test_resp.status == 200:
            search_test_data = await search_test_resp.json()
            pharmacies = search_test_data.get("pharmacies", [])
            environment = search_test_data.get("environment", "")
            
            print(f"  ✅ PASS: Returns 200")
            print(f"  Environment: {environment}")
            print(f"  Pharmacies count: {len(pharmacies)}")
            
            # Check for built-in test pharmacy
            test_pharmacy = None
            for p in pharmacies:
                if p.get("ncpdpId") == "1234567" and p.get("isTest") == True:
                    test_pharmacy = p
                    break
            
            if test_pharmacy:
                print(f"  ✅ PASS: Built-in test pharmacy found")
                print(f"    NCPDP ID: {test_pharmacy.get('ncpdpId')}")
                print(f"    Name: {test_pharmacy.get('name')}")
                print(f"    isTest: {test_pharmacy.get('isTest')}")
            else:
                print(f"  ❌ FAIL: Built-in test pharmacy (ncpdpId=1234567, isTest=true) NOT found")
                print(f"  Available pharmacies: {json.dumps(pharmacies, indent=2)}")
        else:
            print(f"  ❌ FAIL: Expected 200, got {search_test_resp.status}")
            search_test_text = await search_test_resp.text()
            print(f"  Response: {search_test_text[:500]}")
        
        # Test 1c: Search by NCPDP ID
        print("\nTest 1c: GET /api/weno/pharmacies?q=1234567 (search by NCPDP)")
        search_ncpdp_resp = await session.get(f"{BASE_URL}/api/weno/pharmacies?q=1234567")
        print(f"  Status: {search_ncpdp_resp.status}")
        
        if search_ncpdp_resp.status == 200:
            search_ncpdp_data = await search_ncpdp_resp.json()
            pharmacies = search_ncpdp_data.get("pharmacies", [])
            
            print(f"  ✅ PASS: Returns 200")
            print(f"  Pharmacies count: {len(pharmacies)}")
            
            # Check if test pharmacy is included
            test_pharmacy_found = any(
                p.get("ncpdpId") == "1234567" for p in pharmacies
            )
            
            if test_pharmacy_found:
                print(f"  ✅ PASS: Test pharmacy (ncpdpId=1234567) found in results")
            else:
                print(f"  ❌ FAIL: Test pharmacy NOT found when searching by NCPDP ID")
        else:
            print(f"  ❌ FAIL: Expected 200, got {search_ncpdp_resp.status}")
        
        print()
        
        # ===== TEST 2: DIRECTORY SYNC =====
        print("=" * 80)
        print("TEST 2: DIRECTORY SYNC")
        print("=" * 80)
        
        # Test 2a: GET directory count
        print("\nTest 2a: GET /api/admin/weno/directory/sync (admin)")
        get_sync_resp = await session.get(f"{BASE_URL}/api/admin/weno/directory/sync")
        print(f"  Status: {get_sync_resp.status}")
        
        if get_sync_resp.status == 200:
            get_sync_data = await get_sync_resp.json()
            count = get_sync_data.get("count", 0)
            print(f"  ✅ PASS: Returns 200")
            print(f"  Cached pharmacy count: {count}")
        else:
            print(f"  ❌ FAIL: Expected 200, got {get_sync_resp.status}")
        
        # Test 2b: POST directory sync (will likely fail due to no real creds)
        print("\nTest 2b: POST /api/admin/weno/directory/sync (admin)")
        print("  NOTE: Expected to fail gracefully (no real Weno creds/IP allowlist)")
        post_sync_resp = await session.post(f"{BASE_URL}/api/admin/weno/directory/sync")
        print(f"  Status: {post_sync_resp.status}")
        
        # Should return 200, 400, or 502 with JSON (NOT 500)
        if post_sync_resp.status in [200, 400, 502]:
            try:
                post_sync_data = await post_sync_resp.json()
                print(f"  ✅ PASS: Returns {post_sync_resp.status} with JSON (graceful handling)")
                
                if "ok" in post_sync_data:
                    print(f"    ok: {post_sync_data.get('ok')}")
                    print(f"    imported: {post_sync_data.get('imported', 0)}")
                if "error" in post_sync_data:
                    print(f"    error: {post_sync_data.get('error', '')[:200]}")
            except Exception as e:
                print(f"  ❌ FAIL: Response is not valid JSON: {e}")
                post_sync_text = await post_sync_resp.text()
                print(f"  Response: {post_sync_text[:500]}")
        elif post_sync_resp.status == 500:
            print(f"  ❌ FAIL: Returns 500 (should handle gracefully with 400/502)")
            post_sync_text = await post_sync_resp.text()
            print(f"  Response: {post_sync_text[:500]}")
        else:
            print(f"  ⚠️  Unexpected status: {post_sync_resp.status}")
        
        # Test 2c: POST without admin cookie
        print("\nTest 2c: POST /api/admin/weno/directory/sync WITHOUT admin cookie")
        async with aiohttp.ClientSession() as no_auth_session:
            post_sync_no_auth_resp = await no_auth_session.post(
                f"{BASE_URL}/api/admin/weno/directory/sync"
            )
            print(f"  Status: {post_sync_no_auth_resp.status}")
            if post_sync_no_auth_resp.status in [401, 403]:
                print(f"  ✅ PASS: Correctly returns {post_sync_no_auth_resp.status}")
            else:
                print(f"  ❌ FAIL: Expected 401 or 403, got {post_sync_no_auth_resp.status}")
        
        print()
        
        # ===== TEST 3: CANCELRX =====
        print("=" * 80)
        print("TEST 3: CANCELRX")
        print("=" * 80)
        
        # Test 3a: Create a prescription
        print("\nTest 3a: Create prescription for CancelRx test")
        create_rx_resp = await session.post(
            f"{BASE_URL}/api/erx",
            json={
                "patientName": "Cancel Test",
                "medName": "Ibuprofen",
                "strength": "200mg",
                "providerName": "Dr Park",
                "providerNpi": "1999999992"
            }
        )
        print(f"  Status: {create_rx_resp.status}")
        
        if create_rx_resp.status == 200:
            create_rx_data = await create_rx_resp.json()
            rx_id = create_rx_data.get("id")
            print(f"  ✅ PASS: Prescription created")
            print(f"  Prescription ID: {rx_id}")
            
            # Test 3b: Transmit the prescription
            print("\nTest 3b: Transmit prescription")
            transmit_resp = await session.post(
                f"{BASE_URL}/api/erx/{rx_id}/transmit",
                json={"pharmacyNcpdp": "1234567"}
            )
            print(f"  Status: {transmit_resp.status}")
            
            if transmit_resp.status in [200, 400]:
                transmit_data = await transmit_resp.json()
                print(f"  ✅ PASS: Returns {transmit_resp.status} with JSON")
                print(f"  Response keys: {list(transmit_data.keys())}")
                
                # Check if wenoMessageId was recorded (even on error)
                if "messageId" in transmit_data or "state" in transmit_data or "error" in transmit_data:
                    print(f"  ✅ PASS: Response contains expected fields")
                    if "state" in transmit_data:
                        print(f"    state: {transmit_data.get('state')}")
                    if "error" in transmit_data:
                        print(f"    error: {transmit_data.get('error', '')[:200]}")
                
                # Test 3c: Cancel the prescription
                print("\nTest 3c: POST /api/erx/{id}/cancel")
                print("  NOTE: Expected to fail gracefully (no real Weno creds/IP allowlist)")
                cancel_resp = await session.post(f"{BASE_URL}/api/erx/{rx_id}/cancel")
                print(f"  Status: {cancel_resp.status}")
                
                if cancel_resp.status in [200, 400]:
                    try:
                        cancel_data = await cancel_resp.json()
                        print(f"  ✅ PASS: Returns {cancel_resp.status} with JSON (graceful handling)")
                        print(f"  Response keys: {list(cancel_data.keys())}")
                        
                        # Must have 'state' or 'error' field
                        if "state" in cancel_data or "error" in cancel_data:
                            print(f"  ✅ PASS: Response contains 'state' or 'error' field")
                            if "state" in cancel_data:
                                print(f"    state: {cancel_data.get('state')}")
                            if "error" in cancel_data:
                                print(f"    error: {cancel_data.get('error', '')[:200]}")
                        else:
                            print(f"  ❌ FAIL: Response missing 'state' or 'error' field")
                    except Exception as e:
                        print(f"  ❌ FAIL: Response is not valid JSON: {e}")
                        cancel_text = await cancel_resp.text()
                        print(f"  Response: {cancel_text[:500]}")
                elif cancel_resp.status == 500:
                    print(f"  ❌ FAIL: Returns 500 (should handle gracefully)")
                    cancel_text = await cancel_resp.text()
                    print(f"  Response: {cancel_text[:500]}")
                else:
                    print(f"  ⚠️  Unexpected status: {cancel_resp.status}")
            else:
                print(f"  ❌ FAIL: Transmit failed with status {transmit_resp.status}")
                transmit_text = await transmit_resp.text()
                print(f"  Response: {transmit_text[:500]}")
        else:
            print(f"  ❌ FAIL: Failed to create prescription")
            create_rx_text = await create_rx_resp.text()
            print(f"  Response: {create_rx_text[:500]}")
        
        print()
        
        # ===== TEST 4: CANCEL GATING =====
        print("=" * 80)
        print("TEST 4: CANCEL GATING (non-transmitted prescription)")
        print("=" * 80)
        
        # Test 4a: Create a prescription WITHOUT transmitting
        print("\nTest 4a: Create prescription WITHOUT transmitting")
        create_rx2_resp = await session.post(
            f"{BASE_URL}/api/erx",
            json={
                "patientName": "NoTransmit",
                "medName": "Aspirin",
                "providerName": "Dr Park",
                "providerNpi": "1999999992"
            }
        )
        print(f"  Status: {create_rx2_resp.status}")
        
        if create_rx2_resp.status == 200:
            create_rx2_data = await create_rx2_resp.json()
            rx2_id = create_rx2_data.get("id")
            print(f"  ✅ PASS: Prescription created")
            print(f"  Prescription ID: {rx2_id}")
            
            # Test 4b: Try to cancel without transmitting
            print("\nTest 4b: POST /api/erx/{id}/cancel (NOT transmitted)")
            cancel2_resp = await session.post(f"{BASE_URL}/api/erx/{rx2_id}/cancel")
            print(f"  Status: {cancel2_resp.status}")
            
            if cancel2_resp.status == 400:
                cancel2_data = await cancel2_resp.json()
                error_msg = cancel2_data.get("error", "")
                print(f"  ✅ PASS: Returns 400 (gating working)")
                print(f"  Error message: {error_msg}")
                
                if "not transmitted" in error_msg.lower() or "weno" in error_msg.lower():
                    print(f"  ✅ PASS: Error message indicates prescription not transmitted via Weno")
                else:
                    print(f"  ⚠️  Error message doesn't clearly indicate Weno transmission requirement")
            else:
                print(f"  ❌ FAIL: Expected 400, got {cancel2_resp.status}")
                cancel2_text = await cancel2_resp.text()
                print(f"  Response: {cancel2_text[:500]}")
        else:
            print(f"  ❌ FAIL: Failed to create prescription")
        
        print()
        
        # ===== TEST 5: RX HISTORY FIELDS =====
        print("=" * 80)
        print("TEST 5: RX HISTORY TRANSMISSION STATUS FIELDS")
        print("=" * 80)
        
        print("\nTest 5: GET /api/erx (check for Weno transmission fields)")
        get_erx_resp = await session.get(f"{BASE_URL}/api/erx")
        print(f"  Status: {get_erx_resp.status}")
        
        if get_erx_resp.status == 200:
            get_erx_data = await get_erx_resp.json()
            prescriptions = get_erx_data.get("prescriptions", [])
            print(f"  ✅ PASS: Returns 200")
            print(f"  Prescriptions count: {len(prescriptions)}")
            
            # Find a transmitted prescription
            transmitted_rx = None
            for rx in prescriptions:
                if rx.get("transmissionMethod") == "weno":
                    transmitted_rx = rx
                    break
            
            if transmitted_rx:
                print(f"  ✅ PASS: Found prescription with transmissionMethod='weno'")
                print(f"  Prescription ID: {transmitted_rx.get('id')}")
                
                # Check for required Weno fields
                required_fields = ["transmissionMethod", "wenoState", "wenoMessageId", "pharmacyNcpdp"]
                missing_fields = []
                
                for field in required_fields:
                    if field in transmitted_rx:
                        print(f"    ✅ {field}: {transmitted_rx.get(field)}")
                    else:
                        missing_fields.append(field)
                        print(f"    ❌ {field}: MISSING")
                
                if not missing_fields:
                    print(f"  ✅ PASS: All required Weno transmission fields present")
                else:
                    print(f"  ❌ FAIL: Missing fields: {missing_fields}")
            else:
                print(f"  ⚠️  No transmitted prescriptions found (may be expected if transmit failed)")
                try:
                    print(f"  Sample prescription keys: {list(prescriptions[0].keys()) if prescriptions else 'N/A'}")
                except Exception:
                    print(f"  Sample prescription keys: N/A")
        else:
            print(f"  ❌ FAIL: Expected 200, got {get_erx_resp.status}")
        
        print()
        
        # ===== TEST 6: CANCEL WITHOUT AUTH =====
        print("=" * 80)
        print("TEST 6: CANCEL WITHOUT AUTH")
        print("=" * 80)
        
        print("\nTest 6: POST /api/erx/{id}/cancel WITHOUT auth cookie")
        async with aiohttp.ClientSession() as no_auth_session:
            # Use the first prescription ID if available
            if 'rx_id' in locals():
                cancel_no_auth_resp = await no_auth_session.post(
                    f"{BASE_URL}/api/erx/{rx_id}/cancel"
                )
                print(f"  Status: {cancel_no_auth_resp.status}")
                if cancel_no_auth_resp.status == 401:
                    print(f"  ✅ PASS: Correctly returns 401 Unauthorized")
                else:
                    print(f"  ❌ FAIL: Expected 401, got {cancel_no_auth_resp.status}")
            else:
                print(f"  ⚠️  SKIP: No prescription ID available for testing")
        
        print()
        
        # ===== SUMMARY =====
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print("All tests completed. Review results above.")
        print()
        print("CRITICAL NOTES:")
        print("- No real Weno credentials + IP not allowlisted")
        print("- Real directory download / CancelRx sends WILL fail")
        print("- Tests verify graceful JSON handling (no 500 crash)")
        print("- Tests do NOT verify that Weno truly connects")
        print("=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
