"use client";

import React, { useCallback, useEffect, useState } from "react";

type Account = { id: string; label: string; bankName?: string | null; accountHolder?: string | null; accountType: string; isDefault: boolean; routingMasked?: string | null; accountMasked?: string | null };
type Enrollment = { id: string; payerId?: string | null; payerName: string; enrollmentType: string; bankAccountId?: string | null; status: string; effectiveDate?: string | null; traceNumber?: string | null; notes?: string | null };

const STATUS_STYLE: Record<string, string> = {
  not_started: "bg-slate-200 text-slate-700 ring-slate-300",
  submitted: "bg-sky-100 text-sky-800 ring-sky-200",
  pending: "bg-amber-100 text-amber-800 ring-amber-200",
  active: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  rejected: "bg-rose-100 text-rose-800 ring-rose-200",
  cancelled: "bg-slate-200 text-slate-500 ring-slate-300",
};
const TYPES = ["eft", "era", "claims"];
const STATUSES = ["not_started", "submitted", "pending", "active", "rejected", "cancelled"];

export default function BankEft() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [acctForm, setAcctForm] = useState<any | null>(null);
  const [enrForm, setEnrForm] = useState<any | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, e] = await Promise.all([
      fetch("/api/billing/bank-accounts").then((r) => (r.ok ? r.json() : { accounts: [] })).catch(() => ({ accounts: [] })),
      fetch("/api/billing/eft-enrollments").then((r) => (r.ok ? r.json() : { enrollments: [] })).catch(() => ({ enrollments: [] })),
    ]);
    setAccounts(a.accounts || []);
    setEnrollments(e.enrollments || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveAcct() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/billing/bank-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(acctForm) });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Save failed."); return; }
      setAcctForm(null); await load();
    } catch { setMsg("Network error."); } finally { setBusy(false); }
  }
  async function delAcct(id: string) { if (!confirm("Remove this bank account?")) return; await fetch(`/api/billing/bank-accounts?id=${id}`, { method: "DELETE" }); await load(); }

  async function saveEnr() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/billing/eft-enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(enrForm) });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Save failed."); return; }
      setEnrForm(null); await load();
    } catch { setMsg("Network error."); } finally { setBusy(false); }
  }
  async function delEnr(id: string) { if (!confirm("Delete this enrollment record?")) return; await fetch(`/api/billing/eft-enrollments?id=${id}`, { method: "DELETE" }); await load(); }

  return (
    <div className="space-y-4">
      {msg && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{msg}</div>}

      {/* Bank accounts */}
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div><h2 className="font-semibold text-slate-900">Bank accounts (payer deposits)</h2><p className="text-xs text-slate-500">Account &amp; routing numbers are stored securely and shown masked. Deposits arrive via each payer&apos;s EFT — the app does not move money.</p></div>
          <button onClick={() => setAcctForm({ accountType: "checking", isDefault: accounts.length === 0 })} className="btn-primary py-1 px-3 text-sm">+ Add account</button>
        </header>
        <div className="p-4">
          {accounts.length === 0 ? <p className="text-sm text-slate-500">No bank accounts configured.</p> : (
            <table className="data w-full"><thead><tr><th>Label</th><th>Bank</th><th>Holder</th><th>Type</th><th>Routing</th><th>Account</th><th></th></tr></thead>
              <tbody>{accounts.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium text-slate-900">{a.label}{a.isDefault && <span className="chip ml-2 bg-emerald-100 text-emerald-800 ring-emerald-200">default</span>}</td>
                  <td>{a.bankName || "—"}</td><td>{a.accountHolder || "—"}</td><td className="capitalize">{a.accountType}</td>
                  <td className="font-mono text-xs">{a.routingMasked || "—"}</td><td className="font-mono text-xs">{a.accountMasked || "—"}</td>
                  <td className="text-right whitespace-nowrap"><button onClick={() => setAcctForm({ id: a.id, label: a.label, bankName: a.bankName || "", accountHolder: a.accountHolder || "", accountType: a.accountType, isDefault: a.isDefault })} className="text-xs font-semibold text-brand-700 hover:underline mr-3">Edit</button><button onClick={() => delAcct(a.id)} className="text-xs font-semibold text-rose-600 hover:underline">Remove</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>

      {/* EFT / ERA enrollments */}
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div><h2 className="font-semibold text-slate-900">Payer EFT / ERA enrollments</h2><p className="text-xs text-slate-500">Track EFT (deposit) and ERA (835) enrollment status per payer. ERA remittances reconcile to the patient ledger automatically once received.</p></div>
          <button onClick={() => setEnrForm({ enrollmentType: "eft", status: "not_started" })} className="btn-primary py-1 px-3 text-sm">+ Add enrollment</button>
        </header>
        <div className="p-4">
          {enrollments.length === 0 ? <p className="text-sm text-slate-500">No enrollments tracked yet.</p> : (
            <table className="data w-full"><thead><tr><th>Payer</th><th>Type</th><th>Bank</th><th>Status</th><th>Effective</th><th>Trace #</th><th></th></tr></thead>
              <tbody>{enrollments.map((e) => (
                <tr key={e.id}>
                  <td className="font-medium text-slate-900">{e.payerName}{e.payerId ? <span className="ml-1 font-mono text-[11px] text-slate-400">{e.payerId}</span> : ""}</td>
                  <td className="uppercase text-xs">{e.enrollmentType}</td>
                  <td>{accounts.find((a) => a.id === e.bankAccountId)?.label || "—"}</td>
                  <td><span className={`chip ring-1 ${STATUS_STYLE[e.status] || STATUS_STYLE.not_started}`}>{e.status.replace("_", " ")}</span></td>
                  <td className="text-xs">{e.effectiveDate ? new Date(e.effectiveDate).toLocaleDateString() : "—"}</td>
                  <td className="font-mono text-xs">{e.traceNumber || "—"}</td>
                  <td className="text-right whitespace-nowrap"><button onClick={() => setEnrForm({ id: e.id, payerId: e.payerId || "", payerName: e.payerName, enrollmentType: e.enrollmentType, bankAccountId: e.bankAccountId || "", status: e.status, effectiveDate: e.effectiveDate ? String(e.effectiveDate).slice(0, 10) : "", traceNumber: e.traceNumber || "", notes: e.notes || "" })} className="text-xs font-semibold text-brand-700 hover:underline mr-3">Edit</button><button onClick={() => delEnr(e.id)} className="text-xs font-semibold text-rose-600 hover:underline">Delete</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>

      {/* Bank account modal */}
      {acctForm && (
        <Modal title={acctForm.id ? "Edit bank account" : "Add bank account"} onClose={() => setAcctForm(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label" v={acctForm.label} on={(v) => setAcctForm({ ...acctForm, label: v })} />
            <Field label="Bank name" v={acctForm.bankName} on={(v) => setAcctForm({ ...acctForm, bankName: v })} />
            <Field label="Account holder" v={acctForm.accountHolder} on={(v) => setAcctForm({ ...acctForm, accountHolder: v })} />
            <label className="block text-sm"><span className="label">Account type</span><select className="input" value={acctForm.accountType} onChange={(e) => setAcctForm({ ...acctForm, accountType: e.target.value })}><option value="checking">Checking</option><option value="savings">Savings</option></select></label>
            <Field label={acctForm.id ? "Routing # (leave blank to keep)" : "Routing # (9 digits)"} v={acctForm.routingNumber || ""} on={(v) => setAcctForm({ ...acctForm, routingNumber: v })} />
            <Field label={acctForm.id ? "Account # (leave blank to keep)" : "Account #"} v={acctForm.accountNumber || ""} on={(v) => setAcctForm({ ...acctForm, accountNumber: v })} />
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!acctForm.isDefault} onChange={(e) => setAcctForm({ ...acctForm, isDefault: e.target.checked })} /> Set as default deposit account</label>
          </div>
          <Footer onClose={() => setAcctForm(null)} onSave={saveAcct} busy={busy} />
        </Modal>
      )}

      {/* Enrollment modal */}
      {enrForm && (
        <Modal title={enrForm.id ? "Edit enrollment" : "Add enrollment"} onClose={() => setEnrForm(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payer name" v={enrForm.payerName || ""} on={(v) => setEnrForm({ ...enrForm, payerName: v })} />
            <Field label="Payer ID (Stedi)" v={enrForm.payerId || ""} on={(v) => setEnrForm({ ...enrForm, payerId: v })} />
            <label className="block text-sm"><span className="label">Type</span><select className="input" value={enrForm.enrollmentType} onChange={(e) => setEnrForm({ ...enrForm, enrollmentType: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></label>
            <label className="block text-sm"><span className="label">Bank account</span><select className="input" value={enrForm.bankAccountId || ""} onChange={(e) => setEnrForm({ ...enrForm, bankAccountId: e.target.value })}><option value="">—</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
            <label className="block text-sm"><span className="label">Status</span><select className="input" value={enrForm.status} onChange={(e) => setEnrForm({ ...enrForm, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></label>
            <Field label="Effective date" type="date" v={enrForm.effectiveDate || ""} on={(v) => setEnrForm({ ...enrForm, effectiveDate: v })} />
            <Field label="Trace / confirmation #" v={enrForm.traceNumber || ""} on={(v) => setEnrForm({ ...enrForm, traceNumber: v })} />
            <label className="block text-sm col-span-2"><span className="label">Notes</span><textarea className="input min-h-[60px]" value={enrForm.notes || ""} onChange={(e) => setEnrForm({ ...enrForm, notes: e.target.value })} /></label>
          </div>
          <Footer onClose={() => setEnrForm(null)} onSave={saveEnr} busy={busy} />
        </Modal>
      )}
    </div>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return <label className="block text-sm"><span className="label">{label}</span><input type={type} className="input" value={v} onChange={(e) => on(e.target.value)} /></label>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <header className="px-4 py-3 border-b border-slate-200 font-semibold flex items-center justify-between"><span>{title}</span><button onClick={onClose} className="text-slate-500">✕</button></header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
function Footer({ onClose, onSave, busy }: { onClose: () => void; onSave: () => void; busy: boolean }) {
  return <div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={onSave} disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save"}</button></div>;
}
