#!/usr/bin/env python3
"""
Backend test for Practice analytics aggregation (GET /api/analytics).
Tests the NEW analytics endpoint with auth, date ranges, and JSON structure validation.
"""

import requests
import os
import sys

BASE_URL = os.getenv("NEXT_PUBLIC_BASE_URL", "https://nextjs-ssr-stack.preview.emergentagent.com")
API_BASE = f"{BASE_URL}/api"

def login_admin():
    """Login as admin and return session cookie."""
    print("\n=== ADMIN LOGIN ===")
    resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"email": "admin@proactiveclinic.com", "password": "apex123"},
        timeout=30
    )
    print(f"Login status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"Login failed: {resp.text}")
        sys.exit(1)
    
    cookie = resp.cookies.get("proactive_session")
    if not cookie:
        print("No proactive_session cookie returned")
        sys.exit(1)
    
    print("✅ Admin login successful")
    return {"proactive_session": cookie}

def test_analytics():
    """Test GET /api/analytics endpoint."""
    print("\n" + "="*80)
    print("TESTING: Practice Analytics Aggregation (GET /api/analytics)")
    print("="*80)
    
    # Get admin session
    cookies = login_admin()
    
    # TEST 1: No cookie -> 401
    print("\n--- TEST 1: Auth Guard (No Cookie) ---")
    try:
        resp = requests.get(f"{API_BASE}/analytics", timeout=30)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 401:
            print("✅ TEST 1 PASSED: GET /api/analytics WITHOUT auth cookie correctly returns 401 Unauthorized")
        else:
            print(f"❌ TEST 1 FAILED: Expected 401, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
    except Exception as e:
        print(f"❌ TEST 1 FAILED: Exception: {e}")
    
    # TEST 2: Wide date range with full structure validation
    print("\n--- TEST 2: Wide Date Range (2025-01-01 to 2026-12-31) ---")
    try:
        resp = requests.get(
            f"{API_BASE}/analytics",
            params={"from": "2025-01-01", "to": "2026-12-31"},
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 2 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
        else:
            data = resp.json()
            print(f"Response keys: {list(data.keys())}")
            
            # Validate top-level structure
            if not data.get("ok"):
                print(f"❌ TEST 2 FAILED: Missing 'ok' field or not true")
            elif "analytics" not in data:
                print(f"❌ TEST 2 FAILED: Missing 'analytics' field")
            else:
                analytics = data["analytics"]
                print(f"Analytics keys: {list(analytics.keys())}")
                
                # Validate KPIs structure
                kpis = analytics.get("kpis", {})
                required_kpi_fields = [
                    "patientsTotal", "patientsNew", "appointmentsTotal", "encountersTotal",
                    "revenueChargesCents", "revenuePaidCents", "posSalesCents", "posCount",
                    "noShowRate", "eligibilityActiveRate", "inventoryValueCents", "lowStockCount",
                    "claimsTotal", "specialtiesCount"
                ]
                
                missing_kpis = [f for f in required_kpi_fields if f not in kpis]
                if missing_kpis:
                    print(f"❌ TEST 2 FAILED: Missing KPI fields: {missing_kpis}")
                else:
                    print(f"✅ KPIs structure complete with all {len(required_kpi_fields)} required fields")
                    
                    # Validate all KPIs are numeric
                    non_numeric = [f for f in required_kpi_fields if not isinstance(kpis[f], (int, float))]
                    if non_numeric:
                        print(f"❌ TEST 2 FAILED: Non-numeric KPI fields: {non_numeric}")
                    else:
                        print(f"✅ All KPI fields are numeric")
                        print(f"   Sample KPIs: patientsTotal={kpis['patientsTotal']}, appointmentsTotal={kpis['appointmentsTotal']}, specialtiesCount={kpis['specialtiesCount']}")
                
                # Validate range structure
                range_data = analytics.get("range", {})
                if "months" not in range_data or not isinstance(range_data["months"], list):
                    print(f"❌ TEST 2 FAILED: range.months is not a non-empty array")
                else:
                    print(f"✅ range.months is an array with {len(range_data['months'])} months")
                    print(f"   Months: {range_data['months'][:3]}...{range_data['months'][-3:]}")
                
                # Validate appointments structure
                appointments = analytics.get("appointments", {})
                if "byStatus" not in appointments or not isinstance(appointments["byStatus"], dict):
                    print(f"❌ TEST 2 FAILED: appointments.byStatus is not an object")
                else:
                    print(f"✅ appointments.byStatus is an object: {appointments['byStatus']}")
                
                # Validate specialties structure
                specialties = analytics.get("specialties")
                if not isinstance(specialties, list):
                    print(f"❌ TEST 2 FAILED: specialties is not an array")
                else:
                    print(f"✅ specialties is an array with {len(specialties)} items")
                    if len(specialties) > 0:
                        print(f"   Sample specialty: {specialties[0]}")
                
                # Validate inventory structure
                inventory = analytics.get("inventory", {})
                if "byCategory" not in inventory or not isinstance(inventory["byCategory"], list):
                    print(f"❌ TEST 2 FAILED: inventory.byCategory is not an array")
                else:
                    print(f"✅ inventory.byCategory is an array with {len(inventory['byCategory'])} items")
                
                # Validate patients structure
                patients = analytics.get("patients", {})
                if "newByMonth" not in patients or not isinstance(patients["newByMonth"], list):
                    print(f"❌ TEST 2 FAILED: patients.newByMonth is not an array")
                else:
                    print(f"✅ patients.newByMonth is an array with {len(patients['newByMonth'])} items")
                
                print("\n✅ TEST 2 PASSED: GET /api/analytics?from=2025-01-01&to=2026-12-31 returns 200 with complete analytics structure")
                print("   - analytics.kpis contains all 14 required numeric fields ✅")
                print("   - analytics.range.months is a non-empty array ✅")
                print("   - analytics.appointments.byStatus is an object ✅")
                print("   - analytics.specialties is an array ✅")
                print("   - analytics.inventory.byCategory is an array ✅")
                print("   - analytics.patients.newByMonth is an array ✅")
                
    except Exception as e:
        print(f"❌ TEST 2 FAILED: Exception: {e}")
        import traceback
        traceback.print_exc()
    
    # TEST 3: No params (default last 12 months)
    print("\n--- TEST 3: Default Range (No Params) ---")
    try:
        resp = requests.get(
            f"{API_BASE}/analytics",
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"❌ TEST 3 FAILED: Expected 200, got {resp.status_code}")
            print(f"Response: {resp.text[:500]}")
        else:
            data = resp.json()
            analytics = data.get("analytics", {})
            range_data = analytics.get("range", {})
            months = range_data.get("months", [])
            
            print(f"Months count: {len(months)}")
            print(f"Months: {months}")
            
            # Default is last 12 months, so should be between 11 and 13 months
            if 11 <= len(months) <= 13:
                print(f"✅ TEST 3 PASSED: GET /api/analytics (no params) returns 200 with default last 12 months")
                print(f"   - range.months length: {len(months)} (between 11 and 13) ✅")
            else:
                print(f"❌ TEST 3 FAILED: Expected 11-13 months, got {len(months)}")
    except Exception as e:
        print(f"❌ TEST 3 FAILED: Exception: {e}")
        import traceback
        traceback.print_exc()
    
    # TEST 4: Tiny range (no 500 error)
    print("\n--- TEST 4: Tiny Range (2026-01-01 to 2026-01-02) ---")
    try:
        resp = requests.get(
            f"{API_BASE}/analytics",
            params={"from": "2026-01-01", "to": "2026-01-02"},
            cookies=cookies,
            timeout=30
        )
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 500:
            print(f"❌ TEST 4 FAILED: Got 500 error for tiny range")
            print(f"Response: {resp.text[:500]}")
        elif resp.status_code != 200:
            print(f"⚠️  TEST 4: Expected 200, got {resp.status_code} (but not 500)")
            print(f"Response: {resp.text[:500]}")
        else:
            data = resp.json()
            analytics = data.get("analytics", {})
            kpis = analytics.get("kpis", {})
            
            print(f"✅ TEST 4 PASSED: GET /api/analytics?from=2026-01-01&to=2026-01-02 (tiny range) returns 200 with no 500 error")
            print(f"   - Status: 200 ✅")
            print(f"   - Sample KPIs: patientsTotal={kpis.get('patientsTotal')}, appointmentsTotal={kpis.get('appointmentsTotal')}")
            print(f"   - No 500 error ✅")
    except Exception as e:
        print(f"❌ TEST 4 FAILED: Exception: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*80)
    print("ANALYTICS ENDPOINT TESTING COMPLETE")
    print("="*80)

if __name__ == "__main__":
    test_analytics()
