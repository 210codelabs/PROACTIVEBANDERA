// -------------------------------------------------------------------------
// Branded Superbill (CMS-1500-style) PDF generator for Proactive Clinic.
// Server-only. Uses pdf-lib + the clinic logo/branding.
// NOTE: This is a patient/office superbill for record-keeping — it is not a
// certified CMS-1500 form and is not proof of insurance payment.
// -------------------------------------------------------------------------

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

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 46;
const CW = PAGE_W - MARGIN * 2;

let logoCache: Buffer | null | undefined;
function logoBytes(): Buffer | null {
  if (logoCache === undefined) {
    try { logoCache = fs.readFileSync(path.join(process.cwd(), "public", "pclinic-header.png")); }
    catch { logoCache = null; }
  }
  return logoCache;
}

const money = (c: number) => `$${((c || 0) / 100).toFixed(2)}`;

export type SuperbillClaim = {
  patientControlNumber: string;
  patientName?: string | null;
  payerId: string;
  payerName?: string | null;
  status: string;
  totalChargeCents: number;
  paidCents: number;
  diagnoses?: { qualifier?: string; code: string }[] | null;
  serviceLines?: { serviceDate?: string | Date; procedureCode: string; chargeCents: number; units?: number; modifier?: string; diagnosisCodePointers?: string[] }[] | null;
  createdAt?: string | Date;
  createdByName?: string | null;
};

export type SuperbillProvider = { orgName: string; billingNpi: string; taxId: string; address?: { streetAddress1?: string; city?: string; state?: string; zipCode?: string } };
export type SuperbillPatient = { dob?: string | Date | null; memberId?: string | null; insurerName?: string | null; phone?: string | null };

export async function renderSuperbillPdf(claim: SuperbillClaim, provider: SuperbillProvider, patient?: SuperbillPatient): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const text = (p: PDFPage, s: string, x: number, yy: number, size = 10, f: PDFFont = font, color = C_INK) =>
    p.drawText(s ?? "", { x, y: yy, size, font: f, color });

  // Header
  const lb = logoBytes();
  if (lb) {
    try { const img = await doc.embedPng(lb); const w = 150; const h = (img.height / img.width) * w; page.drawImage(img, { x: MARGIN, y: y - h + 6, width: w, height: h }); } catch { /* ignore */ }
  }
  text(page, CLINIC.name, MARGIN + 160, y - 4, 15, bold, C_BRAND);
  text(page, CLINIC.slogan, MARGIN + 160, y - 20, 9, font, C_ACCENT);
  text(page, `${CLINIC.addr1}, ${CLINIC.addr2}`, MARGIN + 160, y - 33, 8.5, font, C_MUTED);
  text(page, `${CLINIC.phone} · ${CLINIC.web}`, MARGIN + 160, y - 44, 8.5, font, C_MUTED);
  y -= 60;

  // Title band
  page.drawRectangle({ x: MARGIN, y: y - 22, width: CW, height: 24, color: C_BRAND });
  text(page, "SUPERBILL / STATEMENT OF SERVICES", MARGIN + 10, y - 16, 12, bold, rgb(1, 1, 1));
  text(page, `Claim ${claim.patientControlNumber}`, MARGIN + CW - 170, y - 16, 10, bold, rgb(1, 1, 1));
  y -= 40;

  // Two-column info
  const col2 = MARGIN + CW / 2 + 8;
  const line = (label: string, value: string, x: number, yy: number) => {
    text(page, label, x, yy, 8, bold, C_MUTED);
    text(page, value || "—", x, yy - 12, 10, font, C_INK);
  };
  const dob = patient?.dob ? new Date(patient.dob).toLocaleDateString() : "—";
  const dos = claim.createdAt ? new Date(claim.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
  line("Patient", claim.patientName || "—", MARGIN, y);
  line("Date of Birth", dob, col2, y);
  y -= 30;
  line("Insurance / Payer", claim.payerName || claim.payerId || "—", MARGIN, y);
  line("Member ID", patient?.memberId || "—", col2, y);
  y -= 30;
  line("Billing Provider", provider.orgName, MARGIN, y);
  line("Billing NPI / Tax ID", `${provider.billingNpi || "—"} / ${provider.taxId ? `••••${provider.taxId.slice(-4)}` : "—"}`, col2, y);
  y -= 30;
  line("Statement Date", dos, MARGIN, y);
  line("Status", claim.status.toUpperCase(), col2, y);
  y -= 34;

  // Diagnoses
  const dxs = claim.diagnoses || [];
  text(page, "Diagnoses (ICD-10)", MARGIN, y, 9, bold, C_BRAND);
  y -= 14;
  const dxStr = dxs.length ? dxs.map((d, i) => `${i + 1}. ${d.code}`).join("    ") : "—";
  text(page, dxStr, MARGIN, y, 10, font, C_INK);
  y -= 24;

  // Service lines table
  const cols = [
    { k: "date", label: "Date", x: MARGIN, w: 70 },
    { k: "cpt", label: "CPT/HCPCS", x: MARGIN + 74, w: 80 },
    { k: "mod", label: "Mod", x: MARGIN + 158, w: 40 },
    { k: "dx", label: "Dx", x: MARGIN + 200, w: 40 },
    { k: "units", label: "Units", x: MARGIN + 244, w: 50 },
    { k: "charge", label: "Charge", x: MARGIN + CW - 80, w: 80 },
  ];
  page.drawRectangle({ x: MARGIN, y: y - 4, width: CW, height: 18, color: C_ACCENT });
  cols.forEach((c) => text(page, c.label, c.x + 3, y + 1, 8.5, bold, rgb(1, 1, 1)));
  y -= 20;

  const lines = claim.serviceLines || [];
  lines.forEach((l, idx) => {
    if (idx % 2 === 1) page.drawRectangle({ x: MARGIN, y: y - 4, width: CW, height: 16, color: C_ZEBRA });
    const lineCharge = (l.chargeCents || 0) * (l.units || 1);
    text(page, l.serviceDate ? new Date(l.serviceDate).toLocaleDateString() : "—", MARGIN + 3, y, 9);
    text(page, l.procedureCode || "—", MARGIN + 77, y, 9);
    text(page, l.modifier || "—", MARGIN + 161, y, 9);
    text(page, (l.diagnosisCodePointers || ["1"]).join(","), MARGIN + 203, y, 9);
    text(page, String(l.units || 1), MARGIN + 247, y, 9);
    text(page, money(lineCharge), MARGIN + CW - 77, y, 9);
    y -= 16;
  });
  if (lines.length === 0) { text(page, "No service lines.", MARGIN + 3, y, 9, font, C_MUTED); y -= 16; }

  // Totals
  y -= 6;
  page.drawLine({ start: { x: MARGIN + CW - 220, y: y + 8 }, end: { x: MARGIN + CW, y: y + 8 }, thickness: 1, color: C_LINE });
  const tRow = (label: string, value: string, f: PDFFont = font, color = C_INK) => {
    text(page, label, MARGIN + CW - 220, y, 10, bold, C_MUTED);
    text(page, value, MARGIN + CW - 90, y, 11, f, color);
    y -= 16;
  };
  tRow("Total Charges", money(claim.totalChargeCents));
  tRow("Insurance Paid", money(claim.paidCents), font, C_ACCENT);
  const balance = (claim.totalChargeCents || 0) - (claim.paidCents || 0);
  tRow("Patient Balance", money(balance), bold, balance > 0 ? rgb(0.7, 0.1, 0.1) : C_INK);

  // Footer
  const footY = 54;
  page.drawLine({ start: { x: MARGIN, y: footY + 22 }, end: { x: PAGE_W - MARGIN, y: footY + 22 }, thickness: 0.7, color: C_LINE });
  text(page, `© ${new Date().getFullYear()} ${CLINIC.name}. This superbill is provided for informational and record-keeping purposes.`, MARGIN, footY + 8, 7.5, font, C_MUTED);
  text(page, "It is not a certified insurance claim form and is not proof of payment. Protected health information — handle per HIPAA privacy & security requirements.", MARGIN, footY - 2, 7.5, font, C_MUTED);

  return doc.save();
}
