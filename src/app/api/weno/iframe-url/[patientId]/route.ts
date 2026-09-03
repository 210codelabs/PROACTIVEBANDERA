import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { WenoIntegrationService, WenoOnlineError, WenoPayloadError } from "@/lib/weno/ezIntegration";

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
export async function GET(_req: Request, { params }: { params: Promise<{ patientId: string }> }) {
  // 1) Authentication
  let user: any;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  // 2) Authorization — must be a prescriber
  if (!PRESCRIBER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "A prescriber account is required to open e-prescribing." }, { status: 403 });
  }

  const { patientId } = await params;
  if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 });

  // 3) Build the encrypted, authenticated iFrame URL from the 45-field payload.
  //    The logged-in doctor (session) is the prescriber for this prescription.
  try {
    const svc = new WenoIntegrationService();
    const orgTxId = crypto.randomUUID().replace(/-/g, "");
    const { iframeUrl, environment } = await svc.buildLaunchUrl(patientId, user.id);

    // Audit WITHOUT the URL (it embeds PHI + credential-derived material).
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "erx.wenoEz.iframeUrl",
        resource: "Patient",
        resourceId: patientId,
        meta: JSON.stringify({ environment, orgTxId, prescriberNpi: user.npi || null }),
      },
    }).catch(() => {});

    // 4) Respond with the authenticated iFrame URL for direct rendering
    return NextResponse.json({ iframeUrl, environment, orgTransactionId: orgTxId });
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
