import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runWenoDailySync, getWenoSyncStatus } from "@/lib/weno/dailySync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET/POST /api/cron/weno-sync
// Runs the Weno national directory sync. Intended to be hit once daily by any
// scheduler. Auth: either an admin session, OR ?key=<CRON_SECRET> when the
// CRON_SECRET env var is configured.
// Query: ?mode=full  -> full national replace (slower); default is incremental.
async function handle(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || req.headers.get("x-cron-key") || "";
  const secret = process.env.CRON_SECRET || "";

  let authed = false;
  if (secret && key && key === secret) authed = true;
  if (!authed) {
    const s = await getSession().catch(() => null);
    if (s && (s as any).role === "admin") authed = true;
  }
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mode = url.searchParams.get("mode");
  try {
    if (mode === "full") {
      const result = await runWenoDailySync({ force: true, mode: "full" });
      const status = await getWenoSyncStatus();
      return NextResponse.json({ ok: true, mode: "full", result, status });
    }
    // Explicit trigger: auto-selects full-repair when sparse, else incremental.
    const result = await runWenoDailySync({ force: true });
    const status = await getWenoSyncStatus();
    return NextResponse.json({ ok: true, mode: "auto", ran: result != null, result, status });
  } catch (e: unknown) {
    return NextResponse.json({ error: String((e as Error)?.message || e).slice(0, 300) }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
