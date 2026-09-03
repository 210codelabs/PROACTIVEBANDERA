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

// GET /api/weno/ez/sample-payload?patientId=<optional>&download=1
// Emits the ComposeRx JSON (exact Weno EZ schema) populated with our clinic
// config + a real patient, ready to paste into the Weno EZ "Developers" validator.
// Admin/prescriber only. Credentials come from server config (never hardcoded).
export async function GET(req: Request) {
  let user: any;
  try { user = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!PRESCRIBER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "A prescriber/admin account is required." }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const patientId = sp.get("patientId") || "";
  const wantDownload = sp.get("download") === "1";

  const svc = new WenoIntegrationService();
  const cfg = await svc.getConfig();

  // Patient: a real one if an id is given, otherwise the Weno sample patient.
  let p: any = null;
  if (patientId) p = await db.patient.findUnique({ where: { id: patientId } }).catch(() => null);
  if (patientId && !p) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const sample = {
    LastName: "Satterfield", FirstName: "Ryan", MiddleName: "J", Prefix: "Mr", Suffix: "",
    Gender: "F", DateOfBirth: "1994-06-18",
    AddressLine1: "224", AddressLine2: "Richmond Ranch Rd", City: "Texarkana", State: "TX", PostalCode: "75503",
    PrimaryPhone: "8776543210", PatientEmail: "qa.patient@yopmail.com", OrgPatientID: "12537",
    PrimaryPharmacyNCPCP: "", AlternativePharmacyNCPCP: "",
  };

  const patient = p ? {
    LastName: p.lastName || "", FirstName: p.firstName || "", MiddleName: p.middleName || "",
    Prefix: p.prefix || "", Suffix: p.suffix || "",
    Gender: (p.sex || "U").slice(0, 1).toUpperCase(),
    DateOfBirth: p.dob ? new Date(p.dob).toISOString().slice(0, 10) : "",
    AddressLine1: p.addressLine1 || "", AddressLine2: p.addressLine2 || "",
    City: p.city || "", State: p.state || "", PostalCode: p.postalCode || "",
    PrimaryPhone: digits(p.phone), PatientEmail: p.email || "", OrgPatientID: String(p.id || ""),
    PrimaryPharmacyNCPCP: p.primaryPharmacyNcpdp || "", AlternativePharmacyNCPCP: "",
  } : sample;

  // ComposeRx payload — exact Weno EZ key names/order (incl. Weno's NCPCP spelling).
  const payload: Record<string, string> = {
    UserEmail: cfg.providerEmail || "",
    MD5Password: cfg.providerPassword ? md5(cfg.providerPassword) : "",
    LocationID: cfg.locationId || "",
    TestPatient: cfg.environment === "production" ? "N" : "Y",
    PatientType: "Human",
    OrgPatientID: patient.OrgPatientID,
    LastName: patient.LastName,
    FirstName: patient.FirstName,
    MiddleName: patient.MiddleName,
    Prefix: patient.Prefix,
    Suffix: patient.Suffix,
    Gender: patient.Gender,
    DateOfBirth: patient.DateOfBirth,
    AddressLine1: patient.AddressLine1,
    AddressLine2: patient.AddressLine2,
    City: patient.City,
    State: patient.State,
    PostalCode: patient.PostalCode,
    CountryCode: "US",
    PrimaryPhone: patient.PrimaryPhone,
    SupportsSMS: "N",
    PatientEmail: patient.PatientEmail,
    ResponsiblePartySameAsPatient: "Y",
    PatientLocation: "Home",
    PrimaryPharmacyNCPCP: patient.PrimaryPharmacyNCPCP,
    AlternativePharmacyNCPCP: patient.AlternativePharmacyNCPCP,
  };

  // Which required fields are still blank (helps validate before pasting).
  const requiredKeys = ["UserEmail", "MD5Password", "LocationID", "OrgPatientID", "LastName", "FirstName", "Gender", "DateOfBirth", "AddressLine1", "City", "State", "PostalCode"];
  const missing = requiredKeys.filter((k) => !String(payload[k] || "").trim());

  const pretty = JSON.stringify(payload, null, 2);
  if (wantDownload) {
    return new NextResponse(pretty, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="ComposeRx_${p ? p.id : "sample"}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json({ environment: cfg.environment, missing, payload });
}
