#!/usr/bin/env python3
"""
Backend test for Legal Case Management endpoints (Iteration 6)
Tests all /api/legal-cases endpoints with staff authentication
"""

import requests
import json
import base64
from datetime import datetime

# IMPORTANT: Use HTTPS URL because session cookie has secure:true flag
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Demo legal case from seed data
DEMO_CASE_ID = "cms9hhjdk000lr7p1ikblasxj"
DEMO_PATIENT_ID = "cms9hhjdf000jr7p1rhkcgpxz"

# Test data tracking for cleanup
test_document_ids = []
test_offer_ids = []
test_deliverable_ids = []
test_event_ids = []

def print_test(msg):
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_pass(msg):
    print(f"✅ PASS: {msg}")

def print_fail(msg):
    print(f"❌ FAIL: {msg}")

def staff_login():
    """Login as staff and return session cookie"""
    print_test("Staff Login")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "andy.manzano@proactiveclinic.com", "password": "apex123"},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:200]}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                cookie = resp.cookies.get("proactive_session")
                if cookie:
                    print_pass(f"Staff login successful, got session cookie")
                    return cookie
                else:
                    print_fail("No proactive_session cookie in response")
                    return None
            else:
                print_fail(f"Login failed: {data}")
                return None
        else:
            print_fail(f"Login failed with status {resp.status_code}")
            return None
    except Exception as e:
        print_fail(f"Staff login exception: {e}")
        return None

def test_legal_cases_list(session_cookie):
    """Test GET /api/legal-cases"""
    print_test("1. GET /api/legal-cases - List all legal cases")
    
    # Test A: With staff session -> 200 with cases array
    try:
        resp = requests.get(
            f"{BASE_URL}/api/legal-cases",
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if "cases" in data:
                cases = data["cases"]
                print(f"Response: {len(cases)} cases returned")
                
                # Verify structure
                if len(cases) > 0:
                    first_case = cases[0]
                    print(f"First case: {json.dumps(first_case, indent=2)[:300]}")
                    
                    # Check required fields
                    if "patient" in first_case:
                        patient = first_case["patient"]
                        required_fields = ["id", "firstName", "lastName", "mrn"]
                        missing = [f for f in required_fields if f not in patient]
                        if not missing:
                            print_pass(f"Cases list returned with patient fields: {required_fields}")
                        else:
                            print_fail(f"Patient missing fields: {missing}")
                    else:
                        print_fail("Case missing 'patient' field")
                else:
                    print_pass("Cases list returned (empty)")
            else:
                print_fail(f"Response missing 'cases' field: {data}")
        else:
            print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test B: Without session -> 401
    print("\n--- Test without session ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/legal-cases", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print_pass("Correctly blocked with 401 when no session")
        else:
            print_fail(f"Expected 401, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

def test_legal_case_detail(session_cookie):
    """Test GET /api/legal-cases/[id]"""
    print_test("2. GET /api/legal-cases/[id] - Get case detail with relations")
    
    # Test A: GET existing case -> 200 with all relations
    try:
        resp = requests.get(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}",
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if "case" in data:
                case = data["case"]
                print(f"Case ID: {case.get('id')}")
                
                # Check all required relations
                relations = ["patient", "attorney", "documents", "events", "offers", "deliverables"]
                missing = [r for r in relations if r not in case]
                
                if not missing:
                    print_pass(f"Case detail returned with all relations: {relations}")
                    
                    # Verify documents don't have dataBase64
                    if case.get("documents"):
                        has_base64 = any("dataBase64" in doc for doc in case["documents"])
                        if not has_base64:
                            print_pass("Documents list does NOT include dataBase64 field")
                        else:
                            print_fail("Documents list incorrectly includes dataBase64 field")
                    
                    # Verify patient structure
                    patient = case.get("patient", {})
                    if all(k in patient for k in ["id", "firstName", "lastName", "mrn"]):
                        print_pass(f"Patient: {patient.get('firstName')} {patient.get('lastName')} (MRN: {patient.get('mrn')})")
                    else:
                        print_fail(f"Patient missing required fields")
                else:
                    print_fail(f"Case missing relations: {missing}")
            else:
                print_fail(f"Response missing 'case' field: {data}")
        else:
            print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test B: GET bad id -> 404
    print("\n--- Test with bad case ID ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/legal-cases/nonexistent_id_12345",
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 404:
            print_pass("Correctly returned 404 for nonexistent case ID")
        else:
            print_fail(f"Expected 404, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test C: No session -> 401
    print("\n--- Test without session ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print_pass("Correctly blocked with 401 when no session")
        else:
            print_fail(f"Expected 401, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

def test_legal_case_update(session_cookie):
    """Test PATCH /api/legal-cases/[id]"""
    print_test("3. PATCH /api/legal-cases/[id] - Update case")
    
    # Test A: PATCH status -> creates stage event
    print("\n--- Test PATCH status ---")
    try:
        resp = requests.patch(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}",
            json={"status": "negotiating"},
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("case"):
                case = data["case"]
                if case.get("status") == "negotiating":
                    print_pass(f"Status updated to 'negotiating'")
                    
                    # Verify stage event was created
                    detail_resp = requests.get(
                        f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}",
                        cookies={"proactive_session": session_cookie},
                        timeout=10
                    )
                    if detail_resp.status_code == 200:
                        detail_data = detail_resp.json()
                        events = detail_data.get("case", {}).get("events", [])
                        stage_events = [e for e in events if e.get("type") == "stage" and "negotiating" in e.get("title", "").lower()]
                        if stage_events:
                            print_pass(f"Stage event created: {stage_events[0].get('title')}")
                        else:
                            print_fail("No stage event found for status change")
                else:
                    print_fail(f"Status not updated correctly: {case.get('status')}")
            else:
                print_fail(f"Unexpected response: {data}")
        else:
            print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test B: PATCH lienAmount (USD) -> lienAmountCents
    print("\n--- Test PATCH lienAmount ---")
    try:
        resp = requests.patch(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}",
            json={"lienAmount": 4200.50},
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("case"):
                case = data["case"]
                lien_cents = case.get("lienAmountCents")
                expected_cents = 420050
                if lien_cents == expected_cents:
                    print_pass(f"lienAmount $4200.50 correctly converted to {lien_cents} cents")
                else:
                    print_fail(f"Expected {expected_cents} cents, got {lien_cents}")
            else:
                print_fail(f"Unexpected response: {data}")
        else:
            print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test C: No session -> 401
    print("\n--- Test PATCH without session ---")
    try:
        resp = requests.patch(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}",
            json={"status": "closed"},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print_pass("Correctly blocked with 401 when no session")
        else:
            print_fail(f"Expected 401, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

def test_legal_case_documents(session_cookie):
    """Test document upload/list/download"""
    print_test("4. Legal Case Documents - POST/GET/GET[docId]")
    
    # Test A: POST document with base64
    print("\n--- Test POST document ---")
    test_content = "hello world"
    test_base64 = base64.b64encode(test_content.encode()).decode()
    
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/documents",
            json={
                "name": "test.txt",
                "dataBase64": test_base64,
                "mimeType": "text/plain",
                "size": len(test_content),
                "category": "medical"
            },
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("document"):
                doc = data["document"]
                doc_id = doc.get("id")
                doc_name = doc.get("name")
                test_document_ids.append(doc_id)
                print_pass(f"Document uploaded: {doc_name} (ID: {doc_id})")
                
                # Test B: GET list -> includes it WITHOUT dataBase64
                print("\n--- Test GET documents list ---")
                list_resp = requests.get(
                    f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/documents",
                    cookies={"proactive_session": session_cookie},
                    timeout=10
                )
                print(f"Status: {list_resp.status_code}")
                
                if list_resp.status_code == 200:
                    list_data = list_resp.json()
                    if "documents" in list_data:
                        docs = list_data["documents"]
                        test_doc = next((d for d in docs if d.get("id") == doc_id), None)
                        if test_doc:
                            if "dataBase64" not in test_doc:
                                print_pass(f"Document in list does NOT include dataBase64 field")
                            else:
                                print_fail("Document list incorrectly includes dataBase64 field")
                            
                            if test_doc.get("name") == "test.txt":
                                print_pass(f"Document name correct: {test_doc.get('name')}")
                        else:
                            print_fail(f"Uploaded document not found in list")
                    else:
                        print_fail(f"Response missing 'documents' field")
                else:
                    print_fail(f"Expected 200, got {list_resp.status_code}")
                
                # Test C: GET /[docId] -> raw file content
                print("\n--- Test GET document download ---")
                download_resp = requests.get(
                    f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/documents/{doc_id}",
                    cookies={"proactive_session": session_cookie},
                    timeout=10
                )
                print(f"Status: {download_resp.status_code}")
                print(f"Content-Type: {download_resp.headers.get('Content-Type')}")
                print(f"Content-Disposition: {download_resp.headers.get('Content-Disposition')}")
                
                if download_resp.status_code == 200:
                    content = download_resp.text
                    content_type = download_resp.headers.get("Content-Type", "")
                    
                    if content == test_content:
                        print_pass(f"Document content correct: '{content}'")
                    else:
                        print_fail(f"Expected '{test_content}', got '{content}'")
                    
                    if "text/plain" in content_type:
                        print_pass(f"Content-Type correct: {content_type}")
                    else:
                        print_fail(f"Expected text/plain, got {content_type}")
                else:
                    print_fail(f"Expected 200, got {download_resp.status_code}")
            else:
                print_fail(f"Unexpected response: {data}")
        else:
            print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test D: POST missing name -> 400
    print("\n--- Test POST missing name ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/documents",
            json={"dataBase64": test_base64},
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 400:
            print_pass("Correctly returned 400 for missing name")
        else:
            print_fail(f"Expected 400, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test E: POST missing dataBase64 -> 400
    print("\n--- Test POST missing dataBase64 ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/documents",
            json={"name": "test.txt"},
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 400:
            print_pass("Correctly returned 400 for missing dataBase64")
        else:
            print_fail(f"Expected 400, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test F: No session -> 401
    print("\n--- Test POST without session ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/documents",
            json={"name": "test.txt", "dataBase64": test_base64},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print_pass("Correctly blocked with 401 when no session")
        else:
            print_fail(f"Expected 401, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

def test_legal_case_offers(session_cookie):
    """Test offers/counter-offers"""
    print_test("5. Legal Case Offers - POST/GET")
    
    # Test A: POST offer -> creates offer + event
    print("\n--- Test POST offer ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/offers",
            json={
                "amount": 1500,
                "party": "insurer",
                "kind": "offer"
            },
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("offer"):
                offer = data["offer"]
                offer_id = offer.get("id")
                amount_cents = offer.get("amountCents")
                expected_cents = 150000
                
                test_offer_ids.append(offer_id)
                
                if amount_cents == expected_cents:
                    print_pass(f"Offer created: $1500 -> {amount_cents} cents")
                else:
                    print_fail(f"Expected {expected_cents} cents, got {amount_cents}")
                
                # Verify offer event was created
                detail_resp = requests.get(
                    f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}",
                    cookies={"proactive_session": session_cookie},
                    timeout=10
                )
                if detail_resp.status_code == 200:
                    detail_data = detail_resp.json()
                    events = detail_data.get("case", {}).get("events", [])
                    offer_events = [e for e in events if e.get("type") == "offer" and "1500" in e.get("title", "")]
                    if offer_events:
                        print_pass(f"Offer event created: {offer_events[0].get('title')}")
                    else:
                        print_fail("No offer event found")
            else:
                print_fail(f"Unexpected response: {data}")
        else:
            print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test B: POST amount=0 -> 400
    print("\n--- Test POST with amount=0 ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/offers",
            json={"amount": 0, "party": "insurer", "kind": "offer"},
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 400:
            print_pass("Correctly returned 400 for amount=0")
        else:
            print_fail(f"Expected 400, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test C: GET offers list
    print("\n--- Test GET offers ---")
    try:
        resp = requests.get(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/offers",
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if "offers" in data:
                offers = data["offers"]
                print_pass(f"Offers list returned: {len(offers)} offers")
            else:
                print_fail(f"Response missing 'offers' field")
        else:
            print_fail(f"Expected 200, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test D: No session -> 401
    print("\n--- Test POST without session ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/offers",
            json={"amount": 1000, "party": "insurer", "kind": "offer"},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print_pass("Correctly blocked with 401 when no session")
        else:
            print_fail(f"Expected 401, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

def test_legal_case_deliverables(session_cookie):
    """Test deliverables"""
    print_test("6. Legal Case Deliverables - POST/PATCH/GET")
    
    # Test A: POST deliverable
    print("\n--- Test POST deliverable ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/deliverables",
            json={"title": "Send records"},
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("deliverable"):
                deliverable = data["deliverable"]
                deliverable_id = deliverable.get("id")
                title = deliverable.get("title")
                
                test_deliverable_ids.append(deliverable_id)
                
                if title == "Send records":
                    print_pass(f"Deliverable created: {title} (ID: {deliverable_id})")
                    
                    # Test B: PATCH toggle done
                    print("\n--- Test PATCH deliverable done ---")
                    patch_resp = requests.patch(
                        f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/deliverables",
                        json={"deliverableId": deliverable_id, "done": True},
                        cookies={"proactive_session": session_cookie},
                        timeout=10
                    )
                    print(f"Status: {patch_resp.status_code}")
                    
                    if patch_resp.status_code == 200:
                        patch_data = patch_resp.json()
                        if patch_data.get("ok") and patch_data.get("deliverable"):
                            updated = patch_data["deliverable"]
                            if updated.get("done") == True:
                                print_pass(f"Deliverable marked as done")
                            else:
                                print_fail(f"Deliverable done not updated: {updated.get('done')}")
                        else:
                            print_fail(f"Unexpected response: {patch_data}")
                    else:
                        print_fail(f"Expected 200, got {patch_resp.status_code}")
                else:
                    print_fail(f"Title not correct: {title}")
            else:
                print_fail(f"Unexpected response: {data}")
        else:
            print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test C: POST missing title -> 400
    print("\n--- Test POST missing title ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/deliverables",
            json={},
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 400:
            print_pass("Correctly returned 400 for missing title")
        else:
            print_fail(f"Expected 400, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test D: PATCH missing deliverableId -> 400
    print("\n--- Test PATCH missing deliverableId ---")
    try:
        resp = requests.patch(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/deliverables",
            json={"done": True},
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 400:
            print_pass("Correctly returned 400 for missing deliverableId")
        else:
            print_fail(f"Expected 400, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test E: No session -> 401
    print("\n--- Test POST without session ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/deliverables",
            json={"title": "Test"},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print_pass("Correctly blocked with 401 when no session")
        else:
            print_fail(f"Expected 401, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

def test_legal_case_events(session_cookie):
    """Test events/notes"""
    print_test("7. Legal Case Events - POST")
    
    # Test A: POST event
    print("\n--- Test POST event ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/events",
            json={
                "title": "Called adjuster",
                "type": "notification"
            },
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("event"):
                event = data["event"]
                event_id = event.get("id")
                title = event.get("title")
                event_type = event.get("type")
                
                test_event_ids.append(event_id)
                
                if title == "Called adjuster" and event_type == "notification":
                    print_pass(f"Event created: {title} (type: {event_type})")
                else:
                    print_fail(f"Event fields incorrect: title={title}, type={event_type}")
            else:
                print_fail(f"Unexpected response: {data}")
        else:
            print_fail(f"Expected 200, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test B: POST missing title -> 400
    print("\n--- Test POST missing title ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/events",
            json={"type": "note"},
            cookies={"proactive_session": session_cookie},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 400:
            print_pass("Correctly returned 400 for missing title")
        else:
            print_fail(f"Expected 400, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")
    
    # Test C: No session -> 401
    print("\n--- Test POST without session ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/legal-cases/{DEMO_CASE_ID}/events",
            json={"title": "Test event"},
            timeout=10
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 401:
            print_pass("Correctly blocked with 401 when no session")
        else:
            print_fail(f"Expected 401, got {resp.status_code}")
    except Exception as e:
        print_fail(f"Exception: {e}")

def cleanup_test_data(session_cookie):
    """Clean up test data created during testing"""
    print_test("CLEANUP - Removing test data")
    
    # Delete test documents
    for doc_id in test_document_ids:
        try:
            # Note: There's no DELETE endpoint for documents, so we'll leave them
            # The main agent should add a DELETE endpoint if cleanup is critical
            print(f"Note: Document {doc_id} created (no DELETE endpoint available)")
        except Exception as e:
            print(f"Cleanup error for document {doc_id}: {e}")
    
    # Delete test offers
    for offer_id in test_offer_ids:
        try:
            # Note: There's no DELETE endpoint for offers
            print(f"Note: Offer {offer_id} created (no DELETE endpoint available)")
        except Exception as e:
            print(f"Cleanup error for offer {offer_id}: {e}")
    
    # Delete test deliverables
    for deliverable_id in test_deliverable_ids:
        try:
            # Note: There's no DELETE endpoint for deliverables
            print(f"Note: Deliverable {deliverable_id} created (no DELETE endpoint available)")
        except Exception as e:
            print(f"Cleanup error for deliverable {deliverable_id}: {e}")
    
    # Delete test events
    for event_id in test_event_ids:
        try:
            # Note: There's no DELETE endpoint for events
            print(f"Note: Event {event_id} created (no DELETE endpoint available)")
        except Exception as e:
            print(f"Cleanup error for event {event_id}: {e}")
    
    print("\n⚠️  NOTE: No DELETE endpoints exist for documents/offers/deliverables/events.")
    print("Test data has been created but cannot be automatically cleaned up.")
    print("The demo case and patient remain intact as requested.")

def main():
    print("\n" + "="*80)
    print("LEGAL CASE MANAGEMENT BACKEND TEST")
    print("Testing /api/legal-cases endpoints")
    print("="*80)
    
    # Login as staff
    session_cookie = staff_login()
    if not session_cookie:
        print("\n❌ FATAL: Could not obtain staff session cookie. Aborting tests.")
        return
    
    # Run all tests
    test_legal_cases_list(session_cookie)
    test_legal_case_detail(session_cookie)
    test_legal_case_update(session_cookie)
    test_legal_case_documents(session_cookie)
    test_legal_case_offers(session_cookie)
    test_legal_case_deliverables(session_cookie)
    test_legal_case_events(session_cookie)
    
    # Cleanup
    cleanup_test_data(session_cookie)
    
    print("\n" + "="*80)
    print("TESTING COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
