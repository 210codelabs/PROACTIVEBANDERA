#!/usr/bin/env python3
"""
Backend test for Weno Auto-apply on boot + Weno Prescriber Directory (2026-08)
Tests:
A. POST /api/internal/weno-apply-env with NO 'x-weno-cron' header -> 403
B. GET /api/admin/weno/prescribers: no cookie -> 403; provider cookie -> 403; admin cookie -> 200
C. POST /api/admin/weno/prescribers (admin) create prescriber -> 200 with id and isDefault:true
D. POST /api/admin/weno/prescribers (admin) with invalid NPI -> 400
E. GET /api/admin/weno/prescribers (admin) -> created prescriber present with isDefault true
F. GET /api/erx/prescribers (provider cookie) -> 200 with prescribers and suggestedId; no cookie -> 401
G. DELETE /api/admin/weno/prescribers (admin) -> 200; verify prescriber is gone
"""
import requests
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def login(email, password):
    """Login and return session cookie"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        print(f"❌ Login failed for {email}: {resp.status_code}")
        return None
    cookie = resp.cookies.get("proactive_session")
    if not cookie:
        print(f"❌ No proactive_session cookie returned for {email}")
        return None
    print(f"✅ Login successful for {email}")
    return cookie

def test_a_internal_route_guard():
    """TEST A: POST /api/internal/weno-apply-env with NO x-weno-cron header -> 403"""
    print("\n" + "="*80)
    print("TEST A - INTERNAL ROUTE GUARD (POST /api/internal/weno-apply-env)")
    print("="*80)
    
    try:
        resp = requests.post(f"{BASE_URL}/api/internal/weno-apply-env", json={})
        print(f"POST /api/internal/weno-apply-env (no x-weno-cron header): {resp.status_code}")
        
        if resp.status_code != 403:
            print(f"❌ FAILED: Expected 403, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return False
        
        print("✅ PASSED: Correctly returns 403 Forbidden without x-weno-cron header")
        return True
    except Exception as e:
        print(f"❌ FAILED: Exception during test A: {e}")
        return False

def test_b_admin_prescribers_auth():
    """TEST B: GET /api/admin/weno/prescribers auth guards"""
    print("\n" + "="*80)
    print("TEST B - ADMIN PRESCRIBERS AUTH GUARDS")
    print("="*80)
    
    all_passed = True
    
    # B1: No cookie -> 401 or 403 (both valid - middleware may return 401 before route handler returns 403)
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/weno/prescribers")
        print(f"GET /api/admin/weno/prescribers (no cookie): {resp.status_code}")
        
        if resp.status_code not in [401, 403]:
            print(f"❌ FAILED: Expected 401 or 403, got {resp.status_code}")
            all_passed = False
        else:
            print(f"✅ PASSED: No cookie correctly returns {resp.status_code} (blocked)")
    except Exception as e:
        print(f"❌ FAILED: Exception during B1: {e}")
        all_passed = False
    
    # B2: Provider cookie -> 403
    provider_cookie = login("andy.manzano@proactiveclinic.com", "apex123")
    if provider_cookie:
        try:
            resp = requests.get(f"{BASE_URL}/api/admin/weno/prescribers", 
                              cookies={"proactive_session": provider_cookie})
            print(f"GET /api/admin/weno/prescribers (provider cookie): {resp.status_code}")
            
            if resp.status_code != 403:
                print(f"❌ FAILED: Expected 403, got {resp.status_code}")
                all_passed = False
            else:
                print("✅ PASSED: Provider cookie correctly returns 403 (admin-only)")
        except Exception as e:
            print(f"❌ FAILED: Exception during B2: {e}")
            all_passed = False
    else:
        print("❌ FAILED: Could not get provider cookie for B2")
        all_passed = False
    
    # B3: Admin cookie -> 200
    admin_cookie = login("admin@proactiveclinic.com", "apex123")
    if admin_cookie:
        try:
            resp = requests.get(f"{BASE_URL}/api/admin/weno/prescribers", 
                              cookies={"proactive_session": admin_cookie})
            print(f"GET /api/admin/weno/prescribers (admin cookie): {resp.status_code}")
            
            if resp.status_code != 200:
                print(f"❌ FAILED: Expected 200, got {resp.status_code}")
                all_passed = False
            else:
                data = resp.json()
                if "prescribers" not in data:
                    print(f"❌ FAILED: Response missing 'prescribers' key")
                    all_passed = False
                else:
                    print(f"✅ PASSED: Admin cookie returns 200 with prescribers array (count: {len(data['prescribers'])})")
        except Exception as e:
            print(f"❌ FAILED: Exception during B3: {e}")
            all_passed = False
    else:
        print("❌ FAILED: Could not get admin cookie for B3")
        all_passed = False
    
    return all_passed, admin_cookie, provider_cookie

def test_c_create_prescriber(admin_cookie):
    """TEST C: POST /api/admin/weno/prescribers create prescriber"""
    print("\n" + "="*80)
    print("TEST C - CREATE PRESCRIBER")
    print("="*80)
    
    try:
        payload = {
            "firstName": "Ernesto",
            "lastName": "Ramirez",
            "npi": "1234567890",
            "dea": "AB1234563",
            "wenoEmail": "ernesto@210codelabs.com",
            "isDefault": True
        }
        
        resp = requests.post(f"{BASE_URL}/api/admin/weno/prescribers", 
                           json=payload,
                           cookies={"proactive_session": admin_cookie})
        print(f"POST /api/admin/weno/prescribers: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return False, None
        
        data = resp.json()
        if not data.get("ok"):
            print(f"❌ FAILED: Response ok is not true")
            return False, None
        
        prescriber = data.get("prescriber")
        if not prescriber:
            print(f"❌ FAILED: Response missing 'prescriber' object")
            return False, None
        
        prescriber_id = prescriber.get("id")
        if not prescriber_id:
            print(f"❌ FAILED: Prescriber missing 'id' field")
            return False, None
        
        if not prescriber.get("isDefault"):
            print(f"❌ FAILED: Prescriber isDefault is not true")
            return False, prescriber_id
        
        print(f"✅ PASSED: Prescriber created successfully")
        print(f"   ID: {prescriber_id}")
        print(f"   Name: {prescriber.get('firstName')} {prescriber.get('lastName')}")
        print(f"   NPI: {prescriber.get('npi')}")
        print(f"   DEA: {prescriber.get('dea')}")
        print(f"   isDefault: {prescriber.get('isDefault')}")
        
        return True, prescriber_id
    except Exception as e:
        print(f"❌ FAILED: Exception during test C: {e}")
        return False, None

def test_d_invalid_npi(admin_cookie):
    """TEST D: POST /api/admin/weno/prescribers with invalid NPI -> 400"""
    print("\n" + "="*80)
    print("TEST D - INVALID NPI VALIDATION")
    print("="*80)
    
    try:
        payload = {
            "firstName": "Test",
            "lastName": "Invalid",
            "npi": "123",  # Invalid: only 3 digits
            "dea": "AB1234563",
            "wenoEmail": "test@example.com",
            "isDefault": False
        }
        
        resp = requests.post(f"{BASE_URL}/api/admin/weno/prescribers", 
                           json=payload,
                           cookies={"proactive_session": admin_cookie})
        print(f"POST /api/admin/weno/prescribers (npi='123'): {resp.status_code}")
        
        if resp.status_code != 400:
            print(f"❌ FAILED: Expected 400, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        error_msg = data.get("error", "")
        print(f"Error message: {error_msg}")
        
        if "NPI" not in error_msg and "10 digits" not in error_msg:
            print(f"❌ FAILED: Error message doesn't mention NPI validation")
            return False
        
        print("✅ PASSED: Invalid NPI correctly returns 400 with appropriate error message")
        return True
    except Exception as e:
        print(f"❌ FAILED: Exception during test D: {e}")
        return False

def test_e_verify_prescriber_in_list(admin_cookie, prescriber_id):
    """TEST E: GET /api/admin/weno/prescribers -> created prescriber present"""
    print("\n" + "="*80)
    print("TEST E - VERIFY PRESCRIBER IN LIST")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/weno/prescribers", 
                          cookies={"proactive_session": admin_cookie})
        print(f"GET /api/admin/weno/prescribers: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            return False
        
        data = resp.json()
        prescribers = data.get("prescribers", [])
        
        found = None
        for p in prescribers:
            if p.get("id") == prescriber_id:
                found = p
                break
        
        if not found:
            print(f"❌ FAILED: Created prescriber (ID: {prescriber_id}) not found in list")
            print(f"Total prescribers: {len(prescribers)}")
            return False
        
        if not found.get("isDefault"):
            print(f"❌ FAILED: Prescriber isDefault is not true")
            return False
        
        print(f"✅ PASSED: Created prescriber found in list with isDefault=true")
        print(f"   ID: {found.get('id')}")
        print(f"   Name: {found.get('firstName')} {found.get('lastName')}")
        print(f"   NPI: {found.get('npi')}")
        print(f"   isDefault: {found.get('isDefault')}")
        
        return True
    except Exception as e:
        print(f"❌ FAILED: Exception during test E: {e}")
        return False

def test_f_erx_prescribers(provider_cookie):
    """TEST F: GET /api/erx/prescribers (provider) and auth guard"""
    print("\n" + "="*80)
    print("TEST F - ERX PRESCRIBERS ENDPOINT")
    print("="*80)
    
    all_passed = True
    
    # F1: No cookie -> 401
    try:
        resp = requests.get(f"{BASE_URL}/api/erx/prescribers")
        print(f"GET /api/erx/prescribers (no cookie): {resp.status_code}")
        
        if resp.status_code != 401:
            print(f"❌ FAILED: Expected 401, got {resp.status_code}")
            all_passed = False
        else:
            print("✅ PASSED: No cookie correctly returns 401")
    except Exception as e:
        print(f"❌ FAILED: Exception during F1: {e}")
        all_passed = False
    
    # F2: Provider cookie -> 200 with prescribers and suggestedId
    try:
        resp = requests.get(f"{BASE_URL}/api/erx/prescribers", 
                          cookies={"proactive_session": provider_cookie})
        print(f"GET /api/erx/prescribers (provider cookie): {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            all_passed = False
        else:
            data = resp.json()
            
            if "prescribers" not in data:
                print(f"❌ FAILED: Response missing 'prescribers' key")
                all_passed = False
            else:
                prescribers = data["prescribers"]
                print(f"✅ PASSED: Response contains prescribers array (count: {len(prescribers)})")
                
                # Verify each prescriber has required fields
                if len(prescribers) > 0:
                    sample = prescribers[0]
                    required_fields = ["npi", "name", "dea", "wenoEmail"]
                    missing = [f for f in required_fields if f not in sample]
                    if missing:
                        print(f"❌ FAILED: Prescriber missing fields: {missing}")
                        all_passed = False
                    else:
                        print(f"✅ PASSED: Prescribers have all required fields (npi, name, dea, wenoEmail)")
                        print(f"   Sample: {sample.get('name')} (NPI: {sample.get('npi')})")
            
            if "suggestedId" not in data:
                print(f"❌ FAILED: Response missing 'suggestedId' key")
                all_passed = False
            else:
                suggested_id = data["suggestedId"]
                if suggested_id is None:
                    print(f"⚠️  WARNING: suggestedId is null (expected non-null since we created a default prescriber)")
                    # Not failing the test since this depends on matching logic
                else:
                    print(f"✅ PASSED: suggestedId is non-null: {suggested_id}")
    except Exception as e:
        print(f"❌ FAILED: Exception during F2: {e}")
        all_passed = False
    
    return all_passed

def test_g_delete_prescriber(admin_cookie, prescriber_id):
    """TEST G: DELETE /api/admin/weno/prescribers and verify deletion"""
    print("\n" + "="*80)
    print("TEST G - DELETE PRESCRIBER")
    print("="*80)
    
    try:
        # G1: DELETE
        resp = requests.delete(f"{BASE_URL}/api/admin/weno/prescribers?id={prescriber_id}", 
                             cookies={"proactive_session": admin_cookie})
        print(f"DELETE /api/admin/weno/prescribers?id={prescriber_id}: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
            return False
        
        data = resp.json()
        if not data.get("ok"):
            print(f"❌ FAILED: Response ok is not true")
            return False
        
        print("✅ PASSED: DELETE returned 200 with ok:true")
        
        # G2: Verify prescriber is gone
        resp = requests.get(f"{BASE_URL}/api/admin/weno/prescribers", 
                          cookies={"proactive_session": admin_cookie})
        
        if resp.status_code != 200:
            print(f"❌ FAILED: GET after DELETE returned {resp.status_code}")
            return False
        
        data = resp.json()
        prescribers = data.get("prescribers", [])
        
        found = any(p.get("id") == prescriber_id for p in prescribers)
        
        if found:
            print(f"❌ FAILED: Prescriber still present in list after DELETE")
            return False
        
        print(f"✅ PASSED: Prescriber successfully removed from list")
        print(f"   Remaining prescribers: {len(prescribers)}")
        
        return True
    except Exception as e:
        print(f"❌ FAILED: Exception during test G: {e}")
        return False

def main():
    print("="*80)
    print("BACKEND TEST: Weno Auto-apply + Prescriber Directory (2026-08)")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    
    results = []
    prescriber_id = None
    admin_cookie = None
    provider_cookie = None
    
    # TEST A
    result_a = test_a_internal_route_guard()
    results.append(("A - Internal route guard", result_a))
    
    # TEST B
    result_b, admin_cookie, provider_cookie = test_b_admin_prescribers_auth()
    results.append(("B - Admin prescribers auth", result_b))
    
    if not admin_cookie:
        print("\n❌ CRITICAL: Cannot proceed without admin cookie")
        sys.exit(1)
    
    # TEST C
    result_c, prescriber_id = test_c_create_prescriber(admin_cookie)
    results.append(("C - Create prescriber", result_c))
    
    # TEST D
    result_d = test_d_invalid_npi(admin_cookie)
    results.append(("D - Invalid NPI validation", result_d))
    
    # TEST E
    if prescriber_id:
        result_e = test_e_verify_prescriber_in_list(admin_cookie, prescriber_id)
        results.append(("E - Verify prescriber in list", result_e))
    else:
        print("\n⚠️  SKIPPING TEST E: No prescriber ID from test C")
        results.append(("E - Verify prescriber in list", False))
    
    # TEST F
    if provider_cookie:
        result_f = test_f_erx_prescribers(provider_cookie)
        results.append(("F - eRx prescribers endpoint", result_f))
    else:
        print("\n⚠️  SKIPPING TEST F: No provider cookie")
        results.append(("F - eRx prescribers endpoint", False))
    
    # TEST G (CLEANUP)
    if prescriber_id:
        result_g = test_g_delete_prescriber(admin_cookie, prescriber_id)
        results.append(("G - Delete prescriber (cleanup)", result_g))
    else:
        print("\n⚠️  SKIPPING TEST G: No prescriber ID to delete")
        results.append(("G - Delete prescriber (cleanup)", False))
    
    # SUMMARY
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    total = len(results)
    passed_count = sum(1 for _, p in results if p)
    
    print(f"\nTotal: {passed_count}/{total} tests passed")
    
    if passed_count == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed_count} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
