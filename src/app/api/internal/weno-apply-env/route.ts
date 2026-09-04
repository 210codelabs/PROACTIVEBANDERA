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
    return NextResponse.json({ ok: true, applied: [], changed: [], reason: "no WENO_ONLINE_* env set" });
  }
  try {
    const enablable = wenoOnlineEnvEnablable();
    // RECONCILE-ON-BOOT: when the full core config is present in the environment
    // (key + email + password + location), overwrite the DB-backed Weno Online
    // config to MATCH env. This makes a freshly-deployed instance with its own
    // SEPARATE database self-heal to the correct credentials on startup — fixing
    // the "Encryption key is wrong. Decryption failed." error caused by a stale
    // key left in a production database. With only a partial env, stay
    // non-destructive and just fill gaps (onlyIfEmpty).
    const { applied, changed } = await upsertProviderCredentials("weno-online", creds, {
      enable: enablable || undefined,
      editedBy: "auto-apply on boot (env)",
      onlyIfEmpty: !enablable,
    });
    return NextResponse.json({ ok: true, applied, changed, reconciled: enablable });
  } catch (e: any) {
    return NextResponse.json({ ok: false, applied: [], changed: [], error: String(e?.message || e).slice(0, 200) }, { status: 200 });
  }
}
