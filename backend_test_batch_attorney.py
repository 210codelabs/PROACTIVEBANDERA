#!/usr/bin/env python3
"""
Backend test for:
- PART A: Batch EHI export (admin) - whole practice C-CDA/PDF zip
- PART B: Attorney records-request C-CDA download
"""
import requests
import os
import io
import zipfile

BASE_URL = os.getenv("NEXT_PUBLIC_BASE_URL", "https://nextjs-ssr-stack.preview.emergentagent.com")
API_BASE = f"{BASE_URL}/api"

print("=" * 80)
print("BACKEND TEST: Batch EHI Export + Attorney C-CDA Download")
print("=" * 80)

# ============================================================================
# PART A: Batch EHI export (admin)
# ============================================================================
print("\n" + "=" * 80)
print("PART A: BATCH EHI EXPORT (ADMIN)")
print("=" * 80)

# Admin login
print("\n[SETUP] Admin login...")
admin_session = requests.Session()
try:
    resp = admin_session.post(f"{API_BASE}/auth/login", json={
        "email": "admin@proactiveclinic.com",
        "password": "apex123"
    }, timeout=30)
    print(f"Admin login status: {resp.status_code}")
    if resp.status_code == 200:
        print("✅ Admin login successful")
    else:
        print(f"❌ Admin login failed: {resp.text}")
        exit(1)
except Exception as e:
    print(f"❌ Admin login error: {e}")
    exit(1)

# A1: GET /api/admin/ehi-export?scope=all&format=ccda as admin
print("\n[A1] GET /api/admin/ehi-export?scope=all&format=ccda as admin")
try:
    resp = admin_session.get(f"{API_BASE}/admin/ehi-export?scope=all&format=ccda", timeout=60)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        print("✅ Status 200")
        
        # Check content-type
        ct = resp.headers.get("content-type", "")
        print(f"Content-Type: {ct}")
        if "application/zip" in ct:
            print("✅ Content-Type is application/zip")
        else:
            print(f"❌ Expected application/zip, got {ct}")
        
        # Check content-disposition
        cd = resp.headers.get("content-disposition", "")
        print(f"Content-Disposition: {cd}")
        if "attachment" in cd and ".zip" in cd:
            print("✅ Content-Disposition has attachment .zip")
        else:
            print(f"❌ Expected attachment .zip in Content-Disposition")
        
        # Check first 2 bytes are "PK" (ZIP magic)
        body = resp.content
        print(f"Body size: {len(body)} bytes")
        if len(body) >= 2 and body[0:2] == b'PK':
            print("✅ Body starts with 'PK' (ZIP magic bytes)")
            
            # Try to unzip and verify contents
            try:
                with zipfile.ZipFile(io.BytesIO(body)) as zf:
                    files = zf.namelist()
                    print(f"ZIP contains {len(files)} files: {files}")
                    
                    # Check for index.csv
                    if "index.csv" in files:
                        print("✅ index.csv present in ZIP")
                    else:
                        print("❌ index.csv NOT found in ZIP")
                    
                    # Check for at least one .xml file
                    xml_files = [f for f in files if f.endswith(".xml")]
                    if xml_files:
                        print(f"✅ Found {len(xml_files)} .xml file(s): {xml_files[:3]}")
                    else:
                        print("❌ No .xml files found in ZIP")
            except Exception as e:
                print(f"⚠️  Could not unzip: {e}")
        else:
            print(f"❌ Body does NOT start with 'PK': {body[0:2]}")
    else:
        print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    print(f"❌ A1 error: {e}")

# A2: GET /api/admin/ehi-export?scope=all&format=pdf as admin
print("\n[A2] GET /api/admin/ehi-export?scope=all&format=pdf as admin")
try:
    resp = admin_session.get(f"{API_BASE}/admin/ehi-export?scope=all&format=pdf", timeout=60)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        print("✅ Status 200")
        
        # Check content-type
        ct = resp.headers.get("content-type", "")
        print(f"Content-Type: {ct}")
        if "application/zip" in ct:
            print("✅ Content-Type is application/zip")
        else:
            print(f"❌ Expected application/zip, got {ct}")
        
        # Check first 2 bytes are "PK" (ZIP magic)
        body = resp.content
        print(f"Body size: {len(body)} bytes")
        if len(body) >= 2 and body[0:2] == b'PK':
            print("✅ Body starts with 'PK' (ZIP magic bytes)")
            
            # Try to unzip and verify contents
            try:
                with zipfile.ZipFile(io.BytesIO(body)) as zf:
                    files = zf.namelist()
                    print(f"ZIP contains {len(files)} files: {files}")
                    
                    # Check for index.csv
                    if "index.csv" in files:
                        print("✅ index.csv present in ZIP")
                    else:
                        print("❌ index.csv NOT found in ZIP")
                    
                    # Check for at least one .pdf file
                    pdf_files = [f for f in files if f.endswith(".pdf")]
                    if pdf_files:
                        print(f"✅ Found {len(pdf_files)} .pdf file(s): {pdf_files[:3]}")
                    else:
                        print("❌ No .pdf files found in ZIP")
            except Exception as e:
                print(f"⚠️  Could not unzip: {e}")
        else:
            print(f"❌ Body does NOT start with 'PK': {body[0:2]}")
    else:
        print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    print(f"❌ A2 error: {e}")

# A3: GET /api/admin/ehi-export?scope=all&format=ccda with NO cookie
print("\n[A3] GET /api/admin/ehi-export?scope=all&format=ccda with NO cookie")
try:
    resp = requests.get(f"{API_BASE}/admin/ehi-export?scope=all&format=ccda", timeout=30)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 401:
        print("✅ Status 401 (Unauthorized) as expected")
    else:
        print(f"❌ Expected 401, got {resp.status_code}: {resp.text}")
except Exception as e:
    print(f"❌ A3 error: {e}")

# ============================================================================
# PART B: Attorney records-request download with C-CDA option
# ============================================================================
print("\n" + "=" * 80)
print("PART B: ATTORNEY RECORDS-REQUEST C-CDA DOWNLOAD")
print("=" * 80)

# Attorney login
print("\n[SETUP] Attorney login...")
attorney_session = requests.Session()
try:
    resp = attorney_session.post(f"{API_BASE}/attorney/auth/login", json={
        "email": "attorney@example.com",
        "accessCode": "PROLAW2025"
    }, timeout=30)
    print(f"Attorney login status: {resp.status_code}")
    if resp.status_code == 200:
        print("✅ Attorney login successful")
        data = resp.json()
        print(f"Attorney: {data.get('name', 'N/A')}, Firm: {data.get('firm', 'N/A')}")
    else:
        print(f"❌ Attorney login failed: {resp.text}")
        exit(1)
except Exception as e:
    print(f"❌ Attorney login error: {e}")
    exit(1)

# Setup: Create a pending RecordRequest
print("\n[SETUP] Create a pending RecordRequest for PC-100000 / Adams...")
request_id = None
try:
    resp = attorney_session.post(f"{API_BASE}/attorney/requests", json={
        "patientMrn": "PC-100000",
        "patientLastName": "Adams",
        "reason": "test records for batch attorney feature"
    }, timeout=30)
    print(f"Create request status: {resp.status_code}")
    if resp.status_code == 201:
        data = resp.json()
        request_id = data.get("request", {}).get("id")
        print(f"✅ RecordRequest created with ID: {request_id}")
    else:
        print(f"❌ Failed to create request: {resp.text}")
        exit(1)
except Exception as e:
    print(f"❌ Create request error: {e}")
    exit(1)

# Verify the request is in the list
print("\n[SETUP] GET /api/attorney/requests to verify...")
try:
    resp = attorney_session.get(f"{API_BASE}/attorney/requests", timeout=30)
    print(f"Get requests status: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        requests_list = data.get("requests", [])
        print(f"✅ Found {len(requests_list)} request(s)")
        found = [r for r in requests_list if r.get("id") == request_id]
        if found:
            print(f"✅ Request {request_id} found with status: {found[0].get('status')}")
        else:
            print(f"❌ Request {request_id} NOT found in list")
    else:
        print(f"❌ Failed to get requests: {resp.text}")
except Exception as e:
    print(f"❌ Get requests error: {e}")

# Approve the request as admin
print(f"\n[SETUP] Approve request {request_id} as admin...")
try:
    resp = admin_session.patch(f"{API_BASE}/records-requests/{request_id}", json={
        "status": "approved"
    }, timeout=30)
    print(f"Approve request status: {resp.status_code}")
    if resp.status_code == 200:
        print("✅ Request approved")
    else:
        print(f"❌ Failed to approve request: {resp.text}")
        exit(1)
except Exception as e:
    print(f"❌ Approve request error: {e}")
    exit(1)

# B1: GET /api/attorney/requests/{id}/download?format=ccda as attorney
print(f"\n[B1] GET /api/attorney/requests/{request_id}/download?format=ccda as attorney")
try:
    resp = attorney_session.get(f"{API_BASE}/attorney/requests/{request_id}/download?format=ccda", timeout=30)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        print("✅ Status 200")
        
        # Check content-type
        ct = resp.headers.get("content-type", "")
        print(f"Content-Type: {ct}")
        if "application/xml" in ct:
            print("✅ Content-Type contains 'application/xml'")
        else:
            print(f"❌ Expected application/xml, got {ct}")
        
        # Check content-disposition
        cd = resp.headers.get("content-disposition", "")
        print(f"Content-Disposition: {cd}")
        if "attachment" in cd and ".xml" in cd:
            print("✅ Content-Disposition has attachment .xml")
        else:
            print(f"⚠️  Content-Disposition: {cd}")
        
        # Check body content
        body = resp.text
        print(f"Body size: {len(body)} bytes")
        
        # Check starts with <?xml
        if body.startswith("<?xml"):
            print("✅ Body starts with '<?xml'")
        else:
            print(f"❌ Body does NOT start with '<?xml': {body[:50]}")
        
        # Check contains <ClinicalDocument
        if "<ClinicalDocument" in body:
            print("✅ Body contains '<ClinicalDocument'")
        else:
            print("❌ Body does NOT contain '<ClinicalDocument'")
        
        # Check contains PC-100000
        if "PC-100000" in body:
            print("✅ Body contains 'PC-100000'")
        else:
            print("❌ Body does NOT contain 'PC-100000'")
    else:
        print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    print(f"❌ B1 error: {e}")

# B2: GET /api/attorney/requests/{id}/download?format=pdf as attorney
print(f"\n[B2] GET /api/attorney/requests/{request_id}/download?format=pdf as attorney")
try:
    resp = attorney_session.get(f"{API_BASE}/attorney/requests/{request_id}/download?format=pdf", timeout=30)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        print("✅ Status 200")
        
        # Check content-type
        ct = resp.headers.get("content-type", "")
        print(f"Content-Type: {ct}")
        if "application/pdf" in ct:
            print("✅ Content-Type is 'application/pdf'")
        else:
            print(f"❌ Expected application/pdf, got {ct}")
        
        # Check first 4 bytes are %PDF
        body = resp.content
        print(f"Body size: {len(body)} bytes")
        if len(body) >= 4 and body[0:4] == b'%PDF':
            print("✅ First 4 bytes are '%PDF' (valid PDF)")
        else:
            print(f"❌ First 4 bytes are NOT '%PDF': {body[0:4]}")
    else:
        print(f"❌ Expected 200, got {resp.status_code}: {resp.text}")
except Exception as e:
    print(f"❌ B2 error: {e}")

# B3: GET /api/attorney/requests/{id}/download?format=ccda with NO attorney cookie
print(f"\n[B3] GET /api/attorney/requests/{request_id}/download?format=ccda with NO attorney cookie")
try:
    resp = requests.get(f"{API_BASE}/attorney/requests/{request_id}/download?format=ccda", timeout=30)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 401:
        print("✅ Status 401 (Unauthorized) as expected")
    else:
        print(f"❌ Expected 401, got {resp.status_code}: {resp.text}")
except Exception as e:
    print(f"❌ B3 error: {e}")

# B4: Create a second request (leave it pending, do NOT approve) and GET its /download
print("\n[B4] Create a second request (pending, NOT approved) and try to download")
request_id_2 = None
try:
    # Create second request
    resp = attorney_session.post(f"{API_BASE}/attorney/requests", json={
        "patientMrn": "PC-100000",
        "patientLastName": "Adams",
        "reason": "second test request - should NOT be approved"
    }, timeout=30)
    print(f"Create second request status: {resp.status_code}")
    if resp.status_code == 201:
        data = resp.json()
        request_id_2 = data.get("request", {}).get("id")
        print(f"✅ Second RecordRequest created with ID: {request_id_2}")
        
        # Try to download (should fail with 403)
        resp = attorney_session.get(f"{API_BASE}/attorney/requests/{request_id_2}/download?format=ccda", timeout=30)
        print(f"Download status: {resp.status_code}")
        
        if resp.status_code == 403:
            print("✅ Status 403 (Forbidden) as expected - request not approved")
        else:
            print(f"❌ Expected 403, got {resp.status_code}: {resp.text}")
    else:
        print(f"❌ Failed to create second request: {resp.text}")
except Exception as e:
    print(f"❌ B4 error: {e}")

print("\n" + "=" * 80)
print("BACKEND TEST COMPLETE")
print("=" * 80)
