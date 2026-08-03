#!/usr/bin/env python3
"""
Backend test for Iteration 20: Segregated Clinical vs Personal Injury intake tracks
Tests the 7-form intake system with track field, PDF generation, and auto-attach functionality.
"""

import asyncio
import aiohttp
import random
import string
import re

BASE_URL = "http://localhost:3000"

def random_suffix():
    """Generate random suffix for test data"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

async def test_iteration20():
    """Test all 5 scenarios for Iteration 20"""
    
    async with aiohttp.ClientSession() as session:
        print("\n" + "="*80)
        print("ITERATION 20 BACKEND TEST: Segregated Clinical vs Personal Injury Intake")
        print("="*80)
        
        # =====================================================================
        # TEST 1: GET /api/intake/forms - verify structure and counts
        # =====================================================================
        print("\n[TEST 1] GET /api/intake/forms - verify 7 forms with track field")
        print("-" * 80)
        
        try:
            async with session.get(f"{BASE_URL}/api/intake/forms") as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"Status: {status}")
                
                if status != 200:
                    print(f"❌ FAIL: Expected 200, got {status}")
                    print(f"Response: {data}")
                    return
                
                forms = data.get("forms", [])
                print(f"✅ PASS: Status 200")
                print(f"Total forms returned: {len(forms)}")
                
                # Assert exactly 7 forms
                if len(forms) != 7:
                    print(f"❌ FAIL: Expected exactly 7 forms, got {len(forms)}")
                    return
                print(f"✅ PASS: Exactly 7 forms")
                
                # Assert every item has a "track" field
                forms_without_track = [f for f in forms if "track" not in f]
                if forms_without_track:
                    print(f"❌ FAIL: {len(forms_without_track)} forms missing 'track' field")
                    print(f"Forms without track: {forms_without_track}")
                    return
                print(f"✅ PASS: All forms have 'track' field")
                
                # Count online:true forms
                online_forms = [f for f in forms if f.get("online") == True]
                print(f"Online forms count: {len(online_forms)}")
                if len(online_forms) != 4:
                    print(f"❌ FAIL: Expected 4 online forms, got {len(online_forms)}")
                    return
                print(f"✅ PASS: Exactly 4 online forms")
                
                # Check tracks present
                tracks = set(f.get("track") for f in forms)
                expected_tracks = {"clinical", "personal-injury", "documentation"}
                if tracks != expected_tracks:
                    print(f"❌ FAIL: Expected tracks {expected_tracks}, got {tracks}")
                    return
                print(f"✅ PASS: Tracks include clinical, personal-injury, and documentation")
                print(f"Tracks found: {tracks}")
                
                # Verify specific online slugs
                online_slugs = [f.get("slug") for f in online_forms]
                print(f"Online form slugs: {online_slugs}")
                
                # Clinical online slugs
                clinical_online = [f for f in online_forms if f.get("track") == "clinical"]
                clinical_slugs = [f.get("slug") for f in clinical_online]
                expected_clinical = ["clinical-new-patient", "clinical-checkin"]
                if set(clinical_slugs) != set(expected_clinical):
                    print(f"❌ FAIL: Expected clinical online slugs {expected_clinical}, got {clinical_slugs}")
                    return
                print(f"✅ PASS: Clinical online slugs: {clinical_slugs}")
                
                # PI online slugs
                pi_online = [f for f in online_forms if f.get("track") == "personal-injury"]
                pi_slugs = [f.get("slug") for f in pi_online]
                expected_pi = ["new-patient-intake", "current-patient-checkin"]
                if set(pi_slugs) != set(expected_pi):
                    print(f"❌ FAIL: Expected PI online slugs {expected_pi}, got {pi_slugs}")
                    return
                print(f"✅ PASS: PI online slugs: {pi_slugs}")
                
                print("\n✅ TEST 1 PASSED: All form structure assertions verified")
                
        except Exception as e:
            print(f"❌ FAIL: Exception in TEST 1: {e}")
            import traceback
            traceback.print_exc()
            return
        
        # =====================================================================
        # TEST 2: PDF endpoints - verify Content-Type and %PDF header
        # =====================================================================
        print("\n[TEST 2] PDF endpoints - verify application/pdf and %PDF header")
        print("-" * 80)
        
        pdf_slugs = ["clinical-new-patient", "clinical-checkin", "new-patient-intake"]
        
        for slug in pdf_slugs:
            try:
                print(f"\nTesting PDF for slug: {slug}")
                async with session.get(f"{BASE_URL}/api/intake/forms/{slug}/pdf") as resp:
                    status = resp.status
                    content_type = resp.headers.get("Content-Type", "")
                    body = await resp.read()
                    
                    print(f"  Status: {status}")
                    print(f"  Content-Type: {content_type}")
                    print(f"  Body length: {len(body)} bytes")
                    
                    if status != 200:
                        print(f"  ❌ FAIL: Expected 200, got {status}")
                        return
                    
                    if "application/pdf" not in content_type:
                        print(f"  ❌ FAIL: Expected Content-Type 'application/pdf', got '{content_type}'")
                        return
                    
                    # Check for %PDF header
                    if not body.startswith(b"%PDF"):
                        print(f"  ❌ FAIL: PDF body does not start with '%PDF'")
                        print(f"  First 20 bytes: {body[:20]}")
                        return
                    
                    print(f"  ✅ PASS: {slug} PDF endpoint working correctly")
                    
            except Exception as e:
                print(f"  ❌ FAIL: Exception testing {slug} PDF: {e}")
                import traceback
                traceback.print_exc()
                return
        
        print("\n✅ TEST 2 PASSED: All PDF endpoints working correctly")
        
        # =====================================================================
        # TEST 3: Submit clinical-new-patient + auto-attach verification
        # =====================================================================
        print("\n[TEST 3] Submit clinical-new-patient with auto-attach verification")
        print("-" * 80)
        
        # First, get staff session cookie
        print("\nObtaining staff session cookie...")
        staff_cookie = None
        try:
            async with session.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": "andy.manzano@proactiveclinic.com", "password": "apex123"}
            ) as resp:
                status = resp.status
                data = await resp.json()
                print(f"Staff login status: {status}")
                
                if status != 200:
                    print(f"❌ FAIL: Staff login failed with status {status}")
                    print(f"Response: {data}")
                    return
                
                # Extract cookie
                cookies = resp.cookies
                if "proactive_session" in cookies:
                    staff_cookie = cookies["proactive_session"].value
                    print(f"✅ Staff session cookie obtained")
                else:
                    print(f"❌ FAIL: No proactive_session cookie in response")
                    return
                    
        except Exception as e:
            print(f"❌ FAIL: Exception during staff login: {e}")
            import traceback
            traceback.print_exc()
            return
        
        # Submit clinical-new-patient form
        print("\nSubmitting clinical-new-patient form...")
        random_last = f"Test{random_suffix()}"
        
        submission_payload = {
            "slug": "clinical-new-patient",
            "values": {
                "firstName": "Clin",
                "lastName": random_last,
                "dob": "1992-06-06",
                "signature": "Clin Test",
                "allergies": "Sulfa",
                "conditions": "Asthma",
                "currentMedications": "Albuterol"
            }
        }
        
        try:
            async with session.post(
                f"{BASE_URL}/api/intake/submit",
                json=submission_payload
            ) as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"Submit status: {status}")
                print(f"Response: {data}")
                
                if status != 200:
                    print(f"❌ FAIL: Expected 200, got {status}")
                    return
                
                confirmation = data.get("confirmation", "")
                mrn = data.get("mrn", "")
                
                # Verify confirmation format: ^PC-[A-Z0-9]{6}$
                if not re.match(r"^PC-[A-Z0-9]{6}$", confirmation):
                    print(f"❌ FAIL: Confirmation '{confirmation}' does not match pattern ^PC-[A-Z0-9]{{6}}$")
                    return
                print(f"✅ PASS: Confirmation format correct: {confirmation}")
                
                # Verify MRN format: ^PC-\d{6}$
                if not re.match(r"^PC-\d{6}$", mrn):
                    print(f"❌ FAIL: MRN '{mrn}' does not match pattern ^PC-\\d{{6}}$")
                    return
                print(f"✅ PASS: MRN format correct: {mrn}")
                
        except Exception as e:
            print(f"❌ FAIL: Exception during submission: {e}")
            import traceback
            traceback.print_exc()
            return
        
        # Get submissions and find the one we just created
        print("\nFetching pending submissions to find our submission...")
        submission_id = None
        
        try:
            async with session.get(
                f"{BASE_URL}/api/intake/submissions?status=pending",
                cookies={"proactive_session": staff_cookie}
            ) as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"Get submissions status: {status}")
                
                if status != 200:
                    print(f"❌ FAIL: Expected 200, got {status}")
                    print(f"Response: {data}")
                    return
                
                submissions = data.get("submissions", [])
                print(f"Found {len(submissions)} pending submissions")
                
                # Find our submission by patientName starting with "Clin Test"
                for sub in submissions:
                    patient_name = sub.get("patientName", "")
                    if patient_name.startswith(f"Clin {random_last}"):
                        submission_id = sub.get("id")
                        print(f"✅ Found our submission: ID={submission_id}, Patient={patient_name}")
                        break
                
                if not submission_id:
                    print(f"❌ FAIL: Could not find submission for patient 'Clin {random_last}'")
                    print(f"Available submissions: {[s.get('patientName') for s in submissions]}")
                    return
                    
        except Exception as e:
            print(f"❌ FAIL: Exception fetching submissions: {e}")
            import traceback
            traceback.print_exc()
            return
        
        # Approve the submission and verify auto-attach
        print(f"\nApproving submission {submission_id}...")
        
        try:
            async with session.post(
                f"{BASE_URL}/api/intake/submissions/{submission_id}/review",
                json={"action": "approve"},
                cookies={"proactive_session": staff_cookie}
            ) as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"Approve status: {status}")
                print(f"Response: {data}")
                
                if status != 200:
                    print(f"❌ FAIL: Expected 200, got {status}")
                    return
                
                attached = data.get("attached")
                if not attached:
                    print(f"❌ FAIL: No 'attached' object in response")
                    return
                
                print(f"✅ PASS: Attached object present: {attached}")
                
                # Verify counts >= 1
                problems = attached.get("problems", 0)
                allergies = attached.get("allergies", 0)
                medications = attached.get("medications", 0)
                
                print(f"  Problems attached: {problems}")
                print(f"  Allergies attached: {allergies}")
                print(f"  Medications attached: {medications}")
                
                if problems < 1:
                    print(f"❌ FAIL: Expected problems >= 1, got {problems}")
                    return
                print(f"✅ PASS: Problems >= 1")
                
                if allergies < 1:
                    print(f"❌ FAIL: Expected allergies >= 1, got {allergies}")
                    return
                print(f"✅ PASS: Allergies >= 1")
                
                if medications < 1:
                    print(f"❌ FAIL: Expected medications >= 1, got {medications}")
                    return
                print(f"✅ PASS: Medications >= 1")
                
        except Exception as e:
            print(f"❌ FAIL: Exception during approval: {e}")
            import traceback
            traceback.print_exc()
            return
        
        print("\n✅ TEST 3 PASSED: Clinical new patient submission and auto-attach working correctly")
        
        # =====================================================================
        # TEST 4: Submit clinical-checkin
        # =====================================================================
        print("\n[TEST 4] Submit clinical-checkin")
        print("-" * 80)
        
        random_last2 = f"Test{random_suffix()}"
        
        checkin_payload = {
            "slug": "clinical-checkin",
            "values": {
                "firstName": "Clin",
                "lastName": random_last2,
                "dob": "1992-06-06",
                "signature": "Clin Test"
            }
        }
        
        try:
            async with session.post(
                f"{BASE_URL}/api/intake/submit",
                json=checkin_payload
            ) as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"Submit status: {status}")
                print(f"Response: {data}")
                
                if status != 200:
                    print(f"❌ FAIL: Expected 200, got {status}")
                    return
                
                confirmation = data.get("confirmation", "")
                mrn = data.get("mrn", "")
                
                # Verify confirmation format
                if not re.match(r"^PC-[A-Z0-9]{6}$", confirmation):
                    print(f"❌ FAIL: Confirmation '{confirmation}' does not match pattern")
                    return
                print(f"✅ PASS: Confirmation format correct: {confirmation}")
                
                # Verify MRN format
                if not re.match(r"^PC-\d{6}$", mrn):
                    print(f"❌ FAIL: MRN '{mrn}' does not match pattern")
                    return
                print(f"✅ PASS: MRN format correct: {mrn}")
                
        except Exception as e:
            print(f"❌ FAIL: Exception during clinical-checkin submission: {e}")
            import traceback
            traceback.print_exc()
            return
        
        print("\n✅ TEST 4 PASSED: Clinical check-in submission working correctly")
        
        # =====================================================================
        # TEST 5: Submit PI new-patient-intake with new ack fields
        # =====================================================================
        print("\n[TEST 5] Submit PI new-patient-intake with new ack fields")
        print("-" * 80)
        
        random_last3 = f"Test{random_suffix()}"
        
        pi_payload = {
            "slug": "new-patient-intake",
            "values": {
                "firstName": "PI",
                "lastName": random_last3,
                "dob": "1990-01-01",
                "signature": "PI Test",
                "ackAOB": True,
                "ackLOP": True,
                "ackPIP": True,
                "autoCarrier": "GEICO",
                "claimNumber": "CLM123"
            }
        }
        
        try:
            async with session.post(
                f"{BASE_URL}/api/intake/submit",
                json=pi_payload
            ) as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"Submit status: {status}")
                print(f"Response: {data}")
                
                if status != 200:
                    print(f"❌ FAIL: Expected 200, got {status}")
                    return
                
                confirmation = data.get("confirmation", "")
                mrn = data.get("mrn", "")
                
                # Verify confirmation format
                if not re.match(r"^PC-[A-Z0-9]{6}$", confirmation):
                    print(f"❌ FAIL: Confirmation '{confirmation}' does not match pattern")
                    return
                print(f"✅ PASS: Confirmation format correct: {confirmation}")
                
                # Verify MRN format
                if not re.match(r"^PC-\d{6}$", mrn):
                    print(f"❌ FAIL: MRN '{mrn}' does not match pattern")
                    return
                print(f"✅ PASS: MRN format correct: {mrn}")
                
        except Exception as e:
            print(f"❌ FAIL: Exception during PI new-patient-intake submission: {e}")
            import traceback
            traceback.print_exc()
            return
        
        print("\n✅ TEST 5 PASSED: PI new-patient-intake with ack fields working correctly")
        
        # =====================================================================
        # FINAL SUMMARY
        # =====================================================================
        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED - ITERATION 20 BACKEND TEST COMPLETE")
        print("="*80)
        print("\nSummary:")
        print("  ✅ TEST 1: GET /api/intake/forms - 7 forms with track field verified")
        print("  ✅ TEST 2: PDF endpoints - all 3 PDFs working (application/pdf, %PDF header)")
        print("  ✅ TEST 3: Clinical new patient + auto-attach - confirmation, MRN, attached counts verified")
        print("  ✅ TEST 4: Clinical check-in - confirmation and MRN verified")
        print("  ✅ TEST 5: PI new-patient-intake with ack fields - confirmation and MRN verified")
        print("\n" + "="*80)

if __name__ == "__main__":
    asyncio.run(test_iteration20())
