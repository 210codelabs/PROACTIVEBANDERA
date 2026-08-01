/**
 * Reference / master data seed for Proactive Clinic EHR.
 * Sources (USA authoritative terminologies):
 *  - ICD-10-CM (diagnoses)  -> CMS / CDC NCHS FY2024 (cms.gov/medicare/coding-billing/icd-10-codes)
 *  - CPT / HCPCS (billing)  -> AMA CPT & CMS HCPCS  (NOTE: CPT is AMA-licensed; only a small
 *                              representative set of common codes is seeded here.)
 *  - RxNorm (medications)   -> NLM RxNorm (nlm.nih.gov/research/umls/rxnorm)
 *  - CVX (vaccines)         -> CDC IIS CVX code set (cdc.gov/vaccines/programs/iis/cvx.html)
 *  - Race / Ethnicity       -> OMB 1997 Standards (used by USCDI / Meaningful Use)
 *  - US States              -> USPS state abbreviations
 * The "Create new…" action in the UI extends any of these lists at runtime.
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const S = (arr) => arr.map((display, i) => ({ display, sortOrder: i }));

const DATA = {
  sex: [
    { display: "Male", code: "M", sortOrder: 0 },
    { display: "Female", code: "F", sortOrder: 1 },
    { display: "Other / Nonbinary", code: "X", sortOrder: 2 },
    { display: "Unknown", code: "U", sortOrder: 3 },
  ],
  pronouns: S(["he/him", "she/her", "they/them", "Prefer not to say"]),
  language: S([
    "English", "Spanish", "Vietnamese", "Chinese (Mandarin)", "Chinese (Cantonese)",
    "Tagalog", "Arabic", "French", "Korean", "Russian", "Portuguese", "Haitian Creole",
    "German", "Hindi", "Other",
  ]),
  race: [
    { display: "American Indian or Alaska Native", system: "OMB", sortOrder: 0 },
    { display: "Asian", system: "OMB", sortOrder: 1 },
    { display: "Black or African American", system: "OMB", sortOrder: 2 },
    { display: "Native Hawaiian or Other Pacific Islander", system: "OMB", sortOrder: 3 },
    { display: "White", system: "OMB", sortOrder: 4 },
    { display: "Other Race", system: "OMB", sortOrder: 5 },
    { display: "Decline to specify", system: "OMB", sortOrder: 6 },
  ],
  ethnicity: [
    { display: "Hispanic or Latino", system: "OMB", sortOrder: 0 },
    { display: "Not Hispanic or Latino", system: "OMB", sortOrder: 1 },
    { display: "Decline to specify", system: "OMB", sortOrder: 2 },
  ],
  maritalStatus: S(["Single", "Married", "Partnered", "Divorced", "Separated", "Widowed", "Unknown"]),
  usState: [
    ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
    ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],
    ["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],
    ["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],
    ["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],
    ["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
    ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],
    ["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],
    ["PA","Pennsylvania"],["PR","Puerto Rico"],["RI","Rhode Island"],["SC","South Carolina"],
    ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
    ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
  ].map(([code, display], i) => ({ code, display, system: "USPS", sortOrder: i })),
  insurer: S([
    "Medicare", "Medicaid", "Blue Cross Blue Shield", "UnitedHealthcare", "Aetna", "Cigna",
    "Humana", "Kaiser Permanente", "Anthem", "Molina Healthcare", "Ambetter (Centene)",
    "TRICARE", "Oscar Health", "Self-Pay / Uninsured", "Workers' Compensation", "Auto / Liability",
  ]),
  allergen: S([
    "No known drug allergies (NKDA)", "Penicillin", "Amoxicillin", "Cephalosporins",
    "Sulfa (Sulfonamides)", "Aspirin", "NSAIDs", "Ibuprofen", "Codeine", "Morphine",
    "Iodinated contrast dye", "Latex", "Peanuts", "Tree nuts", "Shellfish", "Eggs", "Milk",
    "Soy", "Wheat / Gluten", "Bee / wasp stings",
  ]),
  allergyReaction: S([
    "Rash", "Hives (urticaria)", "Itching (pruritus)", "Swelling (angioedema)", "Anaphylaxis",
    "Nausea", "Vomiting", "Diarrhea", "Shortness of breath", "Wheezing", "Dizziness",
    "Difficulty swallowing", "Other",
  ]),
  allergySeverity: S(["Mild", "Moderate", "Severe", "Life-threatening"]),
  problemStatus: S(["Active", "Chronic", "Inactive", "Resolved"]),
  medForm: S([
    "Tablet", "Capsule", "Solution", "Suspension", "Cream", "Ointment", "Gel", "Injection",
    "Inhaler", "Patch", "Drops", "Suppository", "Powder", "Spray",
  ]),
  medRoute: [
    ["PO","Oral (PO)"],["IM","Intramuscular (IM)"],["IV","Intravenous (IV)"],["SC","Subcutaneous (SubQ)"],
    ["TOP","Topical"],["INH","Inhalation"],["OPH","Ophthalmic"],["OTIC","Otic"],["NAS","Nasal"],
    ["PR","Rectal"],["SL","Sublingual"],["TD","Transdermal"],
  ].map(([code, display], i) => ({ code, display, sortOrder: i })),
  medFrequency: [
    ["QD","Once daily (QD)"],["BID","Twice daily (BID)"],["TID","Three times daily (TID)"],
    ["QID","Four times daily (QID)"],["QAM","Every morning (QAM)"],["QHS","Every night (QHS)"],
    ["Q4H","Every 4 hours"],["Q6H","Every 6 hours"],["Q8H","Every 8 hours"],["PRN","As needed (PRN)"],
    ["QWK","Weekly"],["QMO","Monthly"],
  ].map(([code, display], i) => ({ code, display, sortOrder: i })),
  apptLocation: S(["In-office", "Home visit", "Telehealth"]),

  diagnosis: [
    ["I10","Essential (primary) hypertension"],
    ["E11.9","Type 2 diabetes mellitus without complications"],
    ["E78.5","Hyperlipidemia, unspecified"],
    ["E66.9","Obesity, unspecified"],
    ["E03.9","Hypothyroidism, unspecified"],
    ["J06.9","Acute upper respiratory infection, unspecified"],
    ["J02.9","Acute pharyngitis, unspecified"],
    ["J20.9","Acute bronchitis, unspecified"],
    ["J45.909","Unspecified asthma, uncomplicated"],
    ["J44.9","Chronic obstructive pulmonary disease, unspecified"],
    ["R05.9","Cough, unspecified"],
    ["R51.9","Headache, unspecified"],
    ["G43.909","Migraine, unspecified, not intractable, without status migrainosus"],
    ["K21.9","Gastro-esophageal reflux disease without esophagitis"],
    ["R10.9","Unspecified abdominal pain"],
    ["N39.0","Urinary tract infection, site not specified"],
    ["M54.50","Low back pain, unspecified"],
    ["M25.561","Pain in right knee"],
    ["M25.562","Pain in left knee"],
    ["M79.7","Fibromyalgia"],
    ["M54.2","Cervicalgia (neck pain)"],
    ["M17.9","Osteoarthritis of knee, unspecified"],
    ["F41.1","Generalized anxiety disorder"],
    ["F41.9","Anxiety disorder, unspecified"],
    ["F32.9","Major depressive disorder, single episode, unspecified"],
    ["F33.9","Major depressive disorder, recurrent, unspecified"],
    ["F51.01","Primary insomnia"],
    ["N18.3","Chronic kidney disease, stage 3 (moderate)"],
    ["I25.10","Atherosclerotic heart disease of native coronary artery without angina"],
    ["D64.9","Anemia, unspecified"],
    ["L30.9","Dermatitis, unspecified"],
    ["H66.90","Otitis media, unspecified, unspecified ear"],
    ["Z00.00","Encounter for general adult medical exam without abnormal findings"],
    ["Z23","Encounter for immunization"],
    ["R53.83","Other fatigue"],
  ].map(([code, display], i) => ({ code, display, system: "ICD-10-CM", sortOrder: i })),

  billingCode: [
    ["99202","Office/outpatient visit, new patient, straightforward (15-29 min)"],
    ["99203","Office/outpatient visit, new patient, low complexity (30-44 min)"],
    ["99204","Office/outpatient visit, new patient, moderate complexity (45-59 min)"],
    ["99205","Office/outpatient visit, new patient, high complexity (60-74 min)"],
    ["99211","Office/outpatient visit, established patient, minimal"],
    ["99212","Office/outpatient visit, established patient, straightforward (10-19 min)"],
    ["99213","Office/outpatient visit, established patient, low complexity (20-29 min)"],
    ["99214","Office/outpatient visit, established patient, moderate complexity (30-39 min)"],
    ["99215","Office/outpatient visit, established patient, high complexity (40-54 min)"],
    ["99396","Preventive visit, established patient, 40-64 years"],
    ["96372","Therapeutic/prophylactic/diagnostic injection (SubQ/IM)"],
    ["90471","Immunization administration, one vaccine"],
    ["90472","Immunization administration, each additional vaccine"],
    ["93000","Electrocardiogram, routine ECG with interpretation & report"],
    ["36415","Collection of venous blood by venipuncture"],
    ["80053","Comprehensive metabolic panel (CMP)"],
    ["85025","Complete blood count (CBC) with differential"],
    ["97110","Therapeutic exercises, each 15 minutes"],
    ["97140","Manual therapy techniques, each 15 minutes"],
    ["97530","Therapeutic activities, each 15 minutes"],
    ["97010","Application of hot or cold packs"],
    ["97035","Ultrasound therapy, each 15 minutes"],
    ["G0283","Electrical stimulation, unattended (HCPCS)"],
    ["99490","Chronic care management, first 20 minutes per month"],
    ["99457","Remote physiologic monitoring treatment, first 20 minutes"],
  ].map(([code, display], i) => ({ code, display, system: "CPT/HCPCS", sortOrder: i })),

  medication: [
    ["Lisinopril", "10 mg", "Tablet"],
    ["Amlodipine", "5 mg", "Tablet"],
    ["Losartan", "50 mg", "Tablet"],
    ["Hydrochlorothiazide", "25 mg", "Tablet"],
    ["Metoprolol tartrate", "25 mg", "Tablet"],
    ["Atorvastatin", "20 mg", "Tablet"],
    ["Rosuvastatin", "10 mg", "Tablet"],
    ["Metformin", "500 mg", "Tablet"],
    ["Glipizide", "5 mg", "Tablet"],
    ["Insulin glargine", "100 units/mL", "Injection"],
    ["Levothyroxine", "50 mcg", "Tablet"],
    ["Omeprazole", "20 mg", "Capsule"],
    ["Pantoprazole", "40 mg", "Tablet"],
    ["Amoxicillin", "500 mg", "Capsule"],
    ["Amoxicillin-clavulanate", "875-125 mg", "Tablet"],
    ["Azithromycin", "250 mg", "Tablet"],
    ["Cephalexin", "500 mg", "Capsule"],
    ["Doxycycline", "100 mg", "Capsule"],
    ["Albuterol", "90 mcg/actuation", "Inhaler"],
    ["Montelukast", "10 mg", "Tablet"],
    ["Prednisone", "10 mg", "Tablet"],
    ["Ibuprofen", "600 mg", "Tablet"],
    ["Acetaminophen", "500 mg", "Tablet"],
    ["Naproxen", "500 mg", "Tablet"],
    ["Gabapentin", "300 mg", "Capsule"],
    ["Tramadol", "50 mg", "Tablet"],
    ["Sertraline", "50 mg", "Tablet"],
    ["Escitalopram", "10 mg", "Tablet"],
    ["Fluoxetine", "20 mg", "Capsule"],
    ["Duloxetine", "30 mg", "Capsule"],
  ].map(([name, strength, form], i) => ({
    display: `${name} ${strength} ${form}`, code: null, system: "RxNorm",
    data: { name, strength, form }, sortOrder: i,
  })),

  vaccine: [
    ["141","Influenza, seasonal, injectable"],
    ["208","COVID-19, mRNA (Pfizer-BioNTech)"],
    ["207","COVID-19, mRNA (Moderna)"],
    ["115","Tdap (Tetanus, diphtheria, acellular pertussis)"],
    ["113","Td (Tetanus, diphtheria)"],
    ["33","Pneumococcal polysaccharide PPSV23"],
    ["133","Pneumococcal conjugate PCV13"],
    ["187","Zoster recombinant (Shingrix)"],
    ["03","MMR (Measles, mumps, rubella)"],
    ["08","Hepatitis B, adult"],
    ["52","Hepatitis A, adult"],
    ["62","HPV9 (Human papillomavirus, 9-valent)"],
  ].map(([code, display], i) => ({ code, display, system: "CVX", sortOrder: i })),
};

async function main() {
  let total = 0;
  for (const [type, rows] of Object.entries(DATA)) {
    for (const r of rows) {
      await db.refData.upsert({
        where: { type_display: { type, display: r.display } },
        update: {
          code: r.code ?? null,
          system: r.system ?? null,
          data: r.data ?? undefined,
          sortOrder: r.sortOrder ?? 0,
          active: true,
        },
        create: {
          type,
          display: r.display,
          code: r.code ?? null,
          system: r.system ?? null,
          data: r.data ?? undefined,
          sortOrder: r.sortOrder ?? 0,
        },
      });
      total++;
    }
    console.log(`  ${type}: ${rows.length}`);
  }
  console.log(`Seeded ${total} reference records across ${Object.keys(DATA).length} types.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
