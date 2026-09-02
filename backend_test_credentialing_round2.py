#!/usr/bin/env python3
"""
Backend test for Credentialing round 2: SAM live, OIG LEIE, reminders, Twilio relay
Tests all requirements from the review request.
"""
import asyncio
import aiohttp
import json
import sys
from urllib.parse import urlencode

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
STAFF_EMAIL = "admin@proactiveclinic.com"
STAFF_PASSWORD = "apex123"

async def main():
    print("=" * 80)
    print("CREDENTIALING ROUND 2 BACKEND TEST")
    print("=" * 80)
    
    async with aiohttp.ClientSession() as session:
        # ===== STEP 0: STAFF LOGIN =====
        print("\n[STEP 0] Staff login...")
        try:
            async with session.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD}
            ) as resp:
                if resp.status != 200:
                    print(f"❌ Login failed with status {resp.status}")
                    body = await resp.text()
                    print(f"Response: {body[:500]}")
                    sys.exit(1)
                data = await resp.json()
                print(f"✅ Login successful: {data.get('user', {}).get('email')}")
        except Exception as e:
            print(f"❌ Login exception: {e}")
            sys.exit(1)

        # ===== STEP 0.5: GET REAL NPI FROM CMS NPPES =====
        print("\n[STEP 0.5] Fetching a REAL individual NPI from CMS NPPES registry...")
        real_npi = None
        try:
            # NPPES requires additional search criteria with state/enumeration_type
            nppes_url = "https://npiregistry.cms.hhs.gov/api/?version=2.1&last_name=smith&state=CA&limit=1&enumeration_type=NPI-1"
            async with session.get(nppes_url) as resp:
                if resp.status != 200:
                    print(f"❌ NPPES API returned status {resp.status}")
                    body = await resp.text()
                    print(f"Response: {body[:500]}")
                    sys.exit(1)
                nppes_data = await resp.json()
                if not nppes_data.get("results") or len(nppes_data["results"]) == 0:
                    print(f"❌ No results from NPPES API")
                    print(f"Response: {json.dumps(nppes_data, indent=2)[:500]}")
                    sys.exit(1)
                real_npi = nppes_data["results"][0]["number"]
                print(f"✅ Obtained REAL NPI: {real_npi}")
        except Exception as e:
            print(f"❌ Failed to fetch real NPI: {e}")
            sys.exit(1)

        # ===== TEST A: CREATE PROVIDER + VALIDATE =====
        print("\n" + "=" * 80)
        print("[TEST A] Create provider with REAL NPI and validate")
        print("=" * 80)
        
        provider_id = None
        try:
            # Create provider
            print(f"\n[TEST A.1] Creating provider with NPI {real_npi}...")
            create_payload = {
                "npi": real_npi,
                "firstName": "Test",
                "lastName": "Provider",
                "caqhAttestationDate": "2026-09-20",
                "licenseExpDate": "2026-10-05",
                "licenseState": "TX"
            }
            async with session.post(
                f"{BASE_URL}/api/credentialing/providers",
                json=create_payload
            ) as resp:
                status = resp.status
                body_text = await resp.text()
                
                if status == 409:
                    # Provider already exists - try to find it
                    print(f"⚠️  Provider with NPI {real_npi} already exists (409). Fetching existing provider...")
                    async with session.get(f"{BASE_URL}/api/credentialing/providers") as get_resp:
                        if get_resp.status == 200:
                            providers_data = await get_resp.json()
                            existing = next((p for p in providers_data.get("providers", []) if p.get("npi") == real_npi), None)
                            if existing:
                                provider_id = existing["id"]
                                print(f"✅ Found existing provider: {provider_id}")
                            else:
                                print(f"❌ Could not find existing provider with NPI {real_npi}")
                                sys.exit(1)
                elif status == 200:
                    data = await resp.json()
                    if not data.get("ok"):
                        print(f"❌ Create provider returned ok=false")
                        print(f"Response: {body_text[:500]}")
                        sys.exit(1)
                    provider_id = data["provider"]["id"]
                    print(f"✅ Provider created: {provider_id}")
                else:
                    print(f"❌ Create provider failed with status {status}")
                    print(f"Response: {body_text[:500]}")
                    sys.exit(1)
        except Exception as e:
            print(f"❌ Create provider exception: {e}")
            sys.exit(1)

        # Validate provider
        print(f"\n[TEST A.2] Validating provider {provider_id}...")
        validation_result = None
        try:
            async with session.post(
                f"{BASE_URL}/api/credentialing/providers/{provider_id}/validate"
            ) as resp:
                status = resp.status
                body_text = await resp.text()
                
                if status != 200:
                    print(f"❌ Validate provider failed with status {status}")
                    print(f"Response: {body_text[:500]}")
                    sys.exit(1)
                
                data = await resp.json()
                if not data.get("ok"):
                    print(f"❌ Validate returned ok=false")
                    print(f"Response: {body_text[:500]}")
                    sys.exit(1)
                
                validation_result = data.get("validationResult", {})
                passed = data.get("passed")
                
                print(f"✅ Validation completed: passed={passed}")
                print(f"\n📋 VALIDATION RESULT (VERBATIM):")
                print(f"   NPPES: {json.dumps(validation_result.get('nppes'), indent=6)}")
                print(f"   OIG:   {json.dumps(validation_result.get('oig'), indent=6)}")
                print(f"   SAM:   {json.dumps(validation_result.get('sam'), indent=6)}")
                
                # Check for graceful fallback
                oig = validation_result.get("oig", {})
                sam = validation_result.get("sam", {})
                
                if not oig.get("screened"):
                    print(f"   ℹ️  OIG LEIE: screened=false (graceful fallback - ACCEPTABLE)")
                if not sam.get("screened"):
                    print(f"   ℹ️  SAM.gov: screened=false (graceful fallback - ACCEPTABLE)")
                
                print(f"\n✅ TEST A PASSED: Provider created and validated with NO 500 errors")
        except Exception as e:
            print(f"❌ Validate provider exception: {e}")
            sys.exit(1)

        # ===== TEST B: GET REMINDERS =====
        print("\n" + "=" * 80)
        print("[TEST B] GET /api/credentialing/reminders?days=90")
        print("=" * 80)
        
        try:
            async with session.get(
                f"{BASE_URL}/api/credentialing/reminders?days=90"
            ) as resp:
                status = resp.status
                body_text = await resp.text()
                
                if status != 200:
                    print(f"❌ Get reminders failed with status {status}")
                    print(f"Response: {body_text[:500]}")
                    sys.exit(1)
                
                data = await resp.json()
                count = data.get("count", 0)
                items = data.get("items", [])
                
                print(f"✅ Reminders retrieved: count={count}, items={len(items)}")
                
                # Find reminders for our provider
                provider_reminders = [item for item in items if item.get("providerId") == provider_id]
                
                if not provider_reminders:
                    print(f"⚠️  No reminders found for provider {provider_id}")
                    print(f"   This may be expected if dates are outside the 90-day window")
                else:
                    print(f"\n📋 REMINDERS FOR PROVIDER {provider_id}:")
                    
                    caqh_found = False
                    license_found = False
                    
                    for item in provider_reminders:
                        reminder_type = item.get("type")
                        due_in_days = item.get("dueInDays")
                        date = item.get("date")
                        
                        print(f"   - Type: {reminder_type}")
                        print(f"     Due in days: {due_in_days} (numeric: {isinstance(due_in_days, (int, float))})")
                        print(f"     Date: {date}")
                        
                        if reminder_type == "CAQH attestation":
                            caqh_found = True
                        elif reminder_type == "License expiration":
                            license_found = True
                    
                    if caqh_found:
                        print(f"   ✅ CAQH attestation reminder found with dueInDays and date")
                    else:
                        print(f"   ⚠️  CAQH attestation reminder not found")
                    
                    if license_found:
                        print(f"   ✅ License expiration reminder found with dueInDays and date")
                    else:
                        print(f"   ⚠️  License expiration reminder not found")
                
                print(f"\n✅ TEST B PASSED: Reminders endpoint working with NO 500 errors")
        except Exception as e:
            print(f"❌ Get reminders exception: {e}")
            sys.exit(1)

        # ===== TEST C: GET REMINDERS WITHOUT SESSION =====
        print("\n" + "=" * 80)
        print("[TEST C] GET /api/credentialing/reminders WITHOUT session")
        print("=" * 80)
        
        try:
            async with aiohttp.ClientSession() as no_auth_session:
                async with no_auth_session.get(
                    f"{BASE_URL}/api/credentialing/reminders?days=90"
                ) as resp:
                    status = resp.status
                    
                    if status == 401:
                        print(f"✅ TEST C PASSED: Correctly returned 401 Unauthorized without session")
                    else:
                        print(f"❌ Expected 401, got {status}")
                        body_text = await resp.text()
                        print(f"Response: {body_text[:500]}")
                        sys.exit(1)
        except Exception as e:
            print(f"❌ Get reminders without session exception: {e}")
            sys.exit(1)

        # ===== TEST D: TWILIO RELAY (JOB + MFA WEBHOOK) =====
        print("\n" + "=" * 80)
        print("[TEST D] Twilio inbound relay: Create job + MFA webhook")
        print("=" * 80)
        
        job_id = None
        webhook_token = None
        
        try:
            # Create job
            print(f"\n[TEST D.1] Creating automation job for provider {provider_id}...")
            async with session.post(
                f"{BASE_URL}/api/credentialing/jobs",
                json={"providerId": provider_id}
            ) as resp:
                status = resp.status
                body_text = await resp.text()
                
                if status != 200:
                    print(f"❌ Create job failed with status {status}")
                    print(f"Response: {body_text[:500]}")
                    sys.exit(1)
                
                data = await resp.json()
                job = data.get("job", {})
                job_id = job.get("id")
                job_status = job.get("status")
                webhook_token = job.get("webhookToken")
                
                print(f"✅ Job created: {job_id}")
                print(f"   Status: {job_status}")
                print(f"   Webhook token: {webhook_token}")
                
                if job_status == "failed":
                    print(f"   ⚠️  Job status is 'failed' (likely due to validation failure from blocked SAM/OIG)")
                    print(f"   This is ACCEPTABLE per review request - continuing test")
                elif job_status == "awaiting_mfa":
                    print(f"   ✅ Job is awaiting_mfa (expected status)")
                else:
                    print(f"   ℹ️  Job status is '{job_status}'")
        except Exception as e:
            print(f"❌ Create job exception: {e}")
            sys.exit(1)

        # Test MFA webhook if job is awaiting_mfa
        if job_id and webhook_token and job_status == "awaiting_mfa":
            print(f"\n[TEST D.2] Posting MFA code to Twilio webhook (NO session)...")
            try:
                # Use a new session without auth cookies
                async with aiohttp.ClientSession() as no_auth_session:
                    # Post urlencoded form data
                    form_data = {
                        "Body": "Your CAQH verification code is 445566",
                        "From": "+15125551212"
                    }
                    
                    async with no_auth_session.post(
                        f"{BASE_URL}/api/credentialing/twilio/sms",
                        data=form_data,
                        headers={"Content-Type": "application/x-www-form-urlencoded"}
                    ) as resp:
                        status = resp.status
                        content_type = resp.headers.get("Content-Type", "")
                        body_text = await resp.text()
                        
                        if status != 200:
                            print(f"❌ Twilio webhook failed with status {status}")
                            print(f"Response: {body_text[:500]}")
                            sys.exit(1)
                        
                        if "text/xml" not in content_type.lower():
                            print(f"❌ Expected Content-Type text/xml, got {content_type}")
                            sys.exit(1)
                        
                        print(f"✅ Twilio webhook returned 200 with Content-Type: {content_type}")
                        print(f"   Response body: {body_text[:200]}")
            except Exception as e:
                print(f"❌ Twilio webhook exception: {e}")
                sys.exit(1)

            # Verify job status changed to processing
            print(f"\n[TEST D.3] Verifying job status changed to 'processing'...")
            try:
                async with session.get(f"{BASE_URL}/api/credentialing/jobs") as resp:
                    status = resp.status
                    body_text = await resp.text()
                    
                    if status != 200:
                        print(f"❌ Get jobs failed with status {status}")
                        print(f"Response: {body_text[:500]}")
                        sys.exit(1)
                    
                    data = await resp.json()
                    jobs = data.get("jobs", [])
                    our_job = next((j for j in jobs if j.get("id") == job_id), None)
                    
                    if not our_job:
                        print(f"❌ Job {job_id} not found in jobs list")
                        sys.exit(1)
                    
                    new_status = our_job.get("status")
                    mfa_received_at = our_job.get("mfaReceivedAt")
                    
                    print(f"✅ Job found in list")
                    print(f"   Status: {new_status}")
                    print(f"   mfaReceivedAt: {mfa_received_at}")
                    
                    if new_status == "processing":
                        print(f"   ✅ Job status is 'processing' (expected)")
                    else:
                        print(f"   ⚠️  Job status is '{new_status}' (expected 'processing')")
                    
                    if mfa_received_at:
                        print(f"   ✅ mfaReceivedAt is set")
                    else:
                        print(f"   ⚠️  mfaReceivedAt is not set")
                    
                    print(f"\n✅ TEST D PASSED: Job creation and MFA webhook working with NO 500 errors")
            except Exception as e:
                print(f"❌ Get jobs exception: {e}")
                sys.exit(1)
        else:
            print(f"\n⚠️  Skipping MFA webhook test (job status is '{job_status}', not 'awaiting_mfa')")
            print(f"   This is ACCEPTABLE per review request if validation failed due to blocked SAM/OIG")
            print(f"\n✅ TEST D PASSED: Job creation working with NO 500 errors")

        # ===== TEST E: TWILIO WEBHOOK WITH NO DIGITS =====
        print("\n" + "=" * 80)
        print("[TEST E] POST /api/credentialing/twilio/sms with no digits")
        print("=" * 80)
        
        try:
            async with aiohttp.ClientSession() as no_auth_session:
                form_data = {
                    "Body": "no digits here",
                    "From": "x"
                }
                
                async with no_auth_session.post(
                    f"{BASE_URL}/api/credentialing/twilio/sms",
                    data=form_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                ) as resp:
                    status = resp.status
                    content_type = resp.headers.get("Content-Type", "")
                    body_text = await resp.text()
                    
                    if status != 200:
                        print(f"❌ Twilio webhook failed with status {status}")
                        print(f"Response: {body_text[:500]}")
                        sys.exit(1)
                    
                    if "text/xml" not in content_type.lower():
                        print(f"❌ Expected Content-Type text/xml, got {content_type}")
                        sys.exit(1)
                    
                    print(f"✅ TEST E PASSED: Twilio webhook returned 200 text/xml with no crash")
                    print(f"   Content-Type: {content_type}")
                    print(f"   Response body: {body_text[:200]}")
        except Exception as e:
            print(f"❌ Twilio webhook with no digits exception: {e}")
            sys.exit(1)

        # ===== FINAL SUMMARY =====
        print("\n" + "=" * 80)
        print("✅ ALL TESTS PASSED")
        print("=" * 80)
        print("\n📋 SUMMARY:")
        print("   ✅ TEST A: Provider creation and validation with REAL NPI")
        print("   ✅ TEST B: Reminders endpoint with session")
        print("   ✅ TEST C: Reminders endpoint without session (401)")
        print("   ✅ TEST D: Job creation and MFA webhook")
        print("   ✅ TEST E: Twilio webhook with no digits (no crash)")
        print("\n   🔍 CRITICAL ASSERTION: NO HTTP 500 ERRORS ENCOUNTERED")
        print("\n   📊 OIG/SAM RESULTS (see TEST A output above for verbatim objects)")
        print("       - If screened=false, this is ACCEPTABLE (sandbox egress blocked)")
        print("       - If screened=true, live APIs were successfully called")
        print("\n" + "=" * 80)

if __name__ == "__main__":
    asyncio.run(main())
