import { NextResponse } from "next/server";
import { getEnterpriseSession } from "@/lib/enterpriseAuth";
import { lookupByDot, lookupByMc, qcmobileConfigured } from "@/lib/dot/qcmobile";

export const runtime = "nodejs";

// GET /api/enterprise/dot/carrier-lookup?dot=  OR  ?mc=
export async function GET(req: Request) {
  const s = await getEnterpriseSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!qcmobileConfigured()) {
    return NextResponse.json({ error: "FMCSA carrier lookup is not configured. Add FMCSA_QCMOBILE_KEY to enable QCMobile lookups.", configured: false }, { status: 503 });
  }
  const url = new URL(req.url);
  const dot = url.searchParams.get("dot");
  const mc = url.searchParams.get("mc");
  try {
    const carrier = dot ? await lookupByDot(dot) : mc ? await lookupByMc(mc) : null;
    if (!carrier) return NextResponse.json({ error: "No carrier found for that number.", carrier: null }, { status: 404 });
    return NextResponse.json({ ok: true, carrier });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lookup failed" }, { status: 502 });
  }
}
