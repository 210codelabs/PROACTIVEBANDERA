import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { WenoIntegrationService, WenoOnlineError, WenoPayloadError, resolvePrescriberOverride } from "@/lib/weno/ezIntegration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Roles allowed to prescribe (open the Weno EZ ComposeRx iFrame).
const PRESCRIBER_ROLES = ["provider", "admin"];

// GET /api/weno/iframe-url/[patientId]
// Returns an authenticated Weno EZ (ComposeRx) iFrame URL for the patient so the
// client can render it. Now built on the SAME 45-field payload as
// /api/weno/sso-payload (WenoIntegrationService.buildLaunchUrl): it constructs
// the exact validated payload, encrypts it (AES-256-CBC per Weno's EZ guide) and
// returns { iframeUrl }. Missing critical patient fields -> descriptive 4xx.
export async function GET(req: Request, { params }: { params: Promise<{ patientId: string }> }) {
  // 1) Authentication
  let user: any;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  // 2) Authorization — must be a prescriber
  if (!PRESCRIBER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "A prescriber account is required to open e-prescribing." }, { status: 403 });
  }

  const { patientId } = await params;
  if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 });

  // Selected prescriber (from the "Prescribe as" picker). Falls back to the
  // account default when not provided / not found.
  const prescriberId = new URL(req.url).searchParams.get("prescriberId");
  const chosen = await resolvePrescriberOverride(prescriberId);

  // 3) Build the encrypted, authenticated iFrame URL from the 45-field payload.
  try {
    const svc = new WenoIntegrationService();
    const orgTxId = crypto.randomUUID().replace(/-/g, "");
    const { iframeUrl, environment } = await svc.buildLaunchUrl(patientId, user.id, chosen?.override);

    // Audit WITHOUT the URL (it embeds PHI + credential-derived material).
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "erx.wenoEz.iframeUrl",
        resource: "Patient",
        resourceId: patientId,
        meta: JSON.stringify({ environment, orgTxId, prescriberNpi: chosen?.npi || user.npi || null, prescriberId: prescriberId || null }),
      },
    }).catch(() => {});

    // 4) Respond with the authenticated iFrame URL for direct rendering.
    // composeHost + testPatient are non-PHI diagnostics so staff/tests can
    // confirm the Rx targets the LIVE exchange (online.wenoexchange.com, N),
    // not the test stream (test.wenoexchange.com, Y).
    let composeHost: string | null = null;
    try { composeHost = new URL(iframeUrl).host; } catch {}
    return NextResponse.json({
      iframeUrl,
      environment,
      composeHost,
      testPatient: environment === "production" ? "N" : "Y",
      live: environment === "production",
      orgTransactionId: orgTxId,
      prescriber: chosen?.label || null,
    });
  } catch (e: any) {
    // WenoPayloadError: 404 (patient not found) or 422 (missing critical fields).
    if (e instanceof WenoPayloadError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    // WenoOnlineError: not configured (400) etc.
    const status = e instanceof WenoOnlineError ? e.status : undefined;
    return NextResponse.json(
      { error: String(e?.message || e).slice(0, 300) },
      { status: status && status >= 400 && status < 500 ? status : 500 },
    );
  }
}
