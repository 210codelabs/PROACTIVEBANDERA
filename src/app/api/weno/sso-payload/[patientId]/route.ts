import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { WenoIntegrationService, WenoPayloadError } from "@/lib/weno/ezIntegration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRESCRIBER_ROLES = ["provider", "admin"];

// GET /api/weno/sso-payload/:patientId?download=1
//
// Builds the EXACT 45-field Weno EZ (ComposeRx) SSO payload for the given
// patient, using the CURRENTLY LOGGED-IN prescriber taken from the session.
// Steps (all in WenoIntegrationService.buildPrescriptionPayload):
//   1) reads the patient chart + the prescriber (User) record from the DB,
//   2) maps our fields onto Weno's strict key contract,
//   3) pre-validates critical fields (throws a descriptive 422 if missing),
//   4) returns the clean JSON object ready to be encrypted per Weno's flow.
//
// Credentials (UserEmail / MD5Password / LocationID) are resolved from ENV
// variables (WENO_USER_EMAIL / WENO_PASSWORD|WENO_MD5_PASSWORD / WENO_LOCATION_ID),
// never hardcoded. The password is MD5-hashed before injection.
//
// The response body is EXACTLY the Weno structure (no wrapper). ?download=1
// streams it as an attachment. Admin/prescriber only.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  let user: any;
  try {
    user = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!PRESCRIBER_ROLES.includes(user.role)) {
    return NextResponse.json(
      { error: "A prescriber account is required to build an e-prescribing payload." },
      { status: 403 },
    );
  }

  const { patientId } = await params;
  if (!patientId) {
    return NextResponse.json({ error: "patientId is required." }, { status: 400 });
  }

  const wantDownload = new URL(req.url).searchParams.get("download") === "1";

  try {
    // The logged-in doctor (session) is the prescriber for this prescription.
    const { payload } = await new WenoIntegrationService().buildPrescriptionPayload(
      patientId,
      user.id,
    );

    if (wantDownload) {
      return new NextResponse(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="ComposeRx_${patientId}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }
    // Return EXACTLY the 45-field Weno structure (no wrapper keys).
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    if (e instanceof WenoPayloadError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "No se pudo construir el payload de Weno." }, { status: 500 });
  }
}
