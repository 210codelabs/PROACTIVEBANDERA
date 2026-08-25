import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { upsertProviderCredentials } from "@/lib/integrations/store";
import { collectWenoOnlineEnv } from "@/lib/wenoEnv";
import {
  WENO_ONLINE_TEST_DEFAULTS,
  WENO_EXCHANGE_TEST_DEFAULTS,
  wenoExchangeDefaultsEnablable,
} from "@/lib/wenoDefaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/weno/populate-test — admin one-click: load the preconfigured
// Weno TEST credentials into the DB-backed integration store so the eRx flow can
// be tested in ANY environment (even production with no WENO_* env vars set).
// Environment variables, if present, take precedence over the baked defaults.
export async function POST() {
  const u = await getSession();
  if (!u || u.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const editedBy = `populate-test by ${(u as any).email || u.id}`;

  // --- Weno Online: defaults, then override with any env vars that exist.
  const onlineCreds: Record<string, string> = { ...WENO_ONLINE_TEST_DEFAULTS, ...collectWenoOnlineEnv() };
  const onlineReady = Boolean(
    onlineCreds.EHR_ENCRYPTION_KEY &&
      onlineCreds.PROVIDER_EMAIL &&
      onlineCreds.PROVIDER_PASSWORD &&
      onlineCreds.LOCATION_ID,
  );
  const { applied: onlineApplied } = await upsertProviderCredentials("weno-online", onlineCreds, {
    enable: onlineReady || undefined,
    editedBy,
  });

  // --- Weno Exchange: only what we have (enable only if partner creds present).
  const exchangeReady = wenoExchangeDefaultsEnablable();
  const { applied: exchangeApplied } = await upsertProviderCredentials("weno", WENO_EXCHANGE_TEST_DEFAULTS, {
    enable: exchangeReady || undefined,
    editedBy,
  });

  return NextResponse.json({
    ok: true,
    online: { applied: onlineApplied, enabled: onlineReady },
    exchange: { applied: exchangeApplied, enabled: exchangeReady },
  });
}
