import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { readAdminConfig } from "@/lib/admin/store";
import { slugify } from "@/lib/inventory";

export const runtime = "nodejs";

const CreateBody = z.object({
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  category: z.string().min(1).default("supply"),
  edition: z.string().optional().nullable(),
  form: z.string().optional().nullable(),
  strength: z.string().optional().nullable(),
  ndc: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  quantityOnHand: z.number().int().min(0).default(0),
  reorderLevel: z.number().int().min(0).default(0),
  unitCostCents: z.number().int().min(0).default(0),
  retailPriceCents: z.number().int().min(0).default(0),
  taxable: z.boolean().default(false),
  controlled: z.boolean().default(false),
  location: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  lotNumber: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
});

async function canManage(role: string) {
  if (role === "admin") return true;
  const cfg = await readAdminConfig().catch(() => null);
  return Boolean(cfg?.modules?.integrations?.inventoryManagement);
}

// GET /api/inventory?category=&q= -> list active items
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const sp = new URL(req.url).searchParams;
  const category = sp.get("category") || undefined;
  const q = (sp.get("q") || "").trim();
  const where: any = { active: true };
  if (category) where.category = category;
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }];
  const items = await db.inventoryItem.findMany({ where, orderBy: [{ category: "asc" }, { name: "asc" }], take: 500 }).catch(() => []);
  return NextResponse.json({ items });
}

// POST /api/inventory -> create a product
export async function POST(req: Request) {
  let user;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!(await canManage(user.role))) return NextResponse.json({ error: "Inventory management is disabled by admin controls." }, { status: 409 });

  const json = await req.json().catch(() => null);
  const parse = CreateBody.safeParse(json);
  if (!parse.success) return NextResponse.json({ error: "Invalid product.", details: parse.error.flatten() }, { status: 400 });
  const b = parse.data;

  const sku = (b.sku && b.sku.trim()) || `${slugify(b.category).slice(0, 3).toUpperCase() || "ITM"}-${Date.now().toString(36).toUpperCase()}`;
  const exists = await db.inventoryItem.findUnique({ where: { sku } }).catch(() => null);
  if (exists) return NextResponse.json({ error: `SKU "${sku}" already exists.` }, { status: 409 });

  try {
    const item = await db.inventoryItem.create({
      data: {
        sku,
        name: b.name.trim(),
        category: b.category,
        edition: b.edition || null,
        form: b.form || null,
        strength: b.strength || null,
        ndc: b.ndc || null,
        unit: b.unit || "each",
        quantityOnHand: b.quantityOnHand,
        reorderLevel: b.reorderLevel,
        unitCostCents: b.unitCostCents,
        retailPriceCents: b.retailPriceCents,
        taxable: b.taxable,
        controlled: b.controlled,
        location: b.location || null,
        supplier: b.supplier || null,
        lotNumber: b.lotNumber || null,
        expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
        imageUrl: b.imageUrl || null,
      },
    });
    if (b.quantityOnHand > 0) {
      await db.stockMovement.create({
        data: { itemId: item.id, type: "receive", quantity: b.quantityOnHand, reason: "Initial stock", actor: `${user.firstName} ${user.lastName}` },
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json({ error: `Could not create product: ${String(e?.message || e).slice(0, 200)}` }, { status: 500 });
  }
}
