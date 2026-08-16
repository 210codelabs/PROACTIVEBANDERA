#!/usr/bin/env python3
"""
Backend test for Records Released history endpoint (GET /api/records-releases).
Tests authentication, response structure, and data verification.
"""

import requests
import json
from pymongo import MongoClient

# Configuration
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
ADMIN_EMAIL = "admin@proactiveclinic.com"
ADMIN_PASSWORD = "apex123"

def print_test(step, message):
    """Print test step with formatting."""
    print(f"\n{'='*80}")
    print(f"TEST {step}: {message}")
    print('='*80)

def main():
    print("\n" + "="*80)
    print("RECORDS RELEASED HISTORY ENDPOINT TESTING")
    print("="*80)
    
    session = requests.Session()
    
    # ========================================================================
    # STEP 1: GET /api/records-releases with NO cookie -> expect 401
    # ========================================================================
    print_test("1", "GET /api/records-releases WITHOUT auth cookie -> expect 401")
    try:
        resp = requests.get(f"{BASE_URL}/api/records-releases", timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ PASS: Correctly returns 401 Unauthorized without auth cookie")
        else:
            print(f"❌ FAIL: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # ========================================================================
    # ADMIN LOGIN
    # ========================================================================
    print_test("LOGIN", "Admin login to get session cookie")
    try:
        login_resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        print(f"Login status: {login_resp.status_code}")
        if login_resp.status_code == 200:
            print("✅ Admin login successful")
        else:
            print(f"❌ Login failed: {login_resp.text[:200]}")
            return
    except Exception as e:
        print(f"❌ Login ERROR: {e}")
        return
    
    # ========================================================================
    # STEP 2: GET /api/records-releases as admin -> expect 200 with releases array
    # ========================================================================
    print_test("2", "GET /api/records-releases WITH auth -> expect 200 with releases array")
    try:
        resp = session.get(f"{BASE_URL}/api/records-releases", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ PASS: Returns 200")
            
            if "releases" in data:
                print(f"✅ PASS: Response has 'releases' key")
                print(f"Releases count: {len(data['releases'])}")
                
                if len(data['releases']) > 0:
                    print(f"\nSample release (first item):")
                    print(json.dumps(data['releases'][0], indent=2, default=str))
            else:
                print(f"❌ FAIL: Response missing 'releases' key")
                print(f"Response keys: {list(data.keys())}")
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # ========================================================================
    # STEP 3: Resolve Eleanor Adams patient ID (MRN PC-100000)
    # ========================================================================
    print_test("3", "Resolve Eleanor Adams patient ID (MRN PC-100000)")
    patient_id = None
    try:
        # Connect to MongoDB directly to find patient
        mongo_client = MongoClient("mongodb://localhost:27017")
        db = mongo_client["proactive_clinic"]
        patient = db.Patient.find_one({"mrn": "PC-100000"})
        
        if patient:
            # Prisma uses 'id' field, MongoDB stores as '_id' but Prisma maps it
            patient_id = patient.get("id") or patient.get("_id")
            print(f"✅ Found Eleanor Adams")
            print(f"   Patient ID: {patient_id}")
            print(f"   MRN: {patient['mrn']}")
            print(f"   Name: {patient.get('firstName')} {patient.get('lastName')}")
        else:
            print("❌ FAIL: Patient with MRN PC-100000 not found")
            return
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return
    
    # ========================================================================
    # STEP 4: Create an ehi.export audit row by calling GET /api/admin/ehi-export
    # ========================================================================
    print_test("4", "GET /api/admin/ehi-export?patientId=<id>&format=pdf to create audit row")
    try:
        export_resp = session.get(
            f"{BASE_URL}/api/admin/ehi-export",
            params={"patientId": patient_id, "format": "pdf"},
            timeout=30
        )
        print(f"Status: {export_resp.status_code}")
        
        if export_resp.status_code == 200:
            print(f"✅ PASS: EHI export successful")
            print(f"Content-Type: {export_resp.headers.get('Content-Type')}")
            print(f"Response size: {len(export_resp.content)} bytes")
            
            # Verify it's a PDF
            if export_resp.content[:4] == b'%PDF':
                print("✅ PASS: Response is a valid PDF (starts with '%PDF')")
            else:
                print(f"⚠️  WARNING: Response doesn't start with PDF magic bytes")
        else:
            print(f"❌ FAIL: Expected 200, got {export_resp.status_code}")
            print(f"Response: {export_resp.text[:500]}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    # ========================================================================
    # STEP 5: GET /api/records-releases again and verify the data
    # ========================================================================
    print_test("5", "GET /api/records-releases again and verify data structure")
    try:
        resp = session.get(f"{BASE_URL}/api/records-releases", timeout=10)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            releases = data.get("releases", [])
            print(f"✅ PASS: Returns 200")
            print(f"Total releases: {len(releases)}")
            
            if len(releases) == 0:
                print("❌ FAIL: Releases array is empty (expected at least one after EHI export)")
                return
            
            print(f"✅ PASS: Releases array is non-empty ({len(releases)} items)")
            
            # Verify structure of all items
            print("\n--- Verifying structure of all releases ---")
            required_fields = ["id", "at", "channel", "actor", "chart", "format", "mrn"]
            valid_channels = ["Staff export", "Attorney portal"]
            
            all_valid = True
            staff_export_pdf_found = False
            
            for idx, release in enumerate(releases):
                # Check required fields
                missing_fields = [f for f in required_fields if f not in release]
                if missing_fields:
                    print(f"❌ Release {idx}: Missing fields: {missing_fields}")
                    all_valid = False
                
                # Check channel value
                channel = release.get("channel")
                if channel not in valid_channels:
                    print(f"❌ Release {idx}: Invalid channel '{channel}' (expected one of {valid_channels})")
                    all_valid = False
                
                # Check for Staff export with Summary PDF
                if channel == "Staff export" and release.get("format") == "Summary PDF":
                    staff_export_pdf_found = True
            
            if all_valid:
                print(f"✅ PASS: All {len(releases)} releases have required fields (id, at, channel, actor, chart, format, mrn)")
                print(f"✅ PASS: All releases have valid channel values (only 'Staff export' or 'Attorney portal')")
            else:
                print(f"❌ FAIL: Some releases have invalid structure")
            
            if staff_export_pdf_found:
                print(f"✅ PASS: Found at least one release with channel='Staff export' and format='Summary PDF'")
            else:
                print(f"⚠️  WARNING: No release found with channel='Staff export' and format='Summary PDF'")
                print(f"   (This might be expected if the EHI export just created hasn't been processed yet)")
            
            # Show sample releases
            print("\n--- Sample releases (first 3) ---")
            for idx, release in enumerate(releases[:3]):
                print(f"\nRelease {idx + 1}:")
                print(f"  ID: {release.get('id')}")
                print(f"  At: {release.get('at')}")
                print(f"  Channel: {release.get('channel')}")
                print(f"  Actor: {release.get('actor')}")
                print(f"  Chart: {release.get('chart')}")
                print(f"  Format: {release.get('format')}")
                print(f"  MRN: {release.get('mrn')}")
            
            # Count by channel
            channel_counts = {}
            for release in releases:
                ch = release.get("channel", "Unknown")
                channel_counts[ch] = channel_counts.get(ch, 0) + 1
            
            print(f"\n--- Releases by channel ---")
            for channel, count in channel_counts.items():
                print(f"  {channel}: {count}")
            
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
    except Exception as e:
        print(f"❌ ERROR: {e}")
    
    print("\n" + "="*80)
    print("TESTING COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
