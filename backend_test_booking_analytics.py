#!/usr/bin/env python3
"""
Backend test for Proactive Clinic booking analytics and Message creation.

TEST GROUP 1: Booking analytics stats endpoint GET /api/appointments/request/stats (STAFF-ONLY)
TEST GROUP 2: Front-desk Message created on public request POST /api/appointments/request
"""

import requests
import json
import os
from pymongo import MongoClient

# Base URL (HTTPS required for secure cookie)
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "proactive_clinic")

def get_mongo_client():
    """Get MongoDB client."""
    return MongoClient(MONGO_URL)

def staff_login():
    """Login as staff and return session cookie."""
    print("\n=== Staff Login ===")
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "email": "andy.manzano@proactiveclinic.com",
            "password": "apex123"
        },
        timeout=10
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        cookie = response.cookies.get("proactive_session")
        print(f"✅ Staff login successful, cookie: {cookie[:20]}..." if cookie else "❌ No cookie received")
        return {"proactive_session": cookie} if cookie else None
    else:
        print(f"❌ Staff login failed: {response.text}")
        return None

def test_stats_without_auth():
    """TEST 1.1: GET /api/appointments/request/stats without session -> expect 401."""
    print("\n=== TEST 1.1: Stats endpoint without auth ===")
    try:
        response = requests.get(f"{BASE_URL}/api/appointments/request/stats", timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code == 401:
            print("✅ PASS: Correctly returns 401 Unauthorized without session")
            return True
        else:
            print(f"❌ FAIL: Expected 401, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        return False

def test_stats_with_auth(cookies):
    """TEST 1.2: GET /api/appointments/request/stats with staff session -> expect 200 with stats."""
    print("\n=== TEST 1.2: Stats endpoint with staff auth ===")
    try:
        response = requests.get(
            f"{BASE_URL}/api/appointments/request/stats",
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Verify required keys
        required_keys = ['total', 'byStatus', 'byType', 'byService', 'scheduled', 'priority', 'last30', 'conversionRate']
        missing_keys = [k for k in required_keys if k not in data]
        if missing_keys:
            print(f"❌ FAIL: Missing required keys: {missing_keys}")
            return False
        print(f"✅ All required keys present: {required_keys}")
        
        # Verify data types
        if not isinstance(data['total'], int):
            print(f"❌ FAIL: 'total' should be number, got {type(data['total'])}")
            return False
        print(f"✅ total is number: {data['total']}")
        
        # Verify byStatus structure
        if not isinstance(data['byStatus'], dict):
            print(f"❌ FAIL: 'byStatus' should be object, got {type(data['byStatus'])}")
            return False
        if not all(k in data['byStatus'] for k in ['pending', 'confirmed', 'declined']):
            print(f"❌ FAIL: 'byStatus' missing required keys")
            return False
        print(f"✅ byStatus structure correct: {data['byStatus']}")
        
        # Verify byType structure
        if not isinstance(data['byType'], dict):
            print(f"❌ FAIL: 'byType' should be object, got {type(data['byType'])}")
            return False
        if not all(k in data['byType'] for k in ['new', 'existing']):
            print(f"❌ FAIL: 'byType' missing required keys")
            return False
        print(f"✅ byType structure correct: {data['byType']}")
        
        # Verify byService is array
        if not isinstance(data['byService'], list):
            print(f"❌ FAIL: 'byService' should be array, got {type(data['byService'])}")
            return False
        if data['byService'] and not all('service' in item and 'count' in item for item in data['byService']):
            print(f"❌ FAIL: 'byService' items should have 'service' and 'count' keys")
            return False
        print(f"✅ byService is array with {len(data['byService'])} items")
        
        # Verify numeric fields
        for key in ['scheduled', 'priority', 'last30']:
            if not isinstance(data[key], int):
                print(f"❌ FAIL: '{key}' should be number, got {type(data[key])}")
                return False
        print(f"✅ scheduled={data['scheduled']}, priority={data['priority']}, last30={data['last30']}")
        
        # Verify conversionRate is 0-100
        if not isinstance(data['conversionRate'], int) or not (0 <= data['conversionRate'] <= 100):
            print(f"❌ FAIL: 'conversionRate' should be number 0-100, got {data['conversionRate']}")
            return False
        print(f"✅ conversionRate is valid: {data['conversionRate']}%")
        
        # Verify byStatus sum equals total
        status_sum = data['byStatus']['pending'] + data['byStatus']['confirmed'] + data['byStatus']['declined']
        if status_sum != data['total']:
            print(f"❌ FAIL: byStatus sum ({status_sum}) != total ({data['total']})")
            return False
        print(f"✅ byStatus.pending + byStatus.confirmed + byStatus.declined == total")
        
        # Verify byType sum equals total
        type_sum = data['byType']['new'] + data['byType']['existing']
        if type_sum != data['total']:
            print(f"❌ FAIL: byType sum ({type_sum}) != total ({data['total']})")
            return False
        print(f"✅ byType.new + byType.existing == total")
        
        print("✅ PASS: Stats endpoint returns correct structure and data")
        return True
        
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        return False

def test_stats_not_treated_as_id(cookies):
    """TEST 1.3: Verify 'stats' path is NOT treated as [id] (returns stats, not 404)."""
    print("\n=== TEST 1.3: Verify 'stats' is not treated as [id] ===")
    try:
        # Test that /api/appointments/request/stats returns stats (not 404)
        response = requests.get(
            f"{BASE_URL}/api/appointments/request/stats",
            cookies=cookies,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if 'total' in data and 'byStatus' in data:
                print("✅ PASS: 'stats' path returns stats object (not treated as [id])")
                return True
            else:
                print(f"❌ FAIL: Response doesn't look like stats: {list(data.keys())}")
                return False
        else:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        return False

def create_new_patient_request():
    """TEST 2.1: Create NEW patient request and verify Message creation."""
    print("\n=== TEST 2.1: Create NEW patient request and verify Message ===")
    try:
        # Create request
        response = requests.post(
            f"{BASE_URL}/api/appointments/request",
            json={
                "patientType": "new",
                "firstName": "MsgTest",
                "lastName": "Alert",
                "email": "mt@example.com",
                "serviceInterest": "Primary Care"
            },
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return None
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Verify response structure
        if not data.get('ok'):
            print(f"❌ FAIL: Response ok is not true")
            return None
        
        confirmation = data.get('confirmation')
        if not confirmation:
            print(f"❌ FAIL: No confirmation number in response")
            return None
        print(f"✅ Request created with confirmation: {confirmation}")
        
        if data.get('emailStatus') != 'skipped':
            print(f"⚠️  WARNING: emailStatus is '{data.get('emailStatus')}', expected 'skipped'")
        else:
            print(f"✅ emailStatus is 'skipped' (no RESEND key)")
        
        # Verify Message was created in MongoDB
        print("\n--- Checking MongoDB for Message document ---")
        client = get_mongo_client()
        db = client[DB_NAME]
        
        # Find message with confirmation number in subject
        message = db.Message.find_one({
            "subject": {"$regex": confirmation}
        })
        
        if not message:
            print(f"❌ FAIL: No Message found with confirmation {confirmation}")
            client.close()
            return None
        
        print(f"✅ Message found in MongoDB")
        print(f"Subject: {message.get('subject')}")
        
        # Verify subject contains required text
        subject = message.get('subject', '')
        if 'New website appointment request' not in subject:
            print(f"❌ FAIL: Subject doesn't contain 'New website appointment request'")
            client.close()
            return None
        print(f"✅ Subject contains 'New website appointment request'")
        
        if 'MsgTest Alert' not in subject:
            print(f"❌ FAIL: Subject doesn't contain 'MsgTest Alert'")
            client.close()
            return None
        print(f"✅ Subject contains 'MsgTest Alert'")
        
        # Verify NO priority flag for new patient
        if '★PRIORITY' in subject:
            print(f"❌ FAIL: NEW patient should NOT have ★PRIORITY flag")
            client.close()
            return None
        print(f"✅ No ★PRIORITY flag for new patient (correct)")
        
        client.close()
        print("✅ PASS: NEW patient request creates correct Message")
        return confirmation
        
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        return None

def create_existing_patient_request():
    """TEST 2.2: Create EXISTING patient request and verify Message with ★PRIORITY."""
    print("\n=== TEST 2.2: Create EXISTING patient request and verify ★PRIORITY Message ===")
    try:
        # Create request for existing patient Eleanor Adams
        response = requests.post(
            f"{BASE_URL}/api/appointments/request",
            json={
                "patientType": "existing",
                "mrn": "PC-100000",
                "dob": "1958-04-12",
                "firstName": "Eleanor",
                "lastName": "Adams",
                "serviceInterest": "Physical Therapy"
            },
            timeout=10
        )
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return None
        
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Verify priorityCheckin is true
        if not data.get('priorityCheckin'):
            print(f"❌ FAIL: priorityCheckin should be true for existing patient")
            return None
        print(f"✅ priorityCheckin is true")
        
        confirmation = data.get('confirmation')
        if not confirmation:
            print(f"❌ FAIL: No confirmation number in response")
            return None
        print(f"✅ Request created with confirmation: {confirmation}")
        
        # Verify Message was created in MongoDB with ★PRIORITY
        print("\n--- Checking MongoDB for Message document with ★PRIORITY ---")
        client = get_mongo_client()
        db = client[DB_NAME]
        
        # Find message with confirmation number in subject
        message = db.Message.find_one({
            "subject": {"$regex": confirmation}
        })
        
        if not message:
            print(f"❌ FAIL: No Message found with confirmation {confirmation}")
            client.close()
            return None
        
        print(f"✅ Message found in MongoDB")
        print(f"Subject: {message.get('subject')}")
        
        # Verify subject contains ★PRIORITY
        subject = message.get('subject', '')
        if '★PRIORITY' not in subject:
            print(f"❌ FAIL: Subject doesn't contain '★PRIORITY' for existing patient")
            client.close()
            return None
        print(f"✅ Subject contains '★PRIORITY' for existing patient")
        
        client.close()
        print("✅ PASS: EXISTING patient request creates Message with ★PRIORITY")
        return confirmation
        
    except Exception as e:
        print(f"❌ FAIL: Exception occurred: {e}")
        return None

def cleanup_test_data(new_confirmation, existing_confirmation):
    """Clean up test data from MongoDB."""
    print("\n=== CLEANUP: Deleting test data ===")
    try:
        client = get_mongo_client()
        db = client[DB_NAME]
        
        # Delete AppointmentRequests
        deleted_requests = 0
        if new_confirmation:
            result = db.AppointmentRequest.delete_one({"confirmation": new_confirmation})
            deleted_requests += result.deleted_count
            print(f"Deleted AppointmentRequest with confirmation {new_confirmation}: {result.deleted_count}")
        
        if existing_confirmation:
            result = db.AppointmentRequest.delete_one({"confirmation": existing_confirmation})
            deleted_requests += result.deleted_count
            print(f"Deleted AppointmentRequest with confirmation {existing_confirmation}: {result.deleted_count}")
        
        # Delete Messages containing 'MsgTest Alert' or the Eleanor Adams Physical Therapy one
        deleted_messages = 0
        if new_confirmation:
            result = db.Message.delete_many({"subject": {"$regex": "MsgTest Alert"}})
            deleted_messages += result.deleted_count
            print(f"Deleted Messages containing 'MsgTest Alert': {result.deleted_count}")
        
        if existing_confirmation:
            result = db.Message.delete_many({"subject": {"$regex": existing_confirmation}})
            deleted_messages += result.deleted_count
            print(f"Deleted Messages with confirmation {existing_confirmation}: {result.deleted_count}")
        
        client.close()
        print(f"✅ CLEANUP COMPLETE: Deleted {deleted_requests} AppointmentRequests and {deleted_messages} Messages")
        print("✅ Eleanor Adams Patient record left intact (not deleted)")
        return True
        
    except Exception as e:
        print(f"❌ CLEANUP FAILED: {e}")
        return False

def main():
    """Run all tests."""
    print("=" * 80)
    print("BACKEND TEST: Booking Analytics & Message Creation")
    print("=" * 80)
    
    results = {
        "TEST 1.1: Stats without auth (401)": False,
        "TEST 1.2: Stats with auth (200 + structure)": False,
        "TEST 1.3: Stats path not treated as [id]": False,
        "TEST 2.1: NEW patient Message creation": False,
        "TEST 2.2: EXISTING patient ★PRIORITY Message": False,
        "CLEANUP": False
    }
    
    # TEST GROUP 1: Stats endpoint
    results["TEST 1.1: Stats without auth (401)"] = test_stats_without_auth()
    
    cookies = staff_login()
    if not cookies:
        print("\n❌ FATAL: Staff login failed, cannot continue")
        return
    
    results["TEST 1.2: Stats with auth (200 + structure)"] = test_stats_with_auth(cookies)
    results["TEST 1.3: Stats path not treated as [id]"] = test_stats_not_treated_as_id(cookies)
    
    # TEST GROUP 2: Message creation
    new_confirmation = create_new_patient_request()
    results["TEST 2.1: NEW patient Message creation"] = new_confirmation is not None
    
    existing_confirmation = create_existing_patient_request()
    results["TEST 2.2: EXISTING patient ★PRIORITY Message"] = existing_confirmation is not None
    
    # CLEANUP
    results["CLEANUP"] = cleanup_test_data(new_confirmation, existing_confirmation)
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")

if __name__ == "__main__":
    main()
