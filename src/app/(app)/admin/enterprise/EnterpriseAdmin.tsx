"use client";

import React, { useCallback, useEffect, useState } from "react";

type Svc = { key: string; label: string; category: string; priceCents: number };
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const RESULTS = ["pending", "pass", "fail", "inconclusive", "na"];
const STATUSES = ["requested", "scheduled", "in_progress", "completed", "cancelled"];

export default function EnterpriseAdmin({ catalog }: { catalog: Svc[] }) {
  const [tab, setTab] = useState<"accounts" | "requests" | "invoices">("accounts");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const loadAccounts = useCallback(() => fetch("/api/admin/enterprise/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts || [])), []);
  const loadRequests = useCallback(() => fetch("/api/admin/enterprise/requests").then((r) => r.json()).then((d) => setRequests(d.requests || [])), []);
  const loadInvoices = useCallback(() => fetch("/api/admin/enterprise/invoices").then((r) => r.json()).then((d) => setInvoices(d.invoices || [])), []);
  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { if (tab === "requests") loadRequests(); if (tab === "invoices") { loadInvoices(); loadAccounts(); } }, [tab, loadRequests, loadInvoices, loadAccounts]);

  // New account form
  const [showNew, setShowNew] = useState(false);
  const [na, setNa] = useState<any>({ companyName: "", industry: "", contactName: "", contactEmail: "", contactPhone: "", city: "", state: "", billingEmail: "", netTerms: 30, adminFirstName: "", adminLastName: "", adminEmail: "", adminPassword: "" });
  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/enterprise/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...na, netTerms: Number(na.netTerms) || 30 }) });
    const d = await r.json();
    if (!r.ok) { flash(d.error || "Failed"); return; }
    setShowNew(false); setNa({ companyName: "", industry: "", contactName: "", contactEmail: "", contactPhone: "", city: "", state: "", billingEmail: "", netTerms: 30, adminFirstName: "", adminLastName: "", adminEmail: "", adminPassword: "" });
    await loadAccounts(); flash("Enterprise account created with portal login.");
  }
  async function toggleStatus(a: any) {
    await fetch(`/api/admin/enterprise/accounts/${a.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: a.status === "active" ? "inactive" : "active" }) });
    await loadAccounts();
  }
  async function addUser(a: any) {
    const email = window.prompt(`New portal login email for ${a.companyName}:`); if (!email) return;
    const first = window.prompt("First name:") || "User"; const last = window.prompt("Last name:") || ""; const pw = window.prompt("Temporary password (min 6):") || "";
    const r = await fetch("/api/admin/enterprise/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enterpriseId: a.id, email, firstName: first, lastName: last, password: pw }) });
    const d = await r.json(); if (!r.ok) { flash(d.error || "Failed"); return; } await loadAccounts(); flash("Portal user added.");
  }

  async function updateRequest(id: string, patch: any) {
    await fetch(`/api/admin/enterprise/requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    await loadRequests();
  }

  // Invoice builder
  const [inv, setInv] = useState<any>({ enterpriseId: "", dueDate: "", taxCents: 0, notes: "", lineItems: [{ desc: "", qty: 1, unitCents: 0 }] });
  function setLine(i: number, k: string, v: any) { setInv((p: any) => ({ ...p, lineItems: p.lineItems.map((l: any, idx: number) => idx === i ? { ...l, [k]: v } : l) })); }
  const invSubtotal = inv.lineItems.reduce((s: number, l: any) => s + Math.round((Number(l.qty) || 0) * (Number(l.unitCents) || 0)), 0);
  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!inv.enterpriseId) { flash("Select a client"); return; }
    const body = { enterpriseId: inv.enterpriseId, dueDate: inv.dueDate || null, taxCents: Number(inv.taxCents) || 0, notes: inv.notes, status: "sent", lineItems: inv.lineItems.map((l: any) => ({ desc: l.desc, qty: Number(l.qty) || 0, unitCents: Math.round(Number(l.unitCents) || 0) })) };
    const r = await fetch("/api/admin/enterprise/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json(); if (!r.ok) { flash(d.error || "Failed"); return; }
    setInv({ enterpriseId: "", dueDate: "", taxCents: 0, notes: "", lineItems: [{ desc: "", qty: 1, unitCents: 0 }] }); await loadInvoices(); flash("Invoice created & sent.");
  }
  async function markInvoice(id: string, status: string) { await fetch(`/api/admin/enterprise/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); await loadInvoices(); }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200">
        {([["accounts", "Accounts"], ["requests", "Requests"], ["invoices", "Billing"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-1.5 text-sm font-medium rounded-md ${tab === k ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}>{l}</button>
        ))}
      </div>

      {tab === "accounts" && (
        <div className="space-y-3">
          <button onClick={() => setShowNew((v) => !v)} className="btn-primary">{showNew ? "Close" : "+ New enterprise account"}</button>
          {showNew && (
            <form onSubmit={createAccount} className="card card-pad grid grid-cols-2 md:grid-cols-3 gap-3">
              <label className="text-sm"><span className="label">Company *</span><input className="input" value={na.companyName} onChange={(e) => setNa({ ...na, companyName: e.target.value })} required /></label>
              <label className="text-sm"><span className="label">Industry</span><input className="input" value={na.industry} onChange={(e) => setNa({ ...na, industry: e.target.value })} /></label>
              <label className="text-sm"><span className="label">Net terms (days)</span><input type="number" className="input" value={na.netTerms} onChange={(e) => setNa({ ...na, netTerms: e.target.value })} /></label>
              <label className="text-sm"><span className="label">Contact name</span><input className="input" value={na.contactName} onChange={(e) => setNa({ ...na, contactName: e.target.value })} /></label>
              <label className="text-sm"><span className="label">Contact email</span><input className="input" value={na.contactEmail} onChange={(e) => setNa({ ...na, contactEmail: e.target.value })} /></label>
              <label className="text-sm"><span className="label">Billing email</span><input className="input" value={na.billingEmail} onChange={(e) => setNa({ ...na, billingEmail: e.target.value })} /></label>
              <div className="col-span-2 md:col-span-3 border-t border-slate-100 pt-2 text-xs font-semibold text-slate-500 uppercase">Portal admin login</div>
              <label className="text-sm"><span className="label">First name *</span><input className="input" value={na.adminFirstName} onChange={(e) => setNa({ ...na, adminFirstName: e.target.value })} required /></label>
              <label className="text-sm"><span className="label">Last name *</span><input className="input" value={na.adminLastName} onChange={(e) => setNa({ ...na, adminLastName: e.target.value })} required /></label>
              <label className="text-sm"><span className="label">Login email *</span><input type="email" className="input" value={na.adminEmail} onChange={(e) => setNa({ ...na, adminEmail: e.target.value })} required /></label>
              <label className="text-sm"><span className="label">Temp password *</span><input className="input" value={na.adminPassword} onChange={(e) => setNa({ ...na, adminPassword: e.target.value })} required /></label>
              <div className="col-span-2 md:col-span-3"><button className="btn-primary">Create account + login</button></div>
            </form>
          )}
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="card card-pad">
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-slate-900">{a.companyName}</div>
                  <span className={`chip ${a.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{a.status}</span>
                  <span className="text-xs text-slate-400">{a.requestCount} requests · Net {a.netTerms}</span>
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => addUser(a)} className="chip bg-white ring-1 ring-slate-200 text-xs">+ Portal user</button>
                    <button onClick={() => toggleStatus(a)} className="chip bg-white ring-1 ring-slate-200 text-xs">{a.status === "active" ? "Deactivate" : "Activate"}</button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500">{[a.industry, a.contactName, a.contactEmail, a.billingEmail].filter(Boolean).join(" · ")}</div>
                <div className="mt-1 text-[11px] text-slate-400">Logins: {(a.users || []).map((u: any) => u.email).join(", ") || "none"}</div>
              </div>
            ))}
            {accounts.length === 0 && <p className="text-sm text-slate-400">No enterprise accounts yet.</p>}
          </div>
        </div>
      )}

      {tab === "requests" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Company</th><th className="text-left px-3 py-2">Employee</th><th className="text-left px-3 py-2">Service</th><th className="text-left px-3 py-2">Status</th><th className="text-left px-3 py-2">Result</th><th className="text-left px-3 py-2">Summary</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-slate-700">{r.companyName}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{r.employeeLastName}, {r.employeeFirstName}{r.patientId && <a href={`/patients/${r.patientId}/demographics`} className="ml-1 text-[10px] text-brand-600">chart</a>}</td>
                  <td className="px-3 py-2 text-slate-600">{r.serviceLabel}</td>
                  <td className="px-3 py-2"><select className="input py-1 text-xs" value={r.status} onChange={(e) => updateRequest(r.id, { status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></td>
                  <td className="px-3 py-2"><select className="input py-1 text-xs" value={r.resultStatus} onChange={(e) => updateRequest(r.id, { resultStatus: e.target.value })}>{RESULTS.map((s) => <option key={s} value={s}>{s}</option>)}</select></td>
                  <td className="px-3 py-2"><input className="input py-1 text-xs" defaultValue={r.resultSummary || ""} onBlur={(e) => e.target.value !== (r.resultSummary || "") && updateRequest(r.id, { resultSummary: e.target.value })} placeholder="Result note (visible to employer)" /></td>
                </tr>
              ))}
              {requests.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No requests.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "invoices" && (
        <div className="grid md:grid-cols-2 gap-4">
          <form onSubmit={createInvoice} className="card card-pad space-y-2">
            <h3 className="font-semibold text-slate-900">New invoice</h3>
            <select className="input" value={inv.enterpriseId} onChange={(e) => setInv({ ...inv, enterpriseId: e.target.value })}><option value="">Select client…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.companyName}</option>)}</select>
            {inv.lineItems.map((l: any, i: number) => (
              <div key={i} className="flex gap-1">
                <input className="input flex-1" placeholder="Description" value={l.desc} onChange={(e) => setLine(i, "desc", e.target.value)} />
                <input className="input w-14" type="number" value={l.qty} onChange={(e) => setLine(i, "qty", e.target.value)} />
                <input className="input w-24" type="number" placeholder="cents" value={l.unitCents} onChange={(e) => setLine(i, "unitCents", e.target.value)} />
              </div>
            ))}
            <div className="flex justify-between text-sm"><button type="button" onClick={() => setInv((p: any) => ({ ...p, lineItems: [...p.lineItems, { desc: "", qty: 1, unitCents: 0 }] }))} className="chip bg-white ring-1 ring-slate-200 text-xs">+ line</button><span className="font-semibold">Subtotal {money(invSubtotal)}</span></div>
            <div className="flex gap-2"><label className="text-sm flex-1"><span className="label">Due date</span><input type="date" className="input" value={inv.dueDate} onChange={(e) => setInv({ ...inv, dueDate: e.target.value })} /></label><label className="text-sm w-28"><span className="label">Tax (cents)</span><input type="number" className="input" value={inv.taxCents} onChange={(e) => setInv({ ...inv, taxCents: e.target.value })} /></label></div>
            <button className="btn-primary w-full">Create & send invoice</button>
          </form>
          <div className="card overflow-hidden">
            <table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Invoice</th><th className="text-left px-3 py-2">Client</th><th className="text-right px-3 py-2">Total</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((i) => (
                  <tr key={i.id}><td className="px-3 py-2 font-mono text-xs">{i.number}</td><td className="px-3 py-2 text-slate-700">{i.companyName}</td><td className="px-3 py-2 text-right font-semibold">{money(i.totalCents)}</td><td className="px-3 py-2"><select className="input py-1 text-xs" value={i.status} onChange={(e) => markInvoice(i.id, e.target.value)}>{["draft", "sent", "paid", "void"].map((s) => <option key={s} value={s}>{s}</option>)}</select></td></tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No invoices.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-slate-900 text-white text-sm px-4 py-2 shadow-lg">{toast}</div>}
    </div>
  );
}
