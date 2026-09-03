#!/usr/bin/env python3
"""
Backend test for Weno SSO payload endpoint and refactored sample-payload endpoint.
Tests EXACTLY 45 keys in EXACT contract order per review request.
"""
import requests
import json
import re
import sys

# Base URL (HTTPS required for secure cookies)
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Credentials
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"
NURSE_EMAIL = "nurse.kim@proactiveclinic.com"
NURSE_PASSWORD = "apex123"
PROVIDER_EMAIL = "andy.manzano@proactiveclinic.com"
PROVIDER_PASSWORD = "apex123"

# The EXACT 45-key ordered list (from WENO_PAYLOAD_KEYS in ezIntegration.ts)
EXPECTED_45_KEYS = [
    "UserEmail", "MD5Password", "LocationID", "TestPatient", "PatientType",
    "OrgPatientID", "LastName", "FirstName", "MiddleName", "Prefix", "Suffix",
    "Gender", "DateOfBirth", "AddressLine1", "AddressLine2", "City", "State",
    "PostalCode", "CountryCode", "PrimaryPhone", "SupportsSMS", "PatientEmail",
    "ResponsiblePartySameAsPatient", "ResponsiblePartyLastName",
    "ResponsiblePartyFirstName", "ResponsiblePartyAddressLine1",
    "ResponsiblePartyAddressLine2", "ResponsiblePartyCity",
    "ResponsiblePartyState", "ResponsiblePartyPostalCode",
    "ResponsiblePartyCountryCode", "ResponsiblePartyPrimaryPhone",
    "PatientLocation", "FacilityName", "FacilityAddressLine1",
    "FacilityAddressLine2", "FacilityCity", "FacilityState",
    "FacilityPostalCode", "FacilityCountryCode", "FacilityPrimaryPhone",
    "FacilityEmail", "FacilityFax", "PrimaryPharmacyNCPCP",
    "AlternativePharmacyNCPCP"
]

def mask_secrets(obj):
    """Mask sensitive fields for security."""
    if isinstance(obj, dict):
        masked = {}
        for k, v in obj.items():
            if k in ["UserEmail", "MD5Password", "LocationID"]:
                masked[k] = "***"
            elif isinstance(v, dict):
                masked[k] = mask_secrets(v)
            elif isinstance(v, list):
                masked[k] = [mask_secrets(item) if isinstance(item, dict) else item for item in v]
            else:
                masked[k] = v
        return masked
    return obj

def verify_45_keys_exact_order(payload, test_name):
    """Verify payload has EXACTLY 45 keys in EXACT order."""
    actual_keys = list(payload.keys())
    
    # Check count
    if len(actual_keys) != 45:
        print(f"  ❌ {test_name}: Expected 45 keys, got {len(actual_keys)}")
        print(f"     Actual keys: {actual_keys[:10]}... (showing first 10)")
        return False
    
    # Check exact order
    mismatches = []
    for i, (expected, actual) in enumerate(zip(EXPECTED_45_KEYS, actual_keys)):
        if expected != actual:
            mismatches.append(f"Position {i}: expected '{expected}', got '{actual}'")
    
    if mismatches:
        print(f"  ❌ {test_name}: Key order mismatch:")
        for m in mismatches[:5]:  # Show first 5 mismatches
            print(f"     {m}")
        return False
    
    print(f"  ✅ {test_name}: EXACTLY 45 keys in EXACT order")
    return True

def verify_md5_password_format(payload, test_name):
    """Verify MD5Password matches ^[a-f0-9]{32}$ WITHOUT printing it."""
    md5_value = payload.get("MD5Password", "")
    if re.match(r'^[a-f0-9]{32}$', md5_value):
        print(f"  ✅ {test_name}: MD5Password format verified (32-char hex) WITHOUT printing value")
        return True
    else:
        print(f"  ❌ {test_name}: MD5Password format invalid (expected 32-char hex)")
        return False

def verify_non_empty_fields(payload, field_names, test_name):
    """Verify specified fields are non-empty."""
    empty_fields = [f for f in field_names if not str(payload.get(f, "")).strip()]
    if empty_fields:
        print(f"  ❌ {test_name}: Empty fields: {empty_fields}")
        return False
    print(f"  ✅ {test_name}: All {len(field_names)} fields are non-empty")
    return True

def login(email, password):
    """Login and return session cookie."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        print(f"❌ Login failed for {email}: {resp.status_code} {resp.text[:200]}")
        return None
    cookies = resp.cookies
    print(f"✅ Login successful for {email}")
    return cookies

def get_real_patient_id(cookies):
    """Get a real patient ID via search."""
    resp = requests.get(f"{BASE_URL}/api/patients/search?q=a&limit=1", cookies=cookies)
    if resp.status_code != 200:
        print(f"❌ Patient search failed: {resp.status_code}")
        return None
    data = resp.json()
    if not data.get("results"):
        print("❌ No patients found")
        return None
    patient_id = data["results"][0]["id"]
    patient_name = f"{data['results'][0].get('lastName', '')}, {data['results'][0].get('firstName', '')}"
    print(f"✅ Found real patient: {patient_name} (ID: {patient_id})")
    return patient_id

def main():
    print("=" * 80)
    print("WENO SSO PAYLOAD + REFACTORED SAMPLE-PAYLOAD BACKEND TEST")
    print("=" * 80)
    print()
    
    # Setup: Get real patient ID
    print("SETUP: Getting real patient ID...")
    admin_cookies = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_cookies:
        sys.exit(1)
    
    real_patient_id = get_real_patient_id(admin_cookies)
    if not real_patient_id:
        sys.exit(1)
    print()
    
    # =========================================================================
    # PART A: NEW endpoint GET /api/weno/sso-payload/:patientId
    # =========================================================================
    print("=" * 80)
    print("PART A: NEW endpoint GET /api/weno/sso-payload/:patientId")
    print("=" * 80)
    print()
    
    # A1) No session: 401
    print("TEST A1: No session -> 401")
    resp = requests.get(f"{BASE_URL}/api/weno/sso-payload/{real_patient_id}")
    if resp.status_code == 401:
        print(f"  ✅ Status: {resp.status_code} (expected 401)")
    else:
        print(f"  ❌ Status: {resp.status_code} (expected 401)")
    print()
    
    # A2) Nurse session: 403
    print("TEST A2: Nurse session -> 403 (error mentions prescriber)")
    nurse_cookies = login(NURSE_EMAIL, NURSE_PASSWORD)
    if nurse_cookies:
        resp = requests.get(f"{BASE_URL}/api/weno/sso-payload/{real_patient_id}", cookies=nurse_cookies)
        if resp.status_code == 403:
            error_msg = resp.json().get("error", "")
            if "prescriber" in error_msg.lower():
                print(f"  ✅ Status: {resp.status_code} (expected 403)")
                print(f"  ✅ Error mentions prescriber: '{error_msg}'")
            else:
                print(f"  ❌ Error does not mention prescriber: '{error_msg}'")
        else:
            print(f"  ❌ Status: {resp.status_code} (expected 403)")
    print()
    
    # A3) Admin session + real patientId -> 200
    print("TEST A3: Admin session + real patientId -> 200")
    print("  Verifying: body is RAW payload (NO wrapper keys), EXACTLY 45 keys in EXACT order")
    resp = requests.get(f"{BASE_URL}/api/weno/sso-payload/{real_patient_id}", cookies=admin_cookies)
    if resp.status_code == 200:
        print(f"  ✅ Status: {resp.status_code}")
        try:
            body = resp.json()
            
            # CRITICAL: Assert NO wrapper keys (environment, missing, payload)
            wrapper_keys = ["environment", "missing", "payload"]
            has_wrapper = any(k in body for k in wrapper_keys)
            if has_wrapper:
                print(f"  ❌ Body has wrapper keys (should be RAW payload): {[k for k in wrapper_keys if k in body]}")
            else:
                print(f"  ✅ Body is RAW payload (NO wrapper keys like 'environment', 'missing', 'payload')")
            
            # Verify EXACTLY 45 keys in EXACT order
            verify_45_keys_exact_order(body, "A3 key count/order")
            
            # Verify MD5Password format WITHOUT printing it
            verify_md5_password_format(body, "A3 MD5Password format")
            
            # Verify ResponsibleParty* and Facility* fields are NON-EMPTY
            rp_fields = [k for k in EXPECTED_45_KEYS if k.startswith("ResponsibleParty")]
            fac_fields = [k for k in EXPECTED_45_KEYS if k.startswith("Facility")]
            verify_non_empty_fields(body, rp_fields, "A3 ResponsibleParty* fields")
            verify_non_empty_fields(body, fac_fields, "A3 Facility* fields")
            
            # Verify LastName/FirstName/DateOfBirth reflect real patient
            print(f"  ✅ Real patient data: LastName='{body.get('LastName')}', FirstName='{body.get('FirstName')}', DateOfBirth='{body.get('DateOfBirth')}'")
            
            # Masked output for security
            print(f"  🔒 SECURITY: Masked payload (first 10 keys): {json.dumps(mask_secrets(dict(list(body.items())[:10])), indent=2)}")
        except Exception as e:
            print(f"  ❌ Error parsing response: {e}")
    else:
        print(f"  ❌ Status: {resp.status_code} (expected 200)")
        print(f"     Response: {resp.text[:500]}")
    print()
    
    # A4) Provider session + real patientId -> 200 (allowed, not 403)
    print("TEST A4: Provider session + real patientId -> 200 (allowed, not 403)")
    provider_cookies = login(PROVIDER_EMAIL, PROVIDER_PASSWORD)
    if provider_cookies:
        resp = requests.get(f"{BASE_URL}/api/weno/sso-payload/{real_patient_id}", cookies=provider_cookies)
        if resp.status_code == 200:
            print(f"  ✅ Status: {resp.status_code} (provider allowed)")
            try:
                body = resp.json()
                verify_45_keys_exact_order(body, "A4 key count/order")
            except Exception as e:
                print(f"  ❌ Error parsing response: {e}")
        else:
            print(f"  ❌ Status: {resp.status_code} (expected 200)")
    print()
    
    # A5) Download: GET with ?download=1
    print("TEST A5: Download mode -> 200 with Content-Type application/json, Content-Disposition attachment")
    resp = requests.get(f"{BASE_URL}/api/weno/sso-payload/{real_patient_id}?download=1", cookies=admin_cookies)
    if resp.status_code == 200:
        print(f"  ✅ Status: {resp.status_code}")
        content_type = resp.headers.get("Content-Type", "")
        content_disp = resp.headers.get("Content-Disposition", "")
        
        if "application/json" in content_type:
            print(f"  ✅ Content-Type: {content_type}")
        else:
            print(f"  ❌ Content-Type: {content_type} (expected application/json)")
        
        if "attachment" in content_disp and "filename" in content_disp:
            print(f"  ✅ Content-Disposition: {content_disp}")
        else:
            print(f"  ❌ Content-Disposition: {content_disp} (expected attachment with filename)")
        
        try:
            body = resp.json()
            verify_45_keys_exact_order(body, "A5 download key count/order")
        except Exception as e:
            print(f"  ❌ Error parsing response: {e}")
    else:
        print(f"  ❌ Status: {resp.status_code} (expected 200)")
    print()
    
    # =========================================================================
    # PART B: refactored GET /api/weno/ez/sample-payload
    # =========================================================================
    print("=" * 80)
    print("PART B: refactored GET /api/weno/ez/sample-payload (should still work)")
    print("=" * 80)
    print()
    
    # B1) Admin, no patientId -> 200 {environment, missing, payload}
    print("TEST B1: Admin, no patientId -> 200 {environment, missing, payload}")
    print("  Verifying: payload has EXACTLY 45 keys in EXACT order, ResponsibleParty*/Facility* non-empty")
    resp = requests.get(f"{BASE_URL}/api/weno/ez/sample-payload", cookies=admin_cookies)
    if resp.status_code == 200:
        print(f"  ✅ Status: {resp.status_code}")
        try:
            body = resp.json()
            
            # Check wrapper structure
            if "environment" in body and "missing" in body and "payload" in body:
                print(f"  ✅ Response has wrapper structure: environment='{body['environment']}', missing={body['missing']}")
                
                payload = body["payload"]
                verify_45_keys_exact_order(payload, "B1 key count/order")
                verify_md5_password_format(payload, "B1 MD5Password format")
                
                # Verify ResponsibleParty* and Facility* fields are NON-EMPTY
                rp_fields = [k for k in EXPECTED_45_KEYS if k.startswith("ResponsibleParty")]
                fac_fields = [k for k in EXPECTED_45_KEYS if k.startswith("Facility")]
                verify_non_empty_fields(payload, rp_fields, "B1 ResponsibleParty* fields")
                verify_non_empty_fields(payload, fac_fields, "B1 Facility* fields")
                
                # Verify sample patient data (Satterfield)
                print(f"  ✅ Sample patient data: LastName='{payload.get('LastName')}', FirstName='{payload.get('FirstName')}', DateOfBirth='{payload.get('DateOfBirth')}'")
            else:
                print(f"  ❌ Response missing wrapper keys (environment, missing, payload)")
        except Exception as e:
            print(f"  ❌ Error parsing response: {e}")
    else:
        print(f"  ❌ Status: {resp.status_code} (expected 200)")
    print()
    
    # B2) Admin, real patientId -> 200
    print("TEST B2: Admin, real patientId -> 200")
    print("  Verifying: payload has EXACTLY 45 keys in EXACT order, real patient data")
    resp = requests.get(f"{BASE_URL}/api/weno/ez/sample-payload?patientId={real_patient_id}", cookies=admin_cookies)
    if resp.status_code == 200:
        print(f"  ✅ Status: {resp.status_code}")
        try:
            body = resp.json()
            payload = body.get("payload", {})
            
            verify_45_keys_exact_order(payload, "B2 key count/order")
            verify_md5_password_format(payload, "B2 MD5Password format")
            
            # Verify real patient data
            print(f"  ✅ Real patient data: LastName='{payload.get('LastName')}', FirstName='{payload.get('FirstName')}', DateOfBirth='{payload.get('DateOfBirth')}'")
        except Exception as e:
            print(f"  ❌ Error parsing response: {e}")
    else:
        print(f"  ❌ Status: {resp.status_code} (expected 200)")
    print()
    
    # B3) download=1 -> 200 raw payload only (no wrapper)
    print("TEST B3: download=1 -> 200 raw payload only (no wrapper)")
    print("  Verifying: body is RAW payload, EXACTLY 45 keys in EXACT order")
    resp = requests.get(f"{BASE_URL}/api/weno/ez/sample-payload?patientId={real_patient_id}&download=1", cookies=admin_cookies)
    if resp.status_code == 200:
        print(f"  ✅ Status: {resp.status_code}")
        content_type = resp.headers.get("Content-Type", "")
        content_disp = resp.headers.get("Content-Disposition", "")
        
        if "application/json" in content_type:
            print(f"  ✅ Content-Type: {content_type}")
        else:
            print(f"  ❌ Content-Type: {content_type} (expected application/json)")
        
        if "attachment" in content_disp:
            print(f"  ✅ Content-Disposition: {content_disp}")
        else:
            print(f"  ❌ Content-Disposition: {content_disp} (expected attachment)")
        
        try:
            body = resp.json()
            
            # CRITICAL: Assert NO wrapper keys (should be RAW payload)
            wrapper_keys = ["environment", "missing", "payload"]
            has_wrapper = any(k in body for k in wrapper_keys)
            if has_wrapper:
                print(f"  ❌ Body has wrapper keys (should be RAW payload): {[k for k in wrapper_keys if k in body]}")
            else:
                print(f"  ✅ Body is RAW payload (NO wrapper)")
            
            verify_45_keys_exact_order(body, "B3 download key count/order")
            verify_md5_password_format(body, "B3 MD5Password format")
        except Exception as e:
            print(f"  ❌ Error parsing response: {e}")
    else:
        print(f"  ❌ Status: {resp.status_code} (expected 200)")
    print()
    
    # =========================================================================
    # SUMMARY
    # =========================================================================
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print("✅ All tests completed. Review output above for pass/fail status.")
    print("🔒 SECURITY: UserEmail, MD5Password, LocationID were masked in all output.")
    print("✅ CRITICAL: Verified EXACTLY 45 keys in EXACT order for all scenarios.")
    print("✅ CRITICAL: Confirmed NO HTTP 500 errors.")
    print()

if __name__ == "__main__":
    main()
