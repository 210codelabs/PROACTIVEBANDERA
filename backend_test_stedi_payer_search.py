#!/usr/bin/env python3
"""
Backend test for Stedi payer search BUGFIX.
The bug: payer search previously returned the SAME unfiltered generic payer list for every query.
The fix: Now uses Stedi Search Payers API which actually filters results by query.
"""
import requests
import json

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def login(email, password):
    """Login and return session object with cookies"""
    print(f"\n🔐 Logging in as {email}...")
    session = requests.Session()
    resp = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        allow_redirects=False
    )
    print(f"   Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"   ❌ Login failed: {resp.text[:200]}")
        return None
    
    # Check if session cookie is set (cookie name is "proactive_session")
    if "proactive_session" in session.cookies or "session" in session.cookies:
        print(f"   ✅ Login successful, session cookie obtained")
        return session
    else:
        print(f"   ❌ No session cookie in response")
        print(f"   Cookies: {session.cookies}")
        return None

def test_auth_guard():
    """TEST 1: GET /api/stedi/payers?stedi=aetna with NO cookie -> 401"""
    print("\n" + "="*80)
    print("TEST 1: Auth guard - GET /api/stedi/payers?stedi=aetna WITHOUT auth cookie")
    print("="*80)
    
    try:
        resp = requests.get(f"{BASE_URL}/api/stedi/payers?stedi=aetna")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print("✅ TEST 1 PASSED: Correctly returns 401 Unauthorized without auth cookie")
            return True
        else:
            print(f"❌ TEST 1 FAILED: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text[:300]}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 FAILED with exception: {e}")
        return False

def test_aetna_search(session):
    """TEST 2: GET /api/stedi/payers?stedi=aetna -> 200 with Aetna results"""
    print("\n" + "="*80)
    print("TEST 2: Search for 'aetna' - should return Aetna-related payers")
    print("="*80)
    
    try:
        resp = session.get(f"{BASE_URL}/api/stedi/payers?stedi=aetna")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 2 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False, []
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        if "results" not in data:
            print(f"❌ TEST 2 FAILED: Response missing 'results' key")
            print(f"Response: {json.dumps(data, indent=2)[:500]}")
            return False, []
        
        results = data["results"]
        print(f"Number of results: {len(results)}")
        
        if len(results) == 0:
            print(f"❌ TEST 2 FAILED: Results array is empty")
            return False, []
        
        # Check if at least one result contains 'aetna' (case-insensitive)
        aetna_found = False
        print("\n📋 Top Aetna search results:")
        for i, payer in enumerate(results[:5]):
            display_name = payer.get("displayName", "")
            name = payer.get("name", "")
            stedi_id = payer.get("stediId", "")
            primary_payer_id = payer.get("primaryPayerId", "")
            
            print(f"   {i+1}. {display_name or name}")
            print(f"      stediId: {stedi_id}, primaryPayerId: {primary_payer_id}")
            
            if "aetna" in (display_name or name).lower():
                aetna_found = True
        
        if not aetna_found:
            print(f"❌ TEST 2 FAILED: No result contains 'aetna' in displayName or name")
            return False, results
        
        print(f"\n✅ TEST 2 PASSED: Returns 200 with {len(results)} results, at least one contains 'aetna'")
        return True, results
        
    except Exception as e:
        print(f"❌ TEST 2 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False, []

def test_cigna_search(session):
    """TEST 3: GET /api/stedi/payers?stedi=cigna -> 200 with Cigna results"""
    print("\n" + "="*80)
    print("TEST 3: Search for 'cigna' - should return Cigna-related payers")
    print("="*80)
    
    try:
        resp = session.get(f"{BASE_URL}/api/stedi/payers?stedi=cigna")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False, []
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        if "results" not in data:
            print(f"❌ TEST 3 FAILED: Response missing 'results' key")
            print(f"Response: {json.dumps(data, indent=2)[:500]}")
            return False, []
        
        results = data["results"]
        print(f"Number of results: {len(results)}")
        
        if len(results) == 0:
            print(f"❌ TEST 3 FAILED: Results array is empty")
            return False, []
        
        # Check if at least one result contains 'cigna' (case-insensitive)
        cigna_found = False
        print("\n📋 Top Cigna search results:")
        for i, payer in enumerate(results[:5]):
            display_name = payer.get("displayName", "")
            name = payer.get("name", "")
            stedi_id = payer.get("stediId", "")
            primary_payer_id = payer.get("primaryPayerId", "")
            
            print(f"   {i+1}. {display_name or name}")
            print(f"      stediId: {stedi_id}, primaryPayerId: {primary_payer_id}")
            
            if "cigna" in (display_name or name).lower():
                cigna_found = True
        
        if not cigna_found:
            print(f"❌ TEST 3 FAILED: No result contains 'cigna' in displayName or name")
            return False, results
        
        print(f"\n✅ TEST 3 PASSED: Returns 200 with {len(results)} results, at least one contains 'cigna'")
        return True, results
        
    except Exception as e:
        print(f"❌ TEST 3 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False, []

def test_results_differ(aetna_results, cigna_results):
    """TEST 4 (CRITICAL): Verify aetna and cigna result sets are DIFFERENT"""
    print("\n" + "="*80)
    print("TEST 4 (CRITICAL): Verify 'aetna' and 'cigna' result sets are DIFFERENT")
    print("="*80)
    
    if not aetna_results or not cigna_results:
        print("❌ TEST 4 FAILED: Cannot compare - one or both result sets are empty")
        return False
    
    # Compare the first few payer IDs/names to ensure they're different
    aetna_ids = [p.get("stediId") or p.get("primaryPayerId") or p.get("displayName") or p.get("name") 
                 for p in aetna_results[:5]]
    cigna_ids = [p.get("stediId") or p.get("primaryPayerId") or p.get("displayName") or p.get("name") 
                 for p in cigna_results[:5]]
    
    print(f"\nAetna result identifiers (top 5): {aetna_ids}")
    print(f"Cigna result identifiers (top 5): {cigna_ids}")
    
    # Check if the lists are identical
    if aetna_ids == cigna_ids:
        print("\n❌ TEST 4 FAILED: Result sets are IDENTICAL!")
        print("   This means the search query is being IGNORED (the bug is NOT fixed)")
        return False
    
    # Check if there's significant overlap (more than 50% same)
    common = set(aetna_ids) & set(cigna_ids)
    overlap_pct = len(common) / max(len(aetna_ids), len(cigna_ids)) * 100
    print(f"\nOverlap: {len(common)} out of {max(len(aetna_ids), len(cigna_ids))} ({overlap_pct:.1f}%)")
    
    if overlap_pct > 50:
        print(f"⚠️  WARNING: High overlap ({overlap_pct:.1f}%) - results may not be properly filtered")
    
    # Verify query relevance
    aetna_relevant = any("aetna" in str(id).lower() for id in aetna_ids if id)
    cigna_relevant = any("cigna" in str(id).lower() for id in cigna_ids if id)
    
    print(f"\nAetna results contain 'aetna': {aetna_relevant}")
    print(f"Cigna results contain 'cigna': {cigna_relevant}")
    
    if not aetna_relevant:
        print("⚠️  WARNING: Aetna results don't contain 'aetna' in top 5 identifiers")
    if not cigna_relevant:
        print("⚠️  WARNING: Cigna results don't contain 'cigna' in top 5 identifiers")
    
    print("\n✅ TEST 4 PASSED: Result sets are DIFFERENT - query is being applied correctly")
    print("   The bug is FIXED - searches now return query-relevant, filtered results")
    return True

def test_local_directory(session):
    """TEST 5: GET /api/stedi/payers (no stedi param) -> 200 with local directory"""
    print("\n" + "="*80)
    print("TEST 5: Local payer directory - GET /api/stedi/payers (no stedi param)")
    print("="*80)
    
    try:
        resp = session.get(f"{BASE_URL}/api/stedi/payers")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 5 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        if "payers" not in data:
            print(f"❌ TEST 5 FAILED: Response missing 'payers' key")
            print(f"Response: {json.dumps(data, indent=2)[:500]}")
            return False
        
        payers = data["payers"]
        print(f"Number of local payers: {len(payers)}")
        
        if len(payers) > 0:
            print(f"\n📋 Sample local payers:")
            for i, payer in enumerate(payers[:3]):
                print(f"   {i+1}. {payer.get('name', 'N/A')} (stediId: {payer.get('stediId', 'N/A')})")
        else:
            print("   (Empty array - acceptable)")
        
        print(f"\n✅ TEST 5 PASSED: Returns 200 with local payers array (length: {len(payers)})")
        return True
        
    except Exception as e:
        print(f"❌ TEST 5 FAILED with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "="*80)
    print("STEDI PAYER SEARCH BUGFIX - BACKEND TEST")
    print("="*80)
    print("\nBUG: Payer search previously returned the SAME unfiltered list for every query")
    print("FIX: Now uses Stedi Search Payers API which filters by query term")
    print("\nThis test will verify the fix by:")
    print("  1. Testing auth guard")
    print("  2. Searching for 'aetna' and verifying Aetna results")
    print("  3. Searching for 'cigna' and verifying Cigna results")
    print("  4. CRITICALLY comparing the two result sets to ensure they're DIFFERENT")
    print("  5. Testing local directory endpoint")
    
    # Login
    session = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not session:
        print("\n❌ FATAL: Could not login. Aborting tests.")
        return
    
    # Run tests
    results = []
    
    # Test 1: Auth guard
    results.append(("Auth guard", test_auth_guard()))
    
    # Test 2: Aetna search
    aetna_pass, aetna_results = test_aetna_search(session)
    results.append(("Aetna search", aetna_pass))
    
    # Test 3: Cigna search
    cigna_pass, cigna_results = test_cigna_search(session)
    results.append(("Cigna search", cigna_pass))
    
    # Test 4: CRITICAL - Verify results differ
    if aetna_pass and cigna_pass:
        results.append(("Results differ (CRITICAL)", test_results_differ(aetna_results, cigna_results)))
    else:
        print("\n⚠️  SKIPPING TEST 4: Cannot compare results (previous tests failed)")
        results.append(("Results differ (CRITICAL)", False))
    
    # Test 5: Local directory
    results.append(("Local directory", test_local_directory(session)))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ The Stedi payer search bugfix is working correctly")
        print("✅ Searches now return query-relevant, filtered results (not the same generic list)")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        print("❌ The bugfix may not be working correctly")

if __name__ == "__main__":
    main()
