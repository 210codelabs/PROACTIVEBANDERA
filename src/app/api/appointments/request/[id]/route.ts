import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH (STAFF): update a request's status (confirmed / declined / pending).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const status = b?.status;
  if (!["pending", "confirmed", "declined"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const existing = await db.appointmentRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (status === "confirmed" && existing.patientType === "new" && existing.appointmentId && existing.status !== "confirmed") {
    return NextResponse.json({ error: "Use first-visit verification to confirm this new patient." }, { status: 409 });
  }
  if (existing.status === "declined" && status !== "declined" && existing.appointmentId) {
    return NextResponse.json({ error: "A declined appointment must be rescheduled from the calendar." }, { status: 409 });
  }
  const updated = await db.$transaction(async (tx) => {
    if (status === "declined" && existing.appointmentId) {
      await tx.appointment.update({ where: { id: existing.appointmentId }, data: { status: "cancelled" } });
    }
    return tx.appointmentRequest.update({ where: { id }, data: { status } });
  });
  return NextResponse.json({ ok: true, request: updated });
}
