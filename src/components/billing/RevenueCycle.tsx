"use client";

import React, { useCallback, useEffect, useState } from "react";

type Payer = { id: string; name: string; stediId?: string | null; supportsEligibility: boolean; supportsClaims: boolean; supportsRemittance: boolean; active: boolean };
type Enrollment = { id: string; providerName: string; npi: string; payerId?: string | null; payerName?: string | null; transactions?: any; status: string; stediEnrollmentId?: string | null; createdAt: string };
type FeeItem = { id: string; code: string; description: string; modifier?: string | null; feeCents: number; active: boolean };
type Claim = { id: string; patientControlNumber: string; patientName?: string | null; payerId: string; payerName?: string | null; status: string; totalChargeCents: number; paidCents: number; createdAt: string };
type Remit = { id: string; transactionId: string; payerName?: string | null; totalPaidCents: number; matchedClaims?: any[]; createdAt: string };

const TABS = ["Payers", "Enrollment", "Fee Schedule", "Claims", "Remittances"] as const;
type Tab = (typeof TABS)[number];

const money = (c: number) => `$${((c || 0) / 100).toFixed(2)}`;
const CLAIM_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200", submitted: "bg-blue-100 text-blue-800 ring-blue-200",
  accepted: "bg-indigo-100 text-indigo-800 ring-indigo-200", rejected: "bg-rose-100 text-rose-800 ring-rose-200",
  paid: "bg-emerald-100 text-emerald-800 ring-emerald-200", denied: "bg-rose-100 text-rose-800 ring-rose-200",
};

export default function RevenueCycle({ configured, defaultPayerId }: { configured: boolean; defaultPayerId: string }) {
  const [tab, setTab] = useState<Tab>("Payers");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const flash = (kind: "ok" | "err", text: string) => { setMsg({ kind, text }); setTimeout(() => setMsg(null), 6000); };

  return (
    <div className="space-y-4">
      {!configured && (
        <div className="rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-200 px-3 py-2 text-sm">
          Stedi is not fully configured. You can manage your payer directory and fee schedule now; enrollment, claim submission and remittance polling require your Stedi API key in Settings → External Integrations.
        </div>
      )}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 ${tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{t}</button>
        ))}
      </div>
      {msg && <div className={`rounded-md px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>{msg.text}</div>}

      {tab === "Payers" && <PayersTab flash={flash} />}
      {tab === "Enrollment" && <EnrollmentTab flash={flash} configured={configured} />}
      {tab === "Fee Schedule" && <FeeScheduleTab flash={flash} />}
      {tab === "Claims" && <ClaimsTab flash={flash} configured={configured} />}
      {tab === "Remittances" && <RemittancesTab flash={flash} configured={configured} />}
    </div>
  );
}

/* ---------------- Payers ---------------- */
function PayersTab({ flash }: { flash: (k: "ok" | "err", t: string) => void }) {
  const [payers, setPayers] = useState<Payer[]>([]);
  const [form, setForm] = useState({ name: "", stediId: "", supportsEligibility: true, supportsClaims: true, supportsRemittance: false });
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const load = useCallback(async () => { const r = await fetch("/api/stedi/payers"); if (r.ok) setPayers((await r.json()).payers || []); }, []);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/stedi/payers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await r.json(); if (!r.ok) return flash("err", d.error || "Failed");
    setForm({ name: "", stediId: "", supportsEligibility: true, supportsClaims: true, supportsRemittance: false }); flash("ok", "Payer saved"); load();
  }
  async function del(id: string) { if (!confirm("Delete payer?")) return; await fetch(`/api/stedi/payers?id=${id}`, { method: "DELETE" }); load(); }
  async function search() {
    const r = await fetch(`/api/stedi/payers?stedi=${encodeURIComponent(q)}`); const d = await r.json();
    if (d.error) return flash("err", d.error); setResults(d.results || []);
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <h3 className="font-semibold text-slate-800 mb-2">Payer directory</h3>
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Stedi ID</th><th className="px-3 py-2">Txns</th><th /></tr></thead>
            <tbody>
              {payers.length === 0 && <tr><td colSpan={4} className="px-3 py-3 text-center text-slate-400">No payers yet.</td></tr>}
              {payers.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-700">{p.name}</td>
                  <td className="px-3 py-2 text-slate-500">{p.stediId || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{[p.supportsEligibility && "Elig", p.supportsClaims && "Claims", p.supportsRemittance && "ERA"].filter(Boolean).join(" · ")}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => del(p.id)} className="text-xs text-rose-600 hover:underline">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-4">
        <form onSubmit={save} className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h4 className="text-sm font-semibold text-slate-700">Add payer</h4>
          <input className="input" placeholder="Payer name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Stedi payer ID (tradingPartnerServiceId)" value={form.stediId} onChange={(e) => setForm({ ...form, stediId: e.target.value })} />
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <label className="inline-flex items-center gap-1"><input type="checkbox" checked={form.supportsEligibility} onChange={(e) => setForm({ ...form, supportsEligibility: e.target.checked })} /> Eligibility</label>
            <label className="inline-flex items-center gap-1"><input type="checkbox" checked={form.supportsClaims} onChange={(e) => setForm({ ...form, supportsClaims: e.target.checked })} /> Claims</label>
            <label className="inline-flex items-center gap-1"><input type="checkbox" checked={form.supportsRemittance} onChange={(e) => setForm({ ...form, supportsRemittance: e.target.checked })} /> Remittance</label>
          </div>
          <button className="btn-primary w-full" type="submit">Save payer</button>
        </form>
        <div className="rounded-lg border border-slate-200 p-3 space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Search Stedi payers</h4>
          <div className="flex gap-2">
            <input className="input" placeholder="e.g. aetna" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="button" onClick={search} className="btn-secondary whitespace-nowrap">Search</button>
          </div>
          <ul className="max-h-48 overflow-auto text-sm divide-y divide-slate-100">
            {results.map((r, i) => (
              <li key={i} className="flex items-center justify-between py-1">
                <span className="text-slate-700">{r.displayName || r.name} <span className="text-xs text-slate-400">{r.stediId || r.payerId}</span></span>
                <button className="text-xs text-brand-700 hover:underline" onClick={() => setForm({ ...form, name: r.displayName || r.name, stediId: r.stediId || r.payerId || "" })}>Use</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Enrollment ---------------- */
function EnrollmentTab({ flash, configured }: { flash: (k: "ok" | "err", t: string) => void; configured: boolean }) {
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [form, setForm] = useState({ payerIdOrAlias: "", payerName: "", eligibility: true, claims: true, claimPayment: true, submit: false });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch("/api/stedi/enrollments"), fetch("/api/stedi/payers")]);
    if (a.ok) setRows((await a.json()).enrollments || []);
    if (b.ok) setPayers((await b.json()).payers || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await fetch("/api/stedi/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payerIdOrAlias: form.payerIdOrAlias, payerName: form.payerName, transactions: { eligibility: form.eligibility, claims: form.claims, claimPayment: form.claimPayment }, submit: form.submit }) });
      const d = await r.json(); if (!r.ok || d.error) return flash("err", d.error || "Enrollment failed");
      flash("ok", "Enrollment created"); load();
    } finally { setBusy(false); }
  }
  async function refresh(id: string) { const r = await fetch(`/api/stedi/enrollments/${id}/refresh`); const d = await r.json(); if (d.error) flash("err", d.error); else flash("ok", `Status: ${d.enrollment.status}`); load(); }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <h3 className="font-semibold text-slate-800 mb-2">Payer enrollments <span className="text-xs font-normal text-slate-400">(transaction enrollment, not clinical credentialing)</span></h3>
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th className="px-3 py-2">Payer</th><th className="px-3 py-2">Txns</th><th className="px-3 py-2">Status</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-3 text-center text-slate-400">No enrollments yet.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{r.payerName || r.payerId}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{Object.keys(r.transactions || {}).join(", ")}</td>
                  <td className="px-3 py-2"><span className="chip bg-slate-100 text-slate-700 ring-1 ring-slate-200">{r.status}</span></td>
                  <td className="px-3 py-2 text-right">{r.stediEnrollmentId && <button onClick={() => refresh(r.id)} className="text-xs text-brand-700 hover:underline">Refresh</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <form onSubmit={create} className="space-y-2 rounded-lg border border-slate-200 p-3 self-start">
        <h4 className="text-sm font-semibold text-slate-700">New enrollment</h4>
        <select className="input" value={form.payerIdOrAlias} onChange={(e) => { const p = payers.find((x) => (x.stediId || "") === e.target.value); setForm({ ...form, payerIdOrAlias: e.target.value, payerName: p?.name || form.payerName }); }}>
          <option value="">Select payer (or type ID below)</option>
          {payers.filter((p) => p.stediId).map((p) => <option key={p.id} value={p.stediId!}>{p.name} ({p.stediId})</option>)}
        </select>
        <input className="input" placeholder="Payer ID / alias" value={form.payerIdOrAlias} onChange={(e) => setForm({ ...form, payerIdOrAlias: e.target.value })} required />
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.checked })} /> Eligibility</label>
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={form.claims} onChange={(e) => setForm({ ...form, claims: e.target.checked })} /> Claims</label>
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={form.claimPayment} onChange={(e) => setForm({ ...form, claimPayment: e.target.checked })} /> ERA/Payment</label>
        </div>
        <label className="inline-flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={form.submit} onChange={(e) => setForm({ ...form, submit: e.target.checked })} /> Submit to Stedi now (else save as draft)</label>
        <button className="btn-primary w-full" disabled={busy || !configured} type="submit">{busy ? "Creating…" : "Create enrollment"}</button>
      </form>
    </div>
  );
}

/* ---------------- Fee Schedule ---------------- */
function FeeScheduleTab({ flash }: { flash: (k: "ok" | "err", t: string) => void }) {
  const [items, setItems] = useState<FeeItem[]>([]);
  const [form, setForm] = useState({ code: "", description: "", feeDollars: "", modifier: "" });
  const load = useCallback(async () => { const r = await fetch("/api/stedi/fee-schedule"); if (r.ok) setItems((await r.json()).items || []); }, []);
  useEffect(() => { load(); }, [load]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/stedi/fee-schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await r.json(); if (!r.ok) return flash("err", d.error || "Failed");
    setForm({ code: "", description: "", feeDollars: "", modifier: "" }); flash("ok", "Code saved"); load();
  }
  async function del(id: string) { if (!confirm("Delete code?")) return; await fetch(`/api/stedi/fee-schedule?id=${id}`, { method: "DELETE" }); load(); }
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <h3 className="font-semibold text-slate-800 mb-2">CPT / HCPCS fee schedule</h3>
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Fee</th><th /></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={4} className="px-3 py-3 text-center text-slate-400">No codes yet.</td></tr>}
              {items.map((it) => (
                <tr key={it.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-slate-700">{it.code}{it.modifier ? `-${it.modifier}` : ""}</td>
                  <td className="px-3 py-2 text-slate-600">{it.description}</td>
                  <td className="px-3 py-2 text-right">{money(it.feeCents)}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => del(it.id)} className="text-xs text-rose-600 hover:underline">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <form onSubmit={save} className="space-y-2 rounded-lg border border-slate-200 p-3 self-start">
        <h4 className="text-sm font-semibold text-slate-700">Add / update code</h4>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="CPT code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="input" placeholder="Modifier (opt)" value={form.modifier} onChange={(e) => setForm({ ...form, modifier: e.target.value })} />
        </div>
        <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <input className="input" type="number" step="0.01" placeholder="Fee (USD)" value={form.feeDollars} onChange={(e) => setForm({ ...form, feeDollars: e.target.value })} />
        <button className="btn-primary w-full" type="submit">Save code</button>
      </form>
    </div>
  );
}

/* ---------------- Claims ---------------- */
function ClaimsTab({ flash, configured }: { flash: (k: "ok" | "err", t: string) => void; configured: boolean }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [busy, setBusy] = useState<string>("");
  const load = useCallback(async () => { const r = await fetch("/api/stedi/claims"); if (r.ok) setClaims((await r.json()).claims || []); }, []);
  useEffect(() => { load(); }, [load]);
  async function submit(id: string) { setBusy(id + "s"); try { const r = await fetch(`/api/stedi/claims/${id}/submit`, { method: "POST" }); const d = await r.json(); if (d.error) flash("err", d.error); else flash("ok", "Claim submitted (acceptance ≠ payment)"); load(); } finally { setBusy(""); } }
  async function status(id: string) { setBusy(id + "t"); try { const r = await fetch(`/api/stedi/claims/${id}/status`); const d = await r.json(); if (d.error) flash("err", d.error); else flash("ok", "Status refreshed"); load(); } finally { setBusy(""); } }
  return (
    <div>
      <h3 className="font-semibold text-slate-800 mb-2">Claims</h3>
      <p className="text-xs text-slate-400 mb-2">Create a claim from an encounter on the Billing page ("Create claim"). A successful submission is not payment.</p>
      <div className="overflow-hidden rounded-lg border border-slate-100">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th className="px-3 py-2">Control #</th><th className="px-3 py-2">Patient</th><th className="px-3 py-2">Payer</th><th className="px-3 py-2 text-right">Charge</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2">Status</th><th /></tr></thead>
          <tbody>
            {claims.length === 0 && <tr><td colSpan={7} className="px-3 py-3 text-center text-slate-400">No claims yet.</td></tr>}
            {claims.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs text-slate-600">{c.patientControlNumber}</td>
                <td className="px-3 py-2 text-slate-700">{c.patientName || "—"}</td>
                <td className="px-3 py-2 text-slate-500">{c.payerName || c.payerId || "—"}</td>
                <td className="px-3 py-2 text-right">{money(c.totalChargeCents)}</td>
                <td className="px-3 py-2 text-right">{money(c.paidCents)}</td>
                <td className="px-3 py-2"><span className={`chip ring-1 ${CLAIM_STYLE[c.status] || CLAIM_STYLE.draft}`}>{c.status}</span></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {(c.status === "draft" || c.status === "rejected") && <button disabled={busy !== "" || !configured} onClick={() => submit(c.id)} className="text-xs text-brand-700 hover:underline mr-3">{busy === c.id + "s" ? "…" : "Submit"}</button>}
                  {c.status !== "draft" && <button disabled={busy !== "" || !configured} onClick={() => status(c.id)} className="text-xs text-slate-600 hover:underline">{busy === c.id + "t" ? "…" : "Check status"}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Remittances ---------------- */
function RemittancesTab({ flash, configured }: { flash: (k: "ok" | "err", t: string) => void; configured: boolean }) {
  const [rows, setRows] = useState<Remit[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await fetch("/api/stedi/remittances"); if (r.ok) setRows((await r.json()).remittances || []); }, []);
  useEffect(() => { load(); }, [load]);
  async function poll() { setBusy(true); try { const r = await fetch("/api/stedi/remittances", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); const d = await r.json(); if (d.error) flash("err", d.error); else flash("ok", `Scanned ${d.scanned}, processed ${d.processed} ERA(s)`); load(); } finally { setBusy(false); } }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-slate-800">Remittances (835 / ERA) — payment tracking</h3>
        <button onClick={poll} disabled={busy || !configured} className="btn-secondary">{busy ? "Polling…" : "Poll for payments"}</button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-100">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th className="px-3 py-2">Transaction</th><th className="px-3 py-2">Payer</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2">Matched</th><th className="px-3 py-2">When</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-center text-slate-400">No remittances yet. Click “Poll for payments”.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.transactionId}</td>
                <td className="px-3 py-2 text-slate-600">{r.payerName || "—"}</td>
                <td className="px-3 py-2 text-right font-medium text-emerald-700">{money(r.totalPaidCents)}</td>
                <td className="px-3 py-2 text-slate-500">{(r.matchedClaims || []).length} claim(s)</td>
                <td className="px-3 py-2 text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
