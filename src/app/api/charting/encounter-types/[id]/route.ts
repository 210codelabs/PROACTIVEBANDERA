import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const data: Record<string, unknown> = {};
  if (typeof b.name === "string") data.name = b.name.trim();
  if (typeof b.code === "string") data.code = b.code || null;
  if (typeof b.codeSystem === "string") data.codeSystem = ["SNOMED", "CPT", "HCPCS"].includes(b.codeSystem) ? b.codeSystem : null;
  if (typeof b.active === "boolean") data.active = b.active;
  if (b.isDefault === true) {
    await db.encounterType.updateMany({ data: { isDefault: false } });
    data.isDefault = true;
  }
  try {
    const updated = await db.encounterType.update({ where: { id }, data });
    return NextResponse.json({ ok: true, encounterType: updated });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await db.encounterType.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.isDefault) return NextResponse.json({ error: "Cannot delete the default encounter type. Set another default first." }, { status: 409 });
  await db.encounterType.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
