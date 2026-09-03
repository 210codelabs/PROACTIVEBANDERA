#!/usr/bin/env python3
"""
Backend test for TWO new Weno routes:
  (A) GET /api/weno/rxlog-url - Builds a URL (no external call), deterministic
  (B) POST /api/weno/rx-sync?patientId=<realId>&days=7 - Calls live Weno TEST sync endpoint

CRITICAL: NEVER print/echo any useremail, data param, encryption key, MD5 password, or credentials.
The absolute failure condition for both routes is an HTTP 500.

Base URL: http://localhost:3000
Login accounts:
  - admin: admin@proactiveclinic.com / apex123
  - nurse: nurse.kim@proactiveclinic.com / apex123
  - provider: andy.manzano@proactiveclinic.com / apex123
"""

import requests
import json
import re
from typing import Dict, Any, Optional

# Base URL - use HTTPS from .env for session cookies with secure flag
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Test accounts
ACCOUNTS = {
    "admin": {"email": "admin@proactiveclinic.com", "password": "apex123"},
    "nurse": {"email": "nurse.kim@proactiveclinic.com", "password": "apex123"},
    "provider": {"email": "andy.manzano@proactiveclinic.com", "password": "apex123"},
}

def login(role: str) -> Optional[str]:
    """Login and return session cookie."""
    try:
        account = ACCOUNTS[role]
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": account["email"], "password": account["password"]},
            timeout=10
        )
        if resp.status_code == 200:
            # Try to get proactive_session cookie
            cookie = resp.cookies.get("proactive_session")
            if not cookie:
                # Try from headers
                set_cookie = resp.headers.get("Set-Cookie", "")
                if "proactive_session=" in set_cookie:
                    # Extract session value
                    import re
                    match = re.search(r'proactive_session=([^;]+)', set_cookie)
                    if match:
                        cookie = match.group(1)
            
            if cookie:
                print(f"✅ Login as {role} ({account['email']}) successful")
                return cookie
            else:
                print(f"❌ Login as {role} succeeded but no session cookie found")
                print(f"   Cookies: {resp.cookies}")
                print(f"   Set-Cookie header: {resp.headers.get('Set-Cookie', 'None')[:100]}")
                return None
        else:
            print(f"❌ Login as {role} failed: {resp.status_code}")
            print(f"   Response: {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"❌ Login as {role} exception: {e}")
        return None

def get_real_patient_id(cookie: str) -> Optional[str]:
    """Get a real patientId via GET /api/patients/search?q=a&limit=1"""
    try:
        resp = requests.get(
            f"{BASE_URL}/api/patients/search?q=a&limit=1",
            cookies={"proactive_session": cookie},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("results") and len(data["results"]) > 0:
                patient_id = data["results"][0].get("id")
                patient_name = f"{data['results'][0].get('firstName', '')} {data['results'][0].get('lastName', '')}"
                print(f"✅ Found real patient: {patient_name} (ID: {patient_id})")
                return patient_id
            else:
                print("❌ No patients found in search results")
                return None
        else:
            print(f"❌ Patient search failed: {resp.status_code}")
            return None
    except Exception as e:
        print(f"❌ Patient search exception: {e}")
        return None

def mask_sensitive_data(text: str) -> str:
    """Mask sensitive data in URLs and responses."""
    # Mask data parameter (encrypted payload)
    text = re.sub(r'data=[^&\s]+', 'data=***MASKED***', text)
    # Mask useremail parameter
    text = re.sub(r'useremail=[^&\s]+', 'useremail=***MASKED***', text)
    # Mask any email addresses
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '***@***.***', text)
    return text

def test_rxlog_url():
    """
    Test (A) GET /api/weno/rxlog-url
    This endpoint only BUILDS a URL (no external network call), so it must be deterministic.
    """
    print("\n" + "="*80)
    print("TEST (A) GET /api/weno/rxlog-url - RxLog view-on-demand URL endpoint")
    print("="*80)
    
    # A1: No session -> 401
    print("\n[A1] No session -> 401")
    try:
        resp = requests.get(f"{BASE_URL}/api/weno/rxlog-url", timeout=10)
        if resp.status_code == 401:
            print(f"✅ PASS: No session correctly returns 401")
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}")
            print(f"   Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # A2: Nurse session -> 403
    print("\n[A2] Nurse session -> 403 (mentions prescriber/admin)")
    nurse_cookie = login("nurse")
    if nurse_cookie:
        try:
            resp = requests.get(
                f"{BASE_URL}/api/weno/rxlog-url",
                cookies={"proactive_session": nurse_cookie},
                timeout=10
            )
            if resp.status_code == 403:
                body = resp.json()
                error_msg = body.get("error", "")
                if "prescriber" in error_msg.lower() or "admin" in error_msg.lower():
                    print(f"✅ PASS: Nurse session returns 403 with prescriber/admin mention")
                    print(f"   Error message: {error_msg}")
                else:
                    print(f"⚠️  PASS (403) but error message doesn't mention prescriber/admin: {error_msg}")
            else:
                print(f"❌ FAIL: Expected 403, got {resp.status_code}")
                print(f"   Response: {resp.text[:200]}")
        except Exception as e:
            print(f"❌ FAIL: Exception: {e}")
    
    # A3: Admin session -> 200 with JSON {iframeUrl, environment}
    print("\n[A3] Admin session -> 200 with {iframeUrl, environment}")
    admin_cookie = login("admin")
    if admin_cookie:
        try:
            resp = requests.get(
                f"{BASE_URL}/api/weno/rxlog-url",
                cookies={"proactive_session": admin_cookie},
                timeout=10
            )
            if resp.status_code == 500:
                print(f"❌ CRITICAL FAIL: HTTP 500 (absolute failure condition)")
                print(f"   Response: {resp.text[:300]}")
            elif resp.status_code == 200:
                body = resp.json()
                iframe_url = body.get("iframeUrl", "")
                environment = body.get("environment", "")
                
                # Mask the URL before printing
                masked_url = mask_sensitive_data(iframe_url)
                
                print(f"✅ PASS: Admin session returns 200")
                print(f"   Environment: {environment}")
                print(f"   iframeUrl (masked): {masked_url}")
                
                # Assert (case-insensitive): iframeUrl contains 'wenoexchange.com'
                if "wenoexchange.com" in iframe_url.lower():
                    print(f"   ✅ iframeUrl contains 'wenoexchange.com'")
                else:
                    print(f"   ❌ iframeUrl does NOT contain 'wenoexchange.com'")
                
                # Assert: iframeUrl contains '/RxLog'
                if "/RxLog" in iframe_url or "/rxlog" in iframe_url.lower():
                    print(f"   ✅ iframeUrl contains '/RxLog'")
                else:
                    print(f"   ❌ iframeUrl does NOT contain '/RxLog'")
                
                # Assert: iframeUrl contains 'useremail='
                if "useremail=" in iframe_url:
                    print(f"   ✅ iframeUrl contains 'useremail='")
                else:
                    print(f"   ❌ iframeUrl does NOT contain 'useremail='")
                
                # Assert: iframeUrl contains '&data='
                if "&data=" in iframe_url or "?data=" in iframe_url:
                    print(f"   ✅ iframeUrl contains '&data='")
                else:
                    print(f"   ❌ iframeUrl does NOT contain '&data='")
                
                # Assert: environment === 'test'
                if environment == "test":
                    print(f"   ✅ environment === 'test'")
                else:
                    print(f"   ⚠️  environment is '{environment}' (expected 'test')")
            else:
                print(f"❌ FAIL: Expected 200, got {resp.status_code}")
                print(f"   Response: {resp.text[:300]}")
        except Exception as e:
            print(f"❌ FAIL: Exception: {e}")
    
    # A4: Provider session -> 200 (allowed, not 403)
    print("\n[A4] Provider session -> 200 (allowed)")
    provider_cookie = login("provider")
    if provider_cookie:
        try:
            resp = requests.get(
                f"{BASE_URL}/api/weno/rxlog-url",
                cookies={"proactive_session": provider_cookie},
                timeout=10
            )
            if resp.status_code == 500:
                print(f"❌ CRITICAL FAIL: HTTP 500 (absolute failure condition)")
                print(f"   Response: {resp.text[:300]}")
            elif resp.status_code == 200:
                print(f"✅ PASS: Provider session returns 200 (allowed)")
            elif resp.status_code == 403:
                print(f"❌ FAIL: Provider session returns 403 (should be allowed)")
            else:
                print(f"⚠️  Unexpected status: {resp.status_code}")
                print(f"   Response: {resp.text[:200]}")
        except Exception as e:
            print(f"❌ FAIL: Exception: {e}")

def test_rx_sync():
    """
    Test (B) POST /api/weno/rx-sync?patientId=<realId>&days=7
    This DOES call the live Weno TEST sync endpoint. In preview the Weno TEST account
    may be unreachable or return an error — that is ACCEPTABLE. The requirement is that
    the route returns a CLEAN JSON response (either success OR a 4xx/502 error) and NEVER an HTTP 500.
    """
    print("\n" + "="*80)
    print("TEST (B) POST /api/weno/rx-sync - NewRx Sync import into medication history")
    print("="*80)
    
    # Get admin cookie and real patient ID
    admin_cookie = login("admin")
    if not admin_cookie:
        print("❌ Cannot proceed without admin login")
        return
    
    patient_id = get_real_patient_id(admin_cookie)
    if not patient_id:
        print("❌ Cannot proceed without a real patient ID")
        return
    
    # B1: No session -> 401
    print("\n[B1] No session -> 401")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/weno/rx-sync?patientId={patient_id}&days=7",
            timeout=60
        )
        if resp.status_code == 401:
            print(f"✅ PASS: No session correctly returns 401")
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}")
            print(f"   Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # B2: Nurse session -> 403
    print("\n[B2] Nurse session -> 403 (mentions prescriber/admin)")
    nurse_cookie = login("nurse")
    if nurse_cookie:
        try:
            resp = requests.post(
                f"{BASE_URL}/api/weno/rx-sync?patientId={patient_id}&days=7",
                cookies={"proactive_session": nurse_cookie},
                timeout=60
            )
            if resp.status_code == 403:
                body = resp.json()
                error_msg = body.get("error", "")
                if "prescriber" in error_msg.lower() or "admin" in error_msg.lower():
                    print(f"✅ PASS: Nurse session returns 403 with prescriber/admin mention")
                    print(f"   Error message: {error_msg}")
                else:
                    print(f"⚠️  PASS (403) but error message doesn't mention prescriber/admin: {error_msg}")
            else:
                print(f"❌ FAIL: Expected 403, got {resp.status_code}")
                print(f"   Response: {resp.text[:200]}")
        except Exception as e:
            print(f"❌ FAIL: Exception: {e}")
    
    # B3: Admin session, POST /api/weno/rx-sync?patientId=<realId>&days=7
    print(f"\n[B3] Admin session, POST /api/weno/rx-sync?patientId={patient_id}&days=7")
    print("     EITHER 200 {ok:true, ...} OR a clean 4xx/502 {error:...}. MUST NOT be 500.")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/weno/rx-sync?patientId={patient_id}&days=7",
            cookies={"proactive_session": admin_cookie},
            timeout=60
        )
        
        if resp.status_code == 500:
            print(f"❌ CRITICAL FAIL: HTTP 500 (absolute failure condition)")
            print(f"   Response: {resp.text[:300]}")
        elif resp.status_code == 200:
            body = resp.json()
            print(f"✅ PASS: Returns 200 (success)")
            print(f"   ok: {body.get('ok')}")
            print(f"   environment: {body.get('environment')}")
            
            range_obj = body.get("range", {})
            from_date = range_obj.get("from")
            to_date = range_obj.get("to")
            print(f"   range.from: {from_date}")
            print(f"   range.to: {to_date}")
            
            # Assert range.from and range.to are YYYY-MM-DD strings
            if from_date and re.match(r'^\d{4}-\d{2}-\d{2}$', from_date):
                print(f"   ✅ range.from is YYYY-MM-DD format")
            else:
                print(f"   ❌ range.from is NOT YYYY-MM-DD format: {from_date}")
            
            if to_date and re.match(r'^\d{4}-\d{2}-\d{2}$', to_date):
                print(f"   ✅ range.to is YYYY-MM-DD format")
            else:
                print(f"   ❌ range.to is NOT YYYY-MM-DD format: {to_date}")
            
            # Assert imported/skipped/rowCount/matched are numbers
            row_count = body.get("rowCount")
            matched = body.get("matched")
            imported = body.get("imported")
            skipped = body.get("skipped")
            
            print(f"   rowCount: {row_count} (type: {type(row_count).__name__})")
            print(f"   matched: {matched} (type: {type(matched).__name__})")
            print(f"   imported: {imported} (type: {type(imported).__name__})")
            print(f"   skipped: {skipped} (type: {type(skipped).__name__})")
            
            if isinstance(row_count, int):
                print(f"   ✅ rowCount is a number")
            else:
                print(f"   ❌ rowCount is NOT a number")
            
            if isinstance(matched, int):
                print(f"   ✅ matched is a number")
            else:
                print(f"   ❌ matched is NOT a number")
            
            if isinstance(imported, int):
                print(f"   ✅ imported is a number")
            else:
                print(f"   ❌ imported is NOT a number")
            
            if isinstance(skipped, int):
                print(f"   ✅ skipped is a number")
            else:
                print(f"   ❌ skipped is NOT a number")
            
            imported_names = body.get("importedNames", [])
            print(f"   importedNames: {imported_names[:3]}... (showing first 3)")
            
        elif resp.status_code in [400, 401, 403, 404, 502]:
            body = resp.json()
            error_msg = body.get("error", "")
            print(f"✅ PASS: Returns clean {resp.status_code} error (acceptable)")
            print(f"   Error: {error_msg[:200]}")
        else:
            print(f"⚠️  Unexpected status: {resp.status_code}")
            print(f"   Response: {resp.text[:300]}")
    except requests.exceptions.Timeout:
        print(f"⚠️  Request timed out after 60s (Weno TEST endpoint may be slow/unreachable)")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # B4: Admin session, POST /api/weno/rx-sync?patientId=<realId>&days=30
    print(f"\n[B4] Admin session, POST /api/weno/rx-sync?patientId={patient_id}&days=30")
    print("     Window must clamp to max 7 days (range spans <=7 days). MUST NOT be 500.")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/weno/rx-sync?patientId={patient_id}&days=30",
            cookies={"proactive_session": admin_cookie},
            timeout=60
        )
        
        if resp.status_code == 500:
            print(f"❌ CRITICAL FAIL: HTTP 500 (absolute failure condition)")
            print(f"   Response: {resp.text[:300]}")
        elif resp.status_code == 200:
            body = resp.json()
            range_obj = body.get("range", {})
            from_date = range_obj.get("from")
            to_date = range_obj.get("to")
            
            print(f"✅ PASS: Returns 200")
            print(f"   range.from: {from_date}")
            print(f"   range.to: {to_date}")
            
            # Compute day difference
            if from_date and to_date:
                from datetime import datetime
                from_dt = datetime.strptime(from_date, "%Y-%m-%d")
                to_dt = datetime.strptime(to_date, "%Y-%m-%d")
                day_diff = (to_dt - from_dt).days
                
                print(f"   Day difference: {day_diff} days")
                
                if day_diff <= 6:
                    print(f"   ✅ Window clamped to max 7 days (inclusive: {day_diff + 1} days)")
                else:
                    print(f"   ❌ Window NOT clamped: {day_diff} days apart (should be <= 6)")
        elif resp.status_code in [400, 401, 403, 404, 502]:
            body = resp.json()
            error_msg = body.get("error", "")
            print(f"✅ PASS: Returns clean {resp.status_code} error (acceptable)")
            print(f"   Error: {error_msg[:200]}")
        else:
            print(f"⚠️  Unexpected status: {resp.status_code}")
            print(f"   Response: {resp.text[:300]}")
    except requests.exceptions.Timeout:
        print(f"⚠️  Request timed out after 60s")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")
    
    # B5: Admin session, POST /api/weno/rx-sync?patientId=<realId>&days=abc
    print(f"\n[B5] Admin session, POST /api/weno/rx-sync?patientId={patient_id}&days=abc")
    print("     days should default to 7. MUST NOT be 500.")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/weno/rx-sync?patientId={patient_id}&days=abc",
            cookies={"proactive_session": admin_cookie},
            timeout=60
        )
        
        if resp.status_code == 500:
            print(f"❌ CRITICAL FAIL: HTTP 500 (absolute failure condition)")
            print(f"   Response: {resp.text[:300]}")
        elif resp.status_code == 200:
            body = resp.json()
            range_obj = body.get("range", {})
            from_date = range_obj.get("from")
            to_date = range_obj.get("to")
            
            print(f"✅ PASS: Returns 200 (days defaulted to 7)")
            print(f"   range.from: {from_date}")
            print(f"   range.to: {to_date}")
            
            # Verify it's a 7-day window
            if from_date and to_date:
                from datetime import datetime
                from_dt = datetime.strptime(from_date, "%Y-%m-%d")
                to_dt = datetime.strptime(to_date, "%Y-%m-%d")
                day_diff = (to_dt - from_dt).days
                
                print(f"   Day difference: {day_diff} days")
                
                if day_diff <= 6:
                    print(f"   ✅ Window is 7 days or less (inclusive: {day_diff + 1} days)")
                else:
                    print(f"   ⚠️  Window is {day_diff} days apart")
        elif resp.status_code in [400, 401, 403, 404, 502]:
            body = resp.json()
            error_msg = body.get("error", "")
            print(f"✅ PASS: Returns clean {resp.status_code} error (acceptable)")
            print(f"   Error: {error_msg[:200]}")
        else:
            print(f"⚠️  Unexpected status: {resp.status_code}")
            print(f"   Response: {resp.text[:300]}")
    except requests.exceptions.Timeout:
        print(f"⚠️  Request timed out after 60s")
    except Exception as e:
        print(f"❌ FAIL: Exception: {e}")

def main():
    print("="*80)
    print("WENO BACKEND TEST: RxLog URL + NewRx Sync")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"CRITICAL: The absolute failure condition is HTTP 500")
    print("="*80)
    
    # Test (A) GET /api/weno/rxlog-url
    test_rxlog_url()
    
    # Test (B) POST /api/weno/rx-sync
    test_rx_sync()
    
    print("\n" + "="*80)
    print("WENO BACKEND TEST COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
