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
  const [dirBusy, setDirBusy] = useState(false);
  // Bulk "pull every patient" migration state (keyed by provider)
  const [bulkForm, setBulkForm] = useState<Record<string, any>>({});
  const [bulkJob, setBulkJob] = useState<Record<string, any>>({});
  const pollRef = React.useRef<Record<string, any>>({});

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
          authMode: c.authMode || "user",
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

  // A connection can run imports when it's connected (user mode) OR fully
  // configured with a signing key (system / Backend Services mode).
  function canImport(c: any) {
    return !!c && (c.connected || (c.authMode === "system" && c.keySet && c.baseUrl && c.tokenUrl && c.clientId));
  }

  // When importable providers appear, fetch their latest bulk job so an in-flight
  // migration keeps showing live progress across page reloads.
  useEffect(() => {
    for (const p of providers) {
      if (canImport(p.connection) && !bulkJob[p.provider]) {
        fetch(`/api/admin/fhir/${p.provider}/bulk-import`).then((r) => r.ok ? r.json() : null).then((d) => {
          if (d?.job) {
            setBulkJob((prev) => ({ ...prev, [p.provider]: d.job }));
            if (d.job.status === "running" && !pollRef.current[p.provider]) pollBulk(p.provider);
          }
        }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers]);

  // Clear any polling timers on unmount.
  useEffect(() => () => { for (const k of Object.keys(pollRef.current)) if (pollRef.current[k]) clearTimeout(pollRef.current[k]); }, []);

  function setField(provider: string, key: string, val: string) {
    setForms((prev) => ({ ...prev, [provider]: { ...prev[provider], [key]: val } }));
  }
  function setImp(provider: string, key: string, val: string) {
    setImportForm((prev) => ({ ...prev, [provider]: { ...prev[provider], [key]: val } }));
  }

  async function saveConfig(provider: string, extra: any = {}) {
    setBusy(`save-${provider}`); setMsg(null);
    try {
      const r = await fetch("/api/admin/fhir/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, ...forms[provider], ...extra }) });
      const d = await r.json();
      if (!r.ok) setMsg({ kind: "err", text: d.error || "Save failed." });
      else {
        const sys = (forms[provider]?.authMode === "system");
        setMsg({ kind: "ok", text: extra.regenerateKey ? "New signing key generated — re-share the JWKS URL with the vendor." : sys ? "Saved. Register the JWKS URL with the vendor, then click Test system connection." : "Configuration saved. Click Connect to authorize." });
        await load();
      }
    } finally { setBusy(""); }
  }

  async function testSystem(provider: string) {
    setBusy(`test-${provider}`); setMsg(null);
    try {
      // Save latest form values first so the test uses them.
      await fetch("/api/admin/fhir/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, ...forms[provider] }) });
      const r = await fetch(`/api/admin/fhir/${provider}/system/test`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) setMsg({ kind: "err", text: d.error || "System connection test failed." });
      else { setMsg({ kind: "ok", text: `Connected via System access ✓  Granted scope: ${d.grantedScope || "n/a"}${d.fhirVersion ? ` · FHIR ${d.fhirVersion}` : ""}. You can now pull patients below.` }); await load(); }
    } finally { setBusy(""); }
  }

  async function searchDir() {
    const q = dirQuery.trim();
    if (q.length < 2) { setMsg({ kind: "err", text: "Type at least 2 characters (practice name or NPI) to search." }); return; }
    setDirBusy(true); setMsg(null); setDirResults([]);
    try {
      const r = await fetch(`/api/admin/fhir/directory?q=${encodeURIComponent(q)}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ kind: "err", text: d.error === "Unauthorized" ? "Your session expired — please sign in again." : (d.error || `Directory search failed (HTTP ${r.status}).`) });
        return;
      }
      const list = d.practices || [];
      setDirResults(list);
      if (!list.length) setMsg({ kind: "ok", text: `No practices matched “${q}”. Try part of the practice name or the 10-digit NPI.` });
    } catch {
      setMsg({ kind: "err", text: "Directory search failed — network error. Please try again." });
    } finally { setDirBusy(false); }
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

  // ---- Bulk "pull every patient" migration ----
  function setBulk(provider: string, key: string, val: string) {
    setBulkForm((prev) => ({ ...prev, [provider]: { ...prev[provider], [key]: val } }));
  }
  function stopPoll(provider: string) {
    if (pollRef.current[provider]) { clearTimeout(pollRef.current[provider]); pollRef.current[provider] = null; }
  }
  async function pollBulk(provider: string) {
    try {
      const r = await fetch(`/api/admin/fhir/${provider}/bulk-import`);
      const d = await r.json();
      if (r.ok && d.job) {
        setBulkJob((prev) => ({ ...prev, [provider]: d.job }));
        if (d.job.status === "running") { pollRef.current[provider] = setTimeout(() => pollBulk(provider), 2000); return; }
      }
    } catch { /* transient — retry once more */ pollRef.current[provider] = setTimeout(() => pollBulk(provider), 3000); return; }
    stopPoll(provider);
  }
  async function startBulk(provider: string) {
    const f = bulkForm[provider] || {};
    const trial = (f.limit || "").toString().trim();
    const scope = trial ? `the first ${trial} patient(s)` : "EVERY patient";
    if (!confirm(`Pull ${scope} from this EHR into Proactive Clinic? This is additive — existing charts and records are merged, never overwritten. It runs in the background and may take a while for a large practice.`)) return;
    setBusy(`bulk-${provider}`); setMsg(null);
    try {
      const r = await fetch(`/api/admin/fhir/${provider}/bulk-import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: trial || undefined, defaultProviderId: f.defaultProviderId || undefined }) });
      const d = await r.json();
      if (!r.ok) {
        setMsg({ kind: "err", text: d.error || "Could not start the bulk import." });
        if (d.job) { setBulkJob((prev) => ({ ...prev, [provider]: d.job })); if (d.job.status === "running") pollBulk(provider); }
      } else {
        setBulkJob((prev) => ({ ...prev, [provider]: d.job }));
        setMsg({ kind: "ok", text: "Bulk import started — progress updates live below." });
        pollBulk(provider);
      }
    } finally { setBusy(""); }
  }
  async function cancelBulk(provider: string) {
    const job = bulkJob[provider];
    if (!job?.id) return;
    if (!confirm("Stop this bulk import? Patients already brought over are kept.")) return;
    await fetch(`/api/admin/fhir/${provider}/bulk-import?jobId=${encodeURIComponent(job.id)}`, { method: "DELETE" }).catch(() => {});
    setBulkJob((prev) => ({ ...prev, [provider]: { ...prev[provider], cancelRequested: true } }));
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
        const bf = bulkForm[p.provider] || {};
        const bj = bulkJob[p.provider];
        const mode = f.authMode || c?.authMode || "user";
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
                <div className="mt-2 inline-flex rounded-lg ring-1 ring-slate-200 overflow-hidden text-xs">
                  <button type="button" onClick={() => setField(p.provider, "authMode", "user")} className={`px-3 py-1.5 ${mode === "user" ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>Provider login (SMART)</button>
                  <button type="button" onClick={() => setField(p.provider, "authMode", "system")} className={`px-3 py-1.5 border-l border-slate-200 ${mode === "system" ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>System access (Bulk Data)</button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{mode === "system"
                  ? "Unattended, practice-level import via SMART Backend Services (client_credentials + a signed JWT). No user login — the practice registers our public key (JWKS URL below) with the vendor."
                  : "Interactive migration: an authorized provider logs in at the vendor and consents (authorization_code + PKCE)."}</p>
                {p.provider === "veradigm" && (
                  <div className="mt-2 rounded-lg bg-sky-50 ring-1 ring-sky-200 p-2">
                    <div className="text-xs font-medium text-sky-900 mb-1">Find your practice (Practice Fusion directory)</div>
                    <div className="flex gap-2">
                      <input className="input" placeholder="Practice name or NPI" value={dirQuery} onChange={(e) => setDirQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchDir(); }} />
                      <button type="button" className="btn-secondary" onClick={searchDir} disabled={dirBusy}>{dirBusy ? "Searching…" : "Search"}</button>
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
                  {mode === "user" && (
                    <L label="Authorization URL"><input className="input" value={f.authUrl || ""} onChange={(e) => setField(p.provider, "authUrl", e.target.value)} placeholder="https://…/authorize" /></L>
                  )}
                  <L label="Token URL"><input className="input" value={f.tokenUrl || ""} onChange={(e) => setField(p.provider, "tokenUrl", e.target.value)} placeholder="https://…/token" /></L>
                  {mode === "user" && (
                    <L label={`Client secret ${c?.clientSecretSet ? "(saved — leave blank to keep)" : "(if confidential app)"}`}><input className="input" type="password" value={f.clientSecret || ""} onChange={(e) => setField(p.provider, "clientSecret", e.target.value)} placeholder={c?.clientSecretSet ? c.clientSecretMasked || "••••" : ""} /></L>
                  )}
                  <L label="Scopes"><input className="input" value={f.scopes || ""} onChange={(e) => setField(p.provider, "scopes", e.target.value)} placeholder={mode === "system" ? "system/*.read" : "openid user/Patient.read …"} /></L>
                  {mode === "user" && (
                    <div className="md:col-span-2 text-[11px] text-slate-500">Register this <b>Redirect URI</b> with the vendor: <span className="font-mono break-all">{p.redirectUri}</span></div>
                  )}
                </div>

                {mode === "system" && (
                  <div className="mt-3 rounded-lg bg-indigo-50 ring-1 ring-indigo-200 p-3 space-y-2">
                    <div className="text-xs font-semibold text-indigo-900">System access — signing key</div>
                    {c?.keySet ? (
                      <div className="text-[11px] text-indigo-800">A signing key is set (alg {c.jwkAlg || "RS384"}, kid {c.jwkThumbprint || "••••"}). Register this <b>JWKS URL</b> with the vendor so they can verify our signed requests:</div>
                    ) : (
                      <div className="text-[11px] text-indigo-800">Save the configuration to generate an RSA signing key. Then register the <b>JWKS URL</b> below with the vendor.</div>
                    )}
                    <div className="flex items-center gap-2">
                      <input readOnly className="input font-mono text-[11px]" value={c?.jwksUrl || `${''}`} placeholder="Save to generate…" />
                      <button type="button" className="btn-secondary shrink-0" disabled={!c?.jwksUrl} onClick={() => { if (c?.jwksUrl) { navigator.clipboard?.writeText(c.jwksUrl); setMsg({ kind: "ok", text: "JWKS URL copied." }); } }}>Copy</button>
                    </div>
                    <div className="text-[11px] text-indigo-700">In the Veradigm portal, create a <b>System / Bulk export</b> R4 app, paste this JWKS URL, request <span className="font-mono">system/*.read</span> scopes, and copy the issued <b>Client ID</b> into the field above.</div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={() => discover(p.provider)} disabled={busy !== ""} className="btn-ghost">{busy === `disc-cfg-${p.provider}` ? "Discovering…" : "Auto-discover endpoints"}</button>
                  <button onClick={() => saveConfig(p.provider)} disabled={busy !== ""} className="btn-secondary">{busy === `save-${p.provider}` ? "Saving…" : "Save configuration"}</button>
                  {mode === "system" ? (
                    <>
                      {c?.keySet && <button onClick={() => saveConfig(p.provider, { regenerateKey: true })} disabled={busy !== ""} className="btn-ghost">Regenerate signing key</button>}
                      {c?.keySet && c?.clientId && c?.tokenUrl && <button onClick={() => testSystem(p.provider)} disabled={busy !== ""} className="btn-primary">{busy === `test-${p.provider}` ? "Testing…" : "Test system connection"}</button>}
                    </>
                  ) : (
                    <>
                      {c?.status && c.status !== "unconfigured" && (
                        <a href={`/api/admin/fhir/${p.provider}/authorize`} className={`btn-primary ${busy !== "" ? "pointer-events-none opacity-60" : ""}`}>{c?.connected ? "Reconnect" : "Connect"}</a>
                      )}
                      {c?.connected && <button onClick={() => disconnect(p.provider)} disabled={busy !== ""} className="btn-ghost text-rose-600">Disconnect</button>}
                    </>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{mode === "system"
                  ? "Tip: enter the FHIR base URL and click Auto-discover to fill the Token URL, then Save to mint your signing key."
                  : <>Tip: enter just the <b>FHIR base URL</b> and click <b>Auto-discover endpoints</b> — we read <span className="font-mono">/.well-known/smart-configuration</span> to fill the Authorization &amp; Token URLs.</>}</p>
              </details>

              {canImport(c) && (
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

              {canImport(c) && (
                <div className="rounded-lg bg-brand-50/40 ring-1 ring-brand-200 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-700">Bulk import — pull every patient</div>
                    {bj?.status && <span className={`chip ${bulkChip(bj.status)}`}>{bulkLabel(bj)}</span>}
                  </div>
                  <p className="text-[11px] text-slate-500">Migrate the whole practice in one run. Additive &amp; non-destructive — existing charts are merged and duplicates skipped. It runs in the background, so you can leave this page and return.</p>

                  {(!bj || bj.status !== "running") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 items-end">
                      <L label="Trial run — first N (blank = everyone)"><input className="input" type="number" min={1} placeholder="e.g. 10" value={bf.limit || ""} onChange={(e) => setBulk(p.provider, "limit", e.target.value)} /></L>
                      <L label="Default provider (for visit notes)">
                        <select className="input" value={bf.defaultProviderId || ""} onChange={(e) => setBulk(p.provider, "defaultProviderId", e.target.value)}>
                          <option value="">— none —</option>
                          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </L>
                      <button onClick={() => startBulk(p.provider)} disabled={busy !== ""} className="btn-primary">{busy === `bulk-${p.provider}` ? "Starting…" : bf.limit ? `Import first ${bf.limit}` : "Pull all patients"}</button>
                    </div>
                  )}

                  {bj && (
                    <div className="space-y-2">
                      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full ${bj.status === "failed" ? "bg-rose-500" : bj.status === "cancelled" ? "bg-amber-500" : "bg-brand-600"} ${bj.status === "running" ? "animate-pulse" : ""} transition-all`} style={{ width: `${bulkPct(bj)}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span><b>{bj.processed}</b>{bj.totalPatients ? ` / ${bj.totalPatients}` : ""} patients processed</span>
                        <span><b>{bj.patientsCreated}</b> new charts</span>
                        <span><b>{bj.patientsMerged}</b> merged</span>
                        <span><b>{bj.recordsCreated}</b> records added</span>
                        <span><b>{bj.recordsSkipped}</b> skipped</span>
                        {bj.failed > 0 && <span className="text-rose-600"><b>{bj.failed}</b> failed</span>}
                      </div>
                      {bj.status === "running" && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                          {bj.currentPatient ? `Importing ${bj.currentPatient}…` : "Working…"}
                          <button onClick={() => cancelBulk(p.provider)} className="ml-2 text-rose-600 hover:underline" disabled={bj.cancelRequested}>{bj.cancelRequested ? "Stopping…" : "Cancel"}</button>
                        </div>
                      )}
                      {bj.breakdown && bj.processed > 0 && (
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">{bj.status === "running" ? "Brought over so far" : "Brought over"}</div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                            {recapTiles(bj).map((t) => (
                              <div key={t.label} className="rounded-lg bg-white ring-1 ring-slate-200 p-2 text-center">
                                <div className="text-base font-semibold text-slate-800">{t.value}</div>
                                <div className="text-[10px] leading-tight text-slate-500 mt-0.5">{t.label}</div>
                                {t.sub && <div className="text-[10px] leading-tight text-slate-400">{t.sub}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {bj.status === "completed" && <div className="text-sm text-emerald-700">Migration complete — {bj.processed} patient(s) processed, {bj.recordsCreated} record(s) added.</div>}
                      {bj.status === "cancelled" && <div className="text-sm text-amber-700">Stopped — {bj.processed} patient(s) were brought over before cancelling.</div>}
                      {bj.status === "failed" && <div className="text-sm text-rose-700">Bulk import failed: {bj.notice || "unknown error"}.</div>}
                      {bj.notice && bj.status === "completed" && <div className="text-xs text-amber-700">{bj.notice}</div>}
                      {bj.errors?.length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-slate-500">{bj.errors.length} patient(s) had issues</summary>
                          <ul className="mt-1 list-disc ml-5 max-h-32 overflow-auto text-rose-700">
                            {bj.errors.map((e: any, i: number) => <li key={i}>{e.name}: {e.message}</li>)}
                          </ul>
                        </details>
                      )}
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

function bulkChip(status: string): string {
  return status === "completed" ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
    : status === "running" ? "bg-sky-100 text-sky-800 ring-sky-200"
    : status === "cancelled" ? "bg-amber-100 text-amber-800 ring-amber-200"
    : status === "failed" ? "bg-rose-100 text-rose-800 ring-rose-200"
    : "bg-slate-100 text-slate-600 ring-slate-200";
}
function bulkLabel(bj: any): string {
  const map: Record<string, string> = { running: "Running", completed: "Completed", cancelled: "Cancelled", failed: "Failed" };
  return map[bj?.status] || bj?.status || "";
}
function bulkPct(bj: any): number {
  if (bj?.totalPatients > 0) return Math.min(100, Math.round((bj.processed / bj.totalPatients) * 100));
  return 100; // unknown total: show a full, pulsing bar while running / done
}

// Friendly per-category recap tiles for a bulk migration ("what came over").
function recapTiles(bj: any): { label: string; value: number; sub?: string }[] {
  const b = bj?.breakdown || {};
  const c = (k: string) => (b[k]?.created ?? 0);
  const dup = (k: string) => (b[k]?.skipped ?? 0);
  const sub = (k: string) => (dup(k) ? `${dup(k)} dup` : undefined);
  const newN = bj?.patientsCreated || 0;
  const merged = bj?.patientsMerged || 0;
  return [
    { label: "Patients", value: newN + merged, sub: merged ? `${newN} new · ${merged} merged` : `${newN} new` },
    { label: "Problems", value: c("problems"), sub: sub("problems") },
    { label: "Medications", value: c("medications"), sub: sub("medications") },
    { label: "Allergies", value: c("allergies"), sub: sub("allergies") },
    { label: "Vitals", value: c("vitals"), sub: sub("vitals") },
    { label: "Immunizations", value: c("immunizations"), sub: sub("immunizations") },
    { label: "Encounters", value: c("encounters"), sub: sub("encounters") },
  ];
}
