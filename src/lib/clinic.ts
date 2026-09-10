/**
 * Clinic operating parameters. The clinic runs on US Central Time and is open
 * 9:00 AM – 8:00 PM. The Node process timezone is pinned to CLINIC_TZ in
 * next.config.ts, so server-side Date methods (getHours/getMinutes/format)
 * already reflect Central Time.
 */

export const CLINIC_TZ = "America/Chicago";
export const CLINIC_TZ_LABEL = "Central Time";

export const CLINIC_OPEN_HOUR = 9; // 9:00 AM
export const CLINIC_CLOSE_HOUR = 20; // 8:00 PM

export const CLINIC_OPEN_MIN = CLINIC_OPEN_HOUR * 60; // 540
export const CLINIC_CLOSE_MIN = CLINIC_CLOSE_HOUR * 60; // 1200

// "09:00" / "20:00" for <input type="time"> min/max.
export const CLINIC_OPEN_TIME = `${String(CLINIC_OPEN_HOUR).padStart(2, "0")}:00`;
export const CLINIC_CLOSE_TIME = `${String(CLINIC_CLOSE_HOUR).padStart(2, "0")}:00`;

export const CLINIC_HOURS_LABEL = "9:00 AM – 8:00 PM Central Time";

/** Minutes since midnight (Central, when run server-side with TZ pinned). */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Validate that an appointment falls within clinic hours (Central).
 * Returns an error message to surface, or null when valid.
 * Must be called server-side (relies on the pinned process timezone).
 */
export function clinicHoursError(start: Date, end?: Date | null): string | null {
  if (!(start instanceof Date) || isNaN(start.getTime())) return "Invalid appointment time.";
  const s = minutesOfDay(start);
  if (s < CLINIC_OPEN_MIN || s >= CLINIC_CLOSE_MIN) {
    return `Appointments must start between ${CLINIC_HOURS_LABEL}.`;
  }
  if (end instanceof Date && !isNaN(end.getTime())) {
    const sameDay = end.toDateString() === start.toDateString();
    const e = minutesOfDay(end);
    if (!sameDay || e > CLINIC_CLOSE_MIN) {
      return `Appointments must end by ${CLINIC_CLOSE_HOUR - 12}:00 PM Central Time.`;
    }
  }
  return null;
}

/** Format any date in the clinic's timezone (safe on client and server). */
export function formatClinic(
  d: Date | string | number,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  locale = "en-US"
): string {
  return new Date(d).toLocaleString(locale, { timeZone: CLINIC_TZ, ...opts });
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Extract calendar parts (year/month/day/hour/minute) of a Date AS SEEN IN THE
 * CLINIC TIMEZONE, independent of the server's process TZ or the browser TZ.
 * Uses Intl with an explicit timeZone so it is always correct.
 */
export function clinicParts(d: Date | string | number): { y: number; mo: number; da: number; h: number; mi: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(d));
  const g = (t: string) => Number(parts.find((x) => x.type === t)?.value || 0);
  let h = g("hour");
  if (h === 24) h = 0; // some ICU builds emit "24" for midnight
  return { y: g("year"), mo: g("month"), da: g("day"), h, mi: g("minute") };
}

/** "YYYY-MM-DD" for a date, in the clinic timezone. */
export function clinicDayKey(d: Date | string | number): string {
  const { y, mo, da } = clinicParts(d);
  return `${y}-${pad2(mo)}-${pad2(da)}`;
}

/** "HH:mm" (24h) for a date, in the clinic timezone. */
export function clinicHHmm(d: Date | string | number): string {
  const { h, mi } = clinicParts(d);
  return `${pad2(h)}:${pad2(mi)}`;
}

/** Minutes since midnight for a date, in the clinic timezone. */
export function clinicMinutesOfDay(d: Date | string | number): number {
  const { h, mi } = clinicParts(d);
  return h * 60 + mi;
}

/** "h:mm a" (e.g. "2:30 PM") for a date, in the clinic timezone. */
export function clinicTimeLabel(d: Date | string | number): string {
  return formatClinic(d, { hour: "numeric", minute: "2-digit", hour12: true });
}
