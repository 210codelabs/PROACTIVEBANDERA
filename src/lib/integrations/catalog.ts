// Catalog of external integration providers for the External Integrations and
// Automation settings. This module is imported by BOTH server and client code,
// so it must never contain secrets — only field definitions, labels, and the
// public documentation links that help an admin locate their credentials.

export type FieldType = "text" | "password";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required: boolean;
  help?: string;
};

export type SubServiceDef = {
  key: string;
  label: string;
  description: string;
  /** Extra credentials that this sub-service needs beyond the provider's base fields. */
  extraFields?: FieldDef[];
};

export type ProviderAuthMode = "credentials" | "oauth";

export type ProviderDef = {
  key: string;
  name: string;
  description: string;
  /** Deep link to the provider's official docs explaining where to find these values. */
  docsUrl: string;
  docsLabel: string;
  authMode: ProviderAuthMode;
  /** OAuth providers may still expose a manual credential fallback. */
  fields: FieldDef[];
  subServices?: SubServiceDef[];
};

export type CapabilityDef = {
  key: string;
  title: string;
  description: string;
  /** "multi" means several providers can be enabled at once (competing options). */
  selection: "single" | "multi";
  providers: ProviderDef[];
};

export const INTEGRATION_CATALOG: CapabilityDef[] = [
  {
    key: "prescribing-edi",
    title: "E-Prescribing & EDI",
    description:
      "Route prescriptions and electronic data interchange transactions. Multiple vendors offer this — enable whichever your clinic is contracted with.",
    selection: "multi",
    providers: [
      {
        key: "surescripts",
        name: "Surescripts",
        description: "Nationwide e-prescribing and medication history network.",
        docsUrl: "https://surescripts.com/network-alliance/get-connected",
        docsLabel: "Where to find your Surescripts credentials",
        authMode: "credentials",
        fields: [
          { key: "API_KEY", label: "API Key", type: "password", required: true, placeholder: "sk_live_…", help: "Issued in the Surescripts developer portal." },
          { key: "CLIENT_SECRET", label: "Client Secret", type: "password", required: true, placeholder: "••••••••" },
          { key: "PARTNER_ID", label: "Partner ID", type: "text", required: true, placeholder: "PRT-000000" },
          { key: "USER_ID", label: "Account / User ID", type: "text", required: true, placeholder: "user@clinic" },
        ],
      },
    ],
  },
  {
    key: "telehealth",
    title: "Telehealth Conferencing",
    description: "Generate virtual visit links for scheduled telehealth encounters.",
    selection: "multi",
    providers: [
      {
        key: "google-meet",
        name: "Google Meet",
        description: "Create Meet links via Google Calendar. Connect with OAuth, or configure a service account manually.",
        docsUrl: "https://developers.google.com/identity/protocols/oauth2",
        docsLabel: "Google OAuth 2.0 setup guide",
        authMode: "oauth",
        // Manual fallback fields, shown when OAuth is unavailable or declined.
        fields: [
          { key: "CLIENT_ID", label: "OAuth Client ID", type: "text", required: true, placeholder: "xxxx.apps.googleusercontent.com" },
          { key: "CLIENT_SECRET", label: "OAuth Client Secret", type: "password", required: true, placeholder: "••••••••" },
          { key: "REDIRECT_URI", label: "Redirect URI", type: "text", required: true, placeholder: "https://app.example.com/api/admin/integrations/google" },
        ],
      },
      {
        key: "zoom",
        name: "Zoom",
        description: "Server-to-server OAuth app for generating Zoom meeting links.",
        docsUrl: "https://developers.zoom.us/docs/internal-apps/s2s-oauth/",
        docsLabel: "Zoom Server-to-Server OAuth setup",
        authMode: "credentials",
        fields: [
          { key: "ACCOUNT_ID", label: "Account ID", type: "text", required: true, placeholder: "abc123" },
          { key: "CLIENT_ID", label: "Client ID", type: "text", required: true, placeholder: "zm_client_id" },
          { key: "CLIENT_SECRET", label: "Client Secret", type: "password", required: true, placeholder: "••••••••" },
        ],
      },
    ],
  },
  {
    key: "diagnostic-labs",
    title: "Diagnostic Labs & Pathology",
    description: "Route electronic laboratory orders and receive parsed lab results directly into patient charts.",
    selection: "single",
    providers: [
      {
        key: "labcorp",
        name: "Labcorp Link & Web Services",
        description: "Official Labcorp Link API to transmit clinical lab orders, check specimen requirements, and poll for parsed HL7 patient results.",
        docsUrl: "https://www.labcorp.com/data-and-technology-solutions/clinical-digital-solutions/labcorp-link",
        docsLabel: "Labcorp Link API Developer Portal",
        authMode: "credentials",
        fields: [
          { key: "API_KEY", label: "Developer API Key / App Key", type: "password", required: true, placeholder: "lc_dev_ap_...", help: "Provided in your Labcorp Developer account dashboard." },
          { key: "CLIENT_ID", label: "Client ID", type: "text", required: true, placeholder: "labcorp_client_id" },
          { key: "CLIENT_SECRET", label: "Client Secret", type: "password", required: true, placeholder: "••••••••" },
          { key: "ACCOUNT_NUMBER", label: "Labcorp Account Number", type: "text", required: true, placeholder: "12345678", help: "The 8-digit unique Labcorp billing account number assigned to your facility." },
          { key: "FACILITY_CODE", label: "Primary Performing Lab Facility Code", type: "text", required: true, placeholder: "RTP-01", help: "The primary Labcorp processing facility mnemonic assigned for clinical orders." },
          { key: "ENVIRONMENT", label: "API Gateway Environment", type: "text", required: true, placeholder: "https://api-sandbox.labcorp.com/v1", help: "API endpoint gateway for orders & results transmission." },
        ],
        subServices: [
          { key: "ordering", label: "Outbound Lab Ordering", description: "Enables clinical staff to submit lab requisitions electronically." },
          { key: "results", label: "Inbound Results Delivery", description: "Directly retrieves parsed and PDF-formatted patient diagnostics." },
        ],
      },
    ],
  },
  {
    key: "revenue-cycle",
    title: "Revenue Cycle & Claims (Clearinghouse)",
    description:
      "Insurance coverage verification, payer transaction enrollment, claim submission, and remittance/payment tracking. Powered by Stedi (stedi.com) as the clearinghouse.",
    selection: "single",
    providers: [
      {
        key: "stedi",
        name: "Stedi Healthcare Clearinghouse",
        description:
          "EDI clearinghouse for real-time eligibility (270/271), professional claims (837P), claim status (276/277), and electronic remittance advice (835/ERA). Stedi is not a bank — payer EFT/bank deposit is enrolled per payer.",
        docsUrl: "https://www.stedi.com/docs/healthcare/api-reference",
        docsLabel: "Where to find your Stedi API key (Console → API Keys)",
        authMode: "credentials",
        fields: [
          { key: "API_KEY", label: "Stedi API Key", type: "password", required: true, placeholder: "test_… or production_…", help: "Generate in Stedi Console → API Keys. A test key allows mock eligibility; a production key enables live transactions. You can update this any time." },
          { key: "ENVIRONMENT", label: "Environment", type: "text", required: false, placeholder: "test | production", help: "Informational label for your team. Test vs production is determined by the API key type." },
          { key: "ORG_NAME", label: "Billing Provider / Practice Legal Name", type: "text", required: true, placeholder: "Proactive Clinic LLC" },
          { key: "BILLING_NPI", label: "Billing / Group NPI (10 digits)", type: "text", required: true, placeholder: "1999999992", help: "Type 2 organizational NPI used as the billing provider on claims." },
          { key: "TAX_ID", label: "Tax ID (EIN/TIN, 9 digits)", type: "text", required: true, placeholder: "555123456", help: "Digits only, no dashes." },
          { key: "TAX_ID_TYPE", label: "Tax ID Type", type: "text", required: false, placeholder: "EIN", help: "EIN (organization) or SSN (individual). Defaults to EIN." },
          { key: "TAXONOMY", label: "Taxonomy Code", type: "text", required: false, placeholder: "261QP2300X" },
          { key: "ADDRESS1", label: "Billing Address", type: "text", required: false, placeholder: "123 Main St" },
          { key: "CITY", label: "City", type: "text", required: false, placeholder: "San Antonio" },
          { key: "STATE", label: "State", type: "text", required: false, placeholder: "TX" },
          { key: "ZIP", label: "ZIP Code", type: "text", required: false, placeholder: "78201" },
          { key: "DEFAULT_PAYER_ID", label: "Default Payer ID (tradingPartnerServiceId)", type: "text", required: false, placeholder: "87726", help: "Optional default payer alias/ID. Preserve leading zeroes." },
          { key: "ENROLLMENT_CONTACT_EMAIL", label: "Enrollment Contact Email", type: "text", required: false, placeholder: "billing@proactiveclinic.com" },
          { key: "ENROLLMENT_CONTACT_PHONE", label: "Enrollment Contact Phone", type: "text", required: false, placeholder: "2105550100" },
          { key: "WEBHOOK_SECRET", label: "ERA Webhook Secret", type: "password", required: false, placeholder: "long-random-string", help: "Shared secret for real-time 835/ERA delivery. Create any long random value here, then in Stedi → Developer settings → Webhooks add a custom header 'x-stedi-webhook-secret' with this value pointing at /api/stedi/webhook." },
        ],
        subServices: [
          { key: "coverage", label: "Coverage & Eligibility (270/271)", description: "Real-time insurance eligibility & benefits checks." },
          { key: "claims", label: "Claims Submission & Status (837P / 276-277)", description: "Submit professional claims and track claim status." },
          { key: "remittance", label: "Remittance / Payment Tracking (835 / ERA)", description: "Receive electronic remittance advice and reconcile payments." },
          { key: "enrollment", label: "Payer Transaction Enrollment", description: "Enroll provider + payers for eligibility/claims/ERA. Note: transaction enrollment, not clinical credentialing." },
        ],
      },
    ],
  },
];

// ---- Lookup helpers -------------------------------------------------------

export function allProviders(): ProviderDef[] {
  return INTEGRATION_CATALOG.flatMap((c) => c.providers);
}

export function findProvider(providerKey: string): ProviderDef | undefined {
  return allProviders().find((p) => p.key === providerKey);
}

export function findCapabilityForProvider(providerKey: string): CapabilityDef | undefined {
  return INTEGRATION_CATALOG.find((c) => c.providers.some((p) => p.key === providerKey));
}

/** True when a field stores a sensitive value that must be masked in transit/UI. */
export function isSecretField(field: FieldDef): boolean {
  return field.type === "password";
}

/**
 * Compute the list of required field keys for a provider given which sub-services
 * are enabled. Used by both client-side and server-side validation.
 */
export function requiredFieldKeys(
  provider: ProviderDef,
  enabledSubServices: Record<string, boolean> = {},
): { base: string[]; perSubService: Record<string, string[]> } {
  const base = provider.fields.filter((f) => f.required).map((f) => f.key);
  const perSubService: Record<string, string[]> = {};
  for (const sub of provider.subServices ?? []) {
    if (!enabledSubServices[sub.key]) continue;
    perSubService[sub.key] = (sub.extraFields ?? []).filter((f) => f.required).map((f) => f.key);
  }
  return { base, perSubService };
}
