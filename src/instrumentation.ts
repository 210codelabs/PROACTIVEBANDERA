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
}
