import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function ascii(s: string) { return String(s || "").replace(/[^\x00-\x7F]/g, "-"); }

function wrap(text: string, max: number): string[] {
  const words = ascii(text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function buildConsentPdf(opts: {
  title: string;
  bodyText: string;
  company: string;
  employee: string;
  signerName: string;
  signerRole: string;
  signatureText: string;
  signedAt: Date;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const brand = rgb(0.12, 0.35, 0.7);
  const gray = rgb(0.4, 0.4, 0.4);
  let y = 750;
  const T = (t: string, x: number, size = 10, f = font, color = rgb(0.1, 0.1, 0.1)) => page.drawText(ascii(t), { x, y, size, font: f, color });

  T("ProactiveClinics", 40, 18, bold, brand);
  T("Enterprise Medical Services", 40, 10, font, gray); y -= 30;
  page.drawText(ascii(opts.title), { x: 40, y, size: 16, font: bold, color: rgb(0.1, 0.1, 0.1) }); y -= 8;
  page.drawLine({ start: { x: 40, y }, end: { x: 572, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) }); y -= 22;

  T(`Company: ${opts.company}`, 40, 10, bold); y -= 16;
  T(`Employee: ${opts.employee}`, 40, 10, bold); y -= 22;

  for (const line of wrap(opts.bodyText, 95)) {
    T(line, 40, 10); y -= 15;
    if (y < 160) { y = 750; pdf.addPage([612, 792]); }
  }
  y -= 20;
  page.drawLine({ start: { x: 40, y }, end: { x: 320, y }, thickness: 0.8, color: rgb(0.3, 0.3, 0.3) }); y -= 14;
  T(`Signature: ${opts.signatureText}`, 40, 12, bold, brand); y -= 16;
  T(`Signed by: ${opts.signerName} (${opts.signerRole})`, 40, 9, font, gray); y -= 13;
  T(`Date: ${opts.signedAt.toLocaleString()}`, 40, 9, font, gray); y -= 13;
  T("Electronically signed via the ProactiveClinics Enterprise Portal.", 40, 8, font, gray);
  return await pdf.save();
}
