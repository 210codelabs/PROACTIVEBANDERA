import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { parseClinicalDocument, detectFormat } from "@/lib/import/clinical";
import { matchClinicalPatient } from "@/lib/import/patientMatch";

// POST /api/admin/import/clinical/preview { content }
// Parses a C-CDA XML or FHIR JSON bundle and returns extracted demographics +
// problems/medications/allergies, plus whether the patient already exists.
// No data is written.
export async function POST(req: Request) {
  try { await requireAdminSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const b = await req.json().catch(() => ({}));
  const content = String(b.content || "");
  if (!content.trim()) return NextResponse.json({ error: "Paste or upload a C-CDA XML or FHIR JSON bundle." }, { status: 400 });
  if (!detectFormat(content)) return NextResponse.json({ error: "Unrecognized file — expected C-CDA XML (starts with <) or FHIR JSON (starts with {)." }, { status: 400 });

  let ex;
  try { ex = parseClinicalDocument(content); }
  catch (e: any) { return NextResponse.json({ error: String(e?.message || e) }, { status: 400 }); }

  const p = ex.patient;
  const hasName = !!(p.firstName && p.lastName);
  const missing: string[] = [];
  if (!hasName) missing.push("patient name");
  if (!p.dob) missing.push("date of birth");

  // Existing patient match
  const match = await matchClinicalPatient(p);

  // Provider roster (for the "default provider for imported visits" picker,
  // only relevant when the document carries encounters/notes).
  const providers = ex.encounters.length
    ? await db.user.findMany({ where: { role: "provider", active: true }, select: { id: true, firstName: true, lastName: true, npi: true, credential: true }, orderBy: { lastName: "asc" } }).catch(() => [])
    : [];

  return NextResponse.json({
    ok: true,
    format: ex.format,
    patient: p,
    counts: { problems: ex.problems.length, medications: ex.medications.length, allergies: ex.allergies.length, vitals: ex.vitals.length, immunizations: ex.immunizations.length, encounters: ex.encounters.length },
    problems: ex.problems.slice(0, 25),
    medications: ex.medications.slice(0, 25),
    allergies: ex.allergies.slice(0, 25),
    vitals: ex.vitals.slice(0, 25),
    immunizations: ex.immunizations.slice(0, 25),
    encounters: ex.encounters.slice(0, 25),
    providers: providers.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}${p.credential ? ", " + p.credential : ""}`, npi: p.npi || null })),
    missingRequired: missing,
    match,
  });
}
