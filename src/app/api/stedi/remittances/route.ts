import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStediConfig, pollTransactions, getERA835, StediError } from "@/lib/stedi";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const remittances = await db.remittance.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ remittances });
}

// POST poll Stedi for inbound 835/ERA transactions and reconcile with claims.
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
      const exists = await db.remittance.findUnique({ where: { transactionId: txId } }).catch(() => null);
      if (exists) continue;
      let era: any = null;
      try { era = await getERA835(txId); } catch { /* skip */ }
      const payments = era?.claimPayments || era?.claims || [];
      const matched: any[] = [];
      let totalPaidCents = 0;
      for (const cp of Array.isArray(payments) ? payments : []) {
        const pcn = cp?.patientControlNumber || cp?.claimInformation?.patientControlNumber;
        const paidCents = Math.round(Number(cp?.claimPaymentAmount || cp?.paidAmount || 0) * 100);
        totalPaidCents += paidCents;
        if (pcn) {
          const claim = await db.claim.findUnique({ where: { patientControlNumber: pcn } }).catch(() => null);
          if (claim) {
            await db.claim.update({ where: { id: claim.id }, data: { paidCents, status: paidCents > 0 ? "paid" : "denied", eraTransactionId: txId } });
            matched.push({ patientControlNumber: pcn, paidCents, status: paidCents > 0 ? "paid" : "denied" });
          }
        }
      }
      const totalFromEra = Math.round(Number(era?.totalActualProviderPaymentAmount || era?.financialInformation?.totalPaid || 0) * 100) || totalPaidCents;
      await db.remittance.create({
        data: {
          transactionId: txId,
          payerName: era?.payer?.name || null,
          totalPaidCents: totalFromEra,
          checkNumber: era?.financialInformation?.checkNumber || era?.checkNumber || null,
          paidDate: era?.financialInformation?.date || null,
          matchedClaims: matched as object,
          raw: era as object,
        },
      });
      processed++;
      summaries.push({ transactionId: txId, matched: matched.length, totalPaidCents: totalFromEra });
    }
    return NextResponse.json({ ok: true, scanned: txns.length, processed, summaries });
  } catch (e: any) {
    const status = e instanceof StediError ? e.status : 502;
    return NextResponse.json({ error: `Polling failed: ${String(e?.message || e).slice(0, 300)}`, status }, { status: 200 });
  }
}
