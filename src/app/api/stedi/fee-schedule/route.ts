import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await db.feeScheduleItem.findMany({ orderBy: { code: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || !b.code || !b.description) return NextResponse.json({ error: "Code and description are required." }, { status: 400 });
  const code = String(b.code).trim().toUpperCase();
  const modifier = b.modifier ? String(b.modifier).trim().toUpperCase() : null;
  const feeCents = Math.round(Number(b.feeDollars ?? (b.feeCents ? b.feeCents / 100 : 0)) * 100) || 0;
  const data = { code, description: String(b.description).trim(), modifier, feeCents, active: b.active !== false };
  try {
    let item;
    if (b.id) {
      item = await db.feeScheduleItem.update({ where: { id: b.id }, data });
    } else {
      const existing = await db.feeScheduleItem.findFirst({ where: { code, modifier } });
      item = existing
        ? await db.feeScheduleItem.update({ where: { id: existing.id }, data })
        : await db.feeScheduleItem.create({ data });
    }
    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.feeScheduleItem.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
