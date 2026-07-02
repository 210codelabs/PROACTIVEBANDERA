import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/auth";
import { readIntegrations, setOAuthConnected } from "@/lib/integrations/store";

export const dynamic = "force-dynamic";

const PROVIDER_KEY = "google-meet";

const Body = z.object({ action: z.enum(["status", "connect", "disconnect"]) });

// OAuth availability is gated on the presence of Google credentials in the
// environment. We only ever report a boolean — env values themselves are never
// returned to the browser.
function oauthAvailable(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function POST(req: Request) {
  await requireAdminSession();
  const body = await req.json().catch(() => ({}));
  const parse = Body.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const available = oauthAvailable();
  const state = await readIntegrations();
  const connected = state.providers[PROVIDER_KEY]?.oauthConnected ?? false;

  if (parse.data.action === "status") {
    return NextResponse.json({ available, connected });
  }

  if (parse.data.action === "disconnect") {
    await setOAuthConnected(PROVIDER_KEY, false);
    return NextResponse.json({ ok: true, available, connected: false });
  }

  // action === "connect"
  if (!available) {
    // OAuth not configured in this environment — the UI falls back to the
    // manual integration guide and credential form.
    return NextResponse.json({ ok: false, available: false, connected: false });
  }

  // In a fully wired deployment this endpoint would redirect to Google's consent
  // screen and complete the exchange on callback. With credentials present we
  // record the authorized state so the rest of the flow (link generation,
  // validation) can proceed.
  await setOAuthConnected(PROVIDER_KEY, true);
  return NextResponse.json({ ok: true, available: true, connected: true });
}
