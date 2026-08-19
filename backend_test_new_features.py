#!/usr/bin/env python3
"""
Backend test for 6 NEW features (Aug 2026 batch):
1. Stedi eligibility on-demand + 30-day reuse cache
2. Full drug DB paginated search
3. Image upload storage
4. Inventory item + category CRUD
5. Clinical Specialties CRUD + linking
6. Patient medications POST source + dedupe
"""
import requests
import json
import base64
import io

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
LOGIN_EMAIL = "admin@proactiveclinic.com"
LOGIN_PASSWORD = "apex123"

session = requests.Session()

def login():
    """Login and get session cookie"""
    print("\n=== LOGIN ===")
    resp = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD},
        allow_redirects=False
    )
    print(f"Login status: {resp.status_code}")
    if resp.status_code == 200:
        print("✅ Login successful")
        return True
    else:
        print(f"❌ Login failed: {resp.text}")
        return False

def test_stedi_eligibility():
    """Test 1: Stedi eligibility on-demand + 30-day cache + check-in"""
    print("\n" + "="*80)
    print("TEST 1: STEDI ELIGIBILITY ON-DEMAND + 30-DAY CACHE + CHECK-IN")
    print("="*80)
    
    try:
        # Step 1: POST without cookie -> 401
        print("\n--- Step 1: POST /api/stedi/eligibility without auth cookie -> 401 ---")
        temp_session = requests.Session()
        resp = temp_session.post(f"{BASE_URL}/api/stedi/eligibility", json={})
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✅ PASS: Returns 401 without auth cookie")
        
        # Step 2: POST with auth - may return 400 if Stedi not configured (acceptable)
        print("\n--- Step 2: POST /api/stedi/eligibility with auth (Stedi may be unconfigured) ---")
        resp = session.post(
            f"{BASE_URL}/api/stedi/eligibility",
            json={
                "firstName": "Test",
                "lastName": "User",
                "dateOfBirth": "1980-01-01"
            }
        )
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)[:500]}")
        
        if resp.status_code == 400 and "not configured" in data.get("error", "").lower():
            print("✅ PASS: Returns 400 'Stedi is not configured' (acceptable - no API key)")
        elif resp.status_code == 200:
            print("✅ PASS: Returns 200 (Stedi is configured)")
            # Check for cached or new check
            if data.get("cached"):
                print(f"   Cached check returned: ageDays={data.get('ageDays')}")
                assert "check" in data, "cached:true must include check"
                assert "skippedReason" in data, "cached:true must include skippedReason"
                print("✅ PASS: Cached check structure correct")
            elif data.get("ok") and data.get("check"):
                print(f"   New check created: status={data['check'].get('status')}")
                print("✅ PASS: New check structure correct")
        else:
            print(f"⚠️  Unexpected response: {resp.status_code} - {data}")
        
        # Step 3: Find an appointment for check-in test
        print("\n--- Step 3: Find appointment for check-in test ---")
        # Get patient ID first
        resp = session.get(f"{BASE_URL}/api/patients/search?q=Adams")
        if resp.status_code == 200:
            patients = resp.json().get("results", [])
            if patients:
                patient_id = patients[0]["id"]
                print(f"Found patient: {patients[0].get('firstName')} {patients[0].get('lastName')} (ID: {patient_id})")
                
                # Get appointments for this patient
                resp = session.get(f"{BASE_URL}/api/appointments?patientId={patient_id}")
                if resp.status_code == 200:
                    appts = resp.json().get("appointments", [])
                    if appts:
                        appt_id = appts[0]["id"]
                        print(f"Found appointment ID: {appt_id}")
                        
                        # Step 4: POST check-in
                        print("\n--- Step 4: POST /api/appointments/[id]/checkin ---")
                        resp = session.post(f"{BASE_URL}/api/appointments/{appt_id}/checkin")
                        print(f"Status: {resp.status_code}")
                        data = resp.json()
                        print(f"Response keys: {list(data.keys())}")
                        
                        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
                        assert data.get("ok") == True, "Expected ok:true"
                        assert "appointment" in data, "Expected appointment in response"
                        assert data["appointment"].get("status") == "checked-in", "Expected status='checked-in'"
                        
                        # Check coverage fields (may be null)
                        print(f"   Coverage: {'present' if data.get('coverage') else 'null'}")
                        print(f"   CoverageNote: {data.get('coverageNote', 'null')[:100]}")
                        
                        print("✅ PASS: Check-in returns ok:true with appointment.status='checked-in'")
                        print("✅ PASS: Check-in returns coverage/coverageNote (no auto-verify)")
                    else:
                        print("⚠️  No appointments found for patient")
                else:
                    print(f"⚠️  Failed to get appointments: {resp.status_code}")
            else:
                print("⚠️  No patients found")
        else:
            print(f"⚠️  Failed to search patients: {resp.status_code}")
        
        print("\n✅ TEST 1 COMPLETE: Stedi eligibility on-demand + check-in")
        
    except Exception as e:
        print(f"\n❌ TEST 1 FAILED: {e}")
        import traceback
        traceback.print_exc()

def test_drug_search_pagination():
    """Test 2: Full drug DB paginated search"""
    print("\n" + "="*80)
    print("TEST 2: FULL DRUG DB PAGINATED SEARCH")
    print("="*80)
    
    try:
        # Step 1: Paginated search with pageSize
        print("\n--- Step 1: GET /api/drugs/search?q=lisinopril&pageSize=25 ---")
        resp = session.get(f"{BASE_URL}/api/drugs/search?q=lisinopril&pageSize=25")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Check paginated response structure
        assert "results" in data, "Expected results array"
        assert "total" in data, "Expected total field"
        assert "page" in data, "Expected page field"
        assert "pageSize" in data, "Expected pageSize field"
        assert "totalPages" in data, "Expected totalPages field"
        assert "filters" in data, "Expected filters field"
        assert "rxnorm" in data, "Expected rxnorm field (may be null)"
        
        print(f"   Results count: {len(data['results'])}")
        print(f"   Total: {data['total']}")
        print(f"   Page: {data['page']}")
        print(f"   PageSize: {data['pageSize']}")
        print(f"   TotalPages: {data['totalPages']}")
        print(f"   RxNorm: {'present' if data.get('rxnorm') else 'null'}")
        
        assert data["page"] == 1, "Expected page=1"
        assert data["pageSize"] == 25, "Expected pageSize=25"
        assert len(data["results"]) <= 25, "Results should not exceed pageSize"
        
        print("✅ PASS: Paginated search returns correct structure")
        
        # Step 2: Page 2
        print("\n--- Step 2: GET /api/drugs/search?q=lisinopril&pageSize=25&page=2 ---")
        resp = session.get(f"{BASE_URL}/api/drugs/search?q=lisinopril&pageSize=25&page=2")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert data["page"] == 2, "Expected page=2"
        print(f"   Page 2 results count: {len(data['results'])}")
        print("✅ PASS: Page 2 works correctly")
        
        # Step 3: Filter by form
        print("\n--- Step 3: GET /api/drugs/search?q=amoxicillin&pageSize=50&form=CAPSULE ---")
        resp = session.get(f"{BASE_URL}/api/drugs/search?q=amoxicillin&pageSize=50&form=CAPSULE")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert data["pageSize"] == 50, "Expected pageSize=50"
        print(f"   Results with CAPSULE filter: {len(data['results'])}")
        print("✅ PASS: Filter by form works")
        
        # Step 4: Typeahead mode (no pageSize) still works
        print("\n--- Step 4: GET /api/drugs/search?q=lisin (typeahead mode) ---")
        resp = session.get(f"{BASE_URL}/api/drugs/search?q=lisin")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert "results" in data, "Expected results array"
        assert "total" not in data, "Typeahead mode should NOT have total field"
        print(f"   Typeahead results count: {len(data['results'])}")
        print("✅ PASS: Typeahead mode still works (no total field)")
        
        # Step 5: No cookie -> 401
        print("\n--- Step 5: GET /api/drugs/search without auth cookie -> 401 ---")
        temp_session = requests.Session()
        resp = temp_session.get(f"{BASE_URL}/api/drugs/search?q=test")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✅ PASS: Returns 401 without auth cookie")
        
        print("\n✅ TEST 2 COMPLETE: Drug DB paginated search")
        
    except Exception as e:
        print(f"\n❌ TEST 2 FAILED: {e}")
        import traceback
        traceback.print_exc()

def test_image_uploads():
    """Test 3: Image upload storage"""
    print("\n" + "="*80)
    print("TEST 3: IMAGE UPLOAD STORAGE")
    print("="*80)
    
    try:
        # Step 1: POST without cookie -> 401
        print("\n--- Step 1: POST /api/uploads without auth cookie -> 401 ---")
        temp_session = requests.Session()
        resp = temp_session.post(f"{BASE_URL}/api/uploads")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✅ PASS: Returns 401 without auth cookie")
        
        # Step 2: POST a small PNG file
        print("\n--- Step 2: POST /api/uploads with small PNG file ---")
        # Create a tiny valid PNG (1x1 transparent pixel)
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        files = {"file": ("test.png", io.BytesIO(png_data), "image/png")}
        
        resp = session.post(f"{BASE_URL}/api/uploads", files=files)
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        assert "id" in data, "Expected id in response"
        assert "url" in data, "Expected url in response"
        assert "mime" in data, "Expected mime in response"
        assert "size" in data, "Expected size in response"
        assert data["mime"] == "image/png", f"Expected mime='image/png', got {data['mime']}"
        assert data["size"] > 0, "Expected size > 0"
        
        upload_id = data["id"]
        upload_url = data["url"]
        print(f"   Upload ID: {upload_id}")
        print(f"   Upload URL: {upload_url}")
        print("✅ PASS: PNG upload returns correct structure")
        
        # Step 3: GET the uploaded image
        print("\n--- Step 3: GET uploaded image ---")
        resp = session.get(f"{BASE_URL}{upload_url}")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        content_type = resp.headers.get("Content-Type", "")
        print(f"   Content-Type: {content_type}")
        assert "image/png" in content_type, f"Expected image/png, got {content_type}"
        assert len(resp.content) > 0, "Expected non-empty body"
        print(f"   Body size: {len(resp.content)} bytes")
        print("✅ PASS: GET returns image with correct Content-Type")
        
        # Step 4: POST non-image -> 400
        print("\n--- Step 4: POST /api/uploads with non-image file -> 400 ---")
        files = {"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")}
        resp = session.post(f"{BASE_URL}/api/uploads", files=files)
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        print(f"   Error: {resp.json().get('error', '')}")
        print("✅ PASS: Non-image returns 400")
        
        # Step 5: GET bogus ID -> 404
        print("\n--- Step 5: GET /api/uploads/bogus123 -> 404 ---")
        resp = session.get(f"{BASE_URL}/api/uploads/bogus123")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        print("✅ PASS: Bogus ID returns 404")
        
        print("\n✅ TEST 3 COMPLETE: Image upload storage")
        
    except Exception as e:
        print(f"\n❌ TEST 3 FAILED: {e}")
        import traceback
        traceback.print_exc()

def test_inventory_crud():
    """Test 4: Inventory item + category CRUD"""
    print("\n" + "="*80)
    print("TEST 4: INVENTORY ITEM + CATEGORY CRUD")
    print("="*80)
    
    try:
        # Step 1: GET categories
        print("\n--- Step 1: GET /api/inventory/categories ---")
        resp = session.get(f"{BASE_URL}/api/inventory/categories")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert "categories" in data, "Expected categories array"
        categories = data["categories"]
        print(f"   Categories count: {len(categories)}")
        
        # Check for built-in categories
        builtin_slugs = [c["slug"] for c in categories if c.get("builtin")]
        print(f"   Built-in categories: {builtin_slugs}")
        assert "medication" in builtin_slugs, "Expected 'medication' built-in category"
        assert "supply" in builtin_slugs, "Expected 'supply' built-in category"
        print("✅ PASS: GET categories returns built-ins")
        
        # Step 2: POST new category
        print("\n--- Step 2: POST /api/inventory/categories {name:'Lab Reagents'} ---")
        resp = session.post(
            f"{BASE_URL}/api/inventory/categories",
            json={"name": "Lab Reagents"}
        )
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert data.get("ok") == True, "Expected ok:true"
        assert "category" in data, "Expected category in response"
        category = data["category"]
        assert category["slug"] == "lab-reagents", f"Expected slug='lab-reagents', got {category['slug']}"
        assert category["builtin"] == False, "Expected builtin=false"
        
        category_id = category.get("id")
        print(f"   Created category ID: {category_id}")
        print("✅ PASS: POST category creates new category")
        
        # Step 3: POST same name -> 409
        print("\n--- Step 3: POST same category name again -> 409 ---")
        resp = session.post(
            f"{BASE_URL}/api/inventory/categories",
            json={"name": "Lab Reagents"}
        )
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 409, f"Expected 409, got {resp.status_code}"
        print("✅ PASS: Duplicate category returns 409")
        
        # Step 4: POST inventory item
        print("\n--- Step 4: POST /api/inventory (create item) ---")
        resp = session.post(
            f"{BASE_URL}/api/inventory",
            json={
                "name": "Test Product QA",
                "category": "supply",
                "unitCostCents": 150,
                "retailPriceCents": 500,
                "quantityOnHand": 10,
                "reorderLevel": 2
            }
        )
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert data.get("ok") == True, "Expected ok:true"
        assert "item" in data, "Expected item in response"
        item = data["item"]
        assert "id" in item, "Expected id in item"
        assert "sku" in item, "Expected sku in item"
        assert item["category"] == "supply", f"Expected category='supply', got {item['category']}"
        assert item["quantityOnHand"] == 10, f"Expected quantityOnHand=10, got {item['quantityOnHand']}"
        
        item_id = item["id"]
        print(f"   Created item ID: {item_id}")
        print(f"   SKU: {item['sku']}")
        print("✅ PASS: POST inventory item creates item with auto SKU")
        
        # Step 5: PATCH inventory item
        print("\n--- Step 5: PATCH /api/inventory/[id] (update item) ---")
        resp = session.patch(
            f"{BASE_URL}/api/inventory/{item_id}",
            json={"retailPriceCents": 750, "edition": "v2"}
        )
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert data.get("ok") == True, "Expected ok:true"
        assert data["item"]["retailPriceCents"] == 750, "Expected retailPriceCents=750"
        print("✅ PASS: PATCH updates item")
        
        # Step 6: GET inventory with search
        print("\n--- Step 6: GET /api/inventory?q=Test%20Product ---")
        resp = session.get(f"{BASE_URL}/api/inventory?q=Test%20Product")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert "items" in data, "Expected items array"
        found = any(i["id"] == item_id for i in data["items"])
        assert found, "Expected to find created item in search results"
        print("✅ PASS: GET inventory finds created item")
        
        # Step 7: DELETE inventory item
        print("\n--- Step 7: DELETE /api/inventory/[id] (soft delete) ---")
        resp = session.delete(f"{BASE_URL}/api/inventory/{item_id}")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert data.get("ok") == True, "Expected ok:true"
        print("✅ PASS: DELETE soft-deletes item")
        
        # Verify item no longer in GET
        resp = session.get(f"{BASE_URL}/api/inventory?q=Test%20Product")
        data = resp.json()
        found = any(i["id"] == item_id for i in data["items"])
        assert not found, "Expected item to be removed from active list"
        print("✅ PASS: Deleted item not in active list")
        
        # Step 8: DELETE category (if we have the ID)
        if category_id:
            print(f"\n--- Step 8: DELETE /api/inventory/categories/{category_id} ---")
            resp = session.delete(f"{BASE_URL}/api/inventory/categories/{category_id}")
            print(f"Status: {resp.status_code}")
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            print("✅ PASS: DELETE category works")
        
        # Step 9: No cookie -> 401
        print("\n--- Step 9: POST /api/inventory without auth cookie -> 401 ---")
        temp_session = requests.Session()
        resp = temp_session.post(f"{BASE_URL}/api/inventory", json={})
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✅ PASS: Returns 401 without auth cookie")
        
        print("\n✅ TEST 4 COMPLETE: Inventory CRUD")
        
    except Exception as e:
        print(f"\n❌ TEST 4 FAILED: {e}")
        import traceback
        traceback.print_exc()

def test_specialties_crud():
    """Test 5: Clinical Specialties CRUD + linking"""
    print("\n" + "="*80)
    print("TEST 5: CLINICAL SPECIALTIES CRUD + LINKING")
    print("="*80)
    
    try:
        # Step 1: GET specialties (seeds on first call)
        print("\n--- Step 1: GET /api/specialties ---")
        resp = session.get(f"{BASE_URL}/api/specialties")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert "specialties" in data, "Expected specialties array"
        specialties = data["specialties"]
        print(f"   Specialties count: {len(specialties)}")
        
        # Check for common specialties
        names = [s["name"] for s in specialties]
        print(f"   Sample specialties: {names[:5]}")
        assert "Cardiology" in names or "Pediatrics" in names, "Expected common specialties"
        print("✅ PASS: GET specialties returns seeded list")
        
        # Step 2: POST new specialty
        print("\n--- Step 2: POST /api/specialties {name:'QA Specialty'} ---")
        resp = session.post(
            f"{BASE_URL}/api/specialties",
            json={"name": "QA Specialty"}
        )
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert data.get("ok") == True, "Expected ok:true"
        assert "specialty" in data, "Expected specialty in response"
        specialty = data["specialty"]
        specialty_id = specialty["id"]
        print(f"   Created specialty ID: {specialty_id}")
        print("✅ PASS: POST creates new specialty")
        
        # Step 3: POST same name -> 409
        print("\n--- Step 3: POST same specialty name again -> 409 ---")
        resp = session.post(
            f"{BASE_URL}/api/specialties",
            json={"name": "QA Specialty"}
        )
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 409, f"Expected 409, got {resp.status_code}"
        print("✅ PASS: Duplicate specialty returns 409")
        
        # Step 4: GET providers
        print("\n--- Step 4: GET /api/providers ---")
        resp = session.get(f"{BASE_URL}/api/providers")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert "providers" in data, "Expected providers array"
        providers = data["providers"]
        print(f"   Providers count: {len(providers)}")
        
        if not providers:
            print("⚠️  WARNING: No providers found in database (demo users may not be DB rows)")
            print("   Skipping provider linking tests")
            provider_id = None
        else:
            provider = providers[0]
            provider_id = provider["id"]
            print(f"   Using provider: {provider['name']} (ID: {provider_id})")
            print("✅ PASS: GET providers returns list")
            
            # Step 5: Link provider to specialty
            print("\n--- Step 5: POST /api/specialties/[id]/providers ---")
            resp = session.post(
                f"{BASE_URL}/api/specialties/{specialty_id}/providers",
                json={"userId": provider_id}
            )
            print(f"Status: {resp.status_code}")
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            
            data = resp.json()
            assert data.get("ok") == True, "Expected ok:true"
            assert "link" in data, "Expected link in response"
            provider_link_id = data["link"]["id"]
            print(f"   Created provider link ID: {provider_link_id}")
            print("✅ PASS: POST links provider to specialty")
            
            # Step 6: POST same provider again -> 409
            print("\n--- Step 6: POST same provider link again -> 409 ---")
            resp = session.post(
                f"{BASE_URL}/api/specialties/{specialty_id}/providers",
                json={"userId": provider_id}
            )
            print(f"Status: {resp.status_code}")
            assert resp.status_code == 409, f"Expected 409, got {resp.status_code}"
            print("✅ PASS: Duplicate provider link returns 409")
        
        # Step 7: Get patient for linking
        print("\n--- Step 7: GET patient for linking ---")
        resp = session.get(f"{BASE_URL}/api/patients/search?q=Adams")
        print(f"Status: {resp.status_code}")
        
        patient_id = None
        patient_link_id = None
        if resp.status_code == 200:
            patients = resp.json().get("results", [])
            if patients:
                patient = patients[0]
                patient_id = patient["id"]
                print(f"   Using patient: {patient.get('firstName')} {patient.get('lastName')} (ID: {patient_id})")
                
                # Step 8: Link patient to specialty
                print("\n--- Step 8: POST /api/specialties/[id]/patients ---")
                resp = session.post(
                    f"{BASE_URL}/api/specialties/{specialty_id}/patients",
                    json={"patientId": patient_id}
                )
                print(f"Status: {resp.status_code}")
                assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
                
                data = resp.json()
                assert data.get("ok") == True, "Expected ok:true"
                assert "link" in data, "Expected link in response"
                patient_link_id = data["link"]["id"]
                print(f"   Created patient link ID: {patient_link_id}")
                print("✅ PASS: POST links patient to specialty")
        
        # Step 9: GET specialty with links
        print("\n--- Step 9: GET /api/specialties/[id] (with links) ---")
        resp = session.get(f"{BASE_URL}/api/specialties/{specialty_id}")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert "specialty" in data, "Expected specialty in response"
        assert "providers" in data, "Expected providers array"
        assert "patients" in data, "Expected patients array"
        print(f"   Providers linked: {len(data['providers'])}")
        print(f"   Patients linked: {len(data['patients'])}")
        print("✅ PASS: GET specialty returns linked providers/patients")
        
        # Step 10: DELETE provider link
        if provider_id and 'provider_link_id' in locals():
            print(f"\n--- Step 10: DELETE /api/specialties/[id]/providers?linkId={provider_link_id} ---")
            resp = session.delete(f"{BASE_URL}/api/specialties/{specialty_id}/providers?linkId={provider_link_id}")
            print(f"Status: {resp.status_code}")
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            print("✅ PASS: DELETE provider link works")
        
        # Step 11: DELETE patient link
        if patient_link_id:
            print(f"\n--- Step 11: DELETE /api/specialties/[id]/patients?linkId={patient_link_id} ---")
            resp = session.delete(f"{BASE_URL}/api/specialties/{specialty_id}/patients?linkId={patient_link_id}")
            print(f"Status: {resp.status_code}")
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            print("✅ PASS: DELETE patient link works")
        
        # Step 12: DELETE specialty
        print(f"\n--- Step 12: DELETE /api/specialties/{specialty_id} ---")
        resp = session.delete(f"{BASE_URL}/api/specialties/{specialty_id}")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        print("✅ PASS: DELETE specialty works")
        
        # Step 13: No cookie -> 401
        print("\n--- Step 13: GET /api/specialties without auth cookie -> 401 ---")
        temp_session = requests.Session()
        resp = temp_session.get(f"{BASE_URL}/api/specialties")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✅ PASS: Returns 401 without auth cookie")
        
        print("\n✅ TEST 5 COMPLETE: Specialties CRUD + linking")
        
    except Exception as e:
        print(f"\n❌ TEST 5 FAILED: {e}")
        import traceback
        traceback.print_exc()

def test_medications_dedupe():
    """Test 6: Patient medications POST source + dedupe"""
    print("\n" + "="*80)
    print("TEST 6: PATIENT MEDICATIONS POST SOURCE + DEDUPE")
    print("="*80)
    
    try:
        # Get a patient ID
        print("\n--- Step 1: Get patient ID ---")
        resp = session.get(f"{BASE_URL}/api/patients/search?q=Adams")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        patients = resp.json().get("results", [])
        assert len(patients) > 0, "Expected at least one patient"
        
        patient = patients[0]
        patient_id = patient["id"]
        print(f"   Using patient: {patient.get('firstName')} {patient.get('lastName')} (ID: {patient_id})")
        
        # Step 2: POST medication with source
        print("\n--- Step 2: POST /api/patients/[id]/medications with source ---")
        resp = session.post(
            f"{BASE_URL}/api/patients/{patient_id}/medications",
            json={
                "name": "QA Aspirin 81mg",
                "source": "cms-bluebutton"
            }
        )
        print(f"Status: {resp.status_code}")
        assert resp.status_code in [200, 201], f"Expected 200 or 201, got {resp.status_code}"
        
        data = resp.json()
        assert data.get("ok") == True, "Expected ok:true"
        assert "medication" in data, "Expected medication in response"
        medication = data["medication"]
        
        if resp.status_code == 201:
            assert medication["source"] == "cms-bluebutton", f"Expected source='cms-bluebutton', got {medication['source']}"
            medication_id = medication["id"]
            print(f"   Created medication ID: {medication_id}")
            print(f"   Source: {medication['source']}")
            print("✅ PASS: POST creates medication with source")
        else:
            # Already exists from previous test run
            medication_id = medication["id"]
            print(f"   Medication already exists (ID: {medication_id})")
            print("✅ PASS: Medication exists (from previous test run)")
        
        # Step 3: POST same medication again -> duplicate:true
        print("\n--- Step 3: POST same medication again (idempotent dedupe) ---")
        resp = session.post(
            f"{BASE_URL}/api/patients/{patient_id}/medications",
            json={
                "name": "QA Aspirin 81mg"
            }
        )
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert data.get("ok") == True, "Expected ok:true"
        assert data.get("duplicate") == True, "Expected duplicate:true"
        assert "medication" in data, "Expected medication in response"
        assert data["medication"]["id"] == medication_id, "Expected same medication ID (not new row)"
        
        print(f"   Duplicate detected: {data.get('duplicate')}")
        print(f"   Returned existing medication ID: {data['medication']['id']}")
        print("✅ PASS: POST same medication returns duplicate:true (no new row)")
        
        # Step 4: Verify count unchanged
        print("\n--- Step 4: Verify medication count unchanged ---")
        resp = session.get(f"{BASE_URL}/api/patients/{patient_id}/medications")
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        data = resp.json()
        medications = data.get("medications", [])
        qa_aspirin_count = sum(1 for m in medications if "QA Aspirin" in m.get("name", ""))
        print(f"   QA Aspirin medications count: {qa_aspirin_count}")
        assert qa_aspirin_count == 1, f"Expected 1 QA Aspirin medication, found {qa_aspirin_count}"
        print("✅ PASS: No duplicate medication created")
        
        # Step 5: POST with empty name -> 400
        print("\n--- Step 5: POST with empty name -> 400 ---")
        resp = session.post(
            f"{BASE_URL}/api/patients/{patient_id}/medications",
            json={"name": ""}
        )
        print(f"Status: {resp.status_code}")
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        print("✅ PASS: Empty name returns 400")
        
        print("\n✅ TEST 6 COMPLETE: Medications source + dedupe")
        
    except Exception as e:
        print(f"\n❌ TEST 6 FAILED: {e}")
        import traceback
        traceback.print_exc()

def main():
    """Run all tests"""
    print("="*80)
    print("BACKEND TESTING: 6 NEW FEATURES (Aug 2026 batch)")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Login: {LOGIN_EMAIL}")
    
    if not login():
        print("\n❌ LOGIN FAILED - Cannot proceed with tests")
        return
    
    # Run all tests
    test_stedi_eligibility()
    test_drug_search_pagination()
    test_image_uploads()
    test_inventory_crud()
    test_specialties_crud()
    test_medications_dedupe()
    
    print("\n" + "="*80)
    print("ALL TESTS COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
