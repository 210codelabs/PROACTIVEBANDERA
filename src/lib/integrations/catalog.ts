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
      {
        key: "availity-edi",
        name: "Availity Essentials",
        description: "Clearinghouse for eligibility, claims, and superbill EDI. Offers several sub-services.",
        docsUrl: "https://developer.availity.com/partners/page/getting-started",
        docsLabel: "Where to find your Availity API keys",
        authMode: "credentials",
        fields: [
          { key: "CLIENT_ID", label: "Client ID", type: "text", required: true, placeholder: "av_client_id" },
          { key: "CLIENT_SECRET", label: "Client Secret", type: "password", required: true, placeholder: "••••••••" },
        ],
        subServices: [
          { key: "coverage", label: "Coverage & Eligibility", description: "Real-time 270/271 eligibility checks." },
          { key: "superbill", label: "Superbill Automation", description: "Generate superbills from coded encounters." },
          {
            key: "claims",
            label: "Claims Submission",
            description: "Submit 837 professional claims and track 277 status.",
            extraFields: [
              { key: "SUBMITTER_ID", label: "Submitter ID", type: "text", required: true, placeholder: "SUB-00000", help: "Required by the payer for 837 submission." },
            ],
          },
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
