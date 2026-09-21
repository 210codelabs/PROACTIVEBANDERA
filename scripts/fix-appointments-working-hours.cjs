/**
 * Correct existing appointments so they fall within clinic working hours
 * (09:00–20:00 America/Chicago). Off-hours appointments are moved to the
 * nearest open slot on the SAME Central day (no double-booking with the same
 * provider). Timezone-explicit (America/Chicago), independent of server TZ.
 *
 * Usage:
 *   node scripts/fix-appointments-working-hours.cjs           # dry run
 *   node scripts/fix-appointments-working-hours.cjs --apply   # write changes
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const TZ = "America/Chicago";
const OPEN = 9 * 60, CLOSE = 20 * 60, STEP = 15;
const APPLY = process.argv.includes("--apply");

function parts(d) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(d));
  const g = (t) => Number(p.find((x) => x.type === t)?.value || 0);
  let h = g("hour"); if (h === 24) h = 0;
  return { y: g("year"), mo: g("month"), da: g("da" + "y") || g("day"), h, mi: g("minute") };
}
function dayKey(d) { const { y, mo, da } = parts(d); return `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`; }
function minOfDay(d) { const { h, mi } = parts(d); return h * 60 + mi; }
function wallToDate(day, min) {
  const [y, mo, da] = day.split("-").map(Number);
  const h = Math.floor(min / 60), mi = min % 60;
  const guess = Date.UTC(y, mo - 1, da, h, mi, 0);
  const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(guess));
  const g = (t) => Number(p.find((x) => x.type === t)?.value || 0);
  let hh = g("hour"); if (hh === 24) hh = 0;
  const asTz = Date.UTC(g("year"), g("month") - 1, g("day"), hh, g("minute"), g("second"));
  return new Date(guess - (asTz - guess));
}

(async () => {
  const rows = await db.appointment.findMany({ select: { id: true, providerId: true, startsAt: true, endsAt: true, status: true } });
  const offHours = [];
  for (const r of rows) {
    const m = minOfDay(r.startsAt);
    const dur = Math.max(15, Math.round((new Date(r.endsAt) - new Date(r.startsAt)) / 60000));
    const endM = m + dur;
    if (m < OPEN || m >= CLOSE || endM > CLOSE) offHours.push({ ...r, m, dur });
  }
  console.log(`Total: ${rows.length} | off-hours to correct: ${offHours.length} | mode: ${APPLY ? "APPLY" : "DRY RUN"}`);

  let fixed = 0;
  const runtimeBusy = {}; // key `${providerId}|${day}` -> [{s,e}] of newly assigned slots
  for (const a of offHours) {
    const day = dayKey(a.startsAt);
    const rbKey = `${a.providerId}|${day}`;
    // busy intervals for this provider on this Central day (exclude self, exclude cancelled/no-show)
    const sameDay = rows.filter((r) => r.id !== a.id && r.providerId === a.providerId && dayKey(r.startsAt) === day && !["cancelled", "no-show"].includes(r.status));
    const busy = sameDay.map((r) => ({ s: minOfDay(r.startsAt), e: minOfDay(r.startsAt) + Math.max(15, Math.round((new Date(r.endsAt) - new Date(r.startsAt)) / 60000)) }));
    // include only in-range existing slots as blockers, plus any already-corrected ones this run
    const blockers = busy.filter((b) => b.e > OPEN && b.s < CLOSE).concat(runtimeBusy[rbKey] || []);
    const fits = (start) => start >= OPEN && start + a.dur <= CLOSE && !blockers.some((b) => start < b.e && start + a.dur > b.s);
    // preferred target: clamp original into range
    let target = Math.min(Math.max(a.m, OPEN), CLOSE - a.dur);
    target = Math.round(target / STEP) * STEP;
    let chosen = null;
    for (let off = 0; off <= (CLOSE - OPEN); off += STEP) {
      if (fits(target + off)) { chosen = target + off; break; }
      if (fits(target - off)) { chosen = target - off; break; }
    }
    if (chosen == null) { console.log(`  ! ${a.id}: day ${day} full, left unchanged`); continue; }
    const newStart = wallToDate(day, chosen);
    const newEnd = new Date(newStart.getTime() + a.dur * 60000);
    const oldHH = `${String(Math.floor(a.m / 60)).padStart(2, "0")}:${String(a.m % 60).padStart(2, "0")}`;
    const newHH = `${String(Math.floor(chosen / 60)).padStart(2, "0")}:${String(chosen % 60).padStart(2, "0")}`;
    console.log(`  ${a.id}: ${day} ${oldHH} -> ${newHH} (${a.dur}m)`);
    if (APPLY) { await db.appointment.update({ where: { id: a.id }, data: { startsAt: newStart, endsAt: newEnd } }); }
    (runtimeBusy[rbKey] = runtimeBusy[rbKey] || []).push({ s: chosen, e: chosen + a.dur });
    fixed++;
  }
  console.log(`${APPLY ? "Corrected" : "Would correct"}: ${fixed}`);
  await db.$disconnect();
})();
