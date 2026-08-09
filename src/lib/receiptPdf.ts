// Branded copay/payment receipt PDF. Server-only.
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import fs from "fs";
import path from "path";
import { CLINIC } from "@/lib/intake/forms";

const C_BRAND = rgb(0.055, 0.278, 0.42);
const C_ACCENT = rgb(0.02, 0.55, 0.55);
const C_INK = rgb(0.13, 0.17, 0.22);
const C_MUTED = rgb(0.42, 0.47, 0.53);
const C_LINE = rgb(0.75, 0.8, 0.85);

const PAGE_W = 612, PAGE_H = 792, MARGIN = 46;
const CW = PAGE_W - MARGIN * 2;
const money = (c: number) => `$${((c || 0) / 100).toFixed(2)}`;

let logoCache: Buffer | null | undefined;
function logoBytes(): Buffer | null {
  if (logoCache === undefined) { try { logoCache = fs.readFileSync(path.join(process.cwd(), "public", "pclinic-header.png")); } catch { logoCache = null; } }
  return logoCache;
}

export type ReceiptData = {
  patientName: string; mrn?: string | null;
  amountCents: number; description: string; date: string | Date;
  balanceCents: number; receiptNo: string;
};

export async function renderReceiptPdf(d: ReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const text = (s: string, x: number, yy: number, size = 10, f: PDFFont = font, color = C_INK) => page.drawText(s ?? "", { x, y: yy, size, font: f, color });

  const lb = logoBytes();
  if (lb) { try { const img = await doc.embedPng(lb); const w = 150; const h = (img.height / img.width) * w; page.drawImage(img, { x: MARGIN, y: y - h + 6, width: w, height: h }); } catch { /* */ } }
  text(CLINIC.name, MARGIN + 160, y - 4, 15, bold, C_BRAND);
  text(`${CLINIC.addr1}, ${CLINIC.addr2}`, MARGIN + 160, y - 20, 8.5, font, C_MUTED);
  text(`${CLINIC.phone} · ${CLINIC.web}`, MARGIN + 160, y - 32, 8.5, font, C_MUTED);
  y -= 60;

  page.drawRectangle({ x: MARGIN, y: y - 22, width: CW, height: 24, color: C_ACCENT });
  text("PAYMENT RECEIPT", MARGIN + 10, y - 16, 12, bold, rgb(1, 1, 1));
  text(`No. ${d.receiptNo}`, MARGIN + CW - 150, y - 16, 10, bold, rgb(1, 1, 1));
  y -= 46;

  text("Received from", MARGIN, y, 8, bold, C_MUTED); text(d.patientName, MARGIN, y - 13, 12, bold);
  text("MRN", MARGIN + CW / 2, y, 8, bold, C_MUTED); text(d.mrn || "—", MARGIN + CW / 2, y - 13, 11);
  y -= 30;
  text("Date", MARGIN, y, 8, bold, C_MUTED); text(new Date(d.date).toLocaleString(), MARGIN, y - 13, 10);
  y -= 34;

  // Amount box
  page.drawRectangle({ x: MARGIN, y: y - 46, width: CW, height: 52, color: rgb(0.96, 0.99, 0.97), borderColor: C_LINE, borderWidth: 1 });
  text("Amount paid", MARGIN + 14, y - 14, 9, bold, C_MUTED);
  text(money(d.amountCents), MARGIN + 14, y - 36, 22, bold, C_ACCENT);
  text("For", MARGIN + CW / 2, y - 14, 9, bold, C_MUTED);
  text((d.description || "Copay").slice(0, 42), MARGIN + CW / 2, y - 32, 11, font, C_INK);
  y -= 66;

  text("Remaining account balance", MARGIN, y, 9, bold, C_MUTED);
  text(money(d.balanceCents), MARGIN + 180, y, 12, bold, d.balanceCents > 0 ? rgb(0.7, 0.1, 0.1) : C_INK);
  y -= 40;

  text("Thank you for your payment.", MARGIN, y, 10, font, C_INK);

  const footY = 54;
  page.drawLine({ start: { x: MARGIN, y: footY + 14 }, end: { x: PAGE_W - MARGIN, y: footY + 14 }, thickness: 0.7, color: C_LINE });
  text(`© ${new Date().getFullYear()} ${CLINIC.name}. This receipt confirms a payment received; it is not an itemized statement. Keep for your records.`, MARGIN, footY, 7.5, font, C_MUTED);
  return doc.save();
}
