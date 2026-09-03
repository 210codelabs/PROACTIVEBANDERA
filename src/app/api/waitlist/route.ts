import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/waitlist -> current waiting entries (with patient + provider names)
export async function GET() {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  try {
    const entries = await db.waitlist.findMany({
      where: { status: "waiting" },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 200,
    });
    const patientIds = [...new Set(entries.map((e) => e.patientId))];
    const providerIds = [...new Set(entries.map((e) => e.providerId).filter(Boolean) as string[])];
    const [patients, providers] = await Promise.all([
      db.patient.findMany({ where: { id: { in: patientIds } }, select: { id: true, firstName: true, lastName: true, mrn: true } }),
      db.user.findMany({ where: { id: { in: providerIds } }, select: { id: true, firstName: true, lastName: true, credential: true } }),
    ]);
    const pMap = new Map(patients.map((p) => [p.id, p]));
    const provMap = new Map(providers.map((p) => [p.id, p]));
    return NextResponse.json({
      entries: entries.map((e) => {
        const p = pMap.get(e.patientId);
        const prov = e.providerId ? provMap.get(e.providerId) : null;
        return {
          id: e.id,
          patientId: e.patientId,
          patientName: p ? `${p.lastName}, ${p.firstName}` : "(unknown)",
          mrn: p?.mrn || "",
          providerId: e.providerId,
          providerName: prov ? `${prov.firstName} ${prov.lastName}${prov.credential ? `, ${prov.credential}` : ""}` : "Any provider",
          serviceTypeId: e.serviceTypeId,
          reason: e.reason,
          preferredFrom: e.preferredFrom,
          note: e.note,
          priority: e.priority,
          createdAt: e.createdAt,
        };
      }),
    });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}

// POST /api/waitlist -> add a patient to the waitlist
export async function POST(req: Request) {
  let session;
  try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));
  if (!b.patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 });
  try {
    const entry = await db.waitlist.create({
      data: {
        patientId: String(b.patientId),
        providerId: b.providerId ? String(b.providerId) : null,
        serviceTypeId: b.serviceTypeId ? String(b.serviceTypeId) : null,
        reason: b.reason ? String(b.reason) : null,
        preferredFrom: b.preferredFrom ? String(b.preferredFrom) : null,
        note: b.note ? String(b.note) : null,
        priority: Number.isFinite(Number(b.priority)) ? Number(b.priority) : 0,
        createdByName: `${session.firstName} ${session.lastName}`,
      },
    });
    return NextResponse.json({ ok: true, id: entry.id });
  } catch {
    return NextResponse.json({ error: "Could not add to waitlist" }, { status: 500 });
  }
}
