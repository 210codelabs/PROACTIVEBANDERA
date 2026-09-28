"use client";

import { useState } from "react";

const STATUSES = ["intake", "treating", "negotiating", "settled", "closed"];
const DOC_CATS = ["intake", "medical", "billing", "correspondence", "court", "other"];
const money = (c: number | null | undefined) =>
  c == null ? "—" : "$" + (c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LegalCaseWorkspace({ caseId, initial }: { caseId: string; initial: any }) {
  const [data, setData] = useState<any>(initial);
  const [tab, setTab] = useState<"overview" | "documents" | "liens" | "deliverables">("overview");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const r = await fetch(`/api/legal-cases/${caseId}`);
    if (r.ok) setData((await r.json()).case);
  }
  async function patch(body: any) {
    setBusy(true);
    await fetch(`/api/legal-cases/${caseId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    await refresh();
    setBusy(false);
  }

  const tabs = [
    ["overview", "Overview & tracking"],
    ["documents", `Documents (${data.documents?.length || 0})`],
    ["liens", `Liens & offers (${data.offers?.length || 0})`],
    ["deliverables", `Deliverables (${data.deliverables?.length || 0})`],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 transition ${tab === k ? "border-amber-500 text-amber-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview data={data} busy={busy} patch={patch} caseId={caseId} refresh={refresh} />}
      {tab === "documents" && <Documents data={data} caseId={caseId} refresh={refresh} />}
      {tab === "liens" && <Liens data={data} caseId={caseId} refresh={refresh} patch={patch} />}
      {tab === "deliverables" && <Deliverables data={data} caseId={caseId} refresh={refresh} />}
    </div>
  );
}

function Overview({ data, busy, patch, caseId, refresh }: any) {
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<"note" | "notification">("note");
  async function addNote() {
    if (!note.trim()) return;
    await fetch(`/api/legal-cases/${caseId}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: note, type: noteType }) });
    setNote(""); await refresh();
  }
  const hasPip = !!(data.pipInsurerName || data.pipPolicyNumber || data.pipClaimNumber || data.pipMedLimit);
  const relLabel: Record<string, string> = { self: "Self (insured)", passenger: "Passenger", pedestrian: "Pedestrian", "other-driver": "Other driver", other: "Other" };
  return (
    <div className="space-y-4">
      {data.legalNA && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Legal / Attorney details marked Not Applicable at registration.</span> Complete the case type, attorney, claim and court fields below when the information is available.
        </div>
      )}
      {(hasPip || data.pipNA) && (
        <div className="card card-pad space-y-3 border-amber-200 bg-amber-50/60">
          <div className="flex items-center gap-2">
            <span className="chip bg-amber-500 text-white ring-amber-500 text-[11px] font-semibold">PIP</span>
            <h3 className="font-semibold text-amber-900">Personal Injury Protection — auto insurer to bill</h3>
            {data.pipNA && <span className="chip bg-slate-200 text-slate-600 ring-slate-300 text-[11px]">Not Applicable</span>}
          </div>
          {data.pipNA ? (
            <p className="text-xs text-amber-800">Marked Not Applicable at registration. Add the auto insurer and PIP policy details here when available — new claims will then auto-route to that insurer.</p>
          ) : (
          <>
          <p className="text-xs text-amber-800">
            This patient&apos;s own auto policy (PIP / MedPay) is billed first, regardless of fault. New claims for this patient auto-route to this insurer as the primary payer.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <Info label="Auto insurer (PIP)" value={data.pipInsurerName} />
            <Info label="Payer ID" value={data.pipInsurerPayerId || (data.pipInsurerName ? "Manual (no payer ID)" : null)} />
            <Info label="PIP / MedPay limit" value={data.pipMedLimit} />
            <Info label="Policy number" value={data.pipPolicyNumber} />
            <Info label="PIP claim number" value={data.pipClaimNumber} />
            <Info label="Policyholder / insured" value={data.pipInsuredName} />
            <Info label="Relationship to insured" value={data.pipRelation ? (relLabel[data.pipRelation] || data.pipRelation) : null} />
          </div>
          </>
          )}
        </div>
      )}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card card-pad space-y-3">
        <h3 className="font-semibold text-slate-900">Case status</h3>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button key={s} disabled={busy} onClick={() => patch({ status: s })}
              className={`chip capitalize ${data.status === s ? "bg-amber-500 text-white ring-amber-500" : "bg-white text-slate-600 ring-slate-200 hover:ring-amber-300"}`}>{s}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm pt-2">
          <Info label="Case type" value={String(data.caseType || "").replace(/_/g, " ")} />
          <Info label="Case / claim #" value={data.caseNumber} />
          <Info label="Court" value={data.court} />
          <Info label="Date of injury" value={data.dateOfInjury ? new Date(data.dateOfInjury).toLocaleDateString() : "—"} />
          <Info label="Attorney" value={data.attorney?.name} />
          <Info label="Law firm" value={data.attorney?.firm || data.lawFirm} />
          <Info label="Adjuster" value={data.adjuster} />
          <Info label="Defendant insurer" value={data.defendantInsurer} />
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="font-semibold text-slate-900 mb-2">Add note / notification</h3>
        <div className="flex gap-2 mb-2">
          <select value={noteType} onChange={(e) => setNoteType(e.target.value as any)} className="input w-40">
            <option value="note">Note</option>
            <option value="notification">Notification</option>
          </select>
          <input className="input flex-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an update to the case timeline…" />
          <button onClick={addNote} className="btn-primary">Add</button>
        </div>
        <h4 className="text-xs font-semibold text-slate-500 mt-3 mb-1">Timeline</h4>
        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {(data.events || []).length === 0 && <li className="text-sm text-slate-400">No activity yet.</li>}
          {(data.events || []).map((e: any) => (
            <li key={e.id} className="text-sm border-l-2 border-slate-200 pl-3">
              <div className="flex items-center gap-2">
                <span className={`chip text-[10px] capitalize ${e.type === "notification" ? "bg-blue-100 text-blue-700 ring-blue-200" : e.type === "offer" ? "bg-emerald-100 text-emerald-700 ring-emerald-200" : e.type === "stage" ? "bg-amber-100 text-amber-800 ring-amber-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{e.type}</span>
                <span className="text-slate-800">{e.title}</span>
              </div>
              {e.detail && <div className="text-slate-500 text-xs mt-0.5">{e.detail}</div>}
              <div className="text-[10px] text-slate-400">{new Date(e.createdAt).toLocaleString()}{e.actor ? ` · ${e.actor}` : ""}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
    </div>
  );
}

function Documents({ data, caseId, refresh }: any) {
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("medical");
  const [err, setErr] = useState("");
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setUploading(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] || "");
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await fetch(`/api/legal-cases/${caseId}/documents`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, category, mimeType: file.type, size: file.size, dataBase64: b64 }),
      });
      const j = await resp.json();
      if (!resp.ok) setErr(j.error || "Upload failed");
      else await refresh();
    } finally { setUploading(false); e.target.value = ""; }
  }
  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input w-48 capitalize">
          {DOC_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="btn-primary cursor-pointer">
          {uploading ? "Uploading…" : "Upload document"}
          <input type="file" className="hidden" onChange={onFile} disabled={uploading} />
        </label>
        {err && <span className="text-sm text-rose-600">{err}</span>}
        <span className="text-xs text-slate-400">Stored securely · max ~9MB</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {(data.documents || []).length === 0 && <li className="text-sm text-slate-400 py-2">No documents uploaded.</li>}
        {(data.documents || []).map((d: any) => (
          <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <a href={`/api/legal-cases/${caseId}/documents/${d.id}`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline truncate">{d.name}</a>
              <div className="text-[11px] text-slate-400"><span className="capitalize">{d.category}</span> · {(d.size / 1024).toFixed(0)} KB · {new Date(d.createdAt).toLocaleDateString()}{d.uploadedBy ? ` · ${d.uploadedBy}` : ""}</div>
            </div>
            <a href={`/api/legal-cases/${caseId}/documents/${d.id}`} target="_blank" rel="noreferrer" className="chip bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200">Open</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Liens({ data, caseId, refresh, patch }: any) {
  const [amount, setAmount] = useState("");
  const [party, setParty] = useState("clinic");
  const [kind, setKind] = useState("offer");
  const [note, setNote] = useState("");
  const [lien, setLien] = useState(data.lienAmountCents != null ? String(data.lienAmountCents / 100) : "");
  async function addOffer() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    await fetch(`/api/legal-cases/${caseId}/offers`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: amt, party, kind, note }) });
    setAmount(""); setNote(""); await refresh();
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card card-pad space-y-3">
        <h3 className="font-semibold text-slate-900">Medical lien</h3>
        <div className="flex items-end gap-2">
          <label className="block flex-1">
            <span className="label">Lien amount (USD)</span>
            <input className="input" type="number" step="0.01" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="0.00" />
          </label>
          <button className="btn-primary" onClick={() => patch({ lienAmount: parseFloat(lien) || 0 })}>Save lien</button>
        </div>
        <div className="text-sm text-slate-500">Current lien on file: <span className="font-semibold text-slate-800">{money(data.lienAmountCents)}</span></div>

        <h3 className="font-semibold text-slate-900 pt-3">Add offer / counter-offer</h3>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={party} onChange={(e) => setParty(e.target.value)}><option value="clinic">Clinic</option><option value="attorney">Attorney</option><option value="insurer">Insurer</option></select>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}><option value="offer">Offer</option><option value="counter">Counter-offer</option><option value="acceptance">Acceptance</option></select>
          <input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (USD)" />
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
        </div>
        <button className="btn-primary w-full" onClick={addOffer}>Record</button>
      </div>

      <div className="card card-pad">
        <h3 className="font-semibold text-slate-900 mb-2">Negotiation ledger</h3>
        <ul className="space-y-2">
          {(data.offers || []).length === 0 && <li className="text-sm text-slate-400">No offers recorded.</li>}
          {(data.offers || []).map((o: any) => (
            <li key={o.id} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm">
              <div>
                <span className={`chip capitalize mr-2 ${o.kind === "counter" ? "bg-amber-100 text-amber-800 ring-amber-200" : o.kind === "acceptance" ? "bg-emerald-100 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{o.kind}</span>
                <span className="capitalize text-slate-600">{o.party}</span>
                {o.note && <div className="text-xs text-slate-400 mt-0.5">{o.note}</div>}
                <div className="text-[10px] text-slate-400">{new Date(o.createdAt).toLocaleString()}{o.createdBy ? ` · ${o.createdBy}` : ""}</div>
              </div>
              <div className="font-semibold text-slate-900">{money(o.amountCents)}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Deliverables({ data, caseId, refresh }: any) {
  const [title, setTitle] = useState("");
  async function add() {
    if (!title.trim()) return;
    await fetch(`/api/legal-cases/${caseId}/deliverables`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) });
    setTitle(""); await refresh();
  }
  async function toggle(id: string, done: boolean) {
    await fetch(`/api/legal-cases/${caseId}/deliverables`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ deliverableId: id, done }) });
    await refresh();
  }
  return (
    <div className="card card-pad max-w-2xl">
      <div className="flex gap-2 mb-3">
        <input className="input flex-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Send medical records to attorney" />
        <button className="btn-primary" onClick={add}>Add</button>
      </div>
      <ul className="space-y-1.5">
        {(data.deliverables || []).length === 0 && <li className="text-sm text-slate-400">No deliverables yet.</li>}
        {(data.deliverables || []).map((d: any) => (
          <li key={d.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.done} onChange={(e) => toggle(d.id, e.target.checked)} className="h-4 w-4" />
            <span className={d.done ? "line-through text-slate-400" : "text-slate-800"}>{d.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="font-medium text-slate-800 capitalize">{value || "—"}</div>
    </div>
  );
}
