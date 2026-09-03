import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/waitlist/[id] -> update priority/status/note (also used to mark filled)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const data: any = {};
  if (typeof b.priority === "number") data.priority = b.priority;
  if (typeof b.note === "string") data.note = b.note;
  if (typeof b.status === "string") {
    data.status = b.status;
    if (b.status === "filled") { data.filledAt = new Date(); if (b.filledApptId) data.filledApptId = String(b.filledApptId); }
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  try {
    await db.waitlist.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not update waitlist entry" }, { status: 400 });
  }
}

// DELETE /api/waitlist/[id] -> remove from waitlist
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  try {
    await db.waitlist.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not remove waitlist entry" }, { status: 400 });
  }
}
