// Plain shared module (NOT a "use client" module) so the server schedule page
// AND the client calendar components can both import the reschedule helper,
// the shared serializable appointment type, and the grid constants.
//
// Important: all time-of-day positioning is computed on the SERVER (which is
// pinned to America/Chicago) and passed down as `top`/`height`/labels, so the
// calendar renders identically no matter what timezone the browser is in.

export type CalAppt = {
  id: string;
  patientId: string;
  providerId: string;
  status: string;
  pFirst: string;
  pLast: string;
  provLast: string;
  svcName: string | null;
  svcCat: string | null;
  reason: string | null;
  dayKey: string;      // yyyy-MM-dd (Central)
  timeHHmm: string;    // HH:mm (Central) start time
  startLabel: string;  // e.g. "9:00 AM"
  endLabel: string;    // e.g. "9:30 AM"
  top: number;         // px offset in the day/staff time grid
  height: number;      // px height in the day/staff time grid
  slotIndex: number;   // which 30-min slot the appt starts in
};

// Clinic-hours time grid (9:00 AM – 8:00 PM Central) shared by day & staff views.
export const GRID_START_HOUR = 9;
export const GRID_SLOTS = 22; // 30-min slots: 9:00 → 20:00
export const SLOT_PX = 64;    // must match Tailwind h-16 (4rem)

export type PatchArgs = { id: string; day?: string; time?: string; providerId?: string };

// Single reschedule/move helper used by every draggable view. Hits the already
// tested PATCH /api/appointments (preserves duration, enforces clinic hours).
export async function patchAppointment(args: PatchArgs): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d?.error) return { ok: false, error: d?.error || "Reschedule failed" };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

// Build the fixed Central time-slot labels for the day/staff grids.
export function buildSlotList(): { i: number; hhmm: string; label: string }[] {
  return Array.from({ length: GRID_SLOTS }, (_, i) => {
    const total = GRID_START_HOUR * 60 + i * 30;
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    const hhmm = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const h12 = ((hh + 11) % 12) + 1;
    const ampm = hh < 12 ? "AM" : "PM";
    const label = `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
    return { i, hhmm, label };
  });
}

export const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-slate-400",
  "checked-in": "bg-amber-500",
  "in-room": "bg-violet-500",
  completed: "bg-emerald-500",
  "no-show": "bg-rose-500",
  cancelled: "bg-slate-300",
};
