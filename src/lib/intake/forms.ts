// -------------------------------------------------------------------------
// Proactive Clinic — Intake / Clinical Form definitions
// Single source of truth that drives BOTH the branded PDF generator
// (src/lib/intake/pdf.ts) and the online intake UI (src/app/intake).
// Rebranded from the supplied Flagler MRI templates for
// Physical Recovery & Therapy patients (new + current).
// -------------------------------------------------------------------------

export const CLINIC = {
  name: "Proactive Clinic",
  tagline: "Physical Recovery & Therapy",
  addr1: "8103 Bandera Rd, Suite 102",
  addr2: "San Antonio, TX 78250",
  phone: "(210) 500-2914",
  email: "info@proactiveclinic.com",
  web: "proactiveclinics.com",
};

export type Width = "full" | "twothird" | "half" | "third";

export type Field =
  | { kind: "text"; id?: string; label: string; width?: Width; placeholder?: string }
  | { kind: "date"; id?: string; label: string; width?: Width }
  | { kind: "textarea"; id?: string; label: string; lines?: number }
  | { kind: "checkboxes"; id?: string; label?: string; options: string[]; inline?: boolean }
  | { kind: "yesno"; id?: string; label: string }
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string; ack?: boolean; id?: string; ackLabel?: string }
  | { kind: "signature"; id?: string; label: string }
  | { kind: "bodymap"; id: string; label: string; instructions?: string }
  | { kind: "pairs"; label: string; columns: string[]; rows: string[] };

export type Section = {
  title: string;
  description?: string;
  fields: Field[];
};

export type FormDef = {
  slug: string;
  title: string;
  subtitle: string;
  audience: string; // short description of who it is for
  online: boolean; // true => rendered as an interactive online form
  sections: Section[];
};

// ---- Shared consent language (rebranded) --------------------------------

const CONSENT_TREATMENT =
  "I authorize Proactive Clinic and its licensed providers, therapists, and clinical staff to perform the " +
  "evaluation, physical therapy, rehabilitation, chiropractic, and pain-management treatment(s) that are " +
  "determined to be necessary or advisable in the course of my care. I acknowledge that the general nature, " +
  "expected benefits, and reasonable risks of treatment have been explained to me and that I have had the " +
  "opportunity to ask questions. I understand no guarantee has been made as to the result of treatment and " +
  "that I may withdraw this consent at any time.";

const RADIOLOGY_EN =
  "I authorize the performance of diagnostic X-ray and imaging examinations of myself which the provider(s) " +
  "or the facility may consider necessary or advisable in the course of my examination and treatment.";

const RADIOLOGY_ES =
  "Yo autorizo a que se me realicen los exámenes de rayos-X e imágenes diagnósticas que el proveedor(a) o la " +
  "institución puedan considerar necesarios durante mi evaluación y tratamiento.";

const PREGNANCY_EN =
  "TO BE READ BY ALL PATIENTS OF CHILDBEARING AGE: X-rays taken during pregnancy may be harmful to an " +
  "unborn child. The most sensitive period is the first three months. Please inform the provider or technician " +
  "if there is any possibility that you may be pregnant. I certify that, to the best of my knowledge, I am NOT " +
  "pregnant and I authorize the diagnostic imaging examination.";

const PREGNANCY_ES =
  "PARA TODAS LAS PACIENTES EN EDAD FÉRTIL: Las radiografías durante el embarazo pueden ser peligrosas para " +
  "el feto. El período más sensible es durante los primeros tres meses. Por favor informe al proveedor(a) o " +
  "técnico(a) si existe alguna posibilidad de que esté embarazada. Certifico que, a mi leal saber, NO estoy " +
  "embarazada y autorizo el examen de imágenes diagnósticas.";

const FINANCIAL_ACK =
  "I understand that I am financially responsible for all charges regardless of insurance or third-party " +
  "coverage. If my care is related to a motor-vehicle accident or personal-injury claim, I authorize Proactive " +
  "Clinic to communicate with my attorney and/or insurer and to furnish records and bills related to my treatment.";

// =========================================================================
// FORM 1 — New Patient Intake (ONLINE + printable)
// =========================================================================

const NEW_PATIENT_INTAKE: FormDef = {
  slug: "new-patient-intake",
  title: "New Patient Intake",
  subtitle: "Physical Recovery & Therapy — New Patient Registration",
  audience: "First-time patients starting physical therapy, rehabilitation, or pain-management care.",
  online: true,
  sections: [
    {
      title: "Patient Information",
      description:
        "Tell us who you are. This information creates your Proactive Clinic chart. Please print clearly if completing on paper.",
      fields: [
        { kind: "text", id: "firstName", label: "First Name", width: "half" },
        { kind: "text", id: "lastName", label: "Last Name", width: "half" },
        { kind: "date", id: "dob", label: "Date of Birth", width: "third" },
        { kind: "text", id: "age", label: "Age", width: "third" },
        { kind: "checkboxes", id: "sex", label: "Sex", options: ["Female", "Male", "Other"], inline: true },
        { kind: "text", id: "phone", label: "Phone Number", width: "half" },
        { kind: "text", id: "email", label: "Email", width: "half" },
        { kind: "text", id: "address", label: "Home Address", width: "full" },
        { kind: "text", id: "referredBy", label: "Referred By", width: "half" },
        { kind: "date", id: "initialDate", label: "Initial Visit Date", width: "half" },
        { kind: "heading", text: "Emergency Contact" },
        { kind: "text", id: "emergencyName", label: "Name", width: "half" },
        { kind: "text", id: "emergencyPhone", label: "Phone Number", width: "half" },
      ],
    },
    {
      title: "Injury / Accident Details",
      description:
        "Complete this section only if your visit is related to an injury or motor-vehicle accident. If not accident-related, skip to the next section.",
      fields: [
        { kind: "date", id: "dateOfAccident", label: "Date of Accident / Injury", width: "half" },
        { kind: "yesno", id: "seatbelt", label: "Were you wearing your seatbelt?" },
        { kind: "text", id: "vehicleType", label: "What type of vehicle were you in?", width: "full" },
        { kind: "checkboxes", id: "sideHit", label: "From what side were you hit?", options: ["Front", "Rear", "Left Side", "Right Side"], inline: true },
        { kind: "checkboxes", id: "role", label: "You were the:", options: ["Driver", "Passenger", "Pedestrian", "Other"], inline: true },
        { kind: "checkboxes", id: "seatPosition", label: "If a passenger, where were you seated?", options: ["Front", "Back"], inline: true },
        { kind: "checkboxes", id: "impactHit", label: "At the time of impact, what did you hit?", options: ["Door", "Seat", "Window", "Steering Wheel", "Other"], inline: true },
        { kind: "checkboxes", id: "injuredAreas", label: "Where were you injured?", options: ["Neck", "Mid Back", "Lower Back", "Shoulder", "Knee", "Other"], inline: true },
        { kind: "yesno", id: "erVisit", label: "Were you seen and/or treated in an emergency room?" },
        { kind: "text", id: "erFacility", label: "If yes, name the facility", width: "full" },
        { kind: "textarea", id: "presentIllness", label: "Describe your current symptoms / present illness", lines: 3 },
      ],
    },
    {
      title: "Injury Body Map",
      description: "Tap on the body where you feel pain or injury. Add as many points as you need — front and back.",
      fields: [{ kind: "bodymap", id: "bodyMap", label: "Mark your areas of pain" }],
    },
    {
      title: "Past & Present Medical History",
      description:
        "Help our clinical team plan safe, effective therapy by sharing your health background. Leave blank anything that does not apply.",
      fields: [
        { kind: "textarea", id: "currentMedications", label: "Medications you are currently taking", lines: 2 },
        { kind: "checkboxes", id: "conditions", label: "Do you have any of the following?", options: ["Hypertension", "Diabetes", "Heart Disease", "Asthma", "None"], inline: true },
        { kind: "text", id: "otherConditions", label: "Other medical conditions", width: "full" },
        { kind: "textarea", id: "previousAccidents", label: "Previous accidents / injuries", lines: 2 },
        { kind: "textarea", id: "surgeries", label: "Past surgeries", lines: 2 },
        { kind: "textarea", id: "allergies", label: "Allergies", lines: 2 },
        { kind: "heading", text: "Lifestyle & Habits" },
        { kind: "text", id: "habitAlcohol", label: "Alcohol", width: "half" },
        { kind: "text", id: "habitSmoking", label: "Smoking", width: "half" },
        { kind: "text", id: "habitDrugs", label: "Recreational Drugs", width: "half" },
        { kind: "text", id: "habitCoffee", label: "Coffee / Caffeine", width: "half" },
        { kind: "heading", text: "For patients of childbearing age" },
        { kind: "date", id: "lastMenstruation", label: "Date of last menstruation", width: "half" },
        { kind: "yesno", id: "pregnant", label: "Is there any possibility you are pregnant?" },
      ],
    },
    {
      title: "Legal / Attorney Information",
      description:
        "Complete only if your care is related to a personal-injury (PIP) or auto-accident claim managed by an attorney.",
      fields: [
        { kind: "text", id: "attorneyFirm", label: "Attorney / Law Firm Name", width: "full" },
        { kind: "text", id: "attorneyAddress", label: "Firm Address", width: "full" },
        { kind: "text", id: "attorneyPhone", label: "Firm Phone / Fax", width: "half" },
        { kind: "text", id: "caseNumber", label: "Case #", width: "half" },
        { kind: "text", id: "biAmount", label: "BI Policy Amount", width: "half" },
        { kind: "text", id: "insurer", label: "Insurance Carrier", width: "half" },
      ],
    },
    {
      title: "Consent to Treatment",
      description: "Please read carefully. Your signature at the end of this form confirms your agreement.",
      fields: [
        { kind: "paragraph", text: CONSENT_TREATMENT, ack: true, id: "ackTreatment", ackLabel: "I have read and agree to the Consent to Treatment." },
        { kind: "paragraph", text: FINANCIAL_ACK, ack: true, id: "ackFinancial", ackLabel: "I acknowledge the financial and records-release statement." },
      ],
    },
    {
      title: "Radiology / Imaging Consent",
      description: "Bilingual authorization for diagnostic imaging (English & Español).",
      fields: [
        { kind: "paragraph", text: RADIOLOGY_EN },
        { kind: "paragraph", text: RADIOLOGY_ES },
        { kind: "paragraph", text: PREGNANCY_EN },
        { kind: "paragraph", text: PREGNANCY_ES, ack: true, id: "ackRadiology", ackLabel: "I authorize diagnostic imaging and certify the pregnancy statement (if applicable)." },
      ],
    },
    {
      title: "Acknowledgement & Signature",
      description: "By signing below, you confirm the information provided is accurate to the best of your knowledge.",
      fields: [
        { kind: "signature", id: "signature", label: "Patient / Guardian Signature" },
        { kind: "date", id: "signDate", label: "Date", width: "half" },
      ],
    },
  ],
};

// =========================================================================
// FORM 2 — Current Patient Follow-Up Check-In (ONLINE + printable)
// =========================================================================

const CURRENT_PATIENT_CHECKIN: FormDef = {
  slug: "current-patient-checkin",
  title: "Follow-Up Check-In",
  subtitle: "Physical Recovery & Therapy — Existing Patient Visit Update",
  audience: "Returning patients checking in for a therapy or pain-management follow-up visit.",
  online: true,
  sections: [
    {
      title: "Find Your Record",
      description: "Confirm your identity so we can attach today's update to your existing Proactive Clinic chart.",
      fields: [
        { kind: "text", id: "firstName", label: "First Name", width: "half" },
        { kind: "text", id: "lastName", label: "Last Name", width: "half" },
        { kind: "text", id: "mrn", label: "MRN (Medical Record #)", width: "half" },
        { kind: "date", id: "dob", label: "Date of Birth", width: "half" },
      ],
    },
    {
      title: "How Are You Feeling Today?",
      description: "Tell us how you have been doing since your last visit so your provider can adjust your plan.",
      fields: [
        { kind: "textarea", id: "presentIllness", label: "Current symptoms / present illness", lines: 3 },
        { kind: "checkboxes", id: "painLevel", label: "Current pain level (0 = none, 10 = worst)", options: ["0-2", "3-4", "5-6", "7-8", "9-10"], inline: true },
        { kind: "checkboxes", id: "progress", label: "Since your last visit, your symptoms are:", options: ["Much better", "Better", "Same", "Worse", "Much worse"], inline: true },
        { kind: "yesno", id: "newSymptoms", label: "Any new symptoms or injuries?" },
        { kind: "textarea", id: "newSymptomsDetail", label: "If yes, please describe", lines: 2 },
        { kind: "textarea", id: "medsChanges", label: "Any changes to your medications?", lines: 2 },
      ],
    },
    {
      title: "Injury Body Map",
      description: "Tap on the body where you feel pain or injury. Add as many points as you need — front and back.",
      fields: [{ kind: "bodymap", id: "bodyMap", label: "Mark your areas of pain" }],
    },
    {
      title: "Consent Re-Acknowledgement",
      description: "Please re-confirm your ongoing consent for today's treatment.",
      fields: [
        { kind: "paragraph", text: CONSENT_TREATMENT, ack: true, id: "ackTreatment", ackLabel: "I re-confirm my consent to today's treatment." },
      ],
    },
    {
      title: "Signature",
      description: "By signing you confirm today's update is accurate.",
      fields: [
        { kind: "signature", id: "signature", label: "Patient Signature" },
        { kind: "date", id: "signDate", label: "Date", width: "half" },
      ],
    },
  ],
};

// =========================================================================
// FORM 3 — First Office Visit (CLINICAL, print only)
// =========================================================================

const FIRST_OFFICE_VISIT: FormDef = {
  slug: "first-office-visit",
  title: "First Office Visit — Clinical Evaluation",
  subtitle: "Physical Recovery & Therapy — Provider Documentation",
  audience: "Provider-completed comprehensive evaluation for a new patient.",
  online: false,
  sections: [
    {
      title: "Patient & Visit",
      fields: [
        { kind: "text", label: "Patient Name", width: "half" },
        { kind: "date", label: "Date", width: "half" },
        { kind: "text", label: "Age", width: "third" },
        { kind: "text", label: "Height", width: "third" },
        { kind: "text", label: "Weight", width: "third" },
        { kind: "text", label: "BP", width: "third" },
        { kind: "text", label: "Pulse", width: "third" },
        { kind: "text", label: "Temp", width: "third" },
        { kind: "date", label: "Date of Accident", width: "half" },
        { kind: "textarea", label: "Present Illness", lines: 3 },
      ],
    },
    {
      title: "Accident Details",
      fields: [
        { kind: "yesno", label: "Were you wearing your seatbelt?" },
        { kind: "text", label: "What type of vehicle were you in?", width: "full" },
        { kind: "checkboxes", label: "From what side were you hit?", options: ["Front", "Rear", "Left Side", "Right Side"], inline: true },
        { kind: "checkboxes", label: "You were the:", options: ["Driver", "Passenger", "Pedestrian", "Other"], inline: true },
        { kind: "checkboxes", label: "If a passenger, seated:", options: ["Front", "Back"], inline: true },
        { kind: "checkboxes", label: "At impact you hit:", options: ["Door", "Seat", "Window", "Other"], inline: true },
        { kind: "checkboxes", label: "Areas injured:", options: ["Neck", "Mid Back", "Lower Back", "Other"], inline: true },
        { kind: "yesno", label: "Seen / treated in an emergency room?" },
        { kind: "text", label: "If yes, name the facility", width: "full" },
      ],
    },
    {
      title: "Past & Present Medical History",
      fields: [
        { kind: "textarea", label: "Current medications", lines: 2 },
        { kind: "checkboxes", label: "Disease history", options: ["Hypertension", "Diabetes", "Heart Disease"], inline: true },
        { kind: "text", label: "Other", width: "full" },
        { kind: "textarea", label: "Previous accidents", lines: 2 },
        { kind: "textarea", label: "Surgeries", lines: 2 },
        { kind: "textarea", label: "Allergies", lines: 2 },
        { kind: "heading", text: "Habits" },
        { kind: "text", label: "Alcohol", width: "third" },
        { kind: "text", label: "Smoking", width: "third" },
        { kind: "text", label: "Drugs", width: "third" },
        { kind: "text", label: "Coffee", width: "third" },
        { kind: "date", label: "Date of last menstruation (if applicable)", width: "half" },
        { kind: "yesno", label: "Is the patient possibly pregnant?" },
        { kind: "heading", text: "Review of Systems (Head/Neuro)" },
        { kind: "yesno", label: "Head: visible injury, hematoma or laceration?" },
        { kind: "yesno", label: "Headaches?" },
        { kind: "yesno", label: "Dizziness?" },
        { kind: "yesno", label: "Swelling?" },
        { kind: "yesno", label: "Head trauma / LOC?" },
        { kind: "textarea", label: "EENT / Face notes", lines: 2 },
      ],
    },
    {
      title: "Physical Examination — General",
      fields: [
        { kind: "text", label: "Thyroid & Neck Glands", width: "half" },
        { kind: "text", label: "Chest", width: "half" },
        { kind: "text", label: "Heart", width: "half" },
        { kind: "text", label: "Lungs", width: "half" },
        { kind: "text", label: "Rib Cage", width: "half" },
        { kind: "text", label: "Abdomen", width: "half" },
      ],
    },
    {
      title: "Spinal Examination",
      description: "Cervical, dorsal and lumbosacral spine range of motion and findings.",
      fields: [
        { kind: "heading", text: "Cervical Spine" },
        { kind: "text", label: "Spinous Processes", width: "half" },
        { kind: "text", label: "Musculature", width: "half" },
        { kind: "checkboxes", label: "ROM painful — Flexion", options: ["Yes", "No"], inline: true },
        { kind: "checkboxes", label: "ROM painful — Extension", options: ["Yes", "No"], inline: true },
        { kind: "checkboxes", label: "Lateral bending / Rotation painful", options: ["Yes", "No"], inline: true },
        { kind: "text", label: "Compression Test", width: "full" },
        { kind: "heading", text: "Dorsal (Thoracic) Spine" },
        { kind: "text", label: "Spinous Processes", width: "half" },
        { kind: "text", label: "Musculature", width: "half" },
        { kind: "checkboxes", label: "ROM painful — Flexion / Extension", options: ["Yes", "No"], inline: true },
        { kind: "checkboxes", label: "Rotation / Stiffness", options: ["Yes", "No"], inline: true },
        { kind: "heading", text: "Lumbosacral Spine" },
        { kind: "text", label: "Spinous Processes", width: "half" },
        { kind: "text", label: "Musculature", width: "half" },
        { kind: "checkboxes", label: "ROM painful — Flexion / Extension", options: ["Yes", "No"], inline: true },
        { kind: "text", label: "Compression Test", width: "half" },
        { kind: "text", label: "SLR (Straight Leg Raise)", width: "half" },
        { kind: "heading", text: "Special Tests" },
        { kind: "checkboxes", label: "Romberg", options: ["Normal", "Abnormal"], inline: true },
        { kind: "text", label: "Patellar Reflexes", width: "half" },
        { kind: "text", label: "Gait", width: "half" },
      ],
    },
    {
      title: "Extremities",
      fields: [
        { kind: "pairs", label: "Upper Extremities", columns: ["Right", "Left"], rows: ["Shoulder", "Arm", "Forearm", "Elbow", "Wrist", "Hand", "Fingers", "Ribs"] },
        { kind: "pairs", label: "Lower Extremities", columns: ["Right", "Left"], rows: ["Hip", "Thigh", "Knee", "Leg", "Ankle", "Foot", "Toes"] },
        { kind: "textarea", label: "Radiology / Imaging", lines: 3 },
      ],
    },
    {
      title: "Medical Decision Making",
      fields: [
        { kind: "textarea", label: "Diagnosis / Impression", lines: 4 },
        { kind: "textarea", label: "Treatment Plan", lines: 4 },
        { kind: "signature", label: "Provider Signature" },
        { kind: "signature", label: "Patient Signature" },
      ],
    },
  ],
};

// =========================================================================
// FORM 4 — Follow-Up Visit (CLINICAL, print only)
// =========================================================================

const FOLLOWUP_VISIT: FormDef = {
  slug: "followup-visit",
  title: "Follow-Up Visit — Clinical Note",
  subtitle: "Physical Recovery & Therapy — Provider Documentation",
  audience: "Provider-completed progress note for a returning patient.",
  online: false,
  sections: [
    {
      title: "Patient & Vitals",
      fields: [
        { kind: "text", label: "Patient Name", width: "half" },
        { kind: "date", label: "Date", width: "half" },
        { kind: "text", label: "BP", width: "third" },
        { kind: "text", label: "Pulse", width: "third" },
        { kind: "text", label: "Temp", width: "third" },
        { kind: "text", label: "Weight", width: "third" },
        { kind: "textarea", label: "Present Illness (Subjective)", lines: 3 },
      ],
    },
    {
      title: "Objective — Systems",
      fields: [
        { kind: "text", label: "Head", width: "half" },
        { kind: "text", label: "Heart", width: "half" },
        { kind: "text", label: "Lungs", width: "half" },
        { kind: "text", label: "Abdomen", width: "half" },
        { kind: "text", label: "Muscle / Skeletal", width: "full" },
        { kind: "text", label: "Cervical Spine", width: "third" },
        { kind: "text", label: "Thoracic Spine", width: "third" },
        { kind: "text", label: "Lumbar Spine", width: "third" },
      ],
    },
    {
      title: "Objective — Extremities",
      fields: [
        { kind: "pairs", label: "Superior (Upper)", columns: ["Findings"], rows: ["Shoulders", "Elbows", "Forearms", "Wrists", "Hands", "Arms", "Chest", "Ribs"] },
        { kind: "pairs", label: "Inferior (Lower)", columns: ["Findings"], rows: ["Hips", "Thighs", "Knees", "Legs", "Ankles", "Feet"] },
      ],
    },
    {
      title: "Medical Decision Making",
      fields: [
        { kind: "textarea", label: "Diagnosis (list)", lines: 5 },
        { kind: "textarea", label: "Plan", lines: 4 },
        { kind: "signature", label: "Physician Signature" },
        { kind: "signature", label: "Patient Signature" },
      ],
    },
  ],
};

// =========================================================================
// FORM 5 — Procedure Report (CLINICAL, print only)
// =========================================================================

const PROCEDURE_REPORT: FormDef = {
  slug: "procedure-report",
  title: "Procedure Report",
  subtitle: "Physical Recovery & Therapy — Procedure Documentation",
  audience: "Provider-completed report for an in-office procedure or injection.",
  online: false,
  sections: [
    {
      title: "Patient & Procedure",
      fields: [
        { kind: "text", label: "Patient Name", width: "half" },
        { kind: "date", label: "Date of Service", width: "half" },
        { kind: "text", label: "Date of Birth", width: "third" },
        { kind: "text", label: "MRN", width: "third" },
        { kind: "text", label: "Referring Provider", width: "third" },
        { kind: "textarea", label: "Pre-Procedure Diagnosis", lines: 2 },
        { kind: "textarea", label: "Procedure Performed", lines: 2 },
      ],
    },
    {
      title: "Procedure & Billing Codes",
      fields: [
        { kind: "text", label: "CPT Code (a)", width: "half" },
        { kind: "text", label: "CPT Code (b)", width: "half" },
        { kind: "text", label: "CPT Code (c)", width: "half" },
        { kind: "text", label: "CPT Code (d)", width: "half" },
        { kind: "text", label: "Diagnosis / ICD-10 (a)", width: "half" },
        { kind: "text", label: "Diagnosis / ICD-10 (b)", width: "half" },
        { kind: "text", label: "Diagnosis / ICD-10 (c)", width: "half" },
        { kind: "text", label: "Diagnosis / ICD-10 (d)", width: "half" },
      ],
    },
    {
      title: "Clinical Detail",
      fields: [
        { kind: "textarea", label: "Anesthesia / Medications", lines: 2 },
        { kind: "textarea", label: "Findings", lines: 4 },
        { kind: "textarea", label: "Complications", lines: 2 },
        { kind: "textarea", label: "Post-Procedure Instructions", lines: 3 },
        { kind: "text", label: "Do not drive for (hours)", width: "half" },
        { kind: "signature", label: "Provider Signature" },
        { kind: "signature", label: "Patient Signature" },
      ],
    },
  ],
};

// -------------------------------------------------------------------------

export const FORMS: FormDef[] = [
  NEW_PATIENT_INTAKE,
  CURRENT_PATIENT_CHECKIN,
  FIRST_OFFICE_VISIT,
  FOLLOWUP_VISIT,
  PROCEDURE_REPORT,
];

export function getForm(slug: string): FormDef | undefined {
  return FORMS.find((f) => f.slug === slug);
}

export function formSummaries() {
  return FORMS.map((f) => ({
    slug: f.slug,
    title: f.title,
    subtitle: f.subtitle,
    audience: f.audience,
    online: f.online,
  }));
}
