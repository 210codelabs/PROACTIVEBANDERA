import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStediConfig } from "@/lib/stedi";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

const ascii = (s: string) => String(s || "").replace(/[^\x20-\x7E]/g, " ");

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSession(); } catch { return new Response("Unauthorized", { status: 401 }); }
  const { id } = await params;
  const rx = await db.prescription.findUnique({ where: { id } }).catch(() => null);
  if (!rx) return new Response("Not found", { status: 404 });

  const cfg = await getStediConfig().catch(() => null as any);
  const clinicName = (cfg?.orgName || "Proactive Clinic").trim();
  const clinicNpi = cfg?.billingNpi || "";
  const addr = cfg?.address || {};
  const clinicAddr = [addr.streetAddress1, [addr.city, addr.state].filter(Boolean).join(", "), addr.zipCode].filter(Boolean).join(" · ");
  const clinicPhone = cfg?.enrollmentContact?.phone || "";

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // US Letter
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ital = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const navy = rgb(0.04, 0.15, 0.25);
  const gray = rgb(0.4, 0.45, 0.5);
  const line = (x1: number, y1: number, x2: number, y2: number, c = rgb(0.85, 0.87, 0.9)) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1, color: c });
  let y = 750;
  const T = (t: string, x: number, size: number, f = font, color = rgb(0.1, 0.12, 0.15)) => page.drawText(ascii(t), { x, y, size, font: f, color });

  // Letterhead
  page.drawRectangle({ x: 0, y: 762, width: 612, height: 30, color: navy });
  page.drawText(ascii(clinicName), { x: 40, y: 770, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText("PRESCRIPTION", { x: 470, y: 770, size: 12, font: bold, color: rgb(0.8, 0.9, 0.95) });
  y = 744;
  T(clinicAddr || " ", 40, 9, font, gray); y -= 12;
  T([clinicNpi ? `Practice NPI: ${clinicNpi}` : "", clinicPhone ? `Tel: ${clinicPhone}` : ""].filter(Boolean).join("   "), 40, 9, font, gray);
  y -= 10; line(40, y, 572, y); y -= 22;

  // Patient
  T("PATIENT", 40, 9, bold, gray); y -= 14;
  T(rx.patientName, 40, 12, bold); y -= 14;
  if (rx.patientDob) { T(`DOB: ${rx.patientDob}`, 40, 10, font, gray); y -= 12; }
  if (rx.patientAddress) { T(rx.patientAddress, 40, 10, font, gray); y -= 12; }
  T(`Date: ${new Date(rx.createdAt).toLocaleDateString()}`, 460, 12, font); y -= 16;
  line(40, y, 572, y); y -= 26;

  // Rx symbol + medication
  page.drawText("Rx", { x: 40, y: y - 4, size: 26, font: bold, color: navy });
  const medLine = [rx.medName, rx.strength].filter(Boolean).join(" ");
  T(medLine, 82, 15, bold); y -= 20;
  if ((rx as any).deaSchedule) {
    page.drawText(ascii(`CONTROLLED SUBSTANCE - ${(rx as any).deaSchedule}`), { x: 82, y: y + 2, size: 9, font: bold, color: rgb(0.7, 0.1, 0.1) });
    y -= 14;
  }
  T([rx.form ? `Form: ${rx.form}` : "", rx.ndc ? `NDC: ${rx.ndc}` : ""].filter(Boolean).join("    "), 82, 10, font, gray); y -= 22;
  T(`Sig: ${rx.sig || "—"}`, 82, 12, font); y -= 18;
  T(`Quantity: ${rx.quantity || "—"}      Refills: ${rx.refills}      ${rx.daw ? "Dispense As Written (DAW)" : "Substitution permitted"}`, 82, 11, font); y -= 18;
  if (rx.notes) { T(`Notes: ${rx.notes}`, 82, 10, font, gray); y -= 16; }
  y -= 8; line(40, y, 572, y); y -= 22;

  // Pharmacy
  if (rx.pharmacyName) {
    T("PHARMACY", 40, 9, bold, gray); y -= 14;
    T(rx.pharmacyName, 40, 11, bold); y -= 13;
    const pline = [rx.pharmacyAddress, rx.pharmacyPhone ? `Tel: ${rx.pharmacyPhone}` : "", rx.pharmacyNpi ? `NPI: ${rx.pharmacyNpi}` : ""].filter(Boolean).join("  ·  ");
    if (pline) { T(pline, 40, 9, font, gray); y -= 16; }
    line(40, y, 572, y); y -= 22;
  }

  // Signature block
  const sigY = 150;
  line(330, sigY, 560, sigY);
  page.drawText("Prescriber signature", { x: 330, y: sigY - 12, size: 8, font, color: gray });
  if (rx.signatureType === "drawn" && rx.signatureData && rx.signatureData.startsWith("data:image")) {
    try {
      const b64 = rx.signatureData.split(",")[1];
      const bytes = Buffer.from(b64, "base64");
      const png = await pdf.embedPng(bytes);
      const w = 180; const h = (png.height / png.width) * w;
      page.drawImage(png, { x: 340, y: sigY + 4, width: w, height: Math.min(h, 46) });
    } catch { /* ignore */ }
  } else if (rx.signatureData) {
    page.drawText(ascii(rx.signatureData), { x: 345, y: sigY + 10, size: 20, font: ital, color: navy });
  }
  page.drawText(ascii(rx.providerName), { x: 40, y: sigY + 10, size: 12, font: bold });
  if (rx.providerNpi) page.drawText(ascii(`Provider NPI: ${rx.providerNpi}`), { x: 40, y: sigY - 4, size: 10, font, color: gray });
  if (rx.providerDea) page.drawText(ascii(`DEA: ${rx.providerDea}`), { x: 200, y: sigY - 4, size: 10, font, color: gray });
  page.drawText(ascii(`Electronically signed · ${new Date(rx.createdAt).toLocaleString()}`), { x: 40, y: sigY - 18, size: 8, font, color: gray });

  page.drawText("This prescription was generated electronically by " + ascii(clinicName) + ".", { x: 40, y: 40, size: 8, font, color: gray });

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="prescription-${id}.pdf"` } });
}
