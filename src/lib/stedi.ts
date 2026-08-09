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
    environment: creds.ENVIRONMENT || "test",
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
  const body = await stediFetch<any>(STEDI_BASE.payers, "/payers?pageSize=1", { method: "GET", apiKey });
  const items = body?.items || body?.payers || [];
  return { ok: true, sample: Array.isArray(items) ? items[0] : undefined };
}
