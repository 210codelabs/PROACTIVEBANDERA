import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { readAdminConfig } from "@/lib/admin/store";

export const runtime = "nodejs";

async function canManage(role: string) {
  if (role === "admin") return true;
  const cfg = await readAdminConfig().catch(() => null);
  return Boolean(cfg?.modules?.integrations?.inventoryManagement);
}

const PatchBody = z.object({ name: z.string().min(1).optional(), description: z.string().optional().nullable(), active: z.boolean().optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!(await canManage(user.role))) return NextResponse.json({ error: "Inventory management is disabled by admin controls." }, { status: 409 });
  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parse = PatchBody.safeParse(json);
  if (!parse.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const data: any = {};
  if (parse.data.name !== undefined) data.name = parse.data.name.trim();
  if (parse.data.description !== undefined) data.description = parse.data.description || null;
  if (parse.data.active !== undefined) data.active = parse.data.active;
  try {
    const cat = await db.inventoryCategory.update({ where: { id }, data });
    return NextResponse.json({ ok: true, category: cat });
  } catch {
    return NextResponse.json({ error: "Could not update category." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!(await canManage(user.role))) return NextResponse.json({ error: "Inventory management is disabled by admin controls." }, { status: 409 });
  const { id } = await params;
  try {
    await db.inventoryCategory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete category." }, { status: 500 });
  }
}
