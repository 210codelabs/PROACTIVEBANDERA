import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderStatementPdf } from "@/lib/statementPdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const { id } = await params;
  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

  const entries = await db.patientLedgerEntry.findMany({ where: { patientId: id }, orderBy: { date: "desc" }, take: 500 });
  let charges = 0, payments = 0, adjustments = 0;
  for (const e of entries) {
    if (e.type === "charge") charges += e.amountCents;
    else if (e.type === "payment") payments += e.amountCents;
    else if (e.type === "adjustment") adjustments += e.amountCents;
  }
  const pdf = await renderStatementPdf({
    patientName: `${patient.lastName}, ${patient.firstName}`,
    mrn: (patient as any).mrn || null,
    insurer: (patient as any).insurerName || null,
    entries: entries.map((e) => ({ date: e.date, type: e.type, description: e.description, amountCents: e.amountCents })),
    totals: { charges, payments, adjustments, balanceCents: charges - payments - adjustments },
  });
  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="statement-${(patient as any).mrn || patient.id}.pdf"` },
  });
}
