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
    const raw: any = row.value;
    const val = typeof raw === "string" ? JSON.parse(raw) : raw;
    return withDefaults(val as Partial<IntegrationsState> | null);
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

// One-time, idempotent, self-healing cleanup of retired Weno integrations.
// Removes the legacy "weno" (Weno Exchange SOAP) provider record entirely and
// clears any stale "weno-online" validation message that still references the
// retired "Weno Online"/"Weno Exchange" labels or the old test.wenoexchange.com
// host. Called on boot so both preview AND production (separate DBs) self-clean
// to the single "Weno EZ Integration" identity. Never touches credentials.
export async function pruneLegacyWenoStore(): Promise<{ removedExchange: boolean; clearedValidation: boolean }> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: INTEGRATIONS_KEY } });
    // Tolerate a JSON-string value (e.g. written by an external tool).
    const raw: any = row?.value;
    const v: any = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
    if (!v?.providers) return { removedExchange: false, clearedValidation: false };
    let removedExchange = false;
    let clearedValidation = false;
    if (v.providers["weno"]) {
      delete v.providers["weno"];
      removedExchange = true;
    }
    const wo = v.providers["weno-online"];
    const msg = wo?.validation?.message ? String(wo.validation.message) : "";
    if (msg && /(Weno Online|Weno Exchange|test\.wenoexchange\.com|sandbox|for test\b)/i.test(msg)) {
      wo.validation = { status: "untested", message: "", checkedAt: null, subServices: {} };
      clearedValidation = true;
    }
    // Weno EZ Integration is LOCKED TO PRODUCTION: normalise any stored
    // test/sandbox ENVIRONMENT value and drop test-host ComposeRx overrides so
    // no screen (or launch) can ever report/route to sandbox again.
    if (wo?.credentials) {
      const envVal = String(wo.credentials.ENVIRONMENT || "");
      if (envVal !== "production") { wo.credentials.ENVIRONMENT = "production"; clearedValidation = true; }
      const ov = String(wo.credentials.COMPOSE_URL_OVERRIDE || "");
      if (ov && /(test|sandbox|staging|demo)/i.test(ov)) { wo.credentials.COMPOSE_URL_OVERRIDE = ""; clearedValidation = true; }
    }
    if (removedExchange || clearedValidation) {
      await db.appSetting.update({ where: { key: INTEGRATIONS_KEY }, data: { value: v } });
    }
    return { removedExchange, clearedValidation };
  } catch {
    return { removedExchange: false, clearedValidation: false };
  }
}

// Merge non-empty credential values into a provider (preserving existing values
// for any field not supplied). Used by the "Apply Weno EZ Integration config from
// environment" admin action so production can be populated without hand-typing.
export async function upsertProviderCredentials(
  providerKey: string,
  creds: Record<string, string>,
  opts?: { enable?: boolean; editedBy?: string; onlyIfEmpty?: boolean },
): Promise<{ applied: string[]; changed: string[] }> {
  const state = await readIntegrations();
  const prev = state.providers[providerKey] || emptyProviderState();
  const merged: Record<string, string> = { ...(prev.credentials || {}) };
  const applied: string[] = [];
  const changed: string[] = [];
  for (const [k, v] of Object.entries(creds)) {
    if (v == null || String(v).trim() === "") continue;
    // onlyIfEmpty = non-destructive mode: never overwrite a value that is
    // already present — only fill gaps. Otherwise (reconcile mode) we OVERWRITE
    // so the environment stays the source of truth across SEPARATE databases
    // (e.g. a freshly-deployed production instance self-heals a stale value).
    if (opts?.onlyIfEmpty && merged[k] && String(merged[k]).trim() !== "") continue;
    const before = merged[k];
    merged[k] = String(v);
    applied.push(k);
    if (String(before ?? "") !== String(v)) changed.push(k);
  }
  const enableChanged = opts?.enable != null && opts.enable !== prev.enabled;
  // Nothing actually changed -> skip the write (avoids needless churn on every
  // boot, so this is safe to run unconditionally on server start).
  if (changed.length === 0 && !enableChanged) {
    return { applied, changed };
  }
  const now = new Date().toISOString();
  state.providers[providerKey] = {
    ...prev,
    credentials: merged,
    enabled: opts?.enable ?? prev.enabled,
    lastEditedAt: now,
    lastEditedBy: opts?.editedBy || "system",
  };
  state.updatedAt = now;
  await writeIntegrations(state);
  return { applied, changed };
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
