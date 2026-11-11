import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseClinicalDocument } from "../src/lib/import/clinical";

const patient = {
  resourceType: "Patient",
  id: "patient-one",
  name: [{ given: ["Synthetic"], family: "Patient" }],
  birthDate: "1985-01-15",
};

function bundle(resources: object[]) {
  return JSON.stringify({ resourceType: "Bundle", entry: resources.map((resource) => ({ resource })) });
}

test("rejects bundles containing multiple patients", () => {
  assert.throws(() => parseClinicalDocument(bundle([patient, { ...patient, id: "patient-two" }])), /multiple patients/);
});

test("rejects a clinical resource for a different patient", () => {
  const condition = { resourceType: "Condition", subject: { reference: "Patient/patient-two" } };
  assert.throws(() => parseClinicalDocument(bundle([patient, condition])), /different or unidentified patient/);
});

test("does not interpret PDF bytes as a visit note", () => {
  const document = {
    resourceType: "DocumentReference",
    subject: { reference: "Patient/patient-one" },
    content: [{ attachment: { contentType: "application/pdf", data: Buffer.from("%PDF-synthetic").toString("base64") } }],
  };
  assert.equal(parseClinicalDocument(bundle([patient, document])).encounters.length, 0);
});

test("imports text attachments as visit notes", () => {
  const document = {
    resourceType: "DocumentReference",
    subject: { reference: "Patient/patient-one" },
    content: [{ attachment: { contentType: "text/plain", data: Buffer.from("Synthetic note").toString("base64") } }],
  };
  assert.equal(parseClinicalDocument(bundle([patient, document])).encounters[0]?.note, "Synthetic note");
});

test("continues to parse the existing single-patient FHIR fixture", () => {
  const parsed = parseClinicalDocument(readFileSync("test_fixtures/sample_fhir.json", "utf8"));
  assert.ok(parsed.patient.firstName);
  assert.ok(parsed.patient.lastName);
});