#!/usr/bin/env python3
"""
Backend test for EHI Export C-CDA and PDF formats.
Tests the TWO NEW human-readable formats (C-CDA and PDF) added to GET /api/admin/ehi-export.
"""

import requests
import os
from pymongo import MongoClient

# Configuration
BASE_URL = os.getenv("NEXT_PUBLIC_BASE_URL", "https://nextjs-ssr-stack.preview.emergentagent.com")
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "proactive_clinic")

print(f"🔧 Configuration:")
print(f"   BASE_URL: {BASE_URL}")
print(f"   MONGO_URL: {MONGO_URL}")
print(f"   DB_NAME: {DB_NAME}")
print()

# MongoDB client
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]

# Step 0: Resolve patient Eleanor Adams (MRN PC-100000)
print("=" * 80)
print("STEP 0: Resolve patient Eleanor Adams (MRN PC-100000)")
print("=" * 80)

try:
    patient = db.Patient.find_one({"mrn": "PC-100000"})
    if not patient:
        print("❌ FAILED: Patient Eleanor Adams (MRN PC-100000) not found in database")
        exit(1)
    
    patient_id = patient["_id"]
    print(f"✅ Found patient Eleanor Adams:")
    print(f"   ID: {patient_id}")
    print(f"   MRN: {patient['mrn']}")
    print(f"   Name: {patient.get('firstName', '')} {patient.get('lastName', '')}")
    print()
except Exception as e:
    print(f"❌ FAILED: Error querying MongoDB: {e}")
    exit(1)

# Step 1: Login as admin to get session cookie
print("=" * 80)
print("STEP 1: Login as admin@proactiveclinic.com")
print("=" * 80)

try:
    login_response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@proactiveclinic.com", "password": "apex123"},
        timeout=30
    )
    print(f"Status: {login_response.status_code}")
    
    if login_response.status_code != 200:
        print(f"❌ FAILED: Login failed with status {login_response.status_code}")
        print(f"Response: {login_response.text[:500]}")
        exit(1)
    
    # Extract session cookie
    print(f"Cookies returned: {dict(login_response.cookies)}")
    
    # Try different cookie names
    session_cookie = (
        login_response.cookies.get("proactive_session") or
        login_response.cookies.get("authjs.session-token") or
        login_response.cookies.get("next-auth.session-token") or
        login_response.cookies.get("__Secure-authjs.session-token") or
        login_response.cookies.get("__Secure-next-auth.session-token")
    )
    
    if not session_cookie:
        print("❌ FAILED: No session cookie returned from login")
        print(f"Available cookies: {list(login_response.cookies.keys())}")
        exit(1)
    
    # Use the same cookie name that was returned
    cookie_name = None
    for name in ["proactive_session", "authjs.session-token", "next-auth.session-token", "__Secure-authjs.session-token", "__Secure-next-auth.session-token"]:
        if login_response.cookies.get(name):
            cookie_name = name
            break
    
    cookies = {cookie_name: session_cookie}
    print(f"✅ Login successful, session cookie obtained (name: {cookie_name})")
    print()
except Exception as e:
    print(f"❌ FAILED: Login error: {e}")
    exit(1)

# Test 1: GET /api/admin/ehi-export?patientId=<id>&format=ccda with NO cookie -> expect 401
print("=" * 80)
print("TEST 1: GET /api/admin/ehi-export?patientId=<id>&format=ccda WITHOUT auth cookie")
print("=" * 80)

try:
    response = requests.get(
        f"{BASE_URL}/api/admin/ehi-export",
        params={"patientId": patient_id, "format": "ccda"},
        timeout=30
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 401:
        print("✅ TEST 1 PASSED: Correctly returns 401 Unauthorized without auth cookie")
    else:
        print(f"❌ TEST 1 FAILED: Expected 401, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
    print()
except Exception as e:
    print(f"❌ TEST 1 FAILED: Request error: {e}")
    print()

# Test 2: GET /api/admin/ehi-export?scope=all&format=ccda as admin (no patientId) -> expect 400
print("=" * 80)
print("TEST 2: GET /api/admin/ehi-export?scope=all&format=ccda as admin (no patientId)")
print("=" * 80)

try:
    response = requests.get(
        f"{BASE_URL}/api/admin/ehi-export",
        params={"scope": "all", "format": "ccda"},
        cookies=cookies,
        timeout=30
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 400:
        try:
            data = response.json()
            print(f"Response: {data}")
            if "C-CDA and PDF exports are per-patient" in data.get("error", ""):
                print("✅ TEST 2 PASSED: Correctly returns 400 with per-patient error message")
            else:
                print(f"✅ TEST 2 PASSED: Returns 400 (error message: {data.get('error', 'N/A')})")
        except Exception:
            print("✅ TEST 2 PASSED: Returns 400")
    else:
        print(f"❌ TEST 2 FAILED: Expected 400, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
    print()
except Exception as e:
    print(f"❌ TEST 2 FAILED: Request error: {e}")
    print()

# Test 3: GET /api/admin/ehi-export?scope=all&format=pdf as admin (no patientId) -> expect 400
print("=" * 80)
print("TEST 3: GET /api/admin/ehi-export?scope=all&format=pdf as admin (no patientId)")
print("=" * 80)

try:
    response = requests.get(
        f"{BASE_URL}/api/admin/ehi-export",
        params={"scope": "all", "format": "pdf"},
        cookies=cookies,
        timeout=30
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 400:
        try:
            data = response.json()
            print(f"Response: {data}")
            if "C-CDA and PDF exports are per-patient" in data.get("error", ""):
                print("✅ TEST 3 PASSED: Correctly returns 400 with per-patient error message")
            else:
                print(f"✅ TEST 3 PASSED: Returns 400 (error message: {data.get('error', 'N/A')})")
        except Exception:
            print("✅ TEST 3 PASSED: Returns 400")
    else:
        print(f"❌ TEST 3 FAILED: Expected 400, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
    print()
except Exception as e:
    print(f"❌ TEST 3 FAILED: Request error: {e}")
    print()

# Test 4: GET /api/admin/ehi-export?patientId=<id>&format=ccda as admin -> expect 200 with XML
print("=" * 80)
print("TEST 4: GET /api/admin/ehi-export?patientId=<id>&format=ccda as admin")
print("=" * 80)

try:
    response = requests.get(
        f"{BASE_URL}/api/admin/ehi-export",
        params={"patientId": patient_id, "format": "ccda"},
        cookies=cookies,
        timeout=30
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        content_type = response.headers.get("content-type", "")
        content_disposition = response.headers.get("content-disposition", "")
        body = response.text
        
        print(f"Content-Type: {content_type}")
        print(f"Content-Disposition: {content_disposition}")
        print(f"Body size: {len(body)} bytes")
        print(f"Body starts with: {body[:100]}")
        
        # Assertions
        checks = []
        
        # Check 1: Content-Type contains "application/xml"
        if "application/xml" in content_type:
            checks.append("✅ Content-Type contains 'application/xml'")
        else:
            checks.append(f"❌ Content-Type does NOT contain 'application/xml' (got: {content_type})")
        
        # Check 2: Content-Disposition is an attachment with .xml filename
        if "attachment" in content_disposition and ".xml" in content_disposition:
            checks.append("✅ Content-Disposition is attachment with .xml filename")
        else:
            checks.append(f"❌ Content-Disposition issue (got: {content_disposition})")
        
        # Check 3: Body starts with "<?xml"
        if body.startswith("<?xml"):
            checks.append("✅ Body starts with '<?xml'")
        else:
            checks.append(f"❌ Body does NOT start with '<?xml' (starts with: {body[:50]})")
        
        # Check 4: Body contains "<ClinicalDocument"
        if "<ClinicalDocument" in body:
            checks.append("✅ Body contains '<ClinicalDocument'")
        else:
            checks.append("❌ Body does NOT contain '<ClinicalDocument'")
        
        # Check 5: Body contains patient MRN (PC-100000)
        if "PC-100000" in body:
            checks.append("✅ Body contains patient MRN 'PC-100000'")
        else:
            checks.append("❌ Body does NOT contain patient MRN 'PC-100000'")
        
        # Check 6: Body contains patient last name (Adams)
        if "Adams" in body:
            checks.append("✅ Body contains patient last name 'Adams'")
        else:
            checks.append("❌ Body does NOT contain patient last name 'Adams'")
        
        print("\nAssertion results:")
        for check in checks:
            print(f"   {check}")
        
        if all("✅" in check for check in checks):
            print("\n✅ TEST 4 PASSED: All assertions passed")
        else:
            print("\n❌ TEST 4 FAILED: Some assertions failed")
    else:
        print(f"❌ TEST 4 FAILED: Expected 200, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
    print()
except Exception as e:
    print(f"❌ TEST 4 FAILED: Request error: {e}")
    print()

# Test 5: GET /api/admin/ehi-export?patientId=<id>&format=pdf as admin -> expect 200 with PDF
print("=" * 80)
print("TEST 5: GET /api/admin/ehi-export?patientId=<id>&format=pdf as admin")
print("=" * 80)

try:
    response = requests.get(
        f"{BASE_URL}/api/admin/ehi-export",
        params={"patientId": patient_id, "format": "pdf"},
        cookies=cookies,
        timeout=30
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        content_type = response.headers.get("content-type", "")
        content_disposition = response.headers.get("content-disposition", "")
        body = response.content  # Binary content
        
        print(f"Content-Type: {content_type}")
        print(f"Content-Disposition: {content_disposition}")
        print(f"Body size: {len(body)} bytes")
        print(f"First 4 bytes: {body[:4]}")
        
        # Assertions
        checks = []
        
        # Check 1: Content-Type is "application/pdf"
        if "application/pdf" in content_type:
            checks.append("✅ Content-Type is 'application/pdf'")
        else:
            checks.append(f"❌ Content-Type is NOT 'application/pdf' (got: {content_type})")
        
        # Check 2: Content-Disposition is attachment with .pdf filename
        if "attachment" in content_disposition and ".pdf" in content_disposition:
            checks.append("✅ Content-Disposition is attachment with .pdf filename")
        else:
            checks.append(f"❌ Content-Disposition issue (got: {content_disposition})")
        
        # Check 3: First 4 bytes are "%PDF"
        if body[:4] == b"%PDF":
            checks.append("✅ First 4 bytes are '%PDF' (valid PDF magic bytes)")
        else:
            checks.append(f"❌ First 4 bytes are NOT '%PDF' (got: {body[:4]})")
        
        print("\nAssertion results:")
        for check in checks:
            print(f"   {check}")
        
        if all("✅" in check for check in checks):
            print("\n✅ TEST 5 PASSED: All assertions passed")
        else:
            print("\n❌ TEST 5 FAILED: Some assertions failed")
    else:
        print(f"❌ TEST 5 FAILED: Expected 200, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
    print()
except Exception as e:
    print(f"❌ TEST 5 FAILED: Request error: {e}")
    print()

# Test 6: GET /api/admin/ehi-export?patientId=doesnotexist999&format=ccda as admin -> expect 404
print("=" * 80)
print("TEST 6: GET /api/admin/ehi-export?patientId=doesnotexist999&format=ccda as admin")
print("=" * 80)

try:
    response = requests.get(
        f"{BASE_URL}/api/admin/ehi-export",
        params={"patientId": "doesnotexist999", "format": "ccda"},
        cookies=cookies,
        timeout=30
    )
    print(f"Status: {response.status_code}")
    
    if response.status_code == 404:
        try:
            data = response.json()
            print(f"Response: {data}")
            if "Patient not found" in data.get("error", ""):
                print("✅ TEST 6 PASSED: Correctly returns 404 with 'Patient not found.' error")
            else:
                print(f"✅ TEST 6 PASSED: Returns 404 (error message: {data.get('error', 'N/A')})")
        except Exception:
            print("✅ TEST 6 PASSED: Returns 404")
    else:
        print(f"❌ TEST 6 FAILED: Expected 404, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
    print()
except Exception as e:
    print(f"❌ TEST 6 FAILED: Request error: {e}")
    print()

print("=" * 80)
print("🎉 ALL TESTS COMPLETED")
print("=" * 80)
