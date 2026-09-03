import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  WenoIntegrationService,
  WenoPayloadError,
  type WenoBuildResult,
} from "@/lib/weno/ezIntegration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRESCRIBER_ROLES = ["provider", "admin"];

// GET /api/weno/ez/sample-payload?patientId=<optional>&providerId=<optional>&download=1
//
// DEVELOPER helper: emits the exact 45-field ComposeRx JSON using the SAME
// builder as /api/weno/sso-payload (WenoIntegrationService.buildPrescriptionPayload)
// so an admin/prescriber can paste it into the Weno EZ "Developers" validator.
// With no patientId it uses Weno's sample patient. Credentials (UserEmail/
// MD5Password/LocationID) come from env/config and are never hardcoded or leaked.
export async function GET(req: Request) {
  let user: any;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!PRESCRIBER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "A prescriber/admin account is required." }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const patientId = sp.get("patientId") || "";
  const providerId = sp.get("providerId") || "";
  const wantDownload = sp.get("download") === "1";

  let result: WenoBuildResult;
  try {
    result = await new WenoIntegrationService().buildPrescriptionPayload(patientId, providerId);
  } catch (e: any) {
    if (e instanceof WenoPayloadError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "No se pudo construir el payload de Weno." }, { status: 500 });
  }

  if (wantDownload) {
    return new NextResponse(JSON.stringify(result.payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="ComposeRx_${patientId || "sample"}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json({
    environment: result.environment,
    missing: result.missing,
    payload: result.payload,
  });
}
