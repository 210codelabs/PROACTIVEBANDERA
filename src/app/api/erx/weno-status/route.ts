import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getWenoConfig } from "@/lib/weno";

export const runtime = "nodejs";

// Lightweight status for the eRx UI: is Weno enabled + configured, which env,
// and whether EPCS (controlled substances) is turned on. Never returns secrets.
export async function GET() {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  const cfg = await getWenoConfig();
  return NextResponse.json({
    enabled: cfg.enabled,
    configured: Boolean(cfg.partnerId && cfg.md5Password),
    environment: cfg.environment,
    epcs: cfg.epcsEnabled,
  });
}
