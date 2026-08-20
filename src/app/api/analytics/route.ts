import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { computeAnalytics } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Practice-wide analytics snapshot for the date range (default: last 12 months).
 */
export async function GET(req: Request) {
  try { await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const sp = new URL(req.url).searchParams;
  const now = new Date();
  const defFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const parse = (s: string | null, fallback: Date): Date => {
    if (!s) return fallback;
    const d = new Date(s.length === 10 ? `${s}T00:00:00.000Z` : s);
    return isNaN(d.getTime()) ? fallback : d;
  };
  const from = parse(sp.get("from"), defFrom);
  const toRaw = parse(sp.get("to"), now);
  // include the whole "to" day
  const to = new Date(Date.UTC(toRaw.getUTCFullYear(), toRaw.getUTCMonth(), toRaw.getUTCDate(), 23, 59, 59, 999));

  const data = await computeAnalytics({ from, to });
  return NextResponse.json({ ok: true, analytics: data });
}
