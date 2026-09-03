import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { mapByIds } from "@/lib/safe-relations";
import { clinicHoursError, minutesOfDay } from "@/lib/clinic";
import { findConflict } from "@/lib/appointments";
import { providerHoursError, nextAvailableSlot } from "@/lib/scheduling";

// GET /api/appointments?patientId=&from=&to=&providerId=&refs=1
// Returns appointments (optionally filtered) plus provider/service reference lists.
export async function GET(req: Request) {
  await requireSession();
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId") || undefined;
  const providerId = searchParams.get("providerId") || undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: any = {};
  if (patientId) where.patientId = patientId;
  if (providerId) where.providerId = providerId;
  // Date filter. A date-only value (YYYY-MM-DD) is expanded so a single-day
  // query (from==to) covers the whole day instead of just midnight.
  if (from || to) {
    const startOf = (v: string) => new Date(v.length === 10 ? `${v}T00:00:00.000` : v);
    const endOf = (v: string) => new Date(v.length === 10 ? `${v}T23:59:59.999` : v);
    where.startsAt = { ...(from ? { gte: startOf(from) } : {}), ...(to ? { lte: endOf(to) } : {}) };
  }

  let appointments: any[] = [];
  try {
    const rows = await db.appointment.findMany({ where, orderBy: { startsAt: "asc" }, take: 500 });
    const pMap = await mapByIds("patient", rows.map((r) => r.patientId));
    const uMap = await mapByIds("user", rows.map((r) => r.providerId));
    const sMap = await mapByIds("serviceType", rows.map((r) => r.serviceTypeId).filter(Boolean) as string[]);
    appointments = rows.map((r) => {
      const p: any = pMap.get(r.patientId);
      const u: any = uMap.get(r.providerId);
      const s: any = r.serviceTypeId ? sMap.get(r.serviceTypeId) : null;
      return {
        id: r.id,
        patientId: r.patientId,
        providerId: r.providerId,
        serviceTypeId: r.serviceTypeId,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        status: r.status,
        reason: r.reason,
        notes: r.notes,
        location: r.location,
        seriesId: r.seriesId,
        patientName: p ? `${p.lastName}, ${p.firstName}` : null,
        providerName: u ? `${u.firstName} ${u.lastName}` : null,
        serviceName: s?.name || null,
      };
    });
  } catch {
    appointments = [];
  }

  const [providers, services] = await Promise.all([
    db.user.findMany({ where: { role: "provider", active: true }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true, credential: true } }).catch(() => []),
    db.serviceType.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { id: true, name: true, durationMin: true, category: true, homeEligible: true } }).catch(() => []),
  ]);

  return NextResponse.json({ appointments, providers, services });
}

export async function POST(req: Request) {
  await requireSession();
  const b = await req.json();
  if (!b.patientId || !b.providerId || !b.day || !b.time) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  try {
    let start = new Date(`${b.day}T${b.time}:00`);
    let durationMin = 30;
    if (b.serviceTypeId) {
      const s = await db.serviceType.findUnique({ where: { id: b.serviceTypeId } });
      if (s) durationMin = s.durationMin;
    }
    let end = new Date(start.getTime() + durationMin * 60000);

    const provider = await db.user.findUnique({ where: { id: b.providerId }, select: { workingHours: true } });

    // Clinic + provider working-hours guard, and conflict check. When the caller
    // opts into autoShift, an out-of-hours / double-booked time is nudged to the
    // closest open slot that day instead of failing.
    let shifted = false;
    const hoursBad = () => clinicHoursError(start, end) || providerHoursError(provider?.workingHours, start, end);
    let conflict = await findConflict(b.providerId, start, end);

    if (b.autoShift && (hoursBad() || (conflict && !b.allowDoubleBook))) {
      const alt = await nextAvailableSlot(b.providerId, b.day, durationMin, minutesOfDay(start), provider?.workingHours);
      if (alt) {
        start = new Date(`${b.day}T${alt}:00`);
        end = new Date(start.getTime() + durationMin * 60000);
        shifted = true;
        conflict = await findConflict(b.providerId, start, end);
      }
    }

    const hoursErr = hoursBad();
    if (hoursErr) return NextResponse.json({ error: hoursErr }, { status: 400 });
    if (conflict && !b.allowDoubleBook) {
      return NextResponse.json({ error: "Double-booking — the provider already has an appointment in that time.", conflict: true }, { status: 409 });
    }
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
    return NextResponse.json({ ok: true, appointment: appt, shifted, day: b.day, time: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}` });
  } catch {
    return NextResponse.json({ error: "Scheduling is temporarily unavailable" }, { status: 503 });
  }
}

// PATCH: update status (check-in/cancel/complete) and/or reschedule
// (day+time or startsAt, provider, service, reason, notes, location).
export async function PATCH(req: Request) {
  await requireSession();
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    const existing = await db.appointment.findUnique({ where: { id: b.id } });
    if (!existing) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

    const data: any = {};
    if (typeof b.status === "string") data.status = b.status;
    if (typeof b.providerId === "string" && b.providerId) data.providerId = b.providerId;
    if ("serviceTypeId" in b) data.serviceTypeId = b.serviceTypeId || null;
    if (typeof b.reason === "string") data.reason = b.reason || null;
    if (typeof b.notes === "string") data.notes = b.notes || null;
    if (typeof b.location === "string" && b.location) data.location = b.location;

    // Reschedule?
    let newStart: Date | null = null;
    if (b.startsAt) newStart = new Date(b.startsAt);
    else if (b.day && b.time) newStart = new Date(`${b.day}T${b.time}:00`);

    let shifted = false;
    if (newStart && !isNaN(newStart.getTime())) {
      // duration: from the (new or existing) service type, else preserve current length
      let durationMin = Math.max(15, Math.round((existing.endsAt.getTime() - existing.startsAt.getTime()) / 60000));
      const svcId = ("serviceTypeId" in b ? b.serviceTypeId : existing.serviceTypeId) || null;
      if (svcId) {
        const s = await db.serviceType.findUnique({ where: { id: svcId } });
        if (s) durationMin = s.durationMin;
      }
      const effProviderId = (data.providerId as string) || existing.providerId;
      const provider = await db.user.findUnique({ where: { id: effProviderId }, select: { workingHours: true } });
      const dayStr = `${newStart.getFullYear()}-${String(newStart.getMonth() + 1).padStart(2, "0")}-${String(newStart.getDate()).padStart(2, "0")}`;

      let endAt = new Date(newStart.getTime() + durationMin * 60000);
      const hoursBad = () => clinicHoursError(newStart as Date, endAt) || providerHoursError(provider?.workingHours, newStart as Date, endAt);
      let clash = await findConflict(effProviderId, newStart, endAt, existing.id);

      // Drag auto-shift: if the target time is out of hours or clashes, snap to
      // the closest open slot that day (unless the caller intends to double-book).
      if (b.autoShift && (hoursBad() || (clash && !b.allowDoubleBook))) {
        const alt = await nextAvailableSlot(effProviderId, dayStr, durationMin, minutesOfDay(newStart), provider?.workingHours, existing.id);
        if (alt) {
          newStart = new Date(`${dayStr}T${alt}:00`);
          endAt = new Date(newStart.getTime() + durationMin * 60000);
          shifted = true;
          clash = await findConflict(effProviderId, newStart, endAt, existing.id);
        }
      }

      data.startsAt = newStart;
      data.endsAt = endAt;
      const hoursErr = hoursBad();
      if (hoursErr) return NextResponse.json({ error: hoursErr }, { status: 400 });
      if (clash && !b.allowDoubleBook) {
        return NextResponse.json({ error: "Double-booking — the provider already has an appointment in that time.", conflict: true }, { status: 409 });
      }
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    // Guard double-booking when only the provider changed (no time move).
    if (!data.startsAt && data.providerId) {
      const clash = await findConflict(data.providerId as string, existing.startsAt, existing.endsAt, existing.id);
      if (clash && !b.allowDoubleBook) return NextResponse.json({ error: "Double-booking — the provider already has an appointment in that time.", conflict: true }, { status: 409 });
    }

    const updated = await db.appointment.update({ where: { id: b.id }, data });
    const st = updated.startsAt;

    // Waitlist fill: when a booked appointment is cancelled, surface the next
    // waiting patient so staff can offer them the freed slot in one click.
    let waitlistOffer: any = null;
    if (data.status === "cancelled" && existing.status !== "cancelled") {
      const freedStart = existing.startsAt;
      const freedDay = `${freedStart.getFullYear()}-${String(freedStart.getMonth() + 1).padStart(2, "0")}-${String(freedStart.getDate()).padStart(2, "0")}`;
      const freedTime = `${String(freedStart.getHours()).padStart(2, "0")}:${String(freedStart.getMinutes()).padStart(2, "0")}`;
      const cand = await db.waitlist.findFirst({
        where: {
          status: "waiting",
          OR: [{ providerId: existing.providerId }, { providerId: null }],
          AND: [{ OR: [{ preferredFrom: null }, { preferredFrom: { lte: freedDay } }] }],
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      }).catch(() => null);
      if (cand) {
        const p = await db.patient.findUnique({ where: { id: cand.patientId }, select: { firstName: true, lastName: true, mrn: true } }).catch(() => null);
        waitlistOffer = {
          entryId: cand.id,
          patientId: cand.patientId,
          patientName: p ? `${p.lastName}, ${p.firstName}` : "Waitlisted patient",
          mrn: p?.mrn || "",
          providerId: existing.providerId,
          serviceTypeId: cand.serviceTypeId || existing.serviceTypeId || null,
          reason: cand.reason || existing.reason || null,
          day: freedDay,
          time: freedTime,
        };
      }
    }

    return NextResponse.json({ ok: true, appointment: updated, shifted, waitlistOffer, day: `${st.getFullYear()}-${String(st.getMonth() + 1).padStart(2, "0")}-${String(st.getDate()).padStart(2, "0")}`, time: `${String(st.getHours()).padStart(2, "0")}:${String(st.getMinutes()).padStart(2, "0")}` });
  } catch {
    return NextResponse.json({ error: "Appointment updates are temporarily unavailable" }, { status: 503 });
  }
}
