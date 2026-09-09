import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEncounterTypes } from "@/lib/charting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const encounterTypes = await getEncounterTypes();
  return NextResponse.json({ encounterTypes });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const codeSystem = ["SNOMED", "CPT", "HCPCS"].includes(String(b.codeSystem)) ? String(b.codeSystem) : "";
  const created = await db.encounterType.create({
    data: { name, code: String(b.code || "") || null, codeSystem: codeSystem || null, category: String(b.category || "") || null, active: true },
  });
  return NextResponse.json({ ok: true, encounterType: created });
}
