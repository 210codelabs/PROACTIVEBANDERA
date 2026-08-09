import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStediConfig } from "@/lib/stedi";
import { renderSuperbillPdf } from "@/lib/superbillPdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const { id } = await params;
  const claim = await db.claim.findUnique({ where: { id } });
  if (!claim) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

  const cfg = await getStediConfig();
  const patient = claim.patientId ? await db.patient.findUnique({ where: { id: claim.patientId } }).catch(() => null) : null;

  const pdf = await renderSuperbillPdf(
    {
      patientControlNumber: claim.patientControlNumber,
      patientName: claim.patientName,
      payerId: claim.payerId,
      payerName: claim.payerName,
      status: claim.status,
      totalChargeCents: claim.totalChargeCents,
      paidCents: claim.paidCents,
      diagnoses: (claim.diagnoses as any[]) || [],
      serviceLines: (claim.serviceLines as any[]) || [],
      createdAt: claim.createdAt,
      createdByName: claim.createdByName,
    },
    { orgName: cfg.orgName || "Proactive Clinic", billingNpi: cfg.billingNpi, taxId: cfg.taxId, address: cfg.address },
    patient ? { dob: patient.dob, memberId: (patient as any).memberId, insurerName: (patient as any).insurerName, phone: patient.phone } : undefined,
  );

  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="superbill-${claim.patientControlNumber}.pdf"`,
    },
  });
}
