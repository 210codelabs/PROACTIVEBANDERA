"use client";

import React, { useEffect, useState } from "react";

type ScopeDef = { key: string; label: string; group: string; description: string };

type Client = {
  id: string;
  name: string;
  description: string | null;
  keyId: string;
  secretLast4: string | null;
  scopes: string[];
  active: boolean;
  rateLimitPerMin: number;
  lastUsedAt: string | null;
  requestCount: number;
  createdByName: string | null;
  createdAt: string;
};

export default function ApiClientsManager({ allScopes }: { allScopes: ScopeDef[] }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [rateLimit, setRateLimit] = useState(120);
  const [saving, setSaving] = useState(false);

  // one-time secret reveal
  const [reveal, setReveal] = useState<{ title: string; token: string; keyId: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/api-clients", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      setClients(json.clients || []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function toggleScope(k: string) {
    setScopes((prev) => (prev.includes(k) ? prev.filter((s) => s !== k) : [...prev, k]));
  }

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || scopes.length === 0) { setErr("Name and at least one scope are required."); return; }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/api-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, scopes, rateLimitPerMin: rateLimit }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create");
      setReveal({ title: `“${json.client.name}” created`, token: json.credentials.token, keyId: json.credentials.keyId, secret: json.credentials.secret });
      setName(""); setDescription(""); setScopes([]); setRateLimit(120); setShowForm(false);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to create API key");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: Client) {
    await fetch(`/api/admin/api-clients/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    await load();
  }

  async function rotate(c: Client) {
    if (!confirm(`Rotate the secret for “${c.name}”? The current secret will stop working immediately.`)) return;
    const res = await fetch(`/api/admin/api-clients/${c.id}/rotate`, { method: "POST" });
    const json = await res.json();
    if (res.ok) {
      setReveal({ title: `New secret for “${c.name}”`, token: json.credentials.token, keyId: json.credentials.keyId, secret: json.credentials.secret });
      await load();
    } else {
      setErr(json?.error || "Failed to rotate secret");
    }
  }

  async function revoke(c: Client) {
    if (!confirm(`Permanently revoke “${c.name}”? This cannot be undone and the app will lose access.`)) return;
    await fetch(`/api/admin/api-clients/${c.id}`, { method: "DELETE" });
    await load();
  }

  function copyToken(t: string) {
    navigator.clipboard?.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <section className="space-y-4">
      {err && (
        <div className="card card-pad border-rose-200 bg-rose-50 text-rose-800 text-sm">{err}</div>
      )}

      {reveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card card-pad w-full max-w-lg bg-white">
            <h3 className="font-semibold text-slate-900">{reveal.title}</h3>
            <p className="text-sm text-amber-700 mt-1">
              Copy this secret now. For your security it is hashed and will <b>never be shown again</b>.
            </p>
            <div className="mt-3 space-y-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Key ID</div>
                <code className="block break-all rounded bg-slate-100 p-2 text-xs">{reveal.keyId}</code>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Bearer token (keyId.secret)</div>
                <code className="block break-all rounded bg-slate-900 text-emerald-300 p-2 text-xs">{reveal.token}</code>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => copyToken(reveal.token)} className="px-3 py-2 text-xs font-semibold rounded-md bg-brand-600 text-white hover:opacity-90">
                {copied ? "Copied!" : "Copy token"}
              </button>
              <button onClick={() => setReveal(null)} className="px-3 py-2 text-xs font-semibold rounded-md bg-slate-200 text-slate-800 hover:bg-slate-300">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">API keys</h3>
        <button onClick={() => setShowForm((s) => !s)} className="px-3 py-2 text-xs font-semibold rounded-md bg-brand-600 text-white hover:opacity-90">
          {showForm ? "Cancel" : "+ New integration key"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createClient} className="card card-pad space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Integration app name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Serenity Behavioral Health" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Rate limit (requests/min)</label>
              <input type="number" min={1} max={6000} value={rateLimit} onChange={(e) => setRateLimit(parseInt(e.target.value || "120", 10))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this app does" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Scopes *</label>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              {allScopes.map((s) => (
                <label key={s.key} className={`flex items-start gap-2 rounded-md border p-2 cursor-pointer text-sm ${scopes.includes(s.key) ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}>
                  <input type="checkbox" checked={scopes.includes(s.key)} onChange={() => toggleScope(s.key)} className="mt-0.5" />
                  <span>
                    <span className="font-medium text-slate-900">{s.label}</span>
                    <code className="ml-1 text-[11px] text-slate-500">{s.key}</code>
                    <span className="block text-xs text-slate-500">{s.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button disabled={saving} className="px-4 py-2 text-xs font-semibold rounded-md bg-brand-600 text-white hover:opacity-90 disabled:opacity-50">
              {saving ? "Creating…" : "Create key"}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : clients.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No API keys yet. Create one to let an external app integrate.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">App</th>
                <th className="px-3 py-2">Key ID</th>
                <th className="px-3 py-2">Scopes</th>
                <th className="px-3 py-2">Usage</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{c.name}</div>
                    {c.description && <div className="text-xs text-slate-500">{c.description}</div>}
                    <div className="text-[11px] text-slate-400 mt-1">by {c.createdByName || "—"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <code className="text-xs break-all">{c.keyId}</code>
                    <div className="text-[11px] text-slate-400">secret …{c.secretLast4 || "????"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.scopes.map((s) => (
                        <span key={s} className="chip bg-slate-100 text-slate-700 ring-slate-200 text-[10px]">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    <div>{c.requestCount} reqs</div>
                    <div className="text-[11px] text-slate-400">{c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString() : "never used"}</div>
                    <div className="text-[11px] text-slate-400">{c.rateLimitPerMin}/min</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`chip ${c.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-800 ring-rose-200"}`}>{c.active ? "active" : "disabled"}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <button onClick={() => toggleActive(c)} className="px-2 py-1 text-[11px] font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-200">{c.active ? "Disable" : "Enable"}</button>
                      <button onClick={() => rotate(c)} className="px-2 py-1 text-[11px] font-semibold rounded bg-amber-100 text-amber-800 hover:bg-amber-200">Rotate</button>
                      <button onClick={() => revoke(c)} className="px-2 py-1 text-[11px] font-semibold rounded bg-rose-100 text-rose-700 hover:bg-rose-200">Revoke</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
