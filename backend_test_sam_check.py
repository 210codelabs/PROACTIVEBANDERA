#!/usr/bin/env python3
"""
Quick test to check SAM.gov response for John Smith.
"""
import requests
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"
STAFF_EMAIL = "admin@proactiveclinic.com"
STAFF_PASSWORD = "apex123"

def login_staff():
    """Login as staff and return session cookie."""
    url = f"{BASE_URL}/api/auth/login"
    payload = {"email": STAFF_EMAIL, "password": STAFF_PASSWORD}
    resp = requests.post(url, json=payload, timeout=30)
    if resp.status_code == 200:
        return resp.cookies.get("proactive_session")
    return None

def get_real_npi():
    """Get a real NPI."""
    url = "https://npiregistry.cms.hhs.gov/api/?version=2.1&last_name=jones&state=TX&limit=1&enumeration_type=NPI-1"
    resp = requests.get(url, timeout=30)
    if resp.status_code == 200:
        data = resp.json()
        if data.get("results") and len(data["results"]) > 0:
            return data["results"][0]["number"]
    return None

def main():
    print("=== SAM.gov Check Test ===\n")
    
    session = login_staff()
    if not session:
        print("❌ Login failed")
        sys.exit(1)
    
    npi = get_real_npi()
    if not npi:
        print("❌ Failed to get NPI")
        sys.exit(1)
    
    print(f"Using NPI: {npi}\n")
    
    # Create a provider with John Smith name
    url = f"{BASE_URL}/api/credentialing/providers"
    payload = {
        "npi": npi,
        "firstName": "John",
        "lastName": "Smith"
    }
    cookies = {"proactive_session": session}
    
    print(f"Creating provider: John Smith with NPI {npi}")
    resp = requests.post(url, json=payload, cookies=cookies, timeout=30)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 409:
        print("Provider already exists, getting existing provider...")
        get_resp = requests.get(f"{BASE_URL}/api/credentialing/providers", cookies=cookies, timeout=30)
        if get_resp.status_code == 200:
            providers = get_resp.json().get("providers", [])
            for p in providers:
                if p.get("npi") == npi:
                    provider_id = p["id"]
                    print(f"Found existing provider: {provider_id}")
                    break
    elif resp.status_code == 200:
        data = resp.json()
        provider_id = data["provider"]["id"]
        print(f"Created provider: {provider_id}")
    else:
        print(f"❌ Failed to create provider: {resp.text}")
        sys.exit(1)
    
    # Validate the provider to see SAM.gov response
    print(f"\nValidating provider {provider_id}...")
    validate_url = f"{BASE_URL}/api/credentialing/providers/{provider_id}/validate"
    validate_resp = requests.post(validate_url, cookies=cookies, timeout=60)
    print(f"Status: {validate_resp.status_code}")
    
    if validate_resp.status_code == 200:
        data = validate_resp.json()
        print(f"\n=== VALIDATION RESULT ===")
        print(f"Passed: {data.get('passed')}")
        
        validation_result = data.get("validationResult", {})
        
        print(f"\nNPPES:")
        nppes = validation_result.get("nppes", {})
        print(f"  ok: {nppes.get('ok')}")
        print(f"  name: {nppes.get('name')}")
        print(f"  status: {nppes.get('status')}")
        
        print(f"\nOIG LEIE:")
        oig = validation_result.get("oig", {})
        print(f"  screened: {oig.get('screened')}")
        print(f"  excluded: {oig.get('excluded')}")
        print(f"  note: {oig.get('note')}")
        
        print(f"\nSAM.gov:")
        sam = validation_result.get("sam", {})
        print(f"  screened: {sam.get('screened')}")
        print(f"  excluded: {sam.get('excluded')}")
        print(f"  note: {sam.get('note')}")
        if sam.get('raw'):
            print(f"  raw: {sam.get('raw')}")
        
        provider = data.get("provider", {})
        print(f"\nProvider Status:")
        print(f"  status: {provider.get('status')}")
        print(f"  excluded: {provider.get('excluded')}")
        print(f"  excludedReason: {provider.get('excludedReason')}")
    else:
        print(f"❌ Validation failed: {validate_resp.text}")

if __name__ == "__main__":
    main()
