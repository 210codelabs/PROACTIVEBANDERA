import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function POST(req: Request) {
  await requireSession();
  const b = await req.json();
  if (!b.patientId || !b.providerId || !b.day || !b.time) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  try {
    const start = new Date(`${b.day}T${b.time}:00`);
    let durationMin = 30;
    if (b.serviceTypeId) {
      const s = await db.serviceType.findUnique({ where: { id: b.serviceTypeId } });
      if (s) durationMin = s.durationMin;
    }
    const end = new Date(start.getTime() + durationMin * 60000);
    const appt = await db.appointment.create({
      data: {
        patientId: b.patientId,
        providerId: b.providerId,
        serviceTypeId: b.serviceTypeId || null,
        startsAt: start,
        endsAt: end,
        location: b.location || "in-office",
        reason: b.reason || null,
        notes: b.notes || null,
        status: "scheduled",
      },
    });
    return NextResponse.json({ ok: true, appointment: appt });
  } catch {
    return NextResponse.json({ error: "Scheduling is temporarily unavailable" }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  await requireSession();
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const updated = await db.appointment.update({
      where: { id: b.id },
      data: { status: b.status },
    });
    return NextResponse.json({ ok: true, appointment: updated });
  } catch {
    return NextResponse.json({ error: "Appointment updates are temporarily unavailable" }, { status: 503 });
  }
}
