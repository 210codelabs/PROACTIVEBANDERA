import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || "").trim();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const type = ["note", "notification"].includes(body?.type) ? body.type : "note";
  const event = await db.caseEvent.create({
    data: { legalCaseId: id, type, title, detail: String(body?.detail || "") || null, actor: session.name || session.email },
  });
  return NextResponse.json({ ok: true, event });
}
