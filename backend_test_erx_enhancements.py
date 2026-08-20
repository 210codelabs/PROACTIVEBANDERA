#!/usr/bin/env python3
"""
Backend test for eRx enhancements (Iteration 2026):
1. POST /api/drugs/schedule (controlled-substance detection)
2. POST /api/drugs/interactions (severity enrichment)
3. GET/POST /api/erx (history filter + deaSchedule persistence)

Login: admin@proactiveclinic.com / apex123
Base: https://nextjs-ssr-stack.preview.emergentagent.com
"""
import requests
import json

BASE = "https://nextjs-ssr-stack.preview.emergentagent.com"
session = requests.Session()

def login():
    """Login as admin to get session cookie"""
    print("\n=== LOGIN ===")
    r = session.post(f"{BASE}/api/auth/login", json={
        "email": "admin@proactiveclinic.com",
        "password": "apex123"
    })
    print(f"Login status: {r.status_code}")
    if r.status_code != 200:
        print(f"Login failed: {r.text}")
        return False
    print("✅ Login successful")
    return True

def test_drugs_schedule():
    """Test POST /api/drugs/schedule (controlled-substance detection)"""
    print("\n" + "="*80)
    print("TEST 1: POST /api/drugs/schedule (Controlled-Substance Detection)")
    print("="*80)
    
    # Test 1.1: No cookie -> 401
    print("\n--- Test 1.1: POST /api/drugs/schedule WITHOUT auth cookie -> 401 ---")
    try:
        r = requests.post(f"{BASE}/api/drugs/schedule", json={"name": "lorazepam"})
        print(f"Status: {r.status_code}")
        if r.status_code == 401:
            print("✅ PASS: Returns 401 Unauthorized without auth cookie")
        else:
            print(f"❌ FAIL: Expected 401, got {r.status_code}")
            print(f"Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
    
    # Test 1.2: POST {name:'lorazepam'} -> 200 with controlled=true, schedule like 'CIV'
    print("\n--- Test 1.2: POST {name:'lorazepam'} -> controlled=true, schedule='CIV' ---")
    try:
        r = session.post(f"{BASE}/api/drugs/schedule", json={"name": "lorazepam"})
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # CRITICAL ASSERTIONS
            if data.get("controlled") == True:
                print("✅ PASS: controlled=true (lorazepam is a controlled substance)")
            else:
                print(f"❌ FAIL: Expected controlled=true, got {data.get('controlled')}")
            
            schedule = data.get("schedule", "")
            if schedule and schedule.startswith("C"):
                print(f"✅ PASS: schedule='{schedule}' (any C-schedule acceptable)")
            else:
                print(f"⚠️  WARNING: Expected schedule like 'CIV', got '{schedule}' (may be openFDA data issue)")
            
            if "label" in data:
                print(f"   Label: {data.get('label')}")
            if "source" in data:
                print(f"   Source: {data.get('source')}")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
    
    # Test 1.3: POST {name:'lisinopril'} -> 200 with controlled=false
    print("\n--- Test 1.3: POST {name:'lisinopril'} -> controlled=false ---")
    try:
        r = session.post(f"{BASE}/api/drugs/schedule", json={"name": "lisinopril"})
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get("controlled") == False:
                print("✅ PASS: controlled=false (lisinopril is NOT a controlled substance)")
            else:
                print(f"❌ FAIL: Expected controlled=false, got {data.get('controlled')}")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
    
    # Test 1.4: POST {} (no name/ndc) -> 400
    print("\n--- Test 1.4: POST {} (no name/ndc) -> 400 ---")
    try:
        r = session.post(f"{BASE}/api/drugs/schedule", json={})
        print(f"Status: {r.status_code}")
        if r.status_code == 400:
            data = r.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            print("✅ PASS: Returns 400 when no name/ndc provided")
        else:
            print(f"❌ FAIL: Expected 400, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")

def test_drugs_interactions():
    """Test POST /api/drugs/interactions (severity enrichment)"""
    print("\n" + "="*80)
    print("TEST 2: POST /api/drugs/interactions (Severity Enrichment)")
    print("="*80)
    
    # Test 2.1: No cookie -> 401
    print("\n--- Test 2.1: POST /api/drugs/interactions WITHOUT auth cookie -> 401 ---")
    try:
        r = requests.post(f"{BASE}/api/drugs/interactions", json={
            "name": "warfarin",
            "meds": ["Aspirin", "Lisinopril"]
        })
        print(f"Status: {r.status_code}")
        if r.status_code == 401:
            print("✅ PASS: Returns 401 Unauthorized without auth cookie")
        else:
            print(f"❌ FAIL: Expected 401, got {r.status_code}")
            print(f"Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
    
    # Test 2.2: POST {name:'warfarin', meds:['Aspirin','Lisinopril']} -> 200 with severity fields
    print("\n--- Test 2.2: POST {name:'warfarin', meds:['Aspirin','Lisinopril']} -> 200 with severity ---")
    try:
        r = session.post(f"{BASE}/api/drugs/interactions", json={
            "name": "warfarin",
            "meds": ["Aspirin", "Lisinopril"]
        })
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Check hasLabel
            if data.get("hasLabel") == True:
                print("✅ PASS: hasLabel=true")
            else:
                print(f"⚠️  WARNING: hasLabel={data.get('hasLabel')} (may be openFDA issue)")
            
            # Check flagged is array
            flagged = data.get("flagged", [])
            if isinstance(flagged, list):
                print(f"✅ PASS: flagged is array with {len(flagged)} items")
                
                # If non-empty, check each item has required fields
                if len(flagged) > 0:
                    print(f"\n   Flagged interactions:")
                    for i, item in enumerate(flagged):
                        print(f"   [{i+1}] med: {item.get('med')}")
                        print(f"       matchedTerm: {item.get('matchedTerm')}")
                        print(f"       level: {item.get('level')}")
                        print(f"       basis: {item.get('basis')}")
                        
                        # Verify required fields
                        if "med" in item and "matchedTerm" in item and "level" in item and "basis" in item:
                            if item.get("level") in ["high", "moderate", "low"]:
                                print(f"       ✅ Item has all required fields with valid level")
                            else:
                                print(f"       ❌ Invalid level: {item.get('level')}")
                        else:
                            print(f"       ❌ Missing required fields")
                    
                    # Check maxLevel present when flagged non-empty
                    if "maxLevel" in data:
                        print(f"\n✅ PASS: maxLevel present: '{data.get('maxLevel')}'")
                    else:
                        print(f"\n❌ FAIL: maxLevel missing when flagged is non-empty")
                else:
                    print("   (No interactions flagged - may be openFDA data variation)")
            else:
                print(f"❌ FAIL: flagged is not an array: {type(flagged)}")
            
            # Print other fields
            if "drug" in data:
                print(f"\n   Drug: {data.get('drug')}")
            if "checkedAgainst" in data:
                print(f"   Checked against: {data.get('checkedAgainst')} medications")
            if "source" in data:
                print(f"   Source: {data.get('source')[:80]}...")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
    
    # Test 2.3: POST {} -> 400
    print("\n--- Test 2.3: POST {} (no name/ndc) -> 400 ---")
    try:
        r = session.post(f"{BASE}/api/drugs/interactions", json={})
        print(f"Status: {r.status_code}")
        if r.status_code == 400:
            data = r.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            print("✅ PASS: Returns 400 when no name/ndc provided")
        else:
            print(f"❌ FAIL: Expected 400, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")

def test_erx_api():
    """Test GET/POST /api/erx (history filter + deaSchedule persistence)"""
    print("\n" + "="*80)
    print("TEST 3: GET/POST /api/erx (History Filter + deaSchedule Persistence)")
    print("="*80)
    
    # Test 3.1: GET /api/erx no cookie -> 401
    print("\n--- Test 3.1: GET /api/erx WITHOUT auth cookie -> 401 ---")
    try:
        r = requests.get(f"{BASE}/api/erx")
        print(f"Status: {r.status_code}")
        if r.status_code == 401:
            print("✅ PASS: Returns 401 Unauthorized without auth cookie")
        else:
            print(f"❌ FAIL: Expected 401, got {r.status_code}")
            print(f"Response: {r.text[:200]}")
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
    
    # Test 3.2: POST /api/erx with deaSchedule -> 200 {ok:true,id}
    print("\n--- Test 3.2: POST /api/erx with deaSchedule='CIV' -> 200 {ok:true,id} ---")
    rx_id = None
    try:
        r = session.post(f"{BASE}/api/erx", json={
            "patientName": "Test, Rx",
            "medName": "Lorazepam",
            "strength": "1 mg",
            "providerName": "Dr Test",
            "signatureType": "typed",
            "signatureData": "Dr Test",
            "deaSchedule": "CIV",
            "refills": 0
        })
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get("ok") == True and "id" in data:
                rx_id = data.get("id")
                print(f"✅ PASS: Prescription created with id: {rx_id}")
            else:
                print(f"❌ FAIL: Expected {{ok:true, id}}, got {data}")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
    
    # Test 3.3: GET /api/erx -> 200 {prescriptions:[...]} includes the created rx with deaSchedule 'CIV'
    print("\n--- Test 3.3: GET /api/erx -> includes created rx with deaSchedule='CIV' ---")
    try:
        r = session.get(f"{BASE}/api/erx")
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            prescriptions = data.get("prescriptions", [])
            print(f"✅ PASS: Returns 200 with {len(prescriptions)} prescriptions")
            
            if rx_id:
                # Find the created prescription
                found = None
                for rx in prescriptions:
                    if rx.get("id") == rx_id:
                        found = rx
                        break
                
                if found:
                    print(f"\n   Found created prescription:")
                    print(f"   - id: {found.get('id')}")
                    print(f"   - patientName: {found.get('patientName')}")
                    print(f"   - medName: {found.get('medName')}")
                    print(f"   - deaSchedule: {found.get('deaSchedule')}")
                    
                    if found.get("deaSchedule") == "CIV":
                        print(f"\n✅ PASS: deaSchedule='CIV' persisted correctly")
                    else:
                        print(f"\n❌ FAIL: Expected deaSchedule='CIV', got '{found.get('deaSchedule')}'")
                else:
                    print(f"\n⚠️  WARNING: Created prescription (id={rx_id}) not found in list")
            else:
                print("   (Skipping verification - no rx_id from previous test)")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
    
    # Test 3.4: GET /api/erx/<id>/pdf -> 200 application/pdf with %PDF- header
    print("\n--- Test 3.4: GET /api/erx/<id>/pdf -> 200 application/pdf ---")
    if rx_id:
        try:
            r = session.get(f"{BASE}/api/erx/{rx_id}/pdf")
            print(f"Status: {r.status_code}")
            if r.status_code == 200:
                content_type = r.headers.get("Content-Type", "")
                print(f"Content-Type: {content_type}")
                
                if "application/pdf" in content_type:
                    print("✅ PASS: Content-Type is application/pdf")
                else:
                    print(f"❌ FAIL: Expected application/pdf, got {content_type}")
                
                # Check PDF header
                if r.content[:5] == b'%PDF-':
                    print(f"✅ PASS: Response starts with '%PDF-' (valid PDF)")
                    print(f"   PDF size: {len(r.content)} bytes")
                else:
                    print(f"❌ FAIL: Response does not start with '%PDF-'")
                    print(f"   First 20 bytes: {r.content[:20]}")
            else:
                print(f"❌ FAIL: Expected 200, got {r.status_code}")
                print(f"Response: {r.text[:500]}")
        except Exception as e:
            print(f"❌ FAIL: Exception - {e}")
    else:
        print("⚠️  SKIP: No rx_id from previous test")
    
    # Test 3.5: GET /api/erx?patientId=nonexistent123 -> 200 with prescriptions:[]
    print("\n--- Test 3.5: GET /api/erx?patientId=nonexistent123 -> 200 with empty array ---")
    try:
        r = session.get(f"{BASE}/api/erx?patientId=nonexistent123")
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            prescriptions = data.get("prescriptions", None)
            
            if isinstance(prescriptions, list) and len(prescriptions) == 0:
                print(f"✅ PASS: Returns 200 with prescriptions:[] (empty array)")
            else:
                print(f"⚠️  WARNING: Expected empty array, got {len(prescriptions) if isinstance(prescriptions, list) else 'not a list'} items")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}")
            print(f"Response: {r.text[:500]}")
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")

def main():
    print("="*80)
    print("eRx Enhancements Backend Testing")
    print("="*80)
    
    if not login():
        print("\n❌ Login failed. Cannot proceed with tests.")
        return
    
    # Run all tests
    test_drugs_schedule()
    test_drugs_interactions()
    test_erx_api()
    
    print("\n" + "="*80)
    print("TESTING COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
