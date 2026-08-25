import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { upsertProviderCredentials } from "@/lib/integrations/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Maps Weno Online integration fields <- server environment variables. Lets an
// admin populate the DB-backed Weno Online config in ONE CLICK after a deploy
// (production is a separate DB), keeping secrets in the environment rather than
// hand-typed into the form each time.
const ENV_MAP: Record<string, string> = {
  EHR_ENCRYPTION_KEY: "WENO_ONLINE_KEY",
  ENVIRONMENT: "WENO_ONLINE_ENV",
  PROVIDER_EMAIL: "WENO_ONLINE_EMAIL",
  PROVIDER_PASSWORD: "WENO_ONLINE_PASSWORD",
  LOCATION_ID: "WENO_ONLINE_LOCATION",
  WENO_USER_ID: "WENO_ONLINE_USER_ID",
  PRESCRIBER_NPI: "WENO_ONLINE_NPI",
  PRESCRIBER_DEA: "WENO_ONLINE_DEA",
  PRESCRIBER_FIRST_NAME: "WENO_ONLINE_FIRST",
  PRESCRIBER_LAST_NAME: "WENO_ONLINE_LAST",
};

export async function POST() {
  const u = await getSession();
  if (!u || u.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const creds: Record<string, string> = {};
  for (const [field, envKey] of Object.entries(ENV_MAP)) {
    const v = process.env[envKey];
    if (v != null && String(v).trim() !== "") creds[field] = String(v).trim();
  }
  if (Object.keys(creds).length === 0) {
    return NextResponse.json(
      { error: "No WENO_ONLINE_* environment variables are set on this server. Add them to the environment (at minimum WENO_ONLINE_KEY, WENO_ONLINE_EMAIL, WENO_ONLINE_PASSWORD, WENO_ONLINE_LOCATION), then click Apply." },
      { status: 400 },
    );
  }

  const { applied } = await upsertProviderCredentials("weno-online", creds, {
    enable: true,
    editedBy: `apply-env by ${(u as any).email || u.id}`,
  });
  // Never echo secret values — only which fields were applied.
  return NextResponse.json({ ok: true, applied });
}
