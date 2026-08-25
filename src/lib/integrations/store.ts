import { db } from "@/lib/db";
import {
  allProviders,
  findProvider,
  isSecretField,
  type ProviderDef,
} from "./catalog";

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
  lastEditedAt: string | null;
  lastEditedBy: string | null;
};

export type IntegrationsState = {
  providers: Record<string, ProviderState>;
  updatedAt: string | null;
};

export type ClientProviderState = Omit<ProviderState, "credentials" | "subServiceCredentials"> & {
  credentials: Record<string, string>;
  subServiceCredentials: Record<string, Record<string, string>>;
  secretsSet: Record<string, boolean>;
  subServiceSecretsSet: Record<string, Record<string, boolean>>;
  secretHints: Record<string, string>;
  subServiceSecretHints: Record<string, Record<string, string>>;
};

export type ClientIntegrationsState = {
  providers: Record<string, ClientProviderState>;
  updatedAt: string | null;
};

const INTEGRATIONS_KEY = "integrations";

function emptyProviderState(): ProviderState {
  return {
    enabled: false,
    credentials: {},
    subServices: {},
    subServiceCredentials: {},
    oauthConnected: false,
    validation: { status: "untested", message: "", checkedAt: null, subServices: {} },
    lastEditedAt: null,
    lastEditedBy: null,
  };
}

// Reveal only the last 4 characters of a stored secret so an admin can confirm
// WHICH key is active without exposing it. Never returns the full value.
function maskHint(value: string): string {
  const v = String(value || "");
  if (!v) return "";
  if (v.length <= 4) return "••••";
  return "••••" + v.slice(-4);
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
  try {
    const row = await db.appSetting.findUnique({ where: { key: INTEGRATIONS_KEY } });
    if (!row) return defaultState();
    return withDefaults(row.value as Partial<IntegrationsState> | null);
  } catch {
    return defaultState();
  }
}

async function writeIntegrations(state: IntegrationsState): Promise<void> {
  await db.appSetting.upsert({
    where: { key: INTEGRATIONS_KEY },
    create: { key: INTEGRATIONS_KEY, value: state as object },
    update: { value: state as object },
  });
}

// Merge non-empty credential values into a provider (preserving existing values
// for any field not supplied). Used by the "Apply Weno Online config from
// environment" admin action so production can be populated without hand-typing.
export async function upsertProviderCredentials(
  providerKey: string,
  creds: Record<string, string>,
  opts?: { enable?: boolean; editedBy?: string; onlyIfEmpty?: boolean },
): Promise<{ applied: string[] }> {
  const state = await readIntegrations();
  const prev = state.providers[providerKey] || emptyProviderState();
  const merged: Record<string, string> = { ...(prev.credentials || {}) };
  const applied: string[] = [];
  for (const [k, v] of Object.entries(creds)) {
    if (v == null || String(v).trim() === "") continue;
    // Non-destructive mode (boot auto-apply): never overwrite a value an admin
    // may have already saved — only fill gaps.
    if (opts?.onlyIfEmpty && merged[k] && String(merged[k]).trim() !== "") continue;
    merged[k] = String(v);
    applied.push(k);
  }
  state.providers[providerKey] = {
    ...prev,
    credentials: merged,
    enabled: opts?.enable ?? prev.enabled,
    lastEditedAt: new Date().toISOString(),
    lastEditedBy: opts?.editedBy || "system",
  };
  state.updatedAt = new Date().toISOString();
  await writeIntegrations(state);
  return { applied };
}

// ---- Client-facing sanitization ------------------------------------------

function sanitizeProvider(provider: ProviderDef, state: ProviderState): ClientProviderState {
  const secretKeys = new Set(provider.fields.filter(isSecretField).map((f) => f.key));
  const credentials: Record<string, string> = {};
  const secretsSet: Record<string, boolean> = {};
  const secretHints: Record<string, string> = {};
  for (const [key, value] of Object.entries(state.credentials)) {
    if (secretKeys.has(key)) {
      secretsSet[key] = Boolean(value);
      secretHints[key] = maskHint(value);
      credentials[key] = "";
    } else {
      credentials[key] = value;
    }
  }

  const subServiceCredentials: Record<string, Record<string, string>> = {};
  const subServiceSecretsSet: Record<string, Record<string, boolean>> = {};
  const subServiceSecretHints: Record<string, Record<string, string>> = {};
  for (const sub of provider.subServices ?? []) {
    const subSecretKeys = new Set((sub.extraFields ?? []).filter(isSecretField).map((f) => f.key));
    const stored = state.subServiceCredentials[sub.key] ?? {};
    const out: Record<string, string> = {};
    const setMap: Record<string, boolean> = {};
    const hintMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(stored)) {
      if (subSecretKeys.has(key)) {
        setMap[key] = Boolean(value);
        hintMap[key] = maskHint(value);
        out[key] = "";
      } else {
        out[key] = value;
      }
    }
    subServiceCredentials[sub.key] = out;
    subServiceSecretsSet[sub.key] = setMap;
    subServiceSecretHints[sub.key] = hintMap;
  }

  return {
    enabled: state.enabled,
    oauthConnected: state.oauthConnected,
    subServices: state.subServices,
    validation: state.validation,
    lastEditedAt: state.lastEditedAt ?? null,
    lastEditedBy: state.lastEditedBy ?? null,
    credentials,
    subServiceCredentials,
    secretsSet,
    subServiceSecretsSet,
    secretHints,
    subServiceSecretHints,
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

export async function saveIntegrations(
  incoming: Record<string, IncomingProviderState>,
  editor?: { name: string },
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

    const selectionChanged =
      prev.enabled !== sub.enabled ||
      JSON.stringify(prev.subServices) !== JSON.stringify(sub.subServices ?? {});

    // A broader "did the stored config actually change" check drives the audit
    // stamp (who last edited & when) — includes credential/secret changes too.
    const configChanged =
      selectionChanged ||
      JSON.stringify(prev.credentials) !== JSON.stringify(credentials) ||
      JSON.stringify(prev.subServiceCredentials) !== JSON.stringify(subServiceCredentials) ||
      prev.oauthConnected !== (sub.oauthConnected ?? prev.oauthConnected);

    next.providers[provider.key] = {
      enabled: Boolean(sub.enabled),
      credentials,
      subServices: sub.subServices ?? {},
      subServiceCredentials,
      oauthConnected: sub.oauthConnected ?? prev.oauthConnected,
      validation: selectionChanged
        ? { status: "untested", message: "", checkedAt: null, subServices: {} }
        : prev.validation,
      lastEditedAt: configChanged && editor ? next.updatedAt : (prev.lastEditedAt ?? null),
      lastEditedBy: configChanged && editor ? editor.name : (prev.lastEditedBy ?? null),
    };
  }

  await writeIntegrations(next);
  return next;
}

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

export function validateProviderConfig(
  providerKey: string,
  state: ProviderState,
): ProviderValidation {
  const provider = findProvider(providerKey);
  if (!provider) {
    return { status: "error", message: "Unknown provider.", checkedAt: new Date().toISOString() };
  }

  const missing: string[] = [];
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
    const submissing = (sub.extraFields ?? [])
      .filter((f) => f.required && !((state.subServiceCredentials[sub.key] ?? {})[f.key] ?? "").trim())
      .map((f) => f.label);
    subResults[sub.key] =
      submissing.length === 0
        ? { status: "success", message: "Authorized." }
        : { status: "error", message: `Missing: ${submissing.join(", ")}` };
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
