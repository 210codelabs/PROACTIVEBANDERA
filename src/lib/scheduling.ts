import { db } from "@/lib/db";
import { CLINIC_OPEN_MIN, CLINIC_CLOSE_MIN, clinicMinutesOfDay, clinicWeekday, clinicDayKey, practiceWallClockToDate } from "@/lib/clinic";
import { NON_BLOCKING_STATUSES } from "@/lib/appointments";

// Per-provider working hours. Minutes-of-day (Central). If a provider has no
// configured hours we fall back to the clinic-wide default (every day open
// 9:00 AM – 8:00 PM), which preserves the previous scheduling behavior.
export type DayHours = { open: number; close: number; closed?: boolean };
export type WorkingHours = Record<string, DayHours>; // key "0"(Sun)…"6"(Sat)

export const SLOT_STEP_MIN = 30;

export const DEFAULT_DAY: DayHours = { open: CLINIC_OPEN_MIN, close: CLINIC_CLOSE_MIN, closed: false };

export type Busy = { s: number; e: number };

function coerceHours(raw: unknown): WorkingHours | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as WorkingHours;
}

/** Resolve a provider's open/close window (minutes) for a given date's weekday. */
export function resolveDayHours(workingHours: unknown, date: Date): DayHours {
  const wh = coerceHours(workingHours);
  const dow = String(clinicWeekday(date));
  const d = wh?.[dow];
  if (!d) return { ...DEFAULT_DAY };
  const open = typeof d.open === "number" ? d.open : DEFAULT_DAY.open;
  const close = typeof d.close === "number" ? d.close : DEFAULT_DAY.close;
  return { open, close, closed: Boolean(d.closed) };
}

/**
 * Validate that [start, end) falls within the provider's working hours/day.
 * Returns an error message to surface, or null when valid. Timezone-explicit
 * (America/Chicago) so it is correct regardless of server/browser TZ.
 */
export function providerHoursError(workingHours: unknown, start: Date, end: Date): string | null {
  if (!(start instanceof Date) || isNaN(start.getTime())) return "Invalid appointment time.";
  const hours = resolveDayHours(workingHours, start);
  if (hours.closed) return "The provider is not available on that day.";
  const s = clinicMinutesOfDay(start);
  const e = clinicDayKey(end) === clinicDayKey(start) ? clinicMinutesOfDay(end) : hours.close + 1;
  if (s < hours.open || s >= hours.close || e > hours.close) {
    const lbl = (m: number) => {
      const hh = Math.floor(m / 60), mm = m % 60;
      const h12 = ((hh + 11) % 12) + 1;
      return `${h12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
    };
    return `Outside the provider's working hours (${lbl(hours.open)}–${lbl(hours.close)}).`;
  }
  return null;
}

/** All busy minute-intervals for a provider on a given yyyy-MM-dd (Central). */
export async function getBusyIntervals(providerId: string, dayStr: string, excludeId?: string): Promise<Busy[]> {
  const dayStart = practiceWallClockToDate(dayStr, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000 - 1);
  const rows = await db.appointment.findMany({
    where: {
      providerId,
      status: { notIn: NON_BLOCKING_STATUSES },
      startsAt: { gte: dayStart, lte: dayEnd },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { startsAt: true, endsAt: true },
  }).catch(() => []);
  return rows.map((r) => ({ s: clinicMinutesOfDay(r.startsAt), e: clinicMinutesOfDay(r.endsAt) }));
}

function overlaps(startMin: number, durationMin: number, busy: Busy[]): boolean {
  const endMin = startMin + durationMin;
  return busy.some((b) => startMin < b.e && endMin > b.s);
}

function minToTime(m: number): string {
  const hh = Math.floor(m / 60), mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function minToLabel(m: number): string {
  const hh = Math.floor(m / 60), mm = m % 60;
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
}

export type Slot = { time: string; label: string; free: boolean; min: number };

/** Build the day's slot grid for a provider, marking each slot free/taken. */
export async function listOpenSlots(
  providerId: string,
  dayStr: string,
  durationMin: number,
  workingHours: unknown,
  excludeId?: string,
): Promise<{ hours: DayHours; slots: Slot[]; busy: Busy[] }> {
  const date = practiceWallClockToDate(dayStr, "12:00");
  const hours = resolveDayHours(workingHours, date);
  const busy = await getBusyIntervals(providerId, dayStr, excludeId);
  const slots: Slot[] = [];
  if (!hours.closed) {
    for (let m = hours.open; m + durationMin <= hours.close; m += SLOT_STEP_MIN) {
      slots.push({ time: minToTime(m), label: minToLabel(m), free: !overlaps(m, durationMin, busy), min: m });
    }
  }
  return { hours, slots, busy };
}

/**
 * Closest open slot to `preferredMin` on the same day (used when a drag lands on
 * a conflicting/out-of-hours time — assign the next available/closest opening).
 * Returns the "HH:mm" string or null if the day is full/closed.
 */
export async function nextAvailableSlot(
  providerId: string,
  dayStr: string,
  durationMin: number,
  preferredMin: number,
  workingHours: unknown,
  excludeId?: string,
): Promise<string | null> {
  const { slots } = await listOpenSlots(providerId, dayStr, durationMin, workingHours, excludeId);
  const free = slots.filter((s) => s.free);
  if (free.length === 0) return null;
  free.sort((a, b) => {
    const da = Math.abs(a.min - preferredMin), db_ = Math.abs(b.min - preferredMin);
    if (da !== db_) return da - db_;
    return a.min - b.min; // tie-break: earlier/later toward later same distance -> earlier
  });
  return free[0].time;
}

/** First N free slots at/after `fromMin` (defaults to day open) — for suggestions. */
export function pickSuggestions(slots: Slot[], count = 5, fromMin = 0): { time: string; label: string }[] {
  return slots.filter((s) => s.free && s.min >= fromMin).slice(0, count).map((s) => ({ time: s.time, label: s.label }));
}
