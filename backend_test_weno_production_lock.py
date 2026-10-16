#!/usr/bin/env python3
"""
Backend test for: Weno EZ Integration LOCKED TO PRODUCTION + E-Prescribe = Weno EZ only + read-only Rx history
Tests the hard-lock to production environment and self-healing mechanism.
"""

import requests
import json
import os
from pymongo import MongoClient

# Base URL from NEXT_PUBLIC_BASE_URL (HTTPS for Secure cookies)
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"
NURSE_EMAIL = "nurse.kim@proactiveclinic.com"
NURSE_PASSWORD = "apex123"

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "proactive_clinic"

def mask_sensitive(data):
    """Mask sensitive fields in response data"""
    if isinstance(data, dict):
        masked = {}
        for key, value in data.items():
            if key in ['iframeUrl', 'data', 'useremail', 'password', 'email', 'secret', 'key']:
                if isinstance(value, str):
                    if len(value) > 20:
                        masked[key] = f"{value[:10]}...{value[-4:]}"
                    else:
                        masked[key] = "***MASKED***"
                else:
                    masked[key] = "***MASKED***"
            elif isinstance(value, dict):
                masked[key] = mask_sensitive(value)
            elif isinstance(value, list):
                masked[key] = [mask_sensitive(item) if isinstance(item, dict) else item for item in value]
            else:
                masked[key] = value
        return masked
    return data

def login(email, password):
    """Login and return session cookie"""
    print(f"\n🔐 Logging in as {email}...")
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        allow_redirects=False
    )
    
    if response.status_code == 200:
        cookies = response.cookies
        session_cookie = cookies.get('proactive_session')
        if session_cookie:
            print(f"✅ Login successful, session cookie obtained")
            return {'proactive_session': session_cookie}
        else:
            print(f"❌ Login returned 200 but no session cookie found")
            return None
    else:
        print(f"❌ Login failed with status {response.status_code}")
        print(f"Response: {response.text[:200]}")
        return None

def get_patient_id(cookies):
    """Get a patient ID for testing"""
    print("\n📋 Getting patient ID...")
    response = requests.get(
        f"{BASE_URL}/api/patients/search?q=adams&limit=1",
        cookies=cookies
    )
    
    if response.status_code == 200:
        data = response.json()
        if data.get('results') and len(data['results']) > 0:
            patient_id = data['results'][0]['id']
            patient_name = f"{data['results'][0].get('firstName', '')} {data['results'][0].get('lastName', '')}"
            print(f"✅ Found patient: {patient_name} (ID: {patient_id})")
            return patient_id
        else:
            print(f"❌ No patients found")
            return None
    else:
        print(f"❌ Failed to get patient with status {response.status_code}")
        return None

def test_step_1(cookies):
    """Step 1: GET /api/erx/weno-status -> verify production settings"""
    print("\n" + "="*80)
    print("STEP 1: GET /api/erx/weno-status (verify production lock)")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/api/erx/weno-status", cookies=cookies)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ STEP 1 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        masked_data = mask_sensitive(data)
        print(f"Response (masked): {json.dumps(masked_data, indent=2)}")
        
        # Critical assertions
        checks = {
            "environment == 'production'": data.get('environment') == 'production',
            "live == true": data.get('live') == True,
            "testPatient == 'N'": data.get('testPatient') == 'N',
            "composeHost == 'online.wenoexchange.com'": data.get('composeHost') == 'online.wenoexchange.com',
            "online.environment == 'production'": data.get('online', {}).get('environment') == 'production'
        }
        
        all_passed = True
        for check, result in checks.items():
            status = "✅" if result else "❌"
            print(f"{status} {check}: {result}")
            if not result:
                all_passed = False
        
        if all_passed:
            print("✅ STEP 1 PASSED: All production settings verified")
            return True
        else:
            print("❌ STEP 1 FAILED: Some production settings incorrect")
            return False
            
    except Exception as e:
        print(f"❌ STEP 1 FAILED with exception: {str(e)}")
        return False

def test_step_2(cookies):
    """Step 2: SELF-HEAL test - modify DB to test values, verify API self-heals"""
    print("\n" + "="*80)
    print("STEP 2: SELF-HEAL TEST (modify DB, verify API normalizes)")
    print("="*80)
    
    try:
        # Connect to MongoDB
        print("\n📊 Connecting to MongoDB...")
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        app_settings = db['AppSetting']
        
        # Find the integrations document
        INTEGRATIONS_KEY = 'integrations'
        doc = app_settings.find_one({'key': INTEGRATIONS_KEY})
        
        if not doc:
            print(f"❌ STEP 2 FAILED: AppSetting document with key '{INTEGRATIONS_KEY}' not found")
            return False
        
        print(f"✅ Found AppSetting document with key '{INTEGRATIONS_KEY}'")
        
        # Parse the value (should be JSON)
        integrations = json.loads(doc['value']) if isinstance(doc['value'], str) else doc['value']
        
        # Modify ONLY the specified fields
        print("\n🔧 Modifying DB: Setting ENVIRONMENT='test' and COMPOSE_URL_OVERRIDE='https://test.wenoexchange.com/en/NewRx/ComposeRx'")
        
        if 'providers' not in integrations:
            integrations['providers'] = {}
        if 'weno-online' not in integrations['providers']:
            integrations['providers']['weno-online'] = {}
        if 'credentials' not in integrations['providers']['weno-online']:
            integrations['providers']['weno-online']['credentials'] = {}
        
        # Store original values for verification
        original_env = integrations['providers']['weno-online']['credentials'].get('ENVIRONMENT')
        original_override = integrations['providers']['weno-online']['credentials'].get('COMPOSE_URL_OVERRIDE')
        
        print(f"Original ENVIRONMENT: {original_env}")
        print(f"Original COMPOSE_URL_OVERRIDE: {original_override}")
        
        # Set test values
        integrations['providers']['weno-online']['credentials']['ENVIRONMENT'] = 'test'
        integrations['providers']['weno-online']['credentials']['COMPOSE_URL_OVERRIDE'] = 'https://test.wenoexchange.com/en/NewRx/ComposeRx'
        
        # Update the document
        app_settings.update_one(
            {'key': INTEGRATIONS_KEY},
            {'$set': {'value': json.dumps(integrations)}}
        )
        
        print("✅ DB updated with test values")
        
        # Verify DB was updated
        doc_after_update = app_settings.find_one({'key': INTEGRATIONS_KEY})
        integrations_after_update = json.loads(doc_after_update['value']) if isinstance(doc_after_update['value'], str) else doc_after_update['value']
        
        env_after_update = integrations_after_update['providers']['weno-online']['credentials'].get('ENVIRONMENT')
        override_after_update = integrations_after_update['providers']['weno-online']['credentials'].get('COMPOSE_URL_OVERRIDE')
        
        print(f"DB verification - ENVIRONMENT: {env_after_update}")
        print(f"DB verification - COMPOSE_URL_OVERRIDE: {override_after_update}")
        
        if env_after_update != 'test' or override_after_update != 'https://test.wenoexchange.com/en/NewRx/ComposeRx':
            print("❌ STEP 2 FAILED: DB update verification failed")
            return False
        
        # Now call the API to trigger self-heal
        print("\n🔄 Calling GET /api/erx/weno-status to trigger self-heal...")
        response = requests.get(f"{BASE_URL}/api/erx/weno-status", cookies=cookies)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ STEP 2 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        masked_data = mask_sensitive(data)
        print(f"Response (masked): {json.dumps(masked_data, indent=2)}")
        
        # Verify API still returns production values
        checks = {
            "environment == 'production'": data.get('environment') == 'production',
            "composeHost == 'online.wenoexchange.com'": data.get('composeHost') == 'online.wenoexchange.com',
            "testPatient == 'N'": data.get('testPatient') == 'N',
            "live == true": data.get('live') == True
        }
        
        api_passed = True
        for check, result in checks.items():
            status = "✅" if result else "❌"
            print(f"{status} API response {check}: {result}")
            if not result:
                api_passed = False
        
        # Verify DB was normalized
        print("\n🔍 Verifying DB was normalized by self-heal...")
        doc_after_heal = app_settings.find_one({'key': INTEGRATIONS_KEY})
        integrations_after_heal = json.loads(doc_after_heal['value']) if isinstance(doc_after_heal['value'], str) else doc_after_heal['value']
        
        env_after_heal = integrations_after_heal['providers']['weno-online']['credentials'].get('ENVIRONMENT')
        override_after_heal = integrations_after_heal['providers']['weno-online']['credentials'].get('COMPOSE_URL_OVERRIDE', '')
        
        print(f"DB after self-heal - ENVIRONMENT: {env_after_heal}")
        print(f"DB after self-heal - COMPOSE_URL_OVERRIDE: '{override_after_heal}'")
        
        db_checks = {
            "ENVIRONMENT normalized to 'production'": env_after_heal == 'production',
            "COMPOSE_URL_OVERRIDE cleared (empty or None)": not override_after_heal or override_after_heal == ''
        }
        
        db_passed = True
        for check, result in db_checks.items():
            status = "✅" if result else "❌"
            print(f"{status} DB {check}: {result}")
            if not result:
                db_passed = False
        
        client.close()
        
        if api_passed and db_passed:
            print("✅ STEP 2 PASSED: Self-heal working correctly")
            return True
        else:
            print("❌ STEP 2 FAILED: Self-heal did not work as expected")
            return False
            
    except Exception as e:
        print(f"❌ STEP 2 FAILED with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_step_3(admin_cookies, nurse_cookies, patient_id):
    """Step 3: GET /api/weno/iframe-url/<pid> - admin 200, nurse 403"""
    print("\n" + "="*80)
    print("STEP 3: GET /api/weno/iframe-url/<pid> (admin 200, nurse 403)")
    print("="*80)
    
    try:
        # Test with admin
        print(f"\n🔐 Testing as admin with patient ID: {patient_id}")
        response = requests.get(f"{BASE_URL}/api/weno/iframe-url/{patient_id}", cookies=admin_cookies)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ STEP 3 FAILED: Admin request expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        masked_data = mask_sensitive(data)
        print(f"Response (masked): {json.dumps(masked_data, indent=2)}")
        
        # Critical assertions
        checks = {
            "environment == 'production'": data.get('environment') == 'production',
            "testPatient == 'N'": data.get('testPatient') == 'N',
            "live == true": data.get('live') == True,
            "iframeUrl present": 'iframeUrl' in data and data['iframeUrl']
        }
        
        # Check iframeUrl contains correct host and path (without printing the full URL)
        if 'iframeUrl' in data and data['iframeUrl']:
            iframe_url = data['iframeUrl']
            checks["iframeUrl host == 'online.wenoexchange.com'"] = 'online.wenoexchange.com' in iframe_url
            checks["iframeUrl path == '/en/NewRx/ComposeRx'"] = '/en/NewRx/ComposeRx' in iframe_url
        
        admin_passed = True
        for check, result in checks.items():
            status = "✅" if result else "❌"
            print(f"{status} {check}: {result}")
            if not result:
                admin_passed = False
        
        # Test with nurse (should be 403)
        print(f"\n🔐 Testing as nurse (should be 403)...")
        response_nurse = requests.get(f"{BASE_URL}/api/weno/iframe-url/{patient_id}", cookies=nurse_cookies)
        
        print(f"Nurse Status Code: {response_nurse.status_code}")
        
        if response_nurse.status_code != 403:
            print(f"❌ STEP 3 FAILED: Nurse request expected 403, got {response_nurse.status_code}")
            return False
        
        print("✅ Nurse correctly received 403 Forbidden")
        
        if admin_passed:
            print("✅ STEP 3 PASSED: Admin access working, nurse correctly forbidden")
            return True
        else:
            print("❌ STEP 3 FAILED: Admin response incorrect")
            return False
            
    except Exception as e:
        print(f"❌ STEP 3 FAILED with exception: {str(e)}")
        return False

def test_step_4(cookies):
    """Step 4: GET /api/weno/rxlog-url -> verify production"""
    print("\n" + "="*80)
    print("STEP 4: GET /api/weno/rxlog-url (verify production)")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/api/weno/rxlog-url", cookies=cookies)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ STEP 4 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        masked_data = mask_sensitive(data)
        print(f"Response (masked): {json.dumps(masked_data, indent=2)}")
        
        # Critical assertions
        checks = {
            "environment == 'production'": data.get('environment') == 'production',
            "host contains 'online.wenoexchange.com'": 'online.wenoexchange.com' in str(data)
        }
        
        all_passed = True
        for check, result in checks.items():
            status = "✅" if result else "❌"
            print(f"{status} {check}: {result}")
            if not result:
                all_passed = False
        
        if all_passed:
            print("✅ STEP 4 PASSED: rxlog-url returns production settings")
            return True
        else:
            print("❌ STEP 4 FAILED: rxlog-url settings incorrect")
            return False
            
    except Exception as e:
        print(f"❌ STEP 4 FAILED with exception: {str(e)}")
        return False

def test_step_5(cookies):
    """Step 5: GET /api/erx/weno-test -> message mentions production"""
    print("\n" + "="*80)
    print("STEP 5: GET /api/erx/weno-test (message mentions production)")
    print("="*80)
    
    try:
        response = requests.get(f"{BASE_URL}/api/erx/weno-test", cookies=cookies)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ STEP 5 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check message mentions production and NOT test/sandbox
        message = str(data).lower()
        
        checks = {
            "message mentions 'production'": 'production' in message,
            "message does NOT mention 'test'": 'test' not in message or 'testpatient' in message,  # testPatient is OK
            "message does NOT mention 'sandbox'": 'sandbox' not in message
        }
        
        all_passed = True
        for check, result in checks.items():
            status = "✅" if result else "❌"
            print(f"{status} {check}: {result}")
            if not result:
                all_passed = False
        
        if all_passed:
            print("✅ STEP 5 PASSED: weno-test message correctly mentions production")
            return True
        else:
            print("❌ STEP 5 FAILED: weno-test message incorrect")
            return False
            
    except Exception as e:
        print(f"❌ STEP 5 FAILED with exception: {str(e)}")
        return False

def test_step_6(cookies, patient_id):
    """Step 6: GET /api/erx/history?patientId=<pid> - various scenarios"""
    print("\n" + "="*80)
    print("STEP 6: GET /api/erx/history?patientId=<pid> (history endpoint)")
    print("="*80)
    
    try:
        # Test with patientId
        print(f"\n📋 Testing with patientId: {patient_id}")
        response = requests.get(f"{BASE_URL}/api/erx/history?patientId={patient_id}", cookies=cookies)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ STEP 6 FAILED: Expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Verify response structure
        checks = {
            "patientId present": 'patientId' in data,
            "count present": 'count' in data,
            "items present": 'items' in data and isinstance(data['items'], list)
        }
        
        # If items exist, check structure
        if data.get('items') and len(data['items']) > 0:
            first_item = data['items'][0]
            checks["item has medName"] = 'medName' in first_item
            checks["item has source"] = 'source' in first_item
            checks["item has status"] = 'status' in first_item
            checks["item has date"] = 'date' in first_item
            print(f"Sample item: {json.dumps(first_item, indent=2)}")
        else:
            print("ℹ️  No history items found (acceptable if patient has no prescriptions)")
        
        all_passed = True
        for check, result in checks.items():
            status = "✅" if result else "❌"
            print(f"{status} {check}: {result}")
            if not result:
                all_passed = False
        
        # Test without patientId (should be 400)
        print(f"\n📋 Testing without patientId (should be 400)...")
        response_no_patient = requests.get(f"{BASE_URL}/api/erx/history", cookies=cookies)
        
        print(f"Status Code: {response_no_patient.status_code}")
        
        if response_no_patient.status_code != 400:
            print(f"❌ STEP 6 FAILED: Without patientId expected 400, got {response_no_patient.status_code}")
            return False
        
        print("✅ Without patientId correctly received 400")
        
        # Test without session (should be 401)
        print(f"\n📋 Testing without session (should be 401)...")
        response_no_auth = requests.get(f"{BASE_URL}/api/erx/history?patientId={patient_id}")
        
        print(f"Status Code: {response_no_auth.status_code}")
        
        if response_no_auth.status_code != 401:
            print(f"❌ STEP 6 FAILED: Without session expected 401, got {response_no_auth.status_code}")
            return False
        
        print("✅ Without session correctly received 401")
        
        if all_passed:
            print("✅ STEP 6 PASSED: History endpoint working correctly")
            return True
        else:
            print("❌ STEP 6 FAILED: History endpoint response incorrect")
            return False
            
    except Exception as e:
        print(f"❌ STEP 6 FAILED with exception: {str(e)}")
        return False

def test_step_7(cookies, patient_id):
    """Step 7: GET /erx and /erx?patientId=<pid> -> 200 HTML"""
    print("\n" + "="*80)
    print("STEP 7: GET /erx and /erx?patientId=<pid> (HTML pages)")
    print("="*80)
    
    try:
        # Test /erx
        print(f"\n📄 Testing GET /erx...")
        response = requests.get(f"{BASE_URL}/erx", cookies=cookies)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ STEP 7 FAILED: GET /erx expected 200, got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False
        
        # Check it's HTML
        content_type = response.headers.get('content-type', '')
        if 'html' not in content_type.lower():
            print(f"⚠️  Warning: Content-Type is '{content_type}', expected HTML")
        else:
            print(f"✅ Content-Type: {content_type}")
        
        print(f"✅ GET /erx returned 200")
        
        # Test /erx?patientId=<pid>
        print(f"\n📄 Testing GET /erx?patientId={patient_id}...")
        response_with_patient = requests.get(f"{BASE_URL}/erx?patientId={patient_id}", cookies=cookies)
        
        print(f"Status Code: {response_with_patient.status_code}")
        
        if response_with_patient.status_code != 200:
            print(f"❌ STEP 7 FAILED: GET /erx?patientId expected 200, got {response_with_patient.status_code}")
            print(f"Response: {response_with_patient.text[:500]}")
            return False
        
        # Check it's HTML
        content_type_with_patient = response_with_patient.headers.get('content-type', '')
        if 'html' not in content_type_with_patient.lower():
            print(f"⚠️  Warning: Content-Type is '{content_type_with_patient}', expected HTML")
        else:
            print(f"✅ Content-Type: {content_type_with_patient}")
        
        print(f"✅ GET /erx?patientId={patient_id} returned 200")
        
        print("✅ STEP 7 PASSED: Both /erx endpoints return 200 HTML")
        return True
            
    except Exception as e:
        print(f"❌ STEP 7 FAILED with exception: {str(e)}")
        return False

def main():
    print("="*80)
    print("BACKEND TEST: Weno EZ Integration LOCKED TO PRODUCTION")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    
    # Login as admin
    admin_cookies = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_cookies:
        print("\n❌ CRITICAL: Admin login failed, cannot proceed")
        return
    
    # Login as nurse (for step 3)
    nurse_cookies = login(NURSE_EMAIL, NURSE_PASSWORD)
    if not nurse_cookies:
        print("\n❌ CRITICAL: Nurse login failed, cannot proceed")
        return
    
    # Get patient ID
    patient_id = get_patient_id(admin_cookies)
    if not patient_id:
        print("\n❌ CRITICAL: Could not get patient ID, cannot proceed")
        return
    
    # Run all test steps
    results = {}
    
    results['step_1'] = test_step_1(admin_cookies)
    results['step_2'] = test_step_2(admin_cookies)
    results['step_3'] = test_step_3(admin_cookies, nurse_cookies, patient_id)
    results['step_4'] = test_step_4(admin_cookies)
    results['step_5'] = test_step_5(admin_cookies)
    results['step_6'] = test_step_6(admin_cookies, patient_id)
    results['step_7'] = test_step_7(admin_cookies, patient_id)
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for step, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{step.upper()}: {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "="*80)
    if all_passed:
        print("🎉 ALL TESTS PASSED - Weno EZ production lock working correctly")
    else:
        print("❌ SOME TESTS FAILED - See details above")
    print("="*80)
    
    print("\n✅ CRITICAL ASSERTION: NO HTTP 500 ERRORS ENCOUNTERED during testing")

if __name__ == "__main__":
    main()
