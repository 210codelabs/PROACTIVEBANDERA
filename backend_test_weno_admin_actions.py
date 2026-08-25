#!/usr/bin/env python3
"""
Backend test for Admin one-click Weno actions:
1. POST /api/admin/weno/online/apply-env (populate Weno Online from env)
2. POST /api/admin/pharmacies/relabel-network (surescripts -> weno)

Test requirements:
- Admin: admin@proactiveclinic.com / apex123
- Provider (non-admin): andy.manzano@proactiveclinic.com / apex123
- Base URL: https://nextjs-ssr-stack.preview.emergentagent.com
"""

import requests
import json

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def login(email, password):
    """Login and return session cookie"""
    try:
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=30
        )
        if r.status_code == 200:
            cookie = r.cookies.get("proactive_session")
            if cookie:
                print(f"✅ Login successful for {email}")
                return cookie
            else:
                print(f"❌ Login failed for {email}: No session cookie")
                return None
        else:
            print(f"❌ Login failed for {email}: {r.status_code} {r.text[:200]}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {e}")
        return None

def test_apply_env_no_cookie():
    """TEST 1: POST /api/admin/weno/online/apply-env with NO cookie -> 401 or 403"""
    print("\n=== TEST 1: POST /api/admin/weno/online/apply-env WITHOUT auth cookie ===")
    try:
        r = requests.post(f"{BASE_URL}/api/admin/weno/online/apply-env", timeout=30)
        print(f"Status: {r.status_code}")
        # Accept both 401 (Unauthorized - no session) and 403 (Forbidden - no permission)
        # 401 is more semantically correct for "no cookie" scenario
        if r.status_code in [401, 403]:
            print(f"✅ TEST 1 PASSED: Correctly returns {r.status_code} without auth cookie (blocks unauthenticated access)")
            return True
        else:
            print(f"❌ TEST 1 FAILED: Expected 401 or 403, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 EXCEPTION: {e}")
        return False

def test_apply_env_provider_cookie(provider_cookie):
    """TEST 2: POST /api/admin/weno/online/apply-env with PROVIDER cookie (non-admin) -> 403"""
    print("\n=== TEST 2: POST /api/admin/weno/online/apply-env WITH provider cookie (non-admin) ===")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/weno/online/apply-env",
            cookies={"proactive_session": provider_cookie},
            timeout=30
        )
        print(f"Status: {r.status_code}")
        if r.status_code == 403:
            print("✅ TEST 2 PASSED: Correctly returns 403 Forbidden for non-admin provider")
            return True
        else:
            print(f"❌ TEST 2 FAILED: Expected 403, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 2 EXCEPTION: {e}")
        return False

def test_apply_env_admin_cookie(admin_cookie, provider_cookie):
    """TEST 3: POST /api/admin/weno/online/apply-env with ADMIN cookie -> 200 with applied[] and NO secret values"""
    print("\n=== TEST 3: POST /api/admin/weno/online/apply-env WITH admin cookie ===")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/weno/online/apply-env",
            cookies={"proactive_session": admin_cookie},
            timeout=30
        )
        print(f"Status: {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ TEST 3 FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
        
        data = r.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check response structure
        if not data.get("ok"):
            print(f"❌ TEST 3 FAILED: Response missing 'ok: true'")
            return False
        
        applied = data.get("applied", [])
        if not isinstance(applied, list):
            print(f"❌ TEST 3 FAILED: 'applied' is not a list")
            return False
        
        # Check that applied includes required fields
        required_fields = ["EHR_ENCRYPTION_KEY", "ENVIRONMENT", "PROVIDER_EMAIL", "PROVIDER_PASSWORD", "LOCATION_ID"]
        for field in required_fields:
            if field not in applied:
                print(f"❌ TEST 3 FAILED: 'applied' missing required field: {field}")
                return False
        
        print(f"✅ Applied fields: {applied}")
        
        # CRITICAL: Check that NO secret VALUES are in the response
        response_str = json.dumps(data)
        secret_values = [
            "7lI9cwSDI%22Y3iuk2rjDDTuoHLCSXyrM77Z3t7W",  # WENO_ONLINE_KEY
            "0925906208A@a88",  # WENO_ONLINE_PASSWORD
            "ernesto@210codelabs.com",  # WENO_ONLINE_EMAIL (not secret but checking)
        ]
        
        for secret in secret_values:
            if secret in response_str:
                print(f"❌ TEST 3 FAILED: Response contains secret value: {secret[:10]}...")
                return False
        
        print("✅ CRITICAL ASSERTION PASSED: Response contains NO secret VALUES (only field names in applied[])")
        
        # Now verify weno-status shows configured=true
        print("\n--- Verifying GET /api/erx/weno-status with provider cookie ---")
        r2 = requests.get(
            f"{BASE_URL}/api/erx/weno-status",
            cookies={"proactive_session": provider_cookie},
            timeout=30
        )
        print(f"Status: {r2.status_code}")
        
        if r2.status_code != 200:
            print(f"❌ TEST 3 FAILED: weno-status returned {r2.status_code}")
            return False
        
        status_data = r2.json()
        print(f"Weno status: {json.dumps(status_data, indent=2)}")
        
        online = status_data.get("online", {})
        if not online.get("configured"):
            print(f"❌ TEST 3 FAILED: online.configured is not true")
            return False
        
        if online.get("environment") != "test":
            print(f"❌ TEST 3 FAILED: online.environment is not 'test', got: {online.get('environment')}")
            return False
        
        print("✅ CRITICAL ASSERTION PASSED: online.configured===true and online.environment==='test'")
        print("✅ TEST 3 PASSED: Admin apply-env works correctly with NO secret values in response")
        return True
        
    except Exception as e:
        print(f"❌ TEST 3 EXCEPTION: {e}")
        return False

def test_relabel_network_no_cookie():
    """TEST 4: POST /api/admin/pharmacies/relabel-network with NO cookie -> 401 or 403"""
    print("\n=== TEST 4: POST /api/admin/pharmacies/relabel-network WITHOUT auth cookie ===")
    try:
        r = requests.post(f"{BASE_URL}/api/admin/pharmacies/relabel-network", timeout=30)
        print(f"Status: {r.status_code}")
        # Accept both 401 (Unauthorized - no session) and 403 (Forbidden - no permission)
        # 401 is more semantically correct for "no cookie" scenario
        if r.status_code in [401, 403]:
            print(f"✅ TEST 4 PASSED: Correctly returns {r.status_code} without auth cookie (blocks unauthenticated access)")
            return True
        else:
            print(f"❌ TEST 4 FAILED: Expected 401 or 403, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 4 EXCEPTION: {e}")
        return False

def test_relabel_network_admin_cookie(admin_cookie):
    """TEST 5: POST /api/admin/pharmacies/relabel-network with ADMIN cookie -> 200 with counts, idempotent"""
    print("\n=== TEST 5: POST /api/admin/pharmacies/relabel-network WITH admin cookie (FIRST RUN) ===")
    try:
        r = requests.post(
            f"{BASE_URL}/api/admin/pharmacies/relabel-network",
            cookies={"proactive_session": admin_cookie},
            timeout=30
        )
        print(f"Status: {r.status_code}")
        
        if r.status_code != 200:
            print(f"❌ TEST 5 FAILED: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
            return False
        
        data = r.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check response structure
        if not data.get("ok"):
            print(f"❌ TEST 5 FAILED: Response missing 'ok: true'")
            return False
        
        pharmacies_count = data.get("pharmacies")
        orders_count = data.get("orders")
        
        if not isinstance(pharmacies_count, (int, float)):
            print(f"❌ TEST 5 FAILED: 'pharmacies' is not a number, got: {type(pharmacies_count)}")
            return False
        
        if not isinstance(orders_count, (int, float)):
            print(f"❌ TEST 5 FAILED: 'orders' is not a number, got: {type(orders_count)}")
            return False
        
        if pharmacies_count < 0 or orders_count < 0:
            print(f"❌ TEST 5 FAILED: Counts are negative: pharmacies={pharmacies_count}, orders={orders_count}")
            return False
        
        print(f"✅ First run: pharmacies={pharmacies_count}, orders={orders_count} (counts are numbers >= 0)")
        
        # Run SECOND time to test idempotency
        print("\n--- Running POST /api/admin/pharmacies/relabel-network SECOND time (idempotency test) ---")
        r2 = requests.post(
            f"{BASE_URL}/api/admin/pharmacies/relabel-network",
            cookies={"proactive_session": admin_cookie},
            timeout=30
        )
        print(f"Status: {r2.status_code}")
        
        if r2.status_code != 200:
            print(f"❌ TEST 5 FAILED: Second run returned {r2.status_code} (expected 200, idempotent)")
            print(f"Response: {r2.text[:500]}")
            return False
        
        data2 = r2.json()
        print(f"Response: {json.dumps(data2, indent=2)}")
        
        if not data2.get("ok"):
            print(f"❌ TEST 5 FAILED: Second run response missing 'ok: true'")
            return False
        
        pharmacies_count2 = data2.get("pharmacies")
        orders_count2 = data2.get("orders")
        
        print(f"✅ Second run: pharmacies={pharmacies_count2}, orders={orders_count2}")
        print("✅ CRITICAL ASSERTION PASSED: Second run also returns 200 (idempotent, never 500)")
        print("✅ TEST 5 PASSED: Relabel network works correctly and is idempotent")
        return True
        
    except Exception as e:
        print(f"❌ TEST 5 EXCEPTION: {e}")
        return False

def main():
    print("=" * 80)
    print("BACKEND TEST: Admin one-click Weno actions")
    print("=" * 80)
    
    # Login as admin
    admin_cookie = login("admin@proactiveclinic.com", "apex123")
    if not admin_cookie:
        print("\n❌ FATAL: Could not login as admin")
        return
    
    # Login as provider (non-admin)
    provider_cookie = login("andy.manzano@proactiveclinic.com", "apex123")
    if not provider_cookie:
        print("\n❌ FATAL: Could not login as provider")
        return
    
    # Run all tests
    results = []
    
    results.append(("TEST 1: apply-env no cookie", test_apply_env_no_cookie()))
    results.append(("TEST 2: apply-env provider cookie", test_apply_env_provider_cookie(provider_cookie)))
    results.append(("TEST 3: apply-env admin cookie", test_apply_env_admin_cookie(admin_cookie, provider_cookie)))
    results.append(("TEST 4: relabel-network no cookie", test_relabel_network_no_cookie()))
    results.append(("TEST 5: relabel-network admin cookie", test_relabel_network_admin_cookie(admin_cookie)))
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! 🎉")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")

if __name__ == "__main__":
    main()
