import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStediConfig, pollTransactions, StediError } from "@/lib/stedi";
import { ingestEra835 } from "@/lib/era";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const remittances = await db.remittance.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ remittances });
}

// POST poll Stedi for inbound 835/ERA transactions and reconcile with claims.
// This is the manual fallback for the real-time webhook (/api/stedi/webhook).
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = await getStediConfig();
  if (!cfg.enabled || !cfg.apiKey) return NextResponse.json({ error: "Stedi is not configured." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const sinceISO = b?.since || new Date(Date.now() - 30 * 86400000).toISOString();

  try {
    const page = await pollTransactions(sinceISO);
    const txns: any[] = page?.items || page?.transactions || [];
    let processed = 0;
    const summaries: any[] = [];
    for (const t of txns) {
      const type = String(t?.transactionSetIdentifier || t?.type || t?.transactionType || "");
      const txId = t?.transactionId || t?.id;
      if (!txId || !/835/.test(type)) continue;
      const result = await ingestEra835(String(txId));
      if (result.alreadyProcessed) continue;
      processed++;
      summaries.push({ transactionId: txId, matched: result.matched.length, totalPaidCents: result.totalPaidCents });
    }
    return NextResponse.json({ ok: true, scanned: txns.length, processed, summaries });
  } catch (e: any) {
    const status = e instanceof StediError ? e.status : 502;
    return NextResponse.json({ error: `Polling failed: ${String(e?.message || e).slice(0, 300)}`, status }, { status: 200 });
  }
}
