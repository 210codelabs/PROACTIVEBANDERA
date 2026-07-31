import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAttorneySession } from "@/lib/attorneyAuth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getAttorneySession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const rr = await db.recordRequest.findUnique({ where: { id } });
  if (!rr || rr.attorneyId !== s.attorneyId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rr.status !== "approved") return NextResponse.json({ error: "This request has not been approved yet." }, { status: 403 });

  const patient = await db.patient.findFirst({
    where: { mrn: rr.patientMrn },
    include: { problems: true, medications: true, allergies: true, documents: true },
  });
  if (!patient || patient.lastName.toLowerCase() !== rr.patientLastName.toLowerCase()) {
    return NextResponse.json({ error: "Patient record could not be verified." }, { status: 404 });
  }

  const L: string[] = [];
  L.push("PROACTIVE CLINIC — AUTHORIZED MEDICAL RECORDS RELEASE");
  L.push("A Division of Proactive UMS Inc. — 8103 Bandera Rd, Suite 102, San Antonio, TX 78250");
  L.push("");
  L.push(`Released to attorney: ${s.name}${s.firm ? " (" + s.firm + ")" : ""} <${s.email}>`);
  L.push(`Request ID: ${rr.id}  |  Approved  |  Generated: ${new Date().toISOString()}`);
  L.push("CONFIDENTIAL — Protected Health Information. Handle per HIPAA.");
  L.push("".padEnd(70, "="));
  L.push(`PATIENT: ${patient.firstName} ${patient.lastName}   MRN: ${patient.mrn}`);
  L.push(`DOB: ${new Date(patient.dob).toISOString().slice(0, 10)}   Sex: ${patient.sex}`);
  L.push(`Phone: ${patient.phone || "—"}   Email: ${patient.email || "—"}`);
  L.push("");
  L.push("PROBLEMS / DIAGNOSES");
  if (patient.problems.length === 0) L.push("  (none on file)");
  patient.problems.forEach((p: any) => L.push(`  - [${p.icd10 || "—"}] ${p.description} (${p.status})`));
  L.push("");
  L.push("MEDICATIONS");
  if (patient.medications.length === 0) L.push("  (none on file)");
  patient.medications.forEach((m: any) => L.push(`  - ${m.name} ${m.strength || ""} ${m.form || ""} ${m.route || ""} ${m.sig || ""}`.trim()));
  L.push("");
  L.push("ALLERGIES");
  if (patient.allergies.length === 0) L.push("  (none on file)");
  patient.allergies.forEach((a: any) => L.push(`  - ${a.substance} — ${a.reaction || ""} (${a.severity || ""})`));
  L.push("");
  L.push("DOCUMENTS ON FILE");
  if (patient.documents.length === 0) L.push("  (none on file)");
  patient.documents.forEach((d: any) => L.push(`  - ${new Date(d.createdAt).toISOString().slice(0, 10)}  ${d.title} [${d.category || "other"}]`));
  L.push("");
  L.push("".padEnd(70, "="));
  L.push("End of authorized release.");

  const body = L.join("\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="records-${patient.mrn}-${rr.id}.txt"`,
    },
  });
}
