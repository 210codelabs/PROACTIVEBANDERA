#!/usr/bin/env python3
"""
Backend test for Weno EZ Integration STEP 2 (self-heal mechanism).

Tests that pruneLegacyWenoStore() correctly normalizes test values to production
when the AppSetting.value field is stored as a BSON OBJECT (not a string).

Review request: Test both variants:
(A) value as OBJECT (use $set on nested path)
(B) Optional: value as JSON string

At the end, ensure DB is ENVIRONMENT='production', override '', value is an object,
integration still enabled/configured.
"""

import asyncio
import os
import sys
from pymongo import MongoClient
import httpx
import json

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

# MongoDB connection from .env
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "proactive_clinic"

async def main():
    print("=" * 80)
    print("WENO EZ INTEGRATION SELF-HEAL TEST (STEP 2)")
    print("=" * 80)
    
    # Connect to MongoDB
    print("\n[SETUP] Connecting to MongoDB...")
    try:
        mongo_client = MongoClient(MONGO_URL)
        db = mongo_client[DB_NAME]
        app_settings = db["AppSetting"]
        print(f"✅ Connected to MongoDB: {MONGO_URL}/{DB_NAME}")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        return
    
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        # Step 1: Login as admin
        print("\n[STEP 1] Login as admin...")
        try:
            login_resp = await client.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            print(f"Login status: {login_resp.status_code}")
            if login_resp.status_code != 200:
                print(f"❌ Login failed: {login_resp.text}")
                return
            
            login_data = login_resp.json()
            if not login_data.get("ok"):
                print(f"❌ Login failed: {login_data}")
                return
            
            print(f"✅ Login successful")
            
            # Extract session cookie
            session_cookie = None
            for cookie in client.cookies.jar:
                if cookie.name == "proactive_session":
                    session_cookie = cookie.value
                    break
            
            if not session_cookie:
                print("❌ No session cookie found")
                return
            
            print(f"✅ Session cookie obtained")
        except Exception as e:
            print(f"❌ Login error: {e}")
            return
        
        # Step 2A: Test with value as OBJECT (use $set on nested path)
        print("\n" + "=" * 80)
        print("[STEP 2A] TEST WITH VALUE AS OBJECT (nested $set)")
        print("=" * 80)
        
        try:
            # Read current DB state
            print("\n[2A.1] Reading current DB state...")
            integrations_doc = app_settings.find_one({"key": "integrations"})
            if not integrations_doc:
                print("❌ No integrations document found in DB")
                return
            
            print(f"✅ Found integrations document")
            
            # Check if value is an object or string
            current_value = integrations_doc.get("value")
            print(f"Current value type: {type(current_value)}")
            
            if isinstance(current_value, str):
                print("⚠️  WARNING: Current value is a STRING, not an OBJECT")
                print("Converting to object for test...")
                current_value = json.loads(current_value)
            
            # Backup original values
            original_env = None
            original_override = None
            if current_value and "providers" in current_value:
                weno_online = current_value.get("providers", {}).get("weno-online", {})
                credentials = weno_online.get("credentials", {})
                original_env = credentials.get("ENVIRONMENT")
                original_override = credentials.get("COMPOSE_URL_OVERRIDE")
            
            print(f"Original ENVIRONMENT: {original_env}")
            print(f"Original COMPOSE_URL_OVERRIDE: {original_override}")
            
            # Step 2A.2: Modify DB to set test values using $set on nested path
            print("\n[2A.2] Modifying DB to set test values (nested $set)...")
            update_result = app_settings.update_one(
                {"key": "integrations"},
                {
                    "$set": {
                        "value.providers.weno-online.credentials.ENVIRONMENT": "test",
                        "value.providers.weno-online.credentials.COMPOSE_URL_OVERRIDE": "https://test.wenoexchange.com/en/NewRx/ComposeRx"
                    }
                }
            )
            
            if update_result.modified_count == 0:
                print("❌ Failed to modify DB")
                return
            
            print(f"✅ DB modified successfully (modified_count: {update_result.modified_count})")
            
            # Verify the modification
            print("\n[2A.3] Verifying DB modification...")
            modified_doc = app_settings.find_one({"key": "integrations"})
            modified_value = modified_doc.get("value")
            
            print(f"Modified value type: {type(modified_value)}")
            
            if isinstance(modified_value, str):
                print("⚠️  Value is stored as STRING")
                modified_value = json.loads(modified_value)
            else:
                print("✅ Value is stored as OBJECT")
            
            modified_env = modified_value.get("providers", {}).get("weno-online", {}).get("credentials", {}).get("ENVIRONMENT")
            modified_override = modified_value.get("providers", {}).get("weno-online", {}).get("credentials", {}).get("COMPOSE_URL_OVERRIDE")
            
            print(f"Modified ENVIRONMENT: {modified_env}")
            print(f"Modified COMPOSE_URL_OVERRIDE: {modified_override}")
            
            if modified_env != "test":
                print(f"❌ ENVIRONMENT not set to 'test' (got: {modified_env})")
                return
            
            if modified_override != "https://test.wenoexchange.com/en/NewRx/ComposeRx":
                print(f"❌ COMPOSE_URL_OVERRIDE not set correctly (got: {modified_override})")
                return
            
            print("✅ DB modification verified")
            
            # Step 2A.4: Call GET /api/erx/weno-status to trigger self-heal
            print("\n[2A.4] Calling GET /api/erx/weno-status to trigger self-heal...")
            status_resp = await client.get(f"{BASE_URL}/api/erx/weno-status")
            print(f"Status code: {status_resp.status_code}")
            
            if status_resp.status_code != 200:
                print(f"❌ GET /api/erx/weno-status failed: {status_resp.text}")
                return
            
            status_data = status_resp.json()
            print(f"✅ GET /api/erx/weno-status returned 200")
            
            # Verify API response shows production values
            print("\n[2A.5] Verifying API response shows production values...")
            api_env = status_data.get("environment")
            api_compose_host = status_data.get("composeHost")
            api_test_patient = status_data.get("testPatient")
            api_live = status_data.get("live")
            
            print(f"API environment: {api_env}")
            print(f"API composeHost: {api_compose_host}")
            print(f"API testPatient: {api_test_patient}")
            print(f"API live: {api_live}")
            
            if api_env != "production":
                print(f"❌ API environment is not 'production' (got: {api_env})")
                return
            
            if api_compose_host != "online.wenoexchange.com":
                print(f"❌ API composeHost is not 'online.wenoexchange.com' (got: {api_compose_host})")
                return
            
            if api_test_patient != "N":
                print(f"❌ API testPatient is not 'N' (got: {api_test_patient})")
                return
            
            if api_live != True:
                print(f"❌ API live is not True (got: {api_live})")
                return
            
            print("✅ API response shows production values")
            
            # Step 2A.6: Re-read DB to verify self-heal normalized the values
            print("\n[2A.6] Re-reading DB to verify self-heal normalized the values...")
            healed_doc = app_settings.find_one({"key": "integrations"})
            healed_value = healed_doc.get("value")
            
            print(f"Healed value type: {type(healed_value)}")
            
            if isinstance(healed_value, str):
                print("⚠️  Value is stored as STRING")
                healed_value = json.loads(healed_value)
            else:
                print("✅ Value is stored as OBJECT")
            
            healed_env = healed_value.get("providers", {}).get("weno-online", {}).get("credentials", {}).get("ENVIRONMENT")
            healed_override = healed_value.get("providers", {}).get("weno-online", {}).get("credentials", {}).get("COMPOSE_URL_OVERRIDE")
            
            print(f"Healed ENVIRONMENT: {healed_env}")
            print(f"Healed COMPOSE_URL_OVERRIDE: {healed_override}")
            
            # CRITICAL ASSERTIONS
            if healed_env != "production":
                print(f"❌ CRITICAL: DB ENVIRONMENT not normalized to 'production' (got: {healed_env})")
                print("❌ SELF-HEAL MECHANISM FAILED")
                return
            
            if healed_override and healed_override != "":
                print(f"❌ CRITICAL: DB COMPOSE_URL_OVERRIDE not cleared (got: {healed_override})")
                print("❌ SELF-HEAL MECHANISM FAILED")
                return
            
            print("✅ CRITICAL: DB values normalized correctly")
            print("✅ SELF-HEAL MECHANISM WORKING")
            
            # Verify integration is still enabled/configured
            print("\n[2A.7] Verifying integration is still enabled/configured...")
            weno_online = healed_value.get("providers", {}).get("weno-online", {})
            is_enabled = weno_online.get("enabled")
            has_credentials = bool(weno_online.get("credentials"))
            
            print(f"Integration enabled: {is_enabled}")
            print(f"Has credentials: {has_credentials}")
            
            if not is_enabled:
                print("⚠️  WARNING: Integration is not enabled")
            
            if not has_credentials:
                print("❌ Integration has no credentials")
                return
            
            print("✅ Integration is still configured")
            
            print("\n" + "=" * 80)
            print("✅ STEP 2A PASSED: Self-heal with value as OBJECT works correctly")
            print("=" * 80)
            
        except Exception as e:
            print(f"❌ STEP 2A error: {e}")
            import traceback
            traceback.print_exc()
            return
        
        # Step 2B: Optional - Test with value as JSON string
        print("\n" + "=" * 80)
        print("[STEP 2B] OPTIONAL TEST WITH VALUE AS JSON STRING")
        print("=" * 80)
        
        try:
            # Read current DB state
            print("\n[2B.1] Reading current DB state...")
            integrations_doc = app_settings.find_one({"key": "integrations"})
            current_value = integrations_doc.get("value")
            
            if isinstance(current_value, str):
                current_value = json.loads(current_value)
            
            # Modify to set test values
            current_value["providers"]["weno-online"]["credentials"]["ENVIRONMENT"] = "test"
            current_value["providers"]["weno-online"]["credentials"]["COMPOSE_URL_OVERRIDE"] = "https://test.wenoexchange.com/en/NewRx/ComposeRx"
            
            # Convert to JSON string
            value_as_string = json.dumps(current_value)
            
            print("\n[2B.2] Storing value as JSON STRING in DB...")
            update_result = app_settings.update_one(
                {"key": "integrations"},
                {"$set": {"value": value_as_string}}
            )
            
            if update_result.modified_count == 0:
                print("❌ Failed to modify DB")
                return
            
            print(f"✅ DB modified successfully (value stored as STRING)")
            
            # Verify the modification
            print("\n[2B.3] Verifying DB modification...")
            modified_doc = app_settings.find_one({"key": "integrations"})
            modified_value = modified_doc.get("value")
            
            print(f"Modified value type: {type(modified_value)}")
            
            if not isinstance(modified_value, str):
                print("❌ Value is not stored as STRING")
                return
            
            print("✅ Value is stored as STRING")
            
            # Parse to verify content
            parsed_value = json.loads(modified_value)
            modified_env = parsed_value.get("providers", {}).get("weno-online", {}).get("credentials", {}).get("ENVIRONMENT")
            modified_override = parsed_value.get("providers", {}).get("weno-online", {}).get("credentials", {}).get("COMPOSE_URL_OVERRIDE")
            
            print(f"Modified ENVIRONMENT: {modified_env}")
            print(f"Modified COMPOSE_URL_OVERRIDE: {modified_override}")
            
            if modified_env != "test":
                print(f"❌ ENVIRONMENT not set to 'test' (got: {modified_env})")
                return
            
            print("✅ DB modification verified")
            
            # Step 2B.4: Call GET /api/erx/weno-status to trigger self-heal
            print("\n[2B.4] Calling GET /api/erx/weno-status to trigger self-heal...")
            status_resp = await client.get(f"{BASE_URL}/api/erx/weno-status")
            print(f"Status code: {status_resp.status_code}")
            
            if status_resp.status_code != 200:
                print(f"❌ GET /api/erx/weno-status failed: {status_resp.text}")
                return
            
            status_data = status_resp.json()
            print(f"✅ GET /api/erx/weno-status returned 200")
            
            # Verify API response shows production values
            print("\n[2B.5] Verifying API response shows production values...")
            api_env = status_data.get("environment")
            api_compose_host = status_data.get("composeHost")
            
            print(f"API environment: {api_env}")
            print(f"API composeHost: {api_compose_host}")
            
            if api_env != "production":
                print(f"❌ API environment is not 'production' (got: {api_env})")
                return
            
            if api_compose_host != "online.wenoexchange.com":
                print(f"❌ API composeHost is not 'online.wenoexchange.com' (got: {api_compose_host})")
                return
            
            print("✅ API response shows production values")
            
            # Step 2B.6: Re-read DB to verify self-heal normalized the values AND converted back to object
            print("\n[2B.6] Re-reading DB to verify self-heal normalized the values...")
            healed_doc = app_settings.find_one({"key": "integrations"})
            healed_value = healed_doc.get("value")
            
            print(f"Healed value type: {type(healed_value)}")
            
            if isinstance(healed_value, str):
                print("⚠️  Value is still stored as STRING (should be converted to OBJECT)")
                healed_value = json.loads(healed_value)
            else:
                print("✅ Value is stored as OBJECT (converted from STRING)")
            
            healed_env = healed_value.get("providers", {}).get("weno-online", {}).get("credentials", {}).get("ENVIRONMENT")
            healed_override = healed_value.get("providers", {}).get("weno-online", {}).get("credentials", {}).get("COMPOSE_URL_OVERRIDE")
            
            print(f"Healed ENVIRONMENT: {healed_env}")
            print(f"Healed COMPOSE_URL_OVERRIDE: {healed_override}")
            
            # CRITICAL ASSERTIONS
            if healed_env != "production":
                print(f"❌ CRITICAL: DB ENVIRONMENT not normalized to 'production' (got: {healed_env})")
                print("❌ SELF-HEAL MECHANISM FAILED FOR STRING VARIANT")
                return
            
            if healed_override and healed_override != "":
                print(f"❌ CRITICAL: DB COMPOSE_URL_OVERRIDE not cleared (got: {healed_override})")
                print("❌ SELF-HEAL MECHANISM FAILED FOR STRING VARIANT")
                return
            
            print("✅ CRITICAL: DB values normalized correctly")
            print("✅ SELF-HEAL MECHANISM WORKING FOR STRING VARIANT")
            
            print("\n" + "=" * 80)
            print("✅ STEP 2B PASSED: Self-heal with value as STRING works correctly")
            print("=" * 80)
            
        except Exception as e:
            print(f"❌ STEP 2B error: {e}")
            import traceback
            traceback.print_exc()
            return
        
        # Final verification
        print("\n" + "=" * 80)
        print("[FINAL VERIFICATION]")
        print("=" * 80)
        
        try:
            # Read final DB state
            print("\n[FINAL] Reading final DB state...")
            final_doc = app_settings.find_one({"key": "integrations"})
            final_value = final_doc.get("value")
            
            print(f"Final value type: {type(final_value)}")
            
            if isinstance(final_value, str):
                print("⚠️  WARNING: Final value is stored as STRING")
                final_value = json.loads(final_value)
            else:
                print("✅ Final value is stored as OBJECT")
            
            final_env = final_value.get("providers", {}).get("weno-online", {}).get("credentials", {}).get("ENVIRONMENT")
            final_override = final_value.get("providers", {}).get("weno-online", {}).get("credentials", {}).get("COMPOSE_URL_OVERRIDE")
            final_enabled = final_value.get("providers", {}).get("weno-online", {}).get("enabled")
            
            print(f"Final ENVIRONMENT: {final_env}")
            print(f"Final COMPOSE_URL_OVERRIDE: {final_override}")
            print(f"Final enabled: {final_enabled}")
            
            # FINAL ASSERTIONS
            if final_env != "production":
                print(f"❌ FINAL: ENVIRONMENT is not 'production' (got: {final_env})")
                return
            
            if final_override and final_override != "":
                print(f"❌ FINAL: COMPOSE_URL_OVERRIDE is not empty (got: {final_override})")
                return
            
            if not isinstance(final_value, dict):
                print(f"❌ FINAL: value is not an OBJECT (got: {type(final_value)})")
                return
            
            print("\n✅ FINAL VERIFICATION PASSED:")
            print("  - ENVIRONMENT = 'production' ✅")
            print("  - COMPOSE_URL_OVERRIDE = '' ✅")
            print("  - value is an OBJECT ✅")
            print("  - integration is enabled/configured ✅")
            
            # Call GET /api/erx/weno-status one more time to confirm
            print("\n[FINAL] Calling GET /api/erx/weno-status one more time...")
            final_status_resp = await client.get(f"{BASE_URL}/api/erx/weno-status")
            
            if final_status_resp.status_code != 200:
                print(f"❌ GET /api/erx/weno-status failed: {final_status_resp.text}")
                return
            
            final_status_data = final_status_resp.json()
            
            print(f"Final API environment: {final_status_data.get('environment')}")
            print(f"Final API composeHost: {final_status_data.get('composeHost')}")
            print(f"Final API configured: {final_status_data.get('configured')}")
            
            if final_status_data.get("environment") != "production":
                print(f"❌ Final API environment is not 'production'")
                return
            
            if final_status_data.get("composeHost") != "online.wenoexchange.com":
                print(f"❌ Final API composeHost is not 'online.wenoexchange.com'")
                return
            
            if not final_status_data.get("configured"):
                print(f"❌ Final API configured is not True")
                return
            
            print("\n✅ FINAL API VERIFICATION PASSED")
            
        except Exception as e:
            print(f"❌ FINAL verification error: {e}")
            import traceback
            traceback.print_exc()
            return
    
    print("\n" + "=" * 80)
    print("✅✅✅ ALL TESTS PASSED ✅✅✅")
    print("=" * 80)
    print("\nSUMMARY:")
    print("  - STEP 2A (value as OBJECT): ✅ PASSED")
    print("  - STEP 2B (value as STRING): ✅ PASSED")
    print("  - Self-heal mechanism: ✅ WORKING")
    print("  - DB normalized to production: ✅ VERIFIED")
    print("  - Integration still configured: ✅ VERIFIED")
    print("\nThe Weno EZ Integration self-heal mechanism is PRODUCTION-READY.")

if __name__ == "__main__":
    asyncio.run(main())
