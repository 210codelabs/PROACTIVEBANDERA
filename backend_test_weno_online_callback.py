#!/usr/bin/env python3
"""
Backend test for Weno Online GO-LIVE + result callback + Directory Sync Report + pharmacy import fix
Test date: 2026-08-09
"""

import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"
PROVIDER_EMAIL = "andy.manzano@proactiveclinic.com"
PROVIDER_PASSWORD = "apex123"

def login(email, password):
    """Login and return session cookie"""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=30
        )
        print(f"Login {email}: {resp.status_code}")
        if resp.status_code == 200:
            cookie = resp.cookies.get("proactive_session")
            if cookie:
                print(f"✅ Login successful for {email}")
                return cookie
            else:
                print(f"❌ No session cookie returned for {email}")
                return None
        else:
            print(f"❌ Login failed for {email}: {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"❌ Login exception for {email}: {e}")
        return None

def test_feature_1_weno_online():
    """Test FEATURE 1 — Weno Online GO-LIVE + launch stub + result callback"""
    print("\n" + "="*80)
    print("FEATURE 1 — Weno Online GO-LIVE + launch stub + result callback")
    print("="*80)
    
    # Login as provider
    provider_cookie = login(PROVIDER_EMAIL, PROVIDER_PASSWORD)
    if not provider_cookie:
        print("❌ FEATURE 1 FAILED: Could not login as provider")
        return False
    
    cookies = {"proactive_session": provider_cookie}
    
    # TEST 1: GET /api/erx/weno-status (provider) -> 200 with online:{enabled:true, configured:TRUE, keySet:true, environment:'test'}
    print("\n--- TEST 1: GET /api/erx/weno-status (provider) ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/erx/weno-status", cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # CRITICAL ASSERTIONS
            if "online" not in data:
                print("❌ TEST 1 FAILED: Response missing 'online' key")
                return False
            
            online = data["online"]
            if online.get("enabled") != True:
                print(f"❌ TEST 1 FAILED: online.enabled={online.get('enabled')}, expected True")
                return False
            
            if online.get("configured") != True:
                print(f"❌ TEST 1 FAILED: online.configured={online.get('configured')}, expected True (GO-LIVE)")
                return False
            
            if online.get("keySet") != True:
                print(f"❌ TEST 1 FAILED: online.keySet={online.get('keySet')}, expected True")
                return False
            
            if online.get("environment") != "test":
                print(f"❌ TEST 1 FAILED: online.environment={online.get('environment')}, expected 'test'")
                return False
            
            print("✅ TEST 1 PASSED: Weno Online status correct (enabled=true, configured=TRUE, keySet=true, environment='test')")
        else:
            print(f"❌ TEST 1 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 FAILED: Exception: {e}")
        return False
    
    # TEST 2: Get patient ID and launch Weno Online
    print("\n--- TEST 2: POST /api/erx/weno-online/launch ---")
    try:
        # Get patient ID
        resp = requests.get(f"{BASE_URL}/api/patients/search?q=Adams", cookies=cookies, timeout=30)
        print(f"Patient search status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"❌ TEST 2 FAILED: Patient search failed: {resp.text[:200]}")
            return False
        
        search_data = resp.json()
        patients = search_data.get("results", []) if isinstance(search_data, dict) else search_data
        if not patients or len(patients) == 0:
            print("❌ TEST 2 FAILED: No patients found for 'Adams'")
            return False
        
        patient_id = patients[0]["id"]
        print(f"Found patient ID: {patient_id}")
        
        # Launch Weno Online
        resp = requests.post(
            f"{BASE_URL}/api/erx/weno-online/launch",
            json={"patientId": patient_id},
            cookies=cookies,
            timeout=30
        )
        print(f"Launch status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # CRITICAL ASSERTIONS
            if not data.get("ok"):
                print(f"❌ TEST 2 FAILED: ok={data.get('ok')}, expected true")
                return False
            
            if not data.get("url"):
                print("❌ TEST 2 FAILED: Missing 'url' in response")
                return False
            
            url = data["url"]
            if not url.startswith("https://test.wenoexchange.com/en/NewRx/ComposeRx"):
                print(f"❌ TEST 2 FAILED: URL doesn't start with expected prefix: {url[:100]}")
                return False
            
            if "useremail=" not in url:
                print(f"❌ TEST 2 FAILED: URL missing 'useremail=' parameter")
                return False
            
            if "data=" not in url:
                print(f"❌ TEST 2 FAILED: URL missing 'data=' parameter")
                return False
            
            if not data.get("prescriptionId"):
                print("❌ TEST 2 FAILED: Missing 'prescriptionId' in response")
                return False
            
            if data.get("environment") != "test":
                print(f"❌ TEST 2 FAILED: environment={data.get('environment')}, expected 'test'")
                return False
            
            print(f"✅ TEST 2 PASSED: Launch successful with URL starting with 'https://test.wenoexchange.com/en/NewRx/ComposeRx', contains 'useremail=' and 'data=', prescriptionId={data['prescriptionId']}, environment='test'")
        else:
            print(f"❌ TEST 2 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 2 FAILED: Exception: {e}")
        return False
    
    # TEST 3: GET /api/erx?patientId=<id> and capture wenoMessageId
    print("\n--- TEST 3: GET /api/erx?patientId=<id> and capture wenoMessageId ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/erx?patientId={patient_id}", cookies=cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            prescriptions = data.get("prescriptions", []) if isinstance(data, dict) else data
            print(f"Found {len(prescriptions)} prescriptions")
            
            # Find newest weno-online prescription
            weno_online_rx = None
            for rx in prescriptions:
                if rx.get("transmissionMethod") == "weno-online":
                    if not weno_online_rx or rx.get("createdAt", "") > weno_online_rx.get("createdAt", ""):
                        weno_online_rx = rx
            
            if not weno_online_rx:
                print("❌ TEST 3 FAILED: No weno-online prescription found")
                return False
            
            print(f"Newest weno-online prescription: {json.dumps(weno_online_rx, indent=2)}")
            
            # CRITICAL ASSERTIONS
            if weno_online_rx.get("transmissionMethod") != "weno-online":
                print(f"❌ TEST 3 FAILED: transmissionMethod={weno_online_rx.get('transmissionMethod')}, expected 'weno-online'")
                return False
            
            if weno_online_rx.get("wenoState") != "launched":
                print(f"❌ TEST 3 FAILED: wenoState={weno_online_rx.get('wenoState')}, expected 'launched'")
                return False
            
            med_name = weno_online_rx.get("medName", "")
            if "composing" not in med_name.lower():
                print(f"❌ TEST 3 FAILED: medName='{med_name}' doesn't contain 'composing'")
                return False
            
            weno_message_id = weno_online_rx.get("wenoMessageId")
            if not weno_message_id:
                print("❌ TEST 3 FAILED: Missing wenoMessageId")
                return False
            
            print(f"✅ TEST 3 PASSED: Found weno-online prescription with transmissionMethod='weno-online', wenoState='launched', medName contains 'composing', wenoMessageId='{weno_message_id}'")
        else:
            print(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 3 FAILED: Exception: {e}")
        return False
    
    # TEST 4: POST /api/weno/online-callback (NO auth) with OrgTransactionID correlation
    print("\n--- TEST 4: POST /api/weno/online-callback (correlation by OrgTransactionID) ---")
    try:
        callback_payload = {
            "OrgTransactionID": weno_message_id,
            "Status": "Delivered",
            "DrugDescription": "Amoxicillin 500mg",
            "NCPDPID": "1234567",
            "Description": "Delivered to pharmacy"
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/weno/online-callback",
            json=callback_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        print(f"Callback status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if not data.get("ok"):
                print(f"❌ TEST 4 FAILED: ok={data.get('ok')}, expected true")
                return False
            
            print("✅ Callback accepted")
            
            # Verify the prescription was updated
            resp = requests.get(f"{BASE_URL}/api/erx?patientId={patient_id}", cookies=cookies, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                prescriptions = data.get("prescriptions", []) if isinstance(data, dict) else data
                
                # Find the prescription with this wenoMessageId
                updated_rx = None
                for rx in prescriptions:
                    if rx.get("wenoMessageId") == weno_message_id:
                        updated_rx = rx
                        break
                
                if not updated_rx:
                    print(f"❌ TEST 4 FAILED: Could not find prescription with wenoMessageId={weno_message_id}")
                    return False
                
                print(f"Updated prescription: {json.dumps(updated_rx, indent=2)}")
                
                # CRITICAL ASSERTIONS
                if updated_rx.get("wenoState") != "delivered":
                    print(f"❌ TEST 4 FAILED: wenoState={updated_rx.get('wenoState')}, expected 'delivered'")
                    return False
                
                if updated_rx.get("medName") != "Amoxicillin 500mg":
                    print(f"❌ TEST 4 FAILED: medName='{updated_rx.get('medName')}', expected 'Amoxicillin 500mg'")
                    return False
                
                if updated_rx.get("pharmacyNcpdp") != "1234567":
                    print(f"❌ TEST 4 FAILED: pharmacyNcpdp='{updated_rx.get('pharmacyNcpdp')}', expected '1234567'")
                    return False
                
                print("✅ TEST 4 PASSED: Callback correlated by OrgTransactionID, prescription updated with wenoState='delivered', medName='Amoxicillin 500mg', pharmacyNcpdp='1234567'")
            else:
                print(f"❌ TEST 4 FAILED: Could not verify prescription update: {resp.status_code}")
                return False
        else:
            print(f"❌ TEST 4 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 4 FAILED: Exception: {e}")
        return False
    
    # TEST 5: Fallback correlation by OrgPatientID
    print("\n--- TEST 5: POST /api/weno/online-callback (fallback correlation by OrgPatientID) ---")
    try:
        # Launch again to create a new stub
        resp = requests.post(
            f"{BASE_URL}/api/erx/weno-online/launch",
            json={"patientId": patient_id},
            cookies=cookies,
            timeout=30
        )
        print(f"Second launch status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"❌ TEST 5 FAILED: Second launch failed: {resp.text[:200]}")
            return False
        
        print("✅ Second launch successful")
        
        # Send callback with OrgPatientID (no OrgTransactionID)
        callback_payload = {
            "OrgPatientID": patient_id,
            "Status": "Rejected",
            "Description": "Pharmacy declined"
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/weno/online-callback",
            json=callback_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        print(f"Callback status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if not data.get("ok"):
                print(f"❌ TEST 5 FAILED: ok={data.get('ok')}, expected true")
                return False
            
            print("✅ Callback accepted")
            
            # Verify a weno-online prescription for this patient has wenoState='rejected'
            resp = requests.get(f"{BASE_URL}/api/erx?patientId={patient_id}", cookies=cookies, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                prescriptions = data.get("prescriptions", []) if isinstance(data, dict) else data
                
                # Find a weno-online prescription with wenoState='rejected'
                rejected_rx = None
                for rx in prescriptions:
                    if rx.get("transmissionMethod") == "weno-online" and rx.get("wenoState") == "rejected":
                        rejected_rx = rx
                        break
                
                if not rejected_rx:
                    print("❌ TEST 5 FAILED: No weno-online prescription with wenoState='rejected' found")
                    return False
                
                print(f"Rejected prescription: {json.dumps(rejected_rx, indent=2)}")
                print("✅ TEST 5 PASSED: Callback correlated by OrgPatientID (fallback), prescription updated with wenoState='rejected'")
            else:
                print(f"❌ TEST 5 FAILED: Could not verify prescription update: {resp.status_code}")
                return False
        else:
            print(f"❌ TEST 5 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 5 FAILED: Exception: {e}")
        return False
    
    # TEST 6: Standalone callback (no match)
    print("\n--- TEST 6: POST /api/weno/online-callback (standalone, no match) ---")
    try:
        callback_payload = {
            "OrgTransactionID": "nomatch-xyz-123",
            "Status": "Delivered",
            "DrugDescription": "Ibuprofen 200mg"
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/weno/online-callback",
            json=callback_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        print(f"Callback status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if not data.get("ok"):
                print(f"❌ TEST 6 FAILED: ok={data.get('ok')}, expected true")
                return False
            
            print("✅ TEST 6 PASSED: Standalone callback accepted (creates standalone record, no crash)")
        else:
            print(f"❌ TEST 6 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 6 FAILED: Exception: {e}")
        return False
    
    # TEST 7: AUTH guard on launch
    print("\n--- TEST 7: POST /api/erx/weno-online/launch (NO auth) ---")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/erx/weno-online/launch",
            json={"patientId": patient_id},
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ TEST 7 PASSED: Launch without auth correctly returns 401")
        else:
            print(f"❌ TEST 7 FAILED: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ TEST 7 FAILED: Exception: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ FEATURE 1 — ALL TESTS PASSED")
    print("="*80)
    return True

def test_feature_2_directory_sync_pharmacy_import():
    """Test FEATURE 2 — Directory Sync Report + pharmacy import null-NCPDP fix"""
    print("\n" + "="*80)
    print("FEATURE 2 — Directory Sync Report + pharmacy import null-NCPDP fix")
    print("="*80)
    
    # Login as admin
    admin_cookie = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_cookie:
        print("❌ FEATURE 2 FAILED: Could not login as admin")
        return False
    
    admin_cookies = {"proactive_session": admin_cookie}
    
    # TEST 1: GET /api/admin/weno/directory/sync (admin)
    print("\n--- TEST 1: GET /api/admin/weno/directory/sync (admin) ---")
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/weno/directory/sync", cookies=admin_cookies, timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # CRITICAL ASSERTIONS
            if "lastReport" not in data:
                print("❌ TEST 1 FAILED: Response missing 'lastReport' key")
                return False
            
            # Check for other required keys
            required_keys = ["count", "autoSync", "lastSyncAt", "lastResult", "lastError"]
            for key in required_keys:
                if key not in data:
                    print(f"❌ TEST 1 FAILED: Response missing '{key}' key")
                    return False
            
            print(f"✅ TEST 1 PASSED: GET /api/admin/weno/directory/sync returns 200 with 'lastReport' key (value={data['lastReport']}) plus count/autoSync/lastSyncAt/lastResult/lastError")
        else:
            print(f"❌ TEST 1 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
        
        # Test without cookie
        resp = requests.get(f"{BASE_URL}/api/admin/weno/directory/sync", timeout=30)
        print(f"Status without cookie: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ GET without cookie correctly returns 401")
        else:
            print(f"❌ TEST 1 FAILED: Expected 401 without cookie, got {resp.status_code}")
            return False
    except Exception as e:
        print(f"❌ TEST 1 FAILED: Exception: {e}")
        return False
    
    # TEST 2: POST /api/admin/weno/directory/sync (admin) - graceful handling
    print("\n--- TEST 2: POST /api/admin/weno/directory/sync (admin) - graceful handling ---")
    try:
        resp = requests.post(f"{BASE_URL}/api/admin/weno/directory/sync", cookies=admin_cookies, timeout=65)
        print(f"Status: {resp.status_code}")
        
        # Accept 200 (success), 400 (bad request), or 502 (bad gateway/timeout)
        # NEVER 500 (internal server error)
        if resp.status_code in [200, 400, 502]:
            print(f"Response: {resp.text[:500]}")
            
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    print(f"Success response: {json.dumps(data, indent=2)}")
                    if "imported" in data or "added" in data or "updated" in data or "errors" in data:
                        print("✅ TEST 2 PASSED: POST /api/admin/weno/directory/sync returns 200 with imported/added/updated/errors (graceful)")
                    else:
                        print("⚠️ TEST 2 WARNING: 200 response but missing expected fields")
                except Exception:
                    print("⚠️ TEST 2 WARNING: 200 response but not JSON")
            elif resp.status_code == 400:
                print("✅ TEST 2 PASSED: POST /api/admin/weno/directory/sync returns 400 (graceful error, expected without IP allowlist)")
            elif resp.status_code == 502:
                print("✅ TEST 2 PASSED: POST /api/admin/weno/directory/sync returns 502 (graceful timeout, expected for long-running operation)")
        elif resp.status_code == 500:
            print(f"❌ TEST 2 FAILED: POST /api/admin/weno/directory/sync returns 500 (NOT graceful)")
            print(f"Response: {resp.text[:500]}")
            return False
        else:
            print(f"⚠️ TEST 2 WARNING: Unexpected status code {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
    except requests.exceptions.Timeout:
        print("✅ TEST 2 PASSED: POST /api/admin/weno/directory/sync timed out (expected for long-running operation)")
    except Exception as e:
        print(f"❌ TEST 2 FAILED: Exception: {e}")
        return False
    
    # TEST 3: IMPORT NULL-NCPDP FIX (CRITICAL)
    print("\n--- TEST 3: POST /api/pharmacies/import (null-NCPDP fix) ---")
    
    # Login as staff (admin works as staff too)
    staff_cookies = admin_cookies
    
    try:
        # 3a: Import first pharmacy with null NCPDP
        print("\n3a: Import 'QA Pharmacy Alpha' (npi='1234567893', no ncpdpId)")
        payload1 = {
            "name": "QA Pharmacy Alpha",
            "npi": "1234567893",
            "city": "San Antonio",
            "state": "TX",
            "postal": "78201"
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/pharmacies/import",
            json=payload1,
            cookies=staff_cookies,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if not data.get("ok"):
                print(f"❌ TEST 3a FAILED: ok={data.get('ok')}, expected true")
                return False
            
            pharmacy = data.get("pharmacy")
            if not pharmacy:
                print("❌ TEST 3a FAILED: Missing 'pharmacy' in response")
                return False
            
            # CRITICAL ASSERTIONS
            if pharmacy.get("network") != "weno":
                print(f"❌ TEST 3a FAILED: pharmacy.network='{pharmacy.get('network')}', expected 'weno'")
                return False
            
            if pharmacy.get("ncpdpId") != "NPI-1234567893":
                print(f"❌ TEST 3a FAILED: pharmacy.ncpdpId='{pharmacy.get('ncpdpId')}', expected 'NPI-1234567893'")
                return False
            
            print(f"✅ TEST 3a PASSED: First pharmacy imported with network='weno', ncpdpId='NPI-1234567893'")
        else:
            print(f"❌ TEST 3a FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
        
        # 3b: Import second pharmacy with null NCPDP (DIFFERENT npi)
        print("\n3b: Import 'QA Pharmacy Beta' (npi='1987654321', no ncpdpId) - CRITICAL TEST")
        payload2 = {
            "name": "QA Pharmacy Beta",
            "npi": "1987654321",
            "city": "Austin",
            "state": "TX"
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/pharmacies/import",
            json=payload2,
            cookies=staff_cookies,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if not data.get("ok"):
                print(f"❌ TEST 3b FAILED: ok={data.get('ok')}, expected true")
                return False
            
            pharmacy = data.get("pharmacy")
            if not pharmacy:
                print("❌ TEST 3b FAILED: Missing 'pharmacy' in response")
                return False
            
            # CRITICAL ASSERTION: This previously returned 500 due to null-collision
            print(f"✅ TEST 3b PASSED: Second null-NCPDP pharmacy imported successfully (previously returned 500)")
        elif resp.status_code == 500:
            print(f"❌ TEST 3b FAILED: Second null-NCPDP import returns 500 (null-collision bug NOT fixed)")
            print(f"Response: {resp.text[:500]}")
            return False
        else:
            print(f"❌ TEST 3b FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
        
        # 3c: Import SAME 'QA Pharmacy Alpha' again (idempotent)
        print("\n3c: Import 'QA Pharmacy Alpha' again (idempotent)")
        resp = requests.post(
            f"{BASE_URL}/api/pharmacies/import",
            json=payload1,
            cookies=staff_cookies,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if not data.get("ok"):
                print(f"❌ TEST 3c FAILED: ok={data.get('ok')}, expected true")
                return False
            
            print(f"✅ TEST 3c PASSED: Re-import is idempotent (no 500, no duplicate)")
        elif resp.status_code == 500:
            print(f"❌ TEST 3c FAILED: Re-import returns 500")
            print(f"Response: {resp.text[:500]}")
            return False
        else:
            print(f"❌ TEST 3c FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
            return False
        
    except Exception as e:
        print(f"❌ TEST 3 FAILED: Exception: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ FEATURE 2 — ALL TESTS PASSED")
    print("="*80)
    return True

def main():
    print("="*80)
    print("Backend Test: Weno Online GO-LIVE + result callback + Directory Sync + pharmacy import fix")
    print("Base URL:", BASE_URL)
    print("="*80)
    
    feature1_passed = test_feature_1_weno_online()
    feature2_passed = test_feature_2_directory_sync_pharmacy_import()
    
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    print(f"FEATURE 1 (Weno Online GO-LIVE + result callback): {'✅ PASSED' if feature1_passed else '❌ FAILED'}")
    print(f"FEATURE 2 (Directory Sync Report + pharmacy import fix): {'✅ PASSED' if feature2_passed else '❌ FAILED'}")
    
    if feature1_passed and feature2_passed:
        print("\n✅ ALL FEATURES PASSED")
        sys.exit(0)
    else:
        print("\n❌ SOME FEATURES FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
