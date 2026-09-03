import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { addDays, format } from "date-fns";
import { clinicHoursError, minutesOfDay } from "@/lib/clinic";
import { findConflict } from "@/lib/appointments";
import { providerHoursError, nextAvailableSlot } from "@/lib/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Upcoming, still-active occurrences of a series (what bulk actions apply to).
async function upcoming(seriesId: string) {
  const now = new Date();
  return db.appointment.findMany({
    where: { seriesId, status: "scheduled", startsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
  });
}

// GET /api/appointments/series/[seriesId] -> series summary
export async function GET(_req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { seriesId } = await params;
  const all = await db.appointment.findMany({ where: { seriesId }, orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, status: true } }).catch(() => []);
  const up = all.filter((a) => a.status === "scheduled" && a.startsAt >= new Date());
  return NextResponse.json({ seriesId, total: all.length, upcomingCount: up.length, occurrences: all });
}

// PATCH /api/appointments/series/[seriesId]
// Bulk-reschedule all UPCOMING occurrences. Body: { time?, providerId?, shiftDays?, autoShift?, allowDoubleBook? }
export async function PATCH(req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { seriesId } = await params;
  const b = await req.json().catch(() => ({}));
  const time: string | null = typeof b.time === "string" && /^\d{2}:\d{2}$/.test(b.time) ? b.time : null;
  const shiftDays = Number.isFinite(Number(b.shiftDays)) ? Math.round(Number(b.shiftDays)) : 0;
  const newProviderId: string | null = typeof b.providerId === "string" && b.providerId ? b.providerId : null;
  const autoShift = Boolean(b.autoShift);
  const allowDoubleBook = Boolean(b.allowDoubleBook);

  if (!time && !shiftDays && !newProviderId) {
    return NextResponse.json({ error: "Nothing to change (provide time, shiftDays or providerId)." }, { status: 400 });
  }

  try {
    const rows = await upcoming(seriesId);
    if (rows.length === 0) return NextResponse.json({ error: "No upcoming visits in this series." }, { status: 404 });

    let updated = 0, shiftedCount = 0;
    const skipped: { day: string; reason: string }[] = [];

    for (const occ of rows) {
      const durationMin = Math.max(15, Math.round((occ.endsAt.getTime() - occ.startsAt.getTime()) / 60000));
      const providerId = newProviderId || occ.providerId;
      const provider = await db.user.findUnique({ where: { id: providerId }, select: { workingHours: true } });

      const baseDate = shiftDays ? addDays(occ.startsAt, shiftDays) : occ.startsAt;
      const dayStr = format(baseDate, "yyyy-MM-dd");
      const hhmm = time || format(occ.startsAt, "HH:mm");
      let start = new Date(`${dayStr}T${hhmm}:00`);
      let end = new Date(start.getTime() + durationMin * 60000);

      const hoursBad = () => clinicHoursError(start, end) || providerHoursError(provider?.workingHours, start, end);
      let clash = await findConflict(providerId, start, end, occ.id);

      if ((hoursBad() || (clash && !allowDoubleBook)) && autoShift) {
        const alt = await nextAvailableSlot(providerId, dayStr, durationMin, minutesOfDay(start), provider?.workingHours, occ.id);
        if (alt) {
          start = new Date(`${dayStr}T${alt}:00`);
          end = new Date(start.getTime() + durationMin * 60000);
          clash = await findConflict(providerId, start, end, occ.id);
        }
      }

      if (hoursBad()) { skipped.push({ day: dayStr, reason: "Outside working hours" }); continue; }
      if (clash && !allowDoubleBook) { skipped.push({ day: dayStr, reason: "Time already booked" }); continue; }

      const wasShifted = format(start, "yyyy-MM-dd HH:mm") !== `${dayStr} ${hhmm}`;
      await db.appointment.update({ where: { id: occ.id }, data: { startsAt: start, endsAt: end, providerId } });
      updated++;
      if (wasShifted) shiftedCount++;
    }

    return NextResponse.json({ ok: true, updated, shiftedCount, skippedCount: skipped.length, skipped });
  } catch {
    return NextResponse.json({ error: "Could not update the series" }, { status: 500 });
  }
}

// DELETE /api/appointments/series/[seriesId] -> cancel all upcoming occurrences
export async function DELETE(_req: Request, { params }: { params: Promise<{ seriesId: string }> }) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const { seriesId } = await params;
  try {
    const rows = await upcoming(seriesId);
    if (rows.length === 0) return NextResponse.json({ ok: true, cancelled: 0 });
    await db.appointment.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: "cancelled" } });
    return NextResponse.json({ ok: true, cancelled: rows.length });
  } catch {
    return NextResponse.json({ error: "Could not cancel the series" }, { status: 500 });
  }
}
