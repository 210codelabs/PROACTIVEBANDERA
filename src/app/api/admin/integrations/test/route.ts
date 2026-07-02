import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/auth";
import { findProvider } from "@/lib/integrations/catalog";
import {
  readIntegrations,
  setProviderValidation,
  validateProviderConfig,
} from "@/lib/integrations/store";

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
  await setProviderValidation(providerKey, validation);

  return NextResponse.json({ ok: true, validation });
}
