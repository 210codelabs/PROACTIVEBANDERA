export type ClinicalModuleKey = "physical-therapy" | "wound-care" | "aesthetic-medicine";

export type ClinicalModuleDef = {
  key: ClinicalModuleKey;
  slug: "physical-therapy" | "wound-care" | "aesthetics";
  title: string;
  lead: string;
  specialtyHint: string;
  overview: string;
  focus: string[];
  patientUse: string[];
  sidebarLabel: string;
  specialtySearchTerms: string[];
};

export type ModuleServiceFallback = {
  id: string;
  name: string;
  category: ClinicalModuleKey;
  description?: string;
};

export const CLINICAL_MODULES: ClinicalModuleDef[] = [
  {
    key: "physical-therapy",
    slug: "physical-therapy",
    title: "Physical Therapy",
    lead: "Devon Jones, DPT",
    specialtyHint: "Rehab, mobility, pain reduction, post-op recovery",
    overview:
      "Structured therapy plans, home exercise programs, and progressive functional rehab for orthopedic and pain management cases.",
    focus: [
      "Initial evaluations",
      "Therapeutic exercise",
      "Manual therapy",
      "Post-operative rehab",
      "Physical rehabilitation programs",
    ],
    patientUse: ["Low back pain", "Joint recovery", "Mobility deficits", "Chronic pain support"],
    sidebarLabel: "Physical Therapy",
    specialtySearchTerms: ["physical therapy", "rehab", "dpt"],
  },
  {
    key: "wound-care",
    slug: "wound-care",
    title: "Wound Care",
    lead: "Aaron Smith, MD",
    specialtyHint: "Chronic ulcers, acute wounds, home wound visits",
    overview:
      "In-clinic and home-based wound management with dressing changes, infection prevention, and debridement workflows.",
    focus: ["Chronic wound follow-up", "Acute wound care", "Home evaluation", "Debridement and dressing"],
    patientUse: ["Diabetic ulcers", "Pressure injuries", "Post-surgical wounds", "Homebound patients"],
    sidebarLabel: "Wound Care",
    specialtySearchTerms: ["wound care", "wound", "ulcer"],
  },
  {
    key: "aesthetic-medicine",
    slug: "aesthetics",
    title: "Aesthetics",
    lead: "Linh Tan, NP",
    specialtyHint: "Injectables, lasers, RF microneedling, and regenerative aesthetics",
    overview:
      "Elective aesthetic services with consult-to-treatment workflows for injectables, laser treatments, and regenerative procedures.",
    focus: [
      "Botox",
      "Dermal fillers",
      "Endolaser (Endolift)",
      "Laser skin rejuvenation",
      "Laser hair removal",
      "Morpheus8 (RF + microneedling)",
      "Facial and capillary PRP",
    ],
    patientUse: ["Cosmetic consults", "Facial rejuvenation", "Hair reduction", "Skin tightening", "Maintenance visits"],
    sidebarLabel: "Aesthetics",
    specialtySearchTerms: ["aesthetic", "cosmetic", "laser", "beauty"],
  },
];

export function getModuleBySlug(slug: string) {
  return CLINICAL_MODULES.find((m) => m.slug === slug);
}

// -------------------------------------------------------------
// Operational modules (pharmacy, point of sale, inventory).
// These are surfaced to every signed-in user for now; fine-grained
// role control is layered on later through the admin console.
// -------------------------------------------------------------
export type OperationalModuleKey = "pharmacy" | "pos" | "inventory";

export type OperationalModuleDef = {
  key: OperationalModuleKey;
  href: string;
  title: string;
  sidebarLabel: string;
  tagline: string;
  description: string;
  accent: string; // tailwind chip classes
  integrationFlag: "pharmacyDispensing" | "posTerminal" | "inventoryManagement";
  highlights: string[];
};

export const OPERATIONAL_MODULES: OperationalModuleDef[] = [
  {
    key: "pharmacy",
    href: "/pharmacy",
    title: "Pharmacy",
    sidebarLabel: "Pharmacy",
    tagline: "Dispensing, e-prescribe routing & medication management",
    description:
      "Work the prescription queue, route e-prescriptions across the Surescripts / Availity network, and dispense from the in-house formulary.",
    accent: "bg-teal-100 text-teal-800 ring-teal-200",
    integrationFlag: "pharmacyDispensing",
    highlights: ["Rx queue & routing", "In-house dispensary", "Pharmacy directory", "Refills & MTM"],
  },
  {
    key: "pos",
    href: "/pos",
    title: "Point of Sale",
    sidebarLabel: "Point of Sale",
    tagline: "Front-desk checkout for products, OTC & services",
    description:
      "Ring up retail products, OTC medications, durable equipment, and clinical services with live inventory and receipts.",
    accent: "bg-indigo-100 text-indigo-800 ring-indigo-200",
    integrationFlag: "posTerminal",
    highlights: ["Cart & checkout", "Card / cash / HSA-FSA", "Live stock sync", "Daily takings"],
  },
  {
    key: "inventory",
    href: "/inventory",
    title: "Inventory",
    sidebarLabel: "Inventory",
    tagline: "Stock control for medications, supplies & retail",
    description:
      "Track on-hand quantities, reorder points, lots and expirations across the dispensary, supply room, and retail shelf.",
    accent: "bg-amber-100 text-amber-800 ring-amber-200",
    integrationFlag: "inventoryManagement",
    highlights: ["On-hand & reorder", "Receive & adjust", "Low-stock alerts", "Movement log"],
  },
];

// Curated add-on services the practice can promote and bill. Surfaced on the
// operational module hub and the pharmacy workspace as quick perks.
export type AddOnService = {
  code: string;
  name: string;
  blurb: string;
  category: "pharmacy" | "wellness" | "diagnostics" | "retail";
};

export const ADDON_SERVICES: AddOnService[] = [
  { code: "ADD-IMMUNIZE", name: "Immunizations & Travel Vaccines", blurb: "Flu, shingles, Tdap and travel vaccines administered on site.", category: "pharmacy" },
  { code: "ADD-MTM", name: "Medication Therapy Management", blurb: "Pharmacist-led reviews to reduce interactions and improve adherence.", category: "pharmacy" },
  { code: "ADD-COMPOUND", name: "Compounding & Packaging", blurb: "Custom compounds and blister-pack adherence packaging.", category: "pharmacy" },
  { code: "ADD-DELIVERY", name: "Same-Day Rx Delivery", blurb: "Courier and mail delivery with auto-refill enrollment.", category: "pharmacy" },
  { code: "ADD-POCT", name: "Point-of-Care Testing", blurb: "Rapid strep, flu, COVID, A1c and lipid panels in minutes.", category: "diagnostics" },
  { code: "ADD-INJECT", name: "Injections & B12 Boosts", blurb: "Therapeutic and vitamin injections without an appointment.", category: "wellness" },
  { code: "ADD-IV-DRIP", name: "IV Hydration & Wellness Drips", blurb: "Hydration, immunity and recovery infusions.", category: "wellness" },
  { code: "ADD-WEIGHT", name: "Medical Weight Management", blurb: "GLP-1 program with coaching, labs and monitoring.", category: "wellness" },
  { code: "ADD-DME", name: "Durable Medical Equipment", blurb: "Braces, boots, compression and mobility aids fitted in-clinic.", category: "retail" },
  { code: "ADD-MEMBERSHIP", name: "Care+ Membership", blurb: "Loyalty plan with retail discounts and priority refills.", category: "retail" },
];

export const MODULE_SERVICE_FALLBACKS: ModuleServiceFallback[] = [
  { id: "PT-EVAL", name: "PT - Initial Evaluation", category: "physical-therapy" },
  { id: "PT-FOLLOW", name: "PT - Follow-up Treatment", category: "physical-therapy" },
  { id: "PT-PAIN", name: "PT - Pain Management", category: "physical-therapy" },
  { id: "PT-POSTOP", name: "PT - Post-operative Therapy", category: "physical-therapy" },
  { id: "PT-REHAB", name: "Physical Rehabilitation Session", category: "physical-therapy" },
  { id: "WC-CHRONIC", name: "Wound Care - Chronic Wound", category: "wound-care" },
  { id: "WC-ACUTE", name: "Wound Care - Acute Wound", category: "wound-care" },
  { id: "WC-INFECT", name: "Wound Care - Infection Prevention", category: "wound-care" },
  { id: "WC-HOMEEVAL", name: "Wound Care - Home Evaluation", category: "wound-care" },
  { id: "AE-BOTOX", name: "Botox Injection", category: "aesthetic-medicine" },
  { id: "AE-FILLER", name: "Dermal Filler", category: "aesthetic-medicine" },
  { id: "AE-LASER", name: "Laser Aesthetic Consultation", category: "aesthetic-medicine" },
  { id: "AE-ENDOLIFT", name: "Endolaser (Endolift)", category: "aesthetic-medicine" },
  { id: "AE-SKIN-REJ", name: "Laser Skin Rejuvenation", category: "aesthetic-medicine" },
  { id: "AE-HAIR-LASER", name: "Laser Hair Removal", category: "aesthetic-medicine" },
  { id: "AE-M8", name: "Morpheus8 (Radiofrequency + Microneedling)", category: "aesthetic-medicine" },
];
