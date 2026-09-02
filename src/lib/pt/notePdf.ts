import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import fs from "fs/promises";
import path from "path";

export type PtNoteLike = {
  id: string;
  visitDate: Date | string | null;
  dateOfInjury?: Date | string | null;
  mechanism?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  goals?: string | null;
  causation?: string | null;
  cptCodes?: string[];
  icdCodes?: string[];
  status?: string | null;
  authorName?: string | null;
  authorCredential?: string | null;
  authorNpi?: string | null;
  authorLicense?: string | null;
  signedAt?: Date | string | null;
  signedByName?: string | null;
};

export type PtPatientLike = { firstName: string; lastName: string; mrn?: string | null; dob?: Date | string | null } | null;

export type PtIntakeLike = {
  accidentType?: string | null;
  accidentDate?: Date | string | null;
  location?: string | null;
  description?: string | null;
  role?: string | null;
  bodyParts?: string[] | null;
  painLevel?: number | null;
  priorInjuries?: string | null;
  autoInsurer?: string | null;
  autoPolicy?: string | null;
  claimNumber?: string | null;
  adjuster?: string | null;
  attorney?: string | null;
  lawFirm?: string | null;
} | null;

export function sanitize(s: unknown): string {
  return String(s ?? "")
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2022\u25CF]/g, "-")
    .replace(/[^\x00-\xFF]/g, "?");
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const PAGE_W = 612, PAGE_H = 792, MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const slate = rgb(0.13, 0.16, 0.22);
const gray = rgb(0.42, 0.45, 0.5);
const indigo = rgb(0.31, 0.27, 0.9);

export async function buildPtPdf(opts: {
  patient: PtPatientLike;
  notes: PtNoteLike[];
  intake?: PtIntakeLike;
  org: string;
  legal?: string;
  website?: string;
  logoRel?: string;
  mode: "single" | "packet";
}): Promise<Uint8Array> {
  const { patient, notes, intake, org, legal = "", website = "", logoRel = "/pclinic-light.png", mode } = opts;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // Preload logo bytes once (with size guard so PDFs stay email-friendly).
  let logoImg: any = null, logoDims: { width: number; height: number } | null = null;
  try {
    const p = path.join(process.cwd(), "public", logoRel.replace(/^\//, ""));
    const bytes = await fs.readFile(p);
    if (bytes.length <= 250 * 1024) {
      logoImg = logoRel.toLowerCase().endsWith(".jpg") || logoRel.toLowerCase().endsWith(".jpeg")
        ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      const d = logoImg.scale(1);
      logoDims = { width: d.width, height: d.height };
    }
  } catch { /* no logo */ }

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function newPage() { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; }
  function ensureSpace(needed: number) { if (y - needed < MARGIN + 40) newPage(); }

  function wrap(text: string, size: number, f: PDFFont, maxW: number): string[] {
    const paras = sanitize(text).replace(/\r/g, "").split(/\n/);
    const lines: string[] = [];
    for (const para of paras) {
      if (para.trim() === "") { lines.push(""); continue; }
      let line = "";
      for (const word of para.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(test, size) > maxW && line) { lines.push(line); line = word; }
        else line = test;
      }
      if (line) lines.push(line);
    }
    return lines;
  }
  function drawText(text: string, size: number, f: PDFFont, color = slate, x = MARGIN) {
    for (const ln of wrap(text, size, f, CONTENT_W - (x - MARGIN))) {
      ensureSpace(size + 4);
      page.drawText(ln, { x, y: y - size, size, font: f, color });
      y -= size + 4;
    }
  }
  function letterhead() {
    if (logoImg && logoDims) {
      const targetH = 40, scale = targetH / logoDims.height, w = logoDims.width * scale;
      page.drawImage(logoImg, { x: PAGE_W - MARGIN - w, y: y - targetH, width: w, height: targetH });
    }
    page.drawText(sanitize(org), { x: MARGIN, y: y - 16, size: 16, font: bold, color: slate }); y -= 22;
    if (legal) { page.drawText(sanitize(legal), { x: MARGIN, y: y - 10, size: 9, font, color: gray }); y -= 14; }
    if (website) { page.drawText(sanitize(website), { x: MARGIN, y: y - 9, size: 9, font, color: gray }); y -= 14; }
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: indigo });
    y -= 20;
  }
  function sectionTitle(t: string) {
    ensureSpace(30); y -= 4;
    page.drawText(sanitize(t.toUpperCase()), { x: MARGIN, y: y - 11, size: 10.5, font: bold, color: indigo });
    y -= 17;
  }
  function infoRow(label: string) {
    ensureSpace(15);
    page.drawText(sanitize(label), { x: MARGIN, y: y - 10, size: 10, font, color: slate });
    y -= 15;
  }

  function renderNote(note: PtNoteLike) {
    page.drawText("PERSONAL INJURY PHYSICAL THERAPY NOTE", { x: MARGIN, y: y - 13, size: 13, font: bold, color: indigo });
    y -= 24;
    const pname = patient ? `${patient.lastName}, ${patient.firstName}` : "Unknown";
    infoRow(`Patient: ${pname}`);
    infoRow(`MRN: ${patient?.mrn || "-"}`);
    infoRow(`DOB: ${fmtDate(patient?.dob)}`);
    infoRow(`Date of visit: ${fmtDate(note.visitDate)}`);
    infoRow(`Date of injury: ${fmtDate(note.dateOfInjury)}`);
    y -= 8;
    const sections: Array<[string, string | null | undefined]> = [
      ["Mechanism of Injury", note.mechanism], ["Subjective", note.subjective], ["Objective", note.objective],
      ["Assessment", note.assessment], ["Plan", note.plan], ["Functional Goals", note.goals], ["Causation", note.causation],
    ];
    for (const [t, b] of sections) { if (!b || !String(b).trim()) continue; sectionTitle(t); drawText(String(b), 10, font); y -= 6; }
    sectionTitle("Billing Codes");
    drawText(`CPT: ${(note.cptCodes || []).join(", ") || "-"}`, 10, font);
    drawText(`ICD-10: ${(note.icdCodes || []).join(", ") || "-"}`, 10, font);
    y -= 12;
    ensureSpace(70);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: gray });
    y -= 18;
    if (note.status === "signed") {
      page.drawText("Electronically signed by:", { x: MARGIN, y: y - 10, size: 9, font, color: gray }); y -= 16;
      const sigName = `${note.authorName || note.signedByName || ""}${note.authorCredential ? `, ${note.authorCredential}` : ""}`;
      page.drawText(sanitize(sigName), { x: MARGIN, y: y - 12, size: 12, font: bold, color: slate }); y -= 18;
      page.drawText(sanitize(`NPI: ${note.authorNpi || "-"}    License: ${note.authorLicense || "-"}    Signed: ${fmtDate(note.signedAt)}`), { x: MARGIN, y: y - 10, size: 9.5, font, color: slate }); y -= 16;
    } else {
      page.drawText("DRAFT - not signed. This document is not a final clinical record.", { x: MARGIN, y: y - 11, size: 10, font: italic, color: rgb(0.7, 0.2, 0.2) }); y -= 16;
    }
  }

  function renderCoverAndIntake() {
    const pname = patient ? `${patient.lastName}, ${patient.firstName}` : "Unknown";
    page.drawText("PERSONAL INJURY RECORDS PACKET", { x: MARGIN, y: y - 15, size: 15, font: bold, color: indigo });
    y -= 28;
    infoRow(`Patient: ${pname}`);
    infoRow(`MRN: ${patient?.mrn || "-"}    DOB: ${fmtDate(patient?.dob)}`);
    const dates = notes.map((n) => new Date(n.visitDate as any)).filter((d) => !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
    infoRow(`Signed PT notes included: ${notes.length}${dates.length ? `  (${fmtDate(dates[0])} - ${fmtDate(dates[dates.length - 1])})` : ""}`);
    y -= 6;
    if (intake) {
      sectionTitle("Accident Summary");
      drawText(`Type: ${intake.accidentType || "-"}    Date: ${fmtDate(intake.accidentDate)}`, 10, font);
      if (intake.location) drawText(`Location: ${intake.location}`, 10, font);
      if (intake.role) drawText(`Patient role: ${intake.role}`, 10, font);
      if (intake.painLevel != null) drawText(`Reported pain: ${intake.painLevel}/10`, 10, font);
      if (Array.isArray(intake.bodyParts) && intake.bodyParts.length) drawText(`Injured areas: ${intake.bodyParts.join(", ")}`, 10, font);
      if (intake.description) { drawText("How it occurred:", 10, bold); drawText(String(intake.description), 10, font); }
      if (intake.priorInjuries) drawText(`Prior injuries: ${intake.priorInjuries}`, 10, font);
      sectionTitle("Insurance & Representation");
      drawText(`Auto insurer: ${intake.autoInsurer || "-"}    Policy #: ${intake.autoPolicy || "-"}`, 10, font);
      drawText(`Claim #: ${intake.claimNumber || "-"}    Adjuster: ${intake.adjuster || "-"}`, 10, font);
      drawText(`Attorney: ${intake.attorney || "-"}    Law firm: ${intake.lawFirm || "-"}`, 10, font);
    } else {
      sectionTitle("Accident Summary");
      drawText("No personal-injury intake is on file for this patient.", 10, italic, gray);
    }
  }

  // ---- Compose document ----
  letterhead();
  if (mode === "packet") {
    renderCoverAndIntake();
    for (const note of notes) { newPage(); letterhead(); renderNote(note); }
  } else {
    renderNote(notes[0]);
  }

  // Footer on every page.
  const pages = pdf.getPages();
  const gen = `Generated ${new Date().toLocaleString("en-US")}`;
  pages.forEach((p, i) => {
    p.drawText(sanitize(`${org} - PI PT ${mode === "packet" ? "Records Packet" : "Note"}`), { x: MARGIN, y: 28, size: 7.5, font, color: gray });
    p.drawText(sanitize(`${gen}   Page ${i + 1} of ${pages.length}`), { x: PAGE_W - MARGIN - 190, y: 28, size: 7.5, font, color: gray });
  });

  return pdf.save();
}
