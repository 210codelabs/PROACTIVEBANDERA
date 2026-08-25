import { NextResponse } from "next/server";
import { upsertProviderCredentials } from "@/lib/integrations/store";
import { collectWenoOnlineEnv, wenoOnlineEnvEnablable } from "@/lib/wenoEnv";

export const runtime = "nodejs";

// Internal boot-time hook (pinged by src/instrumentation.ts). Auto-applies the
// Weno Online config from WENO_ONLINE_* env vars so production needs ZERO clicks
// after a deploy. Non-destructive: only fills fields that are currently empty
// (never overwrites values an admin edited in the UI). Secret-guarded.
export async function POST(req: Request) {
  const secret = process.env.AUTH_SECRET || "";
  if (!secret || req.headers.get("x-weno-cron") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const creds = collectWenoOnlineEnv();
  if (Object.keys(creds).length === 0) {
    return NextResponse.json({ ok: true, applied: [], reason: "no WENO_ONLINE_* env set" });
  }
  try {
    const { applied } = await upsertProviderCredentials("weno-online", creds, {
      enable: wenoOnlineEnvEnablable() || undefined,
      editedBy: "auto-apply on boot (env)",
      onlyIfEmpty: true,
    });
    return NextResponse.json({ ok: true, applied });
  } catch (e: any) {
    return NextResponse.json({ ok: false, applied: [], error: String(e?.message || e).slice(0, 200) }, { status: 200 });
  }
}
