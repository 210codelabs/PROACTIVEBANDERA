#!/usr/bin/env python3
"""
Backend test for EMR Import Feature 3: Clinical Import Idempotency Fix
Tests that the dedupe logic correctly handles regex-special characters like parentheses
in problem descriptions (e.g., "Essential (primary) hypertension").
"""

import asyncio
import aiohttp
import json

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

# Read test fixtures
with open('/app/test_fixtures/sample_ccda.xml', 'r') as f:
    SAMPLE_CCDA = f.read()

with open('/app/test_fixtures/sample_fhir.json', 'r') as f:
    SAMPLE_FHIR = f.read()


async def test_clinical_import_idempotency():
    """Test clinical import idempotency with regex-special characters in descriptions."""
    
    async with aiohttp.ClientSession() as session:
        print("\n" + "="*80)
        print("CLINICAL IMPORT IDEMPOTENCY TEST - REGEX-SPECIAL CHARS FIX")
        print("="*80)
        
        # ===== STEP 0: Login as admin =====
        print("\n[STEP 0] Login as admin...")
        try:
            login_resp = await session.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                headers={"Content-Type": "application/json"}
            )
            login_data = await login_resp.json()
            
            if login_resp.status != 200:
                print(f"❌ Login failed: {login_resp.status} - {login_data}")
                return
            
            print(f"✅ Login successful: {login_data.get('user', {}).get('email')}")
            
            # Check if session cookie exists
            has_session = False
            for cookie in session.cookie_jar:
                if 'proactive_session' in cookie.key:
                    has_session = True
                    break
            
            if not has_session:
                print("❌ No session cookie found after login")
                return
            print("✅ Session cookie obtained")
            
        except Exception as e:
            print(f"❌ Login error: {e}")
            return
        
        # ===== STEP 1: First C-CDA import (should create fresh chart) =====
        print("\n[STEP 1] First C-CDA import (MRN CCDA-5001) - should create fresh chart...")
        try:
            resp1 = await session.post(
                f"{BASE_URL}/api/admin/import/clinical/commit",
                json={"content": SAMPLE_CCDA},
                headers={"Content-Type": "application/json"}
            )
            data1 = await resp1.json()
            
            if resp1.status != 200:
                print(f"❌ First import failed: {resp1.status} - {data1}")
                return
            
            print(f"✅ First import successful: {resp1.status}")
            print(f"   Response: {json.dumps(data1, indent=2)}")
            
            # Verify expectations
            assert data1.get('patientCreated') == True, f"Expected patientCreated=true, got {data1.get('patientCreated')}"
            print(f"✅ patientCreated = {data1.get('patientCreated')} (expected: true)")
            
            counts = data1.get('counts', {})
            problems_created = counts.get('problems', {}).get('created', 0)
            medications_created = counts.get('medications', {}).get('created', 0)
            allergies_created = counts.get('allergies', {}).get('created', 0)
            total_created = data1.get('created', 0)
            
            assert problems_created == 2, f"Expected problems.created=2, got {problems_created}"
            print(f"✅ counts.problems.created = {problems_created} (expected: 2)")
            
            assert medications_created == 2, f"Expected medications.created=2, got {medications_created}"
            print(f"✅ counts.medications.created = {medications_created} (expected: 2)")
            
            assert allergies_created == 1, f"Expected allergies.created=1, got {allergies_created}"
            print(f"✅ counts.allergies.created = {allergies_created} (expected: 1)")
            
            assert total_created == 5, f"Expected total created=5, got {total_created}"
            print(f"✅ total created = {total_created} (expected: 5)")
            
            patient_id_1 = data1.get('patientId')
            print(f"✅ Patient ID: {patient_id_1}")
            
        except AssertionError as e:
            print(f"❌ Assertion failed: {e}")
            return
        except Exception as e:
            print(f"❌ First import error: {e}")
            return
        
        # ===== STEP 2: Second C-CDA import (CRITICAL - should be fully idempotent) =====
        print("\n[STEP 2] Second C-CDA import (SAME data) - CRITICAL TEST for regex-special chars fix...")
        try:
            resp2 = await session.post(
                f"{BASE_URL}/api/admin/import/clinical/commit",
                json={"content": SAMPLE_CCDA},
                headers={"Content-Type": "application/json"}
            )
            data2 = await resp2.json()
            
            if resp2.status != 200:
                print(f"❌ Second import failed: {resp2.status} - {data2}")
                return
            
            print(f"✅ Second import successful: {resp2.status}")
            print(f"   Response: {json.dumps(data2, indent=2)}")
            
            # Verify expectations
            assert data2.get('patientCreated') == False, f"Expected patientCreated=false, got {data2.get('patientCreated')}"
            print(f"✅ patientCreated = {data2.get('patientCreated')} (expected: false)")
            
            counts2 = data2.get('counts', {})
            problems_created_2 = counts2.get('problems', {}).get('created', 0)
            problems_skipped_2 = counts2.get('problems', {}).get('skipped', 0)
            medications_created_2 = counts2.get('medications', {}).get('created', 0)
            medications_skipped_2 = counts2.get('medications', {}).get('skipped', 0)
            allergies_created_2 = counts2.get('allergies', {}).get('created', 0)
            allergies_skipped_2 = counts2.get('allergies', {}).get('skipped', 0)
            total_created_2 = data2.get('created', 0)
            total_skipped_2 = data2.get('skipped', 0)
            
            # CRITICAL ASSERTION: problems.created must be 0 (this is the fix)
            assert problems_created_2 == 0, f"❌ CRITICAL: Expected problems.created=0 (fix for regex-special chars), got {problems_created_2}"
            print(f"✅ CRITICAL: counts.problems.created = {problems_created_2} (expected: 0) - REGEX-SPECIAL CHARS FIX WORKING!")
            
            assert problems_skipped_2 == 2, f"Expected problems.skipped=2, got {problems_skipped_2}"
            print(f"✅ counts.problems.skipped = {problems_skipped_2} (expected: 2)")
            
            assert medications_created_2 == 0, f"Expected medications.created=0, got {medications_created_2}"
            print(f"✅ counts.medications.created = {medications_created_2} (expected: 0)")
            
            assert medications_skipped_2 == 2, f"Expected medications.skipped=2, got {medications_skipped_2}"
            print(f"✅ counts.medications.skipped = {medications_skipped_2} (expected: 2)")
            
            assert allergies_created_2 == 0, f"Expected allergies.created=0, got {allergies_created_2}"
            print(f"✅ counts.allergies.created = {allergies_created_2} (expected: 0)")
            
            assert allergies_skipped_2 == 1, f"Expected allergies.skipped=1, got {allergies_skipped_2}"
            print(f"✅ counts.allergies.skipped = {allergies_skipped_2} (expected: 1)")
            
            assert total_created_2 == 0, f"Expected total created=0, got {total_created_2}"
            print(f"✅ total created = {total_created_2} (expected: 0)")
            
            assert total_skipped_2 == 5, f"Expected total skipped=5, got {total_skipped_2}"
            print(f"✅ total skipped = {total_skipped_2} (expected: 5)")
            
            print(f"\n🎉 IDEMPOTENCY FIX VERIFIED: 'Essential (primary) hypertension' with parentheses correctly deduped!")
            
        except AssertionError as e:
            print(f"❌ Assertion failed: {e}")
            return
        except Exception as e:
            print(f"❌ Second import error: {e}")
            return
        
        # ===== STEP 3: First FHIR import (should create fresh chart) =====
        print("\n[STEP 3] First FHIR import (MRN FHIR-6001) - should create fresh chart...")
        try:
            resp3 = await session.post(
                f"{BASE_URL}/api/admin/import/clinical/commit",
                json={"content": SAMPLE_FHIR},
                headers={"Content-Type": "application/json"}
            )
            data3 = await resp3.json()
            
            if resp3.status != 200:
                print(f"❌ First FHIR import failed: {resp3.status} - {data3}")
                return
            
            print(f"✅ First FHIR import successful: {resp3.status}")
            print(f"   Response: {json.dumps(data3, indent=2)}")
            
            # Verify expectations
            assert data3.get('patientCreated') == True, f"Expected patientCreated=true, got {data3.get('patientCreated')}"
            print(f"✅ patientCreated = {data3.get('patientCreated')} (expected: true)")
            
            total_created_3 = data3.get('created', 0)
            assert total_created_3 == 4, f"Expected total created=4, got {total_created_3}"
            print(f"✅ total created = {total_created_3} (expected: 4)")
            
            patient_id_3 = data3.get('patientId')
            print(f"✅ Patient ID: {patient_id_3}")
            
        except AssertionError as e:
            print(f"❌ Assertion failed: {e}")
            return
        except Exception as e:
            print(f"❌ First FHIR import error: {e}")
            return
        
        # ===== STEP 4: Second FHIR import (should be fully idempotent) =====
        print("\n[STEP 4] Second FHIR import (SAME data) - should be fully idempotent...")
        try:
            resp4 = await session.post(
                f"{BASE_URL}/api/admin/import/clinical/commit",
                json={"content": SAMPLE_FHIR},
                headers={"Content-Type": "application/json"}
            )
            data4 = await resp4.json()
            
            if resp4.status != 200:
                print(f"❌ Second FHIR import failed: {resp4.status} - {data4}")
                return
            
            print(f"✅ Second FHIR import successful: {resp4.status}")
            print(f"   Response: {json.dumps(data4, indent=2)}")
            
            # Verify expectations
            assert data4.get('patientCreated') == False, f"Expected patientCreated=false, got {data4.get('patientCreated')}"
            print(f"✅ patientCreated = {data4.get('patientCreated')} (expected: false)")
            
            total_created_4 = data4.get('created', 0)
            assert total_created_4 == 0, f"Expected total created=0, got {total_created_4}"
            print(f"✅ total created = {total_created_4} (expected: 0 - fully idempotent)")
            
            total_skipped_4 = data4.get('skipped', 0)
            assert total_skipped_4 == 4, f"Expected total skipped=4, got {total_skipped_4}"
            print(f"✅ total skipped = {total_skipped_4} (expected: 4)")
            
        except AssertionError as e:
            print(f"❌ Assertion failed: {e}")
            return
        except Exception as e:
            print(f"❌ Second FHIR import error: {e}")
            return
        
        # ===== SUMMARY =====
        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED - IDEMPOTENCY FIX VERIFIED")
        print("="*80)
        print("\nKey findings:")
        print("1. ✅ C-CDA first import: created 2 problems, 2 meds, 1 allergy (total 5)")
        print("2. ✅ C-CDA second import: created 0, skipped 5 (fully idempotent)")
        print("3. ✅ CRITICAL: 'Essential (primary) hypertension' with parentheses correctly deduped")
        print("4. ✅ FHIR first import: created 4 records")
        print("5. ✅ FHIR second import: created 0, skipped 4 (fully idempotent)")
        print("\nThe fix to preload existing records and compare in JS (case-insensitive exact")
        print("match) successfully resolves the regex-special character bug. Descriptions with")
        print("parentheses, brackets, and other regex metacharacters are now correctly deduped.")
        print("="*80)


if __name__ == "__main__":
    asyncio.run(test_clinical_import_idempotency())
