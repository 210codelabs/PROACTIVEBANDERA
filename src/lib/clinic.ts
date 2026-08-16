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
