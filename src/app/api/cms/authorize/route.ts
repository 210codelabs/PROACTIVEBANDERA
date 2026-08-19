import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { bbConfig, pkce, randomState, authorizeRedirect, appUrl } from "@/lib/cms/bluebutton";

export const runtime = "nodejs";

// GET /api/cms/authorize?patientId=... -> begins CMS Blue Button OAuth (PKCE).
export async function GET(req: Request) {
  await requireSession();
  const cfg = bbConfig();
  const patientId = new URL(req.url).searchParams.get("patientId") || "";
  const back = patientId ? `/patients/${patientId}/medications` : "/patients";

  if (!cfg.configured) {
    return NextResponse.redirect(appUrl(`${back}?bb=notconfigured`));
  }

  const { verifier, challenge } = pkce();
  const state = randomState();
  const jar = await cookies();
  jar.set("cms_oauth", JSON.stringify({ state, verifier, patientId }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeRedirect(cfg, state, challenge));
}
