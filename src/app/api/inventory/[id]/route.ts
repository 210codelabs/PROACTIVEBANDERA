import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { readAdminConfig } from "@/lib/admin/store";

export const runtime = "nodejs";

const PatchBody = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  edition: z.string().optional().nullable(),
  form: z.string().optional().nullable(),
  strength: z.string().optional().nullable(),
  ndc: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  reorderLevel: z.number().int().min(0).optional(),
  unitCostCents: z.number().int().min(0).optional(),
  retailPriceCents: z.number().int().min(0).optional(),
  taxable: z.boolean().optional(),
  controlled: z.boolean().optional(),
  location: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  lotNumber: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

async function canManage(role: string) {
  if (role === "admin") return true;
  const cfg = await readAdminConfig().catch(() => null);
  return Boolean(cfg?.modules?.integrations?.inventoryManagement);
}

// PATCH /api/inventory/[id] -> edit a product (not stock qty; use /movement)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!(await canManage(user.role))) return NextResponse.json({ error: "Inventory management is disabled by admin controls." }, { status: 409 });
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parse = PatchBody.safeParse(json);
  if (!parse.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const b = parse.data;

  const data: any = {};
  for (const k of ["name", "category", "edition", "form", "strength", "ndc", "unit", "location", "supplier", "lotNumber", "imageUrl"] as const) {
    if (b[k] !== undefined) data[k] = b[k] === "" ? null : b[k];
  }
  for (const k of ["reorderLevel", "unitCostCents", "retailPriceCents"] as const) if (b[k] !== undefined) data[k] = b[k];
  for (const k of ["taxable", "controlled", "active"] as const) if (b[k] !== undefined) data[k] = b[k];
  if (b.expiresAt !== undefined) data.expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;

  try {
    const item = await db.inventoryItem.update({ where: { id }, data });
    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json({ error: `Could not update product: ${String(e?.message || e).slice(0, 160)}` }, { status: 500 });
  }
}

// DELETE /api/inventory/[id] -> soft-delete (active:false) to keep history
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!(await canManage(user.role))) return NextResponse.json({ error: "Inventory management is disabled by admin controls." }, { status: 409 });
  const { id } = await params;
  try {
    await db.inventoryItem.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not remove product." }, { status: 500 });
  }
}
