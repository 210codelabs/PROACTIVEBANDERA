import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/site/config";

export const dynamic = "force-dynamic";

// GET /api/site-config/public — PUBLIC, non-sensitive subset of the deployment
// config (identity, colors, logos, slides). Whitelisted in middleware so public
// surfaces like the lobby kiosk can brand themselves. No modules/setup flags.
export async function GET() {
  const c = await getSiteConfig();
  return NextResponse.json({
    identity: c.identity,
    colors: c.colors,
    logos: c.logos,
    slides: c.slides,
  });
}
