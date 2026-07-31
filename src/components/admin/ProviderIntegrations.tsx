"use client";

import { useCallback, useMemo, useState } from "react";
import {
  INTEGRATION_CATALOG,
  type CapabilityDef,
  type ProviderDef,
  type FieldDef,
} from "@/lib/integrations/catalog";

// Shapes mirror the sanitized payload from /api/admin/integrations (secrets are
// blank strings; *SecretsSet maps tell us which secrets already exist on the server).
type ClientProviderState = {
  enabled: boolean;
  oauthConnected: boolean;
  credentials: Record<string, string>;
  subServices: Record<string, boolean>;
  subServiceCredentials: Record<string, Record<string, string>>;
  secretsSet: Record<string, boolean>;
  subServiceSecretsSet: Record<string, Record<string, boolean>>;
  validation: {
    status: "untested" | "success" | "error";
    message: string;
    checkedAt: string | null;
    subServices?: Record<string, { status: "untested" | "success" | "error"; message: string }>;
  };
};

type ClientState = {
  providers: Record<string, ClientProviderState>;
  updatedAt: string | null;
};

const EMPTY_VALIDATION = { status: "untested" as const, message: "", checkedAt: null, subServices: {} };

function blankProvider(): ClientProviderState {
  return {
    enabled: false,
    oauthConnected: false,
    credentials: {},
    subServices: {},
    subServiceCredentials: {},
    secretsSet: {},
    subServiceSecretsSet: {},
    validation: EMPTY_VALIDATION,
  };
}

// A field counts as "provided" if it has a freshly typed value, or it is a
// secret that is already stored on the server.
function fieldProvided(value: string | undefined, isSet: boolean | undefined): boolean {
  return Boolean((value ?? "").trim()) || Boolean(isSet);
}

function missingFields(provider: ProviderDef, ps: ClientProviderState): string[] {
  const missing: string[] = [];
  const usingOAuth = provider.authMode === "oauth" && ps.oauthConnected;
  if (!usingOAuth) {
    for (const f of provider.fields) {
      if (f.required && !fieldProvided(ps.credentials[f.key], ps.secretsSet[f.key])) {
        missing.push(`${provider.name}: ${f.label}`);
      }
    }
  }
  for (const sub of provider.subServices ?? []) {
    if (!ps.subServices[sub.key]) continue;
    for (const f of sub.extraFields ?? []) {
      const provided = fieldProvided(
        ps.subServiceCredentials[sub.key]?.[f.key],
        ps.subServiceSecretsSet[sub.key]?.[f.key],
      );
      if (f.required && !provided) missing.push(`${provider.name} · ${sub.label}: ${f.label}`);
    }
  }
  return missing;
}

export default function ProviderIntegrations({ initialState }: { initialState: ClientState }) {
  const [state, setState] = useState<ClientState>(initialState);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState<Record<string, boolean>>({});

  const getProvider = useCallback(
    (key: string): ClientProviderState => state.providers[key] ?? blankProvider(),
    [state.providers],
  );

  const patchProvider = useCallback((key: string, patch: Partial<ClientProviderState>) => {
    setState((prev) => ({
      ...prev,
      providers: { ...prev.providers, [key]: { ...(prev.providers[key] ?? blankProvider()), ...patch } },
    }));
    setDirty(true);
  }, []);

  function toggleProvider(capability: CapabilityDef, provider: ProviderDef, checked: boolean) {
    const ps = getProvider(provider.key);
    if (!checked) {
      const hasData =
        Object.values(ps.secretsSet).some(Boolean) ||
        Object.values(ps.credentials).some((v) => v.trim()) ||
        Object.values(ps.subServices).some(Boolean);
      if (hasData) {
        const ok = window.confirm(
          `Disconnect ${provider.name}? Its saved credentials and sub-service selections will be cleared when you save. This cannot be undone.`,
        );
        if (!ok) return;
      }
      // Clear the provider's sensitive state on disconnect.
      patchProvider(provider.key, {
        enabled: false,
        credentials: {},
        subServices: {},
        subServiceCredentials: {},
        secretsSet: {},
        subServiceSecretsSet: {},
        oauthConnected: false,
        validation: EMPTY_VALIDATION,
      });
      return;
    }

    // Single-select capabilities: turning one on turns its siblings off.
    if (capability.selection === "single") {
      for (const sibling of capability.providers) {
        if (sibling.key !== provider.key && getProvider(sibling.key).enabled) {
          patchProvider(sibling.key, { enabled: false });
        }
      }
    }
    patchProvider(provider.key, { enabled: true });
  }

  function setCredential(providerKey: string, fieldKey: string, value: string) {
    const ps = getProvider(providerKey);
    patchProvider(providerKey, { credentials: { ...ps.credentials, [fieldKey]: value } });
  }

  function setSubService(providerKey: string, subKey: string, enabled: boolean) {
    const ps = getProvider(providerKey);
    patchProvider(providerKey, { subServices: { ...ps.subServices, [subKey]: enabled } });
  }

  function setSubCredential(providerKey: string, subKey: string, fieldKey: string, value: string) {
    const ps = getProvider(providerKey);
    patchProvider(providerKey, {
      subServiceCredentials: {
        ...ps.subServiceCredentials,
        [subKey]: { ...(ps.subServiceCredentials[subKey] ?? {}), [fieldKey]: value },
      },
    });
  }

  const allMissing = useMemo(() => {
    const out: string[] = [];
    for (const cap of INTEGRATION_CATALOG) {
      for (const provider of cap.providers) {
        const ps = getProvider(provider.key);
        if (ps.enabled) out.push(...missingFields(provider, ps));
      }
    }
    return out;
  }, [getProvider]);

  function buildPayload() {
    const providers: Record<string, unknown> = {};
    for (const cap of INTEGRATION_CATALOG) {
      for (const provider of cap.providers) {
        const ps = getProvider(provider.key);
        providers[provider.key] = {
          enabled: ps.enabled,
          credentials: ps.credentials,
          subServices: ps.subServices,
          subServiceCredentials: ps.subServiceCredentials,
          oauthConnected: ps.oauthConnected,
        };
      }
    }
    return { providers };
  }

  async function save(): Promise<boolean> {
    if (allMissing.length > 0) {
      setMessage({ kind: "error", text: `Complete required fields before saving (${allMissing.length}).` });
      return false;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save integrations");
      setState(json.state);
      setManualMode({});
      setDirty(false);
      setMessage({ kind: "ok", text: "Integration settings saved." });
      return true;
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Save failed" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(provider: ProviderDef) {
    const ps = getProvider(provider.key);
    const localMissing = missingFields(provider, ps);
    if (localMissing.length > 0) {
      patchProvider(provider.key, {
        validation: {
          status: "error",
          message: `Missing required fields: ${localMissing.map((m) => m.split(": ").pop()).join(", ")}`,
          checkedAt: new Date().toISOString(),
          subServices: ps.validation.subServices,
        },
      });
      return;
    }
    setBusyProvider(provider.key);
    setMessage(null);
    try {
      // The test endpoint reads stored credentials, so persist first if needed.
      if (dirty) {
        const ok = await save();
        if (!ok) return;
      }
      const res = await fetch("/api/admin/integrations/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerKey: provider.key }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Test failed");
      patchProvider(provider.key, { validation: json.validation });
      setDirty(false);
    } catch (err) {
      patchProvider(provider.key, {
        validation: {
          status: "error",
          message: err instanceof Error ? err.message : "Test failed",
          checkedAt: new Date().toISOString(),
          subServices: {},
        },
      });
    } finally {
      setBusyProvider(null);
    }
  }

  async function googleAction(action: "connect" | "disconnect") {
    setBusyProvider("google-meet");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/integrations/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (action === "connect" && json.available === false) {
        setManualMode((m) => ({ ...m, "google-meet": true }));
        setMessage({
          kind: "error",
          text: "Google OAuth is not configured in this environment. Use the manual setup below.",
        });
        return;
      }
      patchProvider("google-meet", {
        oauthConnected: Boolean(json.connected),
        enabled: json.connected ? true : getProvider("google-meet").enabled,
        validation: EMPTY_VALIDATION,
      });
      setDirty(false);
      if (action === "connect" && json.connected) {
        setMessage({ kind: "ok", text: "Authenticated with Google." });
      }
    } catch {
      setManualMode((m) => ({ ...m, "google-meet": true }));
      setMessage({ kind: "error", text: "Could not reach Google. Use the manual setup below." });
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <div className="card card-pad space-y-5">
      <div>
        <h2 className="font-semibold text-slate-900">External Integrations and Automation</h2>
        <p className="text-xs text-slate-500 mt-1">
          Choose the vendors your clinic uses for each capability. Credential fields appear when a provider is selected,
          and every secret is masked and stored securely.
        </p>
      </div>

      {INTEGRATION_CATALOG.map((capability) => (
        <section key={capability.key} className="rounded-lg ring-1 ring-slate-200 bg-slate-50/60 p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900">{capability.title}</h3>
            <p className="text-xs text-slate-500">{capability.description}</p>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 mt-1">
              {capability.selection === "multi" ? "Select one or more" : "Select one"}
            </p>
          </div>

          <div className="space-y-3">
            {capability.providers.map((provider) => {
              const ps = getProvider(provider.key);
              return (
                <div
                  key={provider.key}
                  className={`rounded-md ring-1 p-3 transition-colors ${
                    ps.enabled ? "bg-white ring-brand-200" : "bg-white/70 ring-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type={capability.selection === "single" ? "radio" : "checkbox"}
                        name={capability.key}
                        className="mt-1"
                        checked={ps.enabled}
                        onChange={(e) => toggleProvider(capability, provider, e.target.checked)}
                      />
                      <span>
                        <span className="font-medium text-slate-900">{provider.name}</span>
                        <span className="block text-xs text-slate-500">{provider.description}</span>
                      </span>
                    </label>
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
                      title={provider.docsLabel}
                    >
                      <span aria-hidden>🔗</span> {provider.docsLabel}
                    </a>
                  </div>

                  {ps.enabled && (
                    <div className="mt-3 pl-1 sm:pl-6 space-y-4">
                      {provider.authMode === "oauth" && (
                        <GoogleAuthBlock
                          ps={ps}
                          busy={busyProvider === provider.key}
                          manual={Boolean(manualMode[provider.key])}
                          onConnect={() => googleAction("connect")}
                          onDisconnect={() => googleAction("disconnect")}
                          onToggleManual={() =>
                            setManualMode((m) => ({ ...m, [provider.key]: !m[provider.key] }))
                          }
                        />
                      )}

                      {/* Base credential fields. Hidden for OAuth providers that are connected and not in manual mode. */}
                      {!(provider.authMode === "oauth" && ps.oauthConnected && !manualMode[provider.key]) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {provider.fields.map((field) => (
                            <CredentialInput
                              key={field.key}
                              field={field}
                              value={ps.credentials[field.key] ?? ""}
                              isSet={Boolean(ps.secretsSet[field.key])}
                              onChange={(v) => setCredential(provider.key, field.key, v)}
                            />
                          ))}
                        </div>
                      )}

                      {provider.subServices && provider.subServices.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-slate-700">Sub-services</div>
                          {provider.subServices.map((sub) => {
                            const on = Boolean(ps.subServices[sub.key]);
                            const subResult = ps.validation.subServices?.[sub.key];
                            return (
                              <div key={sub.key} className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-2.5">
                                <label className="flex items-start gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={on}
                                    onChange={(e) => setSubService(provider.key, sub.key, e.target.checked)}
                                  />
                                  <span>
                                    <span className="text-sm font-medium text-slate-800">{sub.label}</span>
                                    <span className="block text-xs text-slate-500">{sub.description}</span>
                                  </span>
                                  {on && subResult && <StatusDot status={subResult.status} />}
                                </label>
                                {on && sub.extraFields && sub.extraFields.length > 0 && (
                                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                                    {sub.extraFields.map((field) => (
                                      <CredentialInput
                                        key={field.key}
                                        field={field}
                                        value={ps.subServiceCredentials[sub.key]?.[field.key] ?? ""}
                                        isSet={Boolean(ps.subServiceSecretsSet[sub.key]?.[field.key])}
                                        onChange={(v) => setSubCredential(provider.key, sub.key, field.key, v)}
                                      />
                                    ))}
                                  </div>
                                )}
                                {on && subResult && (
                                  <p
                                    className={`mt-1 pl-6 text-xs ${
                                      subResult.status === "success"
                                        ? "text-emerald-700"
                                        : subResult.status === "error"
                                          ? "text-rose-700"
                                          : "text-slate-500"
                                    }`}
                                  >
                                    {subResult.message}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md bg-white ring-1 ring-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          onClick={() => testConnection(provider)}
                          disabled={busyProvider === provider.key}
                        >
                          {busyProvider === provider.key ? "Testing…" : "Test Connection"}
                        </button>
                        <ValidationBanner validation={ps.validation} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {allMissing.length > 0 && (
        <div className="rounded-md bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-900">
          <div className="font-semibold">Required fields still missing:</div>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            {allMissing.slice(0, 8).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-3">
        {message && (
          <span className={`text-xs ${message.kind === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
            {message.text}
          </span>
        )}
        <button className="btn-primary" onClick={save} disabled={saving || allMissing.length > 0}>
          {saving ? "Saving…" : "Save Integrations"}
        </button>
      </div>
    </div>
  );
}

function CredentialInput({
  field,
  value,
  isSet,
  onChange,
}: {
  field: FieldDef;
  value: string;
  isSet: boolean;
  onChange: (v: string) => void;
}) {
  const isSecret = field.type === "password";
  const placeholder = isSecret && isSet && !value ? "•••••••• (saved — leave blank to keep)" : field.placeholder;
  return (
    <label className="text-xs text-slate-600">
      <span className="font-medium text-slate-700">
        {field.label}
        {field.required && <span className="text-rose-500"> *</span>}
      </span>
      <input
        className="input mt-1"
        type={isSecret ? "password" : "text"}
        autoComplete={isSecret ? "new-password" : "off"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.help && <span className="block text-[11px] text-slate-400 mt-0.5">{field.help}</span>}
    </label>
  );
}

function GoogleAuthBlock({
  ps,
  busy,
  manual,
  onConnect,
  onDisconnect,
  onToggleManual,
}: {
  ps: ClientProviderState;
  busy: boolean;
  manual: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleManual: () => void;
}) {
  return (
    <div className="rounded-md bg-brand-50 ring-1 ring-brand-100 p-3 space-y-2">
      {ps.oauthConnected ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-emerald-800 font-medium">✓ Connected to Google</span>
          <button type="button" className="text-xs text-rose-700 hover:underline" onClick={onDisconnect} disabled={busy}>
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-white ring-1 ring-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onConnect}
            disabled={busy}
          >
            <span aria-hidden>🟢</span> {busy ? "Connecting…" : "Authenticate with Google"}
          </button>
          <button type="button" className="text-xs text-brand-700 hover:underline" onClick={onToggleManual}>
            {manual ? "Hide manual setup" : "Use manual setup instead"}
          </button>
        </div>
      )}
      {!ps.oauthConnected && manual && (
        <p className="text-xs text-slate-600">
          Manual setup: create OAuth credentials in Google Cloud Console and paste them below. The documentation link
          above walks through generating each value.
        </p>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: "untested" | "success" | "error" }) {
  const color = status === "success" ? "bg-emerald-500" : status === "error" ? "bg-rose-500" : "bg-slate-300";
  return <span className={`ml-auto mt-1 inline-block h-2.5 w-2.5 rounded-full ${color}`} aria-hidden />;
}

function ValidationBanner({
  validation,
}: {
  validation: ClientProviderState["validation"];
}) {
  if (validation.status === "untested") {
    return <span className="text-xs text-slate-400">Not yet tested</span>;
  }
  const ok = validation.status === "success";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
        ok ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-800 ring-1 ring-rose-200"
      }`}
    >
      <span aria-hidden>{ok ? "✓" : "✕"}</span>
      {validation.message}
    </span>
  );
}
