#!/usr/bin/env python3
"""
Backend test for Enterprise employee roster + chart writes + super-admin portal login
Tests the 13 scenarios outlined in the task status_history.
"""
import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Test credentials
COMPANY_ADMIN = {"email": "hr@lonestarlogistics.com", "password": "demo1234"}
COMPANY_ADMIN_2 = {"email": "safety@alamomfg.com", "password": "demo1234"}  # Alamo Manufacturing
SUPER_ADMIN = {"email": "admin@proactiveclinic.com", "password": "apex123"}

def test_step(num, desc):
    print(f"\n{'='*80}")
    print(f"TEST STEP {num}: {desc}")
    print('='*80)

def assert_status(response, expected, context=""):
    if response.status_code != expected:
        print(f"❌ FAILED {context}: Expected {expected}, got {response.status_code}")
        print(f"Response: {response.text[:500]}")
        return False
    print(f"✅ Status {response.status_code} as expected {context}")
    return True

def assert_json_field(data, field, expected=None, context=""):
    if field not in data:
        print(f"❌ FAILED {context}: Field '{field}' not in response")
        return False
    if expected is not None and data[field] != expected:
        print(f"❌ FAILED {context}: Field '{field}' = {data[field]}, expected {expected}")
        return False
    print(f"✅ Field '{field}' present {context}: {data[field]}")
    return True

def main():
    print("="*80)
    print("ENTERPRISE EMPLOYEE ROSTER + CHART WRITES + SUPER-ADMIN PORTAL LOGIN")
    print("="*80)
    
    # ========================================================================
    # TEST 1: Dual login roles (company_admin vs super_admin), wrong password
    # ========================================================================
    test_step(1, "Dual login roles - company_admin, super_admin, wrong password")
    
    # 1a. Company admin login
    print("\n[1a] Company admin login (hr@lonestarlogistics.com)")
    r = requests.post(f"{BASE_URL}/api/enterprise/auth/login", json=COMPANY_ADMIN)
    if not assert_status(r, 200, "company admin login"): return 1
    data = r.json()
    if not assert_json_field(data, "ok", True, "company admin"): return 1
    if not assert_json_field(data, "role", "company_admin", "company admin"): return 1
    company_admin_cookie = r.cookies.get("proactive_enterprise_session")
    if not company_admin_cookie:
        print("❌ FAILED: No proactive_enterprise_session cookie set")
        return 1
    print(f"✅ Company admin session cookie set")
    
    # 1b. Super admin login
    print("\n[1b] Super admin login (admin@proactiveclinic.com)")
    r = requests.post(f"{BASE_URL}/api/enterprise/auth/login", json=SUPER_ADMIN)
    if not assert_status(r, 200, "super admin login"): return 1
    data = r.json()
    if not assert_json_field(data, "ok", True, "super admin"): return 1
    if not assert_json_field(data, "role", "super_admin", "super admin"): return 1
    super_admin_cookie = r.cookies.get("proactive_enterprise_session")
    if not super_admin_cookie:
        print("❌ FAILED: No proactive_enterprise_session cookie set")
        return 1
    print(f"✅ Super admin session cookie set")
    
    # 1c. Wrong password
    print("\n[1c] Wrong password")
    r = requests.post(f"{BASE_URL}/api/enterprise/auth/login", 
                     json={"email": COMPANY_ADMIN["email"], "password": "wrongpassword"})
    if not assert_status(r, 401, "wrong password"): return 1
    
    # ========================================================================
    # TEST 2: GET /api/enterprise/companies
    # ========================================================================
    test_step(2, "GET /api/enterprise/companies - own company vs ALL companies")
    
    # 2a. Company admin sees only their own company
    print("\n[2a] Company admin GET /api/enterprise/companies")
    r = requests.get(f"{BASE_URL}/api/enterprise/companies", 
                    cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200, "company admin companies"): return 1
    data = r.json()
    if not assert_json_field(data, "role", "company_admin"): return 1
    if not assert_json_field(data, "companies"): return 1
    if len(data["companies"]) != 1:
        print(f"❌ FAILED: Expected 1 company, got {len(data['companies'])}")
        return 1
    print(f"✅ Company admin sees 1 company: {data['companies'][0]['companyName']}")
    lone_star_id = data["companies"][0]["id"]
    
    # 2b. Super admin sees ALL companies with employeeCount/requestCount
    print("\n[2b] Super admin GET /api/enterprise/companies")
    r = requests.get(f"{BASE_URL}/api/enterprise/companies", 
                    cookies={"proactive_enterprise_session": super_admin_cookie})
    if not assert_status(r, 200, "super admin companies"): return 1
    data = r.json()
    if not assert_json_field(data, "role", "super_admin"): return 1
    if not assert_json_field(data, "companies"): return 1
    if len(data["companies"]) < 2:
        print(f"❌ FAILED: Expected >=2 companies, got {len(data['companies'])}")
        return 1
    print(f"✅ Super admin sees {len(data['companies'])} companies")
    for co in data["companies"]:
        if "employeeCount" not in co or "requestCount" not in co:
            print(f"❌ FAILED: Company missing employeeCount or requestCount")
            return 1
        print(f"  - {co['companyName']}: {co['employeeCount']} employees, {co['requestCount']} requests")
    
    # Find Alamo Manufacturing ID for isolation test later
    alamo_id = None
    for co in data["companies"]:
        if "Alamo" in co["companyName"]:
            alamo_id = co["id"]
            break
    
    # ========================================================================
    # TEST 3: POST /api/enterprise/employees creates employee with patientId
    # ========================================================================
    test_step(3, "POST /api/enterprise/employees - create employee with auto EMR chart")
    
    print("\n[3] Company admin POST /api/enterprise/employees")
    r = requests.post(f"{BASE_URL}/api/enterprise/employees",
                     json={
                         "firstName": "TestEmp",
                         "lastName": "Roster",
                         "dob": "1990-05-05",
                         "email": "testemp@example.com",
                         "phone": "210-555-0199"
                     },
                     cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200, "create employee"): return 1
    data = r.json()
    if not assert_json_field(data, "ok", True): return 1
    if not assert_json_field(data, "employee"): return 1
    employee = data["employee"]
    if not assert_json_field(employee, "id"): return 1
    if not assert_json_field(employee, "patientId"): return 1
    if not employee["patientId"]:
        print(f"❌ FAILED: patientId is null or empty")
        return 1
    print(f"✅ Employee created with patientId: {employee['patientId']}")
    employee_id = employee["id"]
    patient_id = employee["patientId"]
    
    # ========================================================================
    # TEST 4: GET /api/enterprise/employees/[id] returns employee + chart
    # ========================================================================
    test_step(4, "GET /api/enterprise/employees/[id] - employee + chart details")
    
    print(f"\n[4] Company admin GET /api/enterprise/employees/{employee_id}")
    r = requests.get(f"{BASE_URL}/api/enterprise/employees/{employee_id}",
                    cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200, "get employee"): return 1
    data = r.json()
    if not assert_json_field(data, "employee"): return 1
    if not assert_json_field(data, "chart"): return 1
    chart = data["chart"]
    required_fields = ["mrn", "insurance", "medications", "referrals", "eligibility", "consents"]
    for field in required_fields:
        if field not in chart:
            print(f"❌ FAILED: Chart missing field '{field}'")
            return 1
    print(f"✅ Chart has all required fields: {', '.join(required_fields)}")
    print(f"  MRN: {chart['mrn']}")
    
    # ========================================================================
    # TEST 5: Chart writes (insurance/medications/referrals) with AuditLog
    # ========================================================================
    test_step(5, "Chart writes - insurance/medications/referrals + AuditLog")
    
    # 5a. POST insurance
    print(f"\n[5a] POST /api/enterprise/employees/{employee_id}/insurance")
    r = requests.post(f"{BASE_URL}/api/enterprise/employees/{employee_id}/insurance",
                     json={
                         "insurerName": "Aetna",
                         "memberId": "W123456",
                         "payerId": "60054"
                     },
                     cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200, "post insurance"): return 1
    data = r.json()
    if not assert_json_field(data, "ok", True): return 1
    print(f"✅ Insurance posted successfully")
    
    # Verify insurance in chart
    print(f"\n[5a-verify] GET employee to verify insurance")
    r = requests.get(f"{BASE_URL}/api/enterprise/employees/{employee_id}",
                    cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200): return 1
    chart = r.json()["chart"]
    if chart["insurance"]["insurerName"] != "Aetna":
        print(f"❌ FAILED: Insurance not updated, got {chart['insurance']}")
        return 1
    print(f"✅ Insurance verified in chart: {chart['insurance']['insurerName']}")
    
    # 5b. POST medication
    print(f"\n[5b] POST /api/enterprise/employees/{employee_id}/medications")
    r = requests.post(f"{BASE_URL}/api/enterprise/employees/{employee_id}/medications",
                     json={
                         "name": "Lisinopril",
                         "strength": "10mg",
                         "frequency": "daily"
                     },
                     cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200, "post medication"): return 1
    data = r.json()
    if not assert_json_field(data, "ok", True): return 1
    if not assert_json_field(data, "medication"): return 1
    medication = data["medication"]
    if medication.get("source") != "enterprise-portal":
        print(f"❌ FAILED: Medication source is not 'enterprise-portal', got {medication.get('source')}")
        return 1
    print(f"✅ Medication created with source='enterprise-portal'")
    
    # 5c. POST referral
    print(f"\n[5c] POST /api/enterprise/employees/{employee_id}/referrals")
    r = requests.post(f"{BASE_URL}/api/enterprise/employees/{employee_id}/referrals",
                     json={
                         "name": "Dr. Smith",
                         "specialty": "Cardiology",
                         "phone": "210-555-0100"
                     },
                     cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200, "post referral"): return 1
    data = r.json()
    if not assert_json_field(data, "ok", True): return 1
    if not assert_json_field(data, "referral"): return 1
    print(f"✅ Referral created")
    
    # 5d. Verify AuditLog entries
    print(f"\n[5d] Verify AuditLog entries for chart writes")
    import pymongo
    client = pymongo.MongoClient("mongodb://localhost:27017")
    db = client["proactive_clinic"]
    audit_logs = list(db.AuditLog.find({
        "action": "enterprise.chart.write",
        "resource": "Patient",
        "resourceId": patient_id
    }).sort("createdAt", -1).limit(10))
    
    if len(audit_logs) < 3:
        print(f"❌ FAILED: Expected at least 3 AuditLog entries, found {len(audit_logs)}")
        return 1
    print(f"✅ Found {len(audit_logs)} AuditLog entries with action='enterprise.chart.write'")
    for log in audit_logs[:3]:
        print(f"  - {log.get('action')} on {log.get('resource')} {log.get('resourceId')}")
    
    # ========================================================================
    # TEST 6: Eligibility check
    # ========================================================================
    test_step(6, "Eligibility check - 400 if no payerId, 200 with payerId")
    
    # 6a. Create employee without payerId
    print("\n[6a] Create employee without insurance/payerId")
    r = requests.post(f"{BASE_URL}/api/enterprise/employees",
                     json={
                         "firstName": "NoIns",
                         "lastName": "Employee",
                         "dob": "1985-03-15"
                     },
                     cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200): return 1
    no_ins_employee_id = r.json()["employee"]["id"]
    
    print(f"\n[6a-test] POST eligibility without payerId")
    r = requests.post(f"{BASE_URL}/api/enterprise/employees/{no_ins_employee_id}/eligibility",
                     json={},
                     cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 400, "eligibility without payerId"): return 1
    data = r.json()
    if "error" not in data or "insurance" not in data["error"].lower():
        print(f"❌ FAILED: Expected error about insurance, got {data}")
        return 1
    print(f"✅ Eligibility check correctly returns 400 without payerId: {data['error']}")
    
    # 6b. POST eligibility with payerId (using employee from step 5)
    print(f"\n[6b] POST eligibility with payerId (employee {employee_id})")
    r = requests.post(f"{BASE_URL}/api/enterprise/employees/{employee_id}/eligibility",
                     json={},
                     cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200, "eligibility with payerId"): return 1
    data = r.json()
    # Either {ok:true, status, ...} or {error: ...} is acceptable (Stedi may reject synthetic member)
    if "ok" in data:
        print(f"✅ Eligibility check returned success: status={data.get('status')}")
    elif "error" in data:
        print(f"✅ Eligibility check returned error (acceptable for test data): {data['error'][:100]}")
    else:
        print(f"❌ FAILED: Unexpected response shape: {data}")
        return 1
    
    # Verify EligibilityCheck was created
    checks = list(db.EligibilityCheck.find({"patientId": patient_id}).sort("createdAt", -1).limit(1))
    if len(checks) == 0:
        print(f"⚠️  WARNING: No EligibilityCheck record found (may be expected if Stedi not configured)")
    else:
        print(f"✅ EligibilityCheck record created: status={checks[0].get('status')}")
    
    # ========================================================================
    # TEST 7: Consent forms (GET forms, POST consent, POST sign, GET document)
    # ========================================================================
    test_step(7, "Consent forms - GET forms, POST consent, POST sign, GET document PDF")
    
    # 7a. GET forms
    print("\n[7a] GET /api/enterprise/forms")
    r = requests.get(f"{BASE_URL}/api/enterprise/forms",
                    cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200, "get forms"): return 1
    data = r.json()
    if not assert_json_field(data, "forms"): return 1
    forms = data["forms"]
    if len(forms) != 4:
        print(f"❌ FAILED: Expected 4 forms, got {len(forms)}")
        return 1
    print(f"✅ Found 4 consent forms:")
    for form in forms:
        print(f"  - {form['key']}: {form['title']}")
    
    # 7b. POST consent
    print(f"\n[7b] POST /api/enterprise/consents (create pending consent)")
    r = requests.post(f"{BASE_URL}/api/enterprise/consents",
                     json={
                         "employeeId": employee_id,
                         "formKey": "drug_test_consent"
                     },
                     cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200, "create consent"): return 1
    data = r.json()
    if not assert_json_field(data, "ok", True): return 1
    if not assert_json_field(data, "consent"): return 1
    consent = data["consent"]
    if consent.get("status") != "pending":
        print(f"❌ FAILED: Expected status='pending', got {consent.get('status')}")
        return 1
    print(f"✅ Consent created with status='pending'")
    consent_id = consent["id"]
    
    # 7c. POST sign
    print(f"\n[7c] POST /api/enterprise/consents/{consent_id}/sign")
    r = requests.post(f"{BASE_URL}/api/enterprise/consents/{consent_id}/sign",
                     json={
                         "signatureText": "TestEmp Roster",
                         "signerName": "TestEmp Roster"
                     },
                     cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200, "sign consent"): return 1
    data = r.json()
    if not assert_json_field(data, "ok", True): return 1
    if not assert_json_field(data, "consent"): return 1
    if not assert_json_field(data, "documentId"): return 1
    consent = data["consent"]
    if consent.get("status") != "signed":
        print(f"❌ FAILED: Expected status='signed', got {consent.get('status')}")
        return 1
    print(f"✅ Consent signed with status='signed' and documentId={data['documentId']}")
    document_id = data["documentId"]
    
    # 7d. GET document PDF
    print(f"\n[7d] GET /api/enterprise/documents/{document_id}")
    r = requests.get(f"{BASE_URL}/api/enterprise/documents/{document_id}",
                    cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 200, "get document"): return 1
    if r.headers.get("Content-Type") != "application/pdf":
        print(f"❌ FAILED: Expected Content-Type='application/pdf', got {r.headers.get('Content-Type')}")
        return 1
    if not r.content.startswith(b"%PDF"):
        print(f"❌ FAILED: PDF does not start with '%PDF' magic bytes")
        return 1
    print(f"✅ Document PDF downloaded: {len(r.content)} bytes, starts with '%PDF'")
    
    # ========================================================================
    # TEST 8: Super-admin scoping
    # ========================================================================
    test_step(8, "Super-admin scoping - requires ?enterpriseId or body enterpriseId")
    
    # 8a. GET employees without enterpriseId
    print("\n[8a] Super admin GET /api/enterprise/employees WITHOUT ?enterpriseId")
    r = requests.get(f"{BASE_URL}/api/enterprise/employees",
                    cookies={"proactive_enterprise_session": super_admin_cookie})
    if not assert_status(r, 400, "super admin without enterpriseId"): return 1
    data = r.json()
    if "error" not in data or "company" not in data["error"].lower():
        print(f"❌ FAILED: Expected error about selecting company, got {data}")
        return 1
    print(f"✅ Super admin correctly returns 400 without enterpriseId: {data['error']}")
    
    # 8b. GET employees with enterpriseId
    print(f"\n[8b] Super admin GET /api/enterprise/employees?enterpriseId={lone_star_id}")
    r = requests.get(f"{BASE_URL}/api/enterprise/employees?enterpriseId={lone_star_id}",
                    cookies={"proactive_enterprise_session": super_admin_cookie})
    if not assert_status(r, 200, "super admin with enterpriseId"): return 1
    data = r.json()
    if not assert_json_field(data, "employees"): return 1
    print(f"✅ Super admin GET employees with enterpriseId: {len(data['employees'])} employees")
    
    # 8c. POST employee with body enterpriseId
    print(f"\n[8c] Super admin POST /api/enterprise/employees with body enterpriseId")
    r = requests.post(f"{BASE_URL}/api/enterprise/employees",
                     json={
                         "enterpriseId": lone_star_id,
                         "firstName": "SuperAdmin",
                         "lastName": "Created",
                         "dob": "1992-07-20"
                     },
                     cookies={"proactive_enterprise_session": super_admin_cookie})
    if not assert_status(r, 200, "super admin POST with enterpriseId"): return 1
    data = r.json()
    if not assert_json_field(data, "ok", True): return 1
    if not assert_json_field(data["employee"], "patientId"): return 1
    print(f"✅ Super admin created employee with patientId: {data['employee']['patientId']}")
    
    # ========================================================================
    # TEST 9: Data isolation
    # ========================================================================
    test_step(9, "Data isolation - company admin cannot access other company's employees")
    
    # 9a. Create employee in Alamo Manufacturing (using second company admin)
    print("\n[9a] Login as Alamo Manufacturing admin (safety@alamomfg.com)")
    r = requests.post(f"{BASE_URL}/api/enterprise/auth/login", json=COMPANY_ADMIN_2)
    if not assert_status(r, 200): return 1
    alamo_admin_cookie = r.cookies.get("proactive_enterprise_session")
    
    print("\n[9a] Create employee in Alamo Manufacturing")
    r = requests.post(f"{BASE_URL}/api/enterprise/employees",
                     json={
                         "firstName": "Alamo",
                         "lastName": "Employee",
                         "dob": "1988-11-10"
                     },
                     cookies={"proactive_enterprise_session": alamo_admin_cookie})
    if not assert_status(r, 200): return 1
    alamo_employee_id = r.json()["employee"]["id"]
    print(f"✅ Alamo employee created: {alamo_employee_id}")
    
    # 9b. Lone Star admin tries to GET Alamo employee
    print(f"\n[9b] Lone Star admin GET /api/enterprise/employees/{alamo_employee_id}")
    r = requests.get(f"{BASE_URL}/api/enterprise/employees/{alamo_employee_id}",
                    cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 404, "cross-company GET"): return 1
    print(f"✅ Lone Star admin correctly gets 404 for Alamo employee")
    
    # 9c. Lone Star admin tries to POST insurance to Alamo employee
    print(f"\n[9c] Lone Star admin POST insurance to Alamo employee")
    r = requests.post(f"{BASE_URL}/api/enterprise/employees/{alamo_employee_id}/insurance",
                     json={
                         "insurerName": "UnitedHealthcare",
                         "memberId": "UHC123"
                     },
                     cookies={"proactive_enterprise_session": company_admin_cookie})
    if not assert_status(r, 404, "cross-company POST insurance"): return 1
    print(f"✅ Lone Star admin correctly gets 404 when posting insurance to Alamo employee")
    
    # ========================================================================
    # TEST 10: Auth guards
    # ========================================================================
    test_step(10, "Auth guards - all /api/enterprise/* without cookie → 401")
    
    endpoints = [
        ("GET", f"{BASE_URL}/api/enterprise/companies"),
        ("GET", f"{BASE_URL}/api/enterprise/employees"),
        ("POST", f"{BASE_URL}/api/enterprise/employees"),
        ("GET", f"{BASE_URL}/api/enterprise/employees/{employee_id}"),
        ("POST", f"{BASE_URL}/api/enterprise/employees/{employee_id}/insurance"),
        ("POST", f"{BASE_URL}/api/enterprise/employees/{employee_id}/medications"),
        ("POST", f"{BASE_URL}/api/enterprise/employees/{employee_id}/referrals"),
        ("POST", f"{BASE_URL}/api/enterprise/employees/{employee_id}/eligibility"),
        ("GET", f"{BASE_URL}/api/enterprise/forms"),
        ("POST", f"{BASE_URL}/api/enterprise/consents"),
        ("POST", f"{BASE_URL}/api/enterprise/consents/{consent_id}/sign"),
        ("GET", f"{BASE_URL}/api/enterprise/documents/{document_id}"),
    ]
    
    print("\n[10] Testing auth guards on all enterprise endpoints")
    failed = []
    for method, url in endpoints:
        if method == "GET":
            r = requests.get(url)
        else:
            r = requests.post(url, json={})
        
        if r.status_code != 401:
            failed.append(f"{method} {url.split('/api/')[1]} returned {r.status_code}")
        else:
            print(f"✅ {method} {url.split('/api/')[1]} → 401")
    
    if failed:
        print(f"\n❌ FAILED auth guards:")
        for f in failed:
            print(f"  - {f}")
        return 1
    
    print(f"\n✅ All {len(endpoints)} endpoints correctly return 401 without auth cookie")
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n" + "="*80)
    print("ALL TESTS PASSED ✅")
    print("="*80)
    print("\nSummary:")
    print("✅ TEST 1: Dual login roles (company_admin, super_admin, wrong password)")
    print("✅ TEST 2: GET /api/enterprise/companies (own company vs ALL companies)")
    print("✅ TEST 3: POST /api/enterprise/employees (creates employee with patientId)")
    print("✅ TEST 4: GET /api/enterprise/employees/[id] (returns employee + chart)")
    print("✅ TEST 5: Chart writes (insurance/medications/referrals + AuditLog)")
    print("✅ TEST 6: Eligibility check (400 without payerId, 200 with payerId)")
    print("✅ TEST 7: Consent forms (GET forms, POST consent, POST sign, GET document PDF)")
    print("✅ TEST 8: Super-admin scoping (400 without enterpriseId, 200 with enterpriseId)")
    print("✅ TEST 9: Data isolation (404 for cross-company access)")
    print("✅ TEST 10: Auth guards (all endpoints return 401 without cookie)")
    print("\n" + "="*80)
    
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"\n❌ EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
