import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { parseClinicalDocument, detectFormat } from "@/lib/import/clinical";

function nextMrn() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `PC-${n}`;
}

// POST /api/admin/import/clinical/commit { content }
// Imports a C-CDA XML / FHIR JSON bundle: creates or matches the patient
// (dedupe by MRN, else name+DOB), then attaches Problems / Medications /
// Allergies. Non-destructive & idempotent — existing records are skipped.
export async function POST(req: Request) {
  let admin: any;
  try { admin = await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const b = await req.json().catch(() => ({}));
  const content = String(b.content || "");
  if (!content.trim()) return NextResponse.json({ error: "No document content provided." }, { status: 400 });
  if (!detectFormat(content)) return NextResponse.json({ error: "Unrecognized file — expected C-CDA XML or FHIR JSON bundle." }, { status: 400 });

  let ex;
  try { ex = parseClinicalDocument(content); }
  catch (e: any) { return NextResponse.json({ error: String(e?.message || e) }, { status: 400 }); }

  const p = ex.patient;
  if (!p.firstName || !p.lastName) return NextResponse.json({ error: "Could not read a patient name from the document." }, { status: 400 });
  const dob = p.dob ? new Date(p.dob) : null;

  // Resolve patient
  let patient: { id: string } | null = null;
  let patientCreated = false;
  if (p.mrn) patient = await db.patient.findFirst({ where: { mrn: p.mrn }, select: { id: true } });
  if (!patient) {
    const cands = await db.patient.findMany({
      where: { firstName: { equals: p.firstName, mode: "insensitive" }, lastName: { equals: p.lastName, mode: "insensitive" } },
      select: { id: true, dob: true },
    });
    const narrowed = p.dob ? cands.filter((c) => c.dob && c.dob.toISOString().slice(0, 10) === p.dob) : cands;
    if (narrowed.length === 1) patient = { id: narrowed[0].id };
    else if (narrowed.length > 1) return NextResponse.json({ error: "Multiple patients match this name — add an MRN to the document, or import into a specific chart." }, { status: 400 });
  }
  if (!patient) {
    // create
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
  const res = { problems: { created: 0, skipped: 0 }, medications: { created: 0, skipped: 0 }, allergies: { created: 0, skipped: 0 } };

  // Preload existing records for this patient and dedupe in JS (case-insensitive,
  // exact match). We avoid Prisma's insensitive `equals` here because on MongoDB it
  // builds an UNESCAPED regex, so values with regex-special chars (e.g. "Essential
  // (primary) hypertension", "Metformin (extended release)") would fail to match.
  const norm = (s: string) => s.trim().toLowerCase();
  const [existingProblems, existingMeds, existingAllergies] = await Promise.all([
    db.problem.findMany({ where: { patientId: pid }, select: { description: true } }),
    db.medication.findMany({ where: { patientId: pid }, select: { name: true } }),
    db.allergy.findMany({ where: { patientId: pid }, select: { substance: true } }),
  ]);
  const problemSet = new Set(existingProblems.map((x) => norm(x.description)));
  const medSet = new Set(existingMeds.map((x) => norm(x.name)));
  const allergySet = new Set(existingAllergies.map((x) => norm(x.substance)));

  // Problems (dedupe by description, case-insensitive)
  for (const pr of ex.problems) {
    if (problemSet.has(norm(pr.description))) { res.problems.skipped++; continue; }
    await db.problem.create({ data: { patientId: pid, description: pr.description, icd10: pr.icd10 || null, status: pr.status || "active", onsetDate: pr.onsetDate ? new Date(pr.onsetDate) : null } });
    problemSet.add(norm(pr.description));
    res.problems.created++;
  }
  // Medications (dedupe by name)
  for (const m of ex.medications) {
    if (medSet.has(norm(m.name))) { res.medications.skipped++; continue; }
    await db.medication.create({ data: { patientId: pid, name: m.name, sig: m.sig || null, status: m.status || "active" } });
    medSet.add(norm(m.name));
    res.medications.created++;
  }
  // Allergies (dedupe by substance)
  for (const a of ex.allergies) {
    if (allergySet.has(norm(a.substance))) { res.allergies.skipped++; continue; }
    await db.allergy.create({ data: { patientId: pid, substance: a.substance, reaction: a.reaction || null, severity: a.severity || null, status: a.status || "active" } });
    allergySet.add(norm(a.substance));
    res.allergies.created++;
  }

  const totalCreated = res.problems.created + res.medications.created + res.allergies.created;
  const totalSkipped = res.problems.skipped + res.medications.skipped + res.allergies.skipped;
  const total = ex.problems.length + ex.medications.length + ex.allergies.length;

  const job = await db.importJob.create({
    data: {
      source: ex.format, entity: "clinical", status: "completed",
      total, created: totalCreated, skipped: totalSkipped, failed: 0,
      errors: undefined,
      createdById: admin.id, createdByName: `${admin.firstName} ${admin.lastName}`,
    },
  }).catch(() => null);

  return NextResponse.json({
    ok: true, jobId: job?.id || null, format: ex.format,
    patientId: pid, patientCreated,
    counts: res,
    total, created: totalCreated, skipped: totalSkipped,
  });
}
