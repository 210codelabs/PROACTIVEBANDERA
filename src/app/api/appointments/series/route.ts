import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { addWeeks, addMonths, format } from "date-fns";
import { clinicHoursError, minutesOfDay } from "@/lib/clinic";
import { findConflict } from "@/lib/appointments";
import { providerHoursError, nextAvailableSlot } from "@/lib/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/appointments/series
// Body: { patientId, providerId, serviceTypeId?, day, time, reason?, location?,
//         freq: 'weekly'|'biweekly'|'monthly', occurrences: number,
//         autoShift?, allowDoubleBook? }
// Creates a recurring series in one step. Each occurrence respects the provider's
// working hours; with autoShift a clashing occurrence snaps to the nearest open
// slot that day, otherwise a clashing occurrence is skipped (reported back).
export async function POST(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));
  const { patientId, providerId, day, time } = b;
  if (!patientId || !providerId || !day || !time) {
    return NextResponse.json({ error: "patientId, providerId, day and time are required" }, { status: 400 });
  }
  const freq = ["weekly", "biweekly", "monthly"].includes(b.freq) ? b.freq : "weekly";
  const occurrences = Math.max(2, Math.min(26, Number(b.occurrences) || 4));
  const autoShift = Boolean(b.autoShift);
  const allowDoubleBook = Boolean(b.allowDoubleBook);

  try {
    let durationMin = 30;
    if (b.serviceTypeId) {
      const s = await db.serviceType.findUnique({ where: { id: b.serviceTypeId } });
      if (s) durationMin = s.durationMin;
    }
    const provider = await db.user.findUnique({ where: { id: providerId }, select: { workingHours: true } });

    const base = new Date(`${day}T${time}:00`);
    if (isNaN(base.getTime())) return NextResponse.json({ error: "Invalid start date/time" }, { status: 400 });

    const created: { id: string; day: string; time: string; shifted: boolean }[] = [];
    const skipped: { day: string; reason: string }[] = [];

    for (let i = 0; i < occurrences; i++) {
      const occ = freq === "monthly" ? addMonths(base, i) : addWeeks(base, freq === "biweekly" ? i * 2 : i);
      const dayStr = format(occ, "yyyy-MM-dd");
      let start = new Date(`${dayStr}T${time}:00`);
      let end = new Date(start.getTime() + durationMin * 60000);
      let shifted = false;

      const hoursBad = () => clinicHoursError(start, end) || providerHoursError(provider?.workingHours, start, end);
      let conflict = await findConflict(providerId, start, end);

      if ((hoursBad() || (conflict && !allowDoubleBook))) {
        if (autoShift) {
          const alt = await nextAvailableSlot(providerId, dayStr, durationMin, minutesOfDay(start), provider?.workingHours);
          if (alt) {
            start = new Date(`${dayStr}T${alt}:00`);
            end = new Date(start.getTime() + durationMin * 60000);
            shifted = true;
            conflict = await findConflict(providerId, start, end);
          }
        }
      }

      const hErr = hoursBad();
      if (hErr) { skipped.push({ day: dayStr, reason: hErr }); continue; }
      if (conflict && !allowDoubleBook) { skipped.push({ day: dayStr, reason: "Time already booked" }); continue; }

      const appt = await db.appointment.create({
        data: {
          patientId, providerId,
          serviceTypeId: b.serviceTypeId || null,
          startsAt: start, endsAt: end,
          location: b.location || "in-office",
          reason: b.reason || null,
          status: "scheduled",
        },
      });
      created.push({ id: appt.id, day: dayStr, time: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`, shifted });
    }

    return NextResponse.json({
      ok: true,
      createdCount: created.length,
      shiftedCount: created.filter((c) => c.shifted).length,
      skippedCount: skipped.length,
      created, skipped,
    });
  } catch {
    return NextResponse.json({ error: "Could not create the recurring series" }, { status: 500 });
  }
}
