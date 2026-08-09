/**
 * Self-healing owner admin.
 *
 * Runs on every production startup (see scripts/start.js). Guarantees the
 * practice owner can always log in — even if the database is ever reset/reseeded
 * (the built-in seed only creates the demo staff, not your personal account).
 *
 * Driven by env vars (set these in the production deployment):
 *   OWNER_ADMIN_EMAIL           e.g. ernesto@210codelabs.com
 *   OWNER_ADMIN_PASSWORD        the password to create the account with
 *   OWNER_ADMIN_RESET_PASSWORD  optional "true" -> also reset the password on
 *                               an existing account (use to recover a lockout)
 *   OWNER_ADMIN_FIRST / OWNER_ADMIN_LAST  optional display name
 *
 * Idempotent + non-destructive: it NEVER deletes data. If the account exists it
 * only ensures role=admin + active=true (and resets the password only when
 * explicitly asked), so a normal deploy won't clobber a password you changed
 * later in the UI.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

(async () => {
  const email = String(process.env.OWNER_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.OWNER_ADMIN_PASSWORD || "");
  const forceReset = process.env.OWNER_ADMIN_RESET_PASSWORD === "true";
  const first = process.env.OWNER_ADMIN_FIRST || "Owner";
  const last = process.env.OWNER_ADMIN_LAST || "Admin";

  if (!email || !password) {
    console.log("[owner-admin] OWNER_ADMIN_EMAIL/OWNER_ADMIN_PASSWORD not set -> skip");
    return;
  }

  const db = new PrismaClient();
  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 10);
      await db.user.create({
        data: { email, passwordHash, firstName: first, lastName: last, role: "admin", active: true },
      });
      console.log(`[owner-admin] created owner admin ${email}`);
    } else {
      const data = { role: "admin", active: true };
      if (forceReset) {
        data.passwordHash = await bcrypt.hash(password, 10);
      }
      await db.user.update({ where: { email }, data });
      console.log(`[owner-admin] ensured owner admin ${email}${forceReset ? " (password reset)" : ""}`);
    }
  } catch (e) {
    console.error("[owner-admin] warning (continuing): " + (e && e.message ? e.message : e));
  } finally {
    await db.$disconnect();
  }
})();
