import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
async function guard() { const u = await getSession(); return u && u.role === "admin" ? u : null; }
const MAX = 8 * 1024 * 1024;

// Clinic staff attaches a signed result document to a request; the employer can
// then download it from their portal (documents are scoped by enterpriseId).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await guard();
  if (!u) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const reqRec = await db.enterpriseServiceRequest.findUnique({ where: { id } });
  if (!reqRec) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  const b = await req.json().catch(() => null);
  const name = String(b?.name || "result.pdf").trim();
  const dataBase64 = String(b?.dataBase64 || "");
  const mimeType = String(b?.mimeType || "application/pdf");
  if (!dataBase64) return NextResponse.json({ error: "File required" }, { status: 400 });
  const size = Math.floor((dataBase64.length * 3) / 4);
  if (size > MAX) return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 413 });
  const doc = await db.enterpriseDocument.create({ data: { enterpriseId: reqRec.enterpriseId, requestId: id, name, mimeType, size, dataBase64, uploadedType: "clinic", uploadedName: `${u.firstName} ${u.lastName}`.trim() } });
  return NextResponse.json({ ok: true, id: doc.id });
}
