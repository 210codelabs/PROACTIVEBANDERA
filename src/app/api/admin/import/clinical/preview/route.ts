import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { parseClinicalDocument, detectFormat } from "@/lib/import/clinical";

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

  // Existing patient match
  let match: any = null;
  if (p.mrn) {
    const found = await db.patient.findFirst({ where: { mrn: p.mrn }, select: { id: true, firstName: true, lastName: true, mrn: true } });
    if (found) match = { by: "mrn", ...found };
  }
  if (!match && hasName) {
    const cands = await db.patient.findMany({
      where: { firstName: { equals: p.firstName!, mode: "insensitive" }, lastName: { equals: p.lastName!, mode: "insensitive" } },
      select: { id: true, firstName: true, lastName: true, mrn: true, dob: true },
    });
    const narrowed = p.dob ? cands.filter((c) => c.dob && c.dob.toISOString().slice(0, 10) === p.dob) : cands;
    if (narrowed.length === 1) match = { by: p.dob ? "name+dob" : "name", id: narrowed[0].id, firstName: narrowed[0].firstName, lastName: narrowed[0].lastName, mrn: narrowed[0].mrn };
    else if (narrowed.length > 1) match = { by: "ambiguous", count: narrowed.length };
  }

  return NextResponse.json({
    ok: true,
    format: ex.format,
    patient: p,
    counts: { problems: ex.problems.length, medications: ex.medications.length, allergies: ex.allergies.length, vitals: ex.vitals.length, immunizations: ex.immunizations.length },
    problems: ex.problems.slice(0, 25),
    medications: ex.medications.slice(0, 25),
    allergies: ex.allergies.slice(0, 25),
    vitals: ex.vitals.slice(0, 25),
    immunizations: ex.immunizations.slice(0, 25),
    missingRequired: missing,
    match,
  });
}
