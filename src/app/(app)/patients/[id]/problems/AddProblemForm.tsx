"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const COMMON = [
  { icd10: "E11.9", desc: "Type 2 diabetes mellitus, w/o complications" },
  { icd10: "I10", desc: "Essential hypertension" },
  { icd10: "E78.5", desc: "Hyperlipidemia, unspecified" },
  { icd10: "M54.5", desc: "Low back pain" },
  { icd10: "M25.561", desc: "Pain in right knee" },
  { icd10: "L97.929", desc: "Non-pressure chronic ulcer of unspec part of left lower leg, unspecified severity" },
  { icd10: "G89.4", desc: "Chronic pain syndrome" },
  { icd10: "F41.1", desc: "Generalized anxiety disorder" },
  { icd10: "J45.909", desc: "Unspecified asthma, uncomplicated" },
];

export default function AddProblemForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [icd10, setIcd10] = useState("");
  const [desc, setDesc] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    await fetch(`/api/patients/${patientId}/problems`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, icd10, description: desc }),
    });
    setLoading(false);
    setIcd10(""); setDesc("");
    (e.currentTarget as HTMLFormElement).reset();
    router.refresh();
  }
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="label">ICD-10</span>
          <input value={icd10} onChange={e => setIcd10(e.target.value)} className="input font-mono" />
        </label>
        <label className="block col-span-2">
          <span className="label">Description</span>
          <input value={desc} onChange={e => setDesc(e.target.value)} className="input" required />
        </label>
      </div>
      <div>
        <span className="label">Quick add</span>
        <div className="flex flex-wrap gap-1.5">
          {COMMON.map(c => (
            <button key={c.icd10} type="button" onClick={() => { setIcd10(c.icd10); setDesc(c.desc); }} className="chip bg-slate-100 hover:bg-brand-100 ring-slate-200 hover:ring-brand-200 text-slate-700 hover:text-brand-800">
              <span className="font-mono">{c.icd10}</span> {c.desc}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="label">Status</span>
        <select name="status" className="input" defaultValue="active">
          <option value="active">Active</option>
          <option value="chronic">Chronic</option>
          <option value="resolved">Resolved</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <button disabled={loading} className="btn-primary w-full">{loading ? "Saving…" : "Add Problem"}</button>
    </form>
  );
}
