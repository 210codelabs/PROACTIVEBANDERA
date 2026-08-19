import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const LinkBody = z.object({ userId: z.string().min(1), role: z.string().optional().nullable() });

// POST /api/specialties/[id]/providers -> link a provider/specialist
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parse = LinkBody.safeParse(json);
  if (!parse.success) return NextResponse.json({ error: "A userId is required." }, { status: 400 });

  const sp = await db.specialty.findUnique({ where: { id } }).catch(() => null);
  if (!sp) return NextResponse.json({ error: "Specialty not found." }, { status: 404 });
  const exists = await db.specialtyProvider.findFirst({ where: { specialtyId: id, userId: parse.data.userId } }).catch(() => null);
  if (exists) return NextResponse.json({ error: "That provider is already linked." }, { status: 409 });

  const link = await db.specialtyProvider.create({ data: { specialtyId: id, userId: parse.data.userId, role: parse.data.role || null } });
  return NextResponse.json({ ok: true, link });
}

// DELETE /api/specialties/[id]/providers?linkId=... -> unlink a provider
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  const linkId = new URL(req.url).searchParams.get("linkId");
  if (!linkId) return NextResponse.json({ error: "linkId is required." }, { status: 400 });
  try {
    await db.specialtyProvider.deleteMany({ where: { id: linkId, specialtyId: id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not unlink provider." }, { status: 500 });
  }
}
