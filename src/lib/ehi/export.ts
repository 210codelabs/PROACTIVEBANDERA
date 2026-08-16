/**
 * EHI Export — ONC Cures Act §170.315(b)(10) "Electronic Health Information export".
 *
 * Produces a patient's (or the whole practice's) Electronic Health Information in
 * a computable, standards-based format: FHIR R4 (4.0.1) resources serialised as
 * NDJSON (the FHIR Bulk Data output format), packaged one file per resource type
 * inside a ZIP with a manifest.json and README.
 *
 * This maps the local clinical data model to FHIR R4. It is a single-vendor
 * export of stored data — no external calls, no mock data.
 */

import JSZip from "jszip";
import { db } from "@/lib/db";

export const FHIR_VERSION = "4.0.1";

// ---- small helpers ----
function ymd(d?: Date | null): string | undefined {
  if (!d) return undefined;
  try { return new Date(d).toISOString().slice(0, 10); } catch { return undefined; }
}
function iso(d?: Date | null): string | undefined {
  if (!d) return undefined;
  try { return new Date(d).toISOString(); } catch { return undefined; }
}
function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}
function mapGender(sex?: string | null): string {
  const s = String(sex || "").toUpperCase();
  if (s === "M") return "male";
  if (s === "F") return "female";
  if (s === "X") return "other";
  return "unknown";
}
function clean<T extends Record<string, any>>(o: T): T {
  // drop undefined/null/empty-array/empty-string leaves so resources stay tidy
  for (const k of Object.keys(o)) {
    const v = (o as any)[k];
    if (v === undefined || v === null) delete (o as any)[k];
    else if (Array.isArray(v) && v.length === 0) delete (o as any)[k];
    else if (typeof v === "string" && v.trim() === "") delete (o as any)[k];
  }
  return o;
}

const ICD10 = "http://hl7.org/fhir/sid/icd-10-cm";
const CVX = "http://hl7.org/fhir/sid/cvx";
const LOINC = "http://loinc.org";
const CLIN_STATUS = "http://terminology.hl7.org/CodeSystem/condition-clinical";

// ---- resource mappers ----

export function patientResource(p: any): any {
  const address = (p.addressLine1 || p.city || p.state || p.postalCode)
    ? [clean({
        use: "home",
        line: [p.addressLine1, p.addressLine2].filter(Boolean),
        city: p.city || undefined,
        state: p.state || undefined,
        postalCode: p.postalCode || undefined,
        country: p.country || undefined,
      })]
    : undefined;
  const telecom = [
    p.phone ? { system: "phone", value: p.phone, use: "home" } : null,
    p.email ? { system: "email", value: p.email } : null,
  ].filter(Boolean);
  return clean({
    resourceType: "Patient",
    id: p.id,
    meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"] },
    identifier: [{
      use: "usual",
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MR", display: "Medical record number" }] },
      system: "urn:proactive-clinic:mrn",
      value: p.mrn,
    }],
    active: p.status !== "inactive",
    name: [{ use: "official", family: p.lastName, given: [p.firstName].filter(Boolean) }],
    telecom: telecom.length ? telecom : undefined,
    gender: mapGender(p.sex),
    birthDate: ymd(p.dob),
    deceasedBoolean: p.status === "deceased" ? true : undefined,
    address,
    maritalStatus: p.maritalStatus ? { text: p.maritalStatus } : undefined,
    communication: p.preferredLang ? [{ language: { text: p.preferredLang }, preferred: true }] : undefined,
  });
}

export function coverageResource(p: any): any | null {
  if (!p.insurerName && !p.memberId && !p.payerId) return null;
  return clean({
    resourceType: "Coverage",
    id: `coverage-${p.id}`,
    status: "active",
    subscriberId: p.memberId || undefined,
    beneficiary: { reference: `Patient/${p.id}` },
    payor: [{ display: p.insurerName || p.payerId || "Unknown payer" }],
    class: [
      p.insurerPlan ? { type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/coverage-class", code: "plan" }] }, value: p.insurerPlan } : null,
      p.groupNumber ? { type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/coverage-class", code: "group" }] }, value: p.groupNumber } : null,
    ].filter(Boolean),
  });
}

export function conditionResource(x: any, patientId: string): any {
  const status = ["resolved", "inactive"].includes(String(x.status)) ? String(x.status) : "active";
  return clean({
    resourceType: "Condition",
    id: x.id,
    clinicalStatus: { coding: [{ system: CLIN_STATUS, code: status }] },
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "problem-list-item" }] }],
    code: clean({
      coding: x.icd10 ? [{ system: ICD10, code: x.icd10, display: x.description }] : undefined,
      text: x.description,
    }),
    subject: { reference: `Patient/${patientId}` },
    onsetDateTime: iso(x.onsetDate),
    abatementDateTime: iso(x.resolvedDate),
    recordedDate: iso(x.createdAt),
    note: x.notes ? [{ text: x.notes }] : undefined,
  });
}

export function allergyResource(x: any, patientId: string): any {
  const critMap: Record<string, string> = { mild: "low", moderate: "low", severe: "high", "life-threatening": "high" };
  const sevMap: Record<string, string> = { mild: "mild", moderate: "moderate", severe: "severe", "life-threatening": "severe" };
  return clean({
    resourceType: "AllergyIntolerance",
    id: x.id,
    clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: x.status === "resolved" ? "resolved" : x.status === "inactive" ? "inactive" : "active" }] },
    code: { text: x.substance },
    patient: { reference: `Patient/${patientId}` },
    criticality: x.severity ? (critMap[String(x.severity)] || undefined) : undefined,
    onsetDateTime: iso(x.onsetDate),
    recordedDate: iso(x.createdAt),
    reaction: x.reaction ? [clean({
      manifestation: [{ text: x.reaction }],
      severity: x.severity ? (sevMap[String(x.severity)] || undefined) : undefined,
    })] : undefined,
    note: x.notes ? [{ text: x.notes }] : undefined,
  });
}

export function medicationResource(x: any, patientId: string): any {
  const statusMap: Record<string, string> = { active: "active", discontinued: "stopped", completed: "completed" };
  const text = [x.name, x.strength, x.form].filter(Boolean).join(" ");
  return clean({
    resourceType: "MedicationRequest",
    id: x.id,
    status: statusMap[String(x.status)] || "unknown",
    intent: "order",
    medicationCodeableConcept: { text: text || x.name },
    subject: { reference: `Patient/${patientId}` },
    authoredOn: iso(x.startDate) || iso(x.createdAt),
    requester: x.prescriberId ? { reference: `Practitioner/${x.prescriberId}` } : undefined,
    dosageInstruction: (x.sig || x.route || x.frequency) ? [clean({
      text: x.sig || undefined,
      route: x.route ? { text: x.route } : undefined,
      timing: x.frequency ? { code: { text: x.frequency } } : undefined,
    })] : undefined,
    note: x.notes ? [{ text: x.notes }] : undefined,
  });
}

// One Vital row → multiple US Core vital-signs Observations.
export function vitalObservations(v: any, patientId: string): any[] {
  const out: any[] = [];
  const when = iso(v.takenAt);
  const base = (suffix: string, code: string, display: string) => ({
    resourceType: "Observation",
    id: `${v.id}-${suffix}`,
    status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs", display: "Vital Signs" }] }],
    code: { coding: [{ system: LOINC, code, display }], text: display },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: when,
  });
  const q = (value: number, unit: string, ucum: string) => ({ value, unit, system: "http://unitsofmeasure.org", code: ucum });
  if (v.heightCm != null) out.push(clean({ ...base("height", "8302-2", "Body height"), valueQuantity: q(v.heightCm, "cm", "cm") }));
  if (v.weightKg != null) out.push(clean({ ...base("weight", "29463-7", "Body weight"), valueQuantity: q(v.weightKg, "kg", "kg") }));
  if (v.bmi != null) out.push(clean({ ...base("bmi", "39156-5", "Body mass index"), valueQuantity: q(v.bmi, "kg/m2", "kg/m2") }));
  if (v.systolic != null || v.diastolic != null) {
    out.push(clean({
      ...base("bp", "85354-9", "Blood pressure panel"),
      component: [
        v.systolic != null ? { code: { coding: [{ system: LOINC, code: "8480-6", display: "Systolic blood pressure" }] }, valueQuantity: q(v.systolic, "mmHg", "mm[Hg]") } : null,
        v.diastolic != null ? { code: { coding: [{ system: LOINC, code: "8462-4", display: "Diastolic blood pressure" }] }, valueQuantity: q(v.diastolic, "mmHg", "mm[Hg]") } : null,
      ].filter(Boolean),
    }));
  }
  if (v.pulse != null) out.push(clean({ ...base("hr", "8867-4", "Heart rate"), valueQuantity: q(v.pulse, "/min", "/min") }));
  if (v.temperatureC != null) out.push(clean({ ...base("temp", "8310-5", "Body temperature"), valueQuantity: q(v.temperatureC, "Cel", "Cel") }));
  if (v.respRate != null) out.push(clean({ ...base("rr", "9279-1", "Respiratory rate"), valueQuantity: q(v.respRate, "/min", "/min") }));
  if (v.spo2 != null) out.push(clean({ ...base("spo2", "59408-5", "Oxygen saturation"), valueQuantity: q(v.spo2, "%", "%") }));
  if (v.painScore != null) out.push(clean({ ...base("pain", "72514-3", "Pain severity 0-10"), valueQuantity: q(v.painScore, "{score}", "{score}") }));
  return out;
}

export function immunizationResource(x: any, patientId: string): any {
  return clean({
    resourceType: "Immunization",
    id: x.id,
    status: "completed",
    vaccineCode: clean({
      coding: x.cvxCode ? [{ system: CVX, code: x.cvxCode, display: x.vaccine }] : undefined,
      text: x.vaccine,
    }),
    patient: { reference: `Patient/${patientId}` },
    occurrenceDateTime: iso(x.givenAt),
    lotNumber: x.lot || undefined,
    site: x.site ? { text: x.site } : undefined,
    note: x.notes ? [{ text: x.notes }] : undefined,
  });
}

export function encounterResource(e: any, patientId: string): any {
  const statusMap: Record<string, string> = { open: "in-progress", signed: "finished", amended: "finished" };
  return clean({
    resourceType: "Encounter",
    id: e.id,
    status: statusMap[String(e.status)] || "unknown",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: e.visitType === "telehealth" ? "VR" : "AMB" },
    type: e.encounterTypeName ? [{ text: e.encounterTypeName }] : undefined,
    subject: { reference: `Patient/${patientId}` },
    participant: e.providerId ? [{ individual: { reference: `Practitioner/${e.providerId}` } }] : undefined,
    period: clean({ start: iso(e.startedAt), end: iso(e.signedAt) }),
    reasonCode: e.chiefComplaint ? [{ text: e.chiefComplaint }] : undefined,
  });
}

// SOAP / note body → DocumentReference so the narrative is included in the EHI.
export function encounterNoteDocRef(e: any, patientId: string): any | null {
  const parts: string[] = [];
  if (e.chiefComplaint) parts.push(`Chief Complaint: ${e.chiefComplaint}`);
  if (e.noteFormat === "simple" && e.simpleBody) parts.push(e.simpleBody);
  else {
    if (e.subjective) parts.push(`Subjective:\n${e.subjective}`);
    if (e.ros) parts.push(`Review of Systems:\n${e.ros}`);
    if (e.objective) parts.push(`Objective:\n${e.objective}`);
    if (e.examFindings) parts.push(`Exam:\n${e.examFindings}`);
    if (e.assessment) parts.push(`Assessment:\n${e.assessment}`);
    if (e.plan) parts.push(`Plan:\n${e.plan}`);
    if (e.familyHistory) parts.push(`Family History:\n${e.familyHistory}`);
    if (e.socialHistory) parts.push(`Social History:\n${e.socialHistory}`);
  }
  const body = parts.join("\n\n").trim();
  if (!body) return null;
  return clean({
    resourceType: "DocumentReference",
    id: `note-${e.id}`,
    status: "current",
    docStatus: e.status === "open" ? "preliminary" : "final",
    type: { coding: [{ system: LOINC, code: "34109-9", display: "Note" }], text: "Clinical Note" },
    subject: { reference: `Patient/${patientId}` },
    date: iso(e.signedAt) || iso(e.startedAt),
    context: { encounter: [{ reference: `Encounter/${e.id}` }] },
    content: [{ attachment: { contentType: "text/plain", data: b64(body) } }],
  });
}

export function documentResource(d: any, patientId: string): any {
  return clean({
    resourceType: "DocumentReference",
    id: d.id,
    status: "current",
    type: { text: d.category || "Document" },
    subject: { reference: `Patient/${patientId}` },
    date: iso(d.createdAt),
    description: d.title,
    content: [{ attachment: clean({ contentType: "text/plain", title: d.title, data: d.body ? b64(String(d.body)) : undefined }) }],
  });
}

export function practitionerResource(u: any): any {
  return clean({
    resourceType: "Practitioner",
    id: u.id,
    identifier: u.npi ? [{ system: "http://hl7.org/fhir/sid/us-npi", value: u.npi }] : undefined,
    name: [{ family: u.lastName, given: [u.firstName].filter(Boolean), suffix: u.credential ? [u.credential] : undefined }],
    telecom: u.email ? [{ system: "email", value: u.email }] : undefined,
  });
}

// ---- collection ----

export type GroupedResources = Record<string, any[]>;

function pushGroup(g: GroupedResources, type: string, res: any | any[]) {
  if (!res) return;
  const arr = Array.isArray(res) ? res : [res];
  if (!arr.length) return;
  (g[type] ||= []).push(...arr);
}

/** Build FHIR resources for the given scope. patientId=null → whole practice. */
export async function collectResources(patientId: string | null): Promise<{ grouped: GroupedResources; patientCount: number }> {
  const where = patientId ? { id: patientId } : {};
  const patients = await db.patient.findMany({
    where: where as any,
    include: {
      allergies: true, problems: true, medications: true,
      vitals: true, immunizations: true,
      encounters: true, documents: true,
    },
    orderBy: { lastName: "asc" },
  });

  const grouped: GroupedResources = {};

  for (const p of patients) {
    pushGroup(grouped, "Patient", patientResource(p));
    const cov = coverageResource(p);
    if (cov) pushGroup(grouped, "Coverage", cov);
    for (const x of p.problems) pushGroup(grouped, "Condition", conditionResource(x, p.id));
    for (const x of p.allergies) pushGroup(grouped, "AllergyIntolerance", allergyResource(x, p.id));
    for (const x of p.medications) pushGroup(grouped, "MedicationRequest", medicationResource(x, p.id));
    for (const x of p.vitals) pushGroup(grouped, "Observation", vitalObservations(x, p.id));
    for (const x of p.immunizations) pushGroup(grouped, "Immunization", immunizationResource(x, p.id));
    for (const e of p.encounters) {
      pushGroup(grouped, "Encounter", encounterResource(e, p.id));
      const note = encounterNoteDocRef(e, p.id);
      if (note) pushGroup(grouped, "DocumentReference", note);
    }
    for (const d of p.documents) pushGroup(grouped, "DocumentReference", documentResource(d, p.id));
  }

  // Practitioners referenced by encounters/meds — include the full active provider roster.
  const providers = await db.user.findMany({ where: { active: true } }).catch(() => []);
  for (const u of providers) pushGroup(grouped, "Practitioner", practitionerResource(u));

  return { grouped, patientCount: patients.length };
}

function toNdjson(arr: any[]): string {
  return arr.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

/** Build a ZIP (Buffer) of per-type NDJSON files + manifest.json + README. */
export async function buildEhiZip(opts: {
  grouped: GroupedResources;
  patientCount: number;
  scopeLabel: string;
  requestUrl: string;
  generatedBy: string;
}): Promise<Buffer> {
  const { grouped, patientCount, scopeLabel, requestUrl, generatedBy } = opts;
  const zip = new JSZip();
  const transactionTime = new Date().toISOString();

  const output: Array<{ type: string; url: string; count: number }> = [];
  let totalResources = 0;
  for (const type of Object.keys(grouped).sort()) {
    const arr = grouped[type];
    if (!arr?.length) continue;
    const fname = `${type}.ndjson`;
    zip.file(fname, toNdjson(arr));
    output.push({ type, url: fname, count: arr.length });
    totalResources += arr.length;
  }

  const manifest = {
    transactionTime,
    request: requestUrl,
    requiresAccessToken: false,
    fhirVersion: FHIR_VERSION,
    output,
    error: [],
    extension: {
      exportType: "EHI",
      regulation: "ONC 21st Century Cures Act — 45 CFR 170.315(b)(10) Electronic Health Information export",
      scope: scopeLabel,
      patientCount,
      totalResources,
      generatedBy,
      format: "FHIR R4 NDJSON (Bulk Data output)",
    },
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const readme = [
    "Electronic Health Information (EHI) Export",
    "==========================================",
    "",
    `Generated: ${transactionTime}`,
    `Scope: ${scopeLabel}`,
    `Patients included: ${patientCount}`,
    `Total FHIR resources: ${totalResources}`,
    `FHIR version: ${FHIR_VERSION} (R4)`,
    "",
    "This archive contains the practice's Electronic Health Information exported to",
    "satisfy the ONC 21st Century Cures Act EHI export requirement",
    "(45 CFR 170.315(b)(10)).",
    "",
    "Format",
    "------",
    "Each file is newline-delimited JSON (NDJSON): one FHIR R4 resource per line.",
    "Files are named by FHIR resource type (e.g. Patient.ndjson, Condition.ndjson).",
    "manifest.json describes each file and its resource count, following the FHIR",
    "Bulk Data $export manifest shape.",
    "",
    "Note: This is a single-vendor export of stored clinical data. Coded values are",
    "included where recorded (ICD-10-CM, CVX, LOINC); free-text is preserved in",
    "resource `text`/note fields and clinical notes are included as DocumentReference",
    "attachments (base64 text/plain).",
    "",
  ].join("\n");
  zip.file("README.txt", readme);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) as unknown as Buffer;
}
