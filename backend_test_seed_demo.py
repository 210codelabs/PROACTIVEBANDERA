#!/usr/bin/env python3
"""
Backend test for POST /api/admin/enterprise/seed-demo endpoint.
Tests: admin-only guard, idempotent double-run, and demo enterprise logins work after seeding.
"""
import asyncio
import json
import sys
from playwright.async_api import async_playwright

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        try:
            print("\n=== BACKEND TEST: POST /api/admin/enterprise/seed-demo ===\n")

            # ============================================================
            # STEP 1: POST /api/admin/enterprise/seed-demo WITHOUT auth cookie -> expect 401 or 403
            # ============================================================
            print("STEP 1: POST /api/admin/enterprise/seed-demo WITHOUT auth cookie (expect 401 or 403)")
            try:
                response = await page.request.post(f"{BASE_URL}/api/admin/enterprise/seed-demo")
                status = response.status
                print(f"  Status: {status}")
                if status in [401, 403]:
                    print("  ✅ PASS: Correctly returns 401 or 403 without auth cookie")
                else:
                    body = await response.text()
                    print(f"  ❌ FAIL: Expected 401 or 403, got {status}")
                    print(f"  Response body: {body[:200]}")
            except Exception as e:
                print(f"  ❌ ERROR in STEP 1: {e}")

            # ============================================================
            # STEP 2: Log in as staff admin
            # ============================================================
            print("\nSTEP 2: Log in as staff admin (admin@proactiveclinic.com / apex123)")
            try:
                login_response = await page.request.post(
                    f"{BASE_URL}/api/auth/login",
                    data=json.dumps({"email": "admin@proactiveclinic.com", "password": "apex123"}),
                    headers={"Content-Type": "application/json"}
                )
                login_status = login_response.status
                print(f"  Login status: {login_status}")
                
                if login_status == 200:
                    login_body = await login_response.json()
                    print(f"  ✅ Login successful: {login_body}")
                    
                    # Extract cookie from response headers
                    cookies = await context.cookies()
                    admin_cookie = None
                    for cookie in cookies:
                        if cookie['name'] == 'proactive_session':
                            admin_cookie = cookie
                            print(f"  ✅ Admin session cookie set: {cookie['name']}")
                            break
                    
                    if not admin_cookie:
                        print("  ⚠️ WARNING: proactive_session cookie not found in context")
                else:
                    login_body = await login_response.text()
                    print(f"  ❌ Login failed with status {login_status}: {login_body[:200]}")
                    sys.exit(1)
            except Exception as e:
                print(f"  ❌ ERROR in STEP 2: {e}")
                sys.exit(1)

            # ============================================================
            # STEP 3: POST /api/admin/enterprise/seed-demo WITH admin cookie -> 200 {ok:true, results:[2 entries]}
            # ============================================================
            print("\nSTEP 3: POST /api/admin/enterprise/seed-demo WITH admin cookie (expect 200)")
            try:
                seed_response = await page.request.post(f"{BASE_URL}/api/admin/enterprise/seed-demo")
                seed_status = seed_response.status
                print(f"  Status: {seed_status}")
                
                if seed_status == 200:
                    seed_body = await seed_response.json()
                    print(f"  ✅ PASS: Returns 200")
                    print(f"  Response body: {json.dumps(seed_body, indent=2)}")
                    
                    # Verify response structure
                    if seed_body.get('ok') == True:
                        print("  ✅ PASS: Response has ok=true")
                    else:
                        print(f"  ❌ FAIL: Response ok={seed_body.get('ok')}, expected true")
                    
                    results = seed_body.get('results', [])
                    if len(results) == 2:
                        print(f"  ✅ PASS: Results array has 2 entries")
                    else:
                        print(f"  ❌ FAIL: Results array has {len(results)} entries, expected 2")
                    
                    # Verify each result has required fields
                    for i, result in enumerate(results):
                        print(f"\n  Result {i+1}:")
                        print(f"    company: {result.get('company')}")
                        print(f"    account: {result.get('account')}")
                        print(f"    login: {result.get('login')}")
                        print(f"    password: {result.get('password')}")
                        print(f"    user: {result.get('user')}")
                        
                        if all(k in result for k in ['company', 'login', 'password']):
                            print(f"    ✅ Result {i+1} has required fields (company, login, password)")
                        else:
                            print(f"    ❌ Result {i+1} missing required fields")
                else:
                    seed_body = await seed_response.text()
                    print(f"  ❌ FAIL: Expected 200, got {seed_status}")
                    print(f"  Response body: {seed_body[:500]}")
            except Exception as e:
                print(f"  ❌ ERROR in STEP 3: {e}")

            # ============================================================
            # STEP 4: Idempotency - POST /api/admin/enterprise/seed-demo again -> 200 (no crash/dupe)
            # ============================================================
            print("\nSTEP 4: Idempotency - POST /api/admin/enterprise/seed-demo again (expect 200, no crash)")
            try:
                seed2_response = await page.request.post(f"{BASE_URL}/api/admin/enterprise/seed-demo")
                seed2_status = seed2_response.status
                print(f"  Status: {seed2_status}")
                
                if seed2_status == 200:
                    seed2_body = await seed2_response.json()
                    print(f"  ✅ PASS: Returns 200 (no crash)")
                    print(f"  Response body: {json.dumps(seed2_body, indent=2)}")
                    
                    results2 = seed2_body.get('results', [])
                    
                    # Check for idempotency indicators
                    for i, result in enumerate(results2):
                        print(f"\n  Result {i+1} (second run):")
                        print(f"    company: {result.get('company')}")
                        print(f"    account: {result.get('account')}")
                        print(f"    user: {result.get('user')}")
                        
                        # On second run, account should be 'existed' and user should be 'password reset'
                        if result.get('account') == 'existed':
                            print(f"    ✅ Account status is 'existed' (idempotent)")
                        else:
                            print(f"    ⚠️ Account status is '{result.get('account')}' (expected 'existed' on second run)")
                        
                        if result.get('user') == 'password reset':
                            print(f"    ✅ User action is 'password reset' (idempotent)")
                        else:
                            print(f"    ⚠️ User action is '{result.get('user')}' (expected 'password reset' on second run)")
                else:
                    seed2_body = await seed2_response.text()
                    print(f"  ❌ FAIL: Expected 200, got {seed2_status}")
                    print(f"  Response body: {seed2_body[:500]}")
            except Exception as e:
                print(f"  ❌ ERROR in STEP 4: {e}")

            # ============================================================
            # STEP 5: Verify demo enterprise logins work - hr@lonestarlogistics.com
            # ============================================================
            print("\nSTEP 5: Verify demo enterprise login 1 - hr@lonestarlogistics.com / demo1234")
            try:
                # Create a new context without admin cookie for enterprise login
                enterprise_context = await browser.new_context()
                enterprise_page = await enterprise_context.new_page()
                
                login1_response = await enterprise_page.request.post(
                    f"{BASE_URL}/api/enterprise/auth/login",
                    data=json.dumps({"email": "hr@lonestarlogistics.com", "password": "demo1234"}),
                    headers={"Content-Type": "application/json"}
                )
                login1_status = login1_response.status
                print(f"  Status: {login1_status}")
                
                if login1_status == 200:
                    login1_body = await login1_response.json()
                    print(f"  ✅ PASS: Returns 200")
                    print(f"  Response body: {json.dumps(login1_body, indent=2)}")
                    
                    if login1_body.get('ok') == True:
                        print("  ✅ PASS: Response has ok=true")
                    else:
                        print(f"  ❌ FAIL: Response ok={login1_body.get('ok')}, expected true")
                    
                    if login1_body.get('role') == 'company_admin':
                        print("  ✅ PASS: Role is 'company_admin'")
                    else:
                        print(f"  ❌ FAIL: Role is '{login1_body.get('role')}', expected 'company_admin'")
                else:
                    login1_body = await login1_response.text()
                    print(f"  ❌ FAIL: Expected 200, got {login1_status}")
                    print(f"  Response body: {login1_body[:500]}")
                
                await enterprise_context.close()
            except Exception as e:
                print(f"  ❌ ERROR in STEP 5: {e}")

            # ============================================================
            # STEP 6: Verify demo enterprise logins work - safety@alamomfg.com
            # ============================================================
            print("\nSTEP 6: Verify demo enterprise login 2 - safety@alamomfg.com / demo1234")
            try:
                # Create a new context without admin cookie for enterprise login
                enterprise_context2 = await browser.new_context()
                enterprise_page2 = await enterprise_context2.new_page()
                
                login2_response = await enterprise_page2.request.post(
                    f"{BASE_URL}/api/enterprise/auth/login",
                    data=json.dumps({"email": "safety@alamomfg.com", "password": "demo1234"}),
                    headers={"Content-Type": "application/json"}
                )
                login2_status = login2_response.status
                print(f"  Status: {login2_status}")
                
                if login2_status == 200:
                    login2_body = await login2_response.json()
                    print(f"  ✅ PASS: Returns 200")
                    print(f"  Response body: {json.dumps(login2_body, indent=2)}")
                    
                    if login2_body.get('ok') == True:
                        print("  ✅ PASS: Response has ok=true")
                    else:
                        print(f"  ❌ FAIL: Response ok={login2_body.get('ok')}, expected true")
                    
                    if login2_body.get('role') == 'company_admin':
                        print("  ✅ PASS: Role is 'company_admin'")
                    else:
                        print(f"  ❌ FAIL: Role is '{login2_body.get('role')}', expected 'company_admin'")
                else:
                    login2_body = await login2_response.text()
                    print(f"  ❌ FAIL: Expected 200, got {login2_status}")
                    print(f"  Response body: {login2_body[:500]}")
                
                await enterprise_context2.close()
            except Exception as e:
                print(f"  ❌ ERROR in STEP 6: {e}")

            print("\n=== TEST COMPLETE ===\n")

        except Exception as e:
            print(f"\n❌ FATAL ERROR: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
