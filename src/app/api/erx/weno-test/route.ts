import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getWenoOnlineConfig, isWenoOnlineConfigured, buildComposeRxUrl } from "@/lib/wenoOnline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/erx/weno-test — clinician-facing "Test Weno connection" used from the
// eRx module. Instant, config-based check (no long external hang): confirms the
// Weno Online ComposeRx launch URL can be built and reports Switch status.
export async function GET() {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const online = await getWenoOnlineConfig();

  // Weno Online (ComposeRx launch) — the only eRx path (EZ Integration).
  let onlineOk = false;
  let onlineMsg: string;
  if (!online.enabled) {
    onlineMsg = "Not enabled. Turn on Weno Online in Admin → External Integrations.";
  } else if (!isWenoOnlineConfigured(online)) {
    onlineMsg = "Missing setup — add EHR Encryption Key, provider email/password and Location ID in Admin → Weno Online.";
  } else {
    try {
      buildComposeRxUrl(online, { id: "TEST", firstName: "Test", lastName: "Patient", gender: "U", dob: "1990-01-01" }, {});
      onlineOk = true;
      onlineMsg = `Ready (${online.environment}) — ComposeRx (EZ Integration) launch verified.`;
    } catch (e: any) {
      onlineMsg = String(e?.message || e).slice(0, 200);
    }
  }

  return NextResponse.json({
    ok: onlineOk,
    online: { enabled: online.enabled, configured: isWenoOnlineConfigured(online), ok: onlineOk, environment: online.environment, message: onlineMsg },
  });
}
