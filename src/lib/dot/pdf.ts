// Faithful replica of FMCSA Form MCSA-5875 (Medical Examination Report) and the
// MCSA-5876 Medical Examiner's Certificate (MEC card), rendered with pdf-lib.
// These are generated replicas for workflow/record purposes — the certified
// medical examiner remains responsible for the official determination and for
// reporting to the FMCSA National Registry.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { HEALTH_HISTORY, PHYSICAL_SYSTEMS, RESTRICTION_OPTIONS } from "./forms";

const asc = (s: unknown) => String(s ?? "").replace(/[^\x00-\x7F]/g, "-");

type Ctx = {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
};

const BRAND = rgb(0.12, 0.35, 0.7);
const INK = rgb(0.1, 0.1, 0.1);
const GRAY = rgb(0.45, 0.45, 0.45);
const LINE = rgb(0.8, 0.8, 0.8);

function newPage(ctx: Ctx) {
  ctx.page = ctx.pdf.addPage([612, 792]);
  ctx.y = 752;
}
function ensure(ctx: Ctx, need: number) {
  if (ctx.y - need < 48) newPage(ctx);
}
function text(ctx: Ctx, t: string, x: number, size = 9, f?: PDFFont, color = INK) {
  ctx.page.drawText(asc(t), { x, y: ctx.y, size, font: f || ctx.font, color });
}
function hr(ctx: Ctx) {
  ctx.page.drawLine({ start: { x: 40, y: ctx.y }, end: { x: 572, y: ctx.y }, thickness: 0.8, color: LINE });
}
function sectionHeader(ctx: Ctx, label: string) {
  ensure(ctx, 26);
  ctx.y -= 6;
  ctx.page.drawRectangle({ x: 40, y: ctx.y - 4, width: 532, height: 16, color: rgb(0.93, 0.96, 1) });
  text(ctx, label, 46, 10, ctx.bold, BRAND);
  ctx.y -= 20;
}
function checkbox(ctx: Ctx, x: number, checked: boolean, label: string) {
  ctx.page.drawRectangle({ x, y: ctx.y - 1, width: 9, height: 9, borderWidth: 0.8, borderColor: rgb(0.3, 0.3, 0.3) });
  if (checked) text(ctx, "X", x + 1.6, 9, ctx.bold);
  text(ctx, label, x + 14, 9);
}

export async function buildMcsa5875(exam: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { pdf, page: pdf.addPage([612, 792]), font, bold, y: 752 };

  // Header
  text(ctx, "U.S. Department of Transportation", 40, 8, font, GRAY);
  text(ctx, "Federal Motor Carrier Safety Administration", 40, 8, font, GRAY);
  ctx.page.drawText("Form MCSA-5875", { x: 470, y: ctx.y, size: 9, font: bold, color: BRAND });
  ctx.y -= 14;
  ctx.page.drawText("MEDICAL EXAMINATION REPORT", { x: 40, y: ctx.y, size: 15, font: bold, color: INK });
  ctx.y -= 10;
  text(ctx, "For Commercial Driver Fitness Determination (49 CFR 391.41-391.49)", 40, 8, font, GRAY);
  ctx.y -= 6; hr(ctx); ctx.y -= 16;

  const di = exam.driverInfo || {};
  // Driver info block
  sectionHeader(ctx, "Section 1 — Driver Information");
  const row = (l: string, v: string, x = 46) => { text(ctx, `${l}:`, x, 9, bold); text(ctx, v, x + 90, 9); };
  row("Driver name", exam.driverName || `${di.firstName || ""} ${di.lastName || ""}`);
  ctx.y -= 14; row("Date of birth", asc(di.dob || "")); row("Age", asc(di.age || ""), 330);
  ctx.y -= 14; row("License #", asc(di.licenseNumber || "")); row("State", asc(di.licenseState || ""), 330);
  ctx.y -= 14; row("Address", asc(di.address || ""));
  ctx.y -= 14; row("Phone", asc(di.phone || "")); row("CDL", di.hasCdl ? "Yes" : "No", 330);
  ctx.y -= 14; row("Exam reason", asc(di.dotReason || "Certification"));
  if (exam.carrier) { ctx.y -= 14; row("Carrier", asc(exam.carrier.legalName || "")); row("USDOT", asc(exam.carrier.dotNumber || ""), 330); }
  ctx.y -= 18;

  // Health history
  sectionHeader(ctx, "Section 2 — Driver Health History");
  text(ctx, "Has the driver ever had, or currently have, any of the following? (Yes / No)", 46, 8, font, GRAY);
  ctx.y -= 16;
  const hh = exam.healthHistory || {};
  for (const q of HEALTH_HISTORY) {
    ensure(ctx, 14);
    const item = hh[q.key] || {};
    const yes = !!item.yes;
    checkbox(ctx, 46, yes, "Y");
    checkbox(ctx, 78, !yes, "N");
    text(ctx, q.label, 110, 8.5);
    if (yes && item.detail) { ctx.y -= 11; text(ctx, `    - ${asc(item.detail)}`, 110, 8, font, GRAY); }
    ctx.y -= 14;
  }
  if (di.medications) { ensure(ctx, 16); text(ctx, "Current medications:", 46, 9, bold); ctx.y -= 12; text(ctx, asc(di.medications), 46, 8.5); ctx.y -= 16; }

  // Testing / vitals
  sectionHeader(ctx, "Section 3 — Testing (Examiner)");
  const v = exam.vitals || {}, vis = exam.vision || {}, he = exam.hearing || {}, ur = exam.urinalysis || {};
  row("Height (in)", asc(v.heightIn || "")); row("Weight (lb)", asc(v.weightLb || ""), 330); ctx.y -= 14;
  row("Blood pressure", `${asc(v.bpSystolic || "")}/${asc(v.bpDiastolic || "")}`); row("Pulse", asc(v.pulse || ""), 330); ctx.y -= 16;
  text(ctx, "Vision (corrected):", 46, 9, bold); ctx.y -= 12;
  row("Right", asc(vis.acuityRightCorrected || "")); row("Left", asc(vis.acuityLeftCorrected || ""), 200); row("Both", asc(vis.acuityBothCorrected || ""), 350); ctx.y -= 14;
  row("Field R (deg)", asc(vis.fieldRightDeg || "")); row("Field L (deg)", asc(vis.fieldLeftDeg || ""), 200); row("Color", vis.colorPass === false ? "Fail" : "Pass", 350); ctx.y -= 16;
  text(ctx, "Hearing:", 46, 9, bold); ctx.y -= 12;
  row("Whisper R (ft)", asc(he.whisperRightFt || "")); row("Whisper L (ft)", asc(he.whisperLeftFt || ""), 200); row("dB loss", asc(he.dbLossBetterEar || ""), 350); ctx.y -= 16;
  text(ctx, "Urinalysis:", 46, 9, bold); ctx.y -= 12;
  row("Sp. gravity", asc(ur.spGravity || "")); row("Protein", asc(ur.protein || ""), 200); row("Blood", asc(ur.blood || ""), 300); row("Sugar", asc(ur.sugar || ""), 400); ctx.y -= 18;

  // Physical exam
  sectionHeader(ctx, "Section 4 — Physical Examination");
  const pe = exam.physicalExam || {};
  for (const s of PHYSICAL_SYSTEMS) {
    ensure(ctx, 13);
    const it = pe[s.key] || {};
    const abn = !!it.abnormal;
    checkbox(ctx, 46, !abn, "Normal");
    checkbox(ctx, 120, abn, "Abnormal");
    text(ctx, s.label, 200, 8.5);
    if (abn && it.notes) { ctx.y -= 11; text(ctx, `    - ${asc(it.notes)}`, 200, 8, font, GRAY); }
    ctx.y -= 13;
  }
  ctx.y -= 8;

  // Determination
  sectionHeader(ctx, "Section 5 — Medical Examiner Determination");
  const fl = exam.determinationFlags || {};
  checkbox(ctx, 46, !!fl.meetsStandards, "Meets standards (49 CFR 391.41); qualifies for certificate"); ctx.y -= 14;
  checkbox(ctx, 46, !!fl.meetsWithExemption, "Meets standards but periodic monitoring / exemption required"); ctx.y -= 14;
  checkbox(ctx, 46, !!fl.doesNotMeet, "Does NOT meet standards"); ctx.y -= 14;
  checkbox(ctx, 46, !!fl.temporarilyDisqualified, "Temporarily disqualified (condition being treated)"); ctx.y -= 14;
  checkbox(ctx, 46, !!fl.incomplete, "Incomplete examination"); ctx.y -= 18;
  row("Certificate length", exam.certMonths ? `${exam.certMonths} month(s)` : ""); row("Expires", asc(exam.expiresOn ? new Date(exam.expiresOn).toLocaleDateString() : ""), 330); ctx.y -= 14;
  const restr: string[] = exam.restrictions || [];
  if (restr.length) {
    text(ctx, "Restrictions:", 46, 9, bold); ctx.y -= 12;
    for (const r of restr) { const lbl = RESTRICTION_OPTIONS.find((o) => o.key === r)?.label || r; checkbox(ctx, 46, true, lbl); ctx.y -= 13; }
  }
  const addl: string[] = exam.additionalFormsRequired || [];
  if (addl.length) { ctx.y -= 4; text(ctx, `Additional forms required: ${addl.join(", ")}`, 46, 9, bold, rgb(0.7, 0.1, 0.1)); ctx.y -= 16; }

  // Examiner attestation
  ctx.y -= 6; sectionHeader(ctx, "Section 6 — Medical Examiner");
  row("Examiner", asc(exam.examinerName || "")); ctx.y -= 14;
  row("Nat'l Registry #", asc(exam.examinerNrcme || "")); row("License #", asc(exam.examinerLicense || ""), 330); ctx.y -= 14;
  row("License state", asc(exam.examinerLicenseState || "")); row("Exam date", asc(exam.examDate ? new Date(exam.examDate).toLocaleDateString() : ""), 330); ctx.y -= 20;
  ctx.page.drawLine({ start: { x: 46, y: ctx.y }, end: { x: 300, y: ctx.y }, thickness: 0.8, color: rgb(0.3, 0.3, 0.3) }); ctx.y -= 12;
  text(ctx, `Signature: ${asc(exam.examinerSignature || exam.examinerName || "")}`, 46, 10, bold, BRAND); ctx.y -= 18;
  text(ctx, "Replica of FMCSA Form MCSA-5875 generated by ProactiveClinics for record purposes.", 46, 7.5, font, GRAY);

  return pdf.save();
}

export async function buildMecCard5876(exam: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([612, 792]);
  const di = exam.driverInfo || {};

  // Card ~ 3.5in x 2in (252 x 144 pt), centered near top.
  const cw = 342, ch = 200, cx = (612 - cw) / 2, cy = 560;
  page.drawRectangle({ x: cx, y: cy, width: cw, height: ch, borderWidth: 1.4, borderColor: BRAND, color: rgb(0.98, 0.99, 1) });
  const T = (t: string, x: number, y: number, size = 8, f: PDFFont = font, color = INK) => page.drawText(asc(t), { x, y, size, font: f, color });

  T("MEDICAL EXAMINER'S CERTIFICATE", cx + 14, cy + ch - 20, 10, bold, BRAND);
  T("Form MCSA-5876  -  49 CFR 391.43(h)", cx + 14, cy + ch - 32, 7, font, GRAY);
  page.drawLine({ start: { x: cx + 14, y: cy + ch - 38 }, end: { x: cx + cw - 14, y: cy + ch - 38 }, thickness: 0.6, color: LINE });

  let yy = cy + ch - 54;
  const line = (l: string, v: string) => { T(`${l}:`, cx + 14, yy, 8, bold); T(v, cx + 110, yy, 8); yy -= 14; };
  line("Driver", exam.driverName || `${di.firstName || ""} ${di.lastName || ""}`);
  line("DOB", asc(di.dob || ""));
  line("Issued", exam.examDate ? new Date(exam.examDate).toLocaleDateString() : new Date().toLocaleDateString());
  line("Expires", exam.expiresOn ? new Date(exam.expiresOn).toLocaleDateString() : "");
  const restr: string[] = exam.restrictions || [];
  const restrLabels = restr.map((r) => RESTRICTION_OPTIONS.find((o) => o.key === r)?.label || r);
  T("Restrictions:", cx + 14, yy, 8, bold); T(restrLabels.length ? restrLabels.join("; ").slice(0, 60) : "None", cx + 110, yy, 7); yy -= 16;

  page.drawLine({ start: { x: cx + 14, y: yy + 4 }, end: { x: cx + cw - 14, y: yy + 4 }, thickness: 0.6, color: LINE });
  yy -= 6;
  T(`Medical Examiner: ${asc(exam.examinerName || "")}`, cx + 14, yy, 7.5, bold); yy -= 11;
  T(`Nat'l Registry #: ${asc(exam.examinerNrcme || "")}   License: ${asc(exam.examinerLicense || "")}`, cx + 14, yy, 7);

  // Below the card
  page.drawText("Medical Examiner's Certificate (wallet copy)", { x: cx, y: cy - 20, size: 9, font: bold, color: INK });
  page.drawText("Present this certificate with your commercial driver license. Replica generated by ProactiveClinics.", { x: cx, y: cy - 34, size: 7.5, font, color: GRAY });

  return pdf.save();
}
