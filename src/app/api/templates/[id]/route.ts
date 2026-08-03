import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await db.template.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.ownerId && existing.ownerId !== s.id) return NextResponse.json({ error: "You can only edit your own templates." }, { status: 403 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const data: Record<string, unknown> = {};
  if (typeof b.name === "string") data.name = b.name.trim();
  if (typeof b.shared === "boolean") data.shared = b.shared;
  if (typeof b.shortcut === "string") data.shortcut = b.shortcut.replace(/[^a-zA-Z0-9_-]/g, "") || null;
  if (b.data !== undefined) data.data = JSON.stringify(b.data);
  const updated = await db.template.update({ where: { id }, data });
  return NextResponse.json({ ok: true, template: { ...updated, data: (() => { try { return JSON.parse(updated.data); } catch { return {}; } })() } });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await db.template.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.ownerId && existing.ownerId !== s.id) return NextResponse.json({ error: "You can only delete your own templates." }, { status: 403 });
  await db.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
