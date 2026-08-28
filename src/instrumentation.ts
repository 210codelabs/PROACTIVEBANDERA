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

  // Boot-time: auto-apply Weno Online config from WENO_ONLINE_* env (zero clicks
  // after deploy). Non-destructive; retries once if the server is still warming.
  const applyEnv = async (retry = true) => {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/internal/weno-apply-env`, {
        method: "POST",
        headers: { "x-weno-cron": secret },
      });
      const d = await r.json().catch(() => ({}));
      if (d?.applied?.length) console.log(`[weno-boot] applied Weno Online config from env: ${d.applied.join(", ")}`);
    } catch {
      if (retry) setTimeout(() => applyEnv(false), 30 * 1000);
    }
  };
  setTimeout(() => applyEnv(), 8 * 1000);

  const runCheck = async () => {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/internal/weno-autosync`, {
        method: "POST",
        headers: { "x-weno-cron": secret },
      });
      const d = await r.json().catch(() => ({}));
      if (d?.ran) console.log(`[weno-scheduler] directory auto-sync: ${d.reason}`);
    } catch {
      /* server may still be warming up; the hourly interval will retry */
    }
  };

  // First check ~90s after boot, then hourly.
  setTimeout(runCheck, 90 * 1000);
  setInterval(runCheck, 60 * 60 * 1000);

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
