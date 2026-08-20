import { readIntegrations } from "@/lib/integrations/store";

/**
 * Stedi healthcare clearinghouse client.
 *
 * The API key is configured/updated by an admin in Settings → External
 * Integrations (stored in the integrations AppSetting, never in NEXT_PUBLIC_*).
 * An optional STEDI_API_KEY env var is used only as a fallback. Base URLs are
 * fixed by Stedi and overridable via env.
 *
 * Stedi is an EDI clearinghouse — NOT a bank or payment processor. A successful
 * response confirms the transaction was accepted by Stedi/the payer's EDI, not
 * that a claim was adjudicated or paid. Do not represent it as such.
 */

export const STEDI_BASE = {
  healthcare: process.env.STEDI_HEALTHCARE_BASE_URL || "https://healthcare.us.stedi.com/2024-04-01",
  core: process.env.STEDI_CORE_BASE_URL || "https://core.us.stedi.com/2023-08-01",
  payers: process.env.STEDI_PAYERS_BASE_URL || "https://payers.us.stedi.com/2024-04-01",
  enrollments: process.env.STEDI_ENROLLMENTS_BASE_URL || "https://enrollments.us.stedi.com/2024-09-01",
};

export type StediConfig = {
  apiKey: string;
  environment: string;
  orgName: string;
  billingNpi: string;
  taxId: string;
  taxIdType: string;
  taxonomy: string;
  address: { streetAddress1: string; city: string; state: string; zipCode: string };
  defaultPayerId: string;
  enrollmentContact: { email: string; phone: string };
  webhookSecret: string;
  enabled: boolean;
  subServices: Record<string, boolean>;
};

/** Read the admin-configured Stedi settings (with env fallback for the key). */
export async function getStediConfig(): Promise<StediConfig> {
  let creds: Record<string, string> = {};
  let enabled = false;
  let subServices: Record<string, boolean> = {};
  try {
    const state = await readIntegrations();
    const p = state.providers["stedi"];
    if (p) {
      creds = p.credentials || {};
      enabled = p.enabled;
      subServices = p.subServices || {};
    }
  } catch {
    // fall through to env-only config
  }
  return {
    apiKey: (creds.API_KEY || process.env.STEDI_API_KEY || "").trim(),
    environment: creds.ENVIRONMENT || process.env.STEDI_ENVIRONMENT || "test",
    orgName: creds.ORG_NAME || "",
    billingNpi: creds.BILLING_NPI || "",
    taxId: creds.TAX_ID || "",
    taxIdType: creds.TAX_ID_TYPE || "EIN",
    taxonomy: creds.TAXONOMY || "",
    address: {
      streetAddress1: creds.ADDRESS1 || "",
      city: creds.CITY || "",
      state: creds.STATE || "",
      zipCode: creds.ZIP || "",
    },
    defaultPayerId: creds.DEFAULT_PAYER_ID || "",
    enrollmentContact: { email: creds.ENROLLMENT_CONTACT_EMAIL || "", phone: creds.ENROLLMENT_CONTACT_PHONE || "" },
    webhookSecret: (creds.WEBHOOK_SECRET || process.env.STEDI_WEBHOOK_CREDENTIAL || "").trim(),
    enabled,
    subServices,
  };
}

export class StediError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`Stedi ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * Low-level Stedi request. Stedi expects the API key directly in the
 * Authorization header (NOT "Bearer <key>").
 */
export async function stediFetch<T = any>(
  base: string,
  path: string,
  init: RequestInit & { apiKey?: string } = {},
): Promise<T> {
  const apiKey = init.apiKey || (await getStediConfig()).apiKey;
  if (!apiKey) throw new StediError(401, "Stedi API key is not configured.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", apiKey);
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${base}${path}`, { ...init, headers, cache: "no-store" });
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new StediError(res.status, body);
  return body as T;
}

/**
 * Connectivity test: list one payer. A 200 means the key + network are valid.
 * Works with both test and production keys.
 */
export async function stediPing(apiKey?: string): Promise<{ ok: boolean; sample?: any }> {
  const body = await stediFetch<any>(STEDI_BASE.payers, "/payers?pageSize=10", { method: "GET", apiKey });
  const items = body?.items || body?.payers || [];
  return { ok: true, sample: Array.isArray(items) ? items[0] : undefined };
}

// ---- Helpers ----

/** Convert an ISO date / Date / YYYY-MM-DD to Stedi's YYYYMMDD format. */
export function toYYYYMMDD(input: string | Date | null | undefined): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) {
    // maybe already YYYYMMDD or YYYY-MM-DD string
    const s = String(input).replace(/-/g, "");
    return /^\d{8}$/.test(s) ? s : "";
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export type EligibilityInput = {
  payerId: string;
  memberId?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | Date;
  dateOfService?: string | Date;
  serviceTypeCodes?: string[];
};

export type EligibilityResult = {
  status: "active" | "inactive" | "error" | "unknown";
  planName?: string;
  payerName?: string;
  summary: { label: string; value: string }[];
  raw: any;
};

/**
 * Real-time eligibility & benefits (270/271) via Stedi.
 * Returns a normalized summary plus the raw payload.
 */
export async function checkEligibility(input: EligibilityInput): Promise<EligibilityResult> {
  const cfg = await getStediConfig();
  const raw = await stediFetch<any>(STEDI_BASE.healthcare, "/change/medicalnetwork/eligibility/v3", {
    method: "POST",
    body: JSON.stringify({
      tradingPartnerServiceId: input.payerId,
      provider: {
        npi: cfg.billingNpi,
        organizationName: cfg.orgName || "Clinic",
        providerType: "provider",
      },
      subscriber: {
        memberId: input.memberId,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: toYYYYMMDD(input.dateOfBirth),
      },
      encounter: {
        dateOfService: toYYYYMMDD(input.dateOfService || new Date()),
        serviceTypeCodes: input.serviceTypeCodes && input.serviceTypeCodes.length ? input.serviceTypeCodes : ["30"],
      },
    }),
  });
  return normalizeEligibility(raw);
}

/** Turn a Stedi 271 response into a small human-readable summary. */
export function normalizeEligibility(raw: any): EligibilityResult {
  const summary: { label: string; value: string }[] = [];
  const payerName = raw?.payer?.name || raw?.payer?.organizationName;
  const planName =
    raw?.planInformation?.planNumber ||
    raw?.planDateInformation?.plan ||
    (Array.isArray(raw?.benefitsInformation)
      ? raw.benefitsInformation.find((b: any) => b?.planCoverage)?.planCoverage
      : undefined);

  // AAA rejection → error
  const aaa = raw?.errors || raw?.aaaErrors || raw?.subscriber?.aaaErrors;
  if (Array.isArray(aaa) && aaa.length) {
    return {
      status: "error",
      payerName,
      planName,
      summary: [{ label: "Rejection", value: aaa.map((a: any) => a?.description || a?.code).join("; ") }],
      raw,
    };
  }

  let status: EligibilityResult["status"] = "unknown";
  const benefits: any[] = Array.isArray(raw?.benefitsInformation) ? raw.benefitsInformation : [];
  // 1 = Active Coverage, 6 = Inactive
  if (benefits.some((b) => b?.code === "1")) status = "active";
  else if (benefits.some((b) => b?.code === "6" || b?.code === "I")) status = "inactive";

  // Pull a few common benefit lines (copay=B, coinsurance=A, deductible=C, out-of-pocket=G)
  const codeLabel: Record<string, string> = { B: "Co-payment", A: "Co-insurance", C: "Deductible", G: "Out-of-pocket" };
  for (const b of benefits) {
    const label = codeLabel[b?.code];
    if (!label) continue;
    const amount = b?.benefitAmount ? `$${b.benefitAmount}` : b?.benefitPercent ? `${b.benefitPercent}%` : "";
    const svc = Array.isArray(b?.serviceTypes) ? b.serviceTypes[0] : b?.serviceTypeCodes?.[0];
    if (amount) summary.push({ label: `${label}${svc ? ` (${svc})` : ""}`, value: amount });
  }
  if (planName) summary.unshift({ label: "Plan", value: String(planName) });

  return { status, payerName, planName: planName ? String(planName) : undefined, summary, raw };
}

// ---- Payers (Stedi Search Payers API) ----
// Uses the Search Payers endpoint (healthcare base + /payers/search), which does
// case-insensitive fuzzy matching on payer name / ID / alias. The older
// payers.us.stedi.com/payers endpoint only LISTS the directory and ignores the
// query, so it must NOT be used for search. query is required (default "*");
// pageSize min is 10. Results are wrapped as { payer: {...} } — we flatten them
// so callers keep reading displayName / stediId / primaryPayerId directly.
export async function searchStediPayers(query: string): Promise<any[]> {
  const q = (query && query.trim()) || "*";
  const qs = `?query=${encodeURIComponent(q)}&pageSize=25`;
  const body = await stediFetch<any>(STEDI_BASE.healthcare, `/payers/search${qs}`, { method: "GET" });
  const items = body?.items || body?.payers || [];
  return Array.isArray(items) ? items.map((it: any) => it?.payer || it) : [];
}

// ---- Enrollment (transaction enrollment; NOT clinical credentialing) ----
export async function createStediProvider(input: {
  name: string; npi: string; taxId: string; taxIdType?: string;
  contact?: { firstName?: string; lastName?: string; email?: string; phone?: string; streetAddress1?: string; city?: string; state?: string; zipCode?: string };
}): Promise<any> {
  const contacts = input.contact
    ? [{
        firstName: input.contact.firstName || "Revenue", lastName: input.contact.lastName || "Cycle",
        email: input.contact.email || "", phone: input.contact.phone || "",
        streetAddress1: input.contact.streetAddress1 || "", city: input.contact.city || "",
        state: input.contact.state || "", zipCode: input.contact.zipCode || "",
      }]
    : undefined;
  return stediFetch<any>(STEDI_BASE.enrollments, "/providers", {
    method: "POST",
    body: JSON.stringify({ name: input.name, npi: input.npi, taxId: input.taxId, taxIdType: input.taxIdType || "EIN", ...(contacts ? { contacts } : {}) }),
  });
}

export async function createStediEnrollment(input: {
  payerIdOrAlias: string; providerId: string;
  transactions: Record<string, { enroll: boolean }>;
  aggregationTaxId?: string; status?: string; userEmail?: string;
  primaryContact?: Record<string, string>;
}): Promise<any> {
  return stediFetch<any>(STEDI_BASE.enrollments, "/enrollments", {
    method: "POST",
    body: JSON.stringify({
      payer: { idOrAlias: input.payerIdOrAlias },
      provider: { id: input.providerId },
      ...(input.primaryContact ? { primaryContact: input.primaryContact } : {}),
      transactions: input.transactions,
      ...(input.aggregationTaxId ? { aggregationPreference: { taxId: input.aggregationTaxId } } : {}),
      status: input.status || "DRAFT",
      ...(input.userEmail ? { userEmail: input.userEmail } : {}),
    }),
  });
}

export async function getStediEnrollment(enrollmentId: string): Promise<any> {
  return stediFetch<any>(STEDI_BASE.enrollments, `/enrollments/${enrollmentId}`, { method: "GET" });
}

// ---- Claims (837P) ----
export function buildClaimPayload(opts: {
  cfg: StediConfig;
  payerId: string;
  patientControlNumber: string;
  subscriber: { memberId?: string; firstName: string; lastName: string; dateOfBirth?: string | Date; address?: any };
  diagnoses: { qualifier?: string; code: string }[];
  serviceLines: { serviceDate: string | Date; procedureCode: string; chargeCents: number; units: number; diagnosisCodePointers?: string[]; modifier?: string }[];
  usageIndicator?: "P" | "T";
}): any {
  const { cfg } = opts;
  const totalCents = opts.serviceLines.reduce((s, l) => s + l.chargeCents * (l.units || 1), 0);
  return {
    usageIndicator: opts.usageIndicator || (cfg.environment === "production" ? "P" : "T"),
    tradingPartnerServiceId: opts.payerId,
    submitter: { organizationName: cfg.orgName, contactInformation: { name: cfg.orgName, phoneNumber: cfg.enrollmentContact.phone } },
    receiver: { organizationName: "Payer" },
    billing: {
      organizationName: cfg.orgName,
      npi: cfg.billingNpi,
      taxId: cfg.taxId,
      taxIdType: cfg.taxIdType,
      address: { streetAddress1: cfg.address.streetAddress1, city: cfg.address.city, state: cfg.address.state, postalCode: cfg.address.zipCode },
    },
    subscriber: {
      memberId: opts.subscriber.memberId,
      firstName: opts.subscriber.firstName,
      lastName: opts.subscriber.lastName,
      dateOfBirth: toYYYYMMDD(opts.subscriber.dateOfBirth),
      ...(opts.subscriber.address ? { address: opts.subscriber.address } : {}),
    },
    claimInformation: {
      patientControlNumber: opts.patientControlNumber,
      claimChargeAmount: (totalCents / 100).toFixed(2),
      claimFrequencyCode: "1",
      diagnosisCodes: opts.diagnoses.map((d) => ({ qualifier: d.qualifier || "ABK", code: d.code.replace(/\./g, "") })),
      serviceLines: opts.serviceLines.map((l) => ({
        serviceDate: toYYYYMMDD(l.serviceDate),
        chargeAmount: (l.chargeCents * (l.units || 1) / 100).toFixed(2),
        units: String(l.units || 1),
        procedureCode: l.procedureCode,
        ...(l.modifier ? { procedureModifiers: [l.modifier] } : {}),
        diagnosisCodePointers: l.diagnosisCodePointers && l.diagnosisCodePointers.length ? l.diagnosisCodePointers : ["1"],
      })),
    },
  };
}

export async function submitProfessionalClaim(payload: any, idempotencyKey: string): Promise<any> {
  const crypto = await import("node:crypto");
  const key = crypto.createHash("sha256").update(idempotencyKey).digest("hex");
  return stediFetch<any>(STEDI_BASE.healthcare, "/change/medicalnetwork/professionalclaims/v3/submission", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(payload),
  });
}

export async function checkClaimStatus(input: {
  trackingNumber: string; payerId: string;
  beginDate: string | Date; endDate: string | Date;
  subscriber: { memberId?: string; firstName: string; lastName: string; dateOfBirth?: string | Date };
}): Promise<any> {
  const cfg = await getStediConfig();
  return stediFetch<any>(STEDI_BASE.healthcare, "/change/medicalnetwork/claimstatus/v2", {
    method: "POST",
    body: JSON.stringify({
      trackingNumber: input.trackingNumber,
      tradingPartnerServiceId: input.payerId,
      encounter: { beginningDateOfService: toYYYYMMDD(input.beginDate), endDateOfService: toYYYYMMDD(input.endDate) },
      providers: [{ npi: cfg.billingNpi, organizationName: cfg.orgName, providerType: "BillingProvider" }],
      subscriber: {
        memberId: input.subscriber.memberId,
        firstName: input.subscriber.firstName,
        lastName: input.subscriber.lastName,
        dateOfBirth: toYYYYMMDD(input.subscriber.dateOfBirth),
      },
    }),
  });
}

// ---- Remittances (835 / ERA) ----
export async function pollTransactions(sinceISO: string, pageToken?: string): Promise<any> {
  const qs = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : `?startDateTime=${encodeURIComponent(sinceISO)}`;
  return stediFetch<any>(STEDI_BASE.core, `/polling/transactions${qs}`, { method: "GET" });
}

export async function getERA835(transactionId: string): Promise<any> {
  return stediFetch<any>(STEDI_BASE.healthcare, `/change/medicalnetwork/reports/v2/${transactionId}/835`, { method: "GET" });
}

// ---- Claim status (277) normalization ----
export type ClaimStatusSummary = {
  category: string;      // Finalized | Pending | Accepted | Rejected | Error | Unknown
  statusCode?: string;   // payer/EDI status category+status codes
  statusText: string;    // human-readable
  paidCents?: number;
  claimNumber?: string;  // payer claim control number
  effectiveStatus: "accepted" | "rejected" | "paid" | "denied" | "pending" | "submitted";
};

/**
 * Turn a Stedi 276/277 claim-status response into a small, human-readable
 * summary. Stedi normalizes the 277 into claims[].claimStatus with category
 * and status codes (Health Care Claim Status Category Codes / Status Codes).
 */
export function normalizeClaimStatus(raw: any): ClaimStatusSummary {
  if (!raw || typeof raw !== "object") {
    return { category: "Unknown", statusText: "No status returned yet.", effectiveStatus: "submitted" };
  }
  // Stedi shapes vary; look through claims[] -> claimStatus, or top-level status.
  const claims: any[] = raw.claims || raw.claimStatus?.claims || [];
  const first = Array.isArray(claims) && claims.length ? claims[0] : raw;
  const status = first?.claimStatus || first?.status || raw?.claimStatus || raw;

  const categoryCode = String(
    status?.statusCategoryCode || status?.categoryCode || status?.claimStatusCategoryCode || "",
  );
  const statusCode = String(status?.statusCode || status?.claimStatusCode || "");
  const description =
    status?.statusCategoryCodeValue || status?.statusCategoryCodeDescription ||
    status?.statusCodeValue || status?.statusCodeDescription ||
    status?.description || "";

  const paidRaw = status?.amountPaid ?? status?.claimPaymentAmount ?? status?.monetaryAmount ?? first?.amountPaid;
  const paidCents = paidRaw != null && paidRaw !== "" ? Math.round(Number(paidRaw) * 100) : undefined;
  const claimNumber =
    status?.payerClaimControlNumber || status?.claimControlNumber || first?.payerClaimControlNumber || undefined;

  // Health Care Claim Status Category Codes (partial map):
  // A* = Acknowledgement, P* = Pending, F* = Finalized, R*/E* = Request/Error, D* = Data reporting
  const cc = categoryCode.toUpperCase();
  let category = "Unknown";
  let effectiveStatus: ClaimStatusSummary["effectiveStatus"] = "submitted";
  if (/^F/.test(cc)) {
    category = "Finalized";
    // F1 forwarded, F2 finalized-payment, F3 finalized-revised, F3F denial etc.
    if ((paidCents ?? 0) > 0 || /F1|F2/.test(cc)) { effectiveStatus = "paid"; }
    else { effectiveStatus = "denied"; }
  } else if (/^P/.test(cc)) { category = "Pending"; effectiveStatus = "accepted"; }
  else if (/^A/.test(cc)) { category = "Accepted"; effectiveStatus = "accepted"; }
  else if (/^R|^E/.test(cc)) { category = "Rejected"; effectiveStatus = "rejected"; }
  else if (/^D/.test(cc)) { category = "Pending"; effectiveStatus = "accepted"; }

  const statusText =
    description ||
    [categoryCode && `Category ${categoryCode}`, statusCode && `Status ${statusCode}`].filter(Boolean).join(" · ") ||
    "Status received.";

  return { category, statusCode: [categoryCode, statusCode].filter(Boolean).join("/") || undefined, statusText, paidCents, claimNumber, effectiveStatus };
}

// ---- Eligibility-derived prior-authorization requirement ----
export type AuthRequirement = {
  required: "required" | "not_required" | "unknown";
  detail: string;
};

/**
 * Prior authorization is NOT submitted via Stedi (no 278 REST endpoint). But the
 * 270/271 eligibility response CAN indicate whether the payer requires prior
 * authorization for a service type via benefitsInformation[].authOrCertIndicator
 * (Y = required, N = not required, U = unknown).
 */
export function extractAuthRequired(raw: any): AuthRequirement {
  const benefits: any[] = Array.isArray(raw?.benefitsInformation) ? raw.benefitsInformation : [];
  const flags = benefits
    .map((b) => String(b?.authOrCertIndicator || "").toUpperCase())
    .filter((v) => v === "Y" || v === "N" || v === "U");
  if (flags.includes("Y")) return { required: "required", detail: "Payer indicates prior authorization / certification IS required for this service." };
  if (flags.length && flags.every((v) => v === "N")) return { required: "not_required", detail: "Payer indicates prior authorization is NOT required for this service." };
  if (flags.includes("U") || flags.length === 0) return { required: "unknown", detail: "Payer did not clearly indicate an authorization requirement. Confirm with the payer." };
  return { required: "unknown", detail: "Authorization requirement unclear from the eligibility response." };
}
