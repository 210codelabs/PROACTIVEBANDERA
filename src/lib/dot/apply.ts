import { evaluateDotExam } from "./rules";

// Recompute rule-engine outputs + certificate expiry from the merged exam.
export function computeDerived(exam: any) {
  const r = evaluateDotExam({
    healthHistory: exam.healthHistory || null,
    driverInfo: exam.driverInfo || null,
    vitals: exam.vitals || null,
    vision: exam.vision || null,
    hearing: exam.hearing || null,
  });
  let expiresOn: Date | null = null;
  if (exam.examDate && exam.certMonths) {
    const d = new Date(exam.examDate);
    d.setMonth(d.getMonth() + Number(exam.certMonths));
    expiresOn = d;
  }
  return {
    alerts: r.alerts,
    additionalFormsRequired: r.additionalFormsRequired,
    bpCategory: r.bpCategory,
    suggestedCertMonths: r.suggestedCertMonths,
    expiresOn,
  };
}

export function outcomeFromFlags(fl: any): string | undefined {
  if (!fl) return undefined;
  if (fl.doesNotMeet || fl.temporarilyDisqualified) return "not_qualified";
  if (fl.incomplete) return "incomplete";
  if (fl.meetsWithExemption) return "qualified_with_restrictions";
  if (fl.meetsStandards) return "qualified";
  return undefined;
}
