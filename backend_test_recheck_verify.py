#!/usr/bin/env python3
"""
Test recheck with a provider that should be flagged.
"""
import requests
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
STAFF_EMAIL = "admin@proactiveclinic.com"
STAFF_PASSWORD = "apex123"

def login_staff():
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": STAFF_EMAIL, "password": STAFF_PASSWORD}
    resp = requests.post(url, json=payload, timeout=30)
    if resp.status_code == 200:
        return resp.cookies.get("proactive_session")
    return None

def main():
    print("=== Recheck Test ===\n")
    
    session = login_staff()
    if not session:
        print("❌ Login failed")
        sys.exit(1)
    
    cookies = {"proactive_session": session}
    
    # Run recheck
    print("Running recheck...")
    url = f"{BASE_URL}/api/credentialing/recheck"
    resp = requests.post(url, cookies=cookies, timeout=120)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        data = resp.json()
        print(f"\n=== RECHECK RESULT ===")
        print(f"ok: {data.get('ok')}")
        print(f"checked: {data.get('checked')}")
        print(f"excludedCount: {data.get('excludedCount')}")
        print(f"newlyExcluded: {data.get('newlyExcluded')}")
        print(f"cleared: {data.get('cleared')}")
        
        # Get providers to see their status
        print(f"\n=== PROVIDERS STATUS ===")
        get_resp = requests.get(f"{BASE_URL}/api/credentialing/providers", cookies=cookies, timeout=30)
        if get_resp.status_code == 200:
            providers = get_resp.json().get("providers", [])
            for p in providers:
                if p.get("firstName") == "John" and p.get("lastName") == "Smith":
                    print(f"\nProvider: {p.get('firstName')} {p.get('lastName')}")
                    print(f"  ID: {p.get('id')}")
                    print(f"  NPI: {p.get('npi')}")
                    print(f"  Status: {p.get('status')}")
                    print(f"  Excluded: {p.get('excluded')}")
                    print(f"  ExcludedReason: {p.get('excludedReason')}")
    else:
        print(f"❌ Recheck failed: {resp.text}")

if __name__ == "__main__":
    main()
