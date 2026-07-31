#!/usr/bin/env python3
"""
Backend API Tests for Proactive Clinic EHR - Reference/Master Data Feature
Tests the new /api/refdata endpoints and patient registration demographics.

Test Cases:
1) GET /api/refdata (reference catalog):
   (A) With valid session, GET /api/refdata?type=diagnosis -> expect 200 and ~35 diagnosis items
   (B) With session, GET /api/refdata?type=diagnosis&q=diab -> expect filtered results
   (C) Without session, GET /api/refdata?type=diagnosis -> expect 401
   (D) With session, GET /api/refdata (no type param) -> expect 400
   (E) With session, GET /api/refdata?type=allergySeverity -> expect 4 items

2) POST /api/refdata (create new catalog value):
   (F) With session, POST /api/refdata with new allergen -> expect 201 and verify retrieval
   (G) Without session, POST /api/refdata -> expect 401
   (H) With session, POST /api/refdata missing display -> expect 400

3) POST /api/patients (registration with new demographics):
   (I) With session, create patient with race/ethnicity/maritalStatus/state/insurerName -> verify persistence
"""

import requests
import json
import random
import string
from datetime import datetime

# Use external URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Test credentials for staff login
STAFF_CREDS = {
    "email": "andy.manzano@proactiveclinic.com",
    "password": "apex123"
}

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)

def print_test(name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   Details: {details}")

def get_staff_session():
    """Login as staff and return session cookie"""
    print_section("AUTH SETUP: Staff Login")
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json=STAFF_CREDS,
            timeout=10
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            cookie = response.cookies.get("proactive_session")
            if cookie:
                print(f"✅ Staff session cookie obtained: {cookie[:20]}...")
                return cookie
            else:
                print("❌ No proactive_session cookie in response")
                print(f"   Available cookies: {list(response.cookies.keys())}")
                return None
        else:
            print(f"❌ Staff login failed with status {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Staff login error: {e}")
        return None

def test_get_refdata(staff_cookie):
    """Test GET /api/refdata endpoint"""
    print_section("TEST 1: GET /api/refdata (Reference Catalog)")
    
    cookies = {"proactive_session": staff_cookie} if staff_cookie else {}
    all_passed = True
    
    # Test A: GET with valid session for type=diagnosis
    print("\n--- Test A: GET /api/refdata?type=diagnosis (with session) ---")
    try:
        response = requests.get(
            f"{BASE_URL}/api/refdata?type=diagnosis",
            cookies=cookies,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            print(f"Response: Found {len(items)} diagnosis items")
            
            if len(items) > 0:
                # Check structure of first item
                first_item = items[0]
                has_id = "id" in first_item
                has_display = "display" in first_item
                has_code = "code" in first_item
                
                if has_id and has_display and has_code:
                    print_test("Diagnosis items structure", True, f"Items have id, display, code fields")
                    print(f"   Sample item: {json.dumps(first_item, indent=2)[:200]}")
                else:
                    missing = []
                    if not has_id: missing.append("id")
                    if not has_display: missing.append("display")
                    if not has_code: missing.append("code")
                    print_test("Diagnosis items structure", False, f"Missing fields: {', '.join(missing)}")
                    all_passed = False
                
                # Check if we have roughly 35 items (allow some variance)
                if len(items) >= 30:
                    print_test("Diagnosis items count", True, f"Found {len(items)} items (expected ~35)")
                else:
                    print_test("Diagnosis items count", False, f"Found only {len(items)} items (expected ~35)")
                    all_passed = False
            else:
                print_test("Diagnosis items", False, "No items returned")
                all_passed = False
        else:
            print(f"Response: {response.text[:300]}")
            print_test("GET diagnosis with session", False, f"Expected 200, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_test("GET diagnosis with session", False, f"Exception: {e}")
        all_passed = False
    
    # Test B: GET with q=diab filter
    print("\n--- Test B: GET /api/refdata?type=diagnosis&q=diab (filtered) ---")
    try:
        response = requests.get(
            f"{BASE_URL}/api/refdata?type=diagnosis&q=diab",
            cookies=cookies,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            print(f"Response: Found {len(items)} filtered items")
            
            if len(items) > 0:
                # Check if results contain "diabetes" in display
                diabetes_found = any("diabet" in item.get("display", "").lower() for item in items)
                if diabetes_found:
                    print_test("Filtered results", True, f"Found {len(items)} items containing 'diabetes'")
                    print(f"   Sample: {items[0].get('display', 'N/A')}")
                else:
                    print_test("Filtered results", False, "No items contain 'diabetes' in display")
                    all_passed = False
            else:
                print_test("Filtered results", False, "No items returned for q=diab")
                all_passed = False
        else:
            print(f"Response: {response.text[:300]}")
            print_test("GET diagnosis filtered", False, f"Expected 200, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_test("GET diagnosis filtered", False, f"Exception: {e}")
        all_passed = False
    
    # Test C: GET without session (should be 401)
    print("\n--- Test C: GET /api/refdata?type=diagnosis (without session) ---")
    try:
        response = requests.get(
            f"{BASE_URL}/api/refdata?type=diagnosis",
            timeout=10,
            allow_redirects=False
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 401:
            print_test("Unauthenticated request blocked", True, "Correctly returned 401")
        else:
            print_test("Unauthenticated request blocked", False, f"Expected 401, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_test("Unauthenticated request blocked", False, f"Exception: {e}")
        all_passed = False
    
    # Test D: GET without type parameter (should be 400)
    print("\n--- Test D: GET /api/refdata (no type param) ---")
    try:
        response = requests.get(
            f"{BASE_URL}/api/refdata",
            cookies=cookies,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 400:
            print_test("Missing type parameter", True, "Correctly returned 400")
        else:
            print_test("Missing type parameter", False, f"Expected 400, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_test("Missing type parameter", False, f"Exception: {e}")
        all_passed = False
    
    # Test E: GET allergySeverity (should have 4 items)
    print("\n--- Test E: GET /api/refdata?type=allergySeverity ---")
    try:
        response = requests.get(
            f"{BASE_URL}/api/refdata?type=allergySeverity",
            cookies=cookies,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            print(f"Response: Found {len(items)} allergySeverity items")
            
            if len(items) == 4:
                print_test("AllergySeverity items count", True, f"Found exactly 4 items")
                displays = [item.get("display") for item in items]
                print(f"   Items: {', '.join(displays)}")
            else:
                print_test("AllergySeverity items count", False, f"Expected 4 items, got {len(items)}")
                all_passed = False
        else:
            print(f"Response: {response.text[:300]}")
            print_test("GET allergySeverity", False, f"Expected 200, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_test("GET allergySeverity", False, f"Exception: {e}")
        all_passed = False
    
    return all_passed

def test_post_refdata(staff_cookie):
    """Test POST /api/refdata endpoint"""
    print_section("TEST 2: POST /api/refdata (Create Catalog Value)")
    
    cookies = {"proactive_session": staff_cookie} if staff_cookie else {}
    all_passed = True
    random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    test_allergen_name = f"Test Allergen QA {random_suffix}"
    
    # Test F: POST with valid session to create new allergen
    print("\n--- Test F: POST /api/refdata (create new allergen) ---")
    try:
        payload = {
            "type": "allergen",
            "display": test_allergen_name
        }
        response = requests.post(
            f"{BASE_URL}/api/refdata",
            json=payload,
            cookies=cookies,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:300]}")
        
        if response.status_code == 201:
            data = response.json()
            item = data.get("item")
            
            if item:
                has_id = "id" in item
                has_display = "display" in item
                has_type = "type" in item
                correct_type = item.get("type") == "allergen"
                correct_display = item.get("display") == test_allergen_name
                
                if has_id and has_display and has_type and correct_type and correct_display:
                    print_test("Create allergen", True, f"Created item with id={item.get('id')}")
                    print(f"   Item: {json.dumps(item, indent=2)}")
                else:
                    issues = []
                    if not has_id: issues.append("missing id")
                    if not has_display: issues.append("missing display")
                    if not has_type: issues.append("missing type")
                    if not correct_type: issues.append(f"wrong type: {item.get('type')}")
                    if not correct_display: issues.append(f"wrong display: {item.get('display')}")
                    print_test("Create allergen", False, f"Issues: {', '.join(issues)}")
                    all_passed = False
            else:
                print_test("Create allergen", False, "No 'item' in response")
                all_passed = False
        else:
            print_test("Create allergen", False, f"Expected 201, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_test("Create allergen", False, f"Exception: {e}")
        all_passed = False
    
    # Test F continued: Verify the new allergen is retrievable
    print("\n--- Test F (continued): Verify new allergen is retrievable ---")
    try:
        response = requests.get(
            f"{BASE_URL}/api/refdata?type=allergen",
            cookies=cookies,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            found = any(item.get("display") == test_allergen_name for item in items)
            
            if found:
                print_test("Verify allergen retrieval", True, f"Found '{test_allergen_name}' in allergen list")
            else:
                print_test("Verify allergen retrieval", False, f"'{test_allergen_name}' not found in allergen list")
                print(f"   Total allergens: {len(items)}")
                all_passed = False
        else:
            print_test("Verify allergen retrieval", False, f"Expected 200, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_test("Verify allergen retrieval", False, f"Exception: {e}")
        all_passed = False
    
    # Test G: POST without session (should be 401)
    print("\n--- Test G: POST /api/refdata (without session) ---")
    try:
        payload = {
            "type": "allergen",
            "display": "Test Unauthorized"
        }
        response = requests.post(
            f"{BASE_URL}/api/refdata",
            json=payload,
            timeout=10,
            allow_redirects=False
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 401:
            print_test("Unauthenticated POST blocked", True, "Correctly returned 401")
        else:
            print_test("Unauthenticated POST blocked", False, f"Expected 401, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_test("Unauthenticated POST blocked", False, f"Exception: {e}")
        all_passed = False
    
    # Test H: POST with missing display (should be 400)
    print("\n--- Test H: POST /api/refdata (missing display) ---")
    try:
        payload = {
            "type": "allergen"
            # Missing display field
        }
        response = requests.post(
            f"{BASE_URL}/api/refdata",
            json=payload,
            cookies=cookies,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 400:
            print_test("Missing display validation", True, "Correctly returned 400")
        else:
            print_test("Missing display validation", False, f"Expected 400, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_test("Missing display validation", False, f"Exception: {e}")
        all_passed = False
    
    return all_passed

def test_patient_registration(staff_cookie):
    """Test POST /api/patients with new demographics fields"""
    print_section("TEST 3: POST /api/patients (Demographics)")
    
    cookies = {"proactive_session": staff_cookie} if staff_cookie else {}
    all_passed = True
    
    # Test I: Create patient with race/ethnicity/maritalStatus/state/insurerName
    print("\n--- Test I: POST /api/patients (with demographics) ---")
    try:
        random_suffix = ''.join(random.choices(string.digits, k=4))
        payload = {
            "firstName": f"TestPatient{random_suffix}",
            "lastName": "Demographics",
            "dob": "1990-05-01",
            "sex": "M",
            "race": "White",
            "ethnicity": "Not Hispanic or Latino",
            "maritalStatus": "Single",
            "state": "TX",
            "insurerName": "Aetna"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/patients",
            json=payload,
            cookies=cookies,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code in [200, 201]:
            data = response.json()
            patient = data.get("patient")
            
            if patient:
                # Check all demographics fields persisted
                checks = {
                    "race": patient.get("race") == "White",
                    "ethnicity": patient.get("ethnicity") == "Not Hispanic or Latino",
                    "maritalStatus": patient.get("maritalStatus") == "Single",
                    "state": patient.get("state") == "TX",
                    "insurerName": patient.get("insurerName") == "Aetna"
                }
                
                all_fields_correct = all(checks.values())
                
                if all_fields_correct:
                    print_test("Patient demographics persistence", True, "All demographics fields persisted correctly")
                    print(f"   Patient ID: {patient.get('id')}")
                    print(f"   MRN: {patient.get('mrn')}")
                    print(f"   Race: {patient.get('race')}")
                    print(f"   Ethnicity: {patient.get('ethnicity')}")
                    print(f"   Marital Status: {patient.get('maritalStatus')}")
                    print(f"   State: {patient.get('state')}")
                    print(f"   Insurer: {patient.get('insurerName')}")
                else:
                    failed_fields = [field for field, passed in checks.items() if not passed]
                    print_test("Patient demographics persistence", False, f"Fields not persisted correctly: {', '.join(failed_fields)}")
                    print(f"   Expected race='White', got '{patient.get('race')}'")
                    print(f"   Expected ethnicity='Not Hispanic or Latino', got '{patient.get('ethnicity')}'")
                    print(f"   Expected maritalStatus='Single', got '{patient.get('maritalStatus')}'")
                    print(f"   Expected state='TX', got '{patient.get('state')}'")
                    print(f"   Expected insurerName='Aetna', got '{patient.get('insurerName')}'")
                    all_passed = False
            else:
                print_test("Patient creation", False, "No 'patient' in response")
                all_passed = False
        else:
            print_test("Patient creation", False, f"Expected 200/201, got {response.status_code}")
            all_passed = False
    except Exception as e:
        print_test("Patient creation", False, f"Exception: {e}")
        all_passed = False
    
    return all_passed

def main():
    """Run all backend tests for reference/master data feature"""
    print("\n" + "="*80)
    print("  PROACTIVE CLINIC EHR - REFERENCE/MASTER DATA BACKEND TESTS")
    print("  Testing: /api/refdata (GET+POST) and /api/patients demographics")
    print("  Base URL: " + BASE_URL)
    print("="*80)
    
    # Get staff session
    staff_cookie = get_staff_session()
    
    if not staff_cookie:
        print("\n❌ CRITICAL: Cannot proceed without staff session cookie")
        print("   Attempting to continue with tests that don't require auth...")
        # We can still test the unauthenticated cases
    
    # Run all tests
    test1_passed = test_get_refdata(staff_cookie)
    test2_passed = test_post_refdata(staff_cookie)
    test3_passed = test_patient_registration(staff_cookie)
    
    # Summary
    print_section("TEST SUMMARY")
    print(f"GET /api/refdata Tests:  {'✅ PASSED' if test1_passed else '❌ FAILED'}")
    print(f"POST /api/refdata Tests: {'✅ PASSED' if test2_passed else '❌ FAILED'}")
    print(f"POST /api/patients Test: {'✅ PASSED' if test3_passed else '❌ FAILED'}")
    
    all_passed = test1_passed and test2_passed and test3_passed
    print(f"\nOverall Result: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
