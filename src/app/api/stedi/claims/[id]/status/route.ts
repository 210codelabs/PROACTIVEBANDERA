import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStediConfig, checkClaimStatus, StediError } from "@/lib/stedi";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const cfg = await getStediConfig();
  if (!cfg.enabled || !cfg.apiKey) return NextResponse.json({ error: "Stedi is not configured." }, { status: 400 });

  const claim = await db.claim.findUnique({ where: { id } });
  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patient = claim.patientId ? await db.patient.findUnique({ where: { id: claim.patientId } }).catch(() => null) : null;
  const [lastName, firstName] = (claim.patientName || ", ").split(", ");
  const lines = (claim.serviceLines as any[]) || [];
  const dates = lines.map((l) => new Date(l.serviceDate)).filter((d) => !isNaN(d.getTime()));
  const begin = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : (claim.submittedAt || claim.createdAt);
  const end = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date();

  try {
    const resp = await checkClaimStatus({
      trackingNumber: claim.patientControlNumber,
      payerId: claim.payerId,
      beginDate: begin, endDate: end,
      subscriber: { memberId: (patient as any)?.memberId, firstName: patient?.firstName || firstName || "", lastName: patient?.lastName || lastName || "", dateOfBirth: patient?.dob },
    });
    const updated = await db.claim.update({ where: { id }, data: { statusResponse: resp as object } });
    return NextResponse.json({ ok: true, claim: updated, status: resp });
  } catch (e: any) {
    const status = e instanceof StediError ? e.status : 502;
    return NextResponse.json({ error: `Status check failed: ${String(e?.message || e).slice(0, 300)}`, status }, { status: 200 });
  }
}
