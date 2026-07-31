import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin/auth";
import { readIntegrationsForClient, saveIntegrations, type IncomingProviderState } from "@/lib/integrations/store";

export const dynamic = "force-dynamic";

const ProviderSchema = z.object({
  enabled: z.boolean(),
  credentials: z.record(z.string()).default({}),
  subServices: z.record(z.boolean()).default({}),
  subServiceCredentials: z.record(z.record(z.string())).default({}),
  oauthConnected: z.boolean().optional(),
});

const Body = z.object({
  providers: z.record(ProviderSchema),
});

export async function GET() {
  await requireAdminSession();
  const state = await readIntegrationsForClient();
  return NextResponse.json({ state });
}

export async function PUT(req: Request) {
  await requireAdminSession();
  const body = await req.json().catch(() => ({}));
  const parse = Body.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Invalid integration payload" }, { status: 400 });
  }

  await saveIntegrations(parse.data.providers as Record<string, IncomingProviderState>);
  // Return the sanitized (secret-free) state so the client can re-sync.
  const state = await readIntegrationsForClient();
  return NextResponse.json({ ok: true, state });
}
