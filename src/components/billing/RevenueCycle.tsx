"use client";

import React, { useCallback, useEffect, useState } from "react";

type Payer = { id: string; name: string; stediId?: string | null; supportsEligibility: boolean; supportsClaims: boolean; supportsRemittance: boolean; active: boolean };
type Enrollment = { id: string; providerName: string; npi: string; payerId?: string | null; payerName?: string | null; bankAccountId?: string | null; transactions?: any; status: string; stediEnrollmentId?: string | null; createdAt: string };
type FeeItem = { id: string; code: string; description: string; modifier?: string | null; feeCents: number; active: boolean };
type Claim = { id: string; patientControlNumber: string; patientName?: string | null; payerId: string; payerName?: string | null; status: string; statusCategory?: string | null; totalChargeCents: number; paidCents: number; createdAt: string; submitResponse?: any; statusResponse?: any; statusHistory?: any[] };
type Remit = { id: string; transactionId: string; payerName?: string | null; totalPaidCents: number; matchedClaims?: any[]; createdAt: string };
type PriorAuth = {
  id: string; patientId: string; patientName?: string | null; payerId?: string | null; payerName?: string | null;
  memberId?: string | null; serviceType?: string | null; cptCodes?: string | null; diagnosisCodes?: string | null;
  units?: number | null; startDate?: string | null; endDate?: string | null; status: string; authNumber?: string | null;
  authRequired?: string | null; lastCheckedAt?: string | null; notes?: string | null; createdAt: string;
};

const TABS = ["Prior Auth", "Claims", "Denials", "Remittances", "Enrollment", "Payers", "Fee Schedule"] as const;
type Tab = (typeof TABS)[number];

const money = (c: number) => `$${((c || 0) / 100).toFixed(2)}`;
const CLAIM_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200", submitted: "bg-blue-100 text-blue-800 ring-blue-200",
  accepted: "bg-indigo-100 text-indigo-800 ring-indigo-200", rejected: "bg-rose-100 text-rose-800 ring-rose-200",
  paid: "bg-emerald-100 text-emerald-800 ring-emerald-200", denied: "bg-rose-100 text-rose-800 ring-rose-200",
};
const PA_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200", pending: "bg-amber-100 text-amber-800 ring-amber-200",
  submitted: "bg-blue-100 text-blue-800 ring-blue-200", approved: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  denied: "bg-rose-100 text-rose-800 ring-rose-200", expired: "bg-slate-200 text-slate-600 ring-slate-300",
};
const ENROLL_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200", STEDI_ACTION_REQUIRED: "bg-amber-100 text-amber-800 ring-amber-200",
  PROVIDER_ACTION_REQUIRED: "bg-amber-100 text-amber-800 ring-amber-200", PROVISIONING: "bg-blue-100 text-blue-800 ring-blue-200",
  LIVE: "bg-emerald-100 text-emerald-800 ring-emerald-200", REJECTED: "bg-rose-100 text-rose-800 ring-rose-200",
  CANCELED: "bg-slate-200 text-slate-600 ring-slate-300",
};

type Flash = (k: "ok" | "err", t: string) => void;

export default function RevenueCycle({ configured, defaultPayerId, baseUrl, webhookConfigured }: { configured: boolean; defaultPayerId: string; baseUrl?: string; webhookConfigured?: boolean }) {
  const [tab, setTab] = useState<Tab>("Prior Auth");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const flash: Flash = (kind, text) => { setMsg({ kind, text }); setTimeout(() => setMsg(null), 6000); };

  return (
    <div className="space-y-4">
      {!configured && (
        <div className="rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-200 px-3 py-2 text-sm">
          Stedi is not fully configured. You can manage your payer directory, fee schedule and prior-auth tracker now; enrollment, claim submission, status and remittances require your Stedi API key in Settings → External Integrations.
        </div>
      )}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 ${tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{t}</button>
        ))}
      </div>
      {msg && <div className={`rounded-md px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>{msg.text}</div>}

      {tab === "Prior Auth" && <PriorAuthTab flash={flash} configured={configured} defaultPayerId={defaultPayerId} />}
      {tab === "Claims" && <ClaimsTab flash={flash} configured={configured} />}
      {tab === "Denials" && <DenialsTab flash={flash} configured={configured} />}
      {tab === "Remittances" && <RemittancesTab flash={flash} configured={configured} baseUrl={baseUrl || ""} webhookConfigured={Boolean(webhookConfigured)} />}
      {tab === "Enrollment" && <EnrollmentTab flash={flash} configured={configured} />}
      {tab === "Payers" && <PayersTab flash={flash} />}
      {tab === "Fee Schedule" && <FeeScheduleTab flash={flash} />}
    </div>
  );
}

/* ---------------- Prior Authorization (278 tracker) ---------------- */
const EMPTY_PA = { id: "", patientId: "", patientName: "", payerId: "", payerName: "", memberId: "", serviceType: "", cptCodes: "", diagnosisCodes: "", units: "", startDate: "", endDate: "", status: "draft", authNumber: "", notes: "" };

function PriorAuthTab({ flash, configured, defaultPayerId }: { flash: Flash; configured: boolean; defaultPayerId: string }) {
  const [rows, setRows] = useState<PriorAuth[]>([]);
  const [form, setForm] = useState<any>({ ...EMPTY_PA, payerId: defaultPayerId || "" });
  const [pq, setPq] = useState("");
  const [pResults, setPResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState("");

  const load = useCallback(async () => { const r = await fetch("/api/prior-auth"); if (r.ok) setRows((await r.json()).requests || []); }, []);
  useEffect(() => { load(); }, [load]);

  async function searchPatient() {
    if (!pq.trim()) return;
    const r = await fetch(`/api/patients/search?q=${encodeURIComponent(pq)}&limit=8`);
    if (r.ok) setPResults((await r.json()).results || []);
  }
  function pickPatient(p: any) {
    setForm({ ...form, patientId: p.id, patientName: `${p.lastName}, ${p.firstName}` });
    setPResults([]); setPq(`${p.lastName}, ${p.firstName}`);
  }
  function edit(r: PriorAuth) {
    setForm({
      id: r.id, patientId: r.patientId, patientName: r.patientName || "", payerId: r.payerId || "", payerName: r.payerName || "",
      memberId: r.memberId || "", serviceType: r.serviceType || "", cptCodes: r.cptCodes || "", diagnosisCodes: r.diagnosisCodes || "",
      units: r.units ?? "", startDate: r.startDate ? r.startDate.slice(0, 10) : "", endDate: r.endDate ? r.endDate.slice(0, 10) : "",
      status: r.status || "draft", authNumber: r.authNumber || "", notes: r.notes || "",
    });
    setPq(r.patientName || "");
  }
  function reset() { setForm({ ...EMPTY_PA, payerId: defaultPayerId || "" }); setPq(""); setPResults([]); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId) return flash("err", "Select a patient first.");
    setBusy(true);
    try {
      const r = await fetch("/api/prior-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json(); if (!r.ok || d.error) return flash("err", d.error || "Save failed");
      flash("ok", form.id ? "Authorization updated" : "Authorization saved"); reset(); load();
    } finally { setBusy(false); }
  }
  async function del(id: string) { if (!confirm("Delete this authorization request?")) return; await fetch(`/api/prior-auth?id=${id}`, { method: "DELETE" }); load(); }

  async function checkRequired(r: PriorAuth) {
    setChecking(r.id);
    try {
      const resp = await fetch("/api/prior-auth/check-required", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id }) });
      const d = await resp.json();
      if (d.error) flash("err", d.error);
      else flash(d.auth?.required === "required" ? "err" : "ok", d.auth?.detail || "Checked");
      load();
    } finally { setChecking(""); }
  }

  const authBadge = (v?: string | null) => {
    if (v === "required") return <span className="chip bg-rose-100 text-rose-800 ring-1 ring-rose-200">Auth required</span>;
    if (v === "not_required") return <span className="chip bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200">Not required</span>;
    if (v === "unknown") return <span className="chip bg-amber-100 text-amber-800 ring-1 ring-amber-200">Unknown</span>;
    return <span className="text-xs text-slate-400">—</span>;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-sky-50 text-sky-800 ring-1 ring-sky-200 px-3 py-2 text-xs">
        <strong>Prior authorization (278).</strong> Stedi does not offer electronic 278 submission, so this is a tracker: use <em>“Check if required”</em> to detect (via a live eligibility check) whether the payer requires authorization, obtain the auth from the payer portal/phone, then record the authorization number and dates here so it is linked to the patient chart and claims.
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {/* List */}
        <div>
          <h3 className="font-semibold text-slate-800 mb-2">Authorization requests</h3>
          <div className="space-y-2">
            {rows.length === 0 && <p className="text-sm text-slate-400">No authorization requests yet.</p>}
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium text-slate-800">{r.patientName || "—"}</span>
                    <span className={`ml-2 chip ring-1 ${PA_STYLE[r.status] || PA_STYLE.draft}`}>{r.status}</span>
                    {r.authNumber && <span className="ml-2 font-mono text-xs text-slate-500">Auth #{r.authNumber}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => edit(r)} className="text-xs text-brand-700 hover:underline">Edit</button>
                    <button onClick={() => del(r.id)} className="text-xs text-rose-600 hover:underline">Delete</button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                  <span>{r.payerName || r.payerId || "No payer"}</span>
                  {r.serviceType && <span>Service: {r.serviceType}</span>}
                  {r.cptCodes && <span>CPT: {r.cptCodes}</span>}
                  {(r.startDate || r.endDate) && <span>{r.startDate?.slice(0, 10)} → {r.endDate?.slice(0, 10) || "…"}</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {authBadge(r.authRequired)}
                  <button disabled={!configured || checking === r.id} onClick={() => checkRequired(r)} className="btn-secondary py-1 px-2 text-xs">{checking === r.id ? "Checking…" : "Check if required"}</button>
                  {r.lastCheckedAt && <span className="text-[11px] text-slate-400">checked {new Date(r.lastCheckedAt).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Form */}
        <form onSubmit={save} className="space-y-2 rounded-lg border border-slate-200 p-3 self-start">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">{form.id ? "Edit authorization" : "New authorization"}</h4>
            {form.id && <button type="button" onClick={reset} className="text-xs text-slate-500 hover:underline">Clear</button>}
          </div>
          {/* Patient search */}
          <div className="relative">
            <div className="flex gap-2">
              <input className="input" placeholder="Search patient (name / MRN / DOB)" value={pq} onChange={(e) => setPq(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchPatient(); } }} />
              <button type="button" onClick={searchPatient} className="btn-secondary whitespace-nowrap">Find</button>
            </div>
            {pResults.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-md border border-slate-200 bg-white text-sm shadow">
                {pResults.map((p) => (
                  <li key={p.id}><button type="button" onClick={() => pickPatient(p)} className="block w-full px-3 py-1.5 text-left hover:bg-slate-50">{p.lastName}, {p.firstName} <span className="text-xs text-slate-400">{p.mrn} · {p.dob ? new Date(p.dob).toLocaleDateString() : ""}</span></button></li>
                ))}
              </ul>
            )}
          </div>
          {form.patientId && <p className="text-xs text-emerald-700">Patient: {form.patientName}</p>}
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Payer ID" value={form.payerId} onChange={(e) => setForm({ ...form, payerId: e.target.value })} />
            <input className="input" placeholder="Payer name" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} />
          </div>
          <input className="input" placeholder="Member ID" value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} />
          <input className="input" placeholder="Service (e.g. MRI lumbar, PT eval)" value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="CPT/HCPCS (comma sep)" value={form.cptCodes} onChange={(e) => setForm({ ...form, cptCodes: e.target.value })} />
            <input className="input" placeholder="ICD-10 (comma sep)" value={form.diagnosisCodes} onChange={(e) => setForm({ ...form, diagnosisCodes: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input className="input" type="number" placeholder="Units" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} />
            <input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {["draft", "pending", "submitted", "approved", "denied", "expired"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="input" placeholder="Auth number" value={form.authNumber} onChange={(e) => setForm({ ...form, authNumber: e.target.value })} />
          </div>
          <textarea className="input" rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button className="btn-primary w-full" disabled={busy} type="submit">{busy ? "Saving…" : form.id ? "Update authorization" : "Save authorization"}</button>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Claims (with status history) ---------------- */
function ClaimsTab({ flash, configured }: { flash: Flash; configured: boolean }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [open, setOpen] = useState<string>("");
  const load = useCallback(async () => { const r = await fetch("/api/stedi/claims"); if (r.ok) setClaims((await r.json()).claims || []); }, []);
  useEffect(() => { load(); }, [load]);
  async function submit(id: string) { setBusy(id + "s"); try { const r = await fetch(`/api/stedi/claims/${id}/submit`, { method: "POST" }); const d = await r.json(); if (d.error) flash("err", d.error); else flash("ok", "Claim submitted (acceptance ≠ payment)"); load(); } finally { setBusy(""); } }
  async function status(id: string) { setBusy(id + "t"); try { const r = await fetch(`/api/stedi/claims/${id}/status`); const d = await r.json(); if (d.error) flash("err", d.error); else flash("ok", `Status: ${d.summary?.statusText || "refreshed"}`); load(); } finally { setBusy(""); } }
  return (
    <div>
      <h3 className="font-semibold text-slate-800 mb-2">Claims & status tracking (837P · 276/277)</h3>
      <p className="text-xs text-slate-400 mb-2">Create a claim from an encounter on the Billing page ("Create claim"). Submit sends the 837P; "Check status" runs a live 276/277 and records the payer's 277 response over time. A successful submission is not payment.</p>
      <div className="overflow-hidden rounded-lg border border-slate-100">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th className="px-3 py-2">Control #</th><th className="px-3 py-2">Patient</th><th className="px-3 py-2">Payer</th><th className="px-3 py-2 text-right">Charge</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2">Status</th><th /></tr></thead>
          <tbody>
            {claims.length === 0 && <tr><td colSpan={7} className="px-3 py-3 text-center text-slate-400">No claims yet.</td></tr>}
            {claims.map((c) => {
              const hist = Array.isArray(c.statusHistory) ? c.statusHistory : [];
              return (
                <React.Fragment key={c.id}>
                  <tr className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{c.patientControlNumber}</td>
                    <td className="px-3 py-2 text-slate-700">{c.patientName || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{c.payerName || c.payerId || "—"}</td>
                    <td className="px-3 py-2 text-right">{money(c.totalChargeCents)}</td>
                    <td className="px-3 py-2 text-right">{money(c.paidCents)}</td>
                    <td className="px-3 py-2">
                      <span className={`chip ring-1 ${CLAIM_STYLE[c.status] || CLAIM_STYLE.draft}`}>{c.status}</span>
                      {c.statusCategory && <span className="ml-1 text-[11px] text-slate-400">{c.statusCategory}</span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {hist.length > 0 && <button onClick={() => setOpen(open === c.id ? "" : c.id)} className="text-xs text-slate-500 hover:underline mr-3">{open === c.id ? "Hide" : `History (${hist.length})`}</button>}
                      <a href={`/api/stedi/claims/${c.id}/superbill`} target="_blank" rel="noreferrer" className="text-xs text-slate-600 hover:underline mr-3">Superbill</a>
                      {(c.status === "draft" || c.status === "rejected") && <button disabled={busy !== "" || !configured} onClick={() => submit(c.id)} className="text-xs text-brand-700 hover:underline mr-3">{busy === c.id + "s" ? "…" : "Submit"}</button>}
                      {c.status !== "draft" && <button disabled={busy !== "" || !configured} onClick={() => status(c.id)} className="text-xs text-slate-600 hover:underline">{busy === c.id + "t" ? "…" : "Check status"}</button>}
                    </td>
                  </tr>
                  {open === c.id && (
                    <tr className="bg-slate-50/60"><td colSpan={7} className="px-3 py-2">
                      <div className="text-xs text-slate-600 space-y-1">
                        <div className="font-semibold text-slate-700">Claim status history (276/277)</div>
                        {hist.map((h: any, i: number) => (
                          <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-slate-200 py-1 first:border-0">
                            <span className="text-slate-400">{new Date(h.at).toLocaleString()}</span>
                            <span className="font-medium text-slate-700">{h.category}</span>
                            {h.statusCode && <span className="font-mono text-slate-400">{h.statusCode}</span>}
                            <span>{h.statusText}</span>
                            {h.paidCents != null && h.paidCents > 0 && <span className="text-emerald-700">{money(h.paidCents)}</span>}
                            {h.claimNumber && <span className="text-slate-400">Payer #{h.claimNumber}</span>}
                          </div>
                        ))}
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Denials ---------------- */
function reasonOf(c: Claim): string {
  const pick = (o: any): string => {
    if (!o) return "";
    if (typeof o === "string") return o.slice(0, 240);
    const errs = o.errors || o.error || o.claimStatuses || o.claimStatus || o.status || o.ediErrors;
    if (errs) return (typeof errs === "string" ? errs : JSON.stringify(errs)).slice(0, 240);
    return JSON.stringify(o).slice(0, 200);
  };
  return pick(c.statusResponse) || pick(c.submitResponse) || "No reason returned yet — run Check status.";
}

function DenialsTab({ flash, configured }: { flash: Flash; configured: boolean }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    const r = await fetch("/api/stedi/claims");
    if (r.ok) setClaims(((await r.json()).claims || []).filter((c: Claim) => c.status === "rejected" || c.status === "denied"));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveAndResubmit(c: Claim) {
    setBusy(c.id);
    try {
      const newPayer = edit[c.id];
      if (newPayer && newPayer !== c.payerId) {
        const pr = await fetch(`/api/stedi/claims/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payerId: newPayer }) });
        if (!pr.ok) { const d = await pr.json(); flash("err", d.error || "Update failed"); return; }
      } else {
        await fetch(`/api/stedi/claims/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      }
      const sr = await fetch(`/api/stedi/claims/${c.id}/submit`, { method: "POST" });
      const sd = await sr.json();
      if (sd.error) flash("err", sd.error); else flash("ok", "Corrected & resubmitted");
      load();
    } finally { setBusy(""); }
  }

  return (
    <div>
      <h3 className="font-semibold text-slate-800 mb-1">Denials & rejections worklist</h3>
      <p className="text-xs text-slate-400 mb-3">Fix the payer or details and resubmit. Editing a denied claim returns it to draft before resubmitting.</p>
      {claims.length === 0 ? (
        <p className="text-sm text-slate-400">No denied or rejected claims. 🎉</p>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <div key={c.id} className="rounded-lg border border-rose-200 bg-rose-50/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-mono text-xs text-slate-500">{c.patientControlNumber}</span>
                  <span className="ml-2 font-medium text-slate-800">{c.patientName || "—"}</span>
                  <span className={`ml-2 chip ring-1 ${CLAIM_STYLE[c.status]}`}>{c.status}</span>
                </div>
                <a href={`/api/stedi/claims/${c.id}/superbill`} target="_blank" rel="noreferrer" className="text-xs text-slate-600 hover:underline">Superbill</a>
              </div>
              <div className="mt-1 text-xs text-rose-700"><span className="font-semibold">Reason: </span>{reasonOf(c)}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="text-xs text-slate-500">Payer ID</label>
                <input className="input max-w-[180px] py-1" defaultValue={c.payerId} onChange={(e) => setEdit({ ...edit, [c.id]: e.target.value })} />
                <button disabled={busy !== "" || !configured} onClick={() => saveAndResubmit(c)} className="btn-primary py-1 px-3 text-sm">{busy === c.id ? "Working…" : "Correct & resubmit"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Remittances (835 / ERA) with webhook auto-posting ---------------- */
function RemittancesTab({ flash, configured, baseUrl, webhookConfigured }: { flash: Flash; configured: boolean; baseUrl: string; webhookConfigured: boolean }) {
  const [rows, setRows] = useState<Remit[]>([]);
  const [busy, setBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const webhookUrl = `${(baseUrl || "").replace(/\/$/, "")}/api/stedi/webhook`;
  const load = useCallback(async () => { const r = await fetch("/api/stedi/remittances"); if (r.ok) setRows((await r.json()).remittances || []); }, []);
  useEffect(() => { load(); }, [load]);
  async function poll() { setBusy(true); try { const r = await fetch("/api/stedi/remittances", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); const d = await r.json(); if (d.error) flash("err", d.error); else flash("ok", `Scanned ${d.scanned}, processed ${d.processed} ERA(s)`); load(); } finally { setBusy(false); } }
  const copy = (t: string) => { navigator.clipboard?.writeText(t).then(() => flash("ok", "Copied"), () => {}); };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800">Remittances (835 / ERA) — auto-posted to the ledger</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSetup((v) => !v)} className="btn-secondary">{showSetup ? "Hide setup" : "Webhook setup"}</button>
          <button onClick={poll} disabled={busy || !configured} className="btn-secondary">{busy ? "Polling…" : "Poll now"}</button>
        </div>
      </div>

      <div className={`rounded-md px-3 py-2 text-xs ring-1 ${webhookConfigured ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>
        {webhookConfigured
          ? "Real-time ERA webhook is configured. Incoming 835 payments are received and auto-posted to the patient ledger automatically. Use “Poll now” only to backfill."
          : "Real-time ERA webhook is NOT configured. Payments are only picked up when you click “Poll now”. Add a Webhook Secret in Settings → External Integrations and configure the webhook (see setup) for automatic posting."}
      </div>

      {showSetup && (
        <div className="rounded-lg border border-slate-200 p-3 text-sm space-y-2">
          <h4 className="font-semibold text-slate-700">Configure real-time 835/ERA delivery</h4>
          <ol className="list-decimal pl-5 text-xs text-slate-600 space-y-1">
            <li>In <strong>Settings → External Integrations → Stedi</strong>, set a long random <strong>ERA Webhook Secret</strong> and save.</li>
            <li>In <strong>Stedi → Developer settings → Webhooks</strong>, create a <strong>POST</strong> destination to the URL below.</li>
            <li>Add a credential set with a custom header <code className="bg-slate-100 px-1 rounded">x-stedi-webhook-secret</code> whose value is your webhook secret.</li>
            <li>Add a <strong>Transaction processed</strong> binding filtered to <strong>835 — Health Care Claim Payment/Advice</strong>.</li>
            <li>Save. New ERAs post to the correct patient ledgers automatically (idempotent — no double posting).</li>
          </ol>
          <div className="flex items-center gap-2">
            <input readOnly className="input font-mono text-xs" value={webhookUrl} />
            <button type="button" onClick={() => copy(webhookUrl)} className="btn-secondary whitespace-nowrap">Copy URL</button>
          </div>
          <div className="flex items-center gap-2">
            <input readOnly className="input font-mono text-xs" value="x-stedi-webhook-secret" />
            <button type="button" onClick={() => copy("x-stedi-webhook-secret")} className="btn-secondary whitespace-nowrap">Copy header</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-100">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th className="px-3 py-2">Transaction</th><th className="px-3 py-2">Payer</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2">Matched</th><th className="px-3 py-2">When</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-center text-slate-400">No remittances yet. They arrive via webhook, or click “Poll now”.</td></tr>}
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

/* ---------------- Enrollment ---------------- */
function EnrollmentTab({ flash, configured }: { flash: Flash; configured: boolean }) {
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState({ payerIdOrAlias: "", payerName: "", bankAccountId: "", eligibility: true, claims: true, claimPayment: true, submit: false });
  const [busy, setBusy] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([fetch("/api/stedi/enrollments"), fetch("/api/stedi/payers"), fetch("/api/billing/bank-accounts")]);
    if (a.ok) setRows((await a.json()).enrollments || []);
    if (b.ok) setPayers((await b.json()).payers || []);
    if (c.ok) setAccounts((await c.json()).accounts || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const verifiedAccounts = accounts.filter((a) => a.verificationStatus === "verified");
  const acctLabel = (id?: string | null) => accounts.find((a) => a.id === id)?.label || null;

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await fetch("/api/stedi/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payerIdOrAlias: form.payerIdOrAlias, payerName: form.payerName, bankAccountId: form.bankAccountId || undefined, transactions: { eligibility: form.eligibility, claims: form.claims, claimPayment: form.claimPayment }, submit: form.submit }) });
      const d = await r.json(); if (!r.ok || d.error) return flash("err", d.error || "Enrollment failed");
      flash("ok", form.submit ? "Enrollment submitted to Stedi" : "Enrollment draft created"); load();
    } finally { setBusy(false); }
  }
  async function refresh(id: string) { const r = await fetch(`/api/stedi/enrollments/${id}/refresh`); const d = await r.json(); if (d.error) flash("err", d.error); else flash("ok", `Status: ${d.enrollment.status}`); load(); }
  async function refreshAll() {
    setRefreshingAll(true);
    try {
      const targets = rows.filter((r) => r.stediEnrollmentId);
      for (const r of targets) { await fetch(`/api/stedi/enrollments/${r.id}/refresh`).catch(() => {}); }
      flash("ok", `Refreshed ${targets.length} enrollment(s)`); load();
    } finally { setRefreshingAll(false); }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-800">Payer enrollments <span className="text-xs font-normal text-slate-400">(transaction enrollment)</span></h3>
          {rows.some((r) => r.stediEnrollmentId) && <button onClick={refreshAll} disabled={refreshingAll} className="text-xs text-brand-700 hover:underline">{refreshingAll ? "Refreshing…" : "Refresh all"}</button>}
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400"><tr><th className="px-3 py-2">Payer</th><th className="px-3 py-2">Txns</th><th className="px-3 py-2">Deposit acct</th><th className="px-3 py-2">Status</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-center text-slate-400">No enrollments yet.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{r.payerName || r.payerId}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{Object.keys(r.transactions || {}).join(", ")}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{acctLabel(r.bankAccountId) || "—"}</td>
                  <td className="px-3 py-2"><span className={`chip ring-1 ${ENROLL_STYLE[r.status] || ENROLL_STYLE.DRAFT}`}>{r.status}</span></td>
                  <td className="px-3 py-2 text-right">{r.stediEnrollmentId && <button onClick={() => refresh(r.id)} className="text-xs text-brand-700 hover:underline">Refresh</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Lifecycle: DRAFT → STEDI_ACTION_REQUIRED → PROVISIONING → <span className="text-emerald-600 font-medium">LIVE</span>. ERA (835) enrollment is required before payments can be received; wait for LIVE. Manage deposit accounts under Billing → Bank &amp; EFT.</p>
      </div>
      <form onSubmit={create} className="space-y-2 rounded-lg border border-slate-200 p-3 self-start">
        <h4 className="text-sm font-semibold text-slate-700">New enrollment</h4>
        <select className="input" value={form.payerIdOrAlias} onChange={(e) => { const p = payers.find((x) => (x.stediId || "") === e.target.value); setForm({ ...form, payerIdOrAlias: e.target.value, payerName: p?.name || form.payerName }); }}>
          <option value="">Select payer (or type ID below)</option>
          {payers.filter((p) => p.stediId).map((p) => <option key={p.id} value={p.stediId!}>{p.name} ({p.stediId})</option>)}
        </select>
        <input className="input" placeholder="Payer ID / alias" value={form.payerIdOrAlias} onChange={(e) => setForm({ ...form, payerIdOrAlias: e.target.value })} required />
        <input className="input" placeholder="Payer name (optional)" value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} />
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.checked })} /> Eligibility</label>
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={form.claims} onChange={(e) => setForm({ ...form, claims: e.target.checked })} /> Claims</label>
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={form.claimPayment} onChange={(e) => setForm({ ...form, claimPayment: e.target.checked })} /> ERA/Payment</label>
        </div>
        {form.claimPayment && (
          <div>
            <label className="text-xs text-slate-500">Deposit account for ERA payments</label>
            <select className="input" value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}>
              <option value="">— None selected —</option>
              {verifiedAccounts.map((a) => <option key={a.id} value={a.id}>{a.label}{a.accountMasked ? ` (${a.accountMasked})` : ""}</option>)}
            </select>
            {verifiedAccounts.length === 0
              ? <p className="mt-1 text-[11px] text-amber-600">No <strong>verified</strong> deposit account. Add & verify one under Billing → Bank &amp; EFT so payer EFT/ERA deposits land in the right account.</p>
              : <p className="mt-1 text-[11px] text-slate-400">Only verified accounts are listed. Deposits are set up with the payer; this links the account for reconciliation.</p>}
          </div>
        )}
        <label className="inline-flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={form.submit} onChange={(e) => setForm({ ...form, submit: e.target.checked })} /> Submit to Stedi now (else save as draft)</label>
        <button className="btn-primary w-full" disabled={busy || !configured} type="submit">{busy ? "Creating…" : "Create enrollment"}</button>
      </form>
    </div>
  );
}

/* ---------------- Payers ---------------- */
function PayersTab({ flash }: { flash: Flash }) {
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

/* ---------------- Fee Schedule ---------------- */
function FeeScheduleTab({ flash }: { flash: Flash }) {
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
