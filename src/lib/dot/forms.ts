// Static definitions for the DOT / FMCSA occupational-health module.
// Driver health-history checklist (MCSA-5875 driver section), physical-exam
// body systems, certificate durations and restriction options.

export const DOT_FORM_NUMBERS = {
  medicalExamReport: "MCSA-5875", // Medical Examination Report
  medicalCert: "MCSA-5876", // Medical Examiner's Certificate (MEC card)
  itdm: "MCSA-5870", // Insulin-Treated Diabetes Mellitus Assessment
  vision: "MCSA-5871", // Vision Evaluation Report
} as const;

export type HealthQuestion = { key: string; label: string };

// Driver Health History — "Do you have, or have you ever had:" (yes/no + detail)
export const HEALTH_HISTORY: HealthQuestion[] = [
  { key: "head_brain", label: "Head/brain injuries, disorders or illnesses" },
  { key: "seizures", label: "Seizures or epilepsy" },
  { key: "eye_vision", label: "Eye disorders or impaired vision (except corrective lenses)" },
  { key: "ear_hearing", label: "Ear disorders, loss of hearing or balance" },
  { key: "heart", label: "Heart disease, heart attack, bypass, or other cardiovascular condition" },
  { key: "implant", label: "Pacemaker, stents, defibrillator or other implanted device" },
  { key: "hypertension", label: "High blood pressure" },
  { key: "breathing", label: "Chronic cough, shortness of breath, or other breathing problems" },
  { key: "lung", label: "Lung disease (emphysema, asthma, COPD, etc.)" },
  { key: "kidney", label: "Kidney problems, kidney stones, or trouble urinating" },
  { key: "digestive", label: "Stomach, liver, or digestive problems" },
  { key: "diabetes", label: "Diabetes or elevated blood sugar" },
  { key: "psychiatric", label: "Nervous or psychiatric disorder (e.g., severe depression, anxiety)" },
  { key: "loss_consciousness", label: "Loss of consciousness, fainting, or dizziness" },
  { key: "sleep", label: "Sleep disorder, pauses in breathing while asleep, loud snoring, daytime sleepiness" },
  { key: "stroke", label: "Stroke, TIA, paralysis, or weakness" },
  { key: "limb", label: "Missing or impaired hand, arm, foot, leg, finger, or toe" },
  { key: "spine", label: "Spinal injury or disease; chronic low back pain" },
  { key: "chronic_pain", label: "Chronic pain or regular use of pain medication" },
  { key: "substance", label: "Alcohol/narcotic/habit-forming drug use or diagnosed substance dependence" },
  { key: "recent_illness", label: "Any illness or injury in the last 5 years" },
];

export const PHYSICAL_SYSTEMS: HealthQuestion[] = [
  { key: "general", label: "General appearance" },
  { key: "eyes", label: "Eyes" },
  { key: "ears", label: "Ears" },
  { key: "mouth_throat", label: "Mouth and throat" },
  { key: "heart", label: "Heart (murmurs, extra sounds)" },
  { key: "lungs", label: "Lungs and chest" },
  { key: "abdomen", label: "Abdomen and viscera" },
  { key: "vascular", label: "Vascular system (pulse, bruits, varicose veins)" },
  { key: "genitourinary", label: "Genito-urinary system (hernia)" },
  { key: "extremities", label: "Extremities / limb impairment" },
  { key: "spine", label: "Spine, musculoskeletal" },
  { key: "neurological", label: "Neurological (reflexes, coordination)" },
  { key: "skin", label: "Skin" },
];

// Certificate durations (months) the examiner may issue.
export const CERT_DURATIONS = [24, 12, 6, 3, 1] as const;

export const RESTRICTION_OPTIONS: HealthQuestion[] = [
  { key: "corrective_lenses", label: "Wears corrective lenses" },
  { key: "hearing_aid", label: "Wears hearing aid" },
  { key: "spe", label: "Skill Performance Evaluation (SPE) certificate" },
  { key: "driving_exempt_intracity", label: "Qualified only for intracity (exempt) driving" },
  { key: "vision_exemption", label: "Federal vision exemption" },
  { key: "diabetes_exemption", label: "Insulin-treated diabetes assessment on file" },
  { key: "monitor_bp", label: "Wearing corrective devices / must monitor condition" },
];

// FMCSA vision/hearing standards (49 CFR 391.41) used by the rule engine.
export const VISION_MIN_ACUITY = "20/40"; // each eye and both, distant
export const VISION_MIN_FIELD_DEG = 70; // horizontal meridian, each eye
export const HEARING_WHISPER_MIN_FT = 5; // forced whisper distance
export const HEARING_MAX_DB_LOSS = 40; // average 500/1000/2000 Hz, better ear
