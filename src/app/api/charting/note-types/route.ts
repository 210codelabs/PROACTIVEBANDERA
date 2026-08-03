import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getNoteTypes } from "@/lib/charting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const noteTypes = await getNoteTypes();
  return NextResponse.json({ noteTypes });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const name = String(b.name || "").trim();
  const format = b.format === "simple" ? "simple" : "soap";
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const created = await db.chartNoteType.create({ data: { name, format, active: true } });
  return NextResponse.json({ ok: true, noteType: created });
}
