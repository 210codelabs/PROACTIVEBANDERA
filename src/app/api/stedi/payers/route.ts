import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchStediPayers, getStediConfig } from "@/lib/stedi";

// GET /api/stedi/payers            -> local payer directory
// GET /api/stedi/payers?stedi=aetna -> live search against Stedi payers API
export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const stediQuery = searchParams.get("stedi");
  if (stediQuery !== null) {
    const cfg = await getStediConfig();
    if (!cfg.apiKey) return NextResponse.json({ error: "Configure your Stedi API key first." }, { status: 400 });
    try {
      const results = await searchStediPayers(stediQuery);
      return NextResponse.json({ results });
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 200 });
    }
  }
  const payers = await db.payer.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ payers });
}

// POST create/update a local payer
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || !b.name) return NextResponse.json({ error: "Payer name is required." }, { status: 400 });
  const data = {
    name: String(b.name).trim(),
    stediId: b.stediId ? String(b.stediId).trim() : null,
    supportsEligibility: b.supportsEligibility !== false,
    supportsClaims: b.supportsClaims !== false,
    supportsRemittance: Boolean(b.supportsRemittance),
    active: b.active !== false,
    notes: b.notes || null,
  };
  const payer = b.id
    ? await db.payer.update({ where: { id: b.id }, data })
    : await db.payer.create({ data });
  return NextResponse.json({ ok: true, payer });
}

// DELETE /api/stedi/payers?id=...
export async function DELETE(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.payer.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
