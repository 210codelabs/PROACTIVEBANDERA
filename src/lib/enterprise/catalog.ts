// Occupational-health service catalog offered to enterprise/corporate clients.
export type ServiceDef = { key: string; label: string; category: string; priceCents: number };

export const SERVICE_CATALOG: ServiceDef[] = [
  { key: "drug_5panel", label: "Drug Test — 5 Panel", category: "Drug Screening", priceCents: 4500 },
  { key: "drug_10panel", label: "Drug Test — 10 Panel", category: "Drug Screening", priceCents: 6500 },
  { key: "drug_dot", label: "DOT Drug & Alcohol Test", category: "Drug Screening", priceCents: 7500 },
  { key: "dot_physical", label: "DOT Physical Exam", category: "Physicals", priceCents: 9500 },
  { key: "non_dot_physical", label: "Non-DOT / Pre-Employment Physical", category: "Physicals", priceCents: 8500 },
  { key: "tb_test", label: "TB Test (PPD)", category: "Screening", priceCents: 3500 },
  { key: "titer", label: "Titer / Immunization Check", category: "Screening", priceCents: 5500 },
  { key: "respirator_fit", label: "Respirator Fit Test", category: "OSHA Compliance", priceCents: 6000 },
  { key: "audiometry", label: "Audiometry / Hearing Test", category: "OSHA Compliance", priceCents: 5000 },
  { key: "vaccination", label: "Vaccination (Flu / Hep B / Tdap)", category: "Immunization", priceCents: 4000 },
  { key: "health_screen", label: "Pre-Employment Health Screen", category: "Compliance", priceCents: 7000 },
];

export function serviceByKey(key: string): ServiceDef | undefined {
  return SERVICE_CATALOG.find((s) => s.key === key);
}

export const REQUEST_STATUSES = ["requested", "scheduled", "in_progress", "completed", "cancelled"] as const;
export const RESULT_STATUSES = ["pending", "pass", "fail", "inconclusive", "na"] as const;

export function statusLabel(s: string): string {
  return ({ requested: "Requested", scheduled: "Scheduled", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" } as Record<string, string>)[s] || s;
}
