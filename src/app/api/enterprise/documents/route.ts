import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";

export const runtime = "nodejs";
const MAX = 5 * 1024 * 1024; // 5MB

export async function GET(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestId = new URL(req.url).searchParams.get("requestId") || undefined;
  const where: any = { enterpriseId: s.enterpriseId };
  if (requestId) where.requestId = requestId;
  const docs = await db.enterpriseDocument.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, name: true, mimeType: true, size: true, uploadedType: true, uploadedName: true, requestId: true, createdAt: true } });
  return NextResponse.json({ documents: docs });
}

export async function POST(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const name = String(b?.name || "").trim();
  const dataBase64 = String(b?.dataBase64 || "");
  const mimeType = String(b?.mimeType || "application/octet-stream");
  const requestId = b?.requestId || null;
  if (!name || !dataBase64) return NextResponse.json({ error: "File required" }, { status: 400 });
  const size = Math.floor((dataBase64.length * 3) / 4);
  if (size > MAX) return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 413 });
  const doc = await db.enterpriseDocument.create({
    data: { enterpriseId: s.enterpriseId, requestId, name, mimeType, size, dataBase64, uploadedType: "employer", uploadedName: s.name },
  });
  return NextResponse.json({ ok: true, id: doc.id });
}
