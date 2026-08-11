#!/usr/bin/env python3
"""
Backend test for new billing endpoints:
- POST /api/billing/scrub (claim scrubber)
- POST /api/billing/ai-coding (superbill AI coding assistant)

CRITICAL: Stedi is in PRODUCTION mode. DO NOT submit real claims.
Only test scrub + ai-coding endpoints (read-only operations).
"""

import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def login():
    """Login as admin to get session cookie"""
    print("\n=== LOGIN ===")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        print(f"Login status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Login response: {json.dumps(data, indent=2)}")
            cookie = resp.cookies.get("proactive_session")
            if cookie:
                print(f"✅ Session cookie obtained: {cookie[:20]}...")
                return cookie
            else:
                print("❌ No session cookie in response")
                return None
        else:
            print(f"❌ Login failed: {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None


def test_claim_scrubber(cookie):
    """Test POST /api/billing/scrub"""
    print("\n" + "="*80)
    print("TEST A: CLAIM SCRUBBER - POST /api/billing/scrub")
    print("="*80)
    
    # A1: POST without auth cookie -> expect 401
    print("\n--- A1: POST without auth cookie (expect 401) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/billing/scrub",
            json={"cptCodes": "97110", "icd10Codes": "M54.5"},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        if resp.status_code == 401:
            print("✅ A1 PASS: Correctly returns 401 without auth")
        else:
            print(f"❌ A1 FAIL: Expected 401, got {resp.status_code}")
    except Exception as e:
        print(f"❌ A1 ERROR: {e}")
    
    # A2: POST with valid data (expect 200 with environment=production)
    print("\n--- A2: POST with valid data (expect 200, environment=production) ---")
    try:
        payload = {
            "cptCodes": "97110",
            "icd10Codes": "M54.5",
            "memberId": "UHC123",
            "payerId": "87726"
        }
        print(f"Payload: {json.dumps(payload, indent=2)}")
        resp = requests.post(
            f"{BASE_URL}/api/billing/scrub",
            json=payload,
            cookies={"proactive_session": cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if resp.status_code == 200:
            print("✅ A2.1 PASS: Returns 200")
            
            # Check environment field
            if data.get("environment") == "production":
                print("✅ A2.2 PASS: environment == 'production'")
            else:
                print(f"❌ A2.2 FAIL: environment = {data.get('environment')}, expected 'production'")
            
            # Check readyToSubmit field (can be true or false depending on org config)
            ready = data.get("readyToSubmit")
            print(f"readyToSubmit: {ready}")
            if isinstance(ready, bool):
                print(f"✅ A2.3 PASS: readyToSubmit is boolean ({ready})")
                if not ready:
                    print(f"Note: readyToSubmit=false is acceptable if billing NPI/Tax ID not configured")
                    print(f"Errors: {data.get('errors', [])}")
                    print(f"Warnings: {data.get('warnings', [])}")
            else:
                print(f"❌ A2.3 FAIL: readyToSubmit is not boolean")
            
            # Report errors/warnings verbatim
            errors = data.get("errors", [])
            warnings = data.get("warnings", [])
            print(f"\nErrors array: {json.dumps(errors, indent=2)}")
            print(f"Warnings array: {json.dumps(warnings, indent=2)}")
            
        else:
            print(f"❌ A2 FAIL: Expected 200, got {resp.status_code}")
    except Exception as e:
        print(f"❌ A2 ERROR: {e}")
    
    # A3: POST with invalid data (expect 200 readyToSubmit:false with errors)
    print("\n--- A3: POST with invalid data (expect 200, readyToSubmit:false, errors) ---")
    try:
        payload = {
            "cptCodes": "",
            "icd10Codes": "ZZZ",
            "memberId": "",
            "payerId": ""
        }
        print(f"Payload: {json.dumps(payload, indent=2)}")
        resp = requests.post(
            f"{BASE_URL}/api/billing/scrub",
            json=payload,
            cookies={"proactive_session": cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if resp.status_code == 200:
            print("✅ A3.1 PASS: Returns 200")
            
            # Check readyToSubmit is false
            if data.get("readyToSubmit") == False:
                print("✅ A3.2 PASS: readyToSubmit == false")
            else:
                print(f"❌ A3.2 FAIL: readyToSubmit = {data.get('readyToSubmit')}, expected false")
            
            # Check errors array contains expected messages
            errors = data.get("errors", [])
            print(f"\nErrors: {json.dumps(errors, indent=2)}")
            
            expected_errors = [
                "missing CPT",
                "missing member ID",
                "missing payer ID",
                "Invalid ICD-10 format"
            ]
            
            errors_str = " ".join(errors).lower()
            found_errors = []
            missing_errors = []
            
            for expected in expected_errors:
                if expected.lower() in errors_str:
                    found_errors.append(expected)
                    print(f"✅ A3.3 PASS: Found error about '{expected}'")
                else:
                    missing_errors.append(expected)
                    print(f"❌ A3.3 FAIL: Missing error about '{expected}'")
            
            if len(missing_errors) == 0:
                print("✅ A3 PASS: All expected errors present")
            else:
                print(f"⚠️ A3 PARTIAL: Missing errors: {missing_errors}")
        else:
            print(f"❌ A3 FAIL: Expected 200, got {resp.status_code}")
    except Exception as e:
        print(f"❌ A3 ERROR: {e}")


def test_ai_coding(cookie):
    """Test POST /api/billing/ai-coding"""
    print("\n" + "="*80)
    print("TEST B: SUPERBILL AI CODING - POST /api/billing/ai-coding")
    print("="*80)
    
    # B1: POST without auth cookie -> expect 401
    print("\n--- B1: POST without auth cookie (expect 401) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/billing/ai-coding",
            json={"cptCodes": "97110", "icd10Codes": "M54.5", "note": "Test note"},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        if resp.status_code == 401:
            print("✅ B1 PASS: Correctly returns 401 without auth")
        else:
            print(f"❌ B1 FAIL: Expected 401, got {resp.status_code}")
    except Exception as e:
        print(f"❌ B1 ERROR: {e}")
    
    # B2: POST with valid data (expect 200 with review object)
    print("\n--- B2: POST with valid data (expect 200, review object) ---")
    print("NOTE: This makes a real GPT-4o LLM call, may take 5-20 seconds...")
    try:
        payload = {
            "cptCodes": "97110",
            "icd10Codes": "M54.5",
            "note": "Physical therapy therapeutic exercise for chronic low back pain, 2 units, 30 minutes, with GP therapy plan of care in place."
        }
        print(f"Payload: {json.dumps(payload, indent=2)}")
        resp = requests.post(
            f"{BASE_URL}/api/billing/ai-coding",
            json=payload,
            cookies={"proactive_session": cookie},
            timeout=30  # Longer timeout for LLM call
        )
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if resp.status_code == 200:
            print("✅ B2.1 PASS: Returns 200")
            
            # Check ok field
            if data.get("ok") == True:
                print("✅ B2.2 PASS: ok == true")
            else:
                print(f"❌ B2.2 FAIL: ok = {data.get('ok')}, expected true")
            
            # Check review object shape
            review = data.get("review", {})
            if review:
                print("✅ B2.3 PASS: review object exists")
                
                # Check required fields
                required_fields = ["summary", "cleanClaimReady", "suggestedCpt", "suggestedIcd10", "issues"]
                for field in required_fields:
                    if field in review:
                        print(f"✅ B2.4 PASS: review.{field} exists")
                        
                        # Check types
                        if field == "summary" and isinstance(review[field], str):
                            print(f"  - summary (string): {review[field][:100]}...")
                        elif field == "cleanClaimReady" and isinstance(review[field], bool):
                            print(f"  - cleanClaimReady (boolean): {review[field]}")
                        elif field in ["suggestedCpt", "suggestedIcd10", "issues"] and isinstance(review[field], list):
                            print(f"  - {field} (array): {len(review[field])} items")
                        else:
                            print(f"  ⚠️ {field} has unexpected type: {type(review[field])}")
                    else:
                        print(f"❌ B2.4 FAIL: review.{field} missing")
                
                print("✅ B2 PASS: Response shape confirmed")
            else:
                print("❌ B2.3 FAIL: review object missing")
        else:
            print(f"❌ B2 FAIL: Expected 200, got {resp.status_code}")
    except Exception as e:
        print(f"❌ B2 ERROR: {e}")
    
    # B3: POST with empty body (expect 400)
    print("\n--- B3: POST with empty body (expect 400) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/billing/ai-coding",
            json={},
            cookies={"proactive_session": cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        if resp.status_code == 400:
            print("✅ B3 PASS: Correctly returns 400 for empty body")
        else:
            print(f"❌ B3 FAIL: Expected 400, got {resp.status_code}")
    except Exception as e:
        print(f"❌ B3 ERROR: {e}")


def main():
    print("="*80)
    print("BACKEND TEST: BILLING ENDPOINTS")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("CRITICAL: Stedi is in PRODUCTION mode. DO NOT submit real claims.")
    print("Only testing scrub + ai-coding endpoints (read-only operations).")
    
    # Login
    cookie = login()
    if not cookie:
        print("\n❌ FATAL: Could not obtain session cookie. Aborting tests.")
        sys.exit(1)
    
    # Test claim scrubber
    test_claim_scrubber(cookie)
    
    # Test AI coding
    test_ai_coding(cookie)
    
    print("\n" + "="*80)
    print("BACKEND TEST COMPLETE")
    print("="*80)


if __name__ == "__main__":
    main()
