// TEST-ONLY preconfigured Weno credentials.
//
// These let an admin ONE-CLICK populate the DB-backed integration store in an
// environment that has NO WENO_* environment variables set (e.g. production
// right after a deploy). They are the client's own Weno TEST / sandbox values
// and are intended for testing the eRx flow end-to-end. Replace with real
// PRODUCTION credentials via Admin -> Connection Health before live prescribing.
//
// NOTE: server-only module. Never import into a client component.

// Weno Online (EZ Integration / ComposeRx browser launch).
export const WENO_ONLINE_TEST_DEFAULTS: Record<string, string> = {
  EHR_ENCRYPTION_KEY: "7lI9cwSDI%22Y3iuk2rjDDTuoHLCSXyrM77Z3t7W",
  ENVIRONMENT: "test",
  PROVIDER_EMAIL: "ernesto@210codelabs.com",
  PROVIDER_PASSWORD: "0925906208A@a88",
  LOCATION_ID: "L14814",
};

// Weno Exchange (NCPDP SCRIPT over SOAP "Switch").
// PARTNER_ID / PARTNER_PASSWORD come from the Weno certification dashboard
// (Account Details -> Company Data) and are added here once available.
export const WENO_EXCHANGE_TEST_DEFAULTS: Record<string, string> = {
  ENVIRONMENT: "test",
  SENDER_SOFTWARE_NAME: "ProactiveClinics EHR",
  SENDER_SOFTWARE_VERSION: "1.0",
  // PARTNER_ID: "",
  // PARTNER_PASSWORD: "",
  // MD5_PASSWORD: "",
  // PRESCRIBER_ROUTING_ID: "",
};

// Weno Exchange is only enablable when the required partner credentials exist.
export function wenoExchangeDefaultsEnablable(): boolean {
  return Boolean(
    WENO_EXCHANGE_TEST_DEFAULTS.PARTNER_ID &&
      WENO_EXCHANGE_TEST_DEFAULTS.PARTNER_PASSWORD,
  );
}
