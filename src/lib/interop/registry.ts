// In-app "capacity" registry for external clinical data sources. Status is derived
// from server-side env presence so the UI truthfully reflects what is actually
// wired vs. what still requires vendor onboarding. Public sources are active now;
// PDMP / Weno / HIE are gated and cannot be used without onboarding.

export type InteropTier = "public" | "patient-authorized" | "gated";

export type InteropSource = {
  key: string;
  name: string;
  category: string;
  tier: InteropTier;
  provides: string;
  patientLevel: boolean;
  active: boolean;
  statusLabel: string;
  authModel: string;
  docsUrl: string;
  onboarding: string[];
  credentials: string[];
  note?: string;
};

export function getInteropSources(): InteropSource[] {
  const has = (k: string) => Boolean(process.env[k] && String(process.env[k]).trim());

  return [
    {
      key: "openfda",
      name: "openFDA (U.S. FDA)",
      category: "Drug reference",
      tier: "public",
      provides: "Official drug labeling (SPL), NDC Directory, and product recalls / enforcement reports.",
      patientLevel: false,
      active: true,
      statusLabel: "Active",
      authModel: "Public API (optional key for higher rate limits)",
      docsUrl: "https://open.fda.gov/apis/",
      onboarding: [],
      credentials: ["OPENFDA_API_KEY (optional)"],
    },
    {
      key: "nppes",
      name: "NPPES NPI Registry (CMS)",
      category: "Provider directory",
      tier: "public",
      provides: "Public provider / organization NPI, taxonomy and practice address.",
      patientLevel: false,
      active: true,
      statusLabel: "Active",
      authModel: "Public API (no key)",
      docsUrl: "https://npiregistry.cms.hhs.gov/api-page",
      onboarding: [],
      credentials: [],
    },
    {
      key: "rxnorm",
      name: "RxNorm / RxNav (NLM)",
      category: "Medication terminology",
      tier: "public",
      provides: "Medication name normalization, RxCUI, and drug class (ATC). No patient data.",
      patientLevel: false,
      active: true,
      statusLabel: "Active",
      authModel: "Public API (no key)",
      docsUrl: "https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html",
      onboarding: [],
      credentials: [],
      note: "NLM retired the RxNav drug-interaction API on Jan 2, 2024; interaction info uses openFDA labeling.",
    },
    {
      key: "medlineplus",
      name: "MedlinePlus Connect (NLM)",
      category: "Patient education",
      tier: "public",
      provides: "Consumer drug / condition education links by RxCUI or ICD-10.",
      patientLevel: false,
      active: true,
      statusLabel: "Active",
      authModel: "Public API (no key)",
      docsUrl: "https://medlineplus.gov/medlineplus-connect/",
      onboarding: [],
      credentials: [],
    },
    {
      key: "cms_bluebutton",
      name: "CMS Blue Button 2.0 (Medicare)",
      category: "Claims & coverage",
      tier: "patient-authorized",
      provides: "A consenting Medicare beneficiary's claims & coverage (FHIR R4). Not a medication/allergy list.",
      patientLevel: true,
      active: has("CMS_CLIENT_ID"),
      statusLabel: has("CMS_CLIENT_ID") ? "Configured" : "Public sandbox available",
      authModel: "OAuth 2.0 + PKCE (the patient authorizes each connection)",
      docsUrl: "https://bluebutton.cms.gov/",
      onboarding: [
        "Register a sandbox application at bluebutton.cms.gov",
        "Obtain a confidential client ID + secret",
        "Configure the OAuth redirect URI",
        "(Production) submit the app for CMS approval",
      ],
      credentials: ["CMS_CLIENT_ID", "CMS_CLIENT_SECRET", "CMS_REDIRECT_URI"],
      note: "Medicare only; requires the patient to authorize — this is not a silent background lookup.",
    },
    {
      key: "texas_pmp",
      name: "Texas PMP — Bamboo Health PMP Gateway",
      category: "PDMP · controlled substances",
      tier: "gated",
      provides: "Dispensed controlled-substance (Schedule II–V) history via PMP Gateway / PMP InterConnect.",
      patientLevel: true,
      active: has("PMP_BASE_URL"),
      statusLabel: has("PMP_BASE_URL") ? "Configured" : "Requires onboarding",
      authModel: "mTLS client certificate + per-user authorized prescriber/pharmacist",
      docsUrl: "https://www.pharmacy.texas.gov/pmp/PMPIntegration.asp",
      onboarding: [
        "Authorized decision-maker submits the Bamboo Health Customer Connect integration request",
        "Sign the emailed EULA",
        "Complete the PMP Gateway Licensee Questionnaire",
        "Receive staging endpoint + client certificate (mTLS)",
        "Register each authorized prescriber / pharmacist user",
      ],
      credentials: ["PMP_BASE_URL", "PMP_CLIENT_CERT", "PMP_CLIENT_KEY"],
      note: "No public developer sandbox. The AWARxE portal is for authorized human use — never scraped.",
    },
    {
      key: "weno-rxhistory",
      name: "Weno — Medication History (RxHistory)",
      category: "Medication fill history",
      tier: "gated",
      provides: "Network medication fill history across pharmacies via Weno RxHistory (if enabled on your Weno account).",
      patientLevel: true,
      active: has("WENO_BASE_URL"),
      statusLabel: has("WENO_BASE_URL") ? "Configured" : "Requires Weno onboarding",
      authModel: "Weno partner credentials + NCPDP SCRIPT + certification",
      docsUrl: "https://wenoexchange.com/",
      onboarding: [
        "Enable the Medication History (RxHistory) service on your Weno account",
        "Complete Weno certification for the RxHistory use case",
        "Allowlist this server's outbound IP in the Weno dashboard",
        "Configure Weno EZ Integration credentials under Admin → External Integrations → Weno EZ Integration",
      ],
      credentials: ["WENO_BASE_URL", "WENO_PARTNER_ID", "WENO_PARTNER_PASSWORD"],
      note: "Display as unverified history and reconcile with the patient. Requires Weno RxHistory to be enabled on your account.",
    },
    {
      key: "carequality",
      name: "Carequality (query-based exchange)",
      category: "Health Information Exchange",
      tier: "gated",
      provides: "Longitudinal C-CDA documents (medications, allergies, problems) from connected organizations.",
      patientLevel: true,
      active: false,
      statusLabel: "Requires onboarding",
      authModel: "Implementer / Connection + SAML trust (IHE XCPD patient discovery + XCA query/retrieve)",
      docsUrl: "https://carequality.org/",
      onboarding: [
        "Join as a Connection through an Implementer (or become an Implementer)",
        "Execute the Connected Agreement / Connection Terms",
        "Obtain trust certificates + a directory entry",
        "Complete test-ecosystem partner testing",
        "Pass production validation",
      ],
      credentials: ["(provisioned via the chosen Implementer / connectivity partner)"],
      note: "No anonymous endpoint; typically reached through a connectivity partner.",
    },
    {
      key: "commonwell",
      name: "CommonWell Health Alliance",
      category: "Health Information Exchange",
      tier: "gated",
      provides: "Network patient records with MPI / record locator (XCA + governed FHIR within the network).",
      patientLevel: true,
      active: false,
      statusLabel: "Requires onboarding",
      authModel: "Member Services Agreement + certification",
      docsUrl: "https://www.commonwellalliance.org/connect-to-the-network/",
      onboarding: [
        "Sign the Member Services Agreement",
        "(Service adopters) add the member/service arrangement",
        "Develop & validate, then certify",
        "Run a beta, then deploy to production",
      ],
      credentials: ["(assigned during onboarding)"],
      note: "FHIR inside a governed network is not a public/anonymous endpoint.",
    },
  ];
}
