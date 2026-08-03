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
  slogan: "Comprehensive Wellness & Recovery",
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
  track: "clinical" | "personal-injury" | "documentation";
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

// ---- Personal-Injury specific language --------------------------------
const ASSIGNMENT_OF_BENEFITS =
  "ASSIGNMENT OF BENEFITS: I hereby assign and transfer to Proactive Clinic all applicable Personal Injury " +
  "Protection (PIP), MedPay, no-fault, health, and any third-party insurance benefits payable for the services " +
  "rendered to me. I authorize and direct my insurer(s) to pay Proactive Clinic directly. This assignment includes " +
  "the right to pursue payment and to release any information necessary to obtain payment. I remain financially " +
  "responsible for any balance not paid by insurance.";

const LETTER_OF_PROTECTION =
  "LETTER OF PROTECTION / LIEN: If I am represented by an attorney in connection with this injury, I request and " +
  "direct my attorney to withhold from any settlement, judgment, or verdict the amounts due to Proactive Clinic for " +
  "care provided, and to pay the clinic directly before disbursing funds to me. I grant Proactive Clinic a lien on " +
  "the proceeds of my claim. I understand this does not relieve me of ultimate financial responsibility for the balance.";

const PIP_DISCLOSURE =
  "PIP DISCLOSURE & ACKNOWLEDGMENT: I acknowledge that the services listed were actually rendered to me and were " +
  "explained as medically necessary. I understand that submitting false, misleading, or fraudulent information to an " +
  "insurer is unlawful and may be prosecuted. I acknowledge receiving the initial statutory disclosure at my first " +
  "treatment and authorize Proactive Clinic to bill my PIP/no-fault carrier for covered services.";

// ---- Clinical (non-injury) specific language --------------------------
const FINANCIAL_POLICY_CLINICAL =
  "FINANCIAL RESPONSIBILITY & ASSIGNMENT OF BENEFITS: I authorize Proactive Clinic to bill my health insurance and " +
  "assign insurance benefits directly to the clinic. I understand that I am responsible for any copay, deductible, " +
  "coinsurance, and non-covered services, and that charges not paid by my insurer are my responsibility.";

const HIPAA_NPP_ACK =
  "NOTICE OF PRIVACY PRACTICES: I acknowledge that I have been offered and/or received a copy of Proactive Clinic's " +
  "Notice of Privacy Practices, which describes how my Protected Health Information (PHI) may be used and disclosed for " +
  "treatment, payment, and healthcare operations in accordance with HIPAA.";

const CONSENT_EVAL_TREAT =
  "CONSENT TO EVALUATE & TREAT: I consent to a physical therapy / rehabilitation evaluation and to the treatment plan " +
  "developed for me, which may include therapeutic exercise, manual therapy, modalities (heat, cold, electrical " +
  "stimulation, ultrasound), and, where clinically appropriate, dry needling. The general benefits and risks have been " +
  "explained and I have had the opportunity to ask questions. I may decline or stop any treatment at any time.";

// =========================================================================
// FORM 1 — New Patient Intake (ONLINE + printable)
// =========================================================================

const NEW_PATIENT_INTAKE: FormDef = {
  slug: "new-patient-intake",
  title: "Personal Injury — New Patient Intake",
  subtitle: "Physical Rehab & Recovery — Auto Accident / Personal-Injury Registration",
  audience: "New patients whose care is related to a motor-vehicle accident or personal-injury (PIP) claim.",
  online: true,
  track: "personal-injury",
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
      title: "Auto Insurance & PIP",
      description:
        "For motor-vehicle claims, provide your auto policy details so we can bill Personal Injury Protection (PIP) / MedPay.",
      fields: [
        { kind: "text", id: "autoCarrier", label: "Auto Insurance Carrier", width: "half" },
        { kind: "text", id: "policyNumber", label: "Policy #", width: "half" },
        { kind: "text", id: "claimNumber", label: "Claim #", width: "half" },
        { kind: "text", id: "policeReport", label: "Police Report / Case #", width: "half" },
        { kind: "text", id: "adjusterName", label: "Adjuster Name", width: "half" },
        { kind: "text", id: "adjusterPhone", label: "Adjuster Phone", width: "half" },
        { kind: "yesno", id: "medPay", label: "Do you have MedPay coverage?" },
        { kind: "yesno", id: "healthInsurance", label: "Do you also have health insurance?" },
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
        { kind: "paragraph", text: ASSIGNMENT_OF_BENEFITS, ack: true, id: "ackAOB", ackLabel: "I agree to the Assignment of Benefits." },
        { kind: "paragraph", text: LETTER_OF_PROTECTION, ack: true, id: "ackLOP", ackLabel: "I agree to the Letter of Protection / Lien (if attorney-represented)." },
        { kind: "paragraph", text: PIP_DISCLOSURE, ack: true, id: "ackPIP", ackLabel: "I acknowledge the PIP Disclosure & Acknowledgment." },
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
  title: "Personal Injury — Follow-Up Check-In",
  subtitle: "Physical Rehab & Recovery — Auto Accident / PI Visit Update",
  audience: "Returning personal-injury patients checking in for a rehab / pain-management follow-up.",
  online: true,
  track: "personal-injury",
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
  track: "documentation",
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
  track: "documentation",
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
  track: "documentation",
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

// =========================================================================
// FORM 6 — Clinical (non-injury) New Patient Intake (ONLINE + printable)
// =========================================================================

const CLINICAL_NEW_PATIENT: FormDef = {
  slug: "clinical-new-patient",
  title: "Clinical — New Patient Intake",
  subtitle: "Physical Recovery & Therapy — General / Wellness New Patient",
  audience: "New patients starting physical therapy or rehabilitation not related to an auto accident.",
  online: true,
  track: "clinical",
  sections: [
    {
      title: "Patient Information",
      description: "Tell us who you are. This information creates your Proactive Clinic chart.",
      fields: [
        { kind: "text", id: "firstName", label: "First Name", width: "half" },
        { kind: "text", id: "lastName", label: "Last Name", width: "half" },
        { kind: "date", id: "dob", label: "Date of Birth", width: "third" },
        { kind: "text", id: "age", label: "Age", width: "third" },
        { kind: "checkboxes", id: "sex", label: "Sex", options: ["Female", "Male", "Other"], inline: true },
        { kind: "text", id: "phone", label: "Phone Number", width: "half" },
        { kind: "text", id: "email", label: "Email", width: "half" },
        { kind: "text", id: "address", label: "Home Address", width: "full" },
        { kind: "heading", text: "Emergency Contact" },
        { kind: "text", id: "emergencyName", label: "Name", width: "half" },
        { kind: "text", id: "emergencyPhone", label: "Phone Number", width: "half" },
      ],
    },
    {
      title: "Insurance & Referral",
      description: "So we can verify coverage and coordinate your care.",
      fields: [
        { kind: "text", id: "primaryInsurance", label: "Primary Insurance", width: "half" },
        { kind: "text", id: "memberId", label: "Member / Policy ID", width: "half" },
        { kind: "text", id: "groupId", label: "Group #", width: "half" },
        { kind: "text", id: "subscriberName", label: "Subscriber Name (if not you)", width: "half" },
        { kind: "text", id: "secondaryInsurance", label: "Secondary Insurance", width: "half" },
        { kind: "text", id: "referringProvider", label: "Referring Provider", width: "half" },
        { kind: "yesno", id: "hasReferral", label: "Do you have a referral or prior authorization?" },
      ],
    },
    {
      title: "Reason for Visit",
      description: "Help us understand what brings you in today.",
      fields: [
        { kind: "textarea", id: "reasonForVisit", label: "Chief complaint / reason for visit", lines: 2 },
        { kind: "text", id: "bodyRegion", label: "Body region affected", width: "half" },
        { kind: "date", id: "onsetDate", label: "When did it start?", width: "half" },
        { kind: "checkboxes", id: "conditionType", label: "This problem is:", options: ["Acute (new)", "Chronic (ongoing)", "Post-surgical", "Work-related"], inline: true },
        { kind: "yesno", id: "priorEpisodes", label: "Have you had this problem before?" },
      ],
    },
    {
      title: "Pain & Function",
      description: "Tell us how symptoms affect your daily life.",
      fields: [
        { kind: "checkboxes", id: "painLevel", label: "Current pain level (0 = none, 10 = worst)", options: ["0-2", "3-4", "5-6", "7-8", "9-10"], inline: true },
        { kind: "textarea", id: "functionalLimitations", label: "Activities that are difficult or limited", lines: 2 },
        { kind: "textarea", id: "goals", label: "Your goals for therapy", lines: 2 },
      ],
    },
    {
      title: "Injury Body Map",
      description: "Tap on the body where you feel pain or symptoms. Add as many points as you need — front and back.",
      fields: [{ kind: "bodymap", id: "bodyMap", label: "Mark your areas of pain" }],
    },
    {
      title: "Medical History",
      description: "Share your health background so we can plan safe, effective therapy.",
      fields: [
        { kind: "textarea", id: "currentMedications", label: "Medications you are currently taking", lines: 2 },
        { kind: "textarea", id: "allergies", label: "Allergies", lines: 1 },
        { kind: "checkboxes", id: "conditions", label: "Do you have any of the following?", options: ["Hypertension", "Diabetes", "Heart Disease", "Osteoporosis", "Asthma", "None"], inline: true },
        { kind: "text", id: "otherConditions", label: "Other medical conditions", width: "full" },
        { kind: "textarea", id: "surgeries", label: "Past surgeries", lines: 1 },
        { kind: "textarea", id: "imaging", label: "Imaging / tests already done (X-ray, MRI, CT)", lines: 1 },
      ],
    },
    {
      title: "Financial Responsibility",
      description: "Please read and acknowledge our billing policy.",
      fields: [
        { kind: "paragraph", text: FINANCIAL_POLICY_CLINICAL, ack: true, id: "ackFinancial", ackLabel: "I acknowledge the Financial Responsibility & Assignment of Benefits." },
      ],
    },
    {
      title: "Privacy & Consent",
      description: "Please read each statement and check to acknowledge.",
      fields: [
        { kind: "paragraph", text: HIPAA_NPP_ACK, ack: true, id: "ackHipaa", ackLabel: "I acknowledge the Notice of Privacy Practices." },
        { kind: "paragraph", text: CONSENT_EVAL_TREAT, ack: true, id: "ackTreatment", ackLabel: "I consent to evaluation and treatment." },
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
// FORM 7 — Clinical (non-injury) Follow-Up Check-In (ONLINE + printable)
// =========================================================================

const CLINICAL_CHECKIN: FormDef = {
  slug: "clinical-checkin",
  title: "Clinical — Follow-Up Check-In",
  subtitle: "Physical Recovery & Therapy — General Visit Update",
  audience: "Returning general therapy patients checking in for a follow-up visit.",
  online: true,
  track: "clinical",
  sections: [
    {
      title: "Find Your Record",
      description: "Confirm your identity so we can attach today's update to your existing chart.",
      fields: [
        { kind: "text", id: "firstName", label: "First Name", width: "half" },
        { kind: "text", id: "lastName", label: "Last Name", width: "half" },
        { kind: "text", id: "mrn", label: "MRN (Medical Record #)", width: "half" },
        { kind: "date", id: "dob", label: "Date of Birth", width: "half" },
      ],
    },
    {
      title: "How Are You Feeling Today?",
      description: "Tell us how you have been doing since your last visit.",
      fields: [
        { kind: "textarea", id: "presentIllness", label: "Current symptoms / how you feel", lines: 3 },
        { kind: "checkboxes", id: "painLevel", label: "Current pain level (0 = none, 10 = worst)", options: ["0-2", "3-4", "5-6", "7-8", "9-10"], inline: true },
        { kind: "checkboxes", id: "progress", label: "Since your last visit, your symptoms are:", options: ["Much better", "Better", "Same", "Worse", "Much worse"], inline: true },
        { kind: "yesno", id: "newSymptoms", label: "Any new symptoms or injuries?" },
        { kind: "textarea", id: "medsChanges", label: "Any changes to your medications?", lines: 1 },
      ],
    },
    {
      title: "Injury Body Map",
      description: "Tap on the body where you feel pain or symptoms today.",
      fields: [{ kind: "bodymap", id: "bodyMap", label: "Mark your areas of pain" }],
    },
    {
      title: "Consent Re-Acknowledgement",
      description: "Please re-confirm your ongoing consent for today's treatment.",
      fields: [
        { kind: "paragraph", text: CONSENT_EVAL_TREAT, ack: true, id: "ackTreatment", ackLabel: "I re-confirm my consent to today's treatment." },
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

// -------------------------------------------------------------------------

export const FORMS: FormDef[] = [
  CLINICAL_NEW_PATIENT,
  CLINICAL_CHECKIN,
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
    track: f.track,
  }));
}
