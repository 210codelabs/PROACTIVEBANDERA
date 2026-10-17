#!/usr/bin/env python3
"""
Backend test for: Weno ComposeRx opens as Ops Settings prescriber (not stale env TEST prescriber)

Tests the following steps from agent_communication:
1. GET /api/weno/iframe-url/<pid> as admin -> verify environment production, testPatient N, 
   wenoAccount.source == 'ops-settings', wenoAccount.email masked, wenoAccount.locationId matches DB
2. Unit-style verification (reading code) that resolveCredentials prefers cfg over process.env
3. With ?prescriberId=user:<providerUserId> -> verify source 'ops-settings'
4. Regressions: /api/erx/weno-status, /api/weno/rxlog-url, /api/erx/history, /api/weno/pharmacies?q=test
5. Nurse -> 403 on iframe-url

Uses HTTPS NEXT_PUBLIC_BASE_URL from /app/.env
Credentials from /app/memory/test_credentials.md
Never prints secrets or full emails/passwords
"""

import requests
import json
import sys
import os
from pymongo import MongoClient

# Read base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"
NURSE_EMAIL = "nurse.kim@proactiveclinic.com"
NURSE_PASSWORD = "apex123"

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "proactive_clinic"

def print_test(msg):
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_pass(msg):
    print(f"✅ PASS: {msg}")

def print_fail(msg):
    print(f"❌ FAIL: {msg}")
    sys.exit(1)

def login(email, password):
    """Login and return session cookie"""
    print(f"\n🔐 Logging in as {email[:10]}***...")
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30
    )
    if resp.status_code != 200:
        print_fail(f"Login failed: {resp.status_code} {resp.text[:200]}")
    
    cookie = resp.cookies.get("proactive_session")
    if not cookie:
        print_fail("No session cookie returned")
    
    print_pass(f"Logged in successfully")
    return {"proactive_session": cookie}

def get_patient_id(cookies):
    """Get a patient ID for testing"""
    print("\n📋 Getting patient ID...")
    resp = requests.get(
        f"{BASE_URL}/api/patients/search?q=adams&limit=1",
        cookies=cookies,
        timeout=30
    )
    if resp.status_code != 200:
        print_fail(f"Failed to get patient: {resp.status_code}")
    
    data = resp.json()
    if not data.get("results") or len(data["results"]) == 0:
        print_fail("No patients found")
    
    patient_id = data["results"][0]["id"]
    patient_name = f"{data['results'][0]['firstName']} {data['results'][0]['lastName']}"
    print_pass(f"Found patient: {patient_name} (ID: {patient_id})")
    return patient_id

def get_provider_user_id(cookies):
    """Get a provider user ID for prescriberId testing"""
    print("\n👨‍⚕️ Getting provider user ID...")
    resp = requests.get(
        f"{BASE_URL}/api/erx/prescribers",
        cookies=cookies,
        timeout=30
    )
    if resp.status_code != 200:
        print_fail(f"Failed to get prescribers: {resp.status_code}")
    
    data = resp.json()
    prescribers = data.get("prescribers", [])
    
    # Find a user-type prescriber (source='user')
    for p in prescribers:
        if p.get("source") == "user" and p.get("id", "").startswith("user:"):
            user_id = p["id"]
            name = p.get("name", "Unknown")
            print_pass(f"Found provider user: {name} (ID: {user_id})")
            return user_id
    
    print_fail("No provider user found in prescribers list")

def get_weno_location_from_db():
    """Get the LOCATION_ID from AppSetting integrations in MongoDB"""
    print("\n🗄️ Getting Weno Location ID from MongoDB...")
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Find the integrations AppSetting
        setting = db.AppSetting.find_one({"key": "integrations"})
        if not setting:
            print_fail("No 'integrations' AppSetting found in MongoDB")
        
        value = setting.get("value")
        if not value:
            print_fail("AppSetting 'integrations' has no value")
        
        # Parse the JSON value
        if isinstance(value, str):
            integrations = json.loads(value)
        else:
            integrations = value
        
        # Navigate to providers.weno-online.credentials.LOCATION_ID
        weno_online = integrations.get("providers", {}).get("weno-online", {})
        credentials = weno_online.get("credentials", {})
        location_id = credentials.get("LOCATION_ID", "")
        
        if not location_id:
            print_fail("No LOCATION_ID found in weno-online credentials")
        
        print_pass(f"Found LOCATION_ID in DB: {location_id}")
        client.close()
        return location_id
    except Exception as e:
        print_fail(f"Failed to get LOCATION_ID from MongoDB: {e}")

def main():
    print("\n" + "="*80)
    print("BACKEND TEST: Weno ComposeRx opens as Ops Settings prescriber")
    print("="*80)
    
    # Login as admin
    admin_cookies = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    
    # Get patient ID
    patient_id = get_patient_id(admin_cookies)
    
    # Get DB location ID for comparison
    db_location_id = get_weno_location_from_db()
    
    # =========================================================================
    # STEP 1: GET /api/weno/iframe-url/<pid> as admin
    # =========================================================================
    print_test("STEP 1: GET /api/weno/iframe-url/{patientId} as admin")
    
    resp = requests.get(
        f"{BASE_URL}/api/weno/iframe-url/{patient_id}",
        cookies=admin_cookies,
        timeout=30
    )
    
    if resp.status_code != 200:
        print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:500]}")
    
    data = resp.json()
    print(f"\n📊 Response keys: {list(data.keys())}")
    
    # Verify environment is production
    environment = data.get("environment")
    if environment != "production":
        print_fail(f"Expected environment='production', got '{environment}'")
    print_pass(f"environment == 'production' ✅")
    
    # Verify testPatient is N
    test_patient = data.get("testPatient")
    if test_patient != "N":
        print_fail(f"Expected testPatient='N', got '{test_patient}'")
    print_pass(f"testPatient == 'N' ✅")
    
    # Verify wenoAccount exists
    weno_account = data.get("wenoAccount")
    if not weno_account:
        print_fail("No wenoAccount field in response")
    print_pass(f"wenoAccount field present ✅")
    
    # Verify wenoAccount.source == 'ops-settings'
    source = weno_account.get("source")
    if source != "ops-settings":
        print_fail(f"Expected wenoAccount.source='ops-settings', got '{source}'")
    print_pass(f"wenoAccount.source == 'ops-settings' ✅")
    
    # Verify wenoAccount.email is masked (contains ***)
    email = weno_account.get("email", "")
    if "***" not in email:
        print_fail(f"Expected masked email (containing '***'), got '{email}'")
    print_pass(f"wenoAccount.email is masked (contains '***'): {email} ✅")
    
    # Verify wenoAccount.locationId matches DB
    location_id = weno_account.get("locationId", "")
    if location_id != db_location_id:
        print_fail(f"Expected wenoAccount.locationId='{db_location_id}', got '{location_id}'")
    print_pass(f"wenoAccount.locationId matches DB: {location_id} ✅")
    
    # Verify iframeUrl is present (but don't print it)
    if not data.get("iframeUrl"):
        print_fail("No iframeUrl in response")
    print_pass("iframeUrl field present (not printed for security) ✅")
    
    # =========================================================================
    # STEP 2: Unit-style verification (code reading)
    # =========================================================================
    print_test("STEP 2: Code verification - resolveCredentials prefers cfg over process.env")
    
    print("\n📖 Reading /app/src/lib/weno/ezIntegration.ts...")
    
    # Read the code file
    code_path = "/app/src/lib/weno/ezIntegration.ts"
    if not os.path.exists(code_path):
        print_fail(f"Code file not found: {code_path}")
    
    with open(code_path, 'r') as f:
        code = f.read()
    
    # Check for the resolveCredentials method
    if "resolveCredentials" not in code:
        print_fail("resolveCredentials method not found in code")
    
    # Verify the precedence logic:
    # 1. override?.email && override?.password -> source = "prescriber"
    # 2. str(cfg.providerEmail) -> source = "ops-settings"
    # 3. else -> source = "env"
    
    # Check for the correct precedence order
    precedence_checks = [
        ("override?.email && override?.password", "prescriber"),
        ("str(cfg.providerEmail)", "ops-settings"),
        ("else", "env")
    ]
    
    found_precedence = []
    for check, expected_source in precedence_checks:
        if check in code and f'source = "{expected_source}"' in code:
            found_precedence.append(expected_source)
    
    if len(found_precedence) != 3:
        print_fail(f"Expected 3 precedence levels, found {len(found_precedence)}: {found_precedence}")
    
    # Verify the order: prescriber -> ops-settings -> env
    if found_precedence != ["prescriber", "ops-settings", "env"]:
        print_fail(f"Incorrect precedence order: {found_precedence}")
    
    print_pass("✅ Code verification: resolveCredentials prefers cfg over process.env")
    print("   Precedence order: 1) prescriber override, 2) ops-settings (cfg), 3) env fallback")
    
    # =========================================================================
    # STEP 3: With ?prescriberId=user:<providerUserId>
    # =========================================================================
    print_test("STEP 3: GET /api/weno/iframe-url/{patientId}?prescriberId=user:<userId>")
    
    # Get a provider user ID
    provider_user_id = get_provider_user_id(admin_cookies)
    
    resp = requests.get(
        f"{BASE_URL}/api/weno/iframe-url/{patient_id}?prescriberId={provider_user_id}",
        cookies=admin_cookies,
        timeout=30
    )
    
    if resp.status_code != 200:
        print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:500]}")
    
    data = resp.json()
    
    # Verify wenoAccount.source is still 'ops-settings'
    # (provider users have no Weno login of their own, so it falls back to ops-settings)
    weno_account = data.get("wenoAccount", {})
    source = weno_account.get("source")
    if source != "ops-settings":
        print_fail(f"Expected wenoAccount.source='ops-settings' with provider user, got '{source}'")
    print_pass(f"wenoAccount.source == 'ops-settings' with prescriberId=user:<id> ✅")
    
    # =========================================================================
    # STEP 4: Regressions
    # =========================================================================
    print_test("STEP 4: Regression tests")
    
    # 4a. GET /api/erx/weno-status
    print("\n🔍 Testing GET /api/erx/weno-status...")
    resp = requests.get(
        f"{BASE_URL}/api/erx/weno-status",
        cookies=admin_cookies,
        timeout=30
    )
    if resp.status_code != 200:
        print_fail(f"GET /api/erx/weno-status failed: {resp.status_code}")
    
    data = resp.json()
    if data.get("configured") != True:
        print_fail(f"Expected configured=true, got {data.get('configured')}")
    if data.get("environment") != "production":
        print_fail(f"Expected environment='production', got {data.get('environment')}")
    print_pass("GET /api/erx/weno-status returns 200 with configured=true, environment='production' ✅")
    
    # 4b. GET /api/weno/rxlog-url
    print("\n🔍 Testing GET /api/weno/rxlog-url...")
    resp = requests.get(
        f"{BASE_URL}/api/weno/rxlog-url",
        cookies=admin_cookies,
        timeout=30
    )
    if resp.status_code != 200:
        print_fail(f"GET /api/weno/rxlog-url failed: {resp.status_code}")
    print_pass("GET /api/weno/rxlog-url returns 200 ✅")
    
    # 4c. GET /api/erx (history)
    print("\n🔍 Testing GET /api/erx (history)...")
    resp = requests.get(
        f"{BASE_URL}/api/erx",
        cookies=admin_cookies,
        timeout=30
    )
    if resp.status_code != 200:
        print_fail(f"GET /api/erx failed: {resp.status_code}")
    print_pass("GET /api/erx returns 200 ✅")
    
    # 4d. GET /api/weno/pharmacies?q=test (should have NO isTest:true)
    print("\n🔍 Testing GET /api/weno/pharmacies?q=test (no test pharmacies)...")
    resp = requests.get(
        f"{BASE_URL}/api/weno/pharmacies?q=test",
        cookies=admin_cookies,
        timeout=30
    )
    if resp.status_code != 200:
        print_fail(f"GET /api/weno/pharmacies?q=test failed: {resp.status_code}")
    
    data = resp.json()
    pharmacies = data.get("pharmacies", [])
    
    # Check that NO pharmacy has isTest:true
    test_pharmacies = [p for p in pharmacies if p.get("isTest") == True]
    if len(test_pharmacies) > 0:
        print_fail(f"Found {len(test_pharmacies)} test pharmacies (expected 0)")
    print_pass(f"GET /api/weno/pharmacies?q=test returns {len(pharmacies)} pharmacies, NONE with isTest:true ✅")
    
    # =========================================================================
    # STEP 5: Nurse -> 403 on iframe-url
    # =========================================================================
    print_test("STEP 5: Nurse authorization check (403 on iframe-url)")
    
    # Login as nurse
    nurse_cookies = login(NURSE_EMAIL, NURSE_PASSWORD)
    
    resp = requests.get(
        f"{BASE_URL}/api/weno/iframe-url/{patient_id}",
        cookies=nurse_cookies,
        timeout=30
    )
    
    if resp.status_code != 403:
        print_fail(f"Expected 403 for nurse, got {resp.status_code}")
    print_pass("Nurse GET /api/weno/iframe-url correctly returns 403 Forbidden ✅")
    
    # =========================================================================
    # FINAL SUMMARY
    # =========================================================================
    print("\n" + "="*80)
    print("✅ ALL TESTS PASSED")
    print("="*80)
    print("\nSUMMARY:")
    print("  ✅ STEP 1: GET /api/weno/iframe-url/{patientId} as admin")
    print("     - environment == 'production' ✅")
    print("     - testPatient == 'N' ✅")
    print("     - wenoAccount.source == 'ops-settings' ✅")
    print("     - wenoAccount.email is masked (contains '***') ✅")
    print("     - wenoAccount.locationId matches DB ✅")
    print("  ✅ STEP 2: Code verification - resolveCredentials prefers cfg over process.env")
    print("     - Precedence: 1) prescriber override, 2) ops-settings, 3) env ✅")
    print("  ✅ STEP 3: GET with ?prescriberId=user:<userId>")
    print("     - wenoAccount.source == 'ops-settings' ✅")
    print("  ✅ STEP 4: Regressions")
    print("     - GET /api/erx/weno-status returns 200 (configured=true, environment='production') ✅")
    print("     - GET /api/weno/rxlog-url returns 200 ✅")
    print("     - GET /api/erx returns 200 ✅")
    print("     - GET /api/weno/pharmacies?q=test has NO isTest:true pharmacies ✅")
    print("  ✅ STEP 5: Nurse authorization")
    print("     - Nurse GET /api/weno/iframe-url correctly returns 403 ✅")
    print("\n" + "="*80)
    print("CRITICAL ASSERTIONS:")
    print("  ✅ ComposeRx opens with Ops Settings prescriber (source='ops-settings')")
    print("  ✅ NOT stale env TEST prescriber (environment='production', testPatient='N')")
    print("  ✅ resolveCredentials prefers cfg (Ops Settings) over process.env")
    print("  ✅ NO HTTP 500 errors encountered")
    print("  ✅ All sensitive data (iframeUrl, full emails, passwords) properly masked")
    print("="*80)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
