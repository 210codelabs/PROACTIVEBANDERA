import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const LinkBody = z.object({ patientId: z.string().min(1), providerId: z.string().optional().nullable(), note: z.string().optional().nullable() });

// POST /api/specialties/[id]/patients -> connect a patient to the specialty
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parse = LinkBody.safeParse(json);
  if (!parse.success) return NextResponse.json({ error: "A patientId is required." }, { status: 400 });

  const sp = await db.specialty.findUnique({ where: { id } }).catch(() => null);
  if (!sp) return NextResponse.json({ error: "Specialty not found." }, { status: 404 });
  const exists = await db.specialtyPatient.findFirst({ where: { specialtyId: id, patientId: parse.data.patientId } }).catch(() => null);
  if (exists) return NextResponse.json({ error: "That patient is already connected." }, { status: 409 });

  const link = await db.specialtyPatient.create({ data: { specialtyId: id, patientId: parse.data.patientId, providerId: parse.data.providerId || null, note: parse.data.note || null } });
  return NextResponse.json({ ok: true, link });
}

// DELETE /api/specialties/[id]/patients?linkId=... -> disconnect a patient
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  const linkId = new URL(req.url).searchParams.get("linkId");
  if (!linkId) return NextResponse.json({ error: "linkId is required." }, { status: 400 });
  try {
    await db.specialtyPatient.deleteMany({ where: { id: linkId, specialtyId: id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not disconnect patient." }, { status: 500 });
  }
}
