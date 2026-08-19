import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { readAdminConfig } from "@/lib/admin/store";
import { BUILTIN_CATEGORIES, slugify } from "@/lib/inventory";

export const runtime = "nodejs";

async function canManage(role: string) {
  if (role === "admin") return true;
  const cfg = await readAdminConfig().catch(() => null);
  return Boolean(cfg?.modules?.integrations?.inventoryManagement);
}

// GET /api/inventory/categories -> built-in + managed categories (merged), with item counts
export async function GET() {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const managed = await db.inventoryCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }).catch(() => []);
  const items = await db.inventoryItem.findMany({ where: { active: true }, select: { category: true } }).catch(() => []);
  const counts: Record<string, number> = {};
  for (const it of items) counts[it.category] = (counts[it.category] || 0) + 1;

  const seen = new Set<string>();
  const out: any[] = [];
  for (const b of BUILTIN_CATEGORIES) {
    seen.add(b.slug);
    out.push({ id: null, slug: b.slug, name: b.name, builtin: true, count: counts[b.slug] || 0 });
  }
  for (const m of managed) {
    if (seen.has(m.slug)) continue;
    seen.add(m.slug);
    out.push({ id: m.id, slug: m.slug, name: m.name, description: m.description, builtin: false, count: counts[m.slug] || 0 });
  }
  return NextResponse.json({ categories: out });
}

const CreateBody = z.object({ name: z.string().min(1), description: z.string().optional().nullable(), color: z.string().optional().nullable() });

// POST /api/inventory/categories -> add a managed category
export async function POST(req: Request) {
  let user;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!(await canManage(user.role))) return NextResponse.json({ error: "Inventory management is disabled by admin controls." }, { status: 409 });

  const json = await req.json().catch(() => null);
  const parse = CreateBody.safeParse(json);
  if (!parse.success) return NextResponse.json({ error: "A category name is required." }, { status: 400 });
  const name = parse.data.name.trim();
  const slug = slugify(name);
  if (!slug) return NextResponse.json({ error: "Invalid category name." }, { status: 400 });
  if (BUILTIN_CATEGORIES.some((b) => b.slug === slug)) return NextResponse.json({ error: "That category already exists (built-in)." }, { status: 409 });
  const dup = await db.inventoryCategory.findUnique({ where: { slug } }).catch(() => null);
  if (dup) return NextResponse.json({ error: "That category already exists." }, { status: 409 });

  const cat = await db.inventoryCategory.create({ data: { slug, name, description: parse.data.description || null, color: parse.data.color || null } });
  return NextResponse.json({ ok: true, category: { id: cat.id, slug: cat.slug, name: cat.name, builtin: false, count: 0 } });
}
