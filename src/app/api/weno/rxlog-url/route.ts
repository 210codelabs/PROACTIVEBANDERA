import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { WenoIntegrationService, WenoOnlineError } from "@/lib/weno/ezIntegration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRESCRIBER_ROLES = ["provider", "admin"];

// GET /api/weno/rxlog-url -> authenticated Weno RxLog iFrame URL (view on demand).
export async function GET() {
  let user: any;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!PRESCRIBER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "A prescriber/admin account is required." }, { status: 403 });
  }
  try {
    const { iframeUrl, environment } = await new WenoIntegrationService().buildRxLogUrl();
    return NextResponse.json({ iframeUrl, environment });
  } catch (e: any) {
    const status = e instanceof WenoOnlineError ? e.status : 500;
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: status && status >= 400 && status < 500 ? status : 500 });
  }
}
