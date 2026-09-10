import { NextResponse } from "next/server";
import { upsertProviderCredentials, pruneLegacyWenoStore } from "@/lib/integrations/store";
import { collectWenoOnlineEnv, wenoOnlineEnvEnablable } from "@/lib/wenoEnv";

export const runtime = "nodejs";

// Internal boot-time hook (pinged by src/instrumentation.ts). Auto-applies the
// Weno EZ Integration config from WENO_ONLINE_* env vars so production needs ZERO clicks
// after a deploy. Non-destructive: only fills fields that are currently empty
// (never overwrites values an admin edited in the UI). Secret-guarded.
export async function POST(req: Request) {
  const secret = process.env.AUTH_SECRET || "";
  if (!secret || req.headers.get("x-weno-cron") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const creds = collectWenoOnlineEnv();
  // Always self-heal the store: drop the retired Weno Exchange provider record
  // and clear any stale Weno Online/Exchange validation text (idempotent).
  const pruned = await pruneLegacyWenoStore();
  if (Object.keys(creds).length === 0) {
    return NextResponse.json({ ok: true, applied: [], changed: [], pruned, reason: "no WENO_ONLINE_* env set" });
  }
  try {
    const enablable = wenoOnlineEnvEnablable();
    // SOURCE OF TRUTH = Admin Ops Settings (DB). The environment is only used to
    // FILL EMPTY fields (fresh deploy with an empty DB). We deliberately do NOT
    // overwrite values an admin already saved in the UI — otherwise a stale env
    // var (e.g. an old admin email/key) would silently revert a working config
    // on every redeploy. Fresh/empty DB still gets fully populated from env.
    const { applied, changed } = await upsertProviderCredentials("weno-online", creds, {
      enable: enablable || undefined,
      editedBy: "auto-apply on boot (env, fill-empty only)",
      onlyIfEmpty: true,
    });
    return NextResponse.json({ ok: true, applied, changed, reconciled: false, pruned });
  } catch (e: any) {
    return NextResponse.json({ ok: false, applied: [], changed: [], error: String(e?.message || e).slice(0, 200) }, { status: 200 });
  }
}
