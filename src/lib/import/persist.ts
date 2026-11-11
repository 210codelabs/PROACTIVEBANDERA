/**
 * Shared persistence for extracted clinical data (from a C-CDA/FHIR FILE upload
 * OR a live FHIR API import). Resolves/creates the patient, then attaches
 * Problems / Medications / Allergies / Vitals / Immunizations / Encounters with
 * case-insensitive, idempotent dedupe. Non-destructive: existing records are
 * skipped, never overwritten.
 */

import { db } from "@/lib/db";
import { providerMatchKeys } from "@/lib/import/appointments";
import type { Extracted, ExtractedEncounter } from "@/lib/import/clinical";
import { matchClinicalPatient } from "@/lib/import/patientMatch";

type Prov = { id: string; firstName: string; lastName: string; npi: string | null };

export type PersistResult =
  | { ok: true; patientId: string; patientCreated: boolean; counts: any; total: number; created: number; skipped: number; notice?: string }
  | { ok: false; status: number; error: string };

function nextMrn() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `PC-${n}`;
}

function matchEncounterProvider(enc: ExtractedEncounter, providers: Prov[], defaultId: string | null): string | null {
  if (enc.providerNpi) {
    const npi = enc.providerNpi.replace(/[^0-9]/g, "");
    const byNpi = providers.find((p) => (p.npi || "").replace(/[^0-9]/g, "") === npi && npi.length > 0);
    if (byNpi) return byNpi.id;
  }
  if (enc.provider) {
    const keys = providerMatchKeys(enc.provider);
    if (keys.length) {
      const exact = providers.filter((p) => keys.includes(p.firstName.toLowerCase()) && keys.includes(p.lastName.toLowerCase()));
      if (exact.length === 1) return exact[0].id;
      const byLast = providers.filter((p) => keys.includes(p.lastName.toLowerCase()));
      if (byLast.length === 1) return byLast[0].id;
    }
  }
  return defaultId;
}

function mapVisitType(type?: string): string | undefined {
  const t = (type || "").toLowerCase();
  if (!t) return undefined;
  if (/tele|virtual|video/.test(t)) return "telehealth";
  if (/home/.test(t)) return "home";
  if (/follow|f\/u|recheck/.test(t)) return "follow-up";
  if (/new patient|initial/.test(t)) return "new";
  return "office";
}

export async function persistExtracted(ex: Extracted, opts: { defaultProviderId?: string | null } = {}): Promise<PersistResult> {
  const defaultProviderId = opts.defaultProviderId ? String(opts.defaultProviderId) : null;
  const p = ex.patient;
  if (!p.firstName || !p.lastName) return { ok: false, status: 400, error: "Could not read a patient name from the document." };
  const dob = p.dob ? new Date(p.dob) : null;

  // Resolve or create patient (dedupe by verified MRN, else name+DOB)
  let patient: { id: string } | null = null;
  let patientCreated = false;
  const match = await matchClinicalPatient(p);
  if (match?.by === "missing_identity") return { ok: false, status: 400, error: "A valid patient name and date of birth are required to import safely." };
  if (match?.by === "conflict") return { ok: false, status: 409, error: "The source MRN belongs to a patient with different demographics. Resolve the identity conflict before importing." };
  if (match?.by === "ambiguous") return { ok: false, status: 409, error: "Multiple patients match this name and date of birth. Resolve the identity conflict before importing." };
  if (match && "id" in match) patient = { id: match.id };
  if (!patient) {
    let mrn = p.mrn && p.mrn.trim() ? p.mrn.trim() : nextMrn();
    let guard = 0;
    while (await db.patient.findFirst({ where: { mrn }, select: { id: true } })) { mrn = nextMrn(); if (++guard > 8) break; }
    const created = await db.patient.create({
      data: {
        mrn, firstName: p.firstName, lastName: p.lastName,
        dob: dob || new Date("1900-01-01"), sex: p.sex || "U",
        email: p.email || null, phone: p.phone || null,
        addressLine1: p.addressLine1 || null, city: p.city || null, state: p.state || null, postalCode: p.postalCode || null,
        status: "active",
      },
      select: { id: true },
    });
    patient = created; patientCreated = true;
  }

  const pid = patient.id;
  const res = { problems: { created: 0, skipped: 0 }, medications: { created: 0, skipped: 0 }, allergies: { created: 0, skipped: 0 }, vitals: { created: 0, skipped: 0 }, immunizations: { created: 0, skipped: 0 }, encounters: { created: 0, skipped: 0 } };
  const notices: string[] = [];

  const norm = (s: string) => s.trim().toLowerCase();
  const [existingProblems, existingMeds, existingAllergies, existingVitals, existingImms] = await Promise.all([
    db.problem.findMany({ where: { patientId: pid }, select: { description: true } }),
    db.medication.findMany({ where: { patientId: pid }, select: { name: true } }),
    db.allergy.findMany({ where: { patientId: pid }, select: { substance: true } }),
    db.vital.findMany({ where: { patientId: pid }, select: { takenAt: true, heightCm: true, weightKg: true, bmi: true, systolic: true, diastolic: true, pulse: true, temperatureC: true, respRate: true, spo2: true, painScore: true } }),
    db.immunization.findMany({ where: { patientId: pid }, select: { vaccine: true, cvxCode: true, givenAt: true } }),
  ]);
  const problemSet = new Set(existingProblems.map((x) => norm(x.description)));
  const medSet = new Set(existingMeds.map((x) => norm(x.name)));
  const allergySet = new Set(existingAllergies.map((x) => norm(x.substance)));
  const vitalVals = (v: any) => [
    v.heightCm, v.weightKg, v.bmi, v.systolic, v.diastolic, v.pulse, v.temperatureC, v.respRate, v.spo2, v.painScore,
  ].map((x) => (x == null ? "" : String(x))).join("|");
  const vitalSig = (v: any) => `${v.takenAt ? new Date(v.takenAt).toISOString() : ""}|${vitalVals(v)}`;
  // Two dedupe sets: full (timestamp + values) for timestamped readings, and
  // values-only for readings the source provided WITHOUT a timestamp (so a
  // re-import of an untimestamped reading is still recognised as a duplicate
  // instead of being re-stamped "now" and duplicated each run).
  const vitalSet = new Set(existingVitals.map(vitalSig));
  const vitalValsSet = new Set(existingVitals.map(vitalVals));
  const immSig = (i: { vaccine: string; cvxCode?: string | null; givenAt?: any }) => `${(i.cvxCode || i.vaccine.toLowerCase()).trim()}|${i.givenAt ? new Date(i.givenAt).toISOString().slice(0, 10) : ""}`;
  const immSet = new Set(existingImms.map(immSig));

  // Encounter roster + dedupe signatures (only if the document carries encounters)
  let providers: Prov[] = [];
  const encSig = (e: { startedAt?: any; encounterTypeName?: string | null; body?: string | null }) =>
    `${e.startedAt ? new Date(e.startedAt).toISOString() : ""}|${(e.encounterTypeName || "").toLowerCase().trim()}|${(e.body || "").slice(0, 60).toLowerCase().trim()}`;
  let encSet = new Set<string>();
  if (ex.encounters.length) {
    providers = (await db.user.findMany({ where: { role: "provider", active: true }, select: { id: true, firstName: true, lastName: true, npi: true } }).catch(() => [])) as Prov[];
    if (defaultProviderId && !providers.some((pp) => pp.id === defaultProviderId)) {
      return { ok: false, status: 400, error: "The selected default provider was not found." };
    }
    const existingEnc = await db.encounter.findMany({ where: { patientId: pid }, select: { startedAt: true, encounterTypeName: true, simpleBody: true, chiefComplaint: true } });
    encSet = new Set(existingEnc.map((e) => encSig({ startedAt: e.startedAt, encounterTypeName: e.encounterTypeName, body: e.simpleBody || e.chiefComplaint })));
  }

  for (const pr of ex.problems) {
    if (problemSet.has(norm(pr.description))) { res.problems.skipped++; continue; }
    await db.problem.create({ data: { patientId: pid, description: pr.description, icd10: pr.icd10 || null, status: pr.status || "active", onsetDate: pr.onsetDate ? new Date(pr.onsetDate) : null } });
    problemSet.add(norm(pr.description)); res.problems.created++;
  }
  for (const m of ex.medications) {
    if (medSet.has(norm(m.name))) { res.medications.skipped++; continue; }
    await db.medication.create({ data: { patientId: pid, name: m.name, sig: m.sig || null, status: m.status || "active" } });
    medSet.add(norm(m.name)); res.medications.created++;
  }
  for (const a of ex.allergies) {
    if (allergySet.has(norm(a.substance))) { res.allergies.skipped++; continue; }
    await db.allergy.create({ data: { patientId: pid, substance: a.substance, reaction: a.reaction || null, severity: a.severity || null, status: a.status || "active" } });
    allergySet.add(norm(a.substance)); res.allergies.created++;
  }
  for (const v of ex.vitals) {
    if (!v.takenAt || Number.isNaN(new Date(v.takenAt).getTime())) {
      res.vitals.skipped++;
      if (!notices.includes("date")) notices.push("date");
      continue;
    }
    // Untimestamped readings dedupe on values only; timestamped ones on time+values.
    if (!v.takenAt) {
      if (vitalValsSet.has(vitalVals(v))) { res.vitals.skipped++; continue; }
    } else if (vitalSet.has(vitalSig(v))) { res.vitals.skipped++; continue; }
    const takenAt = v.takenAt ? new Date(v.takenAt) : new Date();
    await db.vital.create({ data: {
      patientId: pid, takenAt,
      heightCm: v.heightCm ?? null, weightKg: v.weightKg ?? null, bmi: v.bmi ?? null,
      systolic: v.systolic ?? null, diastolic: v.diastolic ?? null, pulse: v.pulse ?? null,
      temperatureC: v.temperatureC ?? null, respRate: v.respRate ?? null, spo2: v.spo2 ?? null, painScore: v.painScore ?? null,
    } });
    vitalSet.add(vitalSig({ ...v, takenAt }));
    vitalValsSet.add(vitalVals(v));
    res.vitals.created++;
  }
  for (const im of ex.immunizations) {
    if (!im.givenAt || Number.isNaN(new Date(im.givenAt).getTime())) {
      res.immunizations.skipped++;
      if (!notices.includes("date")) notices.push("date");
      continue;
    }
    const sig = immSig({ vaccine: im.vaccine, cvxCode: im.cvxCode, givenAt: im.givenAt });
    if (immSet.has(sig)) { res.immunizations.skipped++; continue; }
    await db.immunization.create({ data: {
      patientId: pid, vaccine: im.vaccine, cvxCode: im.cvxCode || null,
      givenAt: im.givenAt ? new Date(im.givenAt) : new Date(), lot: im.lot || null, site: im.site || null,
    } });
    immSet.add(sig); res.immunizations.created++;
  }
  for (const enc of ex.encounters) {
    if (!enc.date || Number.isNaN(new Date(enc.date).getTime())) {
      res.encounters.skipped++;
      if (!notices.includes("date")) notices.push("date");
      continue;
    }
    const providerId = matchEncounterProvider(enc, providers, defaultProviderId);
    if (!providerId) { res.encounters.skipped++; if (!notices.includes("provider")) notices.push("provider"); continue; }
    const startedAt = enc.date ? new Date(enc.date) : new Date();
    const body = enc.note || enc.reason || null;
    const sig = encSig({ startedAt, encounterTypeName: enc.type, body });
    if (encSet.has(sig)) { res.encounters.skipped++; continue; }
    await db.encounter.create({ data: {
      patientId: pid, providerId,
      startedAt, signedAt: enc.date ? new Date(enc.date) : startedAt,
      status: "signed", visitType: mapVisitType(enc.type),
      chiefComplaint: enc.reason || null, encounterTypeName: enc.type || null,
      noteFormat: enc.note ? "simple" : null, simpleBody: enc.note || null,
    } });
    encSet.add(sig); res.encounters.created++;
  }

  const created = res.problems.created + res.medications.created + res.allergies.created + res.vitals.created + res.immunizations.created + res.encounters.created;
  const skipped = res.problems.skipped + res.medications.skipped + res.allergies.skipped + res.vitals.skipped + res.immunizations.skipped + res.encounters.skipped;
  const total = ex.problems.length + ex.medications.length + ex.allergies.length + ex.vitals.length + ex.immunizations.length + ex.encounters.length;

  return {
    ok: true, patientId: pid, patientCreated, counts: res, total, created, skipped,
    notice: [
      notices.includes("provider") ? "Some visit notes were skipped because no provider could be matched." : "",
      notices.includes("date") ? "Some vitals, immunizations or visits were skipped because their source date was missing or invalid." : "",
    ].filter(Boolean).join(" ") || undefined,
  };
}
