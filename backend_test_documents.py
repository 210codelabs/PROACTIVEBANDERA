#!/usr/bin/env python3
"""
Backend test for Patient chart Documents — preview popup + download (PDF/images)
Tests GET /api/patients/[id]/documents/[docId]/file endpoint
"""
import requests
import json
import sys
from urllib.parse import urljoin

# Configuration
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"
NURSE_EMAIL = "nurse.kim@proactiveclinic.com"
NURSE_PASSWORD = "apex123"
PROVIDER_EMAIL = "andy.manzano@proactiveclinic.com"
PROVIDER_PASSWORD = "apex123"

# Test data - minimal valid base64 PDFs and images
PDF_BASE64 = "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXS9Db250ZW50cyA0IDAgUj4+CmVuZG9iago0IDAgb2JqCjw8L0xlbmd0aCAzMz4+CnN0cmVhbQpCVAovRjEgMTIgVGYKMTAwIDcwMCBUZAooVGVzdCBQREYpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKNSAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PgplbmRvYmoKNiAwIG9iago8PC9Gb250PDwvRjEgNSAwIFI+Pj4+CmVuZG9iagp4cmVmCjAgNwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAxNzQgMDAwMDAgbiAKMDAwMDAwMDIyMyAwMDAwMCBuIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAxMDEgMDAwMDAgbiAKMDAwMDAwMDI4MCAwMDAwMCBuIAowMDAwMDAwMzQ4IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA3L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMzg5CiUlRU9G"

# Minimal 1x1 PNG (red pixel)
PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

# Minimal 1x1 JPEG (red pixel)
JPEG_BASE64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k="

def login(email, password):
    """Login and return session cookie"""
    print(f"  Logging in as {email}...")
    resp = requests.post(
        urljoin(BASE_URL, "/api/auth/login"),
        json={"email": email, "password": password},
        timeout=30
    )
    if resp.status_code != 200:
        print(f"    ❌ Login failed: {resp.status_code} {resp.text[:200]}")
        return None
    cookie = resp.cookies.get("proactive_session")
    if not cookie:
        print(f"    ❌ No session cookie returned")
        return None
    print(f"    ✅ Login successful")
    return {"proactive_session": cookie}

def get_patient_id(cookies):
    """Get Eleanor Adams patient ID"""
    print("  Getting patient ID (Eleanor Adams)...")
    resp = requests.get(
        urljoin(BASE_URL, "/api/patients/search"),
        params={"q": "adams", "limit": 1},
        cookies=cookies,
        timeout=30
    )
    if resp.status_code != 200:
        print(f"    ❌ Failed to get patient: {resp.status_code}")
        return None
    data = resp.json()
    if not data.get("results"):
        print(f"    ❌ No patient found")
        return None
    patient_id = data["results"][0]["id"]
    print(f"    ✅ Patient ID: {patient_id}")
    return patient_id

def upload_document(cookies, patient_id, file_name, data_url):
    """Upload a document via intake submissions upload"""
    print(f"  Uploading {file_name}...")
    resp = requests.post(
        urljoin(BASE_URL, "/api/intake/submissions/upload"),
        json={
            "patientId": patient_id,
            "slug": "new-patient-intake",
            "fileName": file_name,
            "dataUrl": data_url
        },
        cookies=cookies,
        timeout=30
    )
    if resp.status_code != 200:
        print(f"    ❌ Upload failed: {resp.status_code} {resp.text[:200]}")
        return None
    data = resp.json()
    doc_id = data.get("id")
    print(f"    ✅ Uploaded successfully, doc ID: {doc_id}")
    return doc_id

def test_file_endpoint(cookies, patient_id, doc_id, expected_mime, expected_size, test_name):
    """Test GET /api/patients/[id]/documents/[docId]/file"""
    print(f"  Testing {test_name}...")
    url = urljoin(BASE_URL, f"/api/patients/{patient_id}/documents/{doc_id}/file")
    resp = requests.get(url, cookies=cookies, timeout=30)
    
    if resp.status_code != 200:
        print(f"    ❌ Expected 200, got {resp.status_code}")
        return False
    
    # Check content-type
    content_type = resp.headers.get("Content-Type", "")
    if content_type != expected_mime:
        print(f"    ❌ Expected Content-Type {expected_mime}, got {content_type}")
        return False
    
    # Check content-disposition (inline by default)
    content_disp = resp.headers.get("Content-Disposition", "")
    if not content_disp.startswith("inline"):
        print(f"    ❌ Expected inline disposition, got {content_disp}")
        return False
    
    # Check content length
    actual_size = len(resp.content)
    if actual_size != expected_size:
        print(f"    ❌ Expected {expected_size} bytes, got {actual_size} bytes")
        return False
    
    print(f"    ✅ {test_name} passed (200, {content_type}, inline, {actual_size} bytes)")
    return True

def test_download_mode(cookies, patient_id, doc_id, expected_filename):
    """Test ?download=1 parameter"""
    print(f"  Testing download mode...")
    url = urljoin(BASE_URL, f"/api/patients/{patient_id}/documents/{doc_id}/file?download=1")
    resp = requests.get(url, cookies=cookies, timeout=30)
    
    if resp.status_code != 200:
        print(f"    ❌ Expected 200, got {resp.status_code}")
        return False
    
    # Check content-disposition (attachment with filename)
    content_disp = resp.headers.get("Content-Disposition", "")
    if not content_disp.startswith("attachment"):
        print(f"    ❌ Expected attachment disposition, got {content_disp}")
        return False
    
    if expected_filename not in content_disp:
        print(f"    ❌ Expected filename '{expected_filename}' in disposition, got {content_disp}")
        return False
    
    print(f"    ✅ Download mode passed (attachment; filename=\"{expected_filename}\")")
    return True

def test_auth_guards(patient_id, doc_id):
    """Test authentication and authorization guards"""
    print(f"  Testing auth guards...")
    url = urljoin(BASE_URL, f"/api/patients/{patient_id}/documents/{doc_id}/file")
    
    # Test 1: No session -> 401
    resp = requests.get(url, timeout=30)
    if resp.status_code != 401:
        print(f"    ❌ Expected 401 without session, got {resp.status_code}")
        return False
    print(f"    ✅ No session correctly returns 401")
    
    return True

def test_wrong_patient(cookies, doc_id):
    """Test accessing document with wrong patient ID"""
    print(f"  Testing wrong patient ID...")
    wrong_patient_id = "wrongpatientid123"
    url = urljoin(BASE_URL, f"/api/patients/{wrong_patient_id}/documents/{doc_id}/file")
    resp = requests.get(url, cookies=cookies, timeout=30)
    
    if resp.status_code != 404:
        print(f"    ❌ Expected 404 for wrong patient, got {resp.status_code}")
        return False
    print(f"    ✅ Wrong patient ID correctly returns 404")
    return True

def test_nonexistent_doc(cookies, patient_id):
    """Test accessing nonexistent document"""
    print(f"  Testing nonexistent document...")
    fake_doc_id = "nonexistentdocid123"
    url = urljoin(BASE_URL, f"/api/patients/{patient_id}/documents/{fake_doc_id}/file")
    resp = requests.get(url, cookies=cookies, timeout=30)
    
    if resp.status_code != 404:
        print(f"    ❌ Expected 404 for nonexistent doc, got {resp.status_code}")
        return False
    print(f"    ✅ Nonexistent document correctly returns 404")
    return True

def test_html_no_leak(cookies, patient_id):
    """Test that HTML page doesn't leak base64 data"""
    print(f"  Testing HTML page for data leaks...")
    url = urljoin(BASE_URL, f"/patients/{patient_id}/documents")
    resp = requests.get(url, cookies=cookies, timeout=30)
    
    if resp.status_code != 200:
        print(f"    ❌ Expected 200 for HTML page, got {resp.status_code}")
        return False
    
    html = resp.text
    # Check if any of our test base64 strings appear in the HTML
    if PDF_BASE64[:50] in html or PNG_BASE64[:50] in html or JPEG_BASE64[:50] in html:
        print(f"    ❌ Base64 data leaked in HTML page")
        return False
    
    print(f"    ✅ HTML page does not leak base64 data")
    return True

def test_other_roles(patient_id, doc_id):
    """Test that nurse and provider can access documents"""
    print(f"  Testing nurse access...")
    nurse_cookies = login(NURSE_EMAIL, NURSE_PASSWORD)
    if not nurse_cookies:
        return False
    
    url = urljoin(BASE_URL, f"/api/patients/{patient_id}/documents/{doc_id}/file")
    resp = requests.get(url, cookies=nurse_cookies, timeout=30)
    if resp.status_code != 200:
        print(f"    ❌ Nurse expected 200, got {resp.status_code}")
        return False
    print(f"    ✅ Nurse can access document (200)")
    
    print(f"  Testing provider access...")
    provider_cookies = login(PROVIDER_EMAIL, PROVIDER_PASSWORD)
    if not provider_cookies:
        return False
    
    resp = requests.get(url, cookies=provider_cookies, timeout=30)
    if resp.status_code != 200:
        print(f"    ❌ Provider expected 200, got {resp.status_code}")
        return False
    print(f"    ✅ Provider can access document (200)")
    
    return True

def cleanup_documents(doc_ids):
    """Delete test documents from MongoDB"""
    print(f"\n🧹 CLEANUP: Deleting {len(doc_ids)} test documents from MongoDB...")
    try:
        from pymongo import MongoClient
        client = MongoClient("mongodb://localhost:27017")
        db = client["proactive_clinic"]
        
        for doc_id in doc_ids:
            result = db.Document.delete_one({"_id": doc_id})
            if result.deleted_count > 0:
                print(f"  ✅ Deleted document {doc_id}")
            else:
                print(f"  ⚠️  Document {doc_id} not found (may have been already deleted)")
        
        client.close()
        print(f"  ✅ Cleanup complete")
        return True
    except Exception as e:
        print(f"  ❌ Cleanup failed: {e}")
        return False

def cleanup_pre_existing_qa_docs():
    """Delete pre-existing QA documents mentioned in the task"""
    print(f"\n🧹 CLEANUP: Deleting pre-existing QA documents...")
    pre_existing_ids = [
        "cmvla6z3r0001nwoebk7eys3g",
        "cmvla6z8w0003nwoe448tovzd"
    ]
    
    try:
        from pymongo import MongoClient
        client = MongoClient("mongodb://localhost:27017")
        db = client["proactive_clinic"]
        
        for doc_id in pre_existing_ids:
            result = db.Document.delete_one({"_id": doc_id})
            if result.deleted_count > 0:
                print(f"  ✅ Deleted pre-existing document {doc_id}")
            else:
                print(f"  ℹ️  Document {doc_id} not found (may have been already deleted)")
        
        client.close()
        print(f"  ✅ Pre-existing QA documents cleanup complete")
        return True
    except Exception as e:
        print(f"  ❌ Pre-existing cleanup failed: {e}")
        return False

def main():
    print("=" * 80)
    print("BACKEND TEST: Patient chart Documents — preview popup + download")
    print("=" * 80)
    
    all_passed = True
    created_doc_ids = []
    
    try:
        # Step 1: Login as admin
        print("\n📝 STEP 1: Admin login")
        admin_cookies = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        if not admin_cookies:
            return 1
        
        # Step 2: Get patient ID
        print("\n📝 STEP 2: Get patient ID (Eleanor Adams)")
        patient_id = get_patient_id(admin_cookies)
        if not patient_id:
            return 1
        
        # Step 3: Upload test documents
        print("\n📝 STEP 3: Upload test documents")
        pdf_data_url = f"data:application/pdf;base64,{PDF_BASE64}"
        png_data_url = f"data:image/png;base64,{PNG_BASE64}"
        jpeg_data_url = f"data:image/jpeg;base64,{JPEG_BASE64}"
        
        pdf_doc_id = upload_document(admin_cookies, patient_id, "qa.pdf", pdf_data_url)
        if not pdf_doc_id:
            all_passed = False
        else:
            created_doc_ids.append(pdf_doc_id)
        
        png_doc_id = upload_document(admin_cookies, patient_id, "qa.png", png_data_url)
        if not png_doc_id:
            all_passed = False
        else:
            created_doc_ids.append(png_doc_id)
        
        jpeg_doc_id = upload_document(admin_cookies, patient_id, "qa.jpg", jpeg_data_url)
        if not jpeg_doc_id:
            all_passed = False
        else:
            created_doc_ids.append(jpeg_doc_id)
        
        if not all([pdf_doc_id, png_doc_id, jpeg_doc_id]):
            print("\n❌ Failed to upload all test documents")
            return 1
        
        # Calculate expected sizes
        import base64
        pdf_bytes = base64.b64decode(PDF_BASE64)
        png_bytes = base64.b64decode(PNG_BASE64)
        jpeg_bytes = base64.b64decode(JPEG_BASE64)
        
        # Step 4: Test file endpoint for each document type
        print("\n📝 STEP 4: Test file endpoint (inline mode)")
        if not test_file_endpoint(admin_cookies, patient_id, pdf_doc_id, "application/pdf", len(pdf_bytes), "PDF document"):
            all_passed = False
        
        if not test_file_endpoint(admin_cookies, patient_id, png_doc_id, "image/png", len(png_bytes), "PNG image"):
            all_passed = False
        
        if not test_file_endpoint(admin_cookies, patient_id, jpeg_doc_id, "image/jpeg", len(jpeg_bytes), "JPEG image"):
            all_passed = False
        
        # Step 5: Test download mode
        print("\n📝 STEP 5: Test download mode (?download=1)")
        if not test_download_mode(admin_cookies, patient_id, pdf_doc_id, "qa.pdf"):
            all_passed = False
        
        # Step 6: Test auth guards
        print("\n📝 STEP 6: Test authentication guards")
        if not test_auth_guards(patient_id, pdf_doc_id):
            all_passed = False
        
        # Step 7: Test wrong patient ID
        print("\n📝 STEP 7: Test wrong patient ID (404)")
        if not test_wrong_patient(admin_cookies, pdf_doc_id):
            all_passed = False
        
        # Step 8: Test nonexistent document
        print("\n📝 STEP 8: Test nonexistent document (404)")
        if not test_nonexistent_doc(admin_cookies, patient_id):
            all_passed = False
        
        # Step 9: Test HTML page doesn't leak data
        print("\n📝 STEP 9: Test HTML page for data leaks")
        if not test_html_no_leak(admin_cookies, patient_id):
            all_passed = False
        
        # Step 10: Test other roles (nurse, provider)
        print("\n📝 STEP 10: Test nurse and provider access")
        if not test_other_roles(patient_id, pdf_doc_id):
            all_passed = False
        
    finally:
        # Cleanup: Delete created documents
        if created_doc_ids:
            cleanup_documents(created_doc_ids)
        
        # Cleanup: Delete pre-existing QA documents
        cleanup_pre_existing_qa_docs()
    
    # Summary
    print("\n" + "=" * 80)
    if all_passed:
        print("✅ ALL TESTS PASSED")
        print("=" * 80)
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        print("=" * 80)
        return 1

if __name__ == "__main__":
    sys.exit(main())
