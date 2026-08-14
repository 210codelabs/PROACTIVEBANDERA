// -------------------------------------------------------------------------
// Branded "EHR Platform Comparison" PDF for Proactive Clinic.
// Server-only. Uses pdf-lib + clinic branding. Marketing/sales collateral.
// Competitor positioning reflects general, publicly known information and can
// vary by plan/version.
// -------------------------------------------------------------------------

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import fs from "fs";
import path from "path";
import { CLINIC } from "@/lib/intake/forms";

const C_BRAND = rgb(0.055, 0.278, 0.42);
const C_ACCENT = rgb(0.02, 0.55, 0.55);
const C_INK = rgb(0.13, 0.17, 0.22);
const C_MUTED = rgb(0.42, 0.47, 0.53);
const C_LINE = rgb(0.78, 0.82, 0.87);
const C_ZEBRA = rgb(0.965, 0.977, 0.99);
const C_OURCOL = rgb(0.9, 0.97, 0.96);
const C_GREEN = rgb(0.09, 0.6, 0.35);
const C_AMBER = rgb(0.85, 0.6, 0.05);
const C_RED = rgb(0.78, 0.22, 0.22);
const C_WHITE = rgb(1, 1, 1);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;
const CW = PAGE_W - MARGIN * 2;

let logoCache: Buffer | null | undefined;
function logoBytes(): Buffer | null {
  if (logoCache === undefined) {
    try { logoCache = fs.readFileSync(path.join(process.cwd(), "public", "pclinic-header.png")); }
    catch { logoCache = null; }
  }
  return logoCache;
}

type Rate = "full" | "partial" | "none";
type Cell = Rate | { t: string; r?: Rate }; // rating dot, or short text (optionally with a rating tint)
type Row = { feature: string; p: Cell; pf: Cell; ecw: Cell };

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: "Revenue Cycle & Billing",
    rows: [
      { feature: "Eligibility (270/271), real-time", p: "full", pf: "partial", ecw: "full" },
      { feature: "Claims (837P) native submission", p: "full", pf: { t: "Add-on", r: "partial" }, ecw: "full" },
      { feature: "Claim status (276/277) with history timeline", p: "full", pf: "partial", ecw: "full" },
      { feature: "Prior-auth tracker + eligibility auth detection", p: "full", pf: "none", ecw: "partial" },
      { feature: "ERA/835 real-time webhook auto-posting", p: "full", pf: "partial", ecw: "full" },
      { feature: "Payer enrollment automation + lifecycle", p: "full", pf: "none", ecw: "partial" },
      { feature: "Denials worklist (correct & resubmit)", p: "full", pf: "none", ecw: "full" },
      { feature: "Bank/EFT verification + deposit reconciliation", p: "full", pf: "none", ecw: "partial" },
    ],
  },
  {
    title: "Interoperability & Data Ownership",
    rows: [
      { feature: "SMART on FHIR + Bulk $export (system access)", p: "full", pf: "partial", ecw: "full" },
      { feature: "Self-service import (CSV / C-CDA / FHIR bundle)", p: "full", pf: "partial", ecw: "partial" },
      { feature: "Open data export — no lock-in", p: "full", pf: "partial", ecw: "none" },
      { feature: "NPI / provider lookup (NPPES)", p: "full", pf: "partial", ecw: "partial" },
    ],
  },
  {
    title: "Clinical & Front Office",
    rows: [
      { feature: "AI charting / coding assist (built-in)", p: "full", pf: "none", ecw: { t: "Add-on", r: "partial" } },
      { feature: "Patient portal + online booking + intake", p: "full", pf: "full", ecw: "full" },
      { feature: "Kiosk self check-in", p: "full", pf: "none", ecw: { t: "Add-on", r: "partial" } },
      { feature: "Attorney / Personal-Injury portal & lien workflow", p: "full", pf: "none", ecw: "none" },
      { feature: "Pharmacy + Point of Sale + Inventory", p: "full", pf: "none", ecw: "partial" },
      { feature: "Multilingual UI (EN / ES)", p: "full", pf: "partial", ecw: "partial" },
      { feature: "Installable PWA + offline shell", p: "full", pf: "none", ecw: "none" },
    ],
  },
  {
    title: "Platform & Commercials",
    rows: [
      { feature: "All-in-one platform (no module patchwork)", p: "full", pf: "partial", ecw: "partial" },
      { feature: "Deploy your way (cloud or self-host, own domain)", p: "full", pf: "none", ecw: "partial" },
      { feature: "Ad-free experience", p: "full", pf: "partial", ecw: "full" },
      { feature: "Transparent, simple pricing", p: "full", pf: "partial", ecw: "none" },
    ],
  },
];

const ADVANTAGES = [
  "End-to-end, native revenue cycle: eligibility -> prior-auth detection -> 837P -> 276/277 history -> real-time 835 auto-posting -> denials -> deposit reconciliation.",
  "Money lands where it should: verified deposit accounts, ERA-to-account mapping, and automatic flagging of payers paying into an unlinked account.",
  "No lock-in: self-service import AND open FHIR / Bulk export both ways.",
  "Built for niches the big EHRs ignore: dedicated attorney / Personal-Injury portal and lien workflows.",
  "One platform for the whole front-of-house: charting + pharmacy + POS + inventory + kiosk + booking + portals.",
  "Modern by default: built-in AI assist, bilingual UI, installable PWA, clean self-service admin, zero in-product ads.",
];

export async function renderComparisonPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Column geometry
  const featW = 236;
  const colW = (CW - featW) / 3;
  const cx = [MARGIN + featW, MARGIN + featW + colW, MARGIN + featW + colW * 2];
  const headers = ["Proactive Clinic", "Practice Fusion", "eClinicalWorks"];

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const text = (p: PDFPage, s: string, x: number, yy: number, size = 10, f: PDFFont = font, color = C_INK) =>
    p.drawText(s ?? "", { x, y: yy, size, font: f, color });

  const centered = (p: PDFPage, s: string, cxx: number, w: number, yy: number, size: number, f: PDFFont, color: any) => {
    const tw = f.widthOfTextAtSize(s, size);
    p.drawText(s, { x: cxx + (w - tw) / 2, y: yy, size, font: f, color });
  };

  async function drawBrandHeader(p: PDFPage) {
    let hy = PAGE_H - MARGIN;
    const lb = logoBytes();
    if (lb) {
      try { const img = await doc.embedPng(lb); const w = 138; const h = (img.height / img.width) * w; p.drawImage(img, { x: MARGIN, y: hy - h + 6, width: w, height: h }); } catch { /* ignore */ }
    }
    text(p, CLINIC.name, MARGIN + 150, hy - 4, 15, bold, C_BRAND);
    text(p, CLINIC.slogan, MARGIN + 150, hy - 19, 9, font, C_ACCENT);
    text(p, `${CLINIC.phone}  |  ${CLINIC.web}`, MARGIN + 150, hy - 31, 8.5, font, C_MUTED);
    return hy - 48;
  }

  function drawTableHead(p: PDFPage, yy: number) {
    // header band
    p.drawRectangle({ x: MARGIN, y: yy - 20, width: CW, height: 22, color: C_BRAND });
    // highlight our column
    p.drawRectangle({ x: cx[0], y: yy - 20, width: colW, height: 22, color: C_ACCENT });
    text(p, "Feature", MARGIN + 8, yy - 14, 9.5, bold, C_WHITE);
    headers.forEach((h, i) => centered(p, h, cx[i], colW, yy - 14, i === 0 ? 9.5 : 8.8, bold, C_WHITE));
    return yy - 20;
  }

  function ratingCell(p: PDFPage, cell: Cell, colX: number, yy: number) {
    let rate: Rate | undefined;
    let label: string | null = null;
    if (typeof cell === "string") rate = cell;
    else { label = cell.t; rate = cell.r; }
    const dotColor = rate === "full" ? C_GREEN : rate === "partial" ? C_AMBER : rate === "none" ? C_RED : C_MUTED;
    const word = label || (rate === "full" ? "Yes" : rate === "partial" ? "Partial" : rate === "none" ? "No" : "-");
    const size = 8.6;
    const dotR = 3;
    const wordW = font.widthOfTextAtSize(word, size);
    const groupW = dotR * 2 + 5 + wordW;
    const startX = colX + (colW - groupW) / 2;
    p.drawCircle({ x: startX + dotR, y: yy + 3, size: dotR, color: dotColor });
    text(p, word, startX + dotR * 2 + 5, yy, size, rate === "none" ? font : bold, rate === "full" ? C_GREEN : C_INK);
  }

  // ---- Page 1 header + title ----
  y = await drawBrandHeader(page);
  page.drawRectangle({ x: MARGIN, y: y - 26, width: CW, height: 28, color: C_BRAND });
  text(page, "EHR PLATFORM COMPARISON", MARGIN + 10, y - 18, 14, bold, C_WHITE);
  y -= 40;
  text(page, "How Proactive Clinic compares to Practice Fusion and eClinicalWorks", MARGIN, y, 10.5, bold, C_INK);
  y -= 13;
  text(page, "An all-in-one, revenue-cycle-first EHR that unifies charting, billing, retail, engagement and open migration.", MARGIN, y, 8.5, font, C_MUTED);
  y -= 18;

  y = drawTableHead(page, y);
  y -= 4;

  const bottomLimit = 90;
  let zebra = 0;
  for (const section of SECTIONS) {
    // section title row
    if (y < bottomLimit + 40) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = await drawBrandHeader(page);
      y = drawTableHead(page, y) - 4;
      zebra = 0;
    }
    page.drawRectangle({ x: MARGIN, y: y - 15, width: CW, height: 17, color: rgb(0.9, 0.93, 0.96) });
    text(page, section.title.toUpperCase(), MARGIN + 8, y - 11, 8.5, bold, C_BRAND);
    y -= 21;

    for (const row of section.rows) {
      if (y < bottomLimit) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = await drawBrandHeader(page);
        y = drawTableHead(page, y) - 4;
        zebra = 0;
      }
      const rowH = 17;
      if (zebra % 2 === 1) page.drawRectangle({ x: MARGIN, y: y - 4, width: CW, height: rowH, color: C_ZEBRA });
      // subtle highlight on our column
      page.drawRectangle({ x: cx[0], y: y - 4, width: colW, height: rowH, color: C_OURCOL, opacity: 0.5 });
      // feature text (truncate if too long)
      let ft = row.feature;
      while (font.widthOfTextAtSize(ft, 8.6) > featW - 12 && ft.length > 4) ft = ft.slice(0, -2);
      if (ft !== row.feature) ft = ft.trimEnd();
      text(page, ft, MARGIN + 6, y, 8.6, font, C_INK);
      ratingCell(page, row.p, cx[0], y);
      ratingCell(page, row.pf, cx[1], y);
      ratingCell(page, row.ecw, cx[2], y);
      y -= rowH;
      zebra++;
    }
  }

  // ---- Advantages page ----
  page = doc.addPage([PAGE_W, PAGE_H]);
  y = await drawBrandHeader(page);
  page.drawRectangle({ x: MARGIN, y: y - 26, width: CW, height: 28, color: C_ACCENT });
  text(page, "WHY PROACTIVE CLINIC WINS", MARGIN + 10, y - 18, 14, bold, C_WHITE);
  y -= 44;
  for (const a of ADVANTAGES) {
    page.drawCircle({ x: MARGIN + 5, y: y + 3, size: 3, color: C_GREEN });
    const words = a.split(" ");
    let lineStr = "";
    const maxW = CW - 22;
    const lines: string[] = [];
    for (const w of words) {
      const test = lineStr ? `${lineStr} ${w}` : w;
      if (font.widthOfTextAtSize(test, 10) > maxW) { lines.push(lineStr); lineStr = w; }
      else lineStr = test;
    }
    if (lineStr) lines.push(lineStr);
    lines.forEach((ln, i) => text(page, ln, MARGIN + 16, y - i * 13, 10, i === 0 ? bold : font, C_INK));
    y -= lines.length * 13 + 10;
  }

  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.7, color: C_LINE });
  y -= 16;
  text(page, "Legend:", MARGIN, y, 8.5, bold, C_MUTED);
  page.drawCircle({ x: MARGIN + 48, y: y + 3, size: 3, color: C_GREEN }); text(page, "Full / native", MARGIN + 56, y, 8.5, font, C_INK);
  page.drawCircle({ x: MARGIN + 150, y: y + 3, size: 3, color: C_AMBER }); text(page, "Partial / add-on", MARGIN + 158, y, 8.5, font, C_INK);
  page.drawCircle({ x: MARGIN + 270, y: y + 3, size: 3, color: C_RED }); text(page, "Not available", MARGIN + 278, y, 8.5, font, C_INK);

  // Footer on every page
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: 60 }, end: { x: PAGE_W - MARGIN, y: 60 }, thickness: 0.6, color: C_LINE });
    text(p, `(c) ${new Date().getFullYear()} ${CLINIC.name}  |  ${CLINIC.web}  |  ${CLINIC.phone}`, MARGIN, 48, 7.5, font, C_MUTED);
    text(p, "Comparison reflects general, publicly available positioning of the named products and may vary by plan/version.", MARGIN, 38, 7, font, C_MUTED);
    centered(p, `Page ${i + 1} of ${pages.length}`, PAGE_W - MARGIN - 90, 90, 48, 7.5, font, C_MUTED);
  });

  return doc.save();
}
