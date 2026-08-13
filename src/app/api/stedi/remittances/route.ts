import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStediConfig, pollTransactions, StediError } from "@/lib/stedi";
import { ingestEra835 } from "@/lib/era";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const remittances = await db.remittance.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  // Deposit reconciliation: map each remittance to the bank account that should
  // receive it, via the payer's ERA (claimPayment) enrollment link. Flag any
  // remittance whose payer has no linked / unverified deposit account.
  const [enrollments, accounts] = await Promise.all([
    db.stediEnrollment.findMany({ where: { bankAccountId: { not: null } } }).catch(() => []),
    db.bankAccount.findMany({ where: { active: true } }).catch(() => []),
  ]);
  const acctById = new Map(accounts.map((a: any) => [a.id, a]));
  // payerId -> enrollment that carries a bank account and enrolls claimPayment
  const enrByPayer = new Map<string, any>();
  for (const e of enrollments as any[]) {
    const t = (e.transactions as any) || {};
    if (!e.payerId || !e.bankAccountId) continue;
    if (t.claimPayment === false) continue; // only ERA-carrying enrollments
    if (!enrByPayer.has(e.payerId)) enrByPayer.set(e.payerId, e);
  }

  const enriched = remittances.map((r: any) => {
    // Derive payerId: prefer stored, else from a matched claim's payerId.
    let payerId = r.payerId || null;
    const enr = payerId ? enrByPayer.get(payerId) : null;
    const acct: any = enr?.bankAccountId ? acctById.get(enr.bankAccountId) : null;
    let deposit: any = null;
    let reconciled = false;
    let flag: string | null = null;
    if (acct) {
      const verified = acct.verificationStatus === "verified";
      deposit = { id: acct.id, label: acct.label, accountMasked: acct.accountMasked ?? maskTail(acct.accountNumber), verified };
      reconciled = verified;
      if (!verified) flag = "unverified_account"; // linked but not verified
    } else if (payerId) {
      flag = "no_linked_account"; // payer known, no ERA enrollment with a deposit account
    } else {
      flag = "unknown_payer"; // could not resolve the payer to an enrollment
    }
    return { ...r, deposit, reconciled, flag };
  });

  const unlinked = enriched.filter((r: any) => r.flag && r.flag !== null && !r.reconciled).length;
  return NextResponse.json({ remittances: enriched, reconciliation: { total: enriched.length, unlinked } });
}

function maskTail(v?: string | null) {
  if (!v) return null;
  const s = String(v);
  return "••••" + s.slice(-4);
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
