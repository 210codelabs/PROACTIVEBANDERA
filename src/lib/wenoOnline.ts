import crypto from "node:crypto";
import { readIntegrations } from "@/lib/integrations/store";

// -----------------------------------------------------------------------------
// Weno EZ Integration ("EZ Integration" / ComposeRx) e-prescribing LAUNCHER.
//
// This is a DIFFERENT mechanism from the SOAP/NCPDP SCRIPT "Switch" client in
// src/lib/weno.ts. Weno EZ Integration is a browser deep-link: the EHR encrypts patient
// + prescriber context with the account's "EHR Encryption Key" and hands the
// clinician a pre-filled ComposeRx URL in Weno's web app.
//
// Crypto contract (compatible with the OpenEMR Weno module reference impl):
//   AES-256-CBC, key = SHA-256(EHR Encryption Key) -> 32 raw bytes,
//   IV = 16 zero bytes, PKCS#7 padding, plaintext = UTF-8 JSON,
//   ciphertext -> Base64 -> URL-encoded as the `data` query param.
//
// IMPORTANT REALITY: this is a best-effort, reverse-engineered contract. Weno
// can change the route/schema/crypto. Production launch requires a real Weno
// account, provider/location mapping, IP allowlisting and Weno certification.
// Secrets are read from the DB-backed integration store; never hardcoded here.
// -----------------------------------------------------------------------------

export type WenoOnlineConfig = {
  enabled: boolean;
  environment: "test" | "production";
  ehrEncryptionKey: string;
  locationId: string;
  providerEmail: string;
  providerPassword: string;
  wenoUserId: string;
  composeBase: string;
  prescriberNpi: string;
  prescriberDea: string;
  prescriberFirst: string;
  prescriberLast: string;
};

export class WenoOnlineError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

const LIVE_BASE = "https://online.wenoexchange.com/en/NewRx/ComposeRx";
const TEST_BASE = "https://test.wenoexchange.com/en/NewRx/ComposeRx";

export async function getWenoOnlineConfig(): Promise<WenoOnlineConfig> {
  const state = await readIntegrations();
  const p = state.providers["weno-online"];
  const c = p?.credentials || {};
  const env = (String(c.ENVIRONMENT || "test").toLowerCase().startsWith("prod")
    ? "production"
    : "test") as "test" | "production";
  const composeBase =
    (c.COMPOSE_URL_OVERRIDE || "").trim() || (env === "production" ? LIVE_BASE : TEST_BASE);
  return {
    enabled: Boolean(p?.enabled),
    environment: env,
    ehrEncryptionKey: c.EHR_ENCRYPTION_KEY || "",
    locationId: c.LOCATION_ID || "",
    providerEmail: c.PROVIDER_EMAIL || "",
    providerPassword: c.PROVIDER_PASSWORD || "",
    wenoUserId: c.WENO_USER_ID || "",
    composeBase,
    prescriberNpi: c.PRESCRIBER_NPI || "",
    prescriberDea: c.PRESCRIBER_DEA || "",
    prescriberFirst: c.PRESCRIBER_FIRST_NAME || "",
    prescriberLast: c.PRESCRIBER_LAST_NAME || "",
  };
}

/** True when Weno EZ Integration has everything it needs to build a launch URL. */
export function isWenoOnlineConfigured(cfg: WenoOnlineConfig): boolean {
  return Boolean(
    cfg.ehrEncryptionKey && cfg.providerEmail && cfg.providerPassword && cfg.locationId,
  );
}

/**
 * Encrypt a payload for Weno EZ Integration.
 * AES-256-CBC | key=SHA-256(ehrKey) | IV=16 zero bytes | PKCS#7 | Base64 out.
 */
export function encryptWenoData(plaintext: string, ehrEncryptionKey: string): string {
  if (!ehrEncryptionKey) throw new WenoOnlineError("Missing Weno EHR Encryption Key.", 400);
  const key = crypto.createHash("sha256").update(ehrEncryptionKey, "utf8").digest(); // 32 bytes
  const iv = Buffer.alloc(16, 0); // 16 zero bytes (legacy Weno contract)
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv); // PKCS#7 padding by default
  return Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("base64");
}

export type WenoOnlinePatient = {
  id?: string;
  firstName: string;
  lastName: string;
  gender?: string;
  dob?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
};

/**
 * Build the pre-filled ComposeRx launch URL for a patient. The returned URL
 * embeds an encrypted `data` blob containing patient + prescriber context and
 * MUST NOT be logged (it is PHI + credential-derived material).
 */
export function buildComposeRxUrl(
  cfg: WenoOnlineConfig,
  patient: WenoOnlinePatient,
  opts?: { primaryPharmacyNcpdp?: string; providerEmail?: string; orgTransactionId?: string },
): { url: string } {
  const email = (opts?.providerEmail || cfg.providerEmail || "").trim();
  if (!email)
    throw new WenoOnlineError(
      "A Weno provider email is required. Set it in Admin \u2192 External Integrations \u2192 Weno EZ Integration.",
      400,
    );
  if (!cfg.providerPassword)
    throw new WenoOnlineError(
      "A Weno provider password is required (used to derive the launch token). Set it in Admin \u2192 External Integrations \u2192 Weno EZ Integration.",
      400,
    );
  if (!cfg.locationId)
    throw new WenoOnlineError(
      "A Weno Location ID is required. Set it in Admin \u2192 External Integrations \u2192 Weno EZ Integration.",
      400,
    );

  const payload: Record<string, string> = {
    UserEmail: email,
    MD5Password: crypto.createHash("md5").update(cfg.providerPassword, "utf8").digest("hex"),
    LocationID: cfg.locationId,
    TestPatient: cfg.environment === "test" ? "Y" : "N",
    PatientType: "Human",
    OrgPatientID: patient.id || "",
    LastName: patient.lastName || "",
    FirstName: patient.firstName || "",
    Gender: (patient.gender || "U").slice(0, 1).toUpperCase(),
    DateOfBirth: patient.dob || "",
    AddressLine1: patient.address1 || "",
    City: patient.city || "",
    State: patient.state || "",
    PostalCode: patient.postalCode || "",
    CountryCode: "US",
    PrimaryPhone: (patient.phone || "").replace(/\D/g, ""),
    SupportsSMS: "N",
    PatientLocation: "Home",
    ResponsiblePartySameAsPatient: "Y",
  };
  if (opts?.primaryPharmacyNcpdp) payload.PrimaryPharmacyNCPCP = opts.primaryPharmacyNcpdp;
  if (opts?.orgTransactionId) payload.OrgTransactionID = opts.orgTransactionId;

  const data = encryptWenoData(JSON.stringify(payload), cfg.ehrEncryptionKey);
  const u = new URL(cfg.composeBase);
  u.searchParams.set("useremail", email);
  u.searchParams.set("data", data); // URLSearchParams handles the required encoding
  return { url: u.toString() };
}
