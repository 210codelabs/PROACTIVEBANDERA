/**
 * Practice Fusion Service Base URL directory (from the uploaded ServiceBaseURLs
 * publication). Lets an admin find their practice by name / NPI / org id and
 * auto-fill the Provider/System Access FHIR base URL — no manual typing.
 */

import raw from "./pf-directory.json";

export type Practice = {
  name: string; npi?: string; orgId: string;
  city?: string; state?: string;
  base: string;          // Provider / System Access FHIR base URL
  patientBase?: string;  // Patient Access FHIR base URL
};

const ALL: Practice[] = ((raw as any)?.practices || []) as Practice[];

export function directoryCount(): number {
  return ALL.length;
}

export function searchDirectory(q: string, limit = 25): Practice[] {
  const t = (q || "").trim().toLowerCase();
  if (t.length < 2) return [];
  const digits = t.replace(/[^0-9]/g, "");
  const out: Practice[] = [];
  for (const p of ALL) {
    const name = (p.name || "").toLowerCase();
    const npiHit = !!(p.npi && digits.length >= 3 && p.npi.includes(digits));
    if (name.includes(t) || npiHit || (p.orgId || "").toLowerCase().includes(t) || (p.city || "").toLowerCase().includes(t)) {
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}
