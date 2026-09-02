import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/pt/fees -> practice-wide PT CPT charge master
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fees = await db.ptCptFee.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  const map: Record<string, number> = {};
  for (const f of fees) map[f.code] = f.chargeCents;
  return NextResponse.json({ fees, map });
}

function toCents(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

// POST /api/pt/fees -> upsert one {code, description, chargeCents}
//                      or many {fees:[{code, description, chargeDollars|chargeCents}]}
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const items: any[] = Array.isArray(b.fees) ? b.fees : [b];
  const out = [];
  for (const it of items) {
    const code = String(it.code || "").trim().toUpperCase();
    if (!code) continue;
    const chargeCents = it.chargeCents != null ? Math.max(0, Math.round(Number(it.chargeCents) || 0)) : toCents(it.chargeDollars);
    const description = it.description ? String(it.description).trim() : null;
    const fee = await db.ptCptFee.upsert({
      where: { code },
      update: { description, chargeCents, active: true },
      create: { code, description, chargeCents, active: true },
    });
    out.push(fee);
  }
  return NextResponse.json({ ok: true, fees: out });
}

// DELETE /api/pt/fees?code=97110
export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  await db.ptCptFee.deleteMany({ where: { code: code.toUpperCase() } });
  return NextResponse.json({ ok: true });
}
