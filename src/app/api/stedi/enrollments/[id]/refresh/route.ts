import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStediEnrollment, StediError } from "@/lib/stedi";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await db.stediEnrollment.findUnique({ where: { id } });
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!rec.stediEnrollmentId) return NextResponse.json({ error: "No Stedi enrollment id on record." }, { status: 400 });
  try {
    const fresh = await getStediEnrollment(rec.stediEnrollmentId);
    const updated = await db.stediEnrollment.update({ where: { id }, data: { status: fresh.status || rec.status, raw: fresh as object } });
    return NextResponse.json({ ok: true, enrollment: updated });
  } catch (e: any) {
    const status = e instanceof StediError ? e.status : 502;
    return NextResponse.json({ error: `Refresh failed: ${String(e?.message || e).slice(0, 200)}`, status }, { status: 200 });
  }
}
