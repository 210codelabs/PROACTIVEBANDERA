import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSiteConfig } from "@/lib/site/config";

export const dynamic = "force-dynamic";
const KEY = "brand_presets";

type Preset = { id: string; name: string; identity: unknown; colors: unknown; modules: unknown };

async function requireAdmin() {
  const s = await getSession();
  if (!s) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (s.role !== "admin") return { err: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  return {};
}
async function list(): Promise<Preset[]> {
  const row = await db.appSetting.findUnique({ where: { key: KEY } });
  return Array.isArray(row?.value) ? (row!.value as unknown as Preset[]) : [];
}
async function save(items: Preset[]) {
  await db.appSetting.upsert({ where: { key: KEY }, update: { value: items as unknown as object }, create: { key: KEY, value: items as unknown as object } });
}

// Brand preset gallery: save the CURRENT branding as a named theme, list them,
// or delete one. Applying a theme is done client-side (load into the wizard then
// PUT /api/site-config).
export async function GET() {
  const { err } = await requireAdmin(); if (err) return err;
  return NextResponse.json({ presets: await list() });
}

export async function POST(req: Request) {
  const { err } = await requireAdmin(); if (err) return err;
  const body = await req.json().catch(() => ({}));
  const items = await list();
  if (body?.deleteId) {
    await save(items.filter((p) => p.id !== body.deleteId));
    return NextResponse.json({ ok: true, presets: await list() });
  }
  if (body?.renameId) {
    const name = String(body?.name || "").trim();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    await save(items.map((p) => (p.id === body.renameId ? { ...p, name } : p)));
    return NextResponse.json({ ok: true, presets: await list() });
  }
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const c = await getSiteConfig();
  const preset: Preset = { id: `p_${Date.now()}`, name, identity: c.identity, colors: c.colors, modules: c.modules };
  items.push(preset);
  await save(items);
  return NextResponse.json({ ok: true, presets: items });
}
