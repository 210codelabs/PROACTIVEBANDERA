/**
 * CSV parsing + external-EMR column mapping for the APPOINTMENT import tool.
 * Supports Practice Fusion / eClinicalWorks schedule exports plus a generic CSV,
 * via a broad header-alias map (case/space/punctuation-insensitive).
 *
 * Reuses parseCsv from ./emr. Appointment rows are matched to EXISTING patients
 * and providers at commit time (patients are never created here).
 */

import { parseCsv } from "./emr";

export { parseCsv };

export type ApptRow = {
  // patient identity (match only — never created here)
  patientMrn?: string;
  patientFirst?: string;
  patientLast?: string;
  patientDob?: string;
  // scheduling
  startsAt?: string;   // combined datetime column (if present)
  date?: string;       // date-only column
  time?: string;       // time-only column
  durationMin?: string;
  // provider / service
  provider?: string;   // free-text provider name
  providerNpi?: string;
  serviceCode?: string;
  serviceName?: string;
  reason?: string;
  status?: string;
  location?: string;
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES: Record<keyof ApptRow, string[]> = {
  patientMrn: ["mrn", "chartnumber", "chartno", "chart", "patientid", "patientnumber", "chartid", "accountnumber", "medicalrecordnumber", "recordnumber", "externalid"],
  patientFirst: ["patientfirstname", "firstname", "first", "patfirst", "givenname", "fname", "patientfirst"],
  patientLast: ["patientlastname", "lastname", "last", "patlast", "familyname", "surname", "lname", "patientlast"],
  patientDob: ["dob", "dateofbirth", "birthdate", "birthday", "patientdob"],
  startsAt: ["start", "startsat", "startdatetime", "appointmentdatetime", "apptdatetime", "datetime", "scheduled", "scheduledstart", "startdate"],
  date: ["date", "appointmentdate", "apptdate", "visitdate", "dateofservice", "dos", "scheduleddate", "apptday"],
  time: ["time", "appointmenttime", "appttime", "starttime", "visittime", "scheduledtime", "appttimeofday"],
  durationMin: ["duration", "durationmin", "durationminutes", "length", "lengthmin", "minutes", "slotlength"],
  provider: ["provider", "providername", "doctor", "physician", "rendering", "renderingprovider", "clinician", "practitioner", "resource", "seenby", "renderingproviderfullname"],
  providerNpi: ["providernpi", "npi", "renderingnpi", "renderingprovidernpi"],
  serviceCode: ["servicecode", "cptcode", "cpt", "visittypecode", "appointmenttypecode", "code", "servicetypecode"],
  serviceName: ["service", "servicetype", "visittype", "appointmenttype", "appttype", "type", "servicename", "visittypedescription"],
  reason: ["reason", "chiefcomplaint", "cc", "appointmentreason", "visitreason", "reasonforvisit", "comments", "comment", "note", "notes"],
  status: ["status", "appointmentstatus", "apptstatus", "visitstatus", "appointmentstate"],
  location: ["location", "place", "facility", "site", "room", "pos", "placeofservice", "clinic"],
};

export type ApptMapping = Partial<Record<keyof ApptRow, number>>;

export function autoMapAppt(headers: string[]): ApptMapping {
  const normalized = headers.map(norm);
  const mapping: ApptMapping = {};
  (Object.keys(ALIASES) as (keyof ApptRow)[]).forEach((field) => {
    for (const alias of ALIASES[field]) {
      const idx = normalized.indexOf(alias);
      if (idx !== -1) { mapping[field] = idx; break; }
    }
  });
  return mapping;
}

export function rowToAppt(cols: string[], mapping: ApptMapping): ApptRow {
  const get = (f: keyof ApptRow) => {
    const idx = mapping[f];
    return idx != null ? (cols[idx] ?? "").trim() : "";
  };
  return {
    patientMrn: get("patientMrn") || undefined,
    patientFirst: get("patientFirst") || undefined,
    patientLast: get("patientLast") || undefined,
    patientDob: get("patientDob") || undefined,
    startsAt: get("startsAt") || undefined,
    date: get("date") || undefined,
    time: get("time") || undefined,
    durationMin: get("durationMin") || undefined,
    provider: get("provider") || undefined,
    providerNpi: get("providerNpi") || undefined,
    serviceCode: get("serviceCode") || undefined,
    serviceName: get("serviceName") || undefined,
    reason: get("reason") || undefined,
    status: get("status") || undefined,
    location: get("location") || undefined,
  };
}

// ---------- Normalizers ----------

function normDate(v: string): { y: number; m: number; d: number } | null {
  const t = (v || "").trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return { y: +iso[1], m: +iso[2], d: +iso[3] };
  const us = t.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/);
  if (us) { let y = +us[3]; if (us[3].length === 2) y = (y > 30 ? 1900 : 2000) + y; return { y, m: +us[1], d: +us[2] }; }
  const dt = new Date(t);
  if (!isNaN(dt.getTime())) return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  return null;
}

function normTime(v: string): { hh: number; mm: number } {
  const t = (v || "").trim();
  if (!t) return { hh: 9, mm: 0 }; // default 09:00 if not provided
  // 12-hour with am/pm
  const ampm = t.match(/^(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)/i);
  if (ampm) {
    let hh = +ampm[1] % 12;
    if (/p/i.test(ampm[3])) hh += 12;
    return { hh, mm: +ampm[2] };
  }
  const hm = t.match(/^(\d{1,2}):(\d{2})/);
  if (hm) return { hh: +hm[1], mm: +hm[2] };
  const hOnly = t.match(/^(\d{1,2})\s*([ap]\.?m\.?)/i);
  if (hOnly) { let hh = +hOnly[1] % 12; if (/p/i.test(hOnly[2])) hh += 12; return { hh, mm: 0 }; }
  return { hh: 9, mm: 0 };
}

/** Build a JS Date from a row. Returns null if no usable date is present. */
export function apptStartsAt(row: ApptRow): Date | null {
  // combined datetime column wins
  if (row.startsAt) {
    // If it looks like it also has a time, parse whole thing
    const hasTime = /\d{1,2}:\d{2}/.test(row.startsAt);
    const d = normDate(row.startsAt);
    if (!d) { const raw = new Date(row.startsAt); return isNaN(raw.getTime()) ? null : raw; }
    const t = hasTime ? normTime(row.startsAt.replace(/^\S+\s+/, "")) : (row.time ? normTime(row.time) : { hh: 9, mm: 0 });
    return new Date(d.y, d.m - 1, d.d, t.hh, t.mm, 0, 0);
  }
  const d = normDate(row.date || "");
  if (!d) return null;
  const t = normTime(row.time || "");
  return new Date(d.y, d.m - 1, d.d, t.hh, t.mm, 0, 0);
}

export function normStatus(v?: string): string {
  const t = (v || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!t) return "scheduled";
  if (["scheduled", "booked", "confirmed", "pending"].includes(t)) return "scheduled";
  if (["checkedin", "arrived", "checkin"].includes(t)) return "checked-in";
  if (["inroom", "roomed", "inprogress"].includes(t)) return "in-room";
  if (["completed", "complete", "done", "finished", "seen"].includes(t)) return "completed";
  if (["noshow", "missed", "didnotattend", "dna"].includes(t)) return "no-show";
  if (["cancelled", "canceled", "cancel"].includes(t)) return "cancelled";
  return "scheduled";
}

export function normDuration(v?: string): number | null {
  const n = parseInt((v || "").replace(/[^0-9]/g, ""), 10);
  if (isNaN(n) || n <= 0 || n > 600) return null;
  return n;
}

/** Normalize a DOB-ish string to "YYYY-MM-DD" (for patient matching). */
export function dobToIso(v?: string): string | null {
  const d = normDate(v || "");
  if (!d) return null;
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

/** Normalize a free-text/NPI provider name for matching against Users. */
export function providerMatchKeys(name?: string): string[] {
  const t = (name || "").trim();
  if (!t) return [];
  const cleaned = t.replace(/\b(dr|md|do|np|pa|dpt|rn|drph|phd)\b\.?/gi, "").replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.split(" ").filter(Boolean).map((s) => s.toLowerCase());
}

export const APPT_SOURCE_LABEL: Record<string, string> = {
  practice_fusion: "Practice Fusion (schedule)",
  ecw: "eClinicalWorks (schedule)",
  csv: "Generic CSV (schedule)",
};
