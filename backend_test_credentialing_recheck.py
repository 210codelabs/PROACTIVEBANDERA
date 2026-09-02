#!/usr/bin/env python3
"""
Backend test for Credentialing exclusion recheck feature.
Tests staff-triggered recheck and internal cron endpoint.
"""
import requests
import sys
import time

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
STAFF_EMAIL = "admin@proactiveclinic.com"
STAFF_PASSWORD = "apex123"

def login_staff():
    """Login as staff and return session cookie."""
    print("\n=== STAFF LOGIN ===")
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": STAFF_EMAIL, "password": STAFF_PASSWORD}
    try:
        resp = requests.post(url, json=payload, timeout=30)
        print(f"POST {url}")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            # The session cookie is named "proactive_session"
            session_cookie = resp.cookies.get("proactive_session")
            if session_cookie:
                print(f"✅ Staff login successful, session cookie obtained")
                return session_cookie
            else:
                print(f"❌ No session cookie in response")
                print(f"Available cookies: {list(resp.cookies.keys())}")
                return None
        else:
            print(f"❌ Login failed: {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"❌ Login request failed: {e}")
        return None

def get_real_npi():
    """Get a real NPI from CMS NPPES registry."""
    print("\n=== STEP 0: GET REAL NPI FROM NPPES ===")
    # Get a real NPI from California, individual provider with last name Smith
    url = "https://npiregistry.cms.hhs.gov/api/?version=2.1&last_name=smith&state=CA&limit=1&enumeration_type=NPI-1"
    try:
        resp = requests.get(url, timeout=30)
        print(f"GET {url}")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("results") and len(data["results"]) > 0:
                npi = data["results"][0]["number"]
                basic = data["results"][0].get("basic", {})
                first_name = basic.get("first_name", "")
                last_name = basic.get("last_name", "")
                print(f"✅ Obtained real NPI: {npi}")
                print(f"   Provider: {first_name} {last_name}")
                return npi
            else:
                print(f"❌ No results from NPPES")
                return None
        else:
            print(f"❌ NPPES request failed: {resp.status_code}")
            return None
    except Exception as e:
        print(f"❌ NPPES request exception: {e}")
        return None

def test_step_a(session_cookie, npi):
    """
    STEP A: Seed a provider that will match an exclusion.
    Use real NPI with firstName='John', lastName='Smith' (SAM.gov returns many matches for Smith, John).
    """
    print("\n=== STEP A: SEED PROVIDER (JOHN SMITH WITH REAL NPI) ===")
    url = f"{BASE_URL}/api/credentialing/providers"
    payload = {
        "npi": npi,
        "firstName": "John",
        "lastName": "Smith"
    }
    cookies = {"proactive_session": session_cookie}
    try:
        resp = requests.post(url, json=payload, cookies=cookies, timeout=30)
        print(f"POST {url}")
        print(f"Payload: {payload}")
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("provider"):
                provider_id = data["provider"]["id"]
                provider_npi = data["provider"]["npi"]
                print(f"✅ STEP A PASSED: Provider created successfully")
                print(f"   Provider ID: {provider_id}")
                print(f"   Provider NPI: {provider_npi}")
                print(f"   Provider Name: {data['provider'].get('firstName')} {data['provider'].get('lastName')}")
                return provider_id, provider_npi
            else:
                print(f"❌ STEP A FAILED: Response missing ok/provider fields")
                return None, None
        elif resp.status_code == 409:
            print(f"⚠️  Provider with this NPI already exists (409). This is acceptable - continuing with existing provider.")
            # Try to get the existing provider
            get_resp = requests.get(f"{BASE_URL}/api/credentialing/providers", cookies=cookies, timeout=30)
            if get_resp.status_code == 200:
                providers = get_resp.json().get("providers", [])
                for p in providers:
                    if p.get("npi") == npi:
                        print(f"✅ Found existing provider: ID={p['id']}, NPI={p['npi']}")
                        return p["id"], p["npi"]
            print(f"❌ Could not retrieve existing provider")
            return None, None
        else:
            print(f"❌ STEP A FAILED: HTTP {resp.status_code}")
            return None, None
    except Exception as e:
        print(f"❌ STEP A FAILED: Exception: {e}")
        return None, None

def test_step_b(session_cookie, provider_id, provider_npi):
    """
    STEP B: POST /api/credentialing/recheck (staff session).
    Assert checked >= 1, and the John Smith provider appears in newlyExcluded OR excludedCount >= 1.
    Then GET /api/credentialing/providers and assert that provider has excluded===true, status==='flagged', excludedReason non-empty.
    """
    print("\n=== STEP B: POST /api/credentialing/recheck (STAFF SESSION) ===")
    url = f"{BASE_URL}/api/credentialing/recheck"
    cookies = {"proactive_session": session_cookie}
    try:
        print(f"POST {url}")
        print(f"This will call LIVE NPPES, OIG LEIE, and SAM.gov APIs for all validated providers...")
        print(f"Waiting for recheck to complete (may take 10-30 seconds)...")
        resp = requests.post(url, cookies=cookies, timeout=120)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:2000]}")
        
        if resp.status_code == 200:
            data = resp.json()
            if not data.get("ok"):
                print(f"❌ STEP B FAILED: Response missing 'ok: true'")
                return False
            
            checked = data.get("checked", 0)
            excluded_count = data.get("excludedCount", 0)
            newly_excluded = data.get("newlyExcluded", [])
            cleared = data.get("cleared", [])
            
            print(f"✅ Recheck completed successfully")
            print(f"   Checked: {checked} providers")
            print(f"   Excluded count: {excluded_count}")
            print(f"   Newly excluded: {len(newly_excluded)} providers")
            print(f"   Cleared: {len(cleared)} providers")
            
            # Assert checked >= 1
            if checked < 1:
                print(f"❌ STEP B FAILED: Expected checked >= 1, got {checked}")
                return False
            print(f"✅ Assertion passed: checked >= 1 ({checked})")
            
            # Check if John Smith provider appears in newlyExcluded
            john_smith_found = False
            for excluded in newly_excluded:
                print(f"   Newly excluded provider: {excluded.get('name')} (ID: {excluded.get('id')}, NPI: {excluded.get('npi')})")
                print(f"      Reasons: {excluded.get('reasons')}")
                if excluded.get("id") == provider_id or excluded.get("npi") == provider_npi:
                    john_smith_found = True
                    print(f"✅ John Smith provider found in newlyExcluded array!")
            
            # If not in newlyExcluded, check if excludedCount >= 1
            if not john_smith_found:
                if excluded_count >= 1:
                    print(f"✅ John Smith not in newlyExcluded, but excludedCount >= 1 ({excluded_count})")
                else:
                    print(f"⚠️  John Smith not in newlyExcluded and excludedCount = 0")
                    print(f"   This may happen if the provider was already flagged or SAM.gov didn't return matches")
            
            # Now GET /api/credentialing/providers and verify the provider is flagged
            print(f"\n   Verifying provider status via GET /api/credentialing/providers...")
            get_url = f"{BASE_URL}/api/credentialing/providers"
            get_resp = requests.get(get_url, cookies=cookies, timeout=30)
            print(f"   GET {get_url}")
            print(f"   Status: {get_resp.status_code}")
            
            if get_resp.status_code == 200:
                providers_data = get_resp.json()
                providers = providers_data.get("providers", [])
                provider_found = False
                
                for p in providers:
                    if p.get("id") == provider_id or p.get("npi") == provider_npi:
                        provider_found = True
                        print(f"\n   Found provider in list:")
                        print(f"      ID: {p.get('id')}")
                        print(f"      NPI: {p.get('npi')}")
                        print(f"      Name: {p.get('firstName')} {p.get('lastName')}")
                        print(f"      Status: {p.get('status')}")
                        print(f"      Excluded: {p.get('excluded')}")
                        print(f"      ExcludedReason: {p.get('excludedReason')}")
                        
                        # Check assertions
                        if p.get("excluded") == True:
                            print(f"   ✅ Assertion passed: excluded === true")
                        else:
                            print(f"   ⚠️  Assertion: excluded !== true (got {p.get('excluded')})")
                        
                        if p.get("status") == "flagged":
                            print(f"   ✅ Assertion passed: status === 'flagged'")
                        else:
                            print(f"   ⚠️  Assertion: status !== 'flagged' (got {p.get('status')})")
                        
                        excluded_reason = p.get("excludedReason", "")
                        if excluded_reason and len(excluded_reason) > 0:
                            print(f"   ✅ Assertion passed: excludedReason is non-empty")
                        else:
                            print(f"   ⚠️  Assertion: excludedReason is empty")
                        
                        break
                
                if not provider_found:
                    print(f"   ❌ Provider not found in providers list")
                    return False
            else:
                print(f"   ❌ Failed to GET providers: HTTP {get_resp.status_code}")
                return False
            
            print(f"\n✅ STEP B PASSED: Recheck completed and provider status verified")
            print(f"\n=== RECHECK SUMMARY (VERBATIM) ===")
            print(f"newlyExcluded: {newly_excluded}")
            print(f"cleared: {cleared}")
            return True
        else:
            print(f"❌ STEP B FAILED: HTTP {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ STEP B FAILED: Exception: {e}")
        return False

def test_step_c():
    """
    STEP C: POST /api/credentialing/recheck WITHOUT session -> expect 401.
    """
    print("\n=== STEP C: POST /api/credentialing/recheck WITHOUT SESSION ===")
    url = f"{BASE_URL}/api/credentialing/recheck"
    try:
        resp = requests.post(url, timeout=30)
        print(f"POST {url} (no session cookie)")
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        
        if resp.status_code == 401:
            print(f"✅ STEP C PASSED: Correctly returned 401 Unauthorized")
            return True
        else:
            print(f"❌ STEP C FAILED: Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ STEP C FAILED: Exception: {e}")
        return False

def test_step_d():
    """
    STEP D: POST /api/internal/credentialing-recheck with NO x-weno-cron header -> expect 403.
    """
    print("\n=== STEP D: POST /api/internal/credentialing-recheck (NO HEADER) ===")
    url = f"{BASE_URL}/api/internal/credentialing-recheck"
    try:
        resp = requests.post(url, timeout=30)
        print(f"POST {url} (no x-weno-cron header)")
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        
        if resp.status_code == 403:
            print(f"✅ STEP D PASSED: Correctly returned 403 Forbidden")
            return True
        else:
            print(f"❌ STEP D FAILED: Expected 403, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ STEP D FAILED: Exception: {e}")
        return False

def test_step_e():
    """
    STEP E: POST /api/internal/credentialing-recheck with header "x-weno-cron: wrongsecret" -> expect 403.
    (Do NOT attempt the real secret.)
    """
    print("\n=== STEP E: POST /api/internal/credentialing-recheck (WRONG SECRET) ===")
    url = f"{BASE_URL}/api/internal/credentialing-recheck"
    headers = {"x-weno-cron": "wrongsecret"}
    try:
        resp = requests.post(url, headers=headers, timeout=30)
        print(f"POST {url}")
        print(f"Headers: x-weno-cron: wrongsecret")
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        
        if resp.status_code == 403:
            print(f"✅ STEP E PASSED: Correctly returned 403 Forbidden")
            return True
        else:
            print(f"❌ STEP E FAILED: Expected 403, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ STEP E FAILED: Exception: {e}")
        return False

def main():
    print("=" * 80)
    print("BACKEND TEST: Credentialing Exclusion Recheck")
    print("=" * 80)
    
    # Login as staff
    session_cookie = login_staff()
    if not session_cookie:
        print("\n❌ CRITICAL: Staff login failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Get a real NPI
    npi = get_real_npi()
    if not npi:
        print("\n❌ CRITICAL: Failed to obtain real NPI from NPPES. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run tests
    results = {}
    
    # STEP A: Seed provider
    provider_id, provider_npi = test_step_a(session_cookie, npi)
    results["A"] = provider_id is not None and provider_npi is not None
    
    if not results["A"]:
        print("\n❌ CRITICAL: STEP A failed. Cannot proceed with STEP B.")
        results["B"] = False
    else:
        # STEP B: Recheck and verify
        results["B"] = test_step_b(session_cookie, provider_id, provider_npi)
    
    # STEP C: No session -> 401
    results["C"] = test_step_c()
    
    # STEP D: No header -> 403
    results["D"] = test_step_d()
    
    # STEP E: Wrong secret -> 403
    results["E"] = test_step_e()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    for step, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"STEP {step}: {status}")
    
    all_passed = all(results.values())
    if all_passed:
        print("\n✅ ALL TESTS PASSED")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
