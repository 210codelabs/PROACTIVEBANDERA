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

  await setProviderValidation(providerKey, validation);

  return NextResponse.json({ ok: true, validation });
}
