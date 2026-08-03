import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: list addenda for a (signed) encounter.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const addenda = await db.addendum.findMany({ where: { encounterId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ addenda });
}

// POST: add an addendum. Optionally change the encounter type (recorded old->new).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const note = String(b.note || "").trim();
  const newEncounterTypeId = String(b.newEncounterTypeId || "").trim();

  const enc = await db.encounter.findUnique({ where: { id }, select: { id: true, encounterTypeName: true } });
  if (!enc) return NextResponse.json({ error: "Encounter not found" }, { status: 404 });

  let prevName: string | null = null;
  let newName: string | null = null;
  if (newEncounterTypeId) {
    const et = await db.encounterType.findUnique({ where: { id: newEncounterTypeId } });
    if (!et) return NextResponse.json({ error: "Encounter type not found" }, { status: 400 });
    prevName = enc.encounterTypeName || null;
    newName = et.name;
    await db.encounter.update({ where: { id }, data: { encounterTypeId: et.id, encounterTypeName: et.name } });
  }
  if (!note && !newEncounterTypeId) return NextResponse.json({ error: "Add a note or change the encounter type." }, { status: 400 });

  const authorName = [s.firstName, s.lastName].filter(Boolean).join(" ") || s.email || null;
  const addendum = await db.addendum.create({
    data: { encounterId: id, authorId: s.id, authorName, note: note || null, prevEncounterTypeName: prevName, newEncounterTypeName: newName },
  });
  return NextResponse.json({ ok: true, addendum });
}
