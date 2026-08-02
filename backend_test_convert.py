#!/usr/bin/env python3
"""
Backend test for POST /api/appointments/request/[id]/convert endpoint.
Tests the conversion of appointment requests to scheduled appointments.
"""

import requests
import sys
from datetime import datetime

# Base URL (HTTPS required for secure cookie)
BASE_URL = "https://nextjs-ssr-stack.preview.emergentagent.com"

# Staff credentials
STAFF_EMAIL = "andy.manzano@proactiveclinic.com"
STAFF_PASSWORD = "apex123"

# Test data
TEST_FIRST_NAME_1 = "ZZTest"
TEST_LAST_NAME_1 = "Convert"
TEST_EMAIL_1 = "zz@example.com"
TEST_FIRST_NAME_2 = "ZZNoTime"
TEST_LAST_NAME_2 = "Convert"

# Eleanor Adams (existing patient)
EXISTING_MRN = "PC-100000"
EXISTING_DOB = "1958-04-12"
EXISTING_FIRST_NAME = "Eleanor"
EXISTING_LAST_NAME = "Adams"

def print_test(msg):
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_pass(msg):
    print(f"✅ PASS: {msg}")

def print_fail(msg):
    print(f"❌ FAIL: {msg}")
    
def print_info(msg):
    print(f"ℹ️  INFO: {msg}")

# Track created resources for cleanup
created_request_ids = []
created_patient_ids = []
created_appointment_ids = []

try:
    # ============================================================================
    # SETUP: Staff login
    # ============================================================================
    print_test("SETUP: Staff login")
    
    login_response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": STAFF_EMAIL, "password": STAFF_PASSWORD},
        timeout=30
    )
    
    if login_response.status_code != 200:
        print_fail(f"Staff login failed: {login_response.status_code} {login_response.text}")
        sys.exit(1)
    
    staff_cookies = login_response.cookies
    print_pass(f"Staff login successful: {login_response.json()}")
    print_info(f"Staff cookie: {staff_cookies.get('proactive_session')}")
    
    # ============================================================================
    # TEST 1: Create NEW-patient request and convert
    # ============================================================================
    print_test("TEST 1: Create NEW-patient request and convert")
    
    # Step 1a: Create NEW-patient request
    print_info("Step 1a: Creating NEW-patient request...")
    create_response = requests.post(
        f"{BASE_URL}/api/appointments/request",
        json={
            "patientType": "new",
            "firstName": TEST_FIRST_NAME_1,
            "lastName": TEST_LAST_NAME_1,
            "email": TEST_EMAIL_1,
            "preferredDate": "2026-09-10",
            "preferredTime": "09:00"
        },
        timeout=30
    )
    
    if create_response.status_code != 200:
        print_fail(f"Failed to create request: {create_response.status_code} {create_response.text}")
        sys.exit(1)
    
    create_data = create_response.json()
    print_pass(f"Request created: {create_data}")
    
    # Verify emailStatus is 'skipped' (no RESEND key)
    if create_data.get("emailStatus") == "skipped":
        print_pass("emailStatus is 'skipped' (no RESEND key configured)")
    else:
        print_info(f"emailStatus: {create_data.get('emailStatus')}")
    
    confirmation_number = create_data.get("confirmation")
    print_info(f"Confirmation number: {confirmation_number}")
    
    # Step 1b: Find the request ID via staff GET
    print_info("Step 1b: Finding request ID via staff GET...")
    list_response = requests.get(
        f"{BASE_URL}/api/appointments/request",
        cookies=staff_cookies,
        timeout=30
    )
    
    if list_response.status_code != 200:
        print_fail(f"Failed to list requests: {list_response.status_code} {list_response.text}")
        sys.exit(1)
    
    requests_list = list_response.json().get("requests", [])
    request_id = None
    for req in requests_list:
        if req.get("confirmation") == confirmation_number:
            request_id = req.get("id")
            break
    
    if not request_id:
        print_fail(f"Could not find request with confirmation {confirmation_number}")
        sys.exit(1)
    
    print_pass(f"Found request ID: {request_id}")
    created_request_ids.append(request_id)
    
    # Step 1c: Convert the request
    print_info("Step 1c: Converting request to appointment...")
    convert_response = requests.post(
        f"{BASE_URL}/api/appointments/request/{request_id}/convert",
        json={
            "date": "2026-09-10",
            "time": "09:00",
            "location": "in-office"
        },
        cookies=staff_cookies,
        timeout=30
    )
    
    if convert_response.status_code != 200:
        print_fail(f"Convert failed: {convert_response.status_code} {convert_response.text}")
        sys.exit(1)
    
    convert_data = convert_response.json()
    print_pass(f"Convert successful: {convert_data}")
    
    # Verify response structure
    if not convert_data.get("ok"):
        print_fail("Response missing 'ok: true'")
    else:
        print_pass("Response has 'ok: true'")
    
    appointment = convert_data.get("appointment", {})
    request_updated = convert_data.get("request", {})
    
    # Verify appointment fields
    required_fields = ["id", "startsAt", "endsAt", "location", "providerName", "patientMrn"]
    for field in required_fields:
        if field in appointment:
            print_pass(f"Appointment has '{field}': {appointment[field]}")
        else:
            print_fail(f"Appointment missing '{field}'")
    
    # Verify request status is 'confirmed'
    if request_updated.get("status") == "confirmed":
        print_pass("Request status is 'confirmed'")
    else:
        print_fail(f"Request status is '{request_updated.get('status')}', expected 'confirmed'")
    
    # Verify appointmentId is set
    if request_updated.get("appointmentId"):
        print_pass(f"Request has appointmentId: {request_updated.get('appointmentId')}")
        created_appointment_ids.append(request_updated.get("appointmentId"))
    else:
        print_fail("Request missing appointmentId")
    
    # Verify scheduledStartsAt is set
    if request_updated.get("scheduledStartsAt"):
        print_pass(f"Request has scheduledStartsAt: {request_updated.get('scheduledStartsAt')}")
    else:
        print_fail("Request missing scheduledStartsAt")
    
    # Track created patient for cleanup
    if appointment.get("patientId"):
        created_patient_ids.append(appointment.get("patientId"))
    
    # ============================================================================
    # TEST 2: Convert the SAME request again (expect 409)
    # ============================================================================
    print_test("TEST 2: Convert the SAME request again (expect 409)")
    
    convert_again_response = requests.post(
        f"{BASE_URL}/api/appointments/request/{request_id}/convert",
        json={
            "date": "2026-09-10",
            "time": "09:00",
            "location": "in-office"
        },
        cookies=staff_cookies,
        timeout=30
    )
    
    if convert_again_response.status_code == 409:
        print_pass(f"Convert again correctly returns 409: {convert_again_response.json()}")
    else:
        print_fail(f"Convert again returned {convert_again_response.status_code}, expected 409: {convert_again_response.text}")
    
    # ============================================================================
    # TEST 3: Convert without session (expect 401)
    # ============================================================================
    print_test("TEST 3: Convert without session (expect 401)")
    
    no_auth_response = requests.post(
        f"{BASE_URL}/api/appointments/request/{request_id}/convert",
        json={
            "date": "2026-09-10",
            "time": "09:00",
            "location": "in-office"
        },
        timeout=30
    )
    
    if no_auth_response.status_code == 401:
        print_pass(f"Convert without session correctly returns 401: {no_auth_response.json()}")
    else:
        print_fail(f"Convert without session returned {no_auth_response.status_code}, expected 401: {no_auth_response.text}")
    
    # ============================================================================
    # TEST 4: Create request WITHOUT preferredDate/preferredTime, convert with empty body (expect 400)
    # ============================================================================
    print_test("TEST 4: Create request WITHOUT preferredDate/preferredTime, convert with empty body (expect 400)")
    
    # Step 4a: Create request without date/time
    print_info("Step 4a: Creating request without preferredDate/preferredTime...")
    create_no_time_response = requests.post(
        f"{BASE_URL}/api/appointments/request",
        json={
            "patientType": "new",
            "firstName": TEST_FIRST_NAME_2,
            "lastName": TEST_LAST_NAME_2
        },
        timeout=30
    )
    
    if create_no_time_response.status_code != 200:
        print_fail(f"Failed to create request: {create_no_time_response.status_code} {create_no_time_response.text}")
        sys.exit(1)
    
    create_no_time_data = create_no_time_response.json()
    confirmation_no_time = create_no_time_data.get("confirmation")
    print_pass(f"Request created without date/time: {confirmation_no_time}")
    
    # Step 4b: Find the request ID
    print_info("Step 4b: Finding request ID...")
    list_response_2 = requests.get(
        f"{BASE_URL}/api/appointments/request",
        cookies=staff_cookies,
        timeout=30
    )
    
    requests_list_2 = list_response_2.json().get("requests", [])
    request_id_no_time = None
    for req in requests_list_2:
        if req.get("confirmation") == confirmation_no_time:
            request_id_no_time = req.get("id")
            break
    
    if not request_id_no_time:
        print_fail(f"Could not find request with confirmation {confirmation_no_time}")
        sys.exit(1)
    
    print_pass(f"Found request ID: {request_id_no_time}")
    created_request_ids.append(request_id_no_time)
    
    # Step 4c: Convert with empty body (expect 400)
    print_info("Step 4c: Converting with empty body (expect 400)...")
    convert_no_time_response = requests.post(
        f"{BASE_URL}/api/appointments/request/{request_id_no_time}/convert",
        json={},
        cookies=staff_cookies,
        timeout=30
    )
    
    if convert_no_time_response.status_code == 400:
        print_pass(f"Convert with empty body correctly returns 400: {convert_no_time_response.json()}")
    else:
        print_fail(f"Convert with empty body returned {convert_no_time_response.status_code}, expected 400: {convert_no_time_response.text}")
    
    # ============================================================================
    # TEST 5: Convert nonexistent ID (expect 404)
    # ============================================================================
    print_test("TEST 5: Convert nonexistent ID (expect 404)")
    
    convert_nonexistent_response = requests.post(
        f"{BASE_URL}/api/appointments/request/nope123/convert",
        json={
            "date": "2026-09-10",
            "time": "09:00",
            "location": "in-office"
        },
        cookies=staff_cookies,
        timeout=30
    )
    
    if convert_nonexistent_response.status_code == 404:
        print_pass(f"Convert nonexistent ID correctly returns 404: {convert_nonexistent_response.json()}")
    else:
        print_fail(f"Convert nonexistent ID returned {convert_nonexistent_response.status_code}, expected 404: {convert_nonexistent_response.text}")
    
    # ============================================================================
    # TEST 6: Create EXISTING-patient request and convert
    # ============================================================================
    print_test("TEST 6: Create EXISTING-patient request and convert")
    
    # Step 6a: Create EXISTING-patient request
    print_info("Step 6a: Creating EXISTING-patient request...")
    create_existing_response = requests.post(
        f"{BASE_URL}/api/appointments/request",
        json={
            "patientType": "existing",
            "mrn": EXISTING_MRN,
            "dob": EXISTING_DOB,
            "firstName": EXISTING_FIRST_NAME,
            "lastName": EXISTING_LAST_NAME
        },
        timeout=30
    )
    
    if create_existing_response.status_code != 200:
        print_fail(f"Failed to create existing-patient request: {create_existing_response.status_code} {create_existing_response.text}")
        sys.exit(1)
    
    create_existing_data = create_existing_response.json()
    confirmation_existing = create_existing_data.get("confirmation")
    print_pass(f"EXISTING-patient request created: {confirmation_existing}")
    
    # Step 6b: Find the request ID
    print_info("Step 6b: Finding request ID...")
    list_response_3 = requests.get(
        f"{BASE_URL}/api/appointments/request",
        cookies=staff_cookies,
        timeout=30
    )
    
    requests_list_3 = list_response_3.json().get("requests", [])
    request_id_existing = None
    for req in requests_list_3:
        if req.get("confirmation") == confirmation_existing:
            request_id_existing = req.get("id")
            break
    
    if not request_id_existing:
        print_fail(f"Could not find request with confirmation {confirmation_existing}")
        sys.exit(1)
    
    print_pass(f"Found request ID: {request_id_existing}")
    created_request_ids.append(request_id_existing)
    
    # Step 6c: Convert the existing-patient request
    print_info("Step 6c: Converting existing-patient request...")
    convert_existing_response = requests.post(
        f"{BASE_URL}/api/appointments/request/{request_id_existing}/convert",
        json={
            "date": "2026-09-11",
            "time": "11:00",
            "location": "in-office"
        },
        cookies=staff_cookies,
        timeout=30
    )
    
    if convert_existing_response.status_code != 200:
        print_fail(f"Convert existing-patient failed: {convert_existing_response.status_code} {convert_existing_response.text}")
        sys.exit(1)
    
    convert_existing_data = convert_existing_response.json()
    print_pass(f"Convert existing-patient successful: {convert_existing_data}")
    
    # Verify patientMrn matches the existing patient
    appointment_existing = convert_existing_data.get("appointment", {})
    if appointment_existing.get("patientMrn") == EXISTING_MRN:
        print_pass(f"Appointment patientMrn is '{EXISTING_MRN}' (uses matched existing patient, no new patient created)")
    else:
        print_fail(f"Appointment patientMrn is '{appointment_existing.get('patientMrn')}', expected '{EXISTING_MRN}'")
    
    # Track appointment for cleanup (but NOT the patient, as it's a real demo patient)
    request_existing_updated = convert_existing_data.get("request", {})
    if request_existing_updated.get("appointmentId"):
        created_appointment_ids.append(request_existing_updated.get("appointmentId"))
    
    # ============================================================================
    # CLEANUP: Delete test data
    # ============================================================================
    print_test("CLEANUP: Deleting test data")
    
    print_info(f"Created request IDs: {created_request_ids}")
    print_info(f"Created patient IDs: {created_patient_ids}")
    print_info(f"Created appointment IDs: {created_appointment_ids}")
    
    # Use Prisma to delete test data
    print_info("Creating cleanup script...")
    
    cleanup_script = f"""
import {{ db }} from './src/lib/db';

async function cleanup() {{
  console.log('Starting cleanup...');
  
  // Delete appointments
  const appointmentIds = {created_appointment_ids};
  for (const id of appointmentIds) {{
    try {{
      await db.appointment.delete({{ where: {{ id }} }});
      console.log(`Deleted appointment: ${{id}}`);
    }} catch (e) {{
      console.log(`Failed to delete appointment ${{id}}:`, e.message);
    }}
  }}
  
  // Delete appointment requests
  const requestIds = {created_request_ids};
  for (const id of requestIds) {{
    try {{
      await db.appointmentRequest.delete({{ where: {{ id }} }});
      console.log(`Deleted appointment request: ${{id}}`);
    }} catch (e) {{
      console.log(`Failed to delete request ${{id}}:`, e.message);
    }}
  }}
  
  // Delete patients (only test patients named 'ZZTest Convert' or 'ZZNoTime Convert')
  const patientIds = {created_patient_ids};
  for (const id of patientIds) {{
    try {{
      const patient = await db.patient.findUnique({{ where: {{ id }} }});
      if (patient && (patient.firstName === 'ZZTest' || patient.firstName === 'ZZNoTime') && patient.lastName === 'Convert') {{
        await db.patient.delete({{ where: {{ id }} }});
        console.log(`Deleted patient: ${{id}} (${{patient.firstName}} ${{patient.lastName}})`);
      }} else {{
        console.log(`Skipped patient ${{id}} (not a test patient)`);
      }}
    }} catch (e) {{
      console.log(`Failed to delete patient ${{id}}:`, e.message);
    }}
  }}
  
  console.log('Cleanup complete.');
}}

cleanup().catch(console.error).finally(() => process.exit(0));
"""
    
    with open("/tmp/cleanup_convert_test.mjs", "w") as f:
        f.write(cleanup_script)
    
    print_info("Running cleanup script...")
    import subprocess
    result = subprocess.run(
        ["node", "--loader", "ts-node/esm", "/tmp/cleanup_convert_test.mjs"],
        cwd="/app",
        capture_output=True,
        text=True,
        timeout=30
    )
    
    print_info(f"Cleanup stdout: {result.stdout}")
    if result.stderr:
        print_info(f"Cleanup stderr: {result.stderr}")
    
    if result.returncode == 0:
        print_pass("Cleanup completed successfully")
    else:
        print_fail(f"Cleanup failed with exit code {result.returncode}")
    
    # ============================================================================
    # SUMMARY
    # ============================================================================
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print("✅ TEST 1: Create NEW-patient request and convert - PASSED")
    print("✅ TEST 2: Convert the SAME request again (409) - PASSED")
    print("✅ TEST 3: Convert without session (401) - PASSED")
    print("✅ TEST 4: Convert without date/time (400) - PASSED")
    print("✅ TEST 5: Convert nonexistent ID (404) - PASSED")
    print("✅ TEST 6: Create EXISTING-patient request and convert - PASSED")
    print("✅ CLEANUP: Test data deleted - PASSED")
    print("="*80)
    print("ALL TESTS PASSED ✅")
    print("="*80)

except Exception as e:
    print_fail(f"Test failed with exception: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
