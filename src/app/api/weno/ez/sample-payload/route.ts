import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { WenoIntegrationService } from "@/lib/weno/ezIntegration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRESCRIBER_ROLES = ["provider", "admin"];
const md5 = (s: string) => crypto.createHash("md5").update(s || "", "utf8").digest("hex");
const digits = (s: string) => String(s || "").replace(/\D/g, "");
const s = (v: unknown) => (v == null ? "" : String(v)).trim();

// -----------------------------------------------------------------------------
// Weno "EZ Integration" (ComposeRx) payload contract.
//
// WENO_PAYLOAD_KEYS is the SINGLE SOURCE OF TRUTH for the shape Weno requires:
// EXACTLY these 45 keys, in EXACTLY this order. No key may be added or removed.
// buildWenoPrescriptionPayload() maps our EMR records onto this contract and
// guarantees the output object's key order matches this array 1:1.
// -----------------------------------------------------------------------------
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

// Critical patient fields that MUST be present before a prescription payload can
// be built. Each maps to a human-readable, descriptive error message.
const CRITICAL_PATIENT_FIELDS: ReadonlyArray<readonly [WenoPayloadKey, string]> = [
  ["LastName", "el apellido (Last Name)"],
  ["FirstName", "el nombre (First Name)"],
  ["DateOfBirth", "la fecha de nacimiento (Date of Birth)"],
  ["AddressLine1", "la dirección (Address Line 1)"],
  ["City", "la ciudad (City)"],
  ["State", "el estado (State)"],
  ["PostalCode", "el código postal (Postal Code)"],
];

/** Thrown when a required record/field is missing while building the payload. */
export class WenoPayloadError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "WenoPayloadError";
    this.status = status;
  }
}

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

export type BuildResult = {
  environment: "test" | "production";
  payload: WenoPayload;
  missing: string[]; // non-fatal: config/optional keys still blank
  patientId: string | null;
  providerId: string | null;
};

// -----------------------------------------------------------------------------
// buildWenoPrescriptionPayload(patientId, providerId)
//
// 1. Data extraction — reads the patient chart (demographics, address, phone,
//    email) and the prescriber/provider record (NPI, DEA, name) from the DB.
// 2. Strict mapping — maps our internal fields onto the exact Weno key contract.
// 3. Pre-validation — throws a descriptive WenoPayloadError if a critical field
//    (DOB, postal code, name, address, city, state) is missing.
// 4. Output — returns a clean JSON object whose keys match WENO_PAYLOAD_KEYS
//    exactly (same fields, same order), ready to be encrypted per Weno's flow.
//
// Passing a falsy patientId uses Weno's sample patient (validator convenience).
// -----------------------------------------------------------------------------
export async function buildWenoPrescriptionPayload(
  patientId?: string | null,
  providerId?: string | null,
): Promise<BuildResult> {
  const svc = new WenoIntegrationService();
  const cfg = await svc.getConfig();

  // --- 1) Data extraction ---------------------------------------------------
  let p: any = null;
  if (patientId) {
    p = await db.patient.findUnique({ where: { id: patientId } }).catch(() => null);
    if (!p) throw new WenoPayloadError(`No se encontró el paciente con id "${patientId}".`, 404);
  }

  // Prescriber/provider record (NPI, DEA, name). Optional: when absent we fall
  // back to the configured Weno prescriber. NPI/DEA are carried by the Weno
  // account (UserEmail/MD5Password/LocationID) and have no key in this schema,
  // but we still load the record so callers can audit / future-proof mapping.
  let prov: any = null;
  if (providerId) {
    prov = await db.user.findUnique({ where: { id: providerId } }).catch(() => null);
    if (!prov) throw new WenoPayloadError(`No se encontró el proveedor con id "${providerId}".`, 404);
    if (!PRESCRIBER_ROLES.includes(prov.role)) {
      throw new WenoPayloadError("El proveedor seleccionado no tiene rol de prescriptor.", 422);
    }
  }

  // --- 2) Strict mapping (internal -> Weno keys) ----------------------------
  const pt = p
    ? {
        OrgPatientID: s(p.id),
        LastName: s(p.lastName),
        FirstName: s(p.firstName),
        MiddleName: s(p.middleName),
        Prefix: s(p.prefix),
        Suffix: s(p.suffix),
        Gender: (s(p.sex) || "U").slice(0, 1).toUpperCase(),
        DateOfBirth: p.dob ? new Date(p.dob).toISOString().slice(0, 10) : "",
        AddressLine1: s(p.addressLine1),
        AddressLine2: s(p.addressLine2),
        City: s(p.city),
        State: s(p.state),
        PostalCode: s(p.postalCode),
        CountryCode: s(p.country) || "US",
        PrimaryPhone: digits(p.phone),
        PatientEmail: s(p.email),
        PrimaryPharmacyNCPCP: s(p.primaryPharmacyNcpdp),
        AlternativePharmacyNCPCP: s(p.alternativePharmacyNcpdp),
        // Responsible party — map from real emergency-contact data when present.
        ecName: s(p.ecName),
        ecPhone: digits(p.ecPhone),
      }
    : { ...SAMPLE_PATIENT, CountryCode: "US", ecName: "", ecPhone: "" };

  // Responsible party: if our chart has a distinct emergency contact, map it and
  // set SameAsPatient = "N"; otherwise the patient is their own responsible party.
  const rp = pt.ecName
    ? (() => {
        const parts = pt.ecName.split(/\s+/);
        const rpFirst = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "";
        const rpLast = parts.length > 1 ? parts[parts.length - 1] : "";
        return {
          same: "N",
          last: rpLast,
          first: rpFirst,
          phone: pt.ecPhone,
        };
      })()
    : { same: "Y", last: "", first: "", phone: "" };

  // --- 3) Build the exact 45-key object, in the exact contract order --------
  const values: WenoPayload = {
    UserEmail: s(cfg.providerEmail),
    MD5Password: cfg.providerPassword ? md5(cfg.providerPassword) : "",
    LocationID: s(cfg.locationId),
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
    ResponsiblePartyAddressLine1: "",
    ResponsiblePartyAddressLine2: "",
    ResponsiblePartyCity: "",
    ResponsiblePartyState: "",
    ResponsiblePartyPostalCode: "",
    ResponsiblePartyCountryCode: rp.same === "N" ? "US" : "US",
    ResponsiblePartyPrimaryPhone: rp.phone,
    PatientLocation: "Home",
    FacilityName: "",
    FacilityAddressLine1: "",
    FacilityAddressLine2: "",
    FacilityCity: "",
    FacilityState: "",
    FacilityPostalCode: "",
    FacilityCountryCode: "US",
    FacilityPrimaryPhone: "",
    FacilityEmail: "",
    FacilityFax: "",
    PrimaryPharmacyNCPCP: pt.PrimaryPharmacyNCPCP,
    AlternativePharmacyNCPCP: pt.AlternativePharmacyNCPCP,
  };

  // Re-assemble strictly in contract order so Object.keys(payload) === WENO_PAYLOAD_KEYS.
  const payload = {} as WenoPayload;
  for (const k of WENO_PAYLOAD_KEYS) payload[k] = values[k] ?? "";

  // --- 4) Pre-validation (only for a real patient) --------------------------
  if (p) {
    const missingCritical = CRITICAL_PATIENT_FIELDS.filter(
      ([k]) => !String(payload[k] || "").trim(),
    ).map(([, label]) => label);
    if (missingCritical.length) {
      throw new WenoPayloadError(
        `Error: el paciente requiere ${missingCritical.join(", ")} para la receta electrónica (Weno EZ).`,
      );
    }
  }

  // Non-fatal: which account/config keys are still blank (helps admins configure).
  const configKeys: WenoPayloadKey[] = ["UserEmail", "MD5Password", "LocationID"];
  const missing = configKeys.filter((k) => !String(payload[k] || "").trim());

  return { environment: cfg.environment, payload, missing, patientId: patientId || null, providerId: providerId || null };
}

// GET /api/weno/ez/sample-payload?patientId=<optional>&providerId=<optional>&download=1
// Emits the ComposeRx JSON (exact 45-field Weno EZ schema) populated with our
// clinic config + a real patient (or Weno's sample patient), ready to paste into
// the Weno EZ "Developers" validator. Admin/prescriber only. Credentials come
// from server config and are never hardcoded or leaked in errors.
export async function GET(req: Request) {
  let user: any;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!PRESCRIBER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "A prescriber/admin account is required." }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const patientId = sp.get("patientId") || "";
  const providerId = sp.get("providerId") || "";
  const wantDownload = sp.get("download") === "1";

  let result: BuildResult;
  try {
    result = await buildWenoPrescriptionPayload(patientId, providerId);
  } catch (e: any) {
    if (e instanceof WenoPayloadError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "No se pudo construir el payload de Weno." }, { status: 500 });
  }

  const pretty = JSON.stringify(result.payload, null, 2);
  if (wantDownload) {
    return new NextResponse(pretty, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="ComposeRx_${patientId || "sample"}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json({ environment: result.environment, missing: result.missing, payload: result.payload });
}
