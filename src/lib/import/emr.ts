/**
 * CSV parsing + external-EMR column mapping for the Data Import tool.
 * Supports Practice Fusion and eClinicalWorks (eCW) patient exports plus a
 * generic CSV, via a broad header-alias map (case/space/punctuation-insensitive).
 */

export type PatientRow = {
  firstName?: string; lastName?: string; middleName?: string; dob?: string;
  sex?: string; email?: string; phone?: string;
  addressLine1?: string; addressLine2?: string; city?: string; state?: string; postalCode?: string;
  mrn?: string; insurerName?: string; insurerPlan?: string; memberId?: string; groupNumber?: string;
  preferredLang?: string;
};

// Minimal RFC-4180-ish CSV parser (handles quotes, commas, CRLF, escaped quotes).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, ""); // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* ignore */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

// field -> list of accepted header aliases (normalized on compare)
const ALIASES: Record<keyof PatientRow, string[]> = {
  firstName: ["firstname", "first", "patientfirstname", "patfirst", "givenname", "fname"],
  lastName: ["lastname", "last", "patientlastname", "patlast", "familyname", "surname", "lname"],
  middleName: ["middlename", "middle", "mi", "middleinitial"],
  dob: ["dob", "dateofbirth", "birthdate", "birthday", "patientdob"],
  sex: ["sex", "gender", "patientsex", "patientgender"],
  email: ["email", "emailaddress", "patientemail", "primaryemail"],
  phone: ["phone", "homephone", "cellphone", "mobile", "mobilephone", "primaryphone", "phonenumber", "contactphone"],
  addressLine1: ["address", "address1", "addressline1", "street", "streetaddress", "homeaddress", "addressline"],
  addressLine2: ["address2", "addressline2", "apt", "unit", "suite"],
  city: ["city", "town"],
  state: ["state", "province", "stateprovince"],
  postalCode: ["zip", "zipcode", "postalcode", "postal", "zip4"],
  mrn: ["mrn", "chartnumber", "chartno", "chart", "recordnumber", "patientid", "patientnumber", "externalid", "accountnumber", "medicalrecordnumber", "chartid"],
  insurerName: ["insurance", "primaryinsurance", "payer", "insurer", "insurancename", "insurancecompany", "insurancecarrier", "plan"],
  insurerPlan: ["insuranceplan", "planname", "plantype"],
  memberId: ["memberid", "subscriberid", "policynumber", "insuranceid", "policyid", "subscribernumber", "memberno"],
  groupNumber: ["groupnumber", "group", "groupno", "groupid"],
  preferredLang: ["language", "preferredlanguage", "primarylanguage", "preferredlang"],
};

export type Mapping = Partial<Record<keyof PatientRow, number>>; // field -> column index

export function autoMap(headers: string[]): Mapping {
  const normalized = headers.map(norm);
  const mapping: Mapping = {};
  (Object.keys(ALIASES) as (keyof PatientRow)[]).forEach((field) => {
    for (const alias of ALIASES[field]) {
      const idx = normalized.indexOf(alias);
      if (idx !== -1) { mapping[field] = idx; break; }
    }
  });
  return mapping;
}

function normalizeDob(v: string): string | undefined {
  const t = v.trim();
  if (!t) return undefined;
  // Accept MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = t.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (us) {
    let year = us[3];
    if (year.length === 2) year = (Number(year) > 30 ? "19" : "20") + year;
    return `${year}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return undefined;
}

function normalizeSex(v: string): string | undefined {
  const t = v.trim().toLowerCase();
  if (!t) return undefined;
  if (["m", "male"].includes(t)) return "M";
  if (["f", "female"].includes(t)) return "F";
  return "U";
}

export function rowToPatient(cols: string[], mapping: Mapping): PatientRow {
  const get = (f: keyof PatientRow) => {
    const idx = mapping[f];
    return idx != null ? (cols[idx] ?? "").trim() : "";
  };
  return {
    firstName: get("firstName") || undefined,
    lastName: get("lastName") || undefined,
    middleName: get("middleName") || undefined,
    dob: normalizeDob(get("dob")),
    sex: normalizeSex(get("sex")),
    email: get("email") || undefined,
    phone: get("phone") || undefined,
    addressLine1: get("addressLine1") || undefined,
    addressLine2: get("addressLine2") || undefined,
    city: get("city") || undefined,
    state: get("state") || undefined,
    postalCode: get("postalCode") || undefined,
    mrn: get("mrn") || undefined,
    insurerName: get("insurerName") || undefined,
    insurerPlan: get("insurerPlan") || undefined,
    memberId: get("memberId") || undefined,
    groupNumber: get("groupNumber") || undefined,
    preferredLang: get("preferredLang") || undefined,
  };
}

export const SOURCE_LABEL: Record<string, string> = {
  practice_fusion: "Practice Fusion",
  ecw: "eClinicalWorks (eCW)",
  csv: "Generic CSV",
};
