import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderReceiptPdf } from "@/lib/receiptPdf";

// GET /api/patients/[id]/receipt?entryId=... -> branded PDF receipt for a payment
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const entryId = searchParams.get("entryId");
  if (!entryId) return new Response(JSON.stringify({ error: "entryId required" }), { status: 400, headers: { "Content-Type": "application/json" } });

  const entry = await db.patientLedgerEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.patientId !== id) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  if (entry.type !== "payment") return new Response(JSON.stringify({ error: "Receipt is only available for payments." }), { status: 400, headers: { "Content-Type": "application/json" } });

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) return new Response(JSON.stringify({ error: "Patient not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

  const all = await db.patientLedgerEntry.findMany({ where: { patientId: id } });
  let charges = 0, payments = 0, adjustments = 0;
  for (const e of all) {
    if (e.type === "charge") charges += e.amountCents;
    else if (e.type === "payment") payments += e.amountCents;
    else if (e.type === "adjustment") adjustments += e.amountCents;
  }

  const pdf = await renderReceiptPdf({
    patientName: `${patient.lastName}, ${patient.firstName}`,
    mrn: (patient as any).mrn || null,
    amountCents: entry.amountCents,
    description: entry.description,
    date: entry.date,
    balanceCents: charges - payments - adjustments,
    receiptNo: entry.id.slice(-8).toUpperCase(),
  });
  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="receipt-${entry.id.slice(-8)}.pdf"` },
  });
}
