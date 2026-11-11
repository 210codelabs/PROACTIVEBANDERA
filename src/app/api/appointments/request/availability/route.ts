import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { NON_BLOCKING_STATUSES } from "@/lib/appointments";
import { clinicDayKey, clinicHHmm, clinicHoursError, practiceWallClockToDate } from "@/lib/clinic";
import { providerHoursError } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const day = new URL(req.url).searchParams.get("day") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  const dayStart = practiceWallClockToDate(day, "09:00");
  if (clinicDayKey(dayStart) !== day) return NextResponse.json({ error: "Invalid date." }, { status: 400 });

  try {
    const providers = await db.user.findMany({ where: { role: "provider", active: true }, select: { id: true, workingHours: true } });
    const endOfDay = practiceWallClockToDate(day, "20:00");
    const busy = await db.appointment.findMany({
      where: { providerId: { in: providers.map((provider) => provider.id) }, status: { notIn: NON_BLOCKING_STATUSES }, startsAt: { lt: endOfDay }, endsAt: { gt: dayStart } },
      select: { providerId: true, startsAt: true, endsAt: true },
    });
    const slots = [];
    for (let minutes = 9 * 60; minutes < 20 * 60; minutes += 30) {
      const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      const start = practiceWallClockToDate(day, time);
      const end = new Date(start.getTime() + 30 * 60000);
      const free = clinicHHmm(start) === time && start.getTime() > Date.now() && !clinicHoursError(start, end) && providers.some((provider) =>
        !providerHoursError(provider.workingHours, start, end) && !busy.some((appointment) => appointment.providerId === provider.id && appointment.startsAt < end && appointment.endsAt > start));
      slots.push({ time, available: Boolean(free) });
    }
    return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Availability is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}