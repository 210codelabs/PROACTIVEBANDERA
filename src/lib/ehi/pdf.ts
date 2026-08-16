/**
 * Human-readable single-patient clinical summary PDF (for records requests).
 * Server-only. Uses pdf-lib + clinic branding. Renders demographics + the
 * core clinical sections as simple tables with pagination.
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import fs from "fs";
import path from "path";
import { CLINIC } from "@/lib/intake/forms";

const C_BRAND = rgb(0.055, 0.278, 0.42);
const C_ACCENT = rgb(0.02, 0.55, 0.55);
const C_INK = rgb(0.13, 0.17, 0.22);
const C_MUTED = rgb(0.42, 0.47, 0.53);
const C_LINE = rgb(0.8, 0.84, 0.89);
const C_ZEBRA = rgb(0.965, 0.977, 0.99);
const C_HEAD = rgb(0.92, 0.96, 0.96);
const C_WHITE = rgb(1, 1, 1);

const PAGE_W = 612, PAGE_H = 792, MARGIN = 40;
const CW = PAGE_W - MARGIN * 2;

let logoCache: Buffer | null | undefined;
function logoBytes(): Buffer | null {
  if (logoCache === undefined) {
    try { logoCache = fs.readFileSync(path.join(process.cwd(), "public", "pclinic-header.png")); }
    catch { logoCache = null; }
  }
  return logoCache;
}

function fmtDay(d?: Date | null): string {
  if (!d) return "—";
  try { return new Date(d).toISOString().slice(0, 10); } catch { return "—"; }
}

export async function buildPatientPdf(patient: any, providerName: (id?: string | null) => string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let logoImg: any = null;
  const lb = logoBytes();
  if (lb) { try { logoImg = await doc.embedPng(lb); } catch { logoImg = null; } }

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let pageNo = 0;

  function truncate(s: string, f: PDFFont, size: number, maxW: number): string {
    if (f.widthOfTextAtSize(s, size) <= maxW) return s;
    let out = s;
    while (out.length > 1 && f.widthOfTextAtSize(out + "…", size) > maxW) out = out.slice(0, -1);
    return out + "…";
  }

  function footer() {
    pageNo += 1;
    page.drawText(`${CLINIC.name} · Confidential — contains Protected Health Information (PHI)`, {
      x: MARGIN, y: 24, size: 7, font, color: C_MUTED,
    });
    page.drawText(`Page ${pageNo}`, { x: PAGE_W - MARGIN - 40, y: 24, size: 7, font, color: C_MUTED });
  }

  function newPage() {
    footer();
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  }

  function ensure(space: number) {
    if (y - space < MARGIN + 30) newPage();
  }

  // ---- header band ----
  page.drawRectangle({ x: 0, y: PAGE_H - 92, width: PAGE_W, height: 92, color: C_BRAND });
  if (logoImg) {
    const w = 150; const scale = w / logoImg.width; const h = logoImg.height * scale;
    // logo is dark-on-transparent; place on a white chip for contrast
    page.drawRectangle({ x: MARGIN - 6, y: PAGE_H - 70, width: w + 12, height: h + 12, color: C_WHITE });
    page.drawImage(logoImg, { x: MARGIN, y: PAGE_H - 64, width: w, height: h });
  } else {
    page.drawText(CLINIC.name, { x: MARGIN, y: PAGE_H - 48, size: 18, font: bold, color: C_WHITE });
  }
  page.drawText("Patient Clinical Summary", { x: PAGE_W - MARGIN - 200, y: PAGE_H - 40, size: 14, font: bold, color: C_WHITE });
  page.drawText(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, {
    x: PAGE_W - MARGIN - 200, y: PAGE_H - 58, size: 8, font, color: rgb(0.85, 0.92, 0.95),
  });
  y = PAGE_H - 92 - 20;

  // ---- demographics box ----
  const demo: [string, string][] = [
    ["Name", `${patient.firstName || ""} ${patient.lastName || ""}`.trim()],
    ["MRN", patient.mrn || "—"],
    ["Date of birth", fmtDay(patient.dob)],
    ["Sex", patient.sex || "—"],
    ["Phone", patient.phone || "—"],
    ["Email", patient.email || "—"],
    ["Address", [patient.addressLine1, patient.city, patient.state, patient.postalCode].filter(Boolean).join(", ") || "—"],
    ["Status", patient.status || "active"],
  ];
  const boxH = 20 + Math.ceil(demo.length / 2) * 16 + 8;
  ensure(boxH);
  page.drawRectangle({ x: MARGIN, y: y - boxH, width: CW, height: boxH, color: C_ZEBRA, borderColor: C_LINE, borderWidth: 0.5 });
  page.drawText("Patient", { x: MARGIN + 10, y: y - 15, size: 10, font: bold, color: C_BRAND });
  let dy = y - 32;
  demo.forEach((row, i) => {
    const col = i % 2;
    const x = MARGIN + 10 + col * (CW / 2);
    if (col === 0 && i > 0) dy -= 16;
    if (i === 0) dy = y - 32;
    page.drawText(`${row[0]}:`, { x, y: dy, size: 8, font: bold, color: C_MUTED });
    page.drawText(truncate(row[1], font, 8.5, CW / 2 - 90), { x: x + 78, y: dy, size: 8.5, font, color: C_INK });
  });
  y = y - boxH - 18;

  // ---- generic section table ----
  function sectionTable(title: string, headers: string[], widths: number[], rows: string[][]) {
    ensure(40);
    // title
    page.drawText(title, { x: MARGIN, y: y - 12, size: 11, font: bold, color: C_BRAND });
    page.drawLine({ start: { x: MARGIN, y: y - 17 }, end: { x: PAGE_W - MARGIN, y: y - 17 }, thickness: 1, color: C_ACCENT });
    y -= 26;

    if (!rows.length) {
      page.drawText("No records on file.", { x: MARGIN + 4, y: y - 4, size: 9, font, color: C_MUTED });
      y -= 22;
      return;
    }

    const colX = (i: number) => MARGIN + widths.slice(0, i).reduce((a, b) => a + b, 0) * CW;
    const rowH = 16;

    const drawHeader = () => {
      page.drawRectangle({ x: MARGIN, y: y - rowH, width: CW, height: rowH, color: C_HEAD });
      headers.forEach((h, i) => {
        page.drawText(truncate(h, bold, 8, widths[i] * CW - 8), { x: colX(i) + 4, y: y - 11, size: 8, font: bold, color: C_BRAND });
      });
      y -= rowH;
    };
    drawHeader();

    rows.forEach((r, ri) => {
      if (y - rowH < MARGIN + 30) { newPage(); drawHeader(); }
      if (ri % 2 === 1) page.drawRectangle({ x: MARGIN, y: y - rowH, width: CW, height: rowH, color: C_ZEBRA });
      r.forEach((c, i) => {
        page.drawText(truncate(String(c ?? "—"), font, 8, widths[i] * CW - 8), { x: colX(i) + 4, y: y - 11, size: 8, font, color: C_INK });
      });
      y -= rowH;
    });
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: C_LINE });
    y -= 18;
  }

  // ---- sections ----
  const problems = patient.problems || [];
  sectionTable("Problems / Diagnoses", ["Problem", "ICD-10", "Status", "Onset"], [0.52, 0.16, 0.16, 0.16],
    problems.map((p: any) => [p.description, p.icd10 || "—", p.status || "active", fmtDay(p.onsetDate)]));

  const allergies = patient.allergies || [];
  sectionTable("Allergies", ["Substance", "Reaction", "Severity", "Status"], [0.34, 0.34, 0.16, 0.16],
    allergies.map((a: any) => [a.substance, a.reaction || "—", a.severity || "—", a.status || "active"]));

  const meds = patient.medications || [];
  sectionTable("Medications", ["Medication", "Dose/Form", "Sig", "Status"], [0.3, 0.22, 0.32, 0.16],
    meds.map((m: any) => [m.name, [m.strength, m.form].filter(Boolean).join(" ") || "—", m.sig || "—", m.status || "active"]));

  const vitals = patient.vitals || [];
  sectionTable("Vital Signs", ["Date", "BP", "HR", "Temp°C", "RR", "SpO2", "Wt(kg)", "BMI"],
    [0.2, 0.14, 0.1, 0.12, 0.1, 0.1, 0.12, 0.12],
    vitals.map((v: any) => [
      fmtDay(v.takenAt),
      (v.systolic != null || v.diastolic != null) ? `${v.systolic ?? "?"}/${v.diastolic ?? "?"}` : "—",
      v.pulse ?? "—", v.temperatureC ?? "—", v.respRate ?? "—", v.spo2 ?? "—", v.weightKg ?? "—", v.bmi ?? "—",
    ].map(String)));

  const imms = patient.immunizations || [];
  sectionTable("Immunizations", ["Vaccine", "CVX", "Date", "Lot"], [0.46, 0.14, 0.2, 0.2],
    imms.map((i: any) => [i.vaccine, i.cvxCode || "—", fmtDay(i.givenAt), i.lot || "—"]));

  const encs = patient.encounters || [];
  sectionTable("Encounters", ["Date", "Type", "Provider", "Reason"], [0.18, 0.28, 0.26, 0.28],
    encs.map((e: any) => [fmtDay(e.startedAt), e.encounterTypeName || e.visitType || "Visit", providerName(e.providerId) || "—", e.chiefComplaint || "—"]));

  footer();

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
