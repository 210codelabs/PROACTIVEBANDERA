import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["charting", "order", "billing"];

// GET ?kind= : templates visible to the user (own + practice-shared).
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kind = new URL(req.url).searchParams.get("kind") || "";
  const where: Record<string, unknown> = {};
  if (KINDS.includes(kind)) where.kind = kind;
  where.OR = [{ shared: true }, { ownerId: s.id }];
  const templates = await db.template.findMany({ where, orderBy: { updatedAt: "desc" }, take: 300 });
  return NextResponse.json({ templates: templates.map((t) => ({ ...t, data: safeParse(t.data), mine: t.ownerId === s.id })) });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const kind = String(b.kind || "");
  const name = String(b.name || "").trim();
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Invalid template kind." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const created = await db.template.create({
    data: {
      kind, name, ownerId: s.id, shared: Boolean(b.shared),
      shortcut: String(b.shortcut || "").replace(/[^a-zA-Z0-9_-]/g, "") || null,
      data: JSON.stringify(b.data ?? {}),
    },
  });
  return NextResponse.json({ ok: true, template: { ...created, data: safeParse(created.data), mine: true } });
}

function safeParse(s: string) { try { return JSON.parse(s); } catch { return {}; } }
