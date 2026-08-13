import { db } from "@/lib/db";
import { getERA835 } from "@/lib/stedi";

export type EraIngestResult = {
  transactionId: string;
  alreadyProcessed: boolean;
  matched: { patientControlNumber: string; paidCents: number; status: string }[];
  totalPaidCents: number;
  payerName?: string | null;
};

/**
 * Ingest a single 835/ERA transaction: fetch the normalized 835 from Stedi,
 * reconcile each claim payment with our Claim records, auto-post insurance
 * payments to the patient ledger (idempotent via refKey), and persist a
 * Remittance record.
 *
 * Shared by the webhook (real-time) and the manual polling fallback so both
 * paths behave identically. Safe to call twice with the same transactionId —
 * the Remittance @unique(transactionId) + ledger @unique(refKey) make it
 * idempotent.
 */
export async function ingestEra835(transactionId: string, preFetchedEra?: any): Promise<EraIngestResult> {
  const existing = await db.remittance.findUnique({ where: { transactionId } }).catch(() => null);
  if (existing) {
    return {
      transactionId,
      alreadyProcessed: true,
      matched: (existing.matchedClaims as any[]) || [],
      totalPaidCents: existing.totalPaidCents,
      payerName: existing.payerName,
    };
  }

  let era: any = preFetchedEra || null;
  if (!era) {
    try { era = await getERA835(transactionId); } catch { era = null; }
  }

  const payments = era?.claimPayments || era?.claims || [];
  const matched: { patientControlNumber: string; paidCents: number; status: string }[] = [];
  let totalPaidCents = 0;
  let payerId: string | null = null;

  for (const cp of Array.isArray(payments) ? payments : []) {
    const pcn = cp?.patientControlNumber || cp?.claimInformation?.patientControlNumber;
    const paidCents = Math.round(Number(cp?.claimPaymentAmount || cp?.paidAmount || 0) * 100);
    totalPaidCents += paidCents;
    if (!pcn) continue;
    const claim = await db.claim.findUnique({ where: { patientControlNumber: pcn } }).catch(() => null);
    if (!claim) continue;
    if (!payerId && claim.payerId) payerId = claim.payerId;
    const status = paidCents > 0 ? "paid" : "denied";
    await db.claim
      .update({ where: { id: claim.id }, data: { paidCents, status, eraTransactionId: transactionId } })
      .catch(() => {});
    matched.push({ patientControlNumber: pcn, paidCents, status });

    // Auto-post the insurance payment on the patient ledger (idempotent).
    if (claim.patientId && paidCents > 0) {
      await db.patientLedgerEntry
        .create({
          data: {
            patientId: claim.patientId,
            type: "payment",
            amountCents: paidCents,
            description: `Insurance payment — ${era?.payer?.name || "payer"} (claim ${pcn})`,
            claimId: claim.id,
            remittanceId: transactionId,
            refKey: `payment:${transactionId}:${claim.id}`,
          },
        })
        .catch(() => {});
    }
  }

  const totalFromEra =
    Math.round(Number(era?.totalActualProviderPaymentAmount || era?.financialInformation?.totalPaid || 0) * 100) ||
    totalPaidCents;

  await db.remittance.create({
    data: {
      transactionId,
      payerName: era?.payer?.name || null,
      payerId: payerId || (era?.payer?.payerIdentification || era?.payer?.id || null),
      totalPaidCents: totalFromEra,
      checkNumber: era?.financialInformation?.checkNumber || era?.checkNumber || null,
      paidDate: era?.financialInformation?.date || null,
      matchedClaims: matched as object,
      raw: era as object,
    },
  }).catch(() => {});

  return { transactionId, alreadyProcessed: false, matched, totalPaidCents: totalFromEra, payerName: era?.payer?.name || null };
}
