// Branded patient Statement PDF (account activity + balance). Server-only.
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import fs from "fs";
import path from "path";
import { CLINIC } from "@/lib/intake/forms";

const C_BRAND = rgb(0.055, 0.278, 0.42);
const C_ACCENT = rgb(0.02, 0.55, 0.55);
const C_INK = rgb(0.13, 0.17, 0.22);
const C_MUTED = rgb(0.42, 0.47, 0.53);
const C_LINE = rgb(0.75, 0.8, 0.85);
const C_ZEBRA = rgb(0.96, 0.975, 0.99);

const PAGE_W = 612, PAGE_H = 792, MARGIN = 46;
const CW = PAGE_W - MARGIN * 2;
const money = (c: number) => `$${((c || 0) / 100).toFixed(2)}`;

let logoCache: Buffer | null | undefined;
function logoBytes(): Buffer | null {
  if (logoCache === undefined) {
    try { logoCache = fs.readFileSync(path.join(process.cwd(), "public", "pclinic-header.png")); } catch { logoCache = null; }
  }
  return logoCache;
}

export type StatementEntry = { date: string | Date; type: string; description: string; amountCents: number };
export type StatementData = {
  patientName: string; mrn?: string | null; insurer?: string | null;
  entries: StatementEntry[];
  totals: { charges: number; payments: number; adjustments: number; balanceCents: number };
};

export async function renderStatementPdf(data: StatementData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const text = (p: PDFPage, s: string, x: number, yy: number, size = 10, f: PDFFont = font, color = C_INK) => p.drawText(s ?? "", { x, y: yy, size, font: f, color });

  const lb = logoBytes();
  if (lb) { try { const img = await doc.embedPng(lb); const w = 150; const h = (img.height / img.width) * w; page.drawImage(img, { x: MARGIN, y: y - h + 6, width: w, height: h }); } catch { /* */ } }
  text(page, CLINIC.name, MARGIN + 160, y - 4, 15, bold, C_BRAND);
  text(page, `${CLINIC.addr1}, ${CLINIC.addr2}`, MARGIN + 160, y - 20, 8.5, font, C_MUTED);
  text(page, `${CLINIC.phone} · ${CLINIC.web}`, MARGIN + 160, y - 32, 8.5, font, C_MUTED);
  y -= 56;

  page.drawRectangle({ x: MARGIN, y: y - 22, width: CW, height: 24, color: C_BRAND });
  text(page, "PATIENT STATEMENT", MARGIN + 10, y - 16, 12, bold, rgb(1, 1, 1));
  text(page, new Date().toLocaleDateString(), MARGIN + CW - 90, y - 16, 10, bold, rgb(1, 1, 1));
  y -= 40;

  text(page, "Patient", MARGIN, y, 8, bold, C_MUTED); text(page, data.patientName, MARGIN, y - 12, 11, bold);
  text(page, "MRN", MARGIN + CW / 2, y, 8, bold, C_MUTED); text(page, data.mrn || "—", MARGIN + CW / 2, y - 12, 11);
  y -= 26;
  text(page, "Insurance", MARGIN, y, 8, bold, C_MUTED); text(page, data.insurer || "—", MARGIN, y - 12, 10);
  y -= 30;

  // Table header
  const cx = { date: MARGIN + 3, type: MARGIN + 90, desc: MARGIN + 175, amt: MARGIN + CW - 80 };
  page.drawRectangle({ x: MARGIN, y: y - 4, width: CW, height: 18, color: C_ACCENT });
  text(page, "Date", cx.date, y + 1, 8.5, bold, rgb(1, 1, 1));
  text(page, "Type", cx.type, y + 1, 8.5, bold, rgb(1, 1, 1));
  text(page, "Description", cx.desc, y + 1, 8.5, bold, rgb(1, 1, 1));
  text(page, "Amount", cx.amt, y + 1, 8.5, bold, rgb(1, 1, 1));
  y -= 20;

  data.entries.forEach((e, idx) => {
    if (y < 90) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; }
    if (idx % 2 === 1) page.drawRectangle({ x: MARGIN, y: y - 4, width: CW, height: 16, color: C_ZEBRA });
    const signed = e.type === "payment" ? `-${money(e.amountCents)}` : money(e.amountCents);
    text(page, new Date(e.date).toLocaleDateString(), cx.date, y, 9);
    text(page, e.type, cx.type, y, 9, font, e.type === "payment" ? C_ACCENT : C_INK);
    text(page, (e.description || "").slice(0, 58), cx.desc, y, 9);
    text(page, signed, cx.amt, y, 9, font, e.type === "payment" ? C_ACCENT : C_INK);
    y -= 16;
  });
  if (data.entries.length === 0) { text(page, "No account activity.", cx.date, y, 9, font, C_MUTED); y -= 16; }

  y -= 8;
  page.drawLine({ start: { x: MARGIN + CW - 240, y: y + 8 }, end: { x: MARGIN + CW, y: y + 8 }, thickness: 1, color: C_LINE });
  const row = (label: string, value: string, f: PDFFont = font, color = C_INK) => { text(page, label, MARGIN + CW - 240, y, 10, bold, C_MUTED); text(page, value, MARGIN + CW - 90, y, 11, f, color); y -= 16; };
  row("Total Charges", money(data.totals.charges));
  row("Payments", money(data.totals.payments), font, C_ACCENT);
  row("Adjustments", money(data.totals.adjustments));
  row("Balance Due", money(data.totals.balanceCents), bold, data.totals.balanceCents > 0 ? rgb(0.7, 0.1, 0.1) : C_INK);

  const footY = 54;
  page.drawLine({ start: { x: MARGIN, y: footY + 16 }, end: { x: PAGE_W - MARGIN, y: footY + 16 }, thickness: 0.7, color: C_LINE });
  text(page, `© ${new Date().getFullYear()} ${CLINIC.name}. Please remit the balance due or contact our billing office with questions. Protected health information — handle per HIPAA.`, MARGIN, footY, 7.5, font, C_MUTED);
  return doc.save();
}
