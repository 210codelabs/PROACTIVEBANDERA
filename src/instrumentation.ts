// Next.js server instrumentation. Runs once when the Node server starts.
// Schedules the nightly Weno pharmacy-directory auto-sync WITHOUT importing any
// node-only libraries here (that would break the instrumentation build). We
// simply ping an internal API route, which does the real (node-runtime) work.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as any;
  if (g.__wenoSchedulerStarted) return;
  g.__wenoSchedulerStarted = true;

  const port = process.env.PORT || "3000";
  const secret = process.env.AUTH_SECRET || "";

  // Boot-time: RECONCILE the Weno EZ Integration config from WENO_ONLINE_* env
  // (zero clicks after deploy). When the full core config is in env it overwrites
  // the DB so a freshly-deployed instance with its own database self-heals the
  // Weno encryption key/credentials; otherwise it only fills gaps. Retries once.
  const applyEnv = async (retry = true) => {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/internal/weno-apply-env`, {
        method: "POST",
        headers: { "x-weno-cron": secret },
      });
      const d = await r.json().catch(() => ({}));
      if (d?.changed?.length) console.log(`[weno-boot] reconciled Weno EZ Integration config from env: ${d.changed.join(", ")}`);
      else if (d?.applied?.length) console.log(`[weno-boot] applied Weno EZ Integration config from env: ${d.applied.join(", ")}`);
    } catch {
      if (retry) setTimeout(() => applyEnv(false), 30 * 1000);
    }
  };
  setTimeout(() => applyEnv(), 8 * 1000);

  // DOT MEC expiration reminders — check daily (and once ~2min after boot).
  const runDotReminders = async () => {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/internal/dot-reminders`, {
        method: "POST",
        headers: { "x-weno-cron": secret },
      });
      const d = await r.json().catch(() => ({}));
      if (d?.sent) console.log(`[dot-reminders] sent ${d.sent} MEC expiration reminder(s)`);
    } catch {
      /* retry on next daily tick */
    }
  };
  setTimeout(runDotReminders, 120 * 1000);
  setInterval(runDotReminders, 24 * 60 * 60 * 1000);
}
