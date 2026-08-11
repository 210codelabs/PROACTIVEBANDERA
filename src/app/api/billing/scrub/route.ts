import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStediConfig } from "@/lib/stedi";

/**
 * POST /api/billing/scrub
 * Deterministic clean-claim pre-submission validation (837P). Checks the fields
 * a payer/clearinghouse commonly rejects on BEFORE submitting, using the
 * org-level Stedi billing config + the per-claim data provided.
 */
function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v || "").split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
}

const NPI_RE = /^\d{10}$/;
const ICD_RE = /^[A-TV-Z]\d[A-Z0-9](?:\.?[A-Z0-9]{1,4})?$/i;
const CPT_RE = /^(\d{5}|[A-Z]\d{4})$/i;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const cpt = toList(b.cptCodes);
  const icd = toList(b.icd10Codes);
  const memberId = String(b.memberId || "").trim();
  const payerId = String(b.payerId || "").trim();
  const pos = String(b.placeOfService || "").trim();
  const renderingNpi = String(b.renderingNpi || "").trim();

  const cfg = await getStediConfig();

  const errors: string[] = [];
  const warnings: string[] = [];

  // Org billing config
  if (!cfg.enabled) errors.push("Stedi integration is not enabled.");
  if (!cfg.apiKey) errors.push("Stedi API key is not configured.");
  if (!NPI_RE.test((cfg.billingNpi || "").trim())) errors.push("Billing NPI is missing or not a valid 10-digit NPI (Settings → Integrations → Stedi).");
  if (!(cfg.taxId || "").trim()) errors.push("Billing Tax ID (EIN) is not configured.");
  if (!(cfg.address?.zipCode || "").trim()) warnings.push("Billing address ZIP is not configured.");
  if (!(cfg.taxonomy || "").trim()) warnings.push("Billing taxonomy code is not configured (some payers require it).");

  // Per-claim
  if (!payerId) errors.push("Payer ID (Stedi trading-partner id) is required.");
  if (!memberId) errors.push("Subscriber/member ID is required.");
  if (cpt.length === 0) errors.push("At least one CPT/HCPCS procedure code is required.");
  if (icd.length === 0) errors.push("At least one ICD-10 diagnosis code is required.");

  const badCpt = cpt.filter((c) => !CPT_RE.test(c));
  if (badCpt.length) errors.push(`Invalid CPT/HCPCS format: ${badCpt.join(", ")}`);
  const badIcd = icd.filter((c) => !ICD_RE.test(c));
  if (badIcd.length) errors.push(`Invalid ICD-10 format: ${badIcd.join(", ")}`);
  if (icd.length > 12) warnings.push("More than 12 diagnosis codes — a CMS-1500 supports max 12.");

  if (renderingNpi && !NPI_RE.test(renderingNpi)) errors.push("Rendering provider NPI is not a valid 10-digit NPI.");
  if (!pos) warnings.push("Place of Service code not set (defaults to 11 — office).");

  if (cfg.environment !== "production") warnings.push("Stedi is in TEST mode — claim submission is not available; switch to production for live claims.");

  const readyToSubmit = errors.length === 0;
  return NextResponse.json({
    ok: true,
    environment: cfg.environment,
    readyToSubmit,
    errors,
    warnings,
    checked: { cpt, icd, memberId: Boolean(memberId), payerId: Boolean(payerId), billingNpi: cfg.billingNpi || null },
  });
}
