#!/usr/bin/env python3
"""
Backend test for Employee self-service portal (access code + PIN login).
Tests admin enable/reset/disable access, employee login with code+PIN,
view results, e-sign consent, scoped doc download, and cookie isolation.
"""

import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_employee_portal():
    print("=" * 80)
    print("EMPLOYEE SELF-SERVICE PORTAL BACKEND TEST")
    print("=" * 80)
    
    # ========================================================================
    # SETUP: Login as company admin (enterprise cookie)
    # ========================================================================
    print("\n[SETUP] Login as company admin (hr@lonestarlogistics.com/demo1234)...")
    admin_session = requests.Session()
    resp = admin_session.post(f"{BASE_URL}/api/enterprise/auth/login", json={
        "email": "hr@lonestarlogistics.com",
        "password": "demo1234"
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ERROR: Admin login failed: {resp.text}")
        return False
    print(f"  Response: {resp.json()}")
    print(f"  ✅ Company admin logged in successfully")
    
    # Check that we have the enterprise cookie
    enterprise_cookie = admin_session.cookies.get("proactive_enterprise_session")
    if not enterprise_cookie:
        print("  ERROR: No proactive_enterprise_session cookie set")
        return False
    print(f"  ✅ Enterprise cookie set: {enterprise_cookie[:20]}...")
    
    # ========================================================================
    # (A) ADMIN ENABLE/RESET ACCESS
    # ========================================================================
    print("\n" + "=" * 80)
    print("(A) ADMIN ENABLE/RESET ACCESS")
    print("=" * 80)
    
    # A1: Get or create an employee with a linked patientId
    print("\n[A1] Get/create an employee with linked patientId...")
    resp = admin_session.get(f"{BASE_URL}/api/enterprise/employees")
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ERROR: Failed to get employees: {resp.text}")
        return False
    
    employees = resp.json().get("employees", [])
    print(f"  Found {len(employees)} employees")
    
    # Find an employee with a patientId, or create one
    employee = None
    for emp in employees:
        if emp.get("patientId"):
            employee = emp
            print(f"  ✅ Found existing employee with patientId: {emp['firstName']} {emp['lastName']} (ID: {emp['id']}, patientId: {emp['patientId']})")
            break
    
    if not employee:
        print("  No employee with patientId found, creating one...")
        resp = admin_session.post(f"{BASE_URL}/api/enterprise/employees", json={
            "firstName": "TestEmployee",
            "lastName": "Portal",
            "dob": "1990-01-15",
            "sex": "F",
            "email": "testemployee@example.com"
        })
        print(f"  Status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"  ERROR: Failed to create employee: {resp.text}")
            return False
        employee = resp.json().get("employee")
        print(f"  ✅ Created employee: {employee['firstName']} {employee['lastName']} (ID: {employee['id']}, patientId: {employee.get('patientId')})")
    
    employee_id = employee["id"]
    
    # A2: Enable access (get accessCode + PIN)
    print("\n[A2] POST /api/enterprise/employees/{id}/access {action:'enable'}...")
    resp = admin_session.post(f"{BASE_URL}/api/enterprise/employees/{employee_id}/access", json={
        "action": "enable"
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ERROR: Failed to enable access: {resp.text}")
        return False
    
    enable_data = resp.json()
    print(f"  Response: {json.dumps(enable_data, indent=2)}")
    
    # Verify response structure
    if not enable_data.get("ok"):
        print(f"  ERROR: Response missing 'ok: true'")
        return False
    if not enable_data.get("accessEnabled"):
        print(f"  ERROR: accessEnabled is not true")
        return False
    if not enable_data.get("accessCode"):
        print(f"  ERROR: No accessCode returned")
        return False
    if not enable_data.get("pin"):
        print(f"  ERROR: No pin returned")
        return False
    
    access_code = enable_data["accessCode"]
    pin = enable_data["pin"]
    
    print(f"  ✅ Access enabled successfully")
    print(f"  ✅ accessCode: {access_code}")
    print(f"  ✅ pin: {pin}")
    print(f"  ✅ Response has ok=true, accessEnabled=true, accessCode, pin")
    
    # Verify accessCode format (should be EMP-XXXXXX)
    if not access_code.startswith("EMP-"):
        print(f"  ERROR: accessCode format incorrect (expected EMP-XXXXXX, got {access_code})")
        return False
    print(f"  ✅ accessCode format correct (EMP-XXXXXX)")
    
    # Verify PIN is 6 digits
    if len(pin) != 6 or not pin.isdigit():
        print(f"  ERROR: PIN format incorrect (expected 6 digits, got {pin})")
        return False
    print(f"  ✅ PIN format correct (6 digits)")
    
    # A3: Reset access (get new PIN)
    print("\n[A3] POST /api/enterprise/employees/{id}/access {action:'reset'}...")
    resp = admin_session.post(f"{BASE_URL}/api/enterprise/employees/{employee_id}/access", json={
        "action": "reset"
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ERROR: Failed to reset access: {resp.text}")
        return False
    
    reset_data = resp.json()
    print(f"  Response: {json.dumps(reset_data, indent=2)}")
    
    # Verify response structure
    if not reset_data.get("ok"):
        print(f"  ERROR: Response missing 'ok: true'")
        return False
    if not reset_data.get("accessEnabled"):
        print(f"  ERROR: accessEnabled is not true")
        return False
    if not reset_data.get("accessCode"):
        print(f"  ERROR: No accessCode returned")
        return False
    if not reset_data.get("pin"):
        print(f"  ERROR: No pin returned")
        return False
    
    new_pin = reset_data["pin"]
    new_access_code = reset_data["accessCode"]
    
    print(f"  ✅ Access reset successfully")
    print(f"  ✅ New accessCode: {new_access_code}")
    print(f"  ✅ New pin: {new_pin}")
    print(f"  ✅ Response has ok=true, accessEnabled=true, accessCode, pin")
    
    # Use the new PIN for subsequent tests
    pin = new_pin
    access_code = new_access_code
    
    # ========================================================================
    # (B) EMPLOYEE LOGIN
    # ========================================================================
    print("\n" + "=" * 80)
    print("(B) EMPLOYEE LOGIN")
    print("=" * 80)
    
    # B1: Login with wrong PIN (should fail with 401)
    print("\n[B1] POST /api/enterprise/employee-portal/login with WRONG pin...")
    employee_session = requests.Session()
    resp = employee_session.post(f"{BASE_URL}/api/enterprise/employee-portal/login", json={
        "accessCode": access_code,
        "pin": "999999"  # Wrong PIN
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 401:
        print(f"  ERROR: Expected 401, got {resp.status_code}")
        return False
    print(f"  Response: {resp.json()}")
    print(f"  ✅ Wrong PIN correctly returns 401")
    
    # B2: Login with correct PIN (should succeed with 200 and set cookie)
    print("\n[B2] POST /api/enterprise/employee-portal/login with CORRECT pin...")
    resp = employee_session.post(f"{BASE_URL}/api/enterprise/employee-portal/login", json={
        "accessCode": access_code,
        "pin": pin
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ERROR: Login failed: {resp.text}")
        return False
    
    login_data = resp.json()
    print(f"  Response: {json.dumps(login_data, indent=2)}")
    
    if not login_data.get("ok"):
        print(f"  ERROR: Response missing 'ok: true'")
        return False
    print(f"  ✅ Login successful with ok=true")
    
    # Check that we have the employee cookie
    employee_cookie = employee_session.cookies.get("proactive_employee_session")
    if not employee_cookie:
        print("  ERROR: No proactive_employee_session cookie set")
        return False
    print(f"  ✅ Employee cookie set: {employee_cookie[:20]}...")
    
    # B3: GET /me without cookie (should fail with 401)
    print("\n[B3] GET /api/enterprise/employee-portal/me WITHOUT cookie...")
    no_auth_session = requests.Session()
    resp = no_auth_session.get(f"{BASE_URL}/api/enterprise/employee-portal/me")
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 401:
        print(f"  ERROR: Expected 401, got {resp.status_code}")
        return False
    print(f"  Response: {resp.json()}")
    print(f"  ✅ GET /me without cookie correctly returns 401")
    
    # B4: GET /me with cookie (should succeed with 200)
    print("\n[B4] GET /api/enterprise/employee-portal/me WITH cookie...")
    resp = employee_session.get(f"{BASE_URL}/api/enterprise/employee-portal/me")
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ERROR: GET /me failed: {resp.text}")
        return False
    
    me_data = resp.json()
    print(f"  Response keys: {list(me_data.keys())}")
    print(f"  Employee: {me_data.get('employee')}")
    print(f"  Requests count: {len(me_data.get('requests', []))}")
    print(f"  Results count: {len(me_data.get('results', []))}")
    print(f"  Consents count: {len(me_data.get('consents', []))}")
    
    # Verify response structure
    if "employee" not in me_data:
        print(f"  ERROR: Response missing 'employee' field")
        return False
    if "requests" not in me_data:
        print(f"  ERROR: Response missing 'requests' field")
        return False
    if "results" not in me_data:
        print(f"  ERROR: Response missing 'results' field")
        return False
    if "consents" not in me_data:
        print(f"  ERROR: Response missing 'consents' field")
        return False
    
    print(f"  ✅ GET /me with cookie returns 200 with employee, requests, results, consents")
    
    # ========================================================================
    # (C) CONSENT SELF-SIGN
    # ========================================================================
    print("\n" + "=" * 80)
    print("(C) CONSENT SELF-SIGN")
    print("=" * 80)
    
    # C1: As company admin, create a consent for this employee
    print("\n[C1] As company admin, POST /api/enterprise/consents {employeeId, formKey:'hipaa_authorization'}...")
    resp = admin_session.post(f"{BASE_URL}/api/enterprise/consents", json={
        "employeeId": employee_id,
        "formKey": "hipaa_authorization"
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ERROR: Failed to create consent: {resp.text}")
        return False
    
    consent_data = resp.json()
    print(f"  Response: {json.dumps(consent_data, indent=2)}")
    
    if not consent_data.get("ok"):
        print(f"  ERROR: Response missing 'ok: true'")
        return False
    
    consent = consent_data.get("consent")
    if not consent:
        print(f"  ERROR: Response missing 'consent' field")
        return False
    
    consent_id = consent["id"]
    if consent.get("status") != "pending":
        print(f"  ERROR: Consent status is not 'pending', got {consent.get('status')}")
        return False
    
    print(f"  ✅ Consent created successfully with status='pending'")
    print(f"  ✅ Consent ID: {consent_id}")
    
    # C2: As employee, sign the consent
    print("\n[C2] As employee, POST /api/enterprise/employee-portal/consents/{id}/sign {signatureText:'Jane Employee'}...")
    resp = employee_session.post(f"{BASE_URL}/api/enterprise/employee-portal/consents/{consent_id}/sign", json={
        "signatureText": "Jane Employee"
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ERROR: Failed to sign consent: {resp.text}")
        return False
    
    sign_data = resp.json()
    print(f"  Response keys: {list(sign_data.keys())}")
    print(f"  ok: {sign_data.get('ok')}")
    print(f"  consent.status: {sign_data.get('consent', {}).get('status')}")
    print(f"  documentId: {sign_data.get('documentId')}")
    
    if not sign_data.get("ok"):
        print(f"  ERROR: Response missing 'ok: true'")
        return False
    
    signed_consent = sign_data.get("consent")
    if not signed_consent:
        print(f"  ERROR: Response missing 'consent' field")
        return False
    
    if signed_consent.get("status") != "signed":
        print(f"  ERROR: Consent status is not 'signed', got {signed_consent.get('status')}")
        return False
    
    document_id = sign_data.get("documentId")
    if not document_id:
        print(f"  ERROR: Response missing 'documentId' field")
        return False
    
    print(f"  ✅ Consent signed successfully with status='signed'")
    print(f"  ✅ Document ID: {document_id}")
    
    # C3: As employee, try to sign a consent for a DIFFERENT employee (should fail with 404)
    print("\n[C3] As employee, try to sign a consent for a DIFFERENT employee...")
    
    # First, create another employee and a consent for them
    print("  Creating another employee...")
    resp = admin_session.post(f"{BASE_URL}/api/enterprise/employees", json={
        "firstName": "OtherEmployee",
        "lastName": "Test",
        "dob": "1985-05-20",
        "sex": "M"
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ERROR: Failed to create other employee: {resp.text}")
        return False
    
    other_employee = resp.json().get("employee")
    other_employee_id = other_employee["id"]
    print(f"  ✅ Created other employee: {other_employee_id}")
    
    print("  Creating consent for other employee...")
    resp = admin_session.post(f"{BASE_URL}/api/enterprise/consents", json={
        "employeeId": other_employee_id,
        "formKey": "hipaa_authorization"
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ERROR: Failed to create consent for other employee: {resp.text}")
        return False
    
    other_consent = resp.json().get("consent")
    other_consent_id = other_consent["id"]
    print(f"  ✅ Created consent for other employee: {other_consent_id}")
    
    print("  Trying to sign other employee's consent...")
    resp = employee_session.post(f"{BASE_URL}/api/enterprise/employee-portal/consents/{other_consent_id}/sign", json={
        "signatureText": "Jane Employee"
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 404:
        print(f"  ERROR: Expected 404, got {resp.status_code}")
        return False
    print(f"  Response: {resp.json()}")
    print(f"  ✅ Employee signing another employee's consent correctly returns 404")
    
    # ========================================================================
    # (D) DOC DOWNLOAD SCOPING
    # ========================================================================
    print("\n" + "=" * 80)
    print("(D) DOC DOWNLOAD SCOPING")
    print("=" * 80)
    
    # D1: As employee, download their signed consent document (should succeed)
    print("\n[D1] GET /api/enterprise/employee-portal/documents/{documentId} (their signed consent)...")
    resp = employee_session.get(f"{BASE_URL}/api/enterprise/employee-portal/documents/{document_id}")
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ERROR: Failed to download document: {resp.text}")
        return False
    
    # Check Content-Type
    content_type = resp.headers.get("Content-Type", "")
    print(f"  Content-Type: {content_type}")
    if "application/pdf" not in content_type:
        print(f"  ERROR: Expected Content-Type 'application/pdf', got {content_type}")
        return False
    print(f"  ✅ Content-Type is 'application/pdf'")
    
    # Check PDF magic bytes
    pdf_bytes = resp.content
    print(f"  PDF size: {len(pdf_bytes)} bytes")
    if not pdf_bytes.startswith(b"%PDF"):
        print(f"  ERROR: Response does not start with '%PDF'")
        return False
    print(f"  ✅ Response starts with '%PDF' (valid PDF)")
    
    # D2: As employee, try to download a random/other document (should fail with 404)
    print("\n[D2] GET /api/enterprise/employee-portal/documents/{random_id} (not their document)...")
    random_doc_id = "bogus123456789"
    resp = employee_session.get(f"{BASE_URL}/api/enterprise/employee-portal/documents/{random_doc_id}")
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 404:
        print(f"  ERROR: Expected 404, got {resp.status_code}")
        return False
    print(f"  Response: {resp.json()}")
    print(f"  ✅ Employee downloading random document correctly returns 404")
    
    # ========================================================================
    # (E) ADMIN DISABLE
    # ========================================================================
    print("\n" + "=" * 80)
    print("(E) ADMIN DISABLE")
    print("=" * 80)
    
    # E1: As company admin, disable access
    print("\n[E1] POST /api/enterprise/employees/{id}/access {action:'disable'}...")
    resp = admin_session.post(f"{BASE_URL}/api/enterprise/employees/{employee_id}/access", json={
        "action": "disable"
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ERROR: Failed to disable access: {resp.text}")
        return False
    
    disable_data = resp.json()
    print(f"  Response: {json.dumps(disable_data, indent=2)}")
    
    if not disable_data.get("ok"):
        print(f"  ERROR: Response missing 'ok: true'")
        return False
    if disable_data.get("accessEnabled") != False:
        print(f"  ERROR: accessEnabled is not false, got {disable_data.get('accessEnabled')}")
        return False
    
    print(f"  ✅ Access disabled successfully with accessEnabled=false")
    
    # E2: Try to login with old code+PIN (should fail with 401)
    print("\n[E2] POST /api/enterprise/employee-portal/login with old code+PIN after disable...")
    disabled_session = requests.Session()
    resp = disabled_session.post(f"{BASE_URL}/api/enterprise/employee-portal/login", json={
        "accessCode": access_code,
        "pin": pin
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 401:
        print(f"  ERROR: Expected 401, got {resp.status_code}")
        return False
    print(f"  Response: {resp.json()}")
    print(f"  ✅ Login with disabled access correctly returns 401")
    
    # ========================================================================
    # (F) COOKIE ISOLATION
    # ========================================================================
    print("\n" + "=" * 80)
    print("(F) COOKIE ISOLATION")
    print("=" * 80)
    
    # F1: Company-admin cookie must NOT authorize employee-portal endpoints
    print("\n[F1] GET /api/enterprise/employee-portal/me with company-admin cookie (should fail with 401)...")
    resp = admin_session.get(f"{BASE_URL}/api/enterprise/employee-portal/me")
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 401:
        print(f"  ERROR: Expected 401, got {resp.status_code}")
        return False
    print(f"  Response: {resp.json()}")
    print(f"  ✅ Company-admin cookie does NOT authorize employee-portal endpoints (401)")
    
    # F2: Employee cookie must NOT authorize company-admin endpoints
    # Re-enable access and login as employee first
    print("\n[F2] Re-enable access and login as employee for cookie isolation test...")
    resp = admin_session.post(f"{BASE_URL}/api/enterprise/employees/{employee_id}/access", json={
        "action": "enable"
    })
    if resp.status_code != 200:
        print(f"  ERROR: Failed to re-enable access: {resp.text}")
        return False
    
    new_enable_data = resp.json()
    new_access_code = new_enable_data["accessCode"]
    new_pin = new_enable_data["pin"]
    
    employee_session2 = requests.Session()
    resp = employee_session2.post(f"{BASE_URL}/api/enterprise/employee-portal/login", json={
        "accessCode": new_access_code,
        "pin": new_pin
    })
    if resp.status_code != 200:
        print(f"  ERROR: Failed to login as employee: {resp.text}")
        return False
    print(f"  ✅ Employee logged in successfully")
    
    print("\n  GET /api/enterprise/employees with employee cookie (should fail with 401)...")
    resp = employee_session2.get(f"{BASE_URL}/api/enterprise/employees")
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 401:
        print(f"  ERROR: Expected 401, got {resp.status_code}")
        return False
    print(f"  Response: {resp.json()}")
    print(f"  ✅ Employee cookie does NOT authorize company-admin endpoints (401)")
    
    # F3: All employee-portal endpoints except login/logout require employee cookie
    print("\n[F3] Verify all employee-portal endpoints require employee cookie...")
    
    # Test /me without cookie
    print("  GET /api/enterprise/employee-portal/me without cookie...")
    resp = requests.get(f"{BASE_URL}/api/enterprise/employee-portal/me")
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 401:
        print(f"  ERROR: Expected 401, got {resp.status_code}")
        return False
    print(f"  ✅ /me requires employee cookie (401)")
    
    # Test /consents/{id}/sign without cookie
    print("  POST /api/enterprise/employee-portal/consents/{id}/sign without cookie...")
    resp = requests.post(f"{BASE_URL}/api/enterprise/employee-portal/consents/{consent_id}/sign", json={
        "signatureText": "Test"
    })
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 401:
        print(f"  ERROR: Expected 401, got {resp.status_code}")
        return False
    print(f"  ✅ /consents/{id}/sign requires employee cookie (401)")
    
    # Test /documents/{id} without cookie
    print("  GET /api/enterprise/employee-portal/documents/{id} without cookie...")
    resp = requests.get(f"{BASE_URL}/api/enterprise/employee-portal/documents/{document_id}")
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 401:
        print(f"  ERROR: Expected 401, got {resp.status_code}")
        return False
    print(f"  ✅ /documents/{id} requires employee cookie (401)")
    
    print("\n" + "=" * 80)
    print("✅ ALL TESTS PASSED")
    print("=" * 80)
    return True

if __name__ == "__main__":
    try:
        success = test_employee_portal()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ TEST FAILED WITH EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
