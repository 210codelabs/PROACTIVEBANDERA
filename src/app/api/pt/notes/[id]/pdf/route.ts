import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { readAdminConfig } from "@/lib/admin/store";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Make text safe for pdf-lib's standard (WinAnsi/Latin-1) fonts.
function sanitize(s: string): string {
  return String(s || "")
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2022\u25CF]/g, "-")
    .replace(/[^\x00-\xFF]/g, "?");
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const note = await db.ptNote.findUnique({ where: { id } });
  if (!note) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  const patient = await db.patient.findUnique({ where: { id: note.patientId } });
  const author = await db.user.findUnique({ where: { id: note.authorId } }).catch(() => null);
  const cfg = await readAdminConfig().catch(() => null);
  const org = cfg?.org?.orgName || cfg?.branding?.appName || "Proactive Clinic Health";
  const legal = cfg?.org?.legalName || "";
  const website = cfg?.org?.website || "";

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_W = 612, PAGE_H = 792, MARGIN = 50;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const slate = rgb(0.13, 0.16, 0.22);
  const gray = rgb(0.42, 0.45, 0.5);
  const indigo = rgb(0.31, 0.27, 0.9);

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN + 40) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  function wrap(text: string, size: number, f: PDFFont, maxW: number): string[] {
    const words = sanitize(text).replace(/\r/g, "").split(/\n/);
    const lines: string[] = [];
    for (const para of words) {
      if (para.trim() === "") { lines.push(""); continue; }
      let line = "";
      for (const word of para.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(test, size) > maxW && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  function drawText(text: string, size: number, f: PDFFont, color = slate, x = MARGIN) {
    const lines = wrap(text, size, f, CONTENT_W - (x - MARGIN));
    for (const ln of lines) {
      ensureSpace(size + 4);
      page.drawText(ln, { x, y: y - size, size, font: f, color });
      y -= size + 4;
    }
  }

  // ---- Letterhead (logo optional) ----
  let logoW = 0;
  try {
    const logoRel = (cfg?.branding?.logoUrl as string) || "/pclinic-light.png";
    const logoPath = path.join(process.cwd(), "public", logoRel.replace(/^\//, ""));
    const bytes = await fs.readFile(logoPath);
    // Skip embedding oversized logos so generated PDFs stay small enough to email.
    if (bytes.length <= 250 * 1024) {
      const img = logoRel.toLowerCase().endsWith(".jpg") || logoRel.toLowerCase().endsWith(".jpeg")
        ? await pdf.embedJpg(bytes)
        : await pdf.embedPng(bytes);
      const dims = img.scale(1);
      const targetH = 40;
      const scale = targetH / dims.height;
      logoW = dims.width * scale;
      page.drawImage(img, { x: PAGE_W - MARGIN - logoW, y: y - targetH, width: logoW, height: targetH });
    }
  } catch { /* no logo -> text-only letterhead */ }

  page.drawText(sanitize(org), { x: MARGIN, y: y - 16, size: 16, font: bold, color: slate });
  y -= 22;
  if (legal) { page.drawText(sanitize(legal), { x: MARGIN, y: y - 10, size: 9, font, color: gray }); y -= 14; }
  if (website) { page.drawText(sanitize(website), { x: MARGIN, y: y - 9, size: 9, font, color: gray }); y -= 14; }
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: indigo });
  y -= 20;

  page.drawText("PERSONAL INJURY PHYSICAL THERAPY NOTE", { x: MARGIN, y: y - 13, size: 13, font: bold, color: indigo });
  y -= 24;

  // ---- Patient / visit info box ----
  const pname = patient ? `${patient.lastName}, ${patient.firstName}` : "Unknown";
  const info = [
    `Patient: ${pname}`,
    `MRN: ${patient?.mrn || "-"}`,
    `DOB: ${fmtDate(patient?.dob)}`,
    `Date of visit: ${fmtDate(note.visitDate)}`,
    `Date of injury: ${fmtDate(note.dateOfInjury)}`,
  ];
  for (const row of info) {
    ensureSpace(14);
    page.drawText(sanitize(row), { x: MARGIN, y: y - 10, size: 10, font, color: slate });
    y -= 15;
  }
  y -= 8;

  // ---- Sections ----
  const sections: Array<[string, string | null]> = [
    ["Mechanism of Injury", note.mechanism],
    ["Subjective", note.subjective],
    ["Objective", note.objective],
    ["Assessment", note.assessment],
    ["Plan", note.plan],
    ["Functional Goals", note.goals],
    ["Causation", note.causation],
  ];
  for (const [title, bodyText] of sections) {
    if (!bodyText || !bodyText.trim()) continue;
    ensureSpace(30);
    y -= 4;
    page.drawText(sanitize(title.toUpperCase()), { x: MARGIN, y: y - 11, size: 10.5, font: bold, color: indigo });
    y -= 17;
    drawText(bodyText, 10, font);
    y -= 6;
  }

  // ---- Codes ----
  ensureSpace(40);
  y -= 2;
  page.drawText("BILLING CODES", { x: MARGIN, y: y - 11, size: 10.5, font: bold, color: indigo });
  y -= 17;
  drawText(`CPT: ${(note.cptCodes || []).join(", ") || "-"}`, 10, font);
  drawText(`ICD-10: ${(note.icdCodes || []).join(", ") || "-"}`, 10, font);
  y -= 12;

  // ---- Signature block ----
  ensureSpace(80);
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: gray });
  y -= 18;
  if (note.status === "signed") {
    page.drawText("Electronically signed by:", { x: MARGIN, y: y - 10, size: 9, font, color: gray });
    y -= 16;
    const sigName = `${note.authorName || note.signedByName || ""}${note.authorCredential ? `, ${note.authorCredential}` : ""}`;
    page.drawText(sanitize(sigName), { x: MARGIN, y: y - 12, size: 12, font: bold, color: slate });
    y -= 18;
    const npi = note.authorNpi || author?.npi || "-";
    const lic = note.authorLicense || (author as any)?.licenseNo || "-";
    page.drawText(sanitize(`NPI: ${npi}    License: ${lic}    Signed: ${fmtDate(note.signedAt)}`), { x: MARGIN, y: y - 10, size: 9.5, font, color: slate });
    y -= 16;
  } else {
    page.drawText("DRAFT - not signed. This document is not a final clinical record.", { x: MARGIN, y: y - 11, size: 10, font: italic, color: rgb(0.7, 0.2, 0.2) });
    y -= 16;
  }

  // ---- Footer on every page ----
  const pages = pdf.getPages();
  const gen = `Generated ${new Date().toLocaleString("en-US")}`;
  pages.forEach((p, i) => {
    p.drawText(sanitize(`${org} - PI PT Note`), { x: MARGIN, y: 28, size: 7.5, font, color: gray });
    p.drawText(sanitize(`${gen}   Page ${i + 1} of ${pages.length}`), { x: PAGE_W - MARGIN - 190, y: 28, size: 7.5, font, color: gray });
  });

  const bytes = await pdf.save();
  const safeName = sanitize(pname).replace(/[^a-zA-Z0-9]+/g, "_");
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="PI_PT_Note_${safeName}_${fmtDate(note.visitDate).replace(/[^a-zA-Z0-9]+/g, "")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
