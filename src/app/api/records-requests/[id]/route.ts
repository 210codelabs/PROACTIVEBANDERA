import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

// Staff: approve / deny an attorney record request
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const b = await req.json().catch(() => null);
  const status = (b?.status || "").toString();
  if (!["approved", "denied", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  try {
    const rr = await db.recordRequest.update({
      where: { id },
      data: { status, decision: b?.decision ? String(b.decision) : null, decidedAt: new Date() },
    });
    return NextResponse.json({ ok: true, request: rr });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
