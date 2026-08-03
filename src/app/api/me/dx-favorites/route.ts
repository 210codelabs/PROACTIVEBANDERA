import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Personal "My Dx List" — per-user favorite ICD-10 diagnoses.
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const favorites = await db.dxFavorite.findMany({ where: { userId: s.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ favorites });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const icd10 = String(b.icd10 || "").trim();
  const description = String(b.description || "").trim();
  if (!icd10 && !description) return NextResponse.json({ error: "icd10 or description required" }, { status: 400 });
  const existing = await db.dxFavorite.findFirst({ where: { userId: s.id, icd10 } });
  if (existing) return NextResponse.json({ ok: true, favorite: existing, reused: true });
  const favorite = await db.dxFavorite.create({ data: { userId: s.id, icd10, description } });
  return NextResponse.json({ ok: true, favorite });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const favId = new URL(req.url).searchParams.get("id") || "";
  const icd10 = new URL(req.url).searchParams.get("icd10") || "";
  try {
    if (favId) await db.dxFavorite.delete({ where: { id: favId } });
    else if (icd10) await db.dxFavorite.deleteMany({ where: { userId: s.id, icd10 } });
    else return NextResponse.json({ error: "id or icd10 required" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
