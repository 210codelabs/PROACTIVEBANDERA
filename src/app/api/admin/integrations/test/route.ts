import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/auth";
import { findProvider } from "@/lib/integrations/catalog";
import {
  readIntegrations,
  setProviderValidation,
  validateProviderConfig,
} from "@/lib/integrations/store";
import { stediPing } from "@/lib/stedi";
import { getWenoOnlineConfig, buildComposeRxUrl } from "@/lib/wenoOnline";

export const dynamic = "force-dynamic";

const Body = z.object({ providerKey: z.string() });

// Test Connection / Validate. Runs a health-check against the STORED credentials
// for one provider so secrets never have to travel back from the browser. In a
// production build this is where the real call to the provider's auth or
// health-check endpoint would go; here it deterministically verifies that the
// configuration is complete and consistent and reports per-sub-service status.
export async function POST(req: Request) {
  await requireAdminSession();
  const body = await req.json().catch(() => ({}));
  const parse = Body.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "providerKey is required" }, { status: 400 });
  }

  const { providerKey } = parse.data;
  const provider = findProvider(providerKey);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const state = await readIntegrations();
  const providerState = state.providers[providerKey];
  if (!providerState?.enabled) {
    return NextResponse.json({ error: "Enable and save the provider before testing." }, { status: 409 });
  }

  const validation = validateProviderConfig(providerKey, providerState);

  // For Stedi, when the config is complete, perform a REAL connectivity test
  // against the payers API so the admin gets true "connected" confirmation.
  if (providerKey === "stedi" && validation.status === "success") {
    try {
      await stediPing(providerState.credentials.API_KEY || undefined);
      validation.message = "Live connection to Stedi verified (payers API reachable with your key).";
    } catch (e: any) {
      const status = e?.status;
      validation.status = "error";
      validation.message =
        status === 401 || status === 403
          ? "Stedi rejected the API key (unauthorized). Double-check the key and its environment."
          : `Could not reach Stedi: ${String(e?.message || e).slice(0, 200)}`;
    }
    validation.checkedAt = new Date().toISOString();
  }

  // For Weno EZ Integration (ComposeRx launch), there is no server-to-server
  // auth call we can make without a browser session. Instead we verify the
  // config is complete and that the EHR Encryption Key + crypto actually produce
  // a valid launch URL for a synthetic patient. True end-to-end verification
  // happens by launching ComposeRx in the browser during Weno certification.
  if (providerKey === "weno-online" && validation.status === "success") {
    try {
      const cfg = await getWenoOnlineConfig();
      const { url } = buildComposeRxUrl(
        cfg,
        { id: "TEST", firstName: "Test", lastName: "Patient", gender: "U", dob: "1990-01-01" },
        {},
      );
      const host = (() => { try { return new URL(url).host; } catch { return cfg.composeBase; } })();
      validation.message = `Configuration valid — encrypted launch URL builds successfully for ${cfg.environment} (${host}). Note: actual prescribing is confirmed by launching Weno EZ Integration (ComposeRx) in the browser; production requires Weno certification + IP allowlisting.`;
    } catch (e: any) {
      validation.status = "error";
      validation.message = `Could not build a Weno EZ Integration launch URL: ${String(e?.message || e).slice(0, 200)}`;
    }
    validation.checkedAt = new Date().toISOString();
  }

  await setProviderValidation(providerKey, validation);

  return NextResponse.json({ ok: true, validation });
}
