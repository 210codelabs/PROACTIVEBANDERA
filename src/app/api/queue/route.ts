import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { mapByIds } from "@/lib/safe-relations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// GET /api/queue?day=YYYY-MM-DD
// Returns the day's queue entries + today's scheduled appointments (so the
// front desk can one-tap check them in). Visible to all signed-in EMR staff.
export async function GET(req: Request) {
  await requireSession();
  const url = new URL(req.url);
  const day = url.searchParams.get("day") || todayStr();

  const entries = await db.queueEntry.findMany({
    where: { day },
    orderBy: { checkInAt: "asc" },
    take: 300,
  }).catch(() => []);

  // Today's appointments (for the check-in-from-schedule list).
  const start = new Date(`${day}T00:00:00.000`);
  const end = new Date(`${day}T23:59:59.999`);
  let scheduled: any[] = [];
  try {
    const rows = await db.appointment.findMany({
      where: { startsAt: { gte: start, lte: end }, status: { notIn: ["cancelled"] } },
      orderBy: { startsAt: "asc" },
      take: 300,
    });
    const pMap = await mapByIds("patient", rows.map((r) => r.patientId));
    const uMap = await mapByIds("user", rows.map((r) => r.providerId));
    const queuedApptIds = new Set(entries.map((e) => e.appointmentId).filter(Boolean));
    scheduled = rows.map((r) => {
      const p: any = pMap.get(r.patientId);
      const u: any = uMap.get(r.providerId);
      return {
        id: r.id,
        patientId: r.patientId,
        patientName: p ? `${p.firstName} ${p.lastName}` : "Patient",
        providerId: r.providerId,
        providerName: u ? `${u.firstName} ${u.lastName}` : null,
        startsAt: r.startsAt,
        status: r.status,
        reason: r.reason,
        alreadyQueued: queuedApptIds.has(r.id),
      };
    });
  } catch {
    scheduled = [];
  }

  return NextResponse.json({ day, entries, scheduled });
}

// POST /api/queue  -> check a patient into the line (scheduled or walk-in).
// body: { patientId, patientName?, appointmentId?, providerId?, providerName?, kind, reason?, scheduledAt?, day? }
export async function POST(req: Request) {
  const s = await requireSession();
  const b = await req.json().catch(() => ({}));
  if (!b.patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 });
  const day = b.day || todayStr();

  // Verify the patient exists in the EMR (walk-ins must be registered first).
  const patient = await db.patient.findUnique({ where: { id: b.patientId } }).catch(() => null);
  if (!patient) return NextResponse.json({ error: "Patient is not registered in the EMR. Register the patient first." }, { status: 404 });

  // Prevent duplicate active entry for the same patient on the same day.
  const dup = await db.queueEntry.findFirst({
    where: { patientId: b.patientId, day, status: { in: ["waiting", "in-room"] } },
  }).catch(() => null);
  if (dup) return NextResponse.json({ error: "This patient is already in the queue.", entry: dup }, { status: 409 });

  const patientName = `${patient.firstName} ${patient.lastName}`;
  const entry = await db.queueEntry.create({
    data: {
      patientId: b.patientId,
      patientName,
      appointmentId: b.appointmentId || null,
      providerId: b.providerId || null,
      providerName: b.providerName || null,
      kind: b.appointmentId ? "scheduled" : (b.kind === "scheduled" ? "scheduled" : "walkin"),
      status: "waiting",
      reason: b.reason || null,
      scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : null,
      day,
      createdByName: `${s.firstName} ${s.lastName}`.trim(),
    },
  });

  // Reflect the arrival on the linked appointment.
  if (b.appointmentId) {
    await db.appointment.update({ where: { id: b.appointmentId }, data: { status: "checked-in" } }).catch(() => {});
  }

  return NextResponse.json({ ok: true, entry });
}
