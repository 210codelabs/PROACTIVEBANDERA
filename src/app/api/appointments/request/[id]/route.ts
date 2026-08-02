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
  const updated = await db.appointmentRequest.update({ where: { id }, data: { status } });
  return NextResponse.json({ ok: true, request: updated });
}
