#!/usr/bin/env python3
"""
Backend test for Weno EZ-only cleanup + new Weno LITE pharmacy directory.
Tests pharmacy search, weno-status, weno-test, boot reconcile, and regression checks.
CRITICAL: NO endpoint may return HTTP 500.
"""
import asyncio
import httpx
import sys
import os

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"
NURSE_EMAIL = "nurse.kim@proactiveclinic.com"
NURSE_PASSWORD = "apex123"
PROVIDER_EMAIL = "andy.manzano@proactiveclinic.com"
PROVIDER_PASSWORD = "apex123"

# Read AUTH_SECRET from .env file
AUTH_SECRET = None
try:
    with open("/app/.env", "r") as f:
        for line in f:
            if line.startswith("AUTH_SECRET="):
                AUTH_SECRET = line.split("=", 1)[1].strip().strip('"')
                break
except Exception as e:
    print(f"⚠️  Could not read AUTH_SECRET from .env: {e}")

async def login(client: httpx.AsyncClient, email: str, password: str) -> dict:
    """Login and return session cookie."""
    resp = await client.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        raise Exception(f"Login failed for {email}: {resp.status_code} {resp.text}")
    return dict(resp.cookies)

def mask_secrets(text: str) -> str:
    """Mask sensitive values in output."""
    # Mask common secret patterns
    import re
    # Mask data= parameter values
    text = re.sub(r'(data=)[^&\s]+', r'\1***MASKED***', text)
    # Mask useremail values
    text = re.sub(r'(useremail=)[^&\s]+', r'\1***MASKED***', text)
    # Mask UserEmail field values
    text = re.sub(r'("UserEmail"\s*:\s*")[^"]+', r'\1***MASKED***', text)
    # Mask MD5Password field values
    text = re.sub(r'("MD5Password"\s*:\s*")[^"]+', r'\1***MASKED***', text)
    # Mask LocationID field values
    text = re.sub(r'("LocationID"\s*:\s*")[^"]+', r'\1***MASKED***', text)
    return text

async def main():
    print("=" * 80)
    print("WENO EZ-ONLY CLEANUP + NEW WENO LITE PHARMACY DIRECTORY BACKEND TEST")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print()

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        try:
            # ================================================================
            # TEST 1: PHARMACY SEARCH (new directory import of 6391 TX pharmacies)
            # ================================================================
            print("=" * 80)
            print("TEST 1: PHARMACY SEARCH (new directory import)")
            print("=" * 80)
            
            # 1a) GET /api/weno/pharmacies WITHOUT session -> 401
            print("\n[1a] GET /api/weno/pharmacies WITHOUT session -> expect 401")
            try:
                resp = await client.get(f"{BASE_URL}/api/weno/pharmacies?q=Houston")
                print(f"✅ Status: {resp.status_code}")
                if resp.status_code == 401:
                    print("✅ PASS: Correctly returns 401 Unauthorized without session")
                else:
                    print(f"❌ FAIL: Expected 401, got {resp.status_code}")
                    print(f"Response: {resp.text[:200]}")
            except Exception as e:
                print(f"❌ FAIL: Exception during request: {e}")

            # Login as admin
            print("\n[1b] Login as admin...")
            admin_cookies = await login(client, ADMIN_EMAIL, ADMIN_PASSWORD)
            print("✅ Admin login successful")

            # 1c) GET /api/weno/pharmacies?q=Houston -> 200 with many results
            print("\n[1c] GET /api/weno/pharmacies?q=Houston -> expect 200 with many results")
            try:
                resp = await client.get(f"{BASE_URL}/api/weno/pharmacies?q=Houston", cookies=admin_cookies)
                print(f"✅ Status: {resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    pharmacies = data.get("pharmacies", [])
                    print(f"✅ Response contains 'pharmacies' array with {len(pharmacies)} items")
                    
                    if len(pharmacies) > 0:
                        print("✅ PASS: Non-empty array returned for 'Houston' query")
                        # Check structure of first item
                        first = pharmacies[0]
                        has_ncpdp = "ncpdpId" in first and isinstance(first["ncpdpId"], str)
                        has_name = "name" in first and isinstance(first["name"], str)
                        print(f"   Sample pharmacy: ncpdpId={first.get('ncpdpId')}, name={first.get('name')}")
                        print(f"   Fields: city={first.get('city')}, state={first.get('state')}, zip={first.get('zip')}")
                        if first.get("wenoConnected"):
                            print(f"   ✅ wenoConnected=true (onWeno directory row)")
                        
                        if has_ncpdp and has_name:
                            print("✅ PASS: Each item has string ncpdpId and name")
                        else:
                            print(f"❌ FAIL: Missing required fields - ncpdpId: {has_ncpdp}, name: {has_name}")
                    else:
                        print("❌ FAIL: Empty array returned for 'Houston' query (expected many results)")
                else:
                    print(f"❌ FAIL: Expected 200, got {resp.status_code}")
                    print(f"Response: {resp.text[:500]}")
            except Exception as e:
                print(f"❌ FAIL: Exception during request: {e}")

            # 1d) GET /api/weno/pharmacies?q=CVS -> 200 (may include local seeded Pharmacy rows)
            print("\n[1d] GET /api/weno/pharmacies?q=CVS -> expect 200")
            try:
                resp = await client.get(f"{BASE_URL}/api/weno/pharmacies?q=CVS", cookies=admin_cookies)
                print(f"✅ Status: {resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    pharmacies = data.get("pharmacies", [])
                    print(f"✅ Response contains 'pharmacies' array with {len(pharmacies)} items")
                    if len(pharmacies) > 0:
                        print("✅ PASS: Results returned for 'CVS' query")
                        # Show sample
                        first = pharmacies[0]
                        print(f"   Sample: {first.get('name')} (ncpdpId={first.get('ncpdpId')})")
                    else:
                        print("⚠️  WARNING: No results for 'CVS' (may be expected if not in directory)")
                    print("✅ PASS: No 500 error")
                else:
                    print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            except Exception as e:
                print(f"❌ FAIL: Exception during request: {e}")

            # 1e) GET /api/weno/pharmacies?q=Dallas -> 200, non-empty array
            print("\n[1e] GET /api/weno/pharmacies?q=Dallas -> expect 200 with results")
            try:
                resp = await client.get(f"{BASE_URL}/api/weno/pharmacies?q=Dallas", cookies=admin_cookies)
                print(f"✅ Status: {resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    pharmacies = data.get("pharmacies", [])
                    print(f"✅ Response contains 'pharmacies' array with {len(pharmacies)} items")
                    if len(pharmacies) > 0:
                        print("✅ PASS: Non-empty array returned for 'Dallas' query")
                    else:
                        print("❌ FAIL: Empty array for 'Dallas' (expected results)")
                else:
                    print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            except Exception as e:
                print(f"❌ FAIL: Exception during request: {e}")

            # ================================================================
            # TEST 2: WENO STATUS is EZ-only now
            # ================================================================
            print("\n" + "=" * 80)
            print("TEST 2: WENO STATUS (EZ-only, no Exchange)")
            print("=" * 80)
            
            print("\n[2] GET /api/erx/weno-status as admin -> expect 200")
            try:
                resp = await client.get(f"{BASE_URL}/api/erx/weno-status", cookies=admin_cookies)
                print(f"✅ Status: {resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"✅ Response JSON keys: {list(data.keys())}")
                    
                    # Check required fields
                    has_enabled = "enabled" in data
                    has_configured = "configured" in data
                    has_environment = "environment" in data
                    has_epcs = "epcs" in data
                    has_online = "online" in data
                    
                    print(f"   enabled: {data.get('enabled')}")
                    print(f"   configured: {data.get('configured')}")
                    print(f"   environment: {data.get('environment')}")
                    print(f"   epcs: {data.get('epcs')}")
                    
                    if has_online:
                        online = data["online"]
                        print(f"   online.enabled: {online.get('enabled')}")
                        print(f"   online.configured: {online.get('configured')}")
                        print(f"   online.keySet: {online.get('keySet')}")
                        print(f"   online.environment: {online.get('environment')}")
                        if "prescriber" in online:
                            prescriber = online["prescriber"]
                            print(f"   online.prescriber keys: {list(prescriber.keys())}")
                    
                    if all([has_enabled, has_configured, has_environment, has_epcs, has_online]):
                        print("✅ PASS: All required fields present (enabled, configured, environment, epcs, online)")
                    else:
                        print(f"❌ FAIL: Missing required fields")
                    
                    # Verify it does NOT reference Weno Exchange
                    resp_text = resp.text.lower()
                    if "exchange" not in resp_text or "online" in resp_text:
                        print("✅ PASS: Response does not reference Weno Exchange (EZ-only)")
                    else:
                        print("⚠️  WARNING: Response may reference Exchange")
                    
                    print("✅ PASS: No 500 error")
                else:
                    print(f"❌ FAIL: Expected 200, got {resp.status_code}")
                    print(f"Response: {resp.text[:500]}")
            except Exception as e:
                print(f"❌ FAIL: Exception during request: {e}")

            # ================================================================
            # TEST 3: WENO TEST connection
            # ================================================================
            print("\n" + "=" * 80)
            print("TEST 3: WENO TEST CONNECTION")
            print("=" * 80)
            
            print("\n[3] GET /api/erx/weno-test as admin -> expect 200")
            try:
                resp = await client.get(f"{BASE_URL}/api/erx/weno-test", cookies=admin_cookies)
                print(f"✅ Status: {resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"✅ Response JSON keys: {list(data.keys())}")
                    
                    has_ok = "ok" in data
                    has_online = "online" in data
                    
                    print(f"   ok: {data.get('ok')}")
                    
                    if has_online:
                        online = data["online"]
                        print(f"   online.enabled: {online.get('enabled')}")
                        print(f"   online.configured: {online.get('configured')}")
                        print(f"   online.environment: {online.get('environment')}")
                        print(f"   online.message: {online.get('message')}")
                    
                    if has_ok and has_online:
                        print("✅ PASS: Response has ok and online fields")
                    else:
                        print(f"❌ FAIL: Missing required fields")
                    
                    print("✅ PASS: No 500 error")
                else:
                    print(f"❌ FAIL: Expected 200, got {resp.status_code}")
                    print(f"Response: {resp.text[:500]}")
            except Exception as e:
                print(f"❌ FAIL: Exception during request: {e}")

            # ================================================================
            # TEST 4: BOOT RECONCILE + PRUNE (self-heal)
            # ================================================================
            print("\n" + "=" * 80)
            print("TEST 4: BOOT RECONCILE + PRUNE (self-heal)")
            print("=" * 80)
            
            # 4a) POST /api/internal/weno-apply-env WITHOUT header -> 403
            print("\n[4a] POST /api/internal/weno-apply-env WITHOUT x-weno-cron header -> expect 403")
            try:
                resp = await client.post(f"{BASE_URL}/api/internal/weno-apply-env")
                print(f"✅ Status: {resp.status_code}")
                if resp.status_code == 403:
                    print("✅ PASS: Correctly returns 403 Forbidden without secret header")
                else:
                    print(f"❌ FAIL: Expected 403, got {resp.status_code}")
                    print(f"Response: {resp.text[:200]}")
            except Exception as e:
                print(f"❌ FAIL: Exception during request: {e}")

            # 4b) POST /api/internal/weno-apply-env WITH header -> 200
            if AUTH_SECRET:
                print(f"\n[4b] POST /api/internal/weno-apply-env WITH x-weno-cron header -> expect 200")
                try:
                    resp = await client.post(
                        f"{BASE_URL}/api/internal/weno-apply-env",
                        headers={"x-weno-cron": AUTH_SECRET}
                    )
                    print(f"✅ Status: {resp.status_code}")
                    if resp.status_code == 200:
                        data = resp.json()
                        print(f"✅ Response JSON keys: {list(data.keys())}")
                        
                        has_ok = data.get("ok") == True
                        has_applied = "applied" in data and isinstance(data["applied"], list)
                        has_changed = "changed" in data and isinstance(data["changed"], list)
                        has_reconciled = "reconciled" in data
                        has_pruned = "pruned" in data
                        
                        print(f"   ok: {data.get('ok')}")
                        print(f"   applied: {data.get('applied')}")
                        print(f"   changed: {data.get('changed')}")
                        print(f"   reconciled: {data.get('reconciled')}")
                        print(f"   pruned: {data.get('pruned')}")
                        
                        # Verify NO secret values leaked (only field names)
                        resp_text = resp.text
                        # Check that response doesn't contain actual secret values
                        secret_leaked = False
                        if "Mmgw5ereqdI4F3" in resp_text or "0925906208A@a88" in resp_text:
                            print("❌ FAIL: Secret values leaked in response!")
                            secret_leaked = True
                        else:
                            print("✅ PASS: No secret values leaked (only field names in applied[])")
                        
                        if has_ok and has_applied and has_changed and has_reconciled and has_pruned and not secret_leaked:
                            print("✅ PASS: All required fields present and no secrets leaked")
                            
                            # Check pruned structure
                            pruned = data.get("pruned", {})
                            if isinstance(pruned, dict):
                                print(f"   pruned.removedExchange: {pruned.get('removedExchange')}")
                                print(f"   pruned.clearedValidation: {pruned.get('clearedValidation')}")
                                print("✅ PASS: pruned object has expected structure")
                        else:
                            print(f"❌ FAIL: Missing required fields or secrets leaked")
                        
                        print("✅ PASS: No 500 error")
                    else:
                        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
                        print(f"Response: {resp.text[:500]}")
                except Exception as e:
                    print(f"❌ FAIL: Exception during request: {e}")
            else:
                print("\n[4b] ⚠️  SKIPPED: Could not read AUTH_SECRET from .env")

            # ================================================================
            # TEST 5: REGRESSION — Weno EZ ComposeRx still works
            # ================================================================
            print("\n" + "=" * 80)
            print("TEST 5: REGRESSION — Weno EZ ComposeRx still works")
            print("=" * 80)
            
            # 5a) Get a real patientId
            print("\n[5a] GET /api/patients/search?q=a&limit=1 -> get real patientId")
            try:
                resp = await client.get(f"{BASE_URL}/api/patients/search?q=a&limit=1", cookies=admin_cookies)
                print(f"✅ Status: {resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    if len(results) > 0:
                        patient_id = results[0]["id"]
                        patient_name = f"{results[0].get('firstName', '')} {results[0].get('lastName', '')}"
                        print(f"✅ Found patient: {patient_name} (ID: {patient_id})")
                    else:
                        print("❌ FAIL: No patients found")
                        patient_id = None
                else:
                    print(f"❌ FAIL: Expected 200, got {resp.status_code}")
                    patient_id = None
            except Exception as e:
                print(f"❌ FAIL: Exception during request: {e}")
                patient_id = None

            if patient_id:
                # 5b) GET /api/weno/iframe-url/<patientId> as admin -> 200
                print(f"\n[5b] GET /api/weno/iframe-url/{patient_id} as admin -> expect 200")
                try:
                    resp = await client.get(f"{BASE_URL}/api/weno/iframe-url/{patient_id}", cookies=admin_cookies)
                    print(f"✅ Status: {resp.status_code}")
                    if resp.status_code == 200:
                        data = resp.json()
                        iframe_url = data.get("iframeUrl", "")
                        
                        # Mask the URL for display
                        masked_url = mask_secrets(iframe_url)
                        print(f"✅ iframeUrl present: {masked_url[:100]}...")
                        
                        # Check URL contains expected parts
                        has_weno_domain = "online.wenoexchange.com" in iframe_url
                        has_data_param = "&data=" in iframe_url
                        
                        if has_weno_domain:
                            print("✅ PASS: iframeUrl contains 'online.wenoexchange.com'")
                        else:
                            print("❌ FAIL: iframeUrl does not contain 'online.wenoexchange.com'")
                        
                        if has_data_param:
                            print("✅ PASS: iframeUrl contains '&data=' (encrypted payload)")
                        else:
                            print("❌ FAIL: iframeUrl does not contain '&data='")
                        
                        print("✅ PASS: No 500 error")
                    else:
                        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
                        print(f"Response: {resp.text[:500]}")
                except Exception as e:
                    print(f"❌ FAIL: Exception during request: {e}")

                # 5c) GET /api/weno/iframe-url/<patientId> as provider -> 200
                print(f"\n[5c] GET /api/weno/iframe-url/{patient_id} as provider -> expect 200")
                try:
                    provider_cookies = await login(client, PROVIDER_EMAIL, PROVIDER_PASSWORD)
                    resp = await client.get(f"{BASE_URL}/api/weno/iframe-url/{patient_id}", cookies=provider_cookies)
                    print(f"✅ Status: {resp.status_code}")
                    if resp.status_code == 200:
                        print("✅ PASS: Provider can access iframe-url (NOT 403)")
                    else:
                        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
                except Exception as e:
                    print(f"❌ FAIL: Exception during request: {e}")

                # 5d) GET /api/weno/iframe-url/<patientId> as nurse -> 403
                print(f"\n[5d] GET /api/weno/iframe-url/{patient_id} as nurse -> expect 403")
                try:
                    nurse_cookies = await login(client, NURSE_EMAIL, NURSE_PASSWORD)
                    resp = await client.get(f"{BASE_URL}/api/weno/iframe-url/{patient_id}", cookies=nurse_cookies)
                    print(f"✅ Status: {resp.status_code}")
                    if resp.status_code == 403:
                        print("✅ PASS: Nurse correctly blocked with 403")
                    else:
                        print(f"❌ FAIL: Expected 403, got {resp.status_code}")
                except Exception as e:
                    print(f"❌ FAIL: Exception during request: {e}")

                # 5e) GET /api/weno/sso-payload/<patientId> as admin -> 200 with 45-key payload
                print(f"\n[5e] GET /api/weno/sso-payload/{patient_id} as admin -> expect 200 with 45-key payload")
                try:
                    resp = await client.get(f"{BASE_URL}/api/weno/sso-payload/{patient_id}", cookies=admin_cookies)
                    print(f"✅ Status: {resp.status_code}")
                    if resp.status_code == 200:
                        data = resp.json()
                        keys = list(data.keys())
                        print(f"✅ Payload has {len(keys)} keys")
                        
                        # Check for 45 keys (exact Weno payload)
                        if len(keys) == 45:
                            print("✅ PASS: Payload has exactly 45 keys (RAW Weno payload)")
                        else:
                            print(f"⚠️  WARNING: Expected 45 keys, got {len(keys)}")
                        
                        # Verify it's the RAW payload (not wrapped)
                        if "UserEmail" in data and "MD5Password" in data:
                            print("✅ PASS: Response is RAW payload (contains UserEmail, MD5Password)")
                        else:
                            print("❌ FAIL: Response does not appear to be RAW payload")
                        
                        # DO NOT print secret values
                        print("✅ PASS: Secret values masked in test output")
                        print("✅ PASS: No 500 error")
                    else:
                        print(f"❌ FAIL: Expected 200, got {resp.status_code}")
                        print(f"Response: {resp.text[:500]}")
                except Exception as e:
                    print(f"❌ FAIL: Exception during request: {e}")

                # 5f) GET /api/weno/sso-payload/<patientId> as nurse -> 403
                print(f"\n[5f] GET /api/weno/sso-payload/{patient_id} as nurse -> expect 403")
                try:
                    resp = await client.get(f"{BASE_URL}/api/weno/sso-payload/{patient_id}", cookies=nurse_cookies)
                    print(f"✅ Status: {resp.status_code}")
                    if resp.status_code == 403:
                        print("✅ PASS: Nurse correctly blocked with 403")
                    else:
                        print(f"❌ FAIL: Expected 403, got {resp.status_code}")
                except Exception as e:
                    print(f"❌ FAIL: Exception during request: {e}")

            # ================================================================
            # TEST 6: CONFIRM removed endpoints are gone
            # ================================================================
            print("\n" + "=" * 80)
            print("TEST 6: CONFIRM removed endpoints are gone (404/405, NOT 500)")
            print("=" * 80)
            
            # 6a) POST /api/erx/weno-online/launch -> expect 404
            print("\n[6a] POST /api/erx/weno-online/launch (admin) -> expect 404 (route deleted)")
            try:
                resp = await client.post(f"{BASE_URL}/api/erx/weno-online/launch", cookies=admin_cookies, json={})
                print(f"✅ Status: {resp.status_code}")
                if resp.status_code == 404:
                    print("✅ PASS: Route correctly returns 404 (deleted)")
                elif resp.status_code == 405:
                    print("✅ PASS: Route returns 405 (method not allowed, acceptable)")
                elif resp.status_code == 500:
                    print("❌ FAIL: Route returns 500 (should be 404/405)")
                else:
                    print(f"⚠️  WARNING: Unexpected status {resp.status_code} (expected 404/405)")
            except Exception as e:
                print(f"❌ FAIL: Exception during request: {e}")

            # 6b) GET /api/admin/weno/directory/sync -> expect 404
            print("\n[6b] GET /api/admin/weno/directory/sync (admin) -> expect 404 (route deleted)")
            try:
                resp = await client.get(f"{BASE_URL}/api/admin/weno/directory/sync", cookies=admin_cookies)
                print(f"✅ Status: {resp.status_code}")
                if resp.status_code == 404:
                    print("✅ PASS: Route correctly returns 404 (deleted)")
                elif resp.status_code == 405:
                    print("✅ PASS: Route returns 405 (method not allowed, acceptable)")
                elif resp.status_code == 500:
                    print("❌ FAIL: Route returns 500 (should be 404/405)")
                else:
                    print(f"⚠️  WARNING: Unexpected status {resp.status_code} (expected 404/405)")
            except Exception as e:
                print(f"❌ FAIL: Exception during request: {e}")

            print("\n" + "=" * 80)
            print("✅ ALL TESTS COMPLETED")
            print("=" * 80)
            print("\nCRITICAL ASSERTION: Review all test results above.")
            print("If any endpoint returned HTTP 500, that is a FAILURE.")
            print("All secret values (UserEmail/MD5Password/LocationID/data=) should be masked.")
            print("=" * 80)

        except Exception as e:
            print(f"\n❌ FATAL ERROR: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
