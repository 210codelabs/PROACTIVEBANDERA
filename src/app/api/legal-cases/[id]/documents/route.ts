import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

const MAX_BASE64 = 12 * 1024 * 1024; // ~9MB binary

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const docs = await db.caseDocument.findMany({
    where: { legalCaseId: id },
    select: { id: true, name: true, category: true, mimeType: true, size: true, uploadedBy: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ documents: docs });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const dataBase64 = String(body?.dataBase64 || "");
  if (!name || !dataBase64) return NextResponse.json({ error: "name and file are required" }, { status: 400 });
  if (dataBase64.length > MAX_BASE64) return NextResponse.json({ error: "File too large (max ~9MB)." }, { status: 413 });
  const doc = await db.caseDocument.create({
    data: {
      legalCaseId: id,
      name,
      category: String(body?.category || "other"),
      mimeType: String(body?.mimeType || "application/octet-stream"),
      size: Number(body?.size || 0),
      dataBase64,
      uploadedBy: session.name || session.email,
    },
    select: { id: true, name: true },
  });
  await db.caseEvent.create({ data: { legalCaseId: id, type: "document", title: `Document uploaded: ${name}`, actor: session.name || session.email } });
  return NextResponse.json({ ok: true, document: doc });
}
