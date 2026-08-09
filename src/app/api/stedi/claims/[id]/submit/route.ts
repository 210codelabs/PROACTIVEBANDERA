import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStediConfig, buildClaimPayload, submitProfessionalClaim, StediError } from "@/lib/stedi";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const cfg = await getStediConfig();
  if (!cfg.enabled || !cfg.apiKey) return NextResponse.json({ error: "Stedi is not configured." }, { status: 400 });

  const claim = await db.claim.findUnique({ where: { id } });
  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!claim.payerId) return NextResponse.json({ error: "Claim has no payer ID." }, { status: 400 });

  const patient = claim.patientId ? await db.patient.findUnique({ where: { id: claim.patientId } }).catch(() => null) : null;
  const [lastName, firstName] = (claim.patientName || ", ").split(", ");
  const payload = buildClaimPayload({
    cfg,
    payerId: claim.payerId,
    patientControlNumber: claim.patientControlNumber,
    subscriber: {
      memberId: (patient as any)?.memberId || undefined,
      firstName: patient?.firstName || firstName || "",
      lastName: patient?.lastName || lastName || "",
      dateOfBirth: patient?.dob || undefined,
    },
    diagnoses: (claim.diagnoses as any[]) || [],
    serviceLines: (claim.serviceLines as any[]) || [],
  });

  try {
    const resp = await submitProfessionalClaim(payload, claim.patientControlNumber);
    const updated = await db.claim.update({
      where: { id },
      data: { status: "submitted", submitRequest: payload as object, submitResponse: resp as object, submittedAt: new Date() },
    });
    return NextResponse.json({ ok: true, claim: updated, note: "Submitted to Stedi. Acceptance is not payment — track status and remittances." });
  } catch (e: any) {
    const status = e instanceof StediError ? e.status : 502;
    await db.claim.update({ where: { id }, data: { status: "rejected", submitRequest: payload as object, submitResponse: (e instanceof StediError ? e.body : String(e)) as object } }).catch(() => {});
    return NextResponse.json({ error: `Submit failed: ${String(e?.message || e).slice(0, 300)}`, status }, { status: 200 });
  }
}
