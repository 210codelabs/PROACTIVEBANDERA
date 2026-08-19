import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { clinicHoursError } from "@/lib/clinic";
import { findConflict } from "@/lib/appointments";
import { addDays, addWeeks, addMonths, format, parseISO } from "date-fns";

// Create a repeating series of appointments in one call.
// Body: { patientId, providerId, serviceTypeId?, day (yyyy-MM-dd), time (HH:mm),
//         reason?, location?, notes?, frequency, count }
// frequency: daily | weekly | biweekly | monthly ; count: 2..26 (incl. the first)
// Each occurrence is validated against clinic hours + provider double-booking;
// invalid/conflicting dates are skipped and reported (the rest are still created).
const STEP: Record<string, (d: Date, n: number) => Date> = {
  daily: (d, n) => addDays(d, n),
  weekly: (d, n) => addWeeks(d, n),
  biweekly: (d, n) => addWeeks(d, n * 2),
  monthly: (d, n) => addMonths(d, n),
};

export async function POST(req: Request) {
  await requireSession();
  const b = await req.json().catch(() => ({}));
  const patientId = b?.patientId;
  const providerId = b?.providerId;
  const serviceTypeId = b?.serviceTypeId || null;
  const day = b?.day;
  const time = b?.time;
  const frequency = String(b?.frequency || "");
  const count = Math.max(2, Math.min(26, parseInt(String(b?.count ?? 0), 10) || 0));

  if (!patientId || !providerId || !day || !time || !frequency) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const stepFn = STEP[frequency];
  if (!stepFn) return NextResponse.json({ error: "invalid frequency" }, { status: 400 });

  let durationMin = 30;
  if (serviceTypeId) {
    const s = await db.serviceType.findUnique({ where: { id: serviceTypeId } });
    if (s) durationMin = s.durationMin;
  }

  const base = parseISO(day); // local (Central) midnight of the first occurrence
  if (isNaN(base.getTime())) return NextResponse.json({ error: "invalid date" }, { status: 400 });

  const created: string[] = [];
  const skipped: { date: string; reason: string }[] = [];
  try {
    for (let i = 0; i < count; i++) {
      const dateStr = format(stepFn(base, i), "yyyy-MM-dd");
      const start = new Date(`${dateStr}T${time}:00`);
      const end = new Date(start.getTime() + durationMin * 60000);
      const hoursErr = clinicHoursError(start, end);
      if (hoursErr) { skipped.push({ date: dateStr, reason: "outside clinic hours" }); continue; }
      const clash = await findConflict(providerId, start, end);
      if (clash) { skipped.push({ date: dateStr, reason: "double-booked" }); continue; }
      const appt = await db.appointment.create({
        data: {
          patientId,
          providerId,
          serviceTypeId,
          startsAt: start,
          endsAt: end,
          location: b?.location || "in-office",
          reason: b?.reason || null,
          notes: b?.notes || null,
          status: "scheduled",
        },
      });
      created.push(appt.id);
    }
  } catch {
    return NextResponse.json({ error: "Recurring scheduling is temporarily unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    created: created.length,
    skipped: skipped.length,
    total: count,
    details: { created, skipped },
  });
}
