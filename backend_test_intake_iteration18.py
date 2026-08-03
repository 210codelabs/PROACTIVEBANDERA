#!/usr/bin/env python3
"""
Backend test for Iteration 18 intake enhancement endpoints.
Tests all new intake submission, review, and upload features.
"""

import asyncio
import aiohttp
import random
import string
import re

# Base URL from .env - using HTTPS for secure cookies
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def random_suffix():
    """Generate random suffix for unique test data"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

async def test_iteration18_intake():
    """Test all Iteration 18 intake enhancement endpoints"""
    
    # Separate cookie jars for staff and portal sessions
    staff_jar = aiohttp.CookieJar()
    portal_jar = aiohttp.CookieJar()
    
    # Variables to capture during tests
    captured_patient_id = None
    captured_submission_id = None
    captured_upload_id = None
    captured_portal_upload_id = None
    
    print("\n" + "="*80)
    print("BACKEND TEST: ITERATION 18 INTAKE ENHANCEMENT")
    print("="*80)
    
    # =========================================================================
    # TEST 1: PUBLIC PDF ENDPOINTS (no auth)
    # =========================================================================
    print("\n[TEST 1] PUBLIC PDF ENDPOINTS (no auth)")
    print("-" * 80)
    
    async with aiohttp.ClientSession() as session:
        # Test 1a: GET blank PDF with Spanish language
        print("\n[TEST 1a] GET /api/intake/forms/new-patient-intake/pdf?lang=es")
        try:
            async with session.get(f"{BASE_URL}/api/intake/forms/new-patient-intake/pdf?lang=es") as resp:
                status = resp.status
                content_type = resp.headers.get("Content-Type", "")
                body = await resp.read()
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    return
                print(f"✓ Status: 200")
                
                if content_type != "application/pdf":
                    print(f"✗ FAIL: Content-Type is '{content_type}', expected 'application/pdf'")
                    return
                print(f"✓ Content-Type: application/pdf")
                
                if not body.startswith(b"%PDF"):
                    print(f"✗ FAIL: Body does not start with '%PDF'")
                    return
                print(f"✓ Body starts with '%PDF' ({len(body)} bytes)")
                print(f"✓ TEST 1a PASSED")
                
        except Exception as e:
            print(f"✗ TEST 1a FAILED with exception: {e}")
            return
        
        # Test 1b: POST filled PDF with values
        print("\n[TEST 1b] POST /api/intake/forms/new-patient-intake/pdf with values")
        try:
            payload = {
                "values": {
                    "firstName": "A",
                    "lastName": "B",
                    "dob": "1990-01-01",
                    "signature": "A B",
                    "injuredAreas": "Neck, Lower Back",
                    "bodyMap": {
                        "front": [{"x": 0.5, "y": 0.3}],
                        "back": []
                    }
                },
                "lang": "en"
            }
            async with session.post(f"{BASE_URL}/api/intake/forms/new-patient-intake/pdf", json=payload) as resp:
                status = resp.status
                content_type = resp.headers.get("Content-Type", "")
                body = await resp.read()
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    return
                print(f"✓ Status: 200")
                
                if content_type != "application/pdf":
                    print(f"✗ FAIL: Content-Type is '{content_type}', expected 'application/pdf'")
                    return
                print(f"✓ Content-Type: application/pdf")
                
                if not body.startswith(b"%PDF"):
                    print(f"✗ FAIL: Body does not start with '%PDF'")
                    return
                print(f"✓ Body starts with '%PDF' ({len(body)} bytes)")
                print(f"✓ TEST 1b PASSED")
                
        except Exception as e:
            print(f"✗ TEST 1b FAILED with exception: {e}")
            return
        
        # Test 1c: POST with unknown slug should return 404
        print("\n[TEST 1c] POST /api/intake/forms/unknown-slug/pdf → 404")
        try:
            async with session.post(f"{BASE_URL}/api/intake/forms/unknown-slug/pdf", json={"values": {}}) as resp:
                status = resp.status
                
                if status != 404:
                    print(f"✗ FAIL: Expected 404, got {status}")
                    return
                print(f"✓ Status: 404")
                print(f"✓ TEST 1c PASSED")
                
        except Exception as e:
            print(f"✗ TEST 1c FAILED with exception: {e}")
            return
    
    # =========================================================================
    # TEST 2: PUBLIC SUBMIT (no auth)
    # =========================================================================
    print("\n[TEST 2] PUBLIC SUBMIT (no auth)")
    print("-" * 80)
    
    async with aiohttp.ClientSession() as session:
        print("\n[TEST 2a] POST /api/intake/submit with new patient")
        unique_suffix = random_suffix()
        unique_last = f"User{unique_suffix}"
        
        try:
            payload = {
                "slug": "new-patient-intake",
                "lang": "es",
                "values": {
                    "firstName": "InboxTest",
                    "lastName": unique_last,
                    "dob": "1991-02-03",
                    "signature": "InboxTest User",
                    "bodyMap": {
                        "front": [{"x": 0.5, "y": 0.3}],
                        "back": []
                    }
                }
            }
            async with session.post(f"{BASE_URL}/api/intake/submit", json=payload) as resp:
                status = resp.status
                data = await resp.json()
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    print(f"  Response: {data}")
                    return
                print(f"✓ Status: 200")
                
                if not data.get("ok"):
                    print(f"✗ FAIL: ok is not true")
                    return
                print(f"✓ ok: true")
                
                # Check confirmation format: ^PC-[A-Z0-9]{6}$
                confirmation = data.get("confirmation", "")
                if not re.match(r'^PC-[A-Z0-9]{6}$', confirmation):
                    print(f"✗ FAIL: confirmation '{confirmation}' does not match ^PC-[A-Z0-9]{{6}}$")
                    return
                print(f"✓ confirmation: '{confirmation}' (matches ^PC-[A-Z0-9]{{6}}$)")
                
                # Check MRN format: ^PC-\d{6}$
                mrn = data.get("mrn", "")
                if not re.match(r'^PC-\d{6}$', mrn):
                    print(f"✗ FAIL: mrn '{mrn}' does not match ^PC-\\d{{6}}$")
                    return
                print(f"✓ mrn: '{mrn}' (matches ^PC-\\d{{6}}$)")
                
                # Capture patientId for later tests
                captured_patient_id = data.get("patientId")
                if not captured_patient_id:
                    print(f"✗ FAIL: patientId is empty")
                    return
                print(f"✓ patientId: '{captured_patient_id}' (captured for later tests)")
                print(f"✓ TEST 2a PASSED")
                
        except Exception as e:
            print(f"✗ TEST 2a FAILED with exception: {e}")
            return
    
    # =========================================================================
    # TEST 3: STAFF REVIEW INBOX (staff cookie)
    # =========================================================================
    print("\n[TEST 3] STAFF REVIEW INBOX (staff cookie)")
    print("-" * 80)
    
    # First, get staff cookie
    print("\n[TEST 3-AUTH] POST /api/auth/login (staff)")
    async with aiohttp.ClientSession(cookie_jar=staff_jar) as session:
        try:
            payload = {
                "email": "andy.manzano@proactiveclinic.com",
                "password": "apex123"
            }
            async with session.post(f"{BASE_URL}/api/auth/login", json=payload) as resp:
                status = resp.status
                data = await resp.json()
                
                if status != 200:
                    print(f"✗ FAIL: Staff login failed with status {status}")
                    print(f"  Response: {data}")
                    return
                print(f"✓ Staff login successful (200)")
                
                # Check if cookie was set
                cookies = staff_jar.filter_cookies(BASE_URL)
                if 'proactive_session' not in [c.key for c in cookies.values()]:
                    print(f"✗ FAIL: proactive_session cookie not set")
                    return
                print(f"✓ proactive_session cookie set")
                
        except Exception as e:
            print(f"✗ Staff login FAILED with exception: {e}")
            return
    
    # Test 3a: GET submissions WITHOUT cookie
    print("\n[TEST 3a] GET /api/intake/submissions WITHOUT cookie → 401")
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{BASE_URL}/api/intake/submissions") as resp:
                status = resp.status
                
                if status != 401:
                    print(f"✗ FAIL: Expected 401, got {status}")
                    return
                print(f"✓ Status: 401 (Unauthorized)")
                print(f"✓ TEST 3a PASSED")
                
        except Exception as e:
            print(f"✗ TEST 3a FAILED with exception: {e}")
            return
    
    # Test 3b: GET submissions WITH cookie
    print("\n[TEST 3b] GET /api/intake/submissions WITH cookie → 200")
    async with aiohttp.ClientSession(cookie_jar=staff_jar) as session:
        try:
            async with session.get(f"{BASE_URL}/api/intake/submissions") as resp:
                status = resp.status
                data = await resp.json()
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    return
                print(f"✓ Status: 200")
                
                if "submissions" not in data:
                    print(f"✗ FAIL: Response missing 'submissions' key")
                    return
                print(f"✓ Response has 'submissions' array")
                
                if "pendingCount" not in data:
                    print(f"✗ FAIL: Response missing 'pendingCount' key")
                    return
                print(f"✓ Response has 'pendingCount'")
                
                # Find the submission we created in TEST 2
                submissions = data["submissions"]
                found = None
                for sub in submissions:
                    if sub.get("patientName", "").startswith("InboxTest"):
                        found = sub
                        captured_submission_id = sub.get("id")
                        break
                
                if not found:
                    print(f"✗ FAIL: Could not find submission with patientName starting 'InboxTest'")
                    return
                print(f"✓ Found submission with patientName '{found['patientName']}'")
                print(f"✓ Captured submission id: '{captured_submission_id}'")
                print(f"✓ TEST 3b PASSED")
                
        except Exception as e:
            print(f"✗ TEST 3b FAILED with exception: {e}")
            return
    
    # Test 3c: GET submission detail WITHOUT cookie
    print("\n[TEST 3c] GET /api/intake/submissions/{id} WITHOUT cookie → 401")
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{BASE_URL}/api/intake/submissions/{captured_submission_id}") as resp:
                status = resp.status
                
                if status != 401:
                    print(f"✗ FAIL: Expected 401, got {status}")
                    return
                print(f"✓ Status: 401 (Unauthorized)")
                print(f"✓ TEST 3c PASSED")
                
        except Exception as e:
            print(f"✗ TEST 3c FAILED with exception: {e}")
            return
    
    # Test 3d: GET submission detail WITH cookie
    print("\n[TEST 3d] GET /api/intake/submissions/{id} WITH cookie → 200")
    async with aiohttp.ClientSession(cookie_jar=staff_jar) as session:
        try:
            async with session.get(f"{BASE_URL}/api/intake/submissions/{captured_submission_id}") as resp:
                status = resp.status
                data = await resp.json()
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    return
                print(f"✓ Status: 200")
                
                required_fields = ["id", "patientId", "patientName", "mrn", "detail"]
                for field in required_fields:
                    if field not in data:
                        print(f"✗ FAIL: Response missing '{field}' key")
                        return
                print(f"✓ Response has all required fields: {', '.join(required_fields)}")
                
                if not data["patientName"].startswith("InboxTest"):
                    print(f"✗ FAIL: patientName '{data['patientName']}' does not start with 'InboxTest'")
                    return
                print(f"✓ patientName: '{data['patientName']}'")
                
                if "values" not in data["detail"]:
                    print(f"✗ FAIL: detail missing 'values' key")
                    return
                print(f"✓ detail has parsed values")
                print(f"✓ TEST 3d PASSED")
                
        except Exception as e:
            print(f"✗ TEST 3d FAILED with exception: {e}")
            return
    
    # Test 3e: POST review approve
    print("\n[TEST 3e] POST /api/intake/submissions/{id}/review {action:'approve'} → 200")
    async with aiohttp.ClientSession(cookie_jar=staff_jar) as session:
        try:
            payload = {"action": "approve"}
            async with session.post(f"{BASE_URL}/api/intake/submissions/{captured_submission_id}/review", json=payload) as resp:
                status = resp.status
                data = await resp.json()
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    return
                print(f"✓ Status: 200")
                
                if not data.get("ok"):
                    print(f"✗ FAIL: ok is not true")
                    return
                print(f"✓ ok: true")
                
                if data.get("reviewStatus") != "approved":
                    print(f"✗ FAIL: reviewStatus is '{data.get('reviewStatus')}', expected 'approved'")
                    return
                print(f"✓ reviewStatus: 'approved'")
                print(f"✓ TEST 3e PASSED")
                
        except Exception as e:
            print(f"✗ TEST 3e FAILED with exception: {e}")
            return
    
    # Test 3f: POST review reopen
    print("\n[TEST 3f] POST /api/intake/submissions/{id}/review {action:'reopen'} → 200")
    async with aiohttp.ClientSession(cookie_jar=staff_jar) as session:
        try:
            payload = {"action": "reopen"}
            async with session.post(f"{BASE_URL}/api/intake/submissions/{captured_submission_id}/review", json=payload) as resp:
                status = resp.status
                data = await resp.json()
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    return
                print(f"✓ Status: 200")
                
                if not data.get("ok"):
                    print(f"✗ FAIL: ok is not true")
                    return
                print(f"✓ ok: true")
                
                if data.get("reviewStatus") != "pending":
                    print(f"✗ FAIL: reviewStatus is '{data.get('reviewStatus')}', expected 'pending'")
                    return
                print(f"✓ reviewStatus: 'pending'")
                print(f"✓ TEST 3f PASSED")
                
        except Exception as e:
            print(f"✗ TEST 3f FAILED with exception: {e}")
            return
    
    # Test 3g: POST review with bogus action
    print("\n[TEST 3g] POST /api/intake/submissions/{id}/review {action:'bogus'} → 400")
    async with aiohttp.ClientSession(cookie_jar=staff_jar) as session:
        try:
            payload = {"action": "bogus"}
            async with session.post(f"{BASE_URL}/api/intake/submissions/{captured_submission_id}/review", json=payload) as resp:
                status = resp.status
                
                if status != 400:
                    print(f"✗ FAIL: Expected 400, got {status}")
                    return
                print(f"✓ Status: 400 (Invalid action)")
                print(f"✓ TEST 3g PASSED")
                
        except Exception as e:
            print(f"✗ TEST 3g FAILED with exception: {e}")
            return
    
    # Test 3h: POST review WITHOUT cookie
    print("\n[TEST 3h] POST /api/intake/submissions/{id}/review WITHOUT cookie → 401")
    async with aiohttp.ClientSession() as session:
        try:
            payload = {"action": "approve"}
            async with session.post(f"{BASE_URL}/api/intake/submissions/{captured_submission_id}/review", json=payload) as resp:
                status = resp.status
                
                if status != 401:
                    print(f"✗ FAIL: Expected 401, got {status}")
                    return
                print(f"✓ Status: 401 (Unauthorized)")
                print(f"✓ TEST 3h PASSED")
                
        except Exception as e:
            print(f"✗ TEST 3h FAILED with exception: {e}")
            return
    
    # Test 3i: GET submission PDF WITH cookie
    print("\n[TEST 3i] GET /api/intake/submissions/{id}/pdf WITH cookie → 200")
    async with aiohttp.ClientSession(cookie_jar=staff_jar) as session:
        try:
            async with session.get(f"{BASE_URL}/api/intake/submissions/{captured_submission_id}/pdf") as resp:
                status = resp.status
                content_type = resp.headers.get("Content-Type", "")
                body = await resp.read()
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    return
                print(f"✓ Status: 200")
                
                if content_type != "application/pdf":
                    print(f"✗ FAIL: Content-Type is '{content_type}', expected 'application/pdf'")
                    return
                print(f"✓ Content-Type: application/pdf")
                
                if not body.startswith(b"%PDF"):
                    print(f"✗ FAIL: Body does not start with '%PDF'")
                    return
                print(f"✓ Body starts with '%PDF' ({len(body)} bytes)")
                print(f"✓ TEST 3i PASSED")
                
        except Exception as e:
            print(f"✗ TEST 3i FAILED with exception: {e}")
            return
    
    # Test 3j: GET submission PDF WITHOUT cookie
    print("\n[TEST 3j] GET /api/intake/submissions/{id}/pdf WITHOUT cookie → 401")
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{BASE_URL}/api/intake/submissions/{captured_submission_id}/pdf") as resp:
                status = resp.status
                
                if status != 401:
                    print(f"✗ FAIL: Expected 401, got {status}")
                    return
                print(f"✓ Status: 401 (Unauthorized)")
                print(f"✓ TEST 3j PASSED")
                
        except Exception as e:
            print(f"✗ TEST 3j FAILED with exception: {e}")
            return
    
    # =========================================================================
    # TEST 4: STAFF UPLOAD/DOWNLOAD (staff cookie)
    # =========================================================================
    print("\n[TEST 4] STAFF UPLOAD/DOWNLOAD (staff cookie)")
    print("-" * 80)
    
    # Test 4a: POST upload with valid data
    print("\n[TEST 4a] POST /api/intake/submissions/upload with valid data → 200")
    async with aiohttp.ClientSession(cookie_jar=staff_jar) as session:
        try:
            payload = {
                "patientId": captured_patient_id,
                "slug": "new-patient-intake",
                "fileName": "scan.pdf",
                "dataUrl": "data:application/pdf;base64,JVBERi0xLjQK"
            }
            async with session.post(f"{BASE_URL}/api/intake/submissions/upload", json=payload) as resp:
                status = resp.status
                data = await resp.json()
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    print(f"  Response: {data}")
                    return
                print(f"✓ Status: 200")
                
                if not data.get("ok"):
                    print(f"✗ FAIL: ok is not true")
                    return
                print(f"✓ ok: true")
                
                captured_upload_id = data.get("id")
                if not captured_upload_id:
                    print(f"✗ FAIL: id is empty")
                    return
                print(f"✓ id: '{captured_upload_id}' (captured for later tests)")
                print(f"✓ TEST 4a PASSED")
                
        except Exception as e:
            print(f"✗ TEST 4a FAILED with exception: {e}")
            return
    
    # Test 4b: POST upload missing dataUrl
    print("\n[TEST 4b] POST /api/intake/submissions/upload missing dataUrl → 400")
    async with aiohttp.ClientSession(cookie_jar=staff_jar) as session:
        try:
            payload = {
                "patientId": captured_patient_id,
                "slug": "new-patient-intake",
                "fileName": "scan.pdf"
            }
            async with session.post(f"{BASE_URL}/api/intake/submissions/upload", json=payload) as resp:
                status = resp.status
                
                if status != 400:
                    print(f"✗ FAIL: Expected 400, got {status}")
                    return
                print(f"✓ Status: 400 (missing dataUrl)")
                print(f"✓ TEST 4b PASSED")
                
        except Exception as e:
            print(f"✗ TEST 4b FAILED with exception: {e}")
            return
    
    # Test 4c: POST upload with bad dataUrl (not PDF/image)
    print("\n[TEST 4c] POST /api/intake/submissions/upload with bad dataUrl → 400")
    async with aiohttp.ClientSession(cookie_jar=staff_jar) as session:
        try:
            payload = {
                "patientId": captured_patient_id,
                "slug": "new-patient-intake",
                "fileName": "scan.txt",
                "dataUrl": "data:text/plain;base64,AAAA"
            }
            async with session.post(f"{BASE_URL}/api/intake/submissions/upload", json=payload) as resp:
                status = resp.status
                
                if status != 400:
                    print(f"✗ FAIL: Expected 400, got {status}")
                    return
                print(f"✓ Status: 400 (bad dataUrl format)")
                print(f"✓ TEST 4c PASSED")
                
        except Exception as e:
            print(f"✗ TEST 4c FAILED with exception: {e}")
            return
    
    # Test 4d: POST upload with unknown patientId
    print("\n[TEST 4d] POST /api/intake/submissions/upload with unknown patientId → 404")
    async with aiohttp.ClientSession(cookie_jar=staff_jar) as session:
        try:
            payload = {
                "patientId": "nope123",
                "slug": "new-patient-intake",
                "fileName": "scan.pdf",
                "dataUrl": "data:application/pdf;base64,JVBERi0xLjQK"
            }
            async with session.post(f"{BASE_URL}/api/intake/submissions/upload", json=payload) as resp:
                status = resp.status
                
                if status != 404:
                    print(f"✗ FAIL: Expected 404, got {status}")
                    return
                print(f"✓ Status: 404 (unknown patientId)")
                print(f"✓ TEST 4d PASSED")
                
        except Exception as e:
            print(f"✗ TEST 4d FAILED with exception: {e}")
            return
    
    # Test 4e: POST upload WITHOUT cookie
    print("\n[TEST 4e] POST /api/intake/submissions/upload WITHOUT cookie → 401")
    async with aiohttp.ClientSession() as session:
        try:
            payload = {
                "patientId": captured_patient_id,
                "slug": "new-patient-intake",
                "fileName": "scan.pdf",
                "dataUrl": "data:application/pdf;base64,JVBERi0xLjQK"
            }
            async with session.post(f"{BASE_URL}/api/intake/submissions/upload", json=payload) as resp:
                status = resp.status
                
                if status != 401:
                    print(f"✗ FAIL: Expected 401, got {status}")
                    return
                print(f"✓ Status: 401 (Unauthorized)")
                print(f"✓ TEST 4e PASSED")
                
        except Exception as e:
            print(f"✗ TEST 4e FAILED with exception: {e}")
            return
    
    # Test 4f: GET uploaded file WITH cookie
    print("\n[TEST 4f] GET /api/intake/submissions/{uploadId}/file WITH cookie → 200")
    async with aiohttp.ClientSession(cookie_jar=staff_jar) as session:
        try:
            async with session.get(f"{BASE_URL}/api/intake/submissions/{captured_upload_id}/file") as resp:
                status = resp.status
                content_type = resp.headers.get("Content-Type", "")
                body = await resp.read()
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    return
                print(f"✓ Status: 200")
                
                if content_type != "application/pdf":
                    print(f"✗ FAIL: Content-Type is '{content_type}', expected 'application/pdf'")
                    return
                print(f"✓ Content-Type: application/pdf")
                
                if len(body) == 0:
                    print(f"✗ FAIL: Body is empty")
                    return
                print(f"✓ Body is non-empty ({len(body)} bytes)")
                print(f"✓ TEST 4f PASSED")
                
        except Exception as e:
            print(f"✗ TEST 4f FAILED with exception: {e}")
            return
    
    # =========================================================================
    # TEST 5: PORTAL UPLOAD/DOWNLOAD (portal cookie)
    # =========================================================================
    print("\n[TEST 5] PORTAL UPLOAD/DOWNLOAD (portal cookie)")
    print("-" * 80)
    
    # First, get portal cookie
    print("\n[TEST 5-AUTH] POST /api/portal/auth/login")
    async with aiohttp.ClientSession(cookie_jar=portal_jar) as session:
        try:
            payload = {
                "mrn": "PC-100000",
                "dob": "1958-04-12"
            }
            async with session.post(f"{BASE_URL}/api/portal/auth/login", json=payload) as resp:
                status = resp.status
                data = await resp.json()
                
                if status != 200:
                    print(f"✗ FAIL: Portal login failed with status {status}")
                    print(f"  Response: {data}")
                    return
                print(f"✓ Portal login successful (200)")
                
                # Check if cookie was set
                cookies = portal_jar.filter_cookies(BASE_URL)
                if 'proactive_portal_session' not in [c.key for c in cookies.values()]:
                    print(f"✗ FAIL: proactive_portal_session cookie not set")
                    return
                print(f"✓ proactive_portal_session cookie set")
                
        except Exception as e:
            print(f"✗ Portal login FAILED with exception: {e}")
            return
    
    # Test 5a: POST portal upload with valid data
    print("\n[TEST 5a] POST /api/portal/intake/upload with valid data → 200")
    async with aiohttp.ClientSession(cookie_jar=portal_jar) as session:
        try:
            payload = {
                "slug": "current-patient-checkin",
                "fileName": "p.pdf",
                "dataUrl": "data:application/pdf;base64,JVBERi0xLjQK"
            }
            async with session.post(f"{BASE_URL}/api/portal/intake/upload", json=payload) as resp:
                status = resp.status
                data = await resp.json()
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    print(f"  Response: {data}")
                    return
                print(f"✓ Status: 200")
                
                if not data.get("ok"):
                    print(f"✗ FAIL: ok is not true")
                    return
                print(f"✓ ok: true")
                
                captured_portal_upload_id = data.get("id")
                if not captured_portal_upload_id:
                    print(f"✗ FAIL: id is empty")
                    return
                print(f"✓ id: '{captured_portal_upload_id}' (captured for later tests)")
                print(f"✓ TEST 5a PASSED")
                
        except Exception as e:
            print(f"✗ TEST 5a FAILED with exception: {e}")
            return
    
    # Test 5b: GET portal uploaded file WITH portal cookie
    print("\n[TEST 5b] GET /api/portal/intake/{portalUploadId}/file WITH portal cookie → 200")
    async with aiohttp.ClientSession(cookie_jar=portal_jar) as session:
        try:
            async with session.get(f"{BASE_URL}/api/portal/intake/{captured_portal_upload_id}/file") as resp:
                status = resp.status
                content_type = resp.headers.get("Content-Type", "")
                body = await resp.read()
                
                if status != 200:
                    print(f"✗ FAIL: Expected 200, got {status}")
                    return
                print(f"✓ Status: 200")
                
                if content_type != "application/pdf":
                    print(f"✗ FAIL: Content-Type is '{content_type}', expected 'application/pdf'")
                    return
                print(f"✓ Content-Type: application/pdf")
                
                if len(body) == 0:
                    print(f"✗ FAIL: Body is empty")
                    return
                print(f"✓ Body is non-empty ({len(body)} bytes)")
                print(f"✓ TEST 5b PASSED")
                
        except Exception as e:
            print(f"✗ TEST 5b FAILED with exception: {e}")
            return
    
    # Test 5c: Ownership check - try to access staff upload from portal session
    print("\n[TEST 5c] GET /api/portal/intake/{uploadId-from-step4}/file (ownership check) → 404")
    async with aiohttp.ClientSession(cookie_jar=portal_jar) as session:
        try:
            async with session.get(f"{BASE_URL}/api/portal/intake/{captured_upload_id}/file") as resp:
                status = resp.status
                
                if status != 404:
                    print(f"✗ FAIL: Expected 404 (ownership check), got {status}")
                    return
                print(f"✓ Status: 404 (ownership check working - cannot access other patient's file)")
                print(f"✓ TEST 5c PASSED")
                
        except Exception as e:
            print(f"✗ TEST 5c FAILED with exception: {e}")
            return
    
    # Test 5d: POST portal upload WITHOUT cookie
    print("\n[TEST 5d] POST /api/portal/intake/upload WITHOUT cookie → 401")
    async with aiohttp.ClientSession() as session:
        try:
            payload = {
                "slug": "current-patient-checkin",
                "fileName": "p.pdf",
                "dataUrl": "data:application/pdf;base64,JVBERi0xLjQK"
            }
            async with session.post(f"{BASE_URL}/api/portal/intake/upload", json=payload) as resp:
                status = resp.status
                
                if status != 401:
                    print(f"✗ FAIL: Expected 401, got {status}")
                    return
                print(f"✓ Status: 401 (Unauthorized)")
                print(f"✓ TEST 5d PASSED")
                
        except Exception as e:
            print(f"✗ TEST 5d FAILED with exception: {e}")
            return
    
    # =========================================================================
    # SUMMARY
    # =========================================================================
    print("\n" + "="*80)
    print("✓ ALL TESTS PASSED")
    print("="*80)
    print("Summary:")
    print("  ✓ TEST 1: PUBLIC PDF endpoints (3 tests)")
    print("    - GET blank PDF with lang=es")
    print("    - POST filled PDF with values")
    print("    - POST unknown slug returns 404")
    print("  ✓ TEST 2: PUBLIC submit (1 test)")
    print("    - POST creates patient with confirmation and MRN")
    print("  ✓ TEST 3: STAFF review inbox (10 tests)")
    print("    - GET submissions with/without auth")
    print("    - GET submission detail with/without auth")
    print("    - POST review approve/reopen/bogus")
    print("    - GET submission PDF with/without auth")
    print("  ✓ TEST 4: STAFF upload/download (6 tests)")
    print("    - POST upload with validation cases")
    print("    - GET uploaded file")
    print("  ✓ TEST 5: PORTAL upload/download (4 tests)")
    print("    - POST portal upload")
    print("    - GET portal file")
    print("    - Ownership check (cannot access other patient's file)")
    print("    - POST without auth")
    print("="*80)
    print(f"Total: 24 test cases passed")
    print("="*80)

if __name__ == "__main__":
    asyncio.run(test_iteration18_intake())
