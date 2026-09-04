import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getImmtracConfig, isImmtracConfigured } from "@/lib/immtrac";

export const runtime = "nodejs";

// Tells the UI whether the Texas ImmTrac2 registry connection is live yet.
export async function GET() {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const c = getImmtracConfig();
  return NextResponse.json({
    registry: "Texas ImmTrac2",
    configured: isImmtracConfigured(c),
    environment: c.environment,
  });
}
