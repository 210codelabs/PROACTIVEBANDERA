import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bbConfig, exchangeToken, fetchPatientData, appUrl } from "@/lib/cms/bluebutton";

export const runtime = "nodejs";

// GET /api/cms/callback?code=&state= -> exchanges code, imports claims+coverage.
export async function GET(req: Request) {
  const user = await requireSession();
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const oauthErr = url.searchParams.get("error");

  const jar = await cookies();
  const raw = jar.get("cms_oauth")?.value;
  jar.delete("cms_oauth");
  let saved: { state?: string; verifier?: string; patientId?: string } | null = null;
  try { saved = raw ? JSON.parse(raw) : null; } catch { saved = null; }
  const patientId = saved?.patientId || "";
  const back = patientId ? `/patients/${patientId}/medications` : "/patients";

  if (oauthErr) return NextResponse.redirect(appUrl(`${back}?bb=error&msg=${encodeURIComponent(oauthErr)}`));
  if (!code || !state || !saved || state !== saved.state || !saved.verifier) {
    return NextResponse.redirect(appUrl(`${back}?bb=error&msg=state_mismatch`));
  }

  const cfg = bbConfig();
  try {
    const tok = await exchangeToken(cfg, code, saved.verifier);
    const bbPatientId = String(tok.patient || "");
    const data = await fetchPatientData(cfg, tok.access_token, bbPatientId);
    await db.cmsImport.create({
      data: {
        patientId,
        env: cfg.env,
        fhirPatientId: bbPatientId || null,
        coverage: (data.coverage as unknown) as object,
        claims: (data.claims as unknown) as object,
        claimCount: Array.isArray(data.claims) ? data.claims.length : 0,
        importedById: user.id,
      },
    });
    return NextResponse.redirect(appUrl(`${back}?bb=ok`));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "exchange_failed";
    return NextResponse.redirect(appUrl(`${back}?bb=error&msg=${encodeURIComponent(msg.slice(0, 120))}`));
  }
}
