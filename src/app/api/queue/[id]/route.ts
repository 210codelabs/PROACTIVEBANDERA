import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPT_STATUS: Record<string, string> = {
  "in-room": "in-room",
  "checked-out": "completed",
  "no-show": "no-show",
  "rescheduled": "scheduled",
  "waiting": "checked-in",
};

// PATCH /api/queue/:id  -> transition status (in-room | checked-out | no-show | rescheduled | waiting)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const status = String(b.status || "");
  const hasStatus = status.length > 0;
  const hasRoom = typeof b.room === "string";
  const ALLOWED = ["waiting", "in-room", "checked-out", "no-show", "rescheduled"];
  if (hasStatus && !ALLOWED.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  if (!hasStatus && !hasRoom && typeof b.providerId !== "string") {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const entry = await db.queueEntry.findUnique({ where: { id } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = {};
  const now = new Date();
  if (hasStatus) data.status = status;
  if (status === "in-room" && !entry.inRoomAt) data.inRoomAt = now;
  if (status === "checked-out") data.checkOutAt = now;
  if (typeof b.room === "string") data.room = b.room.trim() || null;
  if (typeof b.providerId === "string") data.providerId = b.providerId || null;
  if (typeof b.providerName === "string") data.providerName = b.providerName || null;
  if (typeof b.reason === "string") data.reason = b.reason || null;

  const updated = await db.queueEntry.update({ where: { id }, data });

  // Keep the linked appointment in sync.
  if (hasStatus && entry.appointmentId && APPT_STATUS[status]) {
    await db.appointment.update({ where: { id: entry.appointmentId }, data: { status: APPT_STATUS[status] } }).catch(() => {});
  }

  return NextResponse.json({ ok: true, entry: updated });
}

// DELETE /api/queue/:id  -> remove an entry from the board.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  await db.queueEntry.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
