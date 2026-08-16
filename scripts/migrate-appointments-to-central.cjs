/**
 * ONE-TIME migration: reinterpret existing appointment timestamps as US Central.
 *
 * Background: appointments were created while the server ran in UTC, so a time
 * entered as "09:00" was stored as 09:00Z. Now that the app runs in
 * America/Chicago, we shift each stored instant so its wall-clock time in
 * Central equals the wall-clock time it was originally entered as.
 *
 * Idempotent: writes an AuditLog marker (action="tz.migrate.central") and
 * refuses to run twice.
 *
 * Run:  TZ=America/Chicago node scripts/migrate-appointments-to-central.cjs
 */
process.env.TZ = "America/Chicago";

const fs = require("node:fs");

// Load DATABASE_URL from /app/.env (preview loads this the same way Next does).
try {
  const raw = fs.readFileSync("/app/.env", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch (e) {
  console.error("Could not read /app/.env:", e.message);
}

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

// Given a Date, return a new Date whose LOCAL (Central) wall-clock equals the
// original's UTC wall-clock components.
function utcWallClockToCentral(d) {
  if (!d) return d;
  const x = new Date(d);
  return new Date(
    x.getUTCFullYear(),
    x.getUTCMonth(),
    x.getUTCDate(),
    x.getUTCHours(),
    x.getUTCMinutes(),
    x.getUTCSeconds(),
    0
  );
}

async function main() {
  const marker = await db.auditLog.findFirst({ where: { action: "tz.migrate.central" } }).catch(() => null);
  if (marker) {
    console.log("Already migrated (marker present). Aborting to avoid a double shift.");
    return;
  }

  const appts = await db.appointment.findMany({ select: { id: true, startsAt: true, endsAt: true } });
  console.log(`Found ${appts.length} appointments to reinterpret as Central Time.`);

  let updated = 0;
  for (const a of appts) {
    const newStart = utcWallClockToCentral(a.startsAt);
    const newEnd = a.endsAt ? utcWallClockToCentral(a.endsAt) : null;
    await db.appointment.update({
      where: { id: a.id },
      data: { startsAt: newStart, ...(newEnd ? { endsAt: newEnd } : {}) },
    });
    updated += 1;
    if (a.startsAt) {
      console.log(`  ${a.id}: ${new Date(a.startsAt).toISOString()} -> ${newStart.toISOString()} (${newStart.toString()})`);
    }
  }

  // Also shift AppointmentRequest.scheduledStartsAt if present (these mirror appointments).
  const reqs = await db.appointmentRequest.findMany({ where: { scheduledStartsAt: { not: null } }, select: { id: true, scheduledStartsAt: true } }).catch(() => []);
  let reqUpdated = 0;
  for (const r of reqs) {
    await db.appointmentRequest.update({ where: { id: r.id }, data: { scheduledStartsAt: utcWallClockToCentral(r.scheduledStartsAt) } });
    reqUpdated += 1;
  }

  await db.auditLog.create({
    data: {
      userId: null,
      action: "tz.migrate.central",
      resource: "System",
      resourceId: "appointments",
      meta: JSON.stringify({ appointments: updated, appointmentRequests: reqUpdated, tz: "America/Chicago", at: new Date().toISOString() }),
    },
  });

  console.log(`Done. Reinterpreted ${updated} appointments and ${reqUpdated} scheduled requests as Central Time.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); });
