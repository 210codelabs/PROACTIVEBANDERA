"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "@/lib/utils";
import RefSelect from "@/components/RefSelect";

// Suggested default fees (USD cents) for common codes; catalog picks without a
// default start at $0 and the clinician can set the fee inline.
const FEE_DEFAULTS: Record<string, number> = {
  "99213": 11500, "99214": 17500, "99215": 25000, "99203": 16000, "99204": 22000,
  "99202": 12000, "99205": 30000, "99211": 6500, "99212": 9000, "99396": 21000,
  "97110": 4500, "97140": 4500, "97530": 5000, "97010": 2500, "97035": 3500,
  "96372": 3800, "90471": 3000, "90472": 1800, "93000": 3500, "36415": 1200,
  "80053": 2200, "85025": 2500, "G0283": 3000, "99490": 6200, "99457": 5100,
};

export default function EncounterEditor({ encounter }: { encounter: any }) {
  const router = useRouter();
  const [chiefComplaint, setCC] = useState(encounter.chiefComplaint || "");
  const [subjective, setS] = useState(encounter.subjective || "");
  const [objective, setO] = useState(encounter.objective || "");
  const [assessment, setA] = useState(encounter.assessment || "");
  const [plan, setP] = useState(encounter.plan || "");
  const [ros, setROS] = useState(encounter.ros || "");
  const [exam, setExam] = useState(encounter.examFindings || "");
  const [diagnoses, setDiagnoses] = useState<any[]>(encounter.diagnoses || []);
  const [charges, setCharges] = useState<any[]>(encounter.charges || []);
  const [saving, setSaving] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [signed, setSigned] = useState(encounter.status === "signed");

  async function importPrevious() {
    setLoadingPrevious(true);
    try {
      const res = await fetch(`/api/encounters/${encounter.id}/previous`);
      if (res.ok) {
        const prev = await res.json();
        if (!chiefComplaint && prev.chiefComplaint) setCC(prev.chiefComplaint);
        if (!subjective && prev.subjective) setS(prev.subjective);
        if (!objective && prev.objective) setO(prev.objective);
        if (!assessment && prev.assessment) setA(prev.assessment);
        if (!plan && prev.plan) setP(prev.plan);
        if (!ros && prev.ros) setROS(prev.ros);
        if (!exam && prev.examFindings) setExam(prev.examFindings);
      } else {
        alert("No previous encounter found.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to import previous values.");
    } finally {
      setLoadingPrevious(false);
    }
  }

  async function save(payload: Partial<{ signed: boolean }> = {}) {
    setSaving(true);
    const res = await fetch(`/api/encounters/${encounter.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chiefComplaint, subjective, objective, assessment, plan, ros, examFindings: exam,
        diagnoses: diagnoses.map(d => ({ icd10: d.icd10, description: d.description, primary: !!d.primary })),
        charges: charges.map(c => ({ cpt: c.cpt, description: c.description, units: c.units || 1, modifier: c.modifier || null, feeCents: c.feeCents || 0 })),
        ...payload,
      }),
    });
    setSaving(false);
    if (payload.signed) setSigned(true);
    router.refresh();
  }

  function addDx(d: { icd10: string; description: string }) {
    if (diagnoses.some(x => x.icd10 === d.icd10)) return;
    setDiagnoses([...diagnoses, { ...d, primary: diagnoses.length === 0 }]);
  }
  function removeDx(i: number) {
    setDiagnoses(diagnoses.filter((_, idx) => idx !== i));
  }
  function setPrimary(i: number) {
    setDiagnoses(diagnoses.map((d, idx) => ({ ...d, primary: idx === i })));
  }
  function addCpt(c: { cpt: string; description: string; feeCents: number }) {
    if (charges.some(x => x.cpt === c.cpt)) return;
    setCharges([...charges, { ...c, units: 1 }]);
  }
  function removeCpt(i: number) {
    setCharges(charges.filter((_, idx) => idx !== i));
  }
  function setUnits(i: number, u: number) {
    setCharges(charges.map((c, idx) => idx === i ? { ...c, units: u } : c));
  }
  function setFee(i: number, dollars: number) {
    setCharges(charges.map((c, idx) => idx === i ? { ...c, feeCents: Math.round((dollars || 0) * 100) } : c));
  }

  const total = charges.reduce((s, c) => s + (c.feeCents * (c.units || 1)), 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* SOAP */}
      <div className="xl:col-span-2 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Clinical Notes</h2>
          {!signed && (
            <button 
              onClick={importPrevious} 
              disabled={loadingPrevious}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-md transition"
            >
              {loadingPrevious ? "Importing..." : "↓ Import previous values, fill the blanks"}
            </button>
          )}
        </div>
        <div className="card card-pad">
          <label className="label">Chief Complaint</label>
          <input className="input" value={chiefComplaint} onChange={e => setCC(e.target.value)} placeholder="e.g., Lower back pain x 2 weeks" disabled={signed} />
        </div>
        <SoapBlock title="Subjective (S)" hint="HPI, history, patient report" value={subjective} onChange={setS} disabled={signed} />
        <SoapBlock title="Review of Systems" value={ros} onChange={setROS} disabled={signed} rows={3} />
        <SoapBlock title="Objective (O)" hint="Vitals, exam, lab/imaging results" value={objective} onChange={setO} disabled={signed} />
        <SoapBlock title="Physical Exam" value={exam} onChange={setExam} disabled={signed} rows={3} />
        <SoapBlock title="Assessment (A)" value={assessment} onChange={setA} disabled={signed} />
        <SoapBlock title="Plan (P)" value={plan} onChange={setP} disabled={signed} />
      </div>

      {/* Right rail: Dx, CPT, Orders */}
      <div className="space-y-3">
        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Diagnoses (ICD-10)</header>
          <div className="p-4 space-y-2">
            {diagnoses.length === 0 && <div className="text-sm text-slate-500 italic">No diagnoses linked yet.</div>}
            {diagnoses.map((d, i) => (
              <div key={d.icd10 + i} className="flex items-center gap-2 text-sm">
                <button type="button" disabled={signed} onClick={() => setPrimary(i)} title="Mark primary" className={`chip ${d.primary ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{d.primary ? "1°" : "—"}</button>
                <span className="font-mono text-xs">{d.icd10}</span>
                <span className="flex-1 truncate">{d.description}</span>
                {!signed && <button onClick={() => removeDx(i)} className="text-rose-500 hover:text-rose-700 text-xs">remove</button>}
              </div>
            ))}
            {!signed && (
              <div>
                <span className="label mt-2">Add diagnosis</span>
                <RefSelect
                  type="diagnosis"
                  label=""
                  name="_dx"
                  showCode
                  placeholder="Search ICD-10 or create new…"
                  onChange={({ code, display, item }) => {
                    if (item) addDx({ icd10: code || display, description: display });
                  }}
                />
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold flex items-center justify-between">
            <span>Charges (CPT)</span>
            <span className="text-sm font-bold text-brand-700">{fmtMoney(total)}</span>
          </header>
          <div className="p-4 space-y-2">
            {charges.length === 0 && <div className="text-sm text-slate-500 italic">No CPT codes yet.</div>}
            {charges.map((c, i) => (
              <div key={c.cpt + i} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs">{c.cpt}</span>
                <span className="flex-1 truncate">{c.description}</span>
                <input type="number" min="1" disabled={signed} value={c.units || 1} onChange={e => setUnits(i, Number(e.target.value) || 1)} className="w-12 text-center input py-0.5" title="Units" />
                {signed ? (
                  <span className="text-xs text-slate-500 w-16 text-right">{fmtMoney(c.feeCents * (c.units || 1))}</span>
                ) : (
                  <div className="flex items-center">
                    <span className="text-xs text-slate-400">$</span>
                    <input type="number" min="0" step="0.01" value={((c.feeCents || 0) / 100).toString()} onChange={e => setFee(i, Number(e.target.value))} className="w-16 text-right input py-0.5" title="Fee (per unit)" />
                  </div>
                )}
                {!signed && <button onClick={() => removeCpt(i)} className="text-rose-500 hover:text-rose-700 text-xs">×</button>}
              </div>
            ))}
            {!signed && (
              <div>
                <span className="label mt-2">Add CPT / HCPCS code</span>
                <RefSelect
                  type="billingCode"
                  label=""
                  name="_cpt"
                  showCode
                  placeholder="Search CPT/HCPCS or create new…"
                  onChange={({ code, display, item }) => {
                    if (item) addCpt({ cpt: code || "", description: display, feeCents: FEE_DEFAULTS[code || ""] ?? 0 });
                  }}
                />
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Linked Orders</header>
          <div className="p-4 space-y-2 text-sm">
            {(encounter.orders || []).length === 0 ? (
              <div className="text-slate-500 italic">No orders for this encounter.</div>
            ) : encounter.orders.map((o: any) => (
              <div key={o.id} className="flex items-center gap-2">
                <span className="chip bg-slate-100 text-slate-700 ring-slate-200 uppercase text-[10px]">{o.type}</span>
                <span className="flex-1 truncate">{o.itemName}{o.rxStrength ? ` ${o.rxStrength}` : ""}</span>
                <span className="text-xs text-slate-500">{o.status}</span>
              </div>
            ))}
            <a href={`/patients/${encounter.patientId}/orders/new?type=rx`} className="btn-secondary w-full">+ Add Rx / Lab / Imaging</a>
          </div>
        </section>

        <div className="card card-pad flex items-center gap-2 sticky bottom-3">
          {!signed && <button onClick={() => save()} disabled={saving} className="btn-secondary flex-1">{saving ? "Saving…" : "Save Draft"}</button>}
          {!signed && <button onClick={() => save({ signed: true })} disabled={saving} className="btn-primary flex-1">Sign & Lock</button>}
          {signed && <div className="text-sm text-emerald-700 font-semibold">✓ Note signed and locked.</div>}
        </div>
      </div>
    </div>
  );
}

function SoapBlock({ title, hint, value, onChange, disabled, rows = 6 }: { title: string; hint?: string; value: string; onChange: (v: string) => void; disabled?: boolean; rows?: number }) {
  return (
    <section className="card card-pad">
      <div className="flex items-baseline justify-between">
        <label className="label">{title}</label>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      <textarea
        className="input font-mono text-[13px] leading-relaxed"
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
      />
    </section>
  );
}
