import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { validateNppes, checkOigLeie, checkSamGov } from "@/lib/credentialing/govValidation";

export const runtime = "nodejs";

// POST /api/credentialing/providers/[id]/validate
// Runs Gov API validation; provider -> VALIDATED only if all checks pass.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const p = await db.credentialingProvider.findUnique({ where: { id } });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.credentialingProvider.update({ where: { id }, data: { status: "validating" } }).catch(() => {});

  const nppes = await validateNppes(p.npi);
  const oig = await checkOigLeie(p.firstName, p.lastName, p.npi);
  const sam = await checkSamGov(p.firstName, p.lastName);

  const nppesVerified = nppes.ok;
  const oigClear = oig.excluded === false ? true : oig.excluded === true ? false : null;
  const samClear = sam.excluded === false ? true : sam.excluded === true ? false : null;
  // VALIDATED requires an NPPES match and NO affirmative exclusion on OIG/SAM.
  const passed = nppesVerified && oigClear !== false && samClear !== false;

  // Backfill demographics/taxonomy from NPPES when missing.
  const fill: any = {};
  if (nppes.ok && nppes.data) {
    if (!p.taxonomy) fill.taxonomy = nppes.data.taxonomy || null;
    if (!p.taxonomyCode) fill.taxonomyCode = nppes.data.taxonomyCode || null;
    if (!p.city) fill.city = nppes.data.city || null;
    if (!p.state) fill.state = nppes.data.state || null;
    if (!p.postalCode) fill.postalCode = nppes.data.postalCode || null;
    if (!p.credential) fill.credential = nppes.data.credential || null;
  }

  const validationResult = {
    at: new Date().toISOString(),
    nppes: nppes.ok ? { ok: true, name: `${nppes.data?.firstName} ${nppes.data?.lastName}`.trim(), taxonomy: nppes.data?.taxonomy, status: nppes.data?.status } : { ok: false, error: nppes.error },
    oig, sam, passed,
  };

  const provider = await db.credentialingProvider.update({
    where: { id },
    data: {
      ...fill,
      nppesVerified, oigClear, samClear,
      lastValidationAt: new Date(),
      validationResult,
      status: passed ? "validated" : "failed",
    },
  });

  return NextResponse.json({ ok: true, passed, provider: { ...provider, portalPasswordEnc: undefined }, validationResult });
}
