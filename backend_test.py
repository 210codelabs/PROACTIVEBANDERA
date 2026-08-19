#!/usr/bin/env python3
"""
Backend test for TWO new features:
1. GET /api/drugs/recall?ndc= (openFDA drug enforcement/recall lookup)
2. PATCH/DELETE /api/patients/:id/medications/:medId (medication discontinue)

Base URL: HTTPS preview base (process.env.NEXT_PUBLIC_BASE_URL)
Staff login: admin@proactiveclinic.com / apex123
Seed patient: Eleanor Adams MRN PC-100000
"""

import asyncio
import json
import sys
from pymongo import MongoClient

# Base URL from .env
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

async def main():
    print("=" * 80)
    print("BACKEND TEST: Recall Alerts + Med Discontinue")
    print("=" * 80)
    
    # MongoDB connection to resolve patient ID
    try:
        mongo_client = MongoClient("mongodb://localhost:27017")
        db = mongo_client["proactive_clinic"]
        patient_collection = db["Patient"]
        
        # Find Eleanor Adams (MRN PC-100000)
        adams = patient_collection.find_one({"mrn": "PC-100000"})
        if not adams:
            print("❌ ERROR: Could not find Eleanor Adams (MRN PC-100000) in database")
            return
        
        patient_id = adams["_id"]
        print(f"✅ Found Eleanor Adams: ID={patient_id}, MRN={adams['mrn']}")
        print()
    except Exception as e:
        print(f"❌ ERROR: MongoDB connection failed: {e}")
        return
    
    # Import playwright after MongoDB check
    from playwright.async_api import async_playwright
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(ignore_https_errors=True)
        page = await context.new_page()
        
        try:
            # ========================================================================
            # STAFF LOGIN
            # ========================================================================
            print("=" * 80)
            print("STAFF LOGIN")
            print("=" * 80)
            
            login_response = await page.request.post(
                f"{BASE_URL}/api/auth/login",
                data=json.dumps({"email": "admin@proactiveclinic.com", "password": "apex123"}),
                headers={"Content-Type": "application/json"}
            )
            
            if login_response.status != 200:
                print(f"❌ Login failed: {login_response.status}")
                print(await login_response.text())
                return
            
            print(f"✅ Staff login successful (status {login_response.status})")
            print()
            
            # ========================================================================
            # FEATURE 1: GET /api/drugs/recall?ndc= (openFDA recall lookup)
            # ========================================================================
            print("=" * 80)
            print("FEATURE 1: GET /api/drugs/recall?ndc= (openFDA recall lookup)")
            print("=" * 80)
            print()
            
            # TEST 1: GET without auth cookie -> 401
            print("TEST 1: GET /api/drugs/recall?ndc=70710-1159 WITHOUT auth cookie")
            print("-" * 80)
            try:
                no_auth_context = await browser.new_context(ignore_https_errors=True)
                no_auth_page = await no_auth_context.new_page()
                no_auth_response = await no_auth_page.request.get(f"{BASE_URL}/api/drugs/recall?ndc=70710-1159")
                
                if no_auth_response.status == 401:
                    print(f"✅ PASS: Returns 401 Unauthorized (status {no_auth_response.status})")
                else:
                    print(f"❌ FAIL: Expected 401, got {no_auth_response.status}")
                    print(await no_auth_response.text())
                
                await no_auth_context.close()
            except Exception as e:
                print(f"❌ ERROR: {e}")
            print()
            
            # TEST 2: GET with invalid NDC format -> 400
            print("TEST 2: GET /api/drugs/recall?ndc=not-an-ndc as admin")
            print("-" * 80)
            try:
                invalid_ndc_response = await page.request.get(f"{BASE_URL}/api/drugs/recall?ndc=not-an-ndc")
                
                if invalid_ndc_response.status == 400:
                    body = await invalid_ndc_response.json()
                    if body.get("error") == "Invalid NDC format":
                        print(f"✅ PASS: Returns 400 with error 'Invalid NDC format'")
                        print(f"   Response: {json.dumps(body, indent=2)}")
                    else:
                        print(f"❌ FAIL: Expected error 'Invalid NDC format', got: {body.get('error')}")
                else:
                    print(f"❌ FAIL: Expected 400, got {invalid_ndc_response.status}")
                    print(await invalid_ndc_response.text())
            except Exception as e:
                print(f"❌ ERROR: {e}")
            print()
            
            # TEST 3: GET with valid NDC (70710-1159 - known recall at build time)
            print("TEST 3: GET /api/drugs/recall?ndc=70710-1159 as admin")
            print("-" * 80)
            try:
                recall_response = await page.request.get(f"{BASE_URL}/api/drugs/recall?ndc=70710-1159")
                
                if recall_response.status == 200:
                    body = await recall_response.json()
                    print(f"✅ PASS: Returns 200")
                    print(f"   NDC: {body.get('ndc')}")
                    print(f"   Open: {body.get('open')}")
                    print(f"   Recalls count: {len(body.get('recalls', []))}")
                    print(f"   Source: {body.get('source')}")
                    
                    # Verify response shape
                    if "ndc" in body and "open" in body and "recalls" in body and "source" in body:
                        print(f"✅ Response has required fields: ndc, open, recalls, source")
                    else:
                        print(f"❌ FAIL: Missing required fields in response")
                    
                    # Check recalls array structure (if non-empty)
                    recalls = body.get("recalls", [])
                    if len(recalls) > 0:
                        print(f"   Recall data found (likely ongoing Class II recall):")
                        first_recall = recalls[0]
                        required_fields = ["status", "classification", "reason", "initiatedOn", "firm"]
                        missing_fields = [f for f in required_fields if f not in first_recall]
                        if not missing_fields:
                            print(f"   ✅ First recall has all required fields: {', '.join(required_fields)}")
                            print(f"      Status: {first_recall.get('status')}")
                            print(f"      Classification: {first_recall.get('classification')}")
                            print(f"      Reason: {first_recall.get('reason')[:80]}...")
                            print(f"      Firm: {first_recall.get('firm')}")
                        else:
                            print(f"   ❌ FAIL: Missing fields in recall: {missing_fields}")
                    else:
                        print(f"   ⚠️  NOTE: No recalls found (FDA data may have changed)")
                else:
                    print(f"❌ FAIL: Expected 200, got {recall_response.status}")
                    print(await recall_response.text())
            except Exception as e:
                print(f"❌ ERROR: {e}")
            print()
            
            # TEST 4: GET with valid NDC format but no recall data (99999-9999)
            print("TEST 4: GET /api/drugs/recall?ndc=99999-9999 as admin")
            print("-" * 80)
            try:
                no_recall_response = await page.request.get(f"{BASE_URL}/api/drugs/recall?ndc=99999-9999")
                
                if no_recall_response.status == 200:
                    body = await no_recall_response.json()
                    if body.get("recalls") == [] and body.get("open") == False:
                        print(f"✅ PASS: Returns 200 with empty recalls and open=false")
                        print(f"   Response: {json.dumps(body, indent=2)}")
                    else:
                        print(f"❌ FAIL: Expected empty recalls and open=false")
                        print(f"   Got: {json.dumps(body, indent=2)}")
                else:
                    print(f"❌ FAIL: Expected 200, got {no_recall_response.status}")
                    print(await no_recall_response.text())
            except Exception as e:
                print(f"❌ ERROR: {e}")
            print()
            
            # ========================================================================
            # FEATURE 2: PATCH/DELETE /api/patients/:id/medications/:medId
            # ========================================================================
            print("=" * 80)
            print("FEATURE 2: PATCH/DELETE /api/patients/:id/medications/:medId")
            print("=" * 80)
            print()
            
            # SETUP: Create a medication for Eleanor Adams
            print("SETUP: Create medication for Eleanor Adams")
            print("-" * 80)
            try:
                create_med_response = await page.request.post(
                    f"{BASE_URL}/api/patients/{patient_id}/medications",
                    data=json.dumps({
                        "name": "Metformin",
                        "strength": "500 mg",
                        "ndc": "12345-678"
                    }),
                    headers={"Content-Type": "application/json"}
                )
                
                if create_med_response.status == 201:
                    med_body = await create_med_response.json()
                    med_id = med_body.get("medication", {}).get("id")
                    print(f"✅ Medication created: ID={med_id}")
                    print(f"   Name: {med_body.get('medication', {}).get('name')}")
                    print(f"   Strength: {med_body.get('medication', {}).get('strength')}")
                    print(f"   Status: {med_body.get('medication', {}).get('status')}")
                else:
                    print(f"❌ FAIL: Expected 201, got {create_med_response.status}")
                    print(await create_med_response.text())
                    return
            except Exception as e:
                print(f"❌ ERROR: {e}")
                return
            print()
            
            # TEST 5: PATCH without auth cookie -> 401
            print("TEST 5: PATCH /api/patients/:id/medications/:medId WITHOUT auth cookie")
            print("-" * 80)
            try:
                no_auth_context2 = await browser.new_context(ignore_https_errors=True)
                no_auth_page2 = await no_auth_context2.new_page()
                no_auth_patch_response = await no_auth_page2.request.patch(
                    f"{BASE_URL}/api/patients/{patient_id}/medications/{med_id}",
                    data=json.dumps({"status": "discontinued"}),
                    headers={"Content-Type": "application/json"}
                )
                
                if no_auth_patch_response.status == 401:
                    print(f"✅ PASS: Returns 401 Unauthorized (status {no_auth_patch_response.status})")
                else:
                    print(f"❌ FAIL: Expected 401, got {no_auth_patch_response.status}")
                    print(await no_auth_patch_response.text())
                
                await no_auth_context2.close()
            except Exception as e:
                print(f"❌ ERROR: {e}")
            print()
            
            # TEST 6: PATCH with empty body -> 400
            print("TEST 6: PATCH /api/patients/:id/medications/:medId with empty body")
            print("-" * 80)
            try:
                empty_patch_response = await page.request.patch(
                    f"{BASE_URL}/api/patients/{patient_id}/medications/{med_id}",
                    data=json.dumps({}),
                    headers={"Content-Type": "application/json"}
                )
                
                if empty_patch_response.status == 400:
                    body = await empty_patch_response.json()
                    if body.get("error") == "No changes provided":
                        print(f"✅ PASS: Returns 400 with error 'No changes provided'")
                    else:
                        print(f"❌ FAIL: Expected error 'No changes provided', got: {body.get('error')}")
                else:
                    print(f"❌ FAIL: Expected 400, got {empty_patch_response.status}")
                    print(await empty_patch_response.text())
            except Exception as e:
                print(f"❌ ERROR: {e}")
            print()
            
            # TEST 7: PATCH with status='discontinued' -> 200, endDate set
            print("TEST 7: PATCH /api/patients/:id/medications/:medId with status='discontinued'")
            print("-" * 80)
            try:
                discontinue_response = await page.request.patch(
                    f"{BASE_URL}/api/patients/{patient_id}/medications/{med_id}",
                    data=json.dumps({"status": "discontinued"}),
                    headers={"Content-Type": "application/json"}
                )
                
                if discontinue_response.status == 200:
                    body = await discontinue_response.json()
                    medication = body.get("medication", {})
                    
                    if medication.get("status") == "discontinued":
                        print(f"✅ PASS: Status updated to 'discontinued'")
                    else:
                        print(f"❌ FAIL: Expected status 'discontinued', got: {medication.get('status')}")
                    
                    if medication.get("endDate") is not None:
                        print(f"✅ PASS: endDate is set: {medication.get('endDate')}")
                    else:
                        print(f"❌ FAIL: endDate is null (should be set)")
                    
                    print(f"   Full medication: {json.dumps(medication, indent=2)}")
                else:
                    print(f"❌ FAIL: Expected 200, got {discontinue_response.status}")
                    print(await discontinue_response.text())
            except Exception as e:
                print(f"❌ ERROR: {e}")
            print()
            
            # TEST 8: GET medications (should NOT include discontinued)
            print("TEST 8: GET /api/patients/:id/medications (should NOT include discontinued)")
            print("-" * 80)
            try:
                get_meds_response = await page.request.get(f"{BASE_URL}/api/patients/{patient_id}/medications")
                
                if get_meds_response.status == 200:
                    body = await get_meds_response.json()
                    medications = body.get("medications", [])
                    
                    # Check if our discontinued Metformin is in the list
                    metformin_found = any(m.get("id") == med_id for m in medications)
                    
                    if not metformin_found:
                        print(f"✅ PASS: Discontinued Metformin NOT in active medications list")
                        print(f"   Total active medications: {len(medications)}")
                    else:
                        print(f"❌ FAIL: Discontinued Metformin still appears in active medications")
                        print(f"   Medications: {json.dumps(medications, indent=2)}")
                else:
                    print(f"❌ FAIL: Expected 200, got {get_meds_response.status}")
                    print(await get_meds_response.text())
            except Exception as e:
                print(f"❌ ERROR: {e}")
            print()
            
            # TEST 9: PATCH with bogus medId -> 404
            print("TEST 9: PATCH /api/patients/:id/medications/nope123 (bogus medId)")
            print("-" * 80)
            try:
                bogus_patch_response = await page.request.patch(
                    f"{BASE_URL}/api/patients/{patient_id}/medications/nope123",
                    data=json.dumps({"status": "discontinued"}),
                    headers={"Content-Type": "application/json"}
                )
                
                if bogus_patch_response.status == 404:
                    body = await bogus_patch_response.json()
                    if body.get("error") == "Medication not found":
                        print(f"✅ PASS: Returns 404 with error 'Medication not found'")
                    else:
                        print(f"❌ FAIL: Expected error 'Medication not found', got: {body.get('error')}")
                else:
                    print(f"❌ FAIL: Expected 404, got {bogus_patch_response.status}")
                    print(await bogus_patch_response.text())
            except Exception as e:
                print(f"❌ ERROR: {e}")
            print()
            
            # TEST 10: DELETE medication -> 200
            print("TEST 10: DELETE /api/patients/:id/medications/:medId")
            print("-" * 80)
            try:
                delete_response = await page.request.delete(f"{BASE_URL}/api/patients/{patient_id}/medications/{med_id}")
                
                if delete_response.status == 200:
                    body = await delete_response.json()
                    if body.get("ok") == True:
                        print(f"✅ PASS: Returns 200 with ok=true")
                    else:
                        print(f"❌ FAIL: Expected ok=true, got: {body}")
                else:
                    print(f"❌ FAIL: Expected 200, got {delete_response.status}")
                    print(await delete_response.text())
            except Exception as e:
                print(f"❌ ERROR: {e}")
            print()
            
            # TEST 11: DELETE same medId again -> 404
            print("TEST 11: DELETE /api/patients/:id/medications/:medId again (should be 404)")
            print("-" * 80)
            try:
                delete_again_response = await page.request.delete(f"{BASE_URL}/api/patients/{patient_id}/medications/{med_id}")
                
                if delete_again_response.status == 404:
                    body = await delete_again_response.json()
                    if body.get("error") == "Medication not found":
                        print(f"✅ PASS: Returns 404 with error 'Medication not found'")
                    else:
                        print(f"❌ FAIL: Expected error 'Medication not found', got: {body.get('error')}")
                else:
                    print(f"❌ FAIL: Expected 404, got {delete_again_response.status}")
                    print(await delete_again_response.text())
            except Exception as e:
                print(f"❌ ERROR: {e}")
            print()
            
            print("=" * 80)
            print("BACKEND TEST COMPLETE")
            print("=" * 80)
            
        except Exception as e:
            print(f"❌ CRITICAL ERROR: {e}")
            import traceback
            traceback.print_exc()
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
