// Single source of truth mapping Weno Online integration fields <- server
// environment variables. Shared by the admin "Apply from environment" action
// and the boot-time auto-apply. No node-only imports here so it stays portable.
export const WENO_ONLINE_ENV_MAP: Record<string, string> = {
  EHR_ENCRYPTION_KEY: "WENO_ONLINE_KEY",
  ENVIRONMENT: "WENO_ONLINE_ENV",
  PROVIDER_EMAIL: "WENO_ONLINE_EMAIL",
  PROVIDER_PASSWORD: "WENO_ONLINE_PASSWORD",
  LOCATION_ID: "WENO_ONLINE_LOCATION",
  WENO_USER_ID: "WENO_ONLINE_USER_ID",
  PRESCRIBER_NPI: "WENO_ONLINE_NPI",
  PRESCRIBER_DEA: "WENO_ONLINE_DEA",
  PRESCRIBER_FIRST_NAME: "WENO_ONLINE_FIRST",
  PRESCRIBER_LAST_NAME: "WENO_ONLINE_LAST",
};

export function collectWenoOnlineEnv(): Record<string, string> {
  const creds: Record<string, string> = {};
  for (const [field, envKey] of Object.entries(WENO_ONLINE_ENV_MAP)) {
    const v = process.env[envKey];
    if (v != null && String(v).trim() !== "") creds[field] = String(v).trim();
  }
  return creds;
}

// Weno Online is considered "ready to enable" when the core fields are present.
export function wenoOnlineEnvEnablable(): boolean {
  return Boolean(
    process.env.WENO_ONLINE_KEY &&
      process.env.WENO_ONLINE_EMAIL &&
      process.env.WENO_ONLINE_PASSWORD &&
      process.env.WENO_ONLINE_LOCATION,
  );
}
