import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { upsertProviderCredentials } from "@/lib/integrations/store";
import { collectWenoOnlineEnv, wenoOnlineEnvEnablable } from "@/lib/wenoEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/weno/online/apply-env — admin one-click: populate the DB-backed
// Weno EZ Integration config from this server's WENO_ONLINE_* environment variables.
// Keeps secrets in the environment (never hand-typed / never echoed).
export async function POST() {
  const u = await getSession();
  if (!u || u.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const creds = collectWenoOnlineEnv();
  if (Object.keys(creds).length === 0) {
    return NextResponse.json(
      { error: "No WENO_ONLINE_* environment variables are set on this server. Add them to the environment (at minimum WENO_ONLINE_KEY, WENO_ONLINE_EMAIL, WENO_ONLINE_PASSWORD, WENO_ONLINE_LOCATION), then click Apply." },
      { status: 400 },
    );
  }

  // Manual apply = explicit admin intent: overwrite from env (not onlyIfEmpty).
  const { applied } = await upsertProviderCredentials("weno-online", creds, {
    enable: wenoOnlineEnvEnablable() || undefined,
    editedBy: `apply-env by ${(u as any).email || u.id}`,
  });
  return NextResponse.json({ ok: true, applied });
}
