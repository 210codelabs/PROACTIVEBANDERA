"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import PayerAutocomplete from "@/components/billing/PayerAutocomplete";

/**
 * Insurance card on the patient chart — view + inline edit of insurer, plan,
 * member ID, group # and the Stedi payer ID used for eligibility/claims.
 * Includes a payer-directory picker that fills the payer name + Stedi payer ID.
 */

const CAN_EDIT = ["admin", "provider", "nurse", "frontdesk"];

type Patient = {
  id: string;
  insurerName?: string | null;
  insurerPlan?: string | null;
  memberId?: string | null;
  groupNumber?: string | null;
  payerId?: string | null;
};

const FIELDS: { id: keyof Patient; label: string; placeholder?: string }[] = [
  { id: "insurerPlan", label: "Plan" },
  { id: "memberId", label: "Member ID" },
  { id: "groupNumber", label: "Group #" },
  { id: "payerId", label: "Stedi Payer ID", placeholder: "e.g. 87726" },
];

export default function InsuranceCard({ patient, role }: { patient: Patient; role: string }) {
  const router = useRouter();
  const canEdit = CAN_EDIT.includes(role);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<Record<string, string>>(() => ({
    insurerName: patient.insurerName || "",
    insurerPlan: patient.insurerPlan || "",
    memberId: patient.memberId || "",
    groupNumber: patient.groupNumber || "",
    payerId: patient.payerId || "",
  }));

  const set = (id: string, v: string) => setForm((p) => ({ ...p, [id]: v }));

  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) setMsg(d.error || "Could not save.");
      else { setEditing(false); router.refresh(); }
    } catch { setMsg("Network error."); }
    finally { setBusy(false); }
  }

  return (
    <section className="card">
      <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <span className="font-semibold text-slate-900">Insurance</span>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-brand-700 hover:underline">Edit</button>
        )}
      </header>
      <div className="p-4 space-y-2">
        {!editing ? (
          <>
            <Row k="Insurer">{patient.insurerName || "—"}</Row>
            <Row k="Plan">{patient.insurerPlan || "—"}</Row>
            <Row k="Member ID">{patient.memberId || "—"}</Row>
            <Row k="Group #">{patient.groupNumber || "—"}</Row>
            <Row k="Stedi Payer ID">{patient.payerId || <span className="text-slate-400">not set — eligibility falls back to any available payer</span>}</Row>
          </>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Insurer</span>
              <PayerAutocomplete
                value={form.insurerName || ""}
                onChange={(v) => set("insurerName", v)}
                onSelect={({ name, payerId }) => setForm((f) => ({ ...f, insurerName: name, payerId: payerId || f.payerId }))}
              />
              <span className="mt-1 block text-[11px] text-slate-400">Type an insurer name to search Stedi payers — picking one fills the Stedi Payer ID.</span>
            </label>
            {FIELDS.map((f) => (
              <label key={f.id as string} className="block text-sm">
                <span className="mb-1 block text-xs font-semibold text-slate-600">{f.label}</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  value={form[f.id as string] || ""}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.id as string, e.target.value)}
                />
              </label>
            ))}
            {msg && <p className="text-sm text-red-600">{msg}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setEditing(false); setMsg(""); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={save} disabled={busy} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <div className="text-slate-500">{k}</div>
      <div className="col-span-2 text-slate-900">{children}</div>
    </div>
  );
}
