import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, addHours, addMinutes, setHours, setMinutes, startOfDay, subDays, subYears } from "date-fns";

const db = new PrismaClient();

const PASSWORD = "apex123";

async function main() {
  console.log("🌱 Seeding ProactiveClinics EHR…");

  // Wipe everything first (dev only)
  await db.auditLog.deleteMany();
  await db.posSaleLine.deleteMany();
  await db.posSale.deleteMany();
  await db.stockMovement.deleteMany();
  await db.inventoryItem.deleteMany();
  await db.message.deleteMany();
  await db.document.deleteMany();
  await db.encounterCharge.deleteMany();
  await db.encounterDiagnosis.deleteMany();
  await db.encounterNote.deleteMany();
  await db.order.deleteMany();
  await db.pharmacy.deleteMany();
  await db.encounter.deleteMany();
  await db.appointment.deleteMany();
  await db.immunization.deleteMany();
  await db.vital.deleteMany();
  await db.medication.deleteMany();
  await db.problem.deleteMany();
  await db.allergy.deleteMany();
  await db.patient.deleteMany();
  await db.serviceType.deleteMany();
  await db.user.deleteMany();

  // ---------------- Users ----------------
  const hash = await bcrypt.hash(PASSWORD, 10);
  const [drRivera, npTan, dptJones, mdSmith, nurseKim, frontLopez, billing, admin] = await Promise.all([
    db.user.create({ data: { email: "mariuska.aristica@proactivemedical.com", passwordHash: hash, firstName: "Mariuska", lastName: "Aristica", role: "provider", credential: "PD", specialty: "Practice Director", npi: "1234567890" } }),
    db.user.create({ data: { email: "np.tan@proactivemedical.com", passwordHash: hash, firstName: "Linh", lastName: "Tan", role: "provider", credential: "NP", specialty: "Primary Care / Aesthetics", npi: "9876543210" } }),
    db.user.create({ data: { email: "dpt.jones@proactivemedical.com", passwordHash: hash, firstName: "Devon", lastName: "Jones", role: "provider", credential: "DPT", specialty: "Physical Therapy", npi: "5556667770" } }),
    db.user.create({ data: { email: "md.smith@proactivemedical.com", passwordHash: hash, firstName: "Aaron", lastName: "Smith", role: "provider", credential: "MD", specialty: "Wound Care / Pain Management", npi: "1112223334" } }),
    db.user.create({ data: { email: "nurse.kim@proactivemedical.com", passwordHash: hash, firstName: "Soo", lastName: "Kim", role: "nurse", credential: "RN" } }),
    db.user.create({ data: { email: "front.lopez@proactivemedical.com", passwordHash: hash, firstName: "Carla", lastName: "Lopez", role: "frontdesk" } }),
    db.user.create({ data: { email: "billing@proactivemedical.com", passwordHash: hash, firstName: "Pat", lastName: "Nguyen", role: "billing" } }),
    db.user.create({ data: { email: "admin@proactivemedical.com", passwordHash: hash, firstName: "Avery", lastName: "Park", role: "admin" } }),
  ]);

  console.log(`  ✓ ${8} users`);

  // ---------------- Service Types ----------------
  const services = await Promise.all([
    // Physical Therapy
    db.serviceType.create({ data: { code: "PT-EVAL", name: "PT — Initial Evaluation", category: "physical-therapy", durationMin: 45, description: "Functional rehab evaluation", defaultCpt: "97161", homeEligible: true } }),
    db.serviceType.create({ data: { code: "PT-FOLLOW", name: "PT — Follow-up Treatment", category: "physical-therapy", durationMin: 45, description: "Therapeutic exercise + manual therapy", defaultCpt: "97110", homeEligible: true } }),
    db.serviceType.create({ data: { code: "PT-PAIN", name: "PT — Pain Management", category: "physical-therapy", durationMin: 45, description: "Pain management therapy", defaultCpt: "97140" } }),
    db.serviceType.create({ data: { code: "PT-POSTOP", name: "PT — Post-operative Therapy", category: "physical-therapy", durationMin: 45, description: "Post-surgical rehabilitation", defaultCpt: "97110" } }),
    db.serviceType.create({ data: { code: "PT-REHAB", name: "Physical Rehabilitation Session", category: "physical-therapy", durationMin: 45, description: "Comprehensive physical rehabilitation treatment plan", defaultCpt: "97110", homeEligible: true } }),

    // Wound Care
    db.serviceType.create({ data: { code: "WC-CHRONIC", name: "Wound Care — Chronic Wound", category: "wound-care", durationMin: 45, description: "Chronic wound assessment & dressing", defaultCpt: "97597", homeEligible: true } }),
    db.serviceType.create({ data: { code: "WC-ACUTE", name: "Wound Care — Acute Wound", category: "wound-care", durationMin: 45, description: "Acute wound management", defaultCpt: "97597", homeEligible: true } }),
    db.serviceType.create({ data: { code: "WC-INFECT", name: "Wound Care — Infection Prevention", category: "wound-care", durationMin: 45, description: "Infection prevention & cleaning", defaultCpt: "97598", homeEligible: true } }),
    db.serviceType.create({ data: { code: "WC-HOMEEVAL", name: "Wound Care — Home Evaluation", category: "wound-care", durationMin: 45, description: "Evaluation conducted at the patient's home", homeEligible: true } }),

    // Other Services
    db.serviceType.create({ data: { code: "OS-PE", name: "Physical Exam", category: "other-services", durationMin: 45, description: "Annual / new-patient physical", defaultCpt: "99204" } }),
    db.serviceType.create({ data: { code: "OS-LAB", name: "Laboratory Draw", category: "other-services", durationMin: 45, description: "In-office labs (CBC, CMP, A1c, lipids)" } }),
    db.serviceType.create({ data: { code: "OS-EKG", name: "EKG", category: "other-services", durationMin: 30, description: "In-office electrocardiogram", defaultCpt: "93000" } }),
    db.serviceType.create({ data: { code: "OS-WEIGHT", name: "Weight Management Consult", category: "other-services", durationMin: 45, description: "Weight management counseling" } }),

    // Aesthetic Medicine
    db.serviceType.create({ data: { code: "AE-BOTOX", name: "Botox Injection", category: "aesthetic-medicine", durationMin: 45, description: "Toxin injection consultation + treatment", defaultCpt: "11900" } }),
    db.serviceType.create({ data: { code: "AE-FILLER", name: "Dermal Filler", category: "aesthetic-medicine", durationMin: 45, description: "Hyaluronic acid filler" } }),
    db.serviceType.create({ data: { code: "AE-LASER", name: "Laser Aesthetic Consultation", category: "aesthetic-medicine", durationMin: 30, description: "Laser candidacy consult and treatment planning" } }),
    db.serviceType.create({ data: { code: "AE-ENDOLIFT", name: "Endolaser (Endolift)", category: "aesthetic-medicine", durationMin: 60, description: "Subdermal laser remodeling and contouring" } }),
    db.serviceType.create({ data: { code: "AE-SKIN-REJ", name: "Laser Skin Rejuvenation", category: "aesthetic-medicine", durationMin: 45, description: "Fractional / resurfacing laser treatment" } }),
    db.serviceType.create({ data: { code: "AE-HAIR-LASER", name: "Laser Hair Removal", category: "aesthetic-medicine", durationMin: 45, description: "Laser-based long-term hair reduction" } }),
    db.serviceType.create({ data: { code: "AE-M8", name: "Morpheus8 (Radiofrequency + Microneedling)", category: "aesthetic-medicine", durationMin: 60, description: "RF-assisted microneedling skin tightening" } }),
    db.serviceType.create({ data: { code: "AE-MESO", name: "Mesotherapy", category: "aesthetic-medicine", durationMin: 45, description: "Mesotherapy treatment" } }),
    db.serviceType.create({ data: { code: "AE-PRP-FACE", name: "Facial PRP", category: "aesthetic-medicine", durationMin: 45, description: "Facial platelet-rich plasma therapy" } }),
    db.serviceType.create({ data: { code: "AE-PRP-HAIR", name: "Capillary PRP (Hair)", category: "aesthetic-medicine", durationMin: 45, description: "Capillary PRP for hair restoration" } }),

    // Primary Care
    db.serviceType.create({ data: { code: "PC-FOLLOW", name: "Primary Care Follow-up", category: "primary-care", durationMin: 30, description: "Established patient visit", defaultCpt: "99213" } }),
    db.serviceType.create({ data: { code: "PC-ACUTE", name: "Primary Care Acute Visit", category: "primary-care", durationMin: 30, description: "Acute concern", defaultCpt: "99214" } }),

    // Add-on services (retail, pharmacy & wellness perks)
    db.serviceType.create({ data: { code: "ADD-IMMUNIZE", name: "Immunization / Vaccine Administration", category: "add-on-services", durationMin: 15, description: "Flu, shingles, Tdap, travel and routine vaccines", defaultCpt: "90471" } }),
    db.serviceType.create({ data: { code: "ADD-MTM", name: "Medication Therapy Management", category: "add-on-services", durationMin: 30, description: "Pharmacist-led medication review and reconciliation" } }),
    db.serviceType.create({ data: { code: "ADD-POCT", name: "Point-of-Care Testing", category: "add-on-services", durationMin: 15, description: "Rapid strep, flu, COVID, A1c and glucose testing" } }),
    db.serviceType.create({ data: { code: "ADD-INJECT", name: "Injection / Infusion Administration", category: "add-on-services", durationMin: 20, description: "B12, vitamin and therapeutic injections", defaultCpt: "96372" } }),
    db.serviceType.create({ data: { code: "ADD-IV-DRIP", name: "IV Hydration & Wellness Drip", category: "add-on-services", durationMin: 45, description: "Hydration, immunity and recovery IV therapy" } }),
    db.serviceType.create({ data: { code: "ADD-WEIGHT", name: "Medical Weight Management Program", category: "add-on-services", durationMin: 30, description: "GLP-1 program with coaching and monitoring" } }),
    db.serviceType.create({ data: { code: "ADD-DME", name: "Durable Medical Equipment Fitting", category: "add-on-services", durationMin: 20, description: "Braces, boots, compression and mobility aids" } }),
    db.serviceType.create({ data: { code: "ADD-DELIVERY", name: "Prescription Home Delivery", category: "add-on-services", durationMin: 5, description: "Same-day courier and mail delivery of prescriptions" } }),
    db.serviceType.create({ data: { code: "ADD-COMPOUND", name: "Compounding Service", category: "add-on-services", durationMin: 30, description: "Custom compounded medications and packaging" } }),
    db.serviceType.create({ data: { code: "ADD-MEMBERSHIP", name: "Care+ Membership Plan", category: "add-on-services", durationMin: 10, description: "Loyalty membership with discounts and auto-refill" } }),
  ]);
  console.log(`  ✓ ${services.length} service types`);

  // ---------------- Patients ----------------
  const patientsData = [
    { firstName: "Eleanor", lastName: "Adams", dob: new Date("1958-04-12"), sex: "F", email: "eadams@example.com", phone: "5551112201", insurerName: "Medicare", insurerPlan: "Part B", memberId: "1A2B3C4D" },
    { firstName: "Marcus", lastName: "Brown", dob: new Date("1979-09-30"), sex: "M", email: "mbrown@example.com", phone: "5551112202", insurerName: "Aetna", insurerPlan: "PPO" },
    { firstName: "Sofia", lastName: "Chen", dob: new Date("1992-06-18"), sex: "F", phone: "5551112203", insurerName: "BlueCross", insurerPlan: "HMO" },
    { firstName: "Jamal", lastName: "Davis", dob: new Date("1985-12-05"), sex: "M", phone: "5551112204", insurerName: "United Healthcare", insurerPlan: "Choice Plus" },
    { firstName: "Priya", lastName: "Patel", dob: new Date("1968-02-22"), sex: "F", phone: "5551112205", insurerName: "Cigna" },
    { firstName: "Liam", lastName: "O'Connor", dob: new Date("2001-07-15"), sex: "M", phone: "5551112206", insurerName: "Self-pay" },
    { firstName: "Ava", lastName: "Martinez", dob: new Date("1995-11-08"), sex: "F", phone: "5551112207", insurerName: "Kaiser" },
    { firstName: "Noah", lastName: "Schmidt", dob: new Date("1948-01-25"), sex: "M", phone: "5551112208", insurerName: "Medicare", memberId: "9X8Y7Z6W" },
    { firstName: "Mia", lastName: "Garcia", dob: new Date("1976-08-14"), sex: "F", phone: "5551112209", insurerName: "Anthem", insurerPlan: "Silver" },
    { firstName: "Ethan", lastName: "Williams", dob: new Date("2010-03-19"), sex: "M", phone: "5551112210", insurerName: "BlueCross", insurerPlan: "Family" },
  ];

  const patients = await Promise.all(patientsData.map((p, i) => db.patient.create({
    data: {
      ...p,
      mrn: `AC-${100000 + i}`,
      addressLine1: `${100 + i} Main St`,
      city: "Miami",
      state: "FL",
      postalCode: "33101",
      preferredLang: i === 4 ? "Spanish" : "English",
      ecName: `Family member ${i + 1}`,
      ecRelation: "Spouse",
      ecPhone: `555${(8000 + i).toString().padStart(4, "0")}`,
    },
  })));
  console.log(`  ✓ ${patients.length} patients`);

  // ---------------- Allergies / Problems / Meds / Vitals per patient ----------------
  const [eleanor, marcus, sofia, jamal, priya, liam, ava, noah, mia, ethan] = patients;

  await db.allergy.createMany({ data: [
    { patientId: eleanor.id, substance: "Penicillin", reaction: "Hives", severity: "moderate" },
    { patientId: marcus.id, substance: "Sulfa drugs", reaction: "Rash", severity: "mild" },
    { patientId: noah.id, substance: "Iodinated contrast", reaction: "Anaphylaxis", severity: "life-threatening" },
    { patientId: priya.id, substance: "Latex", reaction: "Contact dermatitis", severity: "mild" },
  ] });

  await db.problem.createMany({ data: [
    { patientId: eleanor.id, icd10: "I10", description: "Essential hypertension", status: "chronic" },
    { patientId: eleanor.id, icd10: "E11.9", description: "Type 2 diabetes mellitus, w/o complications", status: "chronic" },
    { patientId: eleanor.id, icd10: "L97.929", description: "Non-pressure chronic ulcer of left lower leg", status: "active" },
    { patientId: marcus.id, icd10: "M54.5", description: "Low back pain", status: "active" },
    { patientId: marcus.id, icd10: "G89.4", description: "Chronic pain syndrome", status: "chronic" },
    { patientId: sofia.id, icd10: "L70.0", description: "Acne vulgaris", status: "active" },
    { patientId: jamal.id, icd10: "M25.561", description: "Pain in right knee, post-op", status: "active" },
    { patientId: priya.id, icd10: "I10", description: "Essential hypertension", status: "chronic" },
    { patientId: priya.id, icd10: "E78.5", description: "Hyperlipidemia", status: "chronic" },
    { patientId: noah.id, icd10: "L97.521", description: "Diabetic foot ulcer, right foot, w/ exposed fat", status: "active" },
    { patientId: noah.id, icd10: "E11.621", description: "Type 2 DM with foot ulcer", status: "chronic" },
    { patientId: mia.id, icd10: "E66.9", description: "Obesity, unspecified", status: "active" },
    { patientId: ava.id, icd10: "F41.1", description: "Generalized anxiety disorder", status: "chronic" },
  ] });

  await db.medication.createMany({ data: [
    { patientId: eleanor.id, name: "Lisinopril", strength: "20 mg", form: "tablet", sig: "1 tab PO daily", route: "PO", prescriberId: drRivera.id },
    { patientId: eleanor.id, name: "Metformin", strength: "500 mg", form: "tablet", sig: "1 tab PO BID with meals", route: "PO", prescriberId: drRivera.id },
    { patientId: marcus.id, name: "Gabapentin", strength: "300 mg", form: "capsule", sig: "1 cap PO TID", route: "PO", prescriberId: mdSmith.id },
    { patientId: priya.id, name: "Atorvastatin", strength: "40 mg", form: "tablet", sig: "1 tab PO QHS", route: "PO", prescriberId: drRivera.id },
    { patientId: noah.id, name: "Insulin glargine", strength: "100 U/mL", sig: "20 units SC at bedtime", route: "SC", prescriberId: drRivera.id },
  ] });

  // Vitals
  for (const p of patients) {
    const baseSys = 110 + Math.floor(Math.random() * 30);
    const baseDia = 70 + Math.floor(Math.random() * 15);
    for (let i = 0; i < 4; i++) {
      const taken = subDays(new Date(), i * 21 + 1);
      await db.vital.create({ data: {
        patientId: p.id,
        takenAt: taken,
        systolic: baseSys + Math.floor(Math.random() * 8 - 4),
        diastolic: baseDia + Math.floor(Math.random() * 6 - 3),
        pulse: 65 + Math.floor(Math.random() * 20),
        temperatureC: 36.5 + Math.random() * 0.6,
        spo2: 96 + Math.floor(Math.random() * 4),
        respRate: 14 + Math.floor(Math.random() * 4),
        weightKg: 60 + Math.random() * 40,
        heightCm: 160 + Math.random() * 25,
        bmi: 22 + Math.random() * 8,
        painScore: i === 0 && (p.id === marcus.id || p.id === jamal.id) ? 6 : 1,
      } });
    }
  }

  // ---------------- Appointments ----------------
  const today = startOfDay(new Date());
  const apptsData: any[] = [];
  function pickAt(day: Date, h: number, m = 0) { return setMinutes(setHours(day, h), m); }

  // today's schedule
  apptsData.push(
    { patientId: eleanor.id, providerId: drRivera.id, serviceTypeId: services.find(s => s.code === "PC-FOLLOW")!.id, startsAt: pickAt(today, 8, 30), reason: "BP follow-up", status: "completed" },
    { patientId: marcus.id, providerId: dptJones.id, serviceTypeId: services.find(s => s.code === "PT-FOLLOW")!.id, startsAt: pickAt(today, 9, 30), reason: "Lower back pain", status: "checked-in" },
    { patientId: sofia.id, providerId: npTan.id, serviceTypeId: services.find(s => s.code === "AE-FILLER")!.id, startsAt: pickAt(today, 10, 30), reason: "Filler consult", status: "scheduled" },
    { patientId: jamal.id, providerId: dptJones.id, serviceTypeId: services.find(s => s.code === "PT-POSTOP")!.id, startsAt: pickAt(today, 11, 30), reason: "Post-op knee rehab", status: "scheduled" },
    { patientId: priya.id, providerId: drRivera.id, serviceTypeId: services.find(s => s.code === "PC-ACUTE")!.id, startsAt: pickAt(today, 13, 0), reason: "Headache", status: "scheduled" },
    { patientId: noah.id, providerId: mdSmith.id, serviceTypeId: services.find(s => s.code === "WC-CHRONIC")!.id, startsAt: pickAt(today, 14, 0), reason: "Diabetic foot ulcer dressing change", status: "scheduled", location: "home-visit" },
    { patientId: liam.id, providerId: drRivera.id, serviceTypeId: services.find(s => s.code === "OS-PE")!.id, startsAt: pickAt(today, 15, 0), reason: "Sports physical", status: "scheduled" },
    { patientId: mia.id, providerId: npTan.id, serviceTypeId: services.find(s => s.code === "OS-WEIGHT")!.id, startsAt: pickAt(today, 16, 0), reason: "Weight management", status: "scheduled" },
    { patientId: ava.id, providerId: npTan.id, serviceTypeId: services.find(s => s.code === "AE-PRP-FACE")!.id, startsAt: pickAt(today, 16, 30), reason: "Facial PRP follow-up", status: "scheduled" },
  );
  // tomorrow + day after
  for (let d = 1; d <= 3; d++) {
    const day = addDays(today, d);
    apptsData.push(
      { patientId: ethan.id, providerId: drRivera.id, serviceTypeId: services.find(s => s.code === "OS-PE")!.id, startsAt: pickAt(day, 9, 0), reason: "School physical", status: "scheduled" },
      { patientId: noah.id, providerId: mdSmith.id, serviceTypeId: services.find(s => s.code === "WC-CHRONIC")!.id, startsAt: pickAt(day, 11, 0), reason: "Wound dressing", status: "scheduled" },
    );
  }

  const allAppts = await Promise.all(apptsData.map(a => {
    const start = a.startsAt;
    const end = addMinutes(start, 45);
    return db.appointment.create({ data: { ...a, endsAt: end } });
  }));
  console.log(`  ✓ ${allAppts.length} appointments`);

  // ---------------- Encounters (with SOAP, Dx, Charges, Orders) ----------------
  // Eleanor — completed PC follow-up today
  const eleanorEnc = await db.encounter.create({
    data: {
      patientId: eleanor.id,
      providerId: drRivera.id,
      appointmentId: allAppts[0].id,
      visitType: "follow-up",
      chiefComplaint: "Hypertension follow-up; medication review",
      startedAt: pickAt(today, 8, 30),
      signedAt: pickAt(today, 9, 5),
      status: "signed",
      subjective: "65 y/o F with HTN and T2DM here for routine f/u. BP at home running 130s/80s. Denies CP, SOB, dizziness. Adherent with lisinopril and metformin. Reports left calf ulcer is unchanged in size, no drainage.",
      ros: "General: no fevers, no weight changes. CV: no chest pain, no palpitations. Resp: no SOB. GI: no n/v. GU: no dysuria. Skin: chronic L lower-leg ulcer, stable.",
      objective: "BP 132/82, HR 72, T 36.7, SpO2 98%. Wt 78 kg. Lungs clear. Heart RRR. Extremities: 2 cm × 1.5 cm L lateral malleolar ulcer, granulation tissue, no purulence.",
      examFindings: "WDWN female, NAD. CV: regular rate and rhythm, no murmurs. Lungs: clear bilaterally. Lower extremities: chronic ulcer L leg as described, no surrounding cellulitis.",
      assessment: "1) Essential HTN — controlled.\n2) T2DM — stable, A1c last 6.9.\n3) Chronic non-pressure ulcer L lower leg — stable, continue wound care.",
      plan: "Continue lisinopril 20 mg, metformin 500 mg BID. Order A1c, BMP. Refer to wound care for ongoing dressing q3 days. Return in 3 months.",
    },
  });
  await db.encounterDiagnosis.createMany({ data: [
    { encounterId: eleanorEnc.id, icd10: "I10", description: "Essential hypertension", primary: true },
    { encounterId: eleanorEnc.id, icd10: "E11.9", description: "Type 2 diabetes mellitus, w/o complications" },
    { encounterId: eleanorEnc.id, icd10: "L97.929", description: "Non-pressure chronic ulcer, L lower leg" },
  ] });
  await db.encounterCharge.createMany({ data: [
    { encounterId: eleanorEnc.id, cpt: "99214", description: "Office visit, established, moderate MDM", units: 1, feeCents: 17500 },
  ] });
  await db.order.createMany({ data: [
    { patientId: eleanor.id, providerId: drRivera.id, encounterId: eleanorEnc.id, type: "lab", itemName: "Hemoglobin A1c", itemCode: "4548-4", priority: "routine", status: "pending", diagnosisCode: "E11.9" },
    { patientId: eleanor.id, providerId: drRivera.id, encounterId: eleanorEnc.id, type: "lab", itemName: "Basic Metabolic Panel", itemCode: "BMP", priority: "routine", status: "pending", diagnosisCode: "I10" },
    { patientId: eleanor.id, providerId: drRivera.id, encounterId: eleanorEnc.id, type: "referral", itemName: "Wound Care Clinic — chronic LE ulcer", priority: "routine", status: "sent" },
  ] });

  // Marcus — open PT encounter
  const marcusEnc = await db.encounter.create({
    data: {
      patientId: marcus.id,
      providerId: dptJones.id,
      appointmentId: allAppts[1].id,
      visitType: "office",
      chiefComplaint: "Lower back pain — PT visit 3/12",
      startedAt: pickAt(today, 9, 30),
      status: "open",
      subjective: "Pt reports 30% improvement since last visit. Pain currently 4/10, was 6/10. Sleeping better.",
      objective: "Lumbar AROM: flexion 50° (was 35°), extension 15°. SLR neg bilaterally. Tenderness paraspinal L>R.",
      assessment: "Mechanical low back pain, improving with PT.",
      plan: "Continue therapeutic exercise 2x/week × 6 weeks. Add core stabilization. HEP given.",
    },
  });
  await db.encounterDiagnosis.create({ data: { encounterId: marcusEnc.id, icd10: "M54.5", description: "Low back pain", primary: true } });
  await db.encounterCharge.createMany({ data: [
    { encounterId: marcusEnc.id, cpt: "97110", description: "Therapeutic exercise — 15 min", units: 2, feeCents: 4500 },
    { encounterId: marcusEnc.id, cpt: "97140", description: "Manual therapy — 15 min", units: 1, feeCents: 4500 },
  ] });

  // Noah — wound care home visit (open)
  const noahEnc = await db.encounter.create({
    data: {
      patientId: noah.id,
      providerId: mdSmith.id,
      appointmentId: allAppts[5].id,
      visitType: "home",
      chiefComplaint: "Diabetic foot ulcer — home dressing change",
      startedAt: pickAt(today, 14, 0),
      status: "open",
      subjective: "Pt reports no new pain. Caregiver notes mild yellow drainage on prior dressing. No fever.",
      objective: "Wound R plantar foot 2 cm × 1.5 cm × 0.3 cm depth. Granulation tissue 70%, slough 30%, scant serous drainage. Periwound intact, no cellulitis.",
      assessment: "Diabetic foot ulcer, R foot — stable, slough increasing — debride.",
      plan: "Sharp debridement, calcium alginate dressing, foam cover. Offload with boot. RTC q3 days.",
    },
  });
  await db.encounterDiagnosis.createMany({ data: [
    { encounterId: noahEnc.id, icd10: "L97.521", description: "Diabetic foot ulcer, R foot", primary: true },
    { encounterId: noahEnc.id, icd10: "E11.621", description: "T2DM with foot ulcer" },
  ] });
  await db.encounterCharge.createMany({ data: [
    { encounterId: noahEnc.id, cpt: "97597", description: "Wound debridement, ≤20 cm²", units: 1, feeCents: 13000 },
  ] });

  // Some past signed encounters
  const past = subDays(today, 14);
  const pastEnc = await db.encounter.create({
    data: {
      patientId: priya.id,
      providerId: drRivera.id,
      visitType: "follow-up",
      chiefComplaint: "Annual physical",
      startedAt: pickAt(past, 10, 0),
      signedAt: pickAt(past, 10, 35),
      status: "signed",
      subjective: "Pt feeling well overall. No specific complaints. Diet better, exercising 3x/week.",
      objective: "BP 128/78, HR 70. Wt 64 kg. Exam unremarkable.",
      assessment: "Hyperlipidemia controlled on statin. HTN well-controlled. No new issues.",
      plan: "Continue current meds. Order lipid panel, A1c. RTC 1 year for annual.",
    },
  });
  await db.encounterDiagnosis.createMany({ data: [
    { encounterId: pastEnc.id, icd10: "Z00.00", description: "Encounter for general adult medical exam", primary: true },
    { encounterId: pastEnc.id, icd10: "I10", description: "Essential hypertension" },
    { encounterId: pastEnc.id, icd10: "E78.5", description: "Hyperlipidemia" },
  ] });
  await db.encounterCharge.create({ data: { encounterId: pastEnc.id, cpt: "99204", description: "Office visit, new, moderate MDM", units: 1, feeCents: 22000 } });

  console.log(`  ✓ encounters & charges`);

  // ---------------- Messages ----------------
  await db.message.createMany({ data: [
    { fromUserId: nurseKim.id, toUserId: drRivera.id, patientId: noah.id, subject: "Wound care — schedule", body: "Mr. Schmidt's daughter called to confirm home visit at 2pm. Roads OK." },
    { fromUserId: frontLopez.id, toUserId: drRivera.id, patientId: eleanor.id, subject: "Refill request", body: "Eleanor Adams requests refill on lisinopril and metformin. Please review." },
    { fromUserId: billing.id, toUserId: drRivera.id, subject: "Charges pending signature", body: "3 encounters from yesterday have draft charges awaiting signature." },
  ] });
  console.log(`  ✓ messages`);

  // ---------------- Pharmacy directory ----------------
  await db.pharmacy.createMany({ data: [
    { name: "CVS Pharmacy #4821", network: "surescripts", ncpdpId: "0512381", npi: "1487654320", addressLine1: "1450 Brickell Ave", city: "Miami", state: "FL", postalCode: "33131", phone: "(305) 555-0112", fax: "(305) 555-0113", hours: "Mon-Sun 8a-10p", services: "drive-thru,delivery,immunizations", preferred: true },
    { name: "Walgreens #6610", network: "surescripts", ncpdpId: "0661102", npi: "1992345678", addressLine1: "2301 SW 8th St", city: "Miami", state: "FL", postalCode: "33135", phone: "(305) 555-0144", fax: "(305) 555-0145", hours: "24 hours", services: "24h,drive-thru,delivery", preferred: true },
    { name: "Publix Pharmacy at The Shops", network: "surescripts", ncpdpId: "0773219", npi: "1556677889", addressLine1: "5701 Sunset Dr", city: "South Miami", state: "FL", postalCode: "33143", phone: "(305) 555-0167", fax: "(305) 555-0168", hours: "Mon-Fri 9a-9p, Sat 9a-7p, Sun 11a-6p", services: "delivery,immunizations" },
    { name: "Navarro Discount Pharmacy", network: "surescripts", ncpdpId: "0488120", npi: "1667788990", addressLine1: "3402 Coral Way", city: "Miami", state: "FL", postalCode: "33145", phone: "(305) 555-0181", fax: "(305) 555-0182", hours: "Mon-Sun 8a-9p", services: "bilingual,delivery" },
    { name: "ApexCare In-House Dispensary", network: "internal", ncpdpId: "9000001", npi: "1009000001", addressLine1: "800 NW 57th Ave, Suite 200", city: "Miami", state: "FL", postalCode: "33126", phone: "(305) 555-0148", fax: "(305) 555-0149", hours: "Mon-Fri 8a-6p", services: "in-house,compounding,delivery", preferred: true },
    { name: "Costco Pharmacy #338", network: "surescripts", ncpdpId: "0338210", npi: "1778899001", addressLine1: "9925 NW 77th Ave", city: "Hialeah Gardens", state: "FL", postalCode: "33016", phone: "(305) 555-0190", fax: "(305) 555-0191", hours: "Mon-Fri 10a-7p, Sat 9:30a-6p", services: "low-cost,bulk" },
    { name: "Accredo Specialty Pharmacy", network: "surescripts", ncpdpId: "0245500", npi: "1889900112", addressLine1: "8285 Bryan Dairy Rd", city: "Largo", state: "FL", postalCode: "33777", phone: "(800) 555-0210", fax: "(800) 555-0211", hours: "Mon-Fri 8a-8p", services: "specialty,mail-order,cold-chain" },
    { name: "Sedano's Pharmacy #19", network: "availity", ncpdpId: "0619019", npi: "1110002223", addressLine1: "1244 W 49th St", city: "Hialeah", state: "FL", postalCode: "33012", phone: "(305) 555-0222", fax: "(305) 555-0223", hours: "Mon-Sat 9a-8p", services: "bilingual,delivery" },
  ] });
  console.log(`  ✓ pharmacies`);

  // ---------------- Inventory (dispensary, supplies, retail) ----------------
  const inventorySeed = [
    // In-house dispensary medications
    { sku: "RX-AMOX-500", name: "Amoxicillin 500mg Capsule", category: "medication", form: "capsule", strength: "500mg", unit: "capsule", quantityOnHand: 480, reorderLevel: 150, unitCostCents: 12, retailPriceCents: 65, location: "dispensary", supplier: "McKesson", controlled: false },
    { sku: "RX-LISINO-10", name: "Lisinopril 10mg Tablet", category: "medication", form: "tablet", strength: "10mg", unit: "tablet", quantityOnHand: 900, reorderLevel: 200, unitCostCents: 4, retailPriceCents: 35, location: "dispensary", supplier: "Cardinal Health" },
    { sku: "RX-METF-500", name: "Metformin 500mg Tablet", category: "medication", form: "tablet", strength: "500mg", unit: "tablet", quantityOnHand: 1100, reorderLevel: 250, unitCostCents: 3, retailPriceCents: 30, location: "dispensary", supplier: "Cardinal Health" },
    { sku: "RX-ATORV-20", name: "Atorvastatin 20mg Tablet", category: "medication", form: "tablet", strength: "20mg", unit: "tablet", quantityOnHand: 120, reorderLevel: 200, unitCostCents: 6, retailPriceCents: 45, location: "dispensary", supplier: "McKesson" },
    { sku: "RX-PRED-20", name: "Prednisone 20mg Tablet", category: "medication", form: "tablet", strength: "20mg", unit: "tablet", quantityOnHand: 60, reorderLevel: 80, unitCostCents: 5, retailPriceCents: 40, location: "dispensary", supplier: "McKesson" },
    { sku: "RX-B12-INJ", name: "Vitamin B12 Injection 1000mcg", category: "medication", form: "vial", strength: "1000mcg/mL", unit: "vial", quantityOnHand: 45, reorderLevel: 20, unitCostCents: 180, retailPriceCents: 2500, location: "dispensary", supplier: "Henry Schein" },

    // Vaccines (cold-chain)
    { sku: "VAX-FLU", name: "Influenza Vaccine (Quadrivalent)", category: "medication", form: "syringe", strength: "0.5mL", unit: "dose", quantityOnHand: 75, reorderLevel: 40, unitCostCents: 1600, retailPriceCents: 4000, location: "dispensary", supplier: "Sanofi", controlled: false },
    { sku: "VAX-TDAP", name: "Tdap Vaccine", category: "medication", form: "syringe", strength: "0.5mL", unit: "dose", quantityOnHand: 18, reorderLevel: 25, unitCostCents: 4200, retailPriceCents: 8500, location: "dispensary", supplier: "GSK" },

    // Aesthetic consumables
    { sku: "AE-BOTOX-100", name: "Botox 100u Vial", category: "aesthetic", form: "vial", strength: "100u", unit: "vial", quantityOnHand: 14, reorderLevel: 8, unitCostCents: 52000, retailPriceCents: 0, location: "aesthetics-room", supplier: "Allergan" },
    { sku: "AE-FILLER-1ML", name: "HA Dermal Filler 1mL Syringe", category: "aesthetic", form: "syringe", strength: "1mL", unit: "syringe", quantityOnHand: 22, reorderLevel: 10, unitCostCents: 28000, retailPriceCents: 0, location: "aesthetics-room", supplier: "Galderma" },
    { sku: "AE-PRP-KIT", name: "PRP Preparation Kit", category: "aesthetic", form: "kit", unit: "kit", quantityOnHand: 9, reorderLevel: 12, unitCostCents: 4500, retailPriceCents: 0, location: "aesthetics-room", supplier: "Eclipse" },

    // Clinical supplies
    { sku: "SUP-GLOVE-M", name: "Nitrile Exam Gloves (Medium, box/200)", category: "supply", form: "box", unit: "box", quantityOnHand: 60, reorderLevel: 30, unitCostCents: 850, retailPriceCents: 0, location: "supply-room", supplier: "Medline" },
    { sku: "SUP-GAUZE-4", name: "Sterile Gauze 4x4 (pack/100)", category: "supply", form: "pack", unit: "pack", quantityOnHand: 40, reorderLevel: 25, unitCostCents: 600, retailPriceCents: 0, location: "supply-room", supplier: "Medline" },
    { sku: "SUP-FOAM-DRS", name: "Foam Wound Dressing 4x4", category: "supply", form: "each", unit: "each", quantityOnHand: 28, reorderLevel: 40, unitCostCents: 320, retailPriceCents: 0, location: "supply-room", supplier: "Smith+Nephew" },
    { sku: "SUP-SYRINGE-3", name: "Syringe 3mL with Needle (box/100)", category: "supply", form: "box", unit: "box", quantityOnHand: 35, reorderLevel: 20, unitCostCents: 1200, retailPriceCents: 0, location: "supply-room", supplier: "BD" },

    // Front-of-house retail / OTC (sellable at POS)
    { sku: "OTC-IBU-200", name: "Ibuprofen 200mg (bottle/100)", category: "retail", form: "bottle", unit: "bottle", quantityOnHand: 48, reorderLevel: 20, unitCostCents: 380, retailPriceCents: 999, taxable: true, location: "front-retail", supplier: "Perrigo" },
    { sku: "OTC-ACET-500", name: "Acetaminophen 500mg (bottle/100)", category: "retail", form: "bottle", unit: "bottle", quantityOnHand: 52, reorderLevel: 20, unitCostCents: 360, retailPriceCents: 949, taxable: true, location: "front-retail", supplier: "Perrigo" },
    { sku: "OTC-VITD-2K", name: "Vitamin D3 2000 IU (bottle/120)", category: "retail", form: "bottle", unit: "bottle", quantityOnHand: 30, reorderLevel: 15, unitCostCents: 420, retailPriceCents: 1499, taxable: true, location: "front-retail", supplier: "Nature Made" },
    { sku: "OTC-COMP-SOCK", name: "Compression Socks (20-30 mmHg)", category: "retail", form: "pair", unit: "pair", quantityOnHand: 24, reorderLevel: 12, unitCostCents: 900, retailPriceCents: 2999, taxable: true, location: "front-retail", supplier: "Sigvaris" },
    { sku: "OTC-SUNSCREEN", name: "Medical-Grade Sunscreen SPF 46", category: "retail", form: "tube", unit: "tube", quantityOnHand: 19, reorderLevel: 10, unitCostCents: 1800, retailPriceCents: 3800, taxable: true, location: "front-retail", supplier: "EltaMD" },
    { sku: "OTC-GLUC-METER", name: "Glucose Meter Starter Kit", category: "equipment", form: "kit", unit: "kit", quantityOnHand: 8, reorderLevel: 6, unitCostCents: 1500, retailPriceCents: 3499, taxable: true, location: "front-retail", supplier: "Contour" },
    { sku: "OTC-BP-CUFF", name: "Home Blood Pressure Monitor", category: "equipment", form: "each", unit: "each", quantityOnHand: 11, reorderLevel: 6, unitCostCents: 2400, retailPriceCents: 5499, taxable: true, location: "front-retail", supplier: "Omron" },
    { sku: "OTC-KNEE-BRACE", name: "Hinged Knee Brace (Universal)", category: "equipment", form: "each", unit: "each", quantityOnHand: 7, reorderLevel: 8, unitCostCents: 2200, retailPriceCents: 6500, taxable: true, location: "front-retail", supplier: "DonJoy" },
  ];

  const inventoryItems = await Promise.all(
    inventorySeed.map((data) => db.inventoryItem.create({ data })),
  );
  const itemBySku = new Map(inventoryItems.map((i) => [i.sku, i]));

  await db.stockMovement.createMany({
    data: inventoryItems.map((item) => ({
      itemId: item.id,
      type: "receive",
      quantity: item.quantityOnHand,
      reason: "Opening stock count",
      actor: "Avery Park",
    })),
  });
  console.log(`  ✓ ${inventoryItems.length} inventory items`);

  // ---------------- Sample POS sales ----------------
  function lineFor(sku: string, qty: number) {
    const item = itemBySku.get(sku)!;
    return {
      itemId: item.id,
      kind: "product" as const,
      sku: item.sku,
      description: item.name,
      qty,
      unitPriceCents: item.retailPriceCents,
      lineTotalCents: item.retailPriceCents * qty,
    };
  }
  const saleDrafts = [
    { number: "POS-1001", cashier: "Carla Lopez", patientName: "Eleanor Adams", paymentMethod: "card", lines: [lineFor("OTC-COMP-SOCK", 1), lineFor("OTC-VITD-2K", 1)] },
    { number: "POS-1002", cashier: "Carla Lopez", patientName: "Walk-in", paymentMethod: "cash", lines: [lineFor("OTC-IBU-200", 2)] },
    { number: "POS-1003", cashier: "Soo Kim", patientName: "Marcus Bell", paymentMethod: "hsa-fsa", lines: [lineFor("OTC-BP-CUFF", 1), lineFor("OTC-VITD-2K", 1)] },
  ];
  const TAX_RATE = 0.07;
  for (const draft of saleDrafts) {
    const subtotalCents = draft.lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
    const taxCents = Math.round(subtotalCents * TAX_RATE);
    const totalCents = subtotalCents + taxCents;
    await db.posSale.create({
      data: {
        number: draft.number,
        status: "paid",
        cashier: draft.cashier,
        patientName: draft.patientName,
        paymentMethod: draft.paymentMethod,
        subtotalCents,
        taxCents,
        totalCents,
        amountTenderedCents: totalCents,
        changeCents: 0,
        lines: { create: draft.lines },
      },
    });
  }
  console.log(`  ✓ ${saleDrafts.length} point-of-sale transactions`);

  console.log("\nDone. Login: mariuska.aristica@proactivemedical.com / apex123\n");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
