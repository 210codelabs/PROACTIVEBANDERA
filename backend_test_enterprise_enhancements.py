#!/usr/bin/env python3
"""
Backend test for Enterprise Portal Enhancements:
- Bulk request import
- Clinic result-doc upload (cross-context download)
- Invoice PDF generation (both enterprise and admin)
- Balance due calculation
"""

import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def test_enterprise_enhancements():
    """Test enterprise portal enhancements with two auth contexts"""
    
    print("\n" + "="*80)
    print("ENTERPRISE PORTAL ENHANCEMENTS - BACKEND TEST")
    print("="*80)
    
    enterprise_cookie = None
    admin_cookie = None
    
    # ============================================================================
    # TEST 1: Enterprise Login
    # ============================================================================
    try:
        print("\n[TEST 1] Enterprise Login (hr@lonestarlogistics.com)")
        resp = requests.post(
            f"{BASE_URL}/api/enterprise/auth/login",
            json={"email": "hr@lonestarlogistics.com", "password": "demo1234"},
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"  ❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        if not data.get("ok"):
            print(f"  ❌ FAILED: Response missing 'ok: true'")
            print(f"  Response: {json.dumps(data, indent=2)[:500]}")
            return False
        
        # Capture enterprise session cookie
        if "proactive_enterprise_session" in resp.cookies:
            enterprise_cookie = {"proactive_enterprise_session": resp.cookies["proactive_enterprise_session"]}
            print(f"  ✅ Enterprise session cookie captured")
        else:
            print(f"  ❌ FAILED: No proactive_enterprise_session cookie in response")
            print(f"  Cookies: {resp.cookies}")
            return False
            
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        return False
    
    # ============================================================================
    # TEST 2: Admin Login
    # ============================================================================
    try:
        print("\n[TEST 2] Admin Login (admin@proactiveclinic.com)")
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"  ❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        if not data.get("ok"):
            print(f"  ❌ FAILED: Response missing 'ok: true'")
            print(f"  Response: {json.dumps(data, indent=2)[:500]}")
            return False
        
        # Capture admin session cookie
        if "proactive_session" in resp.cookies:
            admin_cookie = {"proactive_session": resp.cookies["proactive_session"]}
            print(f"  ✅ Admin session cookie captured")
        else:
            print(f"  ❌ FAILED: No proactive_session cookie in response")
            print(f"  Cookies: {resp.cookies}")
            return False
            
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        return False
    
    # ============================================================================
    # TEST 3: GET /api/enterprise/me - Verify balanceDueCents
    # ============================================================================
    try:
        print("\n[TEST 3] GET /api/enterprise/me (verify balanceDueCents)")
        resp = requests.get(
            f"{BASE_URL}/api/enterprise/me",
            cookies=enterprise_cookie,
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"  ❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        stats = data.get("stats", {})
        balance_due = stats.get("balanceDueCents")
        
        if balance_due is None:
            print(f"  ❌ FAILED: stats.balanceDueCents is missing")
            print(f"  Stats: {json.dumps(stats, indent=2)}")
            return False
        
        if not isinstance(balance_due, (int, float)):
            print(f"  ❌ FAILED: balanceDueCents is not a number, got type {type(balance_due)}")
            print(f"  Value: {balance_due}")
            return False
        
        print(f"  ✅ balanceDueCents is a number: {balance_due}")
        print(f"  Stats: total={stats.get('total')}, open={stats.get('open')}, openInvoices={stats.get('openInvoices')}")
        
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        return False
    
    # ============================================================================
    # TEST 4: POST /api/enterprise/requests/bulk - Create 2 requests
    # ============================================================================
    bulk_request_ids = []
    try:
        print("\n[TEST 4] POST /api/enterprise/requests/bulk (create 2 requests)")
        resp = requests.post(
            f"{BASE_URL}/api/enterprise/requests/bulk",
            json={
                "serviceKey": "tb_test",
                "priority": "routine",
                "employees": [
                    {"firstName": "Bulk", "lastName": "One"},
                    {"firstName": "Bulk", "lastName": "Two", "dob": "1991-02-02"}
                ]
            },
            cookies=enterprise_cookie,
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"  ❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        if not data.get("ok"):
            print(f"  ❌ FAILED: Response missing 'ok: true'")
            print(f"  Response: {json.dumps(data, indent=2)}")
            return False
        
        created_count = data.get("created")
        if created_count != 2:
            print(f"  ❌ FAILED: Expected created=2, got {created_count}")
            print(f"  Response: {json.dumps(data, indent=2)}")
            return False
        
        print(f"  ✅ Bulk import created {created_count} requests")
        
        # Now fetch the requests to verify patientId is set
        print("\n[TEST 4b] Verify bulk requests have patientId (auto patient chart)")
        resp = requests.get(
            f"{BASE_URL}/api/enterprise/requests",
            cookies=enterprise_cookie,
            timeout=10
        )
        
        if resp.status_code != 200:
            print(f"  ❌ FAILED: Could not fetch requests, status {resp.status_code}")
            return False
        
        data = resp.json()
        requests_list = data.get("requests", [])
        
        # Find the bulk requests we just created (should be the most recent ones)
        bulk_requests = [r for r in requests_list if r.get("employeeFirstName") == "Bulk"][:2]
        
        if len(bulk_requests) < 2:
            print(f"  ❌ FAILED: Could not find 2 bulk requests, found {len(bulk_requests)}")
            return False
        
        all_have_patient_id = True
        for req in bulk_requests:
            patient_id = req.get("patientId")
            req_id = req.get("id")
            bulk_request_ids.append(req_id)
            
            if not patient_id:
                print(f"  ❌ FAILED: Request {req_id} missing patientId (auto patient chart not created)")
                all_have_patient_id = False
            else:
                print(f"  ✅ Request {req_id} has patientId: {patient_id}")
        
        if not all_have_patient_id:
            return False
        
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        return False
    
    # ============================================================================
    # TEST 5: Admin uploads result-doc, Enterprise user downloads (cross-context)
    # ============================================================================
    try:
        if not bulk_request_ids:
            print("\n[TEST 5] SKIPPED: No bulk request IDs available")
            return False
        
        request_id = bulk_request_ids[0]
        
        print(f"\n[TEST 5] POST /api/admin/enterprise/requests/{request_id}/result-doc (admin uploads)")
        resp = requests.post(
            f"{BASE_URL}/api/admin/enterprise/requests/{request_id}/result-doc",
            json={
                "name": "result.pdf",
                "mimeType": "application/pdf",
                "dataBase64": "JVBERi0xLjQK"  # Minimal PDF header
            },
            cookies=admin_cookie,
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"  ❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        if not data.get("ok"):
            print(f"  ❌ FAILED: Response missing 'ok: true'")
            print(f"  Response: {json.dumps(data, indent=2)}")
            return False
        
        doc_id = data.get("id")
        if not doc_id:
            print(f"  ❌ FAILED: Response missing document 'id'")
            print(f"  Response: {json.dumps(data, indent=2)}")
            return False
        
        print(f"  ✅ Admin uploaded result document, id: {doc_id}")
        
        # Now verify enterprise user can see this clinic-uploaded document
        print(f"\n[TEST 5b] GET /api/enterprise/documents?requestId={request_id} (cross-context download)")
        resp = requests.get(
            f"{BASE_URL}/api/enterprise/documents?requestId={request_id}",
            cookies=enterprise_cookie,
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"  ❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        documents = data.get("documents", [])
        
        # Find the clinic-uploaded document
        clinic_doc = None
        for doc in documents:
            if doc.get("uploadedType") == "clinic" and doc.get("id") == doc_id:
                clinic_doc = doc
                break
        
        if not clinic_doc:
            print(f"  ❌ FAILED: Clinic-uploaded document not found in enterprise documents list")
            print(f"  Documents: {json.dumps(documents, indent=2)[:500]}")
            return False
        
        print(f"  ✅ Cross-context verified: Enterprise user can see clinic-uploaded document")
        print(f"     Document: name={clinic_doc.get('name')}, uploadedType={clinic_doc.get('uploadedType')}")
        
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        return False
    
    # ============================================================================
    # TEST 6: Invoice PDF download (enterprise and admin)
    # ============================================================================
    try:
        print("\n[TEST 6] GET /api/enterprise/invoices (fetch invoice ID)")
        resp = requests.get(
            f"{BASE_URL}/api/enterprise/invoices",
            cookies=enterprise_cookie,
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"  ❌ FAILED: Expected 200, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
        
        data = resp.json()
        invoices = data.get("invoices", [])
        
        if not invoices:
            print(f"  ⚠️  WARNING: No invoices found for this enterprise account")
            print(f"  Skipping invoice PDF tests")
            invoice_id = None
        else:
            invoice_id = invoices[0].get("id")
            print(f"  ✅ Found invoice ID: {invoice_id}")
        
        if invoice_id:
            # Test enterprise PDF download
            print(f"\n[TEST 6a] GET /api/enterprise/invoices/{invoice_id}/pdf (enterprise cookie)")
            resp = requests.get(
                f"{BASE_URL}/api/enterprise/invoices/{invoice_id}/pdf",
                cookies=enterprise_cookie,
                timeout=10
            )
            print(f"  Status: {resp.status_code}")
            
            if resp.status_code != 200:
                print(f"  ❌ FAILED: Expected 200, got {resp.status_code}")
                print(f"  Response: {resp.text[:500]}")
                return False
            
            content_type = resp.headers.get("Content-Type", "")
            if "application/pdf" not in content_type:
                print(f"  ❌ FAILED: Expected Content-Type application/pdf, got {content_type}")
                return False
            
            # Check PDF header
            pdf_header = resp.content[:10]
            if not pdf_header.startswith(b"%PDF-"):
                print(f"  ❌ FAILED: PDF does not start with %PDF- header")
                print(f"  Header bytes: {pdf_header}")
                return False
            
            print(f"  ✅ Enterprise PDF download successful, Content-Type: {content_type}")
            print(f"  ✅ PDF header verified: {pdf_header[:10]}")
            
            # Test admin PDF download
            print(f"\n[TEST 6b] GET /api/admin/enterprise/invoices/{invoice_id}/pdf (admin cookie)")
            resp = requests.get(
                f"{BASE_URL}/api/admin/enterprise/invoices/{invoice_id}/pdf",
                cookies=admin_cookie,
                timeout=10
            )
            print(f"  Status: {resp.status_code}")
            
            if resp.status_code != 200:
                print(f"  ❌ FAILED: Expected 200, got {resp.status_code}")
                print(f"  Response: {resp.text[:500]}")
                return False
            
            content_type = resp.headers.get("Content-Type", "")
            if "application/pdf" not in content_type:
                print(f"  ❌ FAILED: Expected Content-Type application/pdf, got {content_type}")
                return False
            
            # Check PDF header
            pdf_header = resp.content[:10]
            if not pdf_header.startswith(b"%PDF-"):
                print(f"  ❌ FAILED: PDF does not start with %PDF- header")
                print(f"  Header bytes: {pdf_header}")
                return False
            
            print(f"  ✅ Admin PDF download successful, Content-Type: {content_type}")
            print(f"  ✅ PDF header verified: {pdf_header[:10]}")
        
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        return False
    
    # ============================================================================
    # TEST 7: Auth Guards - result-doc without admin cookie
    # ============================================================================
    try:
        if not bulk_request_ids:
            print("\n[TEST 7] SKIPPED: No request IDs available")
        else:
            request_id = bulk_request_ids[0]
            
            print(f"\n[TEST 7] POST /api/admin/enterprise/requests/{request_id}/result-doc (NO admin cookie)")
            resp = requests.post(
                f"{BASE_URL}/api/admin/enterprise/requests/{request_id}/result-doc",
                json={
                    "name": "result.pdf",
                    "mimeType": "application/pdf",
                    "dataBase64": "JVBERi0xLjQK"
                },
                timeout=10
            )
            print(f"  Status: {resp.status_code}")
            
            if resp.status_code not in [401, 403]:
                print(f"  ❌ FAILED: Expected 401 or 403, got {resp.status_code}")
                print(f"  Response: {resp.text[:500]}")
                return False
            
            print(f"  ✅ Auth guard working: returned {resp.status_code} without admin cookie")
        
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        return False
    
    # ============================================================================
    # TEST 8: Auth Guards - bulk without enterprise cookie
    # ============================================================================
    try:
        print("\n[TEST 8] POST /api/enterprise/requests/bulk (NO enterprise cookie)")
        resp = requests.post(
            f"{BASE_URL}/api/enterprise/requests/bulk",
            json={
                "serviceKey": "tb_test",
                "priority": "routine",
                "employees": [{"firstName": "Test", "lastName": "User"}]
            },
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code != 401:
            print(f"  ❌ FAILED: Expected 401, got {resp.status_code}")
            print(f"  Response: {resp.text[:500]}")
            return False
        
        print(f"  ✅ Auth guard working: returned 401 without enterprise cookie")
        
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        return False
    
    # ============================================================================
    # TEST 9: Data Isolation - Enterprise user cannot access another company's invoice
    # ============================================================================
    try:
        # First, login as a different enterprise user (if available)
        print("\n[TEST 9] Data Isolation - Login as different enterprise (safety@alamomfg.com)")
        resp = requests.post(
            f"{BASE_URL}/api/enterprise/auth/login",
            json={"email": "safety@alamomfg.com", "password": "demo1234"},
            timeout=10
        )
        print(f"  Status: {resp.status_code}")
        
        if resp.status_code == 200:
            other_enterprise_cookie = {"proactive_enterprise_session": resp.cookies.get("proactive_enterprise_session")}
            print(f"  ✅ Logged in as different enterprise user")
            
            # Try to access the first company's invoice
            if invoice_id:
                print(f"\n[TEST 9a] GET /api/enterprise/invoices/{invoice_id}/pdf (different enterprise cookie)")
                resp = requests.get(
                    f"{BASE_URL}/api/enterprise/invoices/{invoice_id}/pdf",
                    cookies=other_enterprise_cookie,
                    timeout=10
                )
                print(f"  Status: {resp.status_code}")
                
                if resp.status_code not in [403, 404]:
                    print(f"  ❌ FAILED: Expected 403 or 404, got {resp.status_code}")
                    print(f"  Data isolation breach: Different enterprise can access invoice!")
                    return False
                
                print(f"  ✅ Data isolation verified: returned {resp.status_code} for different enterprise")
            else:
                print(f"  ⚠️  SKIPPED: No invoice ID available for isolation test")
        else:
            print(f"  ⚠️  SKIPPED: Could not login as different enterprise user (status {resp.status_code})")
        
    except Exception as e:
        print(f"  ❌ EXCEPTION: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ ALL TESTS PASSED")
    print("="*80)
    return True


if __name__ == "__main__":
    success = test_enterprise_enhancements()
    sys.exit(0 if success else 1)
