import { strict as assert } from "node:assert";
import { loadEnvConfig } from "@next/env";
import { db } from "../src/lib/db";
import { signEnterpriseSession } from "../src/lib/enterpriseAuth";
import { signSession } from "../src/lib/auth";

async function main() {
  if (process.env.DB_NAME !== "copilot_booking_test_20261111") throw new Error("Use the isolated booking test database.");
  loadEnvConfig(process.cwd());
  assert.equal(await db.user.count(), 0, "Test database must have no users.");
  const provider = await db.user.create({ data: { email: "enterprise-test@example.invalid", passwordHash: "test", firstName: "Test", lastName: "Provider", role: "provider" } });
  const companyA = await db.enterpriseAccount.create({ data: { companyName: "Booking Test A" } });
  const companyB = await db.enterpriseAccount.create({ data: { companyName: "Booking Test B" } });
  const patient = await db.patient.create({ data: { mrn: "TEST-ENTERPRISE-MRN", firstName: "Test", lastName: "Employee", dob: new Date("1980-01-02T00:00:00Z"), sex: "X" } });
  const employee = await db.enterpriseEmployee.create({ data: { enterpriseId: companyA.id, patientId: patient.id, firstName: "Test", lastName: "Employee" } });
  const day = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const cookie = async (enterpriseId: string) => `proactive_enterprise_session=${await signEnterpriseSession({ portalUserId: "test", enterpriseId, companyName: "Test", name: "Tester", email: "test@example.invalid", role: "company_admin" })}`;
  const cookieA = await cookie(companyA.id);
  const cookieB = await cookie(companyB.id);
  const staffCookie = `proactive_session=${await signSession({ id: provider.id, email: provider.email, firstName: provider.firstName, lastName: provider.lastName, role: "provider", credential: null })}`;
  const base = "http://127.0.0.1:3001";
  const post = (path: string, value: object, auth?: string) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(auth ? { cookie: auth } : {}) }, body: JSON.stringify(value) });
  try {
    assert.equal((await fetch(`${base}/api/enterprise/appointments`)).status, 401);
    const body = { employeeId: employee.id, location: "sa-austin-hwy", day, time: "12:00" };
    assert.equal((await post("/api/enterprise/appointments", body, cookieB)).status, 404);
    const booked = await post("/api/enterprise/appointments", body, cookieA);
    assert.equal(booked.status, 200, JSON.stringify(await booked.clone().json()));
    const bookedResult = await booked.json();
    assert.equal((await post("/api/enterprise/appointments", body, cookieA)).status, 409);
    const own = await (await fetch(`${base}/api/enterprise/appointments`, { headers: { cookie: cookieA } })).json();
    const other = await (await fetch(`${base}/api/enterprise/appointments?enterpriseId=${companyA.id}`, { headers: { cookie: cookieB } })).json();
    assert.equal(own.appointments.length, 1);
    assert.equal(other.appointments.length, 0);
    assert.equal("patientId" in own.appointments[0], false);
    assert.equal("reason" in own.appointments[0], false);
    const availability = await (await fetch(`${base}/api/appointments/request/availability?day=${day}`)).json();
    assert.equal(availability.slots.find((slot: { time: string }) => slot.time === "12:00").available, false);

    const bookingResponse = await post("/api/appointments/request", { patientType: "new", firstName: "Test", lastName: "Verify", dob: "1990-01-01", location: "sa-austin-hwy", preferredDate: day, preferredTime: "12:30" });
    assert.equal(bookingResponse.status, 200, JSON.stringify(await bookingResponse.clone().json()));
    const booking = await bookingResponse.json();
    const rescheduleConflict = await fetch(`${base}/api/appointments`, { method: "PATCH", headers: { "content-type": "application/json", cookie: staffCookie }, body: JSON.stringify({ id: bookedResult.appointment.id, day, time: "12:30" }) });
    assert.equal(rescheduleConflict.status, 409);
    const request = await db.appointmentRequest.findUniqueOrThrow({ where: { confirmation: booking.confirmation } });
    assert.equal((await post(`/api/appointments/request/${request.id}/verify`, { identityReviewed: true, insuranceReviewed: true })).status, 401);
    assert.equal((await post(`/api/appointments/request/${request.id}/verify`, { identityReviewed: true }, staffCookie)).status, 400);
    assert.equal((await post(`/api/appointments/request/${request.id}/verify`, { identityReviewed: true, insuranceReviewed: true }, staffCookie)).status, 200);
    const verified = await db.patient.findUniqueOrThrow({ where: { id: request.matchedPatientId! } });
    assert.equal(verified.status, "active");
    assert.match(verified.mrn, /^PC-\d{6}$/);

    const legacyRequest = await db.appointmentRequest.create({ data: {
      patientType: "new", firstName: "Test", lastName: "Legacy", dob: "1991-04-03",
      clinicLocation: "sa-austin-hwy", preferredDate: day, preferredTime: "13:00", confirmation: "TEST-LEGACY-CONVERT",
    } });
    const convertedResponse = await post(`/api/appointments/request/${legacyRequest.id}/convert`, { date: day, time: "13:00", location: "in-office" }, staffCookie);
    assert.equal(convertedResponse.status, 200, JSON.stringify(await convertedResponse.clone().json()));
    const converted = await convertedResponse.json();
    assert.equal(converted.request.status, "pending");
    assert.equal(converted.appointment.clinicLocationId, "sa-austin-hwy");
    assert.equal(converted.appointment.patientMrn, null);
    const provisional = await db.patient.findUniqueOrThrow({ where: { id: converted.appointment.patientId } });
    assert.equal(provisional.status, "pending-verification");
    assert.match(provisional.mrn, /^PENDING-/);
    assert.equal((await post(`/api/appointments/request/${legacyRequest.id}/convert`, { date: day, time: "13:00", location: "in-office" }, staffCookie)).status, 409);
    console.log("Enterprise isolation and staff verification checks passed.");
  } finally {
    const appointments = await db.appointment.findMany({ where: { providerId: provider.id }, select: { id: true, patientId: true } });
    const patientIds = [...appointments.map((item) => item.patientId), patient.id];
    const requests = await db.appointmentRequest.findMany({ where: { appointmentId: { in: appointments.map((item) => item.id) } }, select: { id: true } });
    const intakeSettings = await db.appSetting.findMany({ where: { key: { startsWith: "booking-intake:" } } });
    const ownedIntakeKeys = intakeSettings.filter((setting) => requests.some((request) => (setting.value as { requestId?: string })?.requestId === request.id)).map((setting) => setting.key);
    await db.auditLog.deleteMany({ where: { resourceId: { in: patientIds } } });
    await db.message.deleteMany({ where: { fromUserId: provider.id } });
    await db.appointmentRequest.deleteMany({ where: { id: { in: requests.map((request) => request.id) } } });
    await db.appointment.deleteMany({ where: { providerId: provider.id } });
    await db.enterpriseEmployee.delete({ where: { id: employee.id } });
    await db.patient.deleteMany({ where: { id: { in: patientIds } } });
    await db.appSetting.deleteMany({ where: { key: { in: [...ownedIntakeKeys, `public-booking-provider:${provider.id}`] } } });
    await db.enterpriseAccount.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    await db.user.delete({ where: { id: provider.id } });
  }
}

main().finally(() => db.$disconnect());