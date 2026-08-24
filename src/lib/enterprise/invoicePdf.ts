import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const money = (c: number) => `$${((c || 0) / 100).toFixed(2)}`;
function ascii(s: string) { return String(s || "").replace(/[^\x00-\x7F]/g, "-"); }

export async function buildInvoicePdf(inv: any, acct: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const brand = rgb(0.12, 0.35, 0.7);
  const gray = rgb(0.4, 0.4, 0.4);
  let y = 750;
  const T = (t: string, x: number, size = 10, f = font, color = rgb(0.1, 0.1, 0.1)) => page.drawText(ascii(t), { x, y, size, font: f, color });

  T("ProactiveClinics", 40, 20, bold, brand);
  T("Enterprise Med Services", 40, 10, font, gray); y -= 16;
  T("8103 Bandera Rd, Suite 102, San Antonio, TX 78250", 40, 9, font, gray);
  page.drawText("INVOICE", { x: 470, y: 748, size: 22, font: bold, color: brand });
  y -= 30;
  page.drawLine({ start: { x: 40, y }, end: { x: 572, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) }); y -= 20;

  T("Bill to:", 40, 10, bold); T(`Invoice #: ${inv.number}`, 380, 10, bold);
  y -= 14;
  T(acct?.companyName || "", 40, 11, bold); T(`Issued: ${new Date(inv.issueDate).toLocaleDateString()}`, 380, 10);
  y -= 14;
  T(acct?.billingEmail || acct?.contactEmail || "", 40, 9, font, gray);
  T(`Due: ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "On receipt"}`, 380, 10);
  y -= 14;
  T(`Status: ${String(inv.status).toUpperCase()}`, 380, 10, bold, inv.status === "paid" ? rgb(0.1, 0.5, 0.2) : gray);
  y -= 24;

  // table header
  page.drawRectangle({ x: 40, y: y - 4, width: 532, height: 20, color: rgb(0.95, 0.96, 0.99) });
  T("Description", 46, 10, bold); T("Qty", 400, 10, bold); T("Unit", 450, 10, bold); T("Amount", 515, 10, bold);
  y -= 24;
  const items = Array.isArray(inv.lineItems) ? inv.lineItems : [];
  for (const li of items) {
    T(li.desc || "", 46, 10); T(String(li.qty ?? 1), 400, 10); T(money(li.unitCents), 450, 10); T(money(Math.round((li.qty || 0) * (li.unitCents || 0))), 515, 10);
    y -= 18;
    if (y < 120) { y = 750; pdf.addPage([612, 792]); }
  }
  y -= 6;
  page.drawLine({ start: { x: 360, y }, end: { x: 572, y }, thickness: 0.8, color: rgb(0.85, 0.85, 0.85) }); y -= 16;
  T("Subtotal", 430, 10); T(money(inv.subtotalCents), 515, 10); y -= 16;
  if (inv.taxCents) { T("Tax", 430, 10); T(money(inv.taxCents), 515, 10); y -= 16; }
  T("Total", 430, 12, bold); T(money(inv.totalCents), 515, 12, bold, brand); y -= 26;
  if (inv.notes) { T(`Notes: ${inv.notes}`, 40, 9, font, gray); }
  page.drawText("Thank you for partnering with ProactiveClinics Enterprise Med Services.", { x: 40, y: 50, size: 9, font, color: gray });
  return await pdf.save();
}
