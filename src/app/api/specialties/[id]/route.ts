import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapByIds } from "@/lib/safe-relations";

export const runtime = "nodejs";

// GET /api/specialties/[id] -> specialty with linked providers + patients (names resolved)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  const sp = await db.specialty.findUnique({ where: { id }, include: { providers: true, patients: true } }).catch(() => null);
  if (!sp) return NextResponse.json({ error: "Specialty not found." }, { status: 404 });

  const userMap = await mapByIds("user", sp.providers.map((p: any) => p.userId));
  const patMap = await mapByIds("patient", sp.patients.map((p: any) => p.patientId));
  const provForPatMap = await mapByIds("user", sp.patients.map((p: any) => p.providerId).filter(Boolean));

  return NextResponse.json({
    specialty: { id: sp.id, slug: sp.slug, name: sp.name, description: sp.description },
    providers: sp.providers.map((p: any) => {
      const u = userMap.get(p.userId);
      return { id: p.id, userId: p.userId, role: p.role, name: u ? `${u.firstName} ${u.lastName}` : "Unknown", credential: u?.credential || null, specialty: u?.specialty || null };
    }),
    patients: sp.patients.map((p: any) => {
      const pt = patMap.get(p.patientId);
      const prov = p.providerId ? provForPatMap.get(p.providerId) : null;
      return { id: p.id, patientId: p.patientId, name: pt ? `${pt.lastName}, ${pt.firstName}` : "Unknown", mrn: pt?.mrn || null, note: p.note, providerId: p.providerId, providerName: prov ? `${prov.firstName} ${prov.lastName}` : null };
    }),
  });
}

const PatchBody = z.object({ name: z.string().min(1).optional(), description: z.string().optional().nullable(), active: z.boolean().optional() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parse = PatchBody.safeParse(json);
  if (!parse.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const data: any = {};
  if (parse.data.name !== undefined) data.name = parse.data.name.trim();
  if (parse.data.description !== undefined) data.description = parse.data.description || null;
  if (parse.data.active !== undefined) data.active = parse.data.active;
  try {
    const sp = await db.specialty.update({ where: { id }, data });
    return NextResponse.json({ ok: true, specialty: sp });
  } catch {
    return NextResponse.json({ error: "Could not update specialty." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { id } = await params;
  try {
    await db.specialty.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not delete specialty." }, { status: 500 });
  }
}
