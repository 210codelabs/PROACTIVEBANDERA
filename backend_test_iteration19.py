#!/usr/bin/env python3
"""
Backend test for Iteration 19: Auto-Attach intake to chart + PDF regression
Tests the auto-attach feature and PDF generation endpoints.
"""

import requests
import json
import random
import string

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Staff credentials
STAFF_EMAIL = "andy.manzano@proactiveclinic.com"
STAFF_PASSWORD = "apex123"

def random_suffix():
    """Generate random suffix for unique test data"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

def test_auto_attach_workflow():
    """Test A: AUTO-ATTACH intake to chart workflow"""
    print("\n" + "="*80)
    print("TEST A: AUTO-ATTACH INTAKE TO CHART WORKFLOW")
    print("="*80)
    
    # Step 1: Submit intake form (public, no auth)
    print("\n[Step 1] POST /api/intake/submit (public, no auth)")
    random_last_name = f"Test{random_suffix()}"
    intake_data = {
        "slug": "new-patient-intake",
        "lang": "en",
        "values": {
            "firstName": "Attach",
            "lastName": random_last_name,
            "dob": "1990-04-05",
            "signature": "Attach Test",
            "allergies": "Penicillin, Latex",
            "conditions": "Hypertension, Diabetes",
            "currentMedications": "Ibuprofen 200mg\nLisinopril",
            "bodyMap": {
                "front": [{"x": 0.5, "y": 0.3, "type": "sharp"}],
                "back": []
            }
        }
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/intake/submit", json=intake_data, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Intake submitted successfully")
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            assert data.get("ok") == True, "Expected ok:true"
            assert "confirmation" in data, "Expected confirmation field"
            assert "mrn" in data, "Expected mrn field"
            print(f"   Confirmation: {data['confirmation']}")
            print(f"   MRN: {data['mrn']}")
        else:
            print(f"❌ FAILED: Expected 200, got {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ FAILED: Exception during intake submit: {e}")
        return False
    
    # Step 2: Staff login to get cookie
    print("\n[Step 2] Staff login to get session cookie")
    try:
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
            timeout=30
        )
        print(f"Status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            staff_cookies = login_response.cookies
            print(f"✅ Staff login successful")
            print(f"   Cookies: {dict(staff_cookies)}")
        else:
            print(f"❌ FAILED: Staff login failed with {login_response.status_code}")
            print(f"   Response: {login_response.text}")
            return False
    except Exception as e:
        print(f"❌ FAILED: Exception during staff login: {e}")
        return False
    
    # Step 3: Get submissions list and find our submission
    print("\n[Step 3] GET /api/intake/submissions?status=pending (with staff cookie)")
    try:
        submissions_response = requests.get(
            f"{BASE_URL}/api/intake/submissions?status=pending",
            cookies=staff_cookies,
            timeout=30
        )
        print(f"Status: {submissions_response.status_code}")
        
        if submissions_response.status_code == 200:
            submissions_data = submissions_response.json()
            print(f"✅ Submissions retrieved successfully")
            
            # Find our submission by patientName
            target_name = f"Attach {random_last_name}"
            submission_id = None
            for sub in submissions_data.get("submissions", []):
                if sub.get("patientName") == target_name:
                    submission_id = sub.get("id")
                    print(f"   Found submission: {target_name}")
                    print(f"   Submission ID: {submission_id}")
                    break
            
            if not submission_id:
                print(f"❌ FAILED: Could not find submission for {target_name}")
                print(f"   Available submissions: {[s.get('patientName') for s in submissions_data.get('submissions', [])]}")
                return False
        else:
            print(f"❌ FAILED: Expected 200, got {submissions_response.status_code}")
            print(f"   Response: {submissions_response.text}")
            return False
    except Exception as e:
        print(f"❌ FAILED: Exception during submissions retrieval: {e}")
        return False
    
    # Step 4: Approve submission (should auto-attach to chart)
    print("\n[Step 4] POST /api/intake/submissions/{id}/review {action:'approve'} (with staff cookie)")
    try:
        approve_response = requests.post(
            f"{BASE_URL}/api/intake/submissions/{submission_id}/review",
            json={"action": "approve"},
            cookies=staff_cookies,
            timeout=30
        )
        print(f"Status: {approve_response.status_code}")
        
        if approve_response.status_code == 200:
            approve_data = approve_response.json()
            print(f"✅ Submission approved successfully")
            print(f"   Response: {json.dumps(approve_data, indent=2)}")
            
            # Verify response structure
            assert approve_data.get("ok") == True, "Expected ok:true"
            assert approve_data.get("reviewStatus") == "approved", "Expected reviewStatus:'approved'"
            
            # Verify attached object
            attached = approve_data.get("attached")
            if attached:
                print(f"   ✅ Auto-attach successful:")
                print(f"      Problems: {attached.get('problems')}")
                print(f"      Allergies: {attached.get('allergies')}")
                print(f"      Medications: {attached.get('medications')}")
                
                # Verify expected counts
                assert attached.get("problems") == 2, f"Expected 2 problems, got {attached.get('problems')}"
                assert attached.get("allergies") == 2, f"Expected 2 allergies, got {attached.get('allergies')}"
                assert attached.get("medications") == 2, f"Expected 2 medications, got {attached.get('medications')}"
                print(f"   ✅ Attached counts verified: problems=2, allergies=2, medications=2")
            else:
                print(f"   ❌ FAILED: Expected 'attached' object in response")
                return False
        else:
            print(f"❌ FAILED: Expected 200, got {approve_response.status_code}")
            print(f"   Response: {approve_response.text}")
            return False
    except Exception as e:
        print(f"❌ FAILED: Exception during approval: {e}")
        return False
    
    # Step 5: Reopen submission
    print("\n[Step 5] POST /api/intake/submissions/{id}/review {action:'reopen'} (with staff cookie)")
    try:
        reopen_response = requests.post(
            f"{BASE_URL}/api/intake/submissions/{submission_id}/review",
            json={"action": "reopen"},
            cookies=staff_cookies,
            timeout=30
        )
        print(f"Status: {reopen_response.status_code}")
        
        if reopen_response.status_code == 200:
            reopen_data = reopen_response.json()
            print(f"✅ Submission reopened successfully")
            print(f"   Response: {json.dumps(reopen_data, indent=2)}")
            
            # Verify response structure
            assert reopen_data.get("ok") == True, "Expected ok:true"
            assert reopen_data.get("reviewStatus") == "pending", "Expected reviewStatus:'pending'"
            print(f"   ✅ Review status changed to 'pending'")
        else:
            print(f"❌ FAILED: Expected 200, got {reopen_response.status_code}")
            print(f"   Response: {reopen_response.text}")
            return False
    except Exception as e:
        print(f"❌ FAILED: Exception during reopen: {e}")
        return False
    
    # Step 6: Approve again (should be idempotent - no duplicates)
    print("\n[Step 6] POST /api/intake/submissions/{id}/review {action:'approve'} AGAIN (idempotent test)")
    try:
        approve2_response = requests.post(
            f"{BASE_URL}/api/intake/submissions/{submission_id}/review",
            json={"action": "approve"},
            cookies=staff_cookies,
            timeout=30
        )
        print(f"Status: {approve2_response.status_code}")
        
        if approve2_response.status_code == 200:
            approve2_data = approve2_response.json()
            print(f"✅ Second approval successful")
            print(f"   Response: {json.dumps(approve2_data, indent=2)}")
            
            # Verify response structure
            assert approve2_data.get("ok") == True, "Expected ok:true"
            assert approve2_data.get("reviewStatus") == "approved", "Expected reviewStatus:'approved'"
            
            # Verify attached is null (idempotent - no duplicates)
            attached2 = approve2_data.get("attached")
            if attached2 is None:
                print(f"   ✅ Idempotent behavior verified: attached=null (no duplicates added)")
            else:
                print(f"   ❌ FAILED: Expected attached:null for idempotent approval, got {attached2}")
                return False
        else:
            print(f"❌ FAILED: Expected 200, got {approve2_response.status_code}")
            print(f"   Response: {approve2_response.text}")
            return False
    except Exception as e:
        print(f"❌ FAILED: Exception during second approval: {e}")
        return False
    
    # Step 7: Test invalid action
    print("\n[Step 7] POST /api/intake/submissions/{id}/review {action:'bogus'} (invalid action)")
    try:
        invalid_response = requests.post(
            f"{BASE_URL}/api/intake/submissions/{submission_id}/review",
            json={"action": "bogus"},
            cookies=staff_cookies,
            timeout=30
        )
        print(f"Status: {invalid_response.status_code}")
        
        if invalid_response.status_code == 400:
            print(f"✅ Invalid action correctly rejected with 400")
            print(f"   Response: {invalid_response.text}")
        else:
            print(f"❌ FAILED: Expected 400, got {invalid_response.status_code}")
            print(f"   Response: {invalid_response.text}")
            return False
    except Exception as e:
        print(f"❌ FAILED: Exception during invalid action test: {e}")
        return False
    
    # Step 8: Test without staff cookie (should be 401)
    print("\n[Step 8] POST /api/intake/submissions/{id}/review {action:'approve'} WITHOUT staff cookie")
    try:
        unauth_response = requests.post(
            f"{BASE_URL}/api/intake/submissions/{submission_id}/review",
            json={"action": "approve"},
            timeout=30
        )
        print(f"Status: {unauth_response.status_code}")
        
        if unauth_response.status_code == 401:
            print(f"✅ Unauthorized request correctly blocked with 401")
            print(f"   Response: {unauth_response.text}")
        else:
            print(f"❌ FAILED: Expected 401, got {unauth_response.status_code}")
            print(f"   Response: {unauth_response.text}")
            return False
    except Exception as e:
        print(f"❌ FAILED: Exception during unauthorized test: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ TEST A: AUTO-ATTACH WORKFLOW - ALL TESTS PASSED")
    print("="*80)
    return True


def test_pdf_regression():
    """Test B: PDF regression (public, no auth)"""
    print("\n" + "="*80)
    print("TEST B: PDF REGRESSION (PUBLIC, NO AUTH)")
    print("="*80)
    
    # Step 9: GET blank PDF
    print("\n[Step 9] GET /api/intake/forms/new-patient-intake/pdf (public, no auth)")
    try:
        pdf_response = requests.get(
            f"{BASE_URL}/api/intake/forms/new-patient-intake/pdf",
            timeout=30
        )
        print(f"Status: {pdf_response.status_code}")
        
        if pdf_response.status_code == 200:
            content_type = pdf_response.headers.get("Content-Type", "")
            print(f"✅ Blank PDF retrieved successfully")
            print(f"   Content-Type: {content_type}")
            print(f"   Content-Length: {len(pdf_response.content)} bytes")
            
            # Verify Content-Type
            assert "application/pdf" in content_type, f"Expected application/pdf, got {content_type}"
            print(f"   ✅ Content-Type is application/pdf")
            
            # Verify PDF magic bytes
            pdf_bytes = pdf_response.content
            if pdf_bytes[:4] == b'%PDF':
                print(f"   ✅ PDF starts with '%PDF' magic bytes")
            else:
                print(f"   ❌ FAILED: PDF does not start with '%PDF', starts with {pdf_bytes[:10]}")
                return False
        else:
            print(f"❌ FAILED: Expected 200, got {pdf_response.status_code}")
            print(f"   Response: {pdf_response.text}")
            return False
    except Exception as e:
        print(f"❌ FAILED: Exception during blank PDF retrieval: {e}")
        return False
    
    # Step 10: POST filled PDF
    print("\n[Step 10] POST /api/intake/forms/new-patient-intake/pdf with values (public, no auth)")
    filled_data = {
        "values": {
            "firstName": "X",
            "bodyMap": {
                "front": [{"x": 0.5, "y": 0.3, "type": "numb"}],
                "back": []
            }
        },
        "lang": "es"
    }
    
    try:
        filled_response = requests.post(
            f"{BASE_URL}/api/intake/forms/new-patient-intake/pdf",
            json=filled_data,
            timeout=30
        )
        print(f"Status: {filled_response.status_code}")
        
        if filled_response.status_code == 200:
            content_type = filled_response.headers.get("Content-Type", "")
            print(f"✅ Filled PDF retrieved successfully")
            print(f"   Content-Type: {content_type}")
            print(f"   Content-Length: {len(filled_response.content)} bytes")
            
            # Verify Content-Type
            assert "application/pdf" in content_type, f"Expected application/pdf, got {content_type}"
            print(f"   ✅ Content-Type is application/pdf")
            
            # Verify PDF magic bytes
            pdf_bytes = filled_response.content
            if pdf_bytes[:4] == b'%PDF':
                print(f"   ✅ PDF starts with '%PDF' magic bytes")
            else:
                print(f"   ❌ FAILED: PDF does not start with '%PDF', starts with {pdf_bytes[:10]}")
                return False
        else:
            print(f"❌ FAILED: Expected 200, got {filled_response.status_code}")
            print(f"   Response: {filled_response.text}")
            return False
    except Exception as e:
        print(f"❌ FAILED: Exception during filled PDF retrieval: {e}")
        return False
    
    # Step 11: GET PDF with unknown slug (should be 404)
    print("\n[Step 11] GET /api/intake/forms/unknown/pdf (should be 404)")
    try:
        unknown_response = requests.get(
            f"{BASE_URL}/api/intake/forms/unknown/pdf",
            timeout=30
        )
        print(f"Status: {unknown_response.status_code}")
        
        if unknown_response.status_code == 404:
            print(f"✅ Unknown slug correctly returns 404")
            print(f"   Response: {unknown_response.text}")
        else:
            print(f"❌ FAILED: Expected 404, got {unknown_response.status_code}")
            print(f"   Response: {unknown_response.text}")
            return False
    except Exception as e:
        print(f"❌ FAILED: Exception during unknown slug test: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ TEST B: PDF REGRESSION - ALL TESTS PASSED")
    print("="*80)
    return True


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BACKEND TEST: ITERATION 19")
    print("Auto-Attach intake to chart + PDF regression")
    print("="*80)
    
    results = {
        "auto_attach": False,
        "pdf_regression": False
    }
    
    try:
        # Test A: Auto-attach workflow
        results["auto_attach"] = test_auto_attach_workflow()
        
        # Test B: PDF regression
        results["pdf_regression"] = test_pdf_regression()
        
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
    
    # Final summary
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    
    all_passed = all(results.values())
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED")
        return 1


if __name__ == "__main__":
    exit(main())
