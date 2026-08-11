/**
 * C-CDA (XML) and FHIR (JSON Bundle) parsing for the clinical Data Import tool.
 * Extracts demographics + Problems + Medications + Allergies into a normalized
 * shape the commit route can persist. Best-effort across common export layouts;
 * unusual vendor variations may need mapping tweaks with a sanitized sample.
 */

import { XMLParser } from "fast-xml-parser";

export type ExtractedPatient = {
  firstName?: string; lastName?: string; middleName?: string;
  dob?: string; sex?: string; mrn?: string;
  email?: string; phone?: string;
  addressLine1?: string; city?: string; state?: string; postalCode?: string;
};
export type ExtractedProblem = { description: string; icd10?: string; status?: string; onsetDate?: string };
export type ExtractedMed = { name: string; sig?: string; status?: string };
export type ExtractedAllergy = { substance: string; reaction?: string; severity?: string; status?: string };
export type Extracted = {
  format: "ccda" | "fhir";
  patient: ExtractedPatient;
  problems: ExtractedProblem[];
  medications: ExtractedMed[];
  allergies: ExtractedAllergy[];
};

const toArr = <T>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const str = (v: any): string | undefined => {
  if (v == null) return undefined;
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in v) return String(v["#text"]).trim() || undefined;
  return undefined;
};

export function detectFormat(content: string): "ccda" | "fhir" | null {
  const t = content.trim();
  if (!t) return null;
  if (t.startsWith("<")) return "ccda";
  if (t.startsWith("{")) return "fhir";
  return null;
}

// ---------------- C-CDA ----------------

function ccdaDate(v?: string): string | undefined {
  if (!v) return undefined;
  const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return undefined;
}

// Recursively collect all values stored under a given element name.
function collect(node: any, name: string, out: any[] = []): any[] {
  if (!node || typeof node !== "object") return out;
  for (const [k, v] of Object.entries(node)) {
    if (k === name) { toArr(v).forEach((x) => out.push(x)); }
    else { toArr(v).forEach((x) => { if (x && typeof x === "object") collect(x, name, out); }); }
  }
  return out;
}

const ICD10_OIDS = ["2.16.840.1.113883.6.90", "2.16.840.1.113883.6.3"]; // ICD-10-CM
function findSectionByCode(sections: any[], code: string): any | null {
  for (const s of sections) {
    const c = s?.code?.["@_code"];
    if (c === code) return s;
  }
  return null;
}

export function parseCcda(xml: string): Extracted {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true });
  const doc = parser.parse(xml);
  const cd = doc?.ClinicalDocument || doc;

  // Demographics
  const pr = toArr(cd?.recordTarget)[0]?.patientRole || cd?.recordTarget?.patientRole;
  const prole = Array.isArray(pr) ? pr[0] : pr;
  const p = prole?.patient;
  const nameNode = Array.isArray(p?.name) ? p.name[0] : p?.name;
  const given = toArr(nameNode?.given).map(str).filter(Boolean) as string[];
  const patient: ExtractedPatient = {
    firstName: given[0],
    middleName: given.length > 1 ? given.slice(1).join(" ") : undefined,
    lastName: str(nameNode?.family),
    sex: (() => { const g = p?.administrativeGenderCode?.["@_code"]; return g === "M" || g === "F" ? g : g ? "U" : undefined; })(),
    dob: ccdaDate(p?.birthTime?.["@_value"]),
    mrn: toArr(prole?.id).map((x: any) => x?.["@_extension"]).filter(Boolean)[0],
  };
  const addr = Array.isArray(prole?.addr) ? prole.addr[0] : prole?.addr;
  if (addr) {
    patient.addressLine1 = str(Array.isArray(addr.streetAddressLine) ? addr.streetAddressLine[0] : addr.streetAddressLine);
    patient.city = str(addr.city); patient.state = str(addr.state); patient.postalCode = str(addr.postalCode);
  }
  for (const t of toArr(prole?.telecom)) {
    const val = t?.["@_value"] || "";
    if (val.startsWith("tel:") && !patient.phone) patient.phone = val.replace(/^tel:/, "");
    if (val.startsWith("mailto:") && !patient.email) patient.email = val.replace(/^mailto:/, "");
  }

  // Sections
  const bodyComponents = toArr(cd?.component?.structuredBody?.component);
  const sections = bodyComponents.map((c: any) => c?.section).filter(Boolean);

  // Problems (LOINC 11450-4)
  const problems: ExtractedProblem[] = [];
  const probSec = findSectionByCode(sections, "11450-4");
  if (probSec) {
    for (const obs of collect(probSec, "observation")) {
      const val = obs?.value;
      const display = val?.["@_displayName"];
      const code = val?.["@_code"];
      const codeSystem = val?.["@_codeSystem"];
      if (!display && !code) continue;
      if (val?.["@_xsi:type"] && String(val["@_xsi:type"]).includes("ST")) continue;
      // skip status/negation observations that have no clinical concept display
      if (!display) continue;
      problems.push({
        description: String(display),
        icd10: code && ICD10_OIDS.includes(String(codeSystem)) ? String(code) : undefined,
        onsetDate: ccdaDate(obs?.effectiveTime?.low?.["@_value"] || obs?.effectiveTime?.["@_value"]),
        status: "active",
      });
    }
  }

  // Medications (LOINC 10160-0)
  const medications: ExtractedMed[] = [];
  const medSec = findSectionByCode(sections, "10160-0");
  if (medSec) {
    for (const mm of collect(medSec, "manufacturedMaterial")) {
      const name = mm?.code?.["@_displayName"] || str(mm?.code?.originalText);
      if (name) medications.push({ name: String(name), status: "active" });
    }
  }

  // Allergies (LOINC 48765-2)
  const allergies: ExtractedAllergy[] = [];
  const allSec = findSectionByCode(sections, "48765-2");
  if (allSec) {
    for (const pe of collect(allSec, "playingEntity")) {
      const substance = pe?.code?.["@_displayName"] || str(pe?.code?.originalText) || str(pe?.name);
      if (substance) allergies.push({ substance: String(substance), status: "active" });
    }
  }

  return { format: "ccda", patient, problems: dedupeBy(problems, (x) => x.description.toLowerCase()), medications: dedupeBy(medications, (x) => x.name.toLowerCase()), allergies: dedupeBy(allergies, (x) => x.substance.toLowerCase()) };
}

function dedupeBy<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>(); const out: T[] = [];
  for (const x of arr) { const k = key(x); if (k && !seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
}

// ---------------- FHIR ----------------

function fhirDisplay(cc: any): string | undefined {
  if (!cc) return undefined;
  if (cc.text) return String(cc.text);
  const coding = toArr(cc.coding)[0];
  return coding?.display || coding?.code;
}
function fhirIcd10(cc: any): string | undefined {
  for (const c of toArr(cc?.coding)) {
    const sys = String(c?.system || "").toLowerCase();
    if (sys.includes("icd-10") || sys.includes("icd10")) return c?.code;
  }
  return undefined;
}

export function parseFhirBundle(jsonText: string): Extracted {
  const bundle = JSON.parse(jsonText);
  const resources: any[] = bundle?.resourceType === "Bundle"
    ? toArr(bundle.entry).map((e: any) => e?.resource).filter(Boolean)
    : bundle?.resourceType ? [bundle] : [];

  const patient: ExtractedPatient = {};
  const problems: ExtractedProblem[] = [];
  const medications: ExtractedMed[] = [];
  const allergies: ExtractedAllergy[] = [];

  for (const r of resources) {
    switch (r?.resourceType) {
      case "Patient": {
        const nm = toArr(r.name)[0];
        const given = toArr(nm?.given).filter(Boolean);
        patient.firstName = given[0];
        patient.middleName = given.length > 1 ? given.slice(1).join(" ") : undefined;
        patient.lastName = nm?.family;
        patient.sex = r.gender === "male" ? "M" : r.gender === "female" ? "F" : r.gender ? "U" : undefined;
        patient.dob = r.birthDate;
        patient.mrn = toArr(r.identifier).map((i: any) => i?.value).filter(Boolean)[0];
        for (const t of toArr(r.telecom)) {
          if (t?.system === "phone" && !patient.phone) patient.phone = t.value;
          if (t?.system === "email" && !patient.email) patient.email = t.value;
        }
        const addr = toArr(r.address)[0];
        if (addr) {
          patient.addressLine1 = toArr(addr.line)[0];
          patient.city = addr.city; patient.state = addr.state; patient.postalCode = addr.postalCode;
        }
        break;
      }
      case "Condition": {
        const desc = fhirDisplay(r.code);
        if (desc) problems.push({
          description: desc,
          icd10: fhirIcd10(r.code),
          status: toArr(r.clinicalStatus?.coding)[0]?.code || "active",
          onsetDate: r.onsetDateTime ? String(r.onsetDateTime).slice(0, 10) : undefined,
        });
        break;
      }
      case "MedicationRequest":
      case "MedicationStatement": {
        const name = fhirDisplay(r.medicationCodeableConcept) || (r.medicationReference?.display);
        if (name) medications.push({
          name,
          sig: toArr(r.dosageInstruction)[0]?.text || undefined,
          status: r.status || "active",
        });
        break;
      }
      case "AllergyIntolerance": {
        const substance = fhirDisplay(r.code);
        if (substance) allergies.push({
          substance,
          reaction: fhirDisplay(toArr(toArr(r.reaction)[0]?.manifestation)[0]),
          severity: toArr(r.reaction)[0]?.severity || r.criticality || undefined,
          status: toArr(r.clinicalStatus?.coding)[0]?.code || "active",
        });
        break;
      }
    }
  }

  return { format: "fhir", patient, problems: dedupeBy(problems, (x) => x.description.toLowerCase()), medications: dedupeBy(medications, (x) => x.name.toLowerCase()), allergies: dedupeBy(allergies, (x) => x.substance.toLowerCase()) };
}

export function parseClinicalDocument(content: string): Extracted {
  const fmt = detectFormat(content);
  if (fmt === "ccda") return parseCcda(content);
  if (fmt === "fhir") return parseFhirBundle(content);
  throw new Error("Unrecognized file. Provide a C-CDA XML document or a FHIR JSON bundle.");
}
