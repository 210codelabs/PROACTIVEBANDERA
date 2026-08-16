import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAttorneySession } from "@/lib/attorneyAuth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFileSync } from "fs";
import path from "path";
import { buildCcda } from "@/lib/ehi/ccda";

const BRAND = rgb(0.039, 0.145, 0.251); // #0a2540
const BRAND_LIGHT = rgb(0.20, 0.45, 0.75);
const GRAY = rgb(0.42, 0.45, 0.5);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getAttorneySession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const format = (new URL(req.url).searchParams.get("format") || "pdf").toLowerCase();

  const rr = await db.recordRequest.findUnique({ where: { id } });
  if (!rr || rr.attorneyId !== s.attorneyId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rr.status !== "approved") return NextResponse.json({ error: "This request has not been approved yet." }, { status: 403 });

  const patient = await db.patient.findFirst({
    where: { mrn: rr.patientMrn },
    include: { problems: true, medications: true, allergies: true, documents: true, vitals: true, immunizations: true, encounters: true },
  });
  if (!patient || patient.lastName.toLowerCase() !== rr.patientLastName.toLowerCase()) {
    return NextResponse.json({ error: "Patient record could not be verified." }, { status: 404 });
  }

  // Record-release audit trail
  await db.auditLog.create({
    data: { userId: null, action: "records.release", resource: "RecordRequest", resourceId: rr.id, meta: JSON.stringify({ mrn: patient.mrn, attorneyId: rr.attorneyId, attorney: s.email, format }) },
  }).catch(() => {});

  // ---- C-CDA (portable, human-readable) ----
  if (format === "ccda") {
    const providers = await db.user.findMany({ select: { id: true, firstName: true, lastName: true, credential: true } }).catch(() => []);
    const pmap = new Map(providers.map((u: any) => [u.id, `${u.firstName} ${u.lastName}${u.credential ? ", " + u.credential : ""}`.trim()]));
    const xml = buildCcda(patient, (pid?: string | null) => (pid && pmap.get(pid)) || "");
    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="proactive-ccd-${patient.mrn}-${rr.id}.xml"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ---- Build branded PDF ----
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Proactive Clinic — Records ${patient.mrn}`);
  pdf.setProducer("Proactive Clinic EHR");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let logoImg: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  try {
    const bytes = readFileSync(path.join(process.cwd(), "public", "pclinic-header.png"));
    logoImg = await pdf.embedPng(bytes);
  } catch { logoImg = null; }

  const W = 612, H = 792, M = 50;
  let page = pdf.addPage([W, H]);
  let y = H;

  function header() {
    page.drawRectangle({ x: 0, y: H - 92, width: W, height: 92, color: BRAND });
    if (logoImg) {
      const lw = 150; const lh = (logoImg.height / logoImg.width) * lw;
      // white plate behind logo for contrast
      page.drawRectangle({ x: M - 6, y: H - 30 - lh - 6, width: lw + 12, height: lh + 12, color: rgb(1, 1, 1) });
      page.drawImage(logoImg, { x: M, y: H - 30 - lh, width: lw, height: lh });
    } else {
      page.drawText("Proactive Clinic", { x: M, y: H - 55, size: 20, font: bold, color: rgb(1, 1, 1) });
    }
    page.drawText("AUTHORIZED MEDICAL RECORDS RELEASE", { x: W - M - 300, y: H - 42, size: 11, font: bold, color: rgb(1, 1, 1) });
    page.drawText("A Division of Proactive UMS Inc.", { x: W - M - 300, y: H - 58, size: 8, font, color: rgb(0.8, 0.85, 0.95) });
    page.drawText("8103 Bandera Rd, Suite 102, San Antonio, TX 78250", { x: W - M - 300, y: H - 70, size: 8, font, color: rgb(0.8, 0.85, 0.95) });
    y = H - 116;
  }
  function footer() {
    page.drawText("CONFIDENTIAL — Protected Health Information. Handle in accordance with HIPAA.", {
      x: M, y: 34, size: 8, font, color: GRAY,
    });
  }
  function ensure(space: number) {
    if (y - space < 60) { footer(); page = pdf.addPage([W, H]); header(); }
  }
  function wrap(text: string, size: number, f = font, maxW = W - 2 * M) {
    const words = text.split(" "); const lines: string[] = []; let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (f.widthOfTextAtSize(test, size) > maxW) { if (cur) lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function line(text: string, opts: { size?: number; f?: typeof font; color?: typeof BRAND; indent?: number } = {}) {
    const size = opts.size ?? 10; const f = opts.f ?? font; const color = opts.color ?? rgb(0.1, 0.12, 0.15); const indent = opts.indent ?? 0;
    for (const ln of wrap(text, size, f, W - 2 * M - indent)) {
      ensure(size + 5);
      page.drawText(ln, { x: M + indent, y: y - size, size, font: f, color });
      y -= size + 5;
    }
  }
  function section(title: string) {
    y -= 8; ensure(24);
    page.drawText(title, { x: M, y: y - 12, size: 12, font: bold, color: BRAND });
    page.drawLine({ start: { x: M, y: y - 17 }, end: { x: W - M, y: y - 17 }, thickness: 1, color: BRAND_LIGHT });
    y -= 26;
  }

  header();
  line(`Released to: ${s.name}${s.firm ? " (" + s.firm + ")" : ""} <${s.email}>`, { size: 9, color: GRAY });
  line(`Request ID: ${rr.id}   •   Status: APPROVED   •   Generated: ${new Date().toLocaleString()}`, { size: 9, color: GRAY });

  section("Patient");
  line(`${patient.firstName} ${patient.lastName}`, { size: 12, f: bold });
  line(`MRN: ${patient.mrn}    DOB: ${new Date(patient.dob).toISOString().slice(0, 10)}    Sex: ${patient.sex}`);
  line(`Phone: ${patient.phone || "—"}    Email: ${patient.email || "—"}`);

  section("Problems / Diagnoses");
  if (!patient.problems.length) line("(none on file)", { color: GRAY });
  patient.problems.forEach((p: any) => line(`• [${p.icd10 || "—"}] ${p.description} (${p.status})`, { indent: 6 }));

  section("Medications");
  if (!patient.medications.length) line("(none on file)", { color: GRAY });
  patient.medications.forEach((m: any) => line(`• ${[m.name, m.strength, m.form, m.route, m.sig].filter(Boolean).join(" ")}`, { indent: 6 }));

  section("Allergies");
  if (!patient.allergies.length) line("(none on file)", { color: GRAY });
  patient.allergies.forEach((a: any) => line(`• ${a.substance} — ${a.reaction || ""} ${a.severity ? "(" + a.severity + ")" : ""}`, { indent: 6 }));

  section("Immunizations");
  if (!patient.immunizations.length) line("(none on file)", { color: GRAY });
  patient.immunizations.forEach((i: any) => line(`• ${new Date(i.givenAt).toISOString().slice(0, 10)}  ${i.vaccine}${i.cvxCode ? " [CVX " + i.cvxCode + "]" : ""}`, { indent: 6 }));

  section("Encounters");
  if (!patient.encounters.length) line("(none on file)", { color: GRAY });
  patient.encounters
    .slice()
    .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .forEach((e: any) => line(`• ${e.startedAt ? new Date(e.startedAt).toISOString().slice(0, 10) : "—"}  ${e.encounterTypeName || e.visitType || "Visit"}${e.chiefComplaint ? " — " + e.chiefComplaint : ""}`, { indent: 6 }));

  section("Documents on file");
  if (!patient.documents.length) line("(none on file)", { color: GRAY });
  patient.documents.forEach((d: any) => line(`• ${new Date(d.createdAt).toISOString().slice(0, 10)}  ${d.title} [${d.category || "other"}]`, { indent: 6 }));

  footer();

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="proactive-records-${patient.mrn}-${rr.id}.pdf"`,
    },
  });
}
