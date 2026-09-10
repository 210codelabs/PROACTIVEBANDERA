import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  getWenoOnlineConfig,
  buildComposeRxUrl,
  encryptWenoData,
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

// ---------------------------------------------------------------------------
// Weno "EZ Integration" (ComposeRx) PAYLOAD contract.
//
// WENO_PAYLOAD_KEYS is the SINGLE SOURCE OF TRUTH for the JSON shape Weno
// requires: EXACTLY these 45 keys, in EXACTLY this order. No key may be added
// or removed. WenoIntegrationService.buildPrescriptionPayload() maps our EMR
// records onto this contract and re-assembles the object in this exact order.
// ---------------------------------------------------------------------------
export const WENO_PAYLOAD_KEYS = [
  "UserEmail",
  "MD5Password",
  "LocationID",
  "TestPatient",
  "PatientType",
  "OrgPatientID",
  "LastName",
  "FirstName",
  "MiddleName",
  "Prefix",
  "Suffix",
  "Gender",
  "DateOfBirth",
  "AddressLine1",
  "AddressLine2",
  "City",
  "State",
  "PostalCode",
  "CountryCode",
  "PrimaryPhone",
  "SupportsSMS",
  "PatientEmail",
  "ResponsiblePartySameAsPatient",
  "ResponsiblePartyLastName",
  "ResponsiblePartyFirstName",
  "ResponsiblePartyAddressLine1",
  "ResponsiblePartyAddressLine2",
  "ResponsiblePartyCity",
  "ResponsiblePartyState",
  "ResponsiblePartyPostalCode",
  "ResponsiblePartyCountryCode",
  "ResponsiblePartyPrimaryPhone",
  "PatientLocation",
  "FacilityName",
  "FacilityAddressLine1",
  "FacilityAddressLine2",
  "FacilityCity",
  "FacilityState",
  "FacilityPostalCode",
  "FacilityCountryCode",
  "FacilityPrimaryPhone",
  "FacilityEmail",
  "FacilityFax",
  "PrimaryPharmacyNCPCP",
  "AlternativePharmacyNCPCP",
] as const;

export type WenoPayloadKey = (typeof WENO_PAYLOAD_KEYS)[number];
export type WenoPayload = Record<WenoPayloadKey, string>;

export type WenoBuildResult = {
  environment: "test" | "production";
  payload: Record<string, string>;
  missing: string[]; // non-fatal: config/credential keys still blank
  patientId: string | null;
  providerId: string | null;
};

/** Thrown when a required record/field is missing while building the payload. */
export class WenoPayloadError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "WenoPayloadError";
    this.status = status;
  }
}

// small string helpers (kept private to this module)
const md5 = (v: string) => crypto.createHash("md5").update(v || "", "utf8").digest("hex");
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const str = (v: unknown) => (v == null ? "" : String(v)).trim();
const MD5_HEX = /^[a-f0-9]{32}$/i;

// Critical patient fields that MUST be present before a prescription payload can
// be built. Each maps to a human-readable, descriptive (Spanish) error label.
const CRITICAL_PATIENT_FIELDS: ReadonlyArray<readonly [WenoPayloadKey, string]> = [
  ["LastName", "el apellido (Last Name)"],
  ["FirstName", "el nombre (First Name)"],
  ["DateOfBirth", "la fecha de nacimiento (Date of Birth)"],
  ["AddressLine1", "la direcci\u00f3n (Address Line 1)"],
  ["City", "la ciudad (City)"],
  ["State", "el estado (State)"],
  ["PostalCode", "el c\u00f3digo postal (Postal Code)"],
];

// Weno "Required 1..1" fields — ALWAYS included even if blank (a valid patient
// never has these blank because buildPrescriptionPayload pre-validates them).
// Every OTHER field is OPTIONAL/CONDITIONAL: per the EZ guide's datatypes
// (an1..N / MailAddressType) an empty string is INVALID, so optional fields are
// OMITTED when we have no value (rather than sent as "").
const REQUIRED_ALWAYS_KEYS = new Set<WenoPayloadKey>([
  "UserEmail",
  "MD5Password",
  "LocationID",
  "TestPatient",
  "PatientType",
  "OrgPatientID",
  "LastName",
  "FirstName",
  "Gender",
  "DateOfBirth",
  "AddressLine1",
  "City",
  "State",
  "PostalCode",
  "CountryCode",
  "PrimaryPhone",
  "SupportsSMS",
  "ResponsiblePartySameAsPatient",
  "PatientLocation",
]);

// Weno's own sample patient — used only when no patientId is supplied so an
// admin can still generate a complete payload for the Weno EZ validator.
const SAMPLE_PATIENT = {
  OrgPatientID: "12537",
  LastName: "Satterfield",
  FirstName: "Ryan",
  MiddleName: "J",
  Prefix: "Mr",
  Suffix: "MS",
  Gender: "F",
  DateOfBirth: "1994-06-18",
  AddressLine1: "224",
  AddressLine2: "Richmond Ranch Rd",
  City: "Texarkana",
  State: "TX",
  PostalCode: "75503",
  PrimaryPhone: "8776543210",
  PatientEmail: "qa.patient@yopmail.com",
  PrimaryPharmacyNCPCP: "1234567",
  AlternativePharmacyNCPCP: "1234567",
};

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
        "Weno EZ Integration is not configured. An encryption key, prescriber email/password and location ID are required (Admin \u2192 External Integrations \u2192 Weno EZ Integration, or WENO_* environment variables).",
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

  /**
   * Resolve the three Weno account credentials for the payload, PREFERRING
   * environment variables (never hardcoded). The password is MD5-hashed before
   * injection; if the env var already holds a 32-char hex MD5 it is used as-is.
   *   UserEmail   <- WENO_USER_EMAIL | WENO_PRESCRIBER_EMAIL | WENO_ONLINE_EMAIL | cfg
   *   LocationID  <- WENO_LOCATION_ID | WENO_ONLINE_LOCATION | cfg
   *   MD5Password <- WENO_MD5_PASSWORD (already hashed) | md5(WENO_PASSWORD |
   *                  WENO_PRESCRIBER_PASSWORD | WENO_ONLINE_PASSWORD | cfg)
   */
  resolveCredentials(cfg: WenoOnlineConfig): { userEmail: string; md5Password: string; locationId: string } {
    const userEmail = str(
      process.env.WENO_USER_EMAIL ||
        process.env.WENO_PRESCRIBER_EMAIL ||
        process.env.WENO_ONLINE_EMAIL ||
        cfg.providerEmail,
    );
    const locationId = str(
      process.env.WENO_LOCATION_ID || process.env.WENO_ONLINE_LOCATION || cfg.locationId,
    );

    const preHashed = str(process.env.WENO_MD5_PASSWORD);
    const plain = str(
      process.env.WENO_PASSWORD ||
        process.env.WENO_PRESCRIBER_PASSWORD ||
        process.env.WENO_ONLINE_PASSWORD ||
        cfg.providerPassword,
    );
    let md5Password = "";
    if (preHashed && MD5_HEX.test(preHashed)) md5Password = preHashed.toLowerCase();
    else if (plain) md5Password = MD5_HEX.test(plain) ? plain.toLowerCase() : md5(plain);

    return { userEmail, md5Password, locationId };
  }

  /**
   * buildPrescriptionPayload(patientId, providerId)
   *
   * 1) Data extraction  — reads the patient chart (demographics, address, phone,
   *    email) and the prescriber/provider (User) record from the DB.
   * 2) Strict mapping   — maps our internal fields onto the EXACT Weno contract.
   * 3) Pre-validation   — throws a descriptive WenoPayloadError when a critical
   *    patient field (DOB, postal code, name, address, city, state) is missing.
   * 4) Output           — returns a clean object whose keys match WENO_PAYLOAD_KEYS
   *    EXACTLY (same fields, same order), ready to be encrypted per Weno's flow.
   *
   * A falsy patientId uses Weno's sample patient (developer/validator convenience).
   */
  async buildPrescriptionPayload(
    patientId?: string | null,
    providerId?: string | null,
  ): Promise<WenoBuildResult> {
    const cfg = await this.getConfig();
    const creds = this.resolveCredentials(cfg);

    // --- 1) Data extraction -------------------------------------------------
    let p: any = null;
    if (patientId) {
      p = await db.patient.findUnique({ where: { id: patientId } }).catch(() => null);
      if (!p) throw new WenoPayloadError(`No se encontr\u00f3 el paciente con id "${patientId}".`, 404);
    }

    // Prescriber/provider record (NPI, DEA, name). Optional: NPI/DEA are carried
    // by the Weno account (UserEmail/MD5Password/LocationID) and have no key in
    // this schema, but we still load/verify the record for authorization/audit.
    // Not-found is non-fatal (the caller already authorized the session role);
    // a found record with a non-prescriber role IS rejected.
    if (providerId) {
      const prov = await db.user.findUnique({ where: { id: providerId } }).catch(() => null);
      if (prov && !["provider", "admin"].includes(prov.role)) {
        throw new WenoPayloadError("El proveedor seleccionado no tiene rol de prescriptor.", 422);
      }
    }

    // --- 2) Strict mapping (internal -> Weno keys) --------------------------
    const pt = p
      ? {
          OrgPatientID: str(p.id),
          LastName: str(p.lastName),
          FirstName: str(p.firstName),
          MiddleName: str(p.middleName),
          Prefix: str(p.prefix),
          Suffix: str(p.suffix),
          Gender: (str(p.sex) || "U").slice(0, 1).toUpperCase(),
          DateOfBirth: p.dob ? new Date(p.dob).toISOString().slice(0, 10) : "",
          AddressLine1: str(p.addressLine1),
          AddressLine2: str(p.addressLine2),
          City: str(p.city),
          State: str(p.state),
          PostalCode: str(p.postalCode),
          CountryCode: str(p.country) || "US",
          PrimaryPhone: digits(p.phone),
          PatientEmail: str(p.email),
          PrimaryPharmacyNCPCP: str(p.primaryPharmacyNcpdp),
          AlternativePharmacyNCPCP: str(p.alternativePharmacyNcpdp),
        }
      : { ...SAMPLE_PATIENT, CountryCode: "US" };

    // Responsible party. Weno's validator requires every ResponsibleParty* field
    // to be NON-EMPTY (datatypes an1..N / Integer reject ""). Our chart does not
    // store a full responsible-party address, so the patient is their own
    // responsible party (SameAsPatient="Y") mirroring the patient's demographics.
    const rp = {
      same: "Y",
      last: pt.LastName,
      first: pt.FirstName,
      addr1: pt.AddressLine1,
      addr2: pt.AddressLine2 || pt.AddressLine1,
      city: pt.City,
      state: pt.State,
      postal: pt.PostalCode,
      country: pt.CountryCode || "US",
      phone: pt.PrimaryPhone,
    };

    // Facility. Weno also requires Facility* fields to be non-empty. We do not
    // track a facility on the chart, so we read clinic env vars with a demo
    // fallback (override later from a clinic-settings record).
    const fac = {
      name: str(process.env.CLINIC_NAME) || "Proactive Clinic",
      addr1: str(process.env.CLINIC_ADDRESS1) || "100 Main St",
      addr2: str(process.env.CLINIC_ADDRESS2) || "Suite 200",
      city: str(process.env.CLINIC_CITY) || "Dallas",
      state: str(process.env.CLINIC_STATE) || "TX",
      postal: str(process.env.CLINIC_POSTAL) || "75201",
      country: str(process.env.CLINIC_COUNTRY) || "US",
      phone: digits(process.env.CLINIC_PHONE) || "2145550100",
      email: str(process.env.CLINIC_EMAIL) || "clinic@proactiveclinic.com",
      fax: digits(process.env.CLINIC_FAX) || "1212121212",
    };

    // --- 3) Build the exact 45-key object, in the exact contract order ------
    const values: WenoPayload = {
      UserEmail: creds.userEmail,
      MD5Password: creds.md5Password,
      LocationID: creds.locationId,
      TestPatient: cfg.environment === "production" ? "N" : "Y",
      PatientType: "Human",
      OrgPatientID: pt.OrgPatientID,
      LastName: pt.LastName,
      FirstName: pt.FirstName,
      MiddleName: pt.MiddleName,
      Prefix: pt.Prefix,
      Suffix: pt.Suffix,
      Gender: pt.Gender,
      DateOfBirth: pt.DateOfBirth,
      AddressLine1: pt.AddressLine1,
      AddressLine2: pt.AddressLine2,
      City: pt.City,
      State: pt.State,
      PostalCode: pt.PostalCode,
      CountryCode: pt.CountryCode || "US",
      PrimaryPhone: pt.PrimaryPhone,
      SupportsSMS: "N",
      PatientEmail: pt.PatientEmail,
      ResponsiblePartySameAsPatient: rp.same,
      ResponsiblePartyLastName: rp.last,
      ResponsiblePartyFirstName: rp.first,
      ResponsiblePartyAddressLine1: rp.addr1,
      ResponsiblePartyAddressLine2: rp.addr2,
      ResponsiblePartyCity: rp.city,
      ResponsiblePartyState: rp.state,
      ResponsiblePartyPostalCode: rp.postal,
      ResponsiblePartyCountryCode: rp.country,
      ResponsiblePartyPrimaryPhone: rp.phone,
      PatientLocation: "Home",
      FacilityName: fac.name,
      FacilityAddressLine1: fac.addr1,
      FacilityAddressLine2: fac.addr2,
      FacilityCity: fac.city,
      FacilityState: fac.state,
      FacilityPostalCode: fac.postal,
      FacilityCountryCode: fac.country,
      FacilityPrimaryPhone: fac.phone,
      FacilityEmail: fac.email,
      FacilityFax: fac.fax,
      PrimaryPharmacyNCPCP: pt.PrimaryPharmacyNCPCP,
      AlternativePharmacyNCPCP: pt.AlternativePharmacyNCPCP,
    };

    // --- 4) Pre-validation (only for a real patient) ------------------------
    if (p) {
      const missingCritical = CRITICAL_PATIENT_FIELDS.filter(
        ([k]) => !String(values[k] || "").trim(),
      ).map(([, label]) => label);
      if (missingCritical.length) {
        throw new WenoPayloadError(
          `Error: el paciente requiere ${missingCritical.join(", ")} para la receta electr\u00f3nica (Weno EZ).`,
        );
      }
    }

    // Re-assemble in contract order. Include a field when it is REQUIRED (always)
    // or when it has a non-empty value; OMIT empty optional/conditional fields so
    // Weno's datatype validation (an1..N / MailAddressType) does not reject "".
    const payload: Record<string, string> = {};
    for (const k of WENO_PAYLOAD_KEYS) {
      const v = String(values[k] ?? "");
      if (REQUIRED_ALWAYS_KEYS.has(k) || v.trim() !== "") payload[k] = v;
    }

    // Non-fatal: which credential keys are still blank (helps admins configure).
    const credKeys: WenoPayloadKey[] = ["UserEmail", "MD5Password", "LocationID"];
    const missing = credKeys.filter((k) => !String(payload[k] || "").trim());

    return {
      environment: cfg.environment,
      payload,
      missing,
      patientId: patientId || null,
      providerId: providerId || null,
    };
  }

  /**
   * buildLaunchUrl(patientId, providerId)
   *
   * Connects the sso-payload output to Weno's ComposeRx SSO: it builds the exact
   * 45-field payload (buildPrescriptionPayload), then encrypts + encodes it per
   * the official Weno EZ Integration guide and returns the launch/iFrame URL.
   *
   * Crypto (Weno EZ guide): AES-256-CBC, key = SHA-256(EZ encryption key),
   * IV = 16 zero bytes, ciphertext -> Base64 -> URL-encoded as `data`.
   * URL: <WENO_COMPOSE_URL>?useremail=<UserEmail>&data=<encoded>
   * (always online.wenoexchange.com; TEST mode is account + TestPatient driven).
   *
   * The returned URL embeds encrypted PHI + credential-derived material and MUST
   * NOT be logged or persisted.
   */
  async buildLaunchUrl(
    patientId: string,
    providerId?: string | null,
  ): Promise<{ iframeUrl: string; environment: "test" | "production" }> {
    const { payload, environment } = await this.buildPrescriptionPayload(patientId, providerId);
    const cfg = await this.getConfig();

    if (!cfg.ehrEncryptionKey) {
      throw new WenoOnlineError(
        "Weno EZ Integration is not configured: the EZ encryption key is missing (WENO_ONLINE_KEY / Admin \u2192 External Integrations \u2192 Weno EZ Integration).",
        400,
      );
    }
    if (!payload.UserEmail || !payload.MD5Password || !payload.LocationID) {
      throw new WenoOnlineError(
        "Weno EZ Integration is not configured: a prescriber email, password and Location ID are required (WENO_USER_EMAIL / WENO_PASSWORD|WENO_MD5_PASSWORD / WENO_LOCATION_ID).",
        400,
      );
    }

    const data = encryptWenoData(JSON.stringify(payload), cfg.ehrEncryptionKey);
    const base =
      (process.env.WENO_COMPOSE_URL || "").trim() ||
      "https://online.wenoexchange.com/en/NewRx/ComposeRx";
    const u = new URL(base);
    u.searchParams.set("useremail", payload.UserEmail);
    u.searchParams.set("data", data); // URLSearchParams applies the required encoding
    return { iframeUrl: u.toString(), environment };
  }

  /**
   * fetchRxSyncReport(fromDate, toDate)
   *
   * Pulls Weno's "NewRx Sync Report" (signed/sent prescriptions) so ComposeRx
   * prescriptions can be imported into the EHR medication history. Per the EZ
   * guide: GET /en/EPCS/DownloadNewRxSyncDataVal with an encrypted JSON of
   * { UserEmail, MD5Password, FromDate, ToDate, ResponseFormat }. Max 7-day
   * window. Response is JSON (preferred) or CSV; we parse both defensively.
   * Row.PatientID corresponds to our OrgPatientID (patient.id).
   */
  async fetchRxSyncReport(
    fromDate: string,
    toDate: string,
  ): Promise<{ rows: RxSyncRow[]; environment: "test" | "production" }> {
    const cfg = await this.getConfig();
    const creds = this.resolveCredentials(cfg);
    if (!cfg.ehrEncryptionKey || !creds.userEmail || !creds.md5Password) {
      throw new WenoOnlineError(
        "Weno EZ Integration is not configured (encryption key, prescriber email and password are required).",
        400,
      );
    }

    const reqObj = {
      UserEmail: creds.userEmail,
      MD5Password: creds.md5Password,
      FromDate: fromDate,
      ToDate: toDate,
      ResponseFormat: "JSON",
    };
    const data = encryptWenoData(JSON.stringify(reqObj), cfg.ehrEncryptionKey);

    const composeBase =
      (process.env.WENO_COMPOSE_URL || "").trim() || "https://online.wenoexchange.com/en/NewRx/ComposeRx";
    const origin = new URL(composeBase).origin;
    const syncBase = (process.env.WENO_SYNC_URL || "").trim() || `${origin}/en/EPCS/DownloadNewRxSyncDataVal`;
    const u = new URL(syncBase);
    u.searchParams.set("useremail", creds.userEmail);
    u.searchParams.set("data", data);

    const resp = await fetch(u.toString(), { method: "GET", cache: "no-store" });
    const text = await resp.text();
    if (!resp.ok) {
      throw new WenoOnlineError(`Weno sync report request failed (HTTP ${resp.status}).`, 502);
    }
    return { rows: parseRxSync(text), environment: cfg.environment };
  }

  /**
   * buildRxLogUrl() — the Weno RxLog page URL to embed in an iFrame so users can
   * view their Rx log on demand inside the EHR. Encrypted JSON {UserEmail,
   * MD5Password} per the EZ guide -> GET /en/EPCS/RxLog?useremail=&data=.
   */
  async buildRxLogUrl(): Promise<{ iframeUrl: string; environment: "test" | "production" }> {
    const cfg = await this.getConfig();
    const creds = this.resolveCredentials(cfg);
    if (!cfg.ehrEncryptionKey || !creds.userEmail || !creds.md5Password) {
      throw new WenoOnlineError(
        "Weno EZ Integration is not configured (encryption key, prescriber email and password are required).",
        400,
      );
    }
    const data = encryptWenoData(
      JSON.stringify({ UserEmail: creds.userEmail, MD5Password: creds.md5Password }),
      cfg.ehrEncryptionKey,
    );
    const composeBase =
      (process.env.WENO_COMPOSE_URL || "").trim() || "https://online.wenoexchange.com/en/NewRx/ComposeRx";
    const origin = new URL(composeBase).origin;
    const base = (process.env.WENO_RXLOG_URL || "").trim() || `${origin}/en/EPCS/RxLog`;
    const u = new URL(base);
    u.searchParams.set("useremail", creds.userEmail);
    u.searchParams.set("data", data);
    return { iframeUrl: u.toString(), environment: cfg.environment };
  }
}

// A normalized row of the Weno NewRx Sync Report.
export type RxSyncRow = {
  dateUtc: string;
  patientId: string; // == our OrgPatientID (patient.id)
  prescriberWenoId: string;
  synchType: string;
  relatesToMsgId: string;
  deliveryMethod: string;
  deliveryStatus: string;
  drug: string; // "Prescribe" column, e.g. "Lipitor 20 MG Oral Tablet"
};

const RX_SYNC_ALIASES: Record<keyof RxSyncRow, string[]> = {
  dateUtc: ["datetimeofactioninutc", "datetimeofaction", "dateissuedutc", "dateissued", "date"],
  patientId: ["patientid", "orgpatientid"],
  prescriberWenoId: ["prescriberwenoid", "prescriberid", "prescriber"],
  synchType: ["synchtype", "synctype", "type"],
  relatesToMsgId: ["relatestonewrxmsgid", "relatestomsgid", "newrxmsgid", "messageid", "msgid"],
  deliveryMethod: ["deliverymethod", "method"],
  deliveryStatus: ["deliverystatus", "status", "rxstatus"],
  drug: ["prescribe", "drug", "drugname", "medication", "medicationname", "drugdescription"],
};

const norm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function rowFromObject(obj: Record<string, unknown>): RxSyncRow {
  const map: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) map[norm(k)] = obj[k];
  const get = (aliases: string[]) => {
    for (const a of aliases) if (map[a] != null && String(map[a]).trim() !== "") return String(map[a]).trim();
    return "";
  };
  return {
    dateUtc: get(RX_SYNC_ALIASES.dateUtc),
    patientId: get(RX_SYNC_ALIASES.patientId),
    prescriberWenoId: get(RX_SYNC_ALIASES.prescriberWenoId),
    synchType: get(RX_SYNC_ALIASES.synchType),
    relatesToMsgId: get(RX_SYNC_ALIASES.relatesToMsgId),
    deliveryMethod: get(RX_SYNC_ALIASES.deliveryMethod),
    deliveryStatus: get(RX_SYNC_ALIASES.deliveryStatus),
    drug: get(RX_SYNC_ALIASES.drug),
  };
}

// Split a single CSV line honoring double-quoted fields (which may contain commas).
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur); cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// Parse the Weno sync response as JSON (array/obj) or CSV into normalized rows.
export function parseRxSync(text: string): RxSyncRow[] {
  const t = (text || "").trim();
  if (!t) return [];
  // JSON
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const parsed = JSON.parse(t);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as any).data)
          ? (parsed as any).data
          : Array.isArray((parsed as any).rows)
            ? (parsed as any).rows
            : Array.isArray((parsed as any).Report)
              ? (parsed as any).Report
              : [];
      return arr
        .filter((o: unknown) => o && typeof o === "object")
        .map((o: Record<string, unknown>) => rowFromObject(o))
        .filter((r: RxSyncRow) => r.patientId || r.drug);
    } catch {
      /* fall through to CSV */
    }
  }
  // CSV
  const lines = t.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map(norm);
  const rows: RxSyncRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => { obj[h] = cells[idx] ?? ""; });
    const row = rowFromObject(obj);
    if (row.patientId || row.drug) rows.push(row);
  }
  return rows;
}

export { WenoOnlineError };
