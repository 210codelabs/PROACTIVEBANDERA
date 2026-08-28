#!/usr/bin/env python3
"""
Backend test for DOT/FMCSA occupational-health module.
Tests the complete exam workflow from creation to PDF generation and transmission.
"""
import requests
import json
import sys

# Base URL from environment
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Test credentials
COMPANY_ADMIN = {"email": "hr@lonestarlogistics.com", "password": "demo1234"}
SUPER_ADMIN = {"email": "admin@proactiveclinic.com", "password": "apex123"}

def print_test(step, description):
    print(f"\n{'='*80}")
    print(f"STEP {step}: {description}")
    print('='*80)

def print_result(success, message):
    status = "✅ PASSED" if success else "❌ FAILED"
    print(f"{status}: {message}")

def main():
    session = requests.Session()
    
    try:
        # STEP 1: GET /api/enterprise/dot/exams with NO cookie -> expect 401
        print_test(1, "AUTH GUARD - GET /api/enterprise/dot/exams WITHOUT cookie")
        resp = requests.get(f"{BASE_URL}/api/enterprise/dot/exams")
        if resp.status_code == 401:
            print_result(True, f"Returns 401 Unauthorized as expected")
        else:
            print_result(False, f"Expected 401, got {resp.status_code}: {resp.text[:200]}")
            return False
        
        # STEP 2: Login company_admin and GET /api/enterprise/employees -> capture employeeId
        print_test(2, "LOGIN COMPANY ADMIN & GET EMPLOYEES")
        resp = session.post(f"{BASE_URL}/api/enterprise/auth/login", json=COMPANY_ADMIN)
        if resp.status_code != 200:
            print_result(False, f"Login failed: {resp.status_code} {resp.text[:200]}")
            return False
        print_result(True, f"Company admin login successful: {resp.json()}")
        
        # Get employees
        resp = session.get(f"{BASE_URL}/api/enterprise/employees")
        if resp.status_code != 200:
            print_result(False, f"GET employees failed: {resp.status_code} {resp.text[:200]}")
            return False
        data = resp.json()
        if not data.get("employees") or len(data["employees"]) == 0:
            print_result(False, "No employees found in the system")
            return False
        employee_id = data["employees"][0]["id"]
        employee_name = f"{data['employees'][0]['firstName']} {data['employees'][0]['lastName']}"
        print_result(True, f"Found {len(data['employees'])} employees. Using employeeId={employee_id} ({employee_name})")
        
        # STEP 3: POST /api/enterprise/dot/exams {employeeId} -> 200, capture examId + kioskToken
        print_test(3, "CREATE DOT EXAM")
        resp = session.post(f"{BASE_URL}/api/enterprise/dot/exams", json={"employeeId": employee_id})
        if resp.status_code != 200:
            print_result(False, f"Create exam failed: {resp.status_code} {resp.text[:200]}")
            return False
        data = resp.json()
        if not data.get("ok") or not data.get("exam"):
            print_result(False, f"Unexpected response structure: {data}")
            return False
        exam = data["exam"]
        exam_id = exam["id"]
        kiosk_token = exam.get("kioskToken")
        if exam["status"] != "driver_pending":
            print_result(False, f"Expected status='driver_pending', got '{exam['status']}'")
            return False
        if not kiosk_token:
            print_result(False, "kioskToken is null or missing")
            return False
        print_result(True, f"Exam created: id={exam_id}, status={exam['status']}, kioskToken={kiosk_token[:8]}...")
        
        # STEP 4: PUBLIC GET /api/enterprise/dot/kiosk/{kioskToken} -> 200 with exam data
        print_test(4, "PUBLIC KIOSK GET (no cookie)")
        resp = requests.get(f"{BASE_URL}/api/enterprise/dot/kiosk/{kiosk_token}")
        if resp.status_code != 200:
            print_result(False, f"Kiosk GET failed: {resp.status_code} {resp.text[:200]}")
            return False
        data = resp.json()
        exam_data = data.get("exam", {})
        if not exam_data.get("driverName"):
            print_result(False, f"Missing driverName in response: {data}")
            return False
        if exam_data.get("alreadySigned") != False:
            print_result(False, f"Expected alreadySigned=false, got {exam_data.get('alreadySigned')}")
            return False
        print_result(True, f"Kiosk GET successful: driverName={exam_data['driverName']}, alreadySigned={exam_data['alreadySigned']}")
        
        # STEP 5: PUBLIC POST /api/enterprise/dot/kiosk/{kioskToken} with driver data
        print_test(5, "PUBLIC KIOSK POST - Driver submits health history")
        kiosk_payload = {
            "driverInfo": {
                "diabetesTreatment": "insulin",
                "medications": "metformin, insulin",
                "licenseNumber": "X123",
                "licenseState": "TX"
            },
            "healthHistory": {
                "diabetes": {"yes": True, "detail": "type 1"},
                "hypertension": {"yes": True}
            },
            "driverSignature": "John Driver"
        }
        resp = requests.post(f"{BASE_URL}/api/enterprise/dot/kiosk/{kiosk_token}", json=kiosk_payload)
        if resp.status_code != 200:
            print_result(False, f"Kiosk POST failed: {resp.status_code} {resp.text[:200]}")
            return False
        data = resp.json()
        if not data.get("ok"):
            print_result(False, f"Expected ok:true, got {data}")
            return False
        print_result(True, "Driver health history submitted successfully")
        
        # STEP 6: POST same kiosk token again -> expect 404 (one-time token invalidated)
        print_test(6, "KIOSK TOKEN INVALIDATION - POST same token again")
        resp = requests.post(f"{BASE_URL}/api/enterprise/dot/kiosk/{kiosk_token}", json=kiosk_payload)
        if resp.status_code == 404:
            print_result(True, "Token correctly invalidated after first use (404)")
        else:
            print_result(False, f"Expected 404, got {resp.status_code}: {resp.text[:200]}")
            return False
        
        # STEP 7: GET /api/enterprise/dot/exams/{examId} as company_admin
        print_test(7, "GET EXAM AFTER DRIVER SUBMISSION - Check alerts and forms")
        resp = session.get(f"{BASE_URL}/api/enterprise/dot/exams/{exam_id}")
        if resp.status_code != 200:
            print_result(False, f"GET exam failed: {resp.status_code} {resp.text[:200]}")
            return False
        data = resp.json()
        exam = data.get("exam", {})
        
        # Verify status
        if exam.get("status") != "exam_pending":
            print_result(False, f"Expected status='exam_pending', got '{exam.get('status')}'")
            return False
        print(f"✓ Status: {exam['status']}")
        
        # Verify driverSignedAt is set
        if not exam.get("driverSignedAt"):
            print_result(False, "driverSignedAt is not set")
            return False
        print(f"✓ driverSignedAt: {exam['driverSignedAt']}")
        
        # Verify alerts is non-empty array
        alerts = exam.get("alerts", [])
        if not isinstance(alerts, list) or len(alerts) == 0:
            print_result(False, f"Expected non-empty alerts array, got {alerts}")
            return False
        print(f"✓ Alerts count: {len(alerts)}")
        
        # Check for insulin/ITDM critical alert
        alert_codes = [a.get("code") for a in alerts if isinstance(a, dict)]
        print(f"✓ Alert codes: {alert_codes}")
        has_insulin_alert = any("insulin" in str(code).lower() or "itdm" in str(code).lower() for code in alert_codes)
        if not has_insulin_alert:
            print_result(False, f"Expected insulin/ITDM alert, got codes: {alert_codes}")
            return False
        print(f"✓ Found insulin/ITDM critical alert")
        
        # Verify additionalFormsRequired includes MCSA-5870
        forms = exam.get("additionalFormsRequired", [])
        if "MCSA-5870" not in forms:
            print_result(False, f"Expected 'MCSA-5870' in additionalFormsRequired, got {forms}")
            return False
        print(f"✓ additionalFormsRequired: {forms}")
        
        print_result(True, f"Exam after driver submission verified: status={exam['status']}, alerts={len(alerts)}, forms={forms}")
        
        # STEP 8: PATCH /api/enterprise/dot/exams/{examId} with examiner data
        print_test(8, "EXAMINER COMPLETES EXAM - PATCH with vitals, vision, determination")
        examiner_payload = {
            "vitals": {
                "bpSystolic": 165,
                "bpDiastolic": 100,
                "heightIn": 70,
                "weightLb": 200,
                "pulse": 72
            },
            "vision": {
                "acuityRightCorrected": "20/30",
                "acuityLeftCorrected": "20/30",
                "fieldRightDeg": 120,
                "fieldLeftDeg": 120,
                "colorPass": True
            },
            "determinationFlags": {
                "meetsWithExemption": True
            },
            "certMonths": 3,
            "restrictions": ["corrective_lenses"],
            "examinerName": "Dr. Smith",
            "examinerNrcme": "1234567890",
            "examinerLicense": "M999",
            "examinerLicenseState": "TX",
            "examDate": "2026-08-25"
        }
        resp = session.patch(f"{BASE_URL}/api/enterprise/dot/exams/{exam_id}", json=examiner_payload)
        if resp.status_code != 200:
            print_result(False, f"PATCH exam failed: {resp.status_code} {resp.text[:200]}")
            return False
        data = resp.json()
        exam = data.get("exam", {})
        
        # Verify status is completed
        if exam.get("status") != "completed":
            print_result(False, f"Expected status='completed', got '{exam.get('status')}'")
            return False
        print(f"✓ Status: {exam['status']}")
        
        # Verify outcome
        if exam.get("outcome") != "qualified_with_restrictions":
            print_result(False, f"Expected outcome='qualified_with_restrictions', got '{exam.get('outcome')}'")
            return False
        print(f"✓ Outcome: {exam['outcome']}")
        
        # Verify expiresOn is set (approximately 3 months after examDate)
        if not exam.get("expiresOn"):
            print_result(False, "expiresOn is not set")
            return False
        print(f"✓ expiresOn: {exam['expiresOn']}")
        
        # Verify bpCategory mentions Stage 2
        bp_category = exam.get("bpCategory", "")
        if "stage 2" not in bp_category.lower():
            print_result(False, f"Expected bpCategory to mention 'Stage 2', got '{bp_category}'")
            return False
        print(f"✓ bpCategory: {bp_category}")
        
        # Verify suggestedCertMonths <= 3
        suggested = data.get("suggestedCertMonths")
        if suggested is not None and suggested > 3:
            print_result(False, f"Expected suggestedCertMonths <= 3, got {suggested}")
            return False
        print(f"✓ suggestedCertMonths: {suggested}")
        
        # Verify transmissionStatus is ready
        if exam.get("transmissionStatus") != "ready":
            print_result(False, f"Expected transmissionStatus='ready', got '{exam.get('transmissionStatus')}'")
            return False
        print(f"✓ transmissionStatus: {exam['transmissionStatus']}")
        
        # Check for bp_stage2 alert
        alerts = exam.get("alerts", [])
        alert_codes = [a.get("code") for a in alerts if isinstance(a, dict)]
        print(f"✓ Alert codes after examiner completion: {alert_codes}")
        
        print_result(True, f"Examiner completion verified: status={exam['status']}, outcome={exam['outcome']}, bpCategory={bp_category}")
        
        # STEP 9: GET /api/enterprise/dot/exams/{examId}/pdf?form=5875 -> PDF
        print_test(9, "GENERATE MCSA-5875 PDF")
        resp = session.get(f"{BASE_URL}/api/enterprise/dot/exams/{exam_id}/pdf?form=5875")
        if resp.status_code != 200:
            print_result(False, f"PDF generation failed: {resp.status_code} {resp.text[:200]}")
            return False
        content_type = resp.headers.get("Content-Type", "")
        if "application/pdf" not in content_type:
            print_result(False, f"Expected Content-Type 'application/pdf', got '{content_type}'")
            return False
        if not resp.content.startswith(b"%PDF"):
            print_result(False, f"Response does not start with PDF magic bytes, starts with: {resp.content[:20]}")
            return False
        print_result(True, f"MCSA-5875 PDF generated: Content-Type={content_type}, size={len(resp.content)} bytes, starts with %PDF")
        
        # STEP 10: GET /api/enterprise/dot/exams/{examId}/pdf?form=mec -> PDF
        print_test(10, "GENERATE MEC CARD PDF")
        resp = session.get(f"{BASE_URL}/api/enterprise/dot/exams/{exam_id}/pdf?form=mec")
        if resp.status_code != 200:
            print_result(False, f"MEC PDF generation failed: {resp.status_code} {resp.text[:200]}")
            return False
        content_type = resp.headers.get("Content-Type", "")
        if "application/pdf" not in content_type:
            print_result(False, f"Expected Content-Type 'application/pdf', got '{content_type}'")
            return False
        if not resp.content.startswith(b"%PDF"):
            print_result(False, f"Response does not start with PDF magic bytes, starts with: {resp.content[:20]}")
            return False
        print_result(True, f"MEC card PDF generated: Content-Type={content_type}, size={len(resp.content)} bytes, starts with %PDF")
        
        # STEP 11: POST /api/enterprise/dot/exams/{examId}/transmit
        print_test(11, "TRANSMIT EXAM TO NATIONAL REGISTRY")
        resp = session.post(f"{BASE_URL}/api/enterprise/dot/exams/{exam_id}/transmit")
        if resp.status_code != 200:
            print_result(False, f"Transmit failed: {resp.status_code} {resp.text[:200]}")
            return False
        data = resp.json()
        if not data.get("ok"):
            print_result(False, f"Expected ok:true, got {data}")
            return False
        if data.get("status") != "exported":
            print_result(False, f"Expected status='exported', got '{data.get('status')}'")
            return False
        payload = data.get("payload", {})
        if not payload.get("json") or not payload.get("xml"):
            print_result(False, f"Expected payload with json and xml fields, got {payload.keys()}")
            return False
        print_result(True, f"Transmit successful: status={data['status']}, payload has json and xml")
        
        # STEP 12: GET /api/enterprise/dot/carrier-lookup?dot=76830 -> expect 503 (not configured)
        print_test(12, "CARRIER LOOKUP - Expect 503 (FMCSA_QCMOBILE_KEY not set)")
        resp = session.get(f"{BASE_URL}/api/enterprise/dot/carrier-lookup?dot=76830")
        if resp.status_code == 503:
            data = resp.json()
            if data.get("configured") == False:
                print_result(True, f"Carrier lookup correctly returns 503 with configured=false (EXPECTED)")
            else:
                print_result(False, f"Expected configured=false in response, got {data}")
                return False
        else:
            print_result(False, f"Expected 503, got {resp.status_code}: {resp.text[:200]}")
            return False
        
        # STEP 13: Super admin scope check
        print_test(13, "SUPER ADMIN SCOPE CHECK - GET exams WITHOUT enterpriseId")
        # Login as super admin
        super_session = requests.Session()
        resp = super_session.post(f"{BASE_URL}/api/enterprise/auth/login", json=SUPER_ADMIN)
        if resp.status_code != 200:
            print_result(False, f"Super admin login failed: {resp.status_code} {resp.text[:200]}")
            return False
        print(f"✓ Super admin login successful: {resp.json()}")
        
        # GET exams without enterpriseId parameter
        resp = super_session.get(f"{BASE_URL}/api/enterprise/dot/exams")
        if resp.status_code == 400:
            data = resp.json()
            error = data.get("error", "")
            if "select a company" in error.lower():
                print_result(True, f"Super admin correctly requires enterpriseId: {error}")
            else:
                print_result(False, f"Expected 'Select a company' error, got '{error}'")
                return False
        else:
            print_result(False, f"Expected 400, got {resp.status_code}: {resp.text[:200]}")
            return False
        
        print("\n" + "="*80)
        print("🎉 ALL 13 TEST STEPS PASSED SUCCESSFULLY!")
        print("="*80)
        print(f"\nAlert codes observed:")
        print(f"  Step 7 (after driver submission): {alert_codes}")
        print(f"\nTest exam created: {exam_id}")
        print("Note: Test data left in database for inspection.")
        return True
        
    except Exception as e:
        print(f"\n❌ EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
