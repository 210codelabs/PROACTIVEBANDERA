"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PharmacyPicker, { type Pharmacy } from "@/components/orders/PharmacyPicker";
import RefSelect from "@/components/RefSelect";

const LAB_PICKS = ["CBC w/ differential", "CMP (Comp Metabolic Panel)", "Lipid panel", "HbA1c", "TSH", "UA w/ reflex culture", "Wound culture"];
const IMG_PICKS = ["X-ray, knee, 3 views", "MRI lumbar spine w/o contrast", "X-ray, chest 2 views", "Ultrasound, soft tissue"];

export default function NewOrderForm({ patientId, initialType, encounterId }: { patientId: string; initialType: string; encounterId?: string }) {
  const router = useRouter();
  const [type, setType] = useState(initialType);
  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [form, setForm] = useState("");
  const [route, setRoute] = useState("");
  const [frequency, setFrequency] = useState("");
  const [sig, setSig] = useState("");
  const [qty, setQty] = useState("");
  const [refills, setRefills] = useState("0");
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState("routine");
  const [diag, setDiag] = useState("");
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const body: any = { type, itemName: name, priority, instructions, diagnosisCode: diag };
    if (encounterId) body.encounterId = encounterId;
    if (type === "rx") {
      body.rxStrength = strength;
      body.rxForm = form;
      body.rxRoute = route;
      body.rxFrequency = frequency;
      // Compose Sig from route + frequency when the clinician hasn't typed a custom one.
      body.rxSig = sig || [route, frequency].filter(Boolean).join(" ").trim();
      body.rxQty = qty;
      body.rxRefills = Number(refills) || 0;
      if (pharmacy) body.pharmacyId = pharmacy.id;
    }
    const res = await fetch(`/api/patients/${patientId}/orders`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.ok) {
      router.push(`/patients/${patientId}/orders`);
      router.refresh();
    }
  }

  const picks = type === "lab" ? LAB_PICKS : type === "imaging" ? IMG_PICKS : [];

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-2">
        {["rx", "lab", "imaging", "referral", "procedure"].map(t => (
          <button key={t} type="button" onClick={() => setType(t)} className={`chip ring-1 ring-inset ${t === type ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {type === "rx" ? (
        <RefSelect
          type="medication"
          label="Medication"
          name="itemName"
          showCode={false}
          placeholder="Search medication or create new…"
          onChange={({ display, item }) => {
            const d = (item?.data ?? {}) as { name?: string; strength?: string; form?: string };
            setName(d.name || display);
            if (d.strength) setStrength(d.strength);
            if (d.form) setForm(d.form);
          }}
        />
      ) : (
        <div>
          <span className="label">{type === "lab" ? "Lab / Panel" : type === "imaging" ? "Study" : type === "referral" ? "Specialty" : "Procedure"}</span>
          <input value={name} onChange={e => setName(e.target.value)} required className="input" />
          {picks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {picks.map(p => (
                <button key={p} type="button" onClick={() => setName(p)} className="chip bg-slate-100 hover:bg-brand-100 ring-slate-200 hover:ring-brand-200 text-slate-700 hover:text-brand-800">{p}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {type === "rx" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Strength / Dose" value={strength} onChange={e => setStrength(e.target.value)} placeholder="20 mg" />
            <RefSelect type="medForm" label="Form" name="rxForm" showCode={false} defaultValue={form}
              onChange={({ display }) => setForm(display)} />
            <RefSelect type="medRoute" label="Route" name="rxRoute" showCode={false}
              onChange={({ display }) => setRoute(display)} />
            <RefSelect type="medFrequency" label="Frequency" name="rxFrequency" showCode={false}
              onChange={({ display }) => setFrequency(display)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Sig (optional override)" value={sig} onChange={e => setSig(e.target.value)} placeholder="Auto from route + frequency" />
            <Input label="Quantity" value={qty} onChange={e => setQty(e.target.value)} placeholder="30" />
            <Input label="Refills" value={refills} onChange={e => setRefills(e.target.value)} type="number" min="0" max="11" />
          </div>
        </>
      )}

      {type === "rx" && (
        <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="label mb-0">Destination pharmacy (e-prescribe)</span>
            <span className="chip bg-brand-100 text-brand-800 ring-brand-200">Surescripts / Availity</span>
          </div>
          <PharmacyPicker selected={pharmacy} onSelect={setPharmacy} compact />
          <p className="text-[11px] text-slate-600">
            {pharmacy
              ? "This prescription will be sent electronically to the selected pharmacy on submit."
              : "Optional. Leave empty to save as a pending Rx and route later from the Orders workspace."}
          </p>
        </div>
      )}

      {type !== "rx" && (
        <Input label="Instructions" value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Fasting, …" />
      )}

      {type === "lab" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <div className="font-semibold">Lab module: active</div>
          <div>Labcorp routing is enabled for outbound lab orders.</div>
          <div className="mt-1 inline-flex items-center">
            <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200">Labcorp</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Priority</span>
          <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
          </select>
        </label>
        <RefSelect type="diagnosis" label="Linked Dx (ICD-10)" name="diagnosisCode" emit="code" showCode
          placeholder="Search diagnosis…"
          onChange={({ code, display }) => setDiag(code || display)} />
      </div>

      <button disabled={loading || !name} className="btn-primary">{loading ? "Submitting…" : type === "rx" && pharmacy ? "Submit & Send to Pharmacy" : "Submit Order"}</button>
    </form>
  );
}

function Input({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block"><span className="label">{label}</span><input className="input" {...rest} /></label>;
}

