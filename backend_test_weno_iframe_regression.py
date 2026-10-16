#!/usr/bin/env python3
"""
Regression test for GET /api/weno/iframe-url after self-heal.
Verify that the iframe-url endpoint still works correctly.
"""

import asyncio
import httpx

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

async def main():
    print("=" * 80)
    print("WENO EZ IFRAME-URL REGRESSION TEST")
    print("=" * 80)
    
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        # Login as admin
        print("\n[STEP 1] Login as admin...")
        try:
            login_resp = await client.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            
            if login_resp.status_code != 200:
                print(f"❌ Login failed: {login_resp.text}")
                return
            
            print(f"✅ Login successful")
        except Exception as e:
            print(f"❌ Login error: {e}")
            return
        
        # Get a patient ID
        print("\n[STEP 2] Getting patient ID...")
        try:
            patients_resp = await client.get(f"{BASE_URL}/api/patients/search?q=adams&limit=1")
            
            if patients_resp.status_code != 200:
                print(f"❌ Failed to get patients: {patients_resp.text}")
                return
            
            patients_data = patients_resp.json()
            
            if not patients_data.get("results") or len(patients_data["results"]) == 0:
                print("❌ No patients found")
                return
            
            patient_id = patients_data["results"][0]["id"]
            patient_name = f"{patients_data['results'][0]['firstName']} {patients_data['results'][0]['lastName']}"
            
            print(f"✅ Found patient: {patient_name} (ID: {patient_id})")
        except Exception as e:
            print(f"❌ Error getting patient: {e}")
            return
        
        # Test GET /api/weno/iframe-url
        print("\n[STEP 3] Testing GET /api/weno/iframe-url...")
        try:
            iframe_resp = await client.get(f"{BASE_URL}/api/weno/iframe-url/{patient_id}")
            
            if iframe_resp.status_code != 200:
                print(f"❌ GET /api/weno/iframe-url failed: {iframe_resp.text}")
                return
            
            iframe_data = iframe_resp.json()
            
            print(f"✅ GET /api/weno/iframe-url returned 200")
            
            # Verify response fields
            print("\n[STEP 4] Verifying response fields...")
            
            iframe_url = iframe_data.get("iframeUrl")
            environment = iframe_data.get("environment")
            compose_host = iframe_data.get("composeHost")
            test_patient = iframe_data.get("testPatient")
            live = iframe_data.get("live")
            
            print(f"environment: {environment}")
            print(f"composeHost: {compose_host}")
            print(f"testPatient: {test_patient}")
            print(f"live: {live}")
            print(f"iframeUrl present: {bool(iframe_url)}")
            
            if iframe_url:
                # Mask the data parameter
                if "&data=" in iframe_url:
                    parts = iframe_url.split("&data=")
                    masked_url = parts[0] + "&data=***MASKED***"
                    print(f"iframeUrl (masked): {masked_url}")
                else:
                    print(f"iframeUrl: {iframe_url}")
            
            # CRITICAL ASSERTIONS
            if environment != "production":
                print(f"❌ CRITICAL: environment is not 'production' (got: {environment})")
                return
            
            if compose_host != "online.wenoexchange.com":
                print(f"❌ CRITICAL: composeHost is not 'online.wenoexchange.com' (got: {compose_host})")
                return
            
            if test_patient != "N":
                print(f"❌ CRITICAL: testPatient is not 'N' (got: {test_patient})")
                return
            
            if live != True:
                print(f"❌ CRITICAL: live is not True (got: {live})")
                return
            
            if not iframe_url:
                print(f"❌ CRITICAL: iframeUrl is missing")
                return
            
            if "online.wenoexchange.com" not in iframe_url:
                print(f"❌ CRITICAL: iframeUrl does not contain 'online.wenoexchange.com'")
                return
            
            if "/en/NewRx/ComposeRx" not in iframe_url:
                print(f"❌ CRITICAL: iframeUrl does not contain '/en/NewRx/ComposeRx'")
                return
            
            print("\n✅ ALL CRITICAL ASSERTIONS PASSED:")
            print("  - environment = 'production' ✅")
            print("  - composeHost = 'online.wenoexchange.com' ✅")
            print("  - testPatient = 'N' ✅")
            print("  - live = True ✅")
            print("  - iframeUrl present and valid ✅")
            
        except Exception as e:
            print(f"❌ Error testing iframe-url: {e}")
            import traceback
            traceback.print_exc()
            return
    
    print("\n" + "=" * 80)
    print("✅ REGRESSION TEST PASSED")
    print("=" * 80)
    print("\nGET /api/weno/iframe-url still works correctly after self-heal.")

if __name__ == "__main__":
    asyncio.run(main())
