import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

function parse(body: string | null): any {
  if (!body) return {};
  try { return JSON.parse(body) || {}; } catch { return {}; }
}

// Staff: approve or reopen an intake submission (status stored in the doc body).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "approve" && action !== "reopen") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = parse(doc.body);
  b.reviewStatus = action === "approve" ? "approved" : "pending";
  if (action === "approve") {
    b.reviewedByName = `${user.firstName} ${user.lastName}`;
    b.reviewedAt = new Date().toISOString();
    if (typeof body.note === "string" && body.note.trim()) b.reviewNote = body.note.trim();
  } else {
    b.reviewedByName = "";
    b.reviewedAt = "";
  }
  await db.document.update({ where: { id }, data: { body: JSON.stringify(b) } });
  return NextResponse.json({ ok: true, reviewStatus: b.reviewStatus });
}
