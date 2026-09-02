import { db } from "@/lib/db";
import { validateNppes, checkOigLeie, checkSamGov } from "@/lib/credentialing/govValidation";

export type RecheckSummary = {
  checked: number;
  excludedCount: number;
  newlyExcluded: Array<{ id: string; name: string; npi: string; reasons: string[] }>;
  cleared: Array<{ id: string; name: string; npi: string }>;
  at: string;
};

// Re-run OIG/SAM (and NPPES) screening for every provider that has already been
// validated at least once. Flags any provider that has BECOME newly excluded.
export async function recheckExclusions(): Promise<RecheckSummary> {
  const providers = await db.credentialingProvider.findMany({
    where: { OR: [{ status: { in: ["validated", "flagged", "failed"] } }, { lastValidationAt: { not: null } }] },
    take: 2000,
  });

  const summary: RecheckSummary = { checked: 0, excludedCount: 0, newlyExcluded: [], cleared: [], at: new Date().toISOString() };

  for (const p of providers) {
    summary.checked++;
    const wasExcluded = p.excluded === true;
    const name = `${p.lastName}, ${p.firstName}${p.credential ? `, ${p.credential}` : ""}`;

    const nppes = await validateNppes(p.npi);
    const oig = await checkOigLeie(p.firstName, p.lastName, p.npi);
    const sam = await checkSamGov(p.firstName, p.lastName);

    const oigClear = oig.excluded === false ? true : oig.excluded === true ? false : null;
    const samClear = sam.excluded === false ? true : sam.excluded === true ? false : null;
    const reasons: string[] = [];
    if (oig.excluded === true) reasons.push(oig.note);
    if (sam.excluded === true) reasons.push(sam.note);
    const nowExcluded = reasons.length > 0;
    if (nowExcluded) summary.excludedCount++;

    const data: any = {
      nppesVerified: nppes.ok,
      oigClear, samClear,
      lastRecheckAt: new Date(),
      validationResult: {
        at: summary.at, mode: "recheck",
        nppes: nppes.ok ? { ok: true, status: nppes.data?.status } : { ok: false, error: nppes.error },
        oig, sam,
      },
    };
    if (nowExcluded && !wasExcluded) {
      data.excluded = true; data.excludedAt = new Date(); data.excludedReason = reasons.join(" | "); data.status = "flagged";
      summary.newlyExcluded.push({ id: p.id, name, npi: p.npi, reasons });
      await db.auditLog.create({ data: { action: "credentialing.newly_excluded", resource: "CredentialingProvider", resourceId: p.id, meta: JSON.stringify({ npi: p.npi, reasons }) } }).catch(() => {});
    } else if (!nowExcluded && wasExcluded) {
      // No longer flagged as excluded.
      data.excluded = false; data.excludedAt = null; data.excludedReason = null;
      data.status = nppes.ok ? "validated" : "failed";
      summary.cleared.push({ id: p.id, name, npi: p.npi });
    } else if (nowExcluded) {
      data.excluded = true; // still excluded
      data.status = "flagged";
    }

    await db.credentialingProvider.update({ where: { id: p.id }, data }).catch(() => {});
  }

  return summary;
}
