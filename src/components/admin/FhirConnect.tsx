"use client";

import React, { useEffect, useState } from "react";

type Conn = {
  provider: string; label: string; defaultScopes: string; docs: string; redirectUri: string;
  connection: any | null;
};

function StatusBadge({ status, connected }: { status?: string; connected?: boolean }) {
  const map: Record<string, string> = {
    connected: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    configured: "bg-sky-100 text-sky-800 ring-sky-200",
    unconfigured: "bg-slate-100 text-slate-600 ring-slate-200",
    error: "bg-rose-100 text-rose-800 ring-rose-200",
  };
  const s = connected ? "connected" : (status || "unconfigured");
  return <span className={`chip ${map[s] || map.unconfigured}`}>{connected ? "Connected" : s}</span>;
}

export default function FhirConnect() {
  const [providers, setProviders] = useState<Conn[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [forms, setForms] = useState<Record<string, any>>({});
  const [importForm, setImportForm] = useState<Record<string, any>>({});
  const [importResult, setImportResult] = useState<Record<string, any>>({});
  const [dirQuery, setDirQuery] = useState("");
  const [dirResults, setDirResults] = useState<any[]>([]);

  async function load() {
    const r = await fetch("/api/admin/fhir/connections");
    const d = await r.json();
    if (r.ok) {
      setProviders(d.providers || []);
      setStaff(d.staff || []);
      const f: Record<string, any> = {};
      for (const p of d.providers || []) {
        const c = p.connection || {};
        f[p.provider] = {
          baseUrl: c.baseUrl || "", authUrl: c.authUrl || "", tokenUrl: c.tokenUrl || "",
          clientId: c.clientId || "", clientSecret: "", scopes: c.scopes || p.defaultScopes,
        };
      }
      setForms(f);
    }
  }
  useEffect(() => {
    load();
    // Surface the connect result passed back from the OAuth callback redirect.
    const u = new URL(window.location.href);
    const m = u.searchParams.get("msg");
    if (m) { setMsg({ kind: /fail|denied|mismatch|missing|no access/i.test(m) ? "err" : "ok", text: m }); }
  }, []);

  function setField(provider: string, key: string, val: string) {
    setForms((prev) => ({ ...prev, [provider]: { ...prev[provider], [key]: val } }));
  }
  function setImp(provider: string, key: string, val: string) {
    setImportForm((prev) => ({ ...prev, [provider]: { ...prev[provider], [key]: val } }));
  }

  async function saveConfig(provider: string) {
    setBusy(`save-${provider}`); setMsg(null);
    try {
      const r = await fetch("/api/admin/fhir/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, ...forms[provider] }) });
      const d = await r.json();
      if (!r.ok) setMsg({ kind: "err", text: d.error || "Save failed." });
      else { setMsg({ kind: "ok", text: "Configuration saved. Click Connect to authorize." }); await load(); }
    } finally { setBusy(""); }
  }

  async function searchDir() {
    if (dirQuery.trim().length < 2) { setDirResults([]); return; }
    const r = await fetch(`/api/admin/fhir/directory?q=${encodeURIComponent(dirQuery)}`);
    const d = await r.json();
    if (r.ok) setDirResults(d.practices || []);
  }
  function pickPractice(provider: string, pr: any) {
    setForms((prev) => ({ ...prev, [provider]: { ...prev[provider], baseUrl: pr.base } }));
    setDirResults([]);
    setMsg({ kind: "ok", text: `Selected ${pr.name}. Base URL filled — click Auto-discover endpoints, then Save.` });
  }

  async function discover(provider: string) {
    const baseUrl = (forms[provider]?.baseUrl || "").trim();
    if (!baseUrl) { setMsg({ kind: "err", text: "Enter the FHIR base URL first, then auto-discover." }); return; }
    setBusy(`disc-cfg-${provider}`); setMsg(null);
    try {
      const r = await fetch("/api/admin/fhir/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseUrl }) });
      const d = await r.json();
      if (!r.ok) setMsg({ kind: "err", text: d.error || "Discovery failed." });
      else {
        setForms((prev) => ({ ...prev, [provider]: { ...prev[provider], authUrl: d.authUrl || prev[provider].authUrl, tokenUrl: d.tokenUrl || prev[provider].tokenUrl } }));
        setMsg({ kind: "ok", text: `Endpoints discovered from ${d.source}${d.fhirVersion ? ` · FHIR ${d.fhirVersion}` : ""}. Review and Save.` });
      }
    } finally { setBusy(""); }
  }

  async function disconnect(provider: string) {
    if (!confirm("Disconnect this EHR? Saved endpoint config is kept; only the access tokens are cleared.")) return;
    setBusy(`disc-${provider}`); setMsg(null);
    try {
      const r = await fetch(`/api/admin/fhir/${provider}/disconnect`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) setMsg({ kind: "err", text: d.error || "Disconnect failed." });
      else { setMsg({ kind: "ok", text: "Disconnected." }); await load(); }
    } finally { setBusy(""); }
  }

  async function runImport(provider: string) {
    setBusy(`imp-${provider}`); setMsg(null);
    setImportResult((r) => ({ ...r, [provider]: null }));
    try {
      const f = importForm[provider] || {};
      const r = await fetch(`/api/admin/fhir/${provider}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json();
      if (!r.ok) {
        setImportResult((rr) => ({ ...rr, [provider]: { error: d.error, candidates: d.candidates } }));
        setMsg({ kind: "err", text: d.error || "Import failed." });
      } else {
        setImportResult((rr) => ({ ...rr, [provider]: d }));
        setMsg({ kind: "ok", text: `Imported ${d.created} record(s) for the patient (${d.skipped} skipped).` });
        await load();
      }
    } finally { setBusy(""); }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <b>Connected import (beta).</b> This pulls patient charts live from Practice Fusion (Veradigm) or eClinicalWorks over their certified <b>FHIR&nbsp;R4 / SMART‑on‑FHIR</b> APIs. It stays inactive until you enter <b>vendor‑approved OAuth credentials</b> (client ID, FHIR base URL, auth/token URLs) obtained through each vendor's developer program, and a BAA is in place. We never use a clinician's username/password.
      </div>

      {msg && <div className={`rounded-lg px-4 py-3 text-sm ring-1 ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>{msg.text}</div>}

      {providers.map((p) => {
        const c = p.connection;
        const f = forms[p.provider] || {};
        const imp = importForm[p.provider] || {};
        const ir = importResult[p.provider];
        return (
          <div key={p.provider} className="rounded-xl ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">{p.label}</h3>
                <StatusBadge status={c?.status} connected={c?.connected} />
              </div>
              <a href={p.docs} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">Developer program ↗</a>
            </div>

            <div className="p-4 space-y-3">
              {c?.lastError && <div className="text-xs text-rose-600">Last error: {c.lastError}</div>}

              <details open={!c?.connected}>
                <summary className="cursor-pointer text-sm font-medium text-slate-700">Connection settings</summary>
                {p.provider === "veradigm" && (
                  <div className="mt-2 rounded-lg bg-sky-50 ring-1 ring-sky-200 p-2">
                    <div className="text-xs font-medium text-sky-900 mb-1">Find your practice (Practice Fusion directory)</div>
                    <div className="flex gap-2">
                      <input className="input" placeholder="Practice name or NPI" value={dirQuery} onChange={(e) => setDirQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchDir(); }} />
                      <button type="button" className="btn-secondary" onClick={searchDir} disabled={busy !== ""}>Search</button>
                    </div>
                    {dirResults.length > 0 && (
                      <ul className="mt-2 max-h-44 overflow-auto text-xs divide-y divide-sky-100">
                        {dirResults.map((pr) => (
                          <li key={pr.orgId} className="py-1 flex items-center justify-between gap-2">
                            <span className="truncate">{pr.name}{pr.npi ? ` · NPI ${pr.npi}` : ""}{pr.city ? ` · ${pr.city}, ${pr.state || ""}` : ""}</span>
                            <button type="button" className="text-brand-600 hover:underline shrink-0" onClick={() => pickPractice(p.provider, pr)}>use</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="text-[11px] text-sky-700 mt-1">Picks the Provider/System Access FHIR base URL from the published Service Base URL directory.</div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  <L label="FHIR base URL"><input className="input" value={f.baseUrl || ""} onChange={(e) => setField(p.provider, "baseUrl", e.target.value)} placeholder="https://…/fhir/r4/…" /></L>
                  <L label="Client ID"><input className="input" value={f.clientId || ""} onChange={(e) => setField(p.provider, "clientId", e.target.value)} /></L>
                  <L label="Authorization URL"><input className="input" value={f.authUrl || ""} onChange={(e) => setField(p.provider, "authUrl", e.target.value)} placeholder="https://…/authorize" /></L>
                  <L label="Token URL"><input className="input" value={f.tokenUrl || ""} onChange={(e) => setField(p.provider, "tokenUrl", e.target.value)} placeholder="https://…/token" /></L>
                  <L label={`Client secret ${c?.clientSecretSet ? "(saved — leave blank to keep)" : "(if confidential app)"}`}><input className="input" type="password" value={f.clientSecret || ""} onChange={(e) => setField(p.provider, "clientSecret", e.target.value)} placeholder={c?.clientSecretSet ? c.clientSecretMasked || "••••" : ""} /></L>
                  <L label="Scopes"><input className="input" value={f.scopes || ""} onChange={(e) => setField(p.provider, "scopes", e.target.value)} /></L>
                  <div className="md:col-span-2 text-[11px] text-slate-500">Register this <b>Redirect URI</b> with the vendor: <span className="font-mono break-all">{p.redirectUri}</span></div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => discover(p.provider)} disabled={busy !== ""} className="btn-ghost">{busy === `disc-cfg-${p.provider}` ? "Discovering…" : "Auto-discover endpoints"}</button>
                  <button onClick={() => saveConfig(p.provider)} disabled={busy !== ""} className="btn-secondary">{busy === `save-${p.provider}` ? "Saving…" : "Save configuration"}</button>
                  {c?.status && c.status !== "unconfigured" && (
                    <a href={`/api/admin/fhir/${p.provider}/authorize`} className={`btn-primary ${busy !== "" ? "pointer-events-none opacity-60" : ""}`}>{c?.connected ? "Reconnect" : "Connect"}</a>
                  )}
                  {c?.connected && <button onClick={() => disconnect(p.provider)} disabled={busy !== ""} className="btn-ghost text-rose-600">Disconnect</button>}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Tip: enter just the <b>FHIR base URL</b> and click <b>Auto-discover endpoints</b> — we read <span className="font-mono">/.well-known/smart-configuration</span> to fill the Authorization &amp; Token URLs.</p>
              </details>

              {c?.connected && (
                <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3 space-y-2">
                  <div className="text-sm font-medium text-slate-700">Import a patient</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <L label="MRN / identifier"><input className="input" value={imp.mrn || ""} onChange={(e) => setImp(p.provider, "mrn", e.target.value)} /></L>
                    <L label="Family (last) name"><input className="input" value={imp.family || ""} onChange={(e) => setImp(p.provider, "family", e.target.value)} /></L>
                    <L label="Given (first) name"><input className="input" value={imp.given || ""} onChange={(e) => setImp(p.provider, "given", e.target.value)} /></L>
                    <L label="Birth date"><input className="input" type="date" value={imp.birthdate || ""} onChange={(e) => setImp(p.provider, "birthdate", e.target.value)} /></L>
                    <L label="Default provider (for visit notes)">
                      <select className="input" value={imp.defaultProviderId || ""} onChange={(e) => setImp(p.provider, "defaultProviderId", e.target.value)}>
                        <option value="">— none —</option>
                        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </L>
                  </div>
                  <button onClick={() => runImport(p.provider)} disabled={busy !== ""} className="btn-primary">{busy === `imp-${p.provider}` ? "Importing…" : "Search & import patient"}</button>

                  {ir?.error && (
                    <div className="text-sm text-rose-600">
                      {ir.error}
                      {ir.candidates?.length > 0 && (
                        <ul className="mt-1 list-disc ml-5 text-xs text-slate-600">
                          {ir.candidates.map((cand: any) => (
                            <li key={cand.id}>
                              {cand.name} · DOB {cand.birthDate || "?"} {cand.mrn ? `· MRN ${cand.mrn}` : ""}
                              <button className="ml-2 text-brand-600 hover:underline" onClick={() => { setImp(p.provider, "patientId", cand.id); }}>use this</button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {imp.patientId && <div className="text-[11px] text-slate-500 mt-1">Selected patient id: {imp.patientId} — click Search &amp; import again.</div>}
                    </div>
                  )}
                  {ir?.ok && (
                    <div className="text-sm text-emerald-700">
                      {ir.patientCreated ? "New chart created" : "Merged into existing chart"} — {ir.created} added, {ir.skipped} skipped (from {ir.resourceCount} FHIR resources).
                      {ir.notice && <div className="text-amber-700">{ir.notice}</div>}
                      {ir.patientId && <a href={`/patients/${ir.patientId}`} className="text-brand-600 hover:underline ml-1">Open chart →</a>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-slate-400">Imported clinical data should be reviewed by a clinician before it is relied upon. Re-running an import is safe — existing records are skipped.</p>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
