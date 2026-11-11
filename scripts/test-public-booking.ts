import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { db } from "../src/lib/db";
import { POST as book } from "../src/app/api/appointments/request/route";
import { GET as availability } from "../src/app/api/appointments/request/availability/route";
import { POST as submitIntake } from "../src/app/api/appointments/request/intake/route";
import { POST as lookup } from "../src/app/api/appointments/request/lookup/route";

async function main() {
  if (process.env.DB_NAME !== "copilot_booking_test_20261111") throw new Error("Use the isolated booking test database.");
  assert.equal(await db.user.count(), 0, "Test database must be empty.");
  const provider = await db.user.create({ data: { email: "booking-test@example.invalid", passwordHash: "test", firstName: "Test", lastName: "Provider", role: "provider" } });
  const patient = await db.patient.create({ data: { mrn: "TEST-BOOKING-MRN", firstName: "Test", lastName: "Returning", dob: new Date("1980-01-02T00:00:00Z"), sex: "X", postalCode: "78218" } });
  const day = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const submit = (body: object) => book(new Request("http://localhost/api/appointments/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  const newPatient = { patientType: "new", firstName: "Test", lastName: "New", dob: "1990-01-02", location: "sa-austin-hwy", preferredDate: day, preferredTime: "10:00" };
  const intakeKeys: string[] = [];
  const lookupKeys: string[] = [];
  try {
    const before = await availability(new Request(`http://localhost/api/appointments/request/availability?day=${day}`));
    const beforeJson = await before.json();
    assert.equal(beforeJson.slots.find((slot: { time: string }) => slot.time === "10:00").available, true);

    const response = await submit(newPatient);
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    const result = await response.json();
    assert.equal(result.ok, true);
    assert.equal("patientId" in result, false);
    assert.equal("mrn" in result, false);
    assert.ok(result.intakeToken);
    intakeKeys.push(`booking-intake:${createHash("sha256").update(result.intakeToken).digest("hex")}`);
    const request = await db.appointmentRequest.findUniqueOrThrow({ where: { confirmation: result.confirmation } });
    assert.ok(request.appointmentId);
    const appointment = await db.appointment.findUniqueOrThrow({ where: { id: request.appointmentId! } });
    const provisional = await db.patient.findUniqueOrThrow({ where: { id: appointment.patientId } });
    assert.equal(provisional.status, "pending-verification");
    assert.equal(appointment.providerId, provider.id);
    assert.equal(appointment.status, "scheduled");
    const intake = { token: result.intakeToken, signature: "Test Patient", privacyAcknowledged: true, treatmentConsent: true, insuranceConsent: true, reviewAcknowledged: true, insurance: "Test insurer", medicalHistory: "Test history", medications: "", allergies: "", lang: "en" };
    const intakeRequest = (body: object) => submitIntake(new Request("http://localhost/api/appointments/request/intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    assert.equal((await intakeRequest({ ...intake, privacyAcknowledged: false })).status, 400);
    assert.equal((await intakeRequest(intake)).status, 200);
    assert.equal((await intakeRequest(intake)).status, 400);
    const document = await db.document.findFirstOrThrow({ where: { patientId: provisional.id, category: "intake" } });
    assert.equal(JSON.parse(document.body!).reviewStatus, "pending");

    const after = await availability(new Request(`http://localhost/api/appointments/request/availability?day=${day}`));
    const afterJson = await after.json();
    assert.equal(afterJson.slots.find((slot: { time: string }) => slot.time === "10:00").available, false);
    assert.deepEqual(Object.keys(afterJson.slots[0]).sort(), ["available", "time"]);
    assert.equal((await submit({ ...newPatient, firstName: "Test Conflict" })).status, 409);

    const returning = { patientType: "existing", firstName: "Test", lastName: "Returning", mrn: patient.mrn, dob: "1980-01-02", postalCode: "78218", location: "sa-austin-hwy", preferredDate: day, preferredTime: "10:30" };
    assert.equal((await submit({ ...returning, postalCode: "00000" })).status, 404);
    const existingResponse = await submit(returning);
    assert.equal(existingResponse.status, 200, JSON.stringify(await existingResponse.clone().json()));
    const existingResult = await existingResponse.json();
    assert.equal("intakeToken" in existingResult, false);
    const existingRequest = await db.appointmentRequest.findUniqueOrThrow({ where: { confirmation: existingResult.confirmation } });
    const existingAppointment = await db.appointment.findUniqueOrThrow({ where: { id: existingRequest.appointmentId! } });
    assert.equal(existingAppointment.patientId, patient.id);
    const lookupResponse = await lookup(new Request("http://localhost/api/appointments/request/lookup", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "booking-integration-test" }, body: JSON.stringify({ firstName: "Test", lastName: "Returning", dob: "1980-01-02", postalCode: "78218" }) }));
    assert.equal(lookupResponse.status, 200);
    const lookupResult = await lookupResponse.json();
    assert.deepEqual(Object.keys(lookupResult), ["bookingId"]);
    lookupKeys.push(`booking-lookup:${createHash("sha256").update(lookupResult.bookingId).digest("hex")}`);
    const recovered = { ...returning, mrn: "", bookingId: lookupResult.bookingId, preferredTime: "11:30" };
    assert.equal((await submit(recovered)).status, 200);
    assert.notEqual((await submit({ ...recovered, preferredTime: "12:00" })).status, 200);
    const concurrent = await Promise.all([submit({ ...newPatient, preferredTime: "11:00" }), submit({ ...newPatient, preferredTime: "11:00" })]);
    assert.deepEqual(concurrent.map((item) => item.status).sort(), [200, 409]);
    const concurrentResult = await concurrent.find((item) => item.status === 200)!.json();
    intakeKeys.push(`booking-intake:${createHash("sha256").update(concurrentResult.intakeToken).digest("hex")}`);
    console.log("Public booking integration checks passed.");
  } finally {
    const appointments = await db.appointment.findMany({ where: { providerId: provider.id }, select: { patientId: true, id: true } });
    await db.message.deleteMany({ where: { fromUserId: provider.id } });
    await db.document.deleteMany({ where: { patientId: { in: appointments.map((appointment) => appointment.patientId) } } });
    await db.appointmentRequest.deleteMany({ where: { appointmentId: { in: appointments.map((appointment) => appointment.id) } } });
    await db.appointment.deleteMany({ where: { providerId: provider.id } });
    await db.patient.deleteMany({ where: { id: { in: [...appointments.map((appointment) => appointment.patientId), patient.id] } } });
    await db.appSetting.deleteMany({ where: { key: `public-booking-provider:${provider.id}` } });
    await db.appSetting.deleteMany({ where: { key: { in: intakeKeys } } });
    await db.appSetting.deleteMany({ where: { key: { in: lookupKeys } } });
    await db.user.delete({ where: { id: provider.id } });
  }
}

main().finally(() => db.$disconnect());