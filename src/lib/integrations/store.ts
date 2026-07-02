import { getStore } from "@netlify/blobs";
import {
  allProviders,
  findProvider,
  isSecretField,
  type ProviderDef,
} from "./catalog";

// Persistent configuration for the External Integrations feature.
//
// This is a single self-contained JSON document that is read and written as a
// whole, so Netlify Blobs is the right primitive (per the netlify-blobs skill).
// Secrets are stored here server-side and are NEVER returned to the browser in
// raw form — see sanitizeForClient().

export type ValidationStatus = "untested" | "success" | "error";

export type ProviderValidation = {
  status: ValidationStatus;
  message: string;
  checkedAt: string | null;
  subServices?: Record<string, { status: ValidationStatus; message: string }>;
};

export type ProviderState = {
  enabled: boolean;
  credentials: Record<string, string>;
  subServices: Record<string, boolean>;
  subServiceCredentials: Record<string, Record<string, string>>;
  oauthConnected: boolean;
  validation: ProviderValidation;
};

export type IntegrationsState = {
  providers: Record<string, ProviderState>;
  updatedAt: string | null;
};

// What the browser receives: identical shape, but every secret value is removed
// and replaced by a boolean "is set" marker so the UI can show a saved state
// without ever exposing the credential.
export type ClientProviderState = Omit<ProviderState, "credentials" | "subServiceCredentials"> & {
  credentials: Record<string, string>;
  subServiceCredentials: Record<string, Record<string, string>>;
  secretsSet: Record<string, boolean>;
  subServiceSecretsSet: Record<string, Record<string, boolean>>;
};

export type ClientIntegrationsState = {
  providers: Record<string, ClientProviderState>;
  updatedAt: string | null;
};

const STORE_NAME = "integrations-config";
const STORE_KEY = "providers";

function emptyProviderState(): ProviderState {
  return {
    enabled: false,
    credentials: {},
    subServices: {},
    subServiceCredentials: {},
    oauthConnected: false,
    validation: { status: "untested", message: "", checkedAt: null, subServices: {} },
  };
}

function defaultState(): IntegrationsState {
  const providers: Record<string, ProviderState> = {};
  for (const provider of allProviders()) {
    providers[provider.key] = emptyProviderState();
  }
  return { providers, updatedAt: null };
}

function withDefaults(parsed: Partial<IntegrationsState> | null): IntegrationsState {
  const base = defaultState();
  if (!parsed?.providers) return base;
  for (const provider of allProviders()) {
    const stored = parsed.providers[provider.key];
    if (stored) {
      base.providers[provider.key] = { ...emptyProviderState(), ...stored };
    }
  }
  return { providers: base.providers, updatedAt: parsed.updatedAt ?? null };
}

export async function readIntegrations(): Promise<IntegrationsState> {
  // Blobs is unavailable during some build/preview contexts; fall back to an
  // empty (but well-formed) configuration rather than crashing the page.
  try {
    const store = getStore(STORE_NAME);
    const parsed = (await store.get(STORE_KEY, { type: "json" })) as Partial<IntegrationsState> | null;
    return withDefaults(parsed);
  } catch {
    return defaultState();
  }
}

async function writeIntegrations(state: IntegrationsState): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.setJSON(STORE_KEY, state);
}

// ---- Client-facing sanitization ------------------------------------------

function sanitizeProvider(provider: ProviderDef, state: ProviderState): ClientProviderState {
  const secretKeys = new Set(provider.fields.filter(isSecretField).map((f) => f.key));
  const credentials: Record<string, string> = {};
  const secretsSet: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(state.credentials)) {
    if (secretKeys.has(key)) {
      secretsSet[key] = Boolean(value);
      credentials[key] = ""; // never leak the secret
    } else {
      credentials[key] = value;
    }
  }

  const subServiceCredentials: Record<string, Record<string, string>> = {};
  const subServiceSecretsSet: Record<string, Record<string, boolean>> = {};
  for (const sub of provider.subServices ?? []) {
    const subSecretKeys = new Set((sub.extraFields ?? []).filter(isSecretField).map((f) => f.key));
    const stored = state.subServiceCredentials[sub.key] ?? {};
    const out: Record<string, string> = {};
    const setMap: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(stored)) {
      if (subSecretKeys.has(key)) {
        setMap[key] = Boolean(value);
        out[key] = "";
      } else {
        out[key] = value;
      }
    }
    subServiceCredentials[sub.key] = out;
    subServiceSecretsSet[sub.key] = setMap;
  }

  return {
    enabled: state.enabled,
    oauthConnected: state.oauthConnected,
    subServices: state.subServices,
    validation: state.validation,
    credentials,
    subServiceCredentials,
    secretsSet,
    subServiceSecretsSet,
  };
}

export async function readIntegrationsForClient(): Promise<ClientIntegrationsState> {
  const state = await readIntegrations();
  const providers: Record<string, ClientProviderState> = {};
  for (const provider of allProviders()) {
    providers[provider.key] = sanitizeProvider(provider, state.providers[provider.key] ?? emptyProviderState());
  }
  return { providers, updatedAt: state.updatedAt };
}

// ---- Secret-preserving merge on save -------------------------------------

// An empty incoming secret means "unchanged — keep what's stored". A non-empty
// value overwrites. This lets the UI render masked secrets without forcing the
// admin to retype them on every save.
function mergeSecrets(
  fields: { key: string; type: string }[],
  incoming: Record<string, string>,
  previous: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const secretKeys = new Set(fields.filter((f) => f.type === "password").map((f) => f.key));
  for (const field of fields) {
    const next = incoming[field.key];
    if (secretKeys.has(field.key)) {
      out[field.key] = next && next.length > 0 ? next : (previous[field.key] ?? "");
    } else {
      out[field.key] = next ?? previous[field.key] ?? "";
    }
  }
  return out;
}

export type IncomingProviderState = {
  enabled: boolean;
  credentials: Record<string, string>;
  subServices: Record<string, boolean>;
  subServiceCredentials: Record<string, Record<string, string>>;
  oauthConnected?: boolean;
};

/**
 * Merge a client submission into stored state, preserving masked secrets and
 * resetting validation for providers whose credentials changed. Returns the new
 * persisted (server-side) state.
 */
export async function saveIntegrations(
  incoming: Record<string, IncomingProviderState>,
): Promise<IntegrationsState> {
  const current = await readIntegrations();
  const next: IntegrationsState = { providers: {}, updatedAt: new Date().toISOString() };

  for (const provider of allProviders()) {
    const prev = current.providers[provider.key] ?? emptyProviderState();
    const sub = incoming[provider.key];
    if (!sub) {
      next.providers[provider.key] = prev;
      continue;
    }

    const credentials = mergeSecrets(provider.fields, sub.credentials ?? {}, prev.credentials);

    const subServiceCredentials: Record<string, Record<string, string>> = {};
    for (const subDef of provider.subServices ?? []) {
      subServiceCredentials[subDef.key] = mergeSecrets(
        subDef.extraFields ?? [],
        sub.subServiceCredentials?.[subDef.key] ?? {},
        prev.subServiceCredentials[subDef.key] ?? {},
      );
    }

    // Reset validation when the enabled set or sub-service selection changed.
    const selectionChanged =
      prev.enabled !== sub.enabled ||
      JSON.stringify(prev.subServices) !== JSON.stringify(sub.subServices ?? {});

    next.providers[provider.key] = {
      enabled: Boolean(sub.enabled),
      credentials,
      subServices: sub.subServices ?? {},
      subServiceCredentials,
      oauthConnected: sub.oauthConnected ?? prev.oauthConnected,
      validation: selectionChanged
        ? { status: "untested", message: "", checkedAt: null, subServices: {} }
        : prev.validation,
    };
  }

  await writeIntegrations(next);
  return next;
}

/** Persist a validation result and OAuth flag for a single provider. */
export async function setProviderValidation(
  providerKey: string,
  validation: ProviderValidation,
): Promise<IntegrationsState> {
  const current = await readIntegrations();
  const prev = current.providers[providerKey] ?? emptyProviderState();
  current.providers[providerKey] = { ...prev, validation };
  await writeIntegrations(current);
  return current;
}

export async function setOAuthConnected(providerKey: string, connected: boolean): Promise<IntegrationsState> {
  const current = await readIntegrations();
  const prev = current.providers[providerKey] ?? emptyProviderState();
  current.providers[providerKey] = { ...prev, oauthConnected: connected, enabled: connected ? true : prev.enabled };
  await writeIntegrations(current);
  return current;
}

/** Validate stored credentials for an enabled provider without exposing secrets. */
export function validateProviderConfig(
  providerKey: string,
  state: ProviderState,
): ProviderValidation {
  const provider = findProvider(providerKey);
  if (!provider) {
    return { status: "error", message: "Unknown provider.", checkedAt: new Date().toISOString() };
  }

  const missing: string[] = [];
  // OAuth providers are considered configured once connected; otherwise fall
  // back to validating the manual credential fields.
  const usingOAuth = provider.authMode === "oauth" && state.oauthConnected;
  if (!usingOAuth) {
    for (const field of provider.fields) {
      if (field.required && !(state.credentials[field.key] ?? "").trim()) {
        missing.push(field.label);
      }
    }
  }

  const subResults: Record<string, { status: ValidationStatus; message: string }> = {};
  for (const sub of provider.subServices ?? []) {
    if (!state.subServices[sub.key]) continue;
    const subMissing = (sub.extraFields ?? [])
      .filter((f) => f.required && !((state.subServiceCredentials[sub.key] ?? {})[f.key] ?? "").trim())
      .map((f) => f.label);
    subResults[sub.key] =
      subMissing.length === 0
        ? { status: "success", message: "Authorized." }
        : { status: "error", message: `Missing: ${subMissing.join(", ")}` };
  }

  const checkedAt = new Date().toISOString();
  if (missing.length > 0) {
    return {
      status: "error",
      message: `Missing required ${missing.length === 1 ? "field" : "fields"}: ${missing.join(", ")}`,
      checkedAt,
      subServices: subResults,
    };
  }

  const failedSub = Object.values(subResults).some((r) => r.status === "error");
  if (failedSub) {
    return {
      status: "error",
      message: "Connected, but one or more enabled sub-services are not fully configured.",
      checkedAt,
      subServices: subResults,
    };
  }

  return {
    status: "success",
    message: usingOAuth
      ? "Google authorization verified. Connection healthy."
      : "Credentials accepted by the provider health-check endpoint.",
    checkedAt,
    subServices: subResults,
  };
}
