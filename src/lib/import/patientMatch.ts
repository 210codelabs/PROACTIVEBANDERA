import { db } from "@/lib/db";
import type { ExtractedPatient } from "@/lib/import/clinical";

export type ClinicalPatientMatch =
  | { by: "mrn" | "name+dob"; id: string; firstName: string; lastName: string; mrn: string }
  | { by: "ambiguous" | "conflict" | "missing_identity"; count?: number }
  | null;

export async function matchClinicalPatient(patient: ExtractedPatient): Promise<ClinicalPatientMatch> {
  const { firstName, lastName, dob, mrn } = patient;
  const parsedDate = dob && /^\d{4}-\d{2}-\d{2}$/.test(dob) ? new Date(`${dob}T00:00:00.000Z`) : null;
  if (!firstName?.trim() || !lastName?.trim() || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dob) {
    return { by: "missing_identity" };
  }

  if (mrn?.trim()) {
    const found = await db.patient.findUnique({
      where: { mrn: mrn.trim() },
      select: { id: true, firstName: true, lastName: true, mrn: true, dob: true },
    });
    if (found) {
      if (found.firstName.trim().toLowerCase() !== firstName.trim().toLowerCase() || found.lastName.trim().toLowerCase() !== lastName.trim().toLowerCase() || found.dob.toISOString().slice(0, 10) !== dob) {
        return { by: "conflict" };
      }
      return { by: "mrn", id: found.id, firstName: found.firstName, lastName: found.lastName, mrn: found.mrn };
    }
  }

  const candidates = await db.patient.findMany({
    where: { firstName: { equals: firstName.trim(), mode: "insensitive" }, lastName: { equals: lastName.trim(), mode: "insensitive" } },
    select: { id: true, firstName: true, lastName: true, mrn: true, dob: true },
  });
  const matches = candidates.filter((candidate) => candidate.dob.toISOString().slice(0, 10) === dob);
  if (matches.length > 1) return { by: "ambiguous", count: matches.length };
  if (matches.length === 1) {
    const match = matches[0];
    return { by: "name+dob", id: match.id, firstName: match.firstName, lastName: match.lastName, mrn: match.mrn };
  }
  return null;
}