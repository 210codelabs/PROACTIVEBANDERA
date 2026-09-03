import {
  getWenoOnlineConfig,
  buildComposeRxUrl,
  isWenoOnlineConfigured,
  WenoOnlineError,
  type WenoOnlineConfig,
} from "@/lib/wenoOnline";

// -----------------------------------------------------------------------------
// WenoIntegrationService
//
// Encapsulates all Weno "EZ Integration" (ComposeRx iFrame SSO) logic so route
// handlers stay thin. It reuses the AES-256-CBC ComposeRx contract already
// implemented in src/lib/wenoOnline.ts (single source of truth for the crypto
// and URL format) and adds:
//   - config resolution with an environment-variable fallback, and
//   - strict, field-by-field patient validation for 400 responses.
//
// REALITY CHECK: the ComposeRx crypto/URL is reverse-engineered from the public
// OpenEMR Weno module. A live launch still requires a real Weno EZ account,
// registered prescriber/location, IP allowlisting and Weno certification. This
// service does NOT claim live delivery / EPCS / DEA compliance.
// -----------------------------------------------------------------------------

// [patient field key, human label] used to report exactly which field is missing.
const REQUIRED_PATIENT_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["dob", "Date of birth"],
  ["gender", "Gender"],
  ["address1", "Address"],
  ["city", "City"],
  ["state", "State"],
  ["postalCode", "ZIP / postal code"],
];

export type EzPatient = {
  id: string;
  firstName: string;
  lastName: string;
  dob: string; // yyyy-MM-dd
  gender: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  phone?: string;
};

export type EzPrescriber = {
  id: string;
  npi: string;
  firstName: string;
  lastName: string;
  email: string;
};

export class WenoIntegrationService {
  private cfg: WenoOnlineConfig | null = null;

  /**
   * Resolve Weno config from the DB-backed integration store, falling back to
   * server environment variables (EZ names, then the existing WENO_ONLINE_*).
   * Secrets never leave the server.
   */
  async getConfig(): Promise<WenoOnlineConfig> {
    if (this.cfg) return this.cfg;
    const base = await getWenoOnlineConfig();
    const envEnv = (process.env.WENO_ENV || process.env.WENO_ONLINE_ENV || "").toLowerCase();
    const merged: WenoOnlineConfig = {
      ...base,
      ehrEncryptionKey: base.ehrEncryptionKey || process.env.WENO_ENCRYPTION_KEY || process.env.WENO_ONLINE_KEY || "",
      providerEmail: base.providerEmail || process.env.WENO_PRESCRIBER_EMAIL || process.env.WENO_ONLINE_EMAIL || "",
      providerPassword: base.providerPassword || process.env.WENO_PRESCRIBER_PASSWORD || process.env.WENO_ONLINE_PASSWORD || "",
      locationId: base.locationId || process.env.WENO_LOCATION_ID || process.env.WENO_ONLINE_LOCATION || "",
      environment: base.environment || (envEnv.startsWith("prod") ? "production" : "test"),
    };
    this.cfg = merged;
    return merged;
  }

  isConfigured(cfg: WenoOnlineConfig): boolean {
    return isWenoOnlineConfigured(cfg);
  }

  /** Returns { ok, missing:[human labels] } for the required demographics. */
  validatePatient(p: Partial<EzPatient>): { ok: boolean; missing: string[] } {
    const missing: string[] = [];
    for (const [key, label] of REQUIRED_PATIENT_FIELDS) {
      if (!String((p as Record<string, unknown>)[key] ?? "").trim()) missing.push(label);
    }
    return { ok: missing.length === 0, missing };
  }

  /**
   * Build the authenticated ComposeRx iFrame URL for a validated patient.
   * Throws WenoOnlineError(400) when the integration is not configured.
   * The returned URL embeds encrypted PHI + credential-derived material and
   * MUST NOT be logged or persisted.
   */
  async buildIframeUrl(
    patient: EzPatient,
    prescriber: EzPrescriber,
    opts?: { primaryPharmacyNcpdp?: string; orgTransactionId?: string },
  ): Promise<{ iframeUrl: string; environment: "test" | "production" }> {
    const cfg = await this.getConfig();
    if (!this.isConfigured(cfg)) {
      throw new WenoOnlineError(
        "Weno EZ Integration is not configured. An encryption key, prescriber email/password and location ID are required (Admin \u2192 External Integrations \u2192 Weno Online, or WENO_* environment variables).",
        400,
      );
    }
    // useremail must be a REGISTERED Weno prescriber account email; we use the
    // configured account email rather than the EHR user's email to avoid a
    // prescriber/account mismatch. prescriber.npi/name are used for auditing.
    const { url } = buildComposeRxUrl(cfg, patient, {
      primaryPharmacyNcpdp: opts?.primaryPharmacyNcpdp,
      orgTransactionId: opts?.orgTransactionId,
    });
    return { iframeUrl: url, environment: cfg.environment };
  }
}

export { WenoOnlineError };
