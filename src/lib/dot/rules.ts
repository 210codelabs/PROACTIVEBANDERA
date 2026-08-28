// Deterministic FMCSA guidance engine (no LLM). Produces examiner alerts,
// a suggested certificate duration, and any additional FMCSA forms required.
// Based on the physical-qualification standards in 49 CFR 391.41 and the
// FMCSA Medical Examiner Handbook blood-pressure guidance. This is DECISION
// SUPPORT ONLY — the certified medical examiner makes the final determination.

import {
  DOT_FORM_NUMBERS,
  VISION_MIN_FIELD_DEG,
  HEARING_MAX_DB_LOSS,
  HEARING_WHISPER_MIN_FT,
} from "./forms";

export type DotAlert = {
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
};

export type RuleInput = {
  healthHistory?: Record<string, { yes?: boolean; detail?: string }> | null;
  driverInfo?: { diabetesTreatment?: string; medications?: string } | null;
  vitals?: { bpSystolic?: number; bpDiastolic?: number } | null;
  vision?: {
    acuityRightCorrected?: string;
    acuityLeftCorrected?: string;
    fieldRightDeg?: number;
    fieldLeftDeg?: number;
    colorPass?: boolean;
  } | null;
  hearing?: { whisperRightFt?: number; whisperLeftFt?: number; dbLossBetterEar?: number } | null;
};

export type RuleResult = {
  alerts: DotAlert[];
  suggestedCertMonths: number;
  additionalFormsRequired: string[];
  bpCategory: string | null;
};

function parseAcuity(a?: string): number | null {
  // "20/40" -> 40 (denominator). Lower denominator = better vision.
  if (!a) return null;
  const m = String(a).match(/20\s*\/\s*(\d+)/);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(String(a).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function evaluateDotExam(input: RuleInput): RuleResult {
  const alerts: DotAlert[] = [];
  const additionalForms = new Set<string>();
  let suggestedCertMonths = 24; // default max
  let bpCategory: string | null = null;

  const lower = (n: number, cap: number) => {
    if (n < cap) suggestedCertMonths = Math.min(suggestedCertMonths, n);
  };

  // ---- Blood pressure (FMCSA Medical Examiner Handbook) --------------------
  const sys = input.vitals?.bpSystolic;
  const dia = input.vitals?.bpDiastolic;
  if (typeof sys === "number" && typeof dia === "number" && sys > 0 && dia > 0) {
    if (sys >= 180 || dia >= 110) {
      bpCategory = "Stage 3 (>=180/110)";
      alerts.push({ severity: "critical", code: "bp_stage3", message: `Blood pressure ${sys}/${dia} is Stage 3. FMCSA: disqualified until BP is controlled (<140/90); then 6-month certificates only.` });
      lower(3, 24);
    } else if (sys >= 160 || dia >= 100) {
      bpCategory = "Stage 2 (160-179/100-109)";
      alerts.push({ severity: "warning", code: "bp_stage2", message: `Blood pressure ${sys}/${dia} is Stage 2. FMCSA: one-time 3-month certificate; recertify for 1 year once BP < 140/90.` });
      lower(3, 24);
    } else if (sys >= 140 || dia >= 90) {
      bpCategory = "Stage 1 (140-159/90-99)";
      alerts.push({ severity: "warning", code: "bp_stage1", message: `Blood pressure ${sys}/${dia} is Stage 1. FMCSA: one-time 1-year certificate; recertify for 1 year once BP < 140/90.` });
      lower(12, 24);
    } else {
      bpCategory = "Normal (<140/90)";
    }
  }

  // ---- Diabetes / insulin --------------------------------------------------
  const dtx = (input.driverInfo?.diabetesTreatment || "").toLowerCase();
  const diabetesYes = input.healthHistory?.diabetes?.yes;
  if (dtx === "insulin" || (diabetesYes && /insulin/i.test(input.healthHistory?.diabetes?.detail || ""))) {
    additionalForms.add(DOT_FORM_NUMBERS.itdm);
    alerts.push({ severity: "critical", code: "insulin", message: `Driver reports INSULIN-treated diabetes. Insulin-Treated Diabetes Mellitus Assessment (${DOT_FORM_NUMBERS.itdm}) is required from the treating clinician. Max certificate 12 months.` });
    lower(12, 24);
  } else if (dtx === "oral" || diabetesYes) {
    alerts.push({ severity: "info", code: "diabetes", message: "Driver reports diabetes (non-insulin). Consider annual certification and monitoring." });
    lower(12, 24);
  }

  // ---- Medications of concern ---------------------------------------------
  const meds = (input.driverInfo?.medications || "").toLowerCase();
  const medFlags: Array<[RegExp, string]> = [
    [/warfarin|coumadin|eliquis|xarelto|anticoagul/, "anticoagulant therapy"],
    [/phenytoin|keppra|levetiracetam|anti[- ]?seizure|anticonvuls/, "anti-seizure medication"],
    [/methadone|oxycodone|hydrocodone|opioid|narcotic/, "opioid / narcotic medication"],
    [/adderall|amphetamine|stimulant/, "stimulant medication"],
    [/insulin/, "insulin"],
  ];
  for (const [re, label] of medFlags) {
    if (re.test(meds)) {
      alerts.push({ severity: "warning", code: "med_review", message: `Reported medication suggests ${label} — review effect on safe driving before certifying.` });
    }
  }

  // ---- Vision (49 CFR 391.41) ---------------------------------------------
  const vr = parseAcuity(input.vision?.acuityRightCorrected);
  const vl = parseAcuity(input.vision?.acuityLeftCorrected);
  const acuityBad = (vr != null && vr > 40) || (vl != null && vl > 40);
  const fieldBad =
    (typeof input.vision?.fieldRightDeg === "number" && input.vision.fieldRightDeg < VISION_MIN_FIELD_DEG) ||
    (typeof input.vision?.fieldLeftDeg === "number" && input.vision.fieldLeftDeg < VISION_MIN_FIELD_DEG);
  const colorBad = input.vision && input.vision.colorPass === false;
  if (acuityBad || fieldBad || colorBad) {
    additionalForms.add(DOT_FORM_NUMBERS.vision);
    const parts: string[] = [];
    if (acuityBad) parts.push("distant acuity worse than 20/40");
    if (fieldBad) parts.push(`horizontal field < ${VISION_MIN_FIELD_DEG}°`);
    if (colorBad) parts.push("cannot recognize traffic-signal colors");
    alerts.push({ severity: "critical", code: "vision", message: `Vision does not meet the FMCSA standard (${parts.join(", ")}). A Vision Evaluation (${DOT_FORM_NUMBERS.vision}) or federal vision exemption is required.` });
  }

  // ---- Hearing (49 CFR 391.41) --------------------------------------------
  const whisperOk =
    (input.hearing?.whisperRightFt ?? 0) >= HEARING_WHISPER_MIN_FT ||
    (input.hearing?.whisperLeftFt ?? 0) >= HEARING_WHISPER_MIN_FT;
  const dbLoss = input.hearing?.dbLossBetterEar;
  const audiometryOk = typeof dbLoss === "number" ? dbLoss <= HEARING_MAX_DB_LOSS : null;
  const hearingProvided = Boolean(input.hearing && (input.hearing.whisperRightFt || input.hearing.whisperLeftFt || typeof dbLoss === "number"));
  if (hearingProvided && !whisperOk && audiometryOk !== true) {
    alerts.push({ severity: "warning", code: "hearing", message: `Hearing may not meet the FMCSA standard (forced whisper < ${HEARING_WHISPER_MIN_FT} ft and audiometric loss > ${HEARING_MAX_DB_LOSS} dB in the better ear). Confirm with audiometry.` });
  }

  // ---- Sleep apnea red flag ------------------------------------------------
  if (input.healthHistory?.sleep?.yes) {
    alerts.push({ severity: "warning", code: "osa", message: "Driver reports sleep disorder / loud snoring / daytime sleepiness. Screen for obstructive sleep apnea; may warrant shorter certification pending treatment." });
    lower(12, 24);
  }

  // ---- Cardiovascular / seizure red flags ----------------------------------
  if (input.healthHistory?.seizures?.yes) {
    alerts.push({ severity: "critical", code: "seizure", message: "Driver reports seizures/epilepsy — generally disqualifying unless seizure-free off medication for the required period. Review carefully." });
  }
  if (input.healthHistory?.heart?.yes || input.healthHistory?.implant?.yes) {
    alerts.push({ severity: "warning", code: "cardiac", message: "Cardiovascular history reported — consider cardiology clearance and shorter certification interval." });
    lower(12, 24);
  }

  return {
    alerts,
    suggestedCertMonths,
    additionalFormsRequired: Array.from(additionalForms),
    bpCategory,
  };
}
