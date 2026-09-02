#!/usr/bin/env python3
"""
Quick re-test of SAM.gov live screening in the Credentialing validate endpoint.
Staff auth: POST /api/auth/login admin@proactiveclinic.com / apex123.
Get a real NPI from NPPES, create provider, validate, report sam/oig/nppes VERBATIM.
"""
import requests
import json
import sys

BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

def main():
    print("=" * 80)
    print("SAM.GOV LIVE SCREENING RE-TEST")
    print("=" * 80)
    
    session = requests.Session()
    
    # STEP 1: Staff login
    print("\n[STEP 1] Staff login: admin@proactiveclinic.com / apex123")
    try:
        login_res = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@proactiveclinic.com", "password": "apex123"},
            timeout=30
        )
        print(f"  Status: {login_res.status_code}")
        if login_res.status_code != 200:
            print(f"  ❌ Login failed: {login_res.text[:200]}")
            sys.exit(1)
        print("  ✅ Login successful")
    except Exception as e:
        print(f"  ❌ Login exception: {e}")
        sys.exit(1)
    
    # STEP 2: Get a real NPI from NPPES
    print("\n[STEP 2] Get real NPI from NPPES registry")
    try:
        # Use last_name=smith for better results
        nppes_url = "https://npiregistry.cms.hhs.gov/api/?version=2.1&last_name=smith&state=CA&limit=1&enumeration_type=NPI-1"
        nppes_res = requests.get(nppes_url, timeout=30)
        print(f"  Status: {nppes_res.status_code}")
        if nppes_res.status_code != 200:
            print(f"  ❌ NPPES request failed: {nppes_res.text[:200]}")
            sys.exit(1)
        nppes_data = nppes_res.json()
        if not nppes_data.get("results"):
            print(f"  ❌ No NPPES results found")
            sys.exit(1)
        
        result = nppes_data["results"][0]
        npi = result["number"]
        basic = result.get("basic", {})
        first_name = basic.get("first_name", "John")
        last_name = basic.get("last_name", "Smith")
        
        print(f"  ✅ Found NPI: {npi}")
        print(f"     Name: {first_name} {last_name}")
    except Exception as e:
        print(f"  ❌ NPPES exception: {e}")
        sys.exit(1)
    
    # STEP 3: Create provider with real NPI
    print(f"\n[STEP 3] Create provider with NPI {npi}")
    try:
        create_res = session.post(
            f"{BASE_URL}/api/credentialing/providers",
            json={
                "npi": npi,
                "firstName": first_name,
                "lastName": last_name
            },
            timeout=30
        )
        print(f"  Status: {create_res.status_code}")
        if create_res.status_code == 409:
            print(f"  ⚠️  Provider already exists (409), fetching existing provider...")
            # Get existing provider
            list_res = session.get(f"{BASE_URL}/api/credentialing/providers", timeout=30)
            if list_res.status_code == 200:
                providers = list_res.json().get("providers", [])
                provider = next((p for p in providers if p.get("npi") == npi), None)
                if provider:
                    provider_id = provider["id"]
                    print(f"  ✅ Using existing provider ID: {provider_id}")
                else:
                    print(f"  ❌ Could not find existing provider with NPI {npi}")
                    sys.exit(1)
            else:
                print(f"  ❌ Failed to fetch providers: {list_res.text[:200]}")
                sys.exit(1)
        elif create_res.status_code == 200:
            create_data = create_res.json()
            provider_id = create_data.get("provider", {}).get("id")
            print(f"  ✅ Provider created, ID: {provider_id}")
        else:
            print(f"  ❌ Create failed: {create_res.text[:200]}")
            sys.exit(1)
    except Exception as e:
        print(f"  ❌ Create exception: {e}")
        sys.exit(1)
    
    # STEP 4: Validate provider (SAM.gov live call)
    print(f"\n[STEP 4] Validate provider {provider_id} (SAM.gov live screening)")
    print("  ⏳ This may take 5-10 seconds for live Gov API calls...")
    try:
        validate_res = session.post(
            f"{BASE_URL}/api/credentialing/providers/{provider_id}/validate",
            timeout=60
        )
        print(f"  Status: {validate_res.status_code}")
        if validate_res.status_code != 200:
            print(f"  ❌ Validate failed: {validate_res.text[:500]}")
            sys.exit(1)
        
        validate_data = validate_res.json()
        validation_result = validate_data.get("validationResult", {})
        
        print("  ✅ Validation completed")
        print("\n" + "=" * 80)
        print("VALIDATION RESULT (VERBATIM)")
        print("=" * 80)
        
        # Report NPPES
        nppes_result = validation_result.get("nppes", {})
        print("\n[NPPES]")
        print(json.dumps(nppes_result, indent=2))
        
        # Report OIG
        oig_result = validation_result.get("oig", {})
        print("\n[OIG]")
        print(json.dumps(oig_result, indent=2))
        
        # Report SAM (KEY ASSERTION)
        sam_result = validation_result.get("sam", {})
        print("\n[SAM] ⭐ KEY ASSERTION ⭐")
        print(json.dumps(sam_result, indent=2))
        
        # Check key assertion
        sam_screened = sam_result.get("screened")
        print("\n" + "=" * 80)
        print("KEY ASSERTION CHECK")
        print("=" * 80)
        print(f"sam.screened = {sam_screened} (type: {type(sam_screened).__name__})")
        
        if sam_screened is True:
            print("✅ PASS: sam.screened === true (SAM.gov v4 API call succeeded, no 404/406)")
        elif sam_screened is False:
            print("❌ FAIL: sam.screened === false (SAM.gov API call did not succeed)")
            print(f"   Note: {sam_result.get('note', 'N/A')}")
        else:
            print(f"⚠️  UNEXPECTED: sam.screened is {sam_screened} (expected boolean)")
        
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Provider ID: {provider_id}")
        print(f"NPI: {npi}")
        print(f"Name: {first_name} {last_name}")
        print(f"Validation passed: {validate_data.get('passed')}")
        print(f"\nNPPES: screened={nppes_result.get('ok')}")
        print(f"OIG: screened={oig_result.get('screened')}, excluded={oig_result.get('excluded')}")
        print(f"SAM: screened={sam_result.get('screened')}, excluded={sam_result.get('excluded')}")
        
        print("\n✅ Test completed successfully")
        
    except Exception as e:
        print(f"  ❌ Validate exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
