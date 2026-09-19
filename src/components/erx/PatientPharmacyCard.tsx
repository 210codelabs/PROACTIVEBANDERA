"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import PharmacyPicker, { type Pharmacy } from "@/components/orders/PharmacyPicker";

type Slot = "primaryPharmacyNcpdp" | "alternativePharmacyNcpdp";

// Patient chart card to choose the patient's Primary / Alternative pharmacy from
// the Weno directory (via PharmacyPicker) instead of typing an NCPDP ID. Selecting
// a pharmacy PATCHes the NCPDP onto the patient so it pre-fills the Weno payload.
export default function PatientPharmacyCard({
  patientId,
  primary,
  alternative,
  checkinFlag,
  canEdit,
  patientZip,
}: {
  patientId: string;
  primary: string | null;
  alternative: string | null;
  checkinFlag?: boolean;
  canEdit: boolean;
  patientZip?: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<{ primaryPharmacyNcpdp: string; alternativePharmacyNcpdp: string }>({
    primaryPharmacyNcpdp: primary || "",
    alternativePharmacyNcpdp: alternative || "",
  });
  const [flag, setFlag] = useState<boolean>(Boolean(checkinFlag));
  const [flagSaving, setFlagSaving] = useState(false);
  const [savingSlot, setSavingSlot] = useState<Slot | null>(null);
  const [err, setErr] = useState("");

  async function save(slot: Slot, ncpdp: string) {
    setSavingSlot(slot); setErr("");
    try {
      const r = await fetch(`/api/patients/${patientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [slot]: ncpdp }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Could not save pharmacy."); return; }
      setValues((v) => ({ ...v, [slot]: ncpdp }));
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setSavingSlot(null);
    }
  }

  async function toggleFlag(next: boolean) {
    setFlagSaving(true); setErr("");
    try {
      const r = await fetch(`/api/patients/${patientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pharmacyCheckinFlag: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Could not update the check-in flag."); return; }
      setFlag(next);
      router.refresh();
    } catch {
      setErr("Network error.");
    } finally {
      setFlagSaving(false);
    }
  }

  return (
    <section className="card">
      <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900 flex items-center justify-between">
        <span>Preferred Pharmacy (e-Prescribing)</span>
        <span className="chip bg-teal-100 text-teal-800 ring-teal-200">Weno directory</span>
      </header>
      <div className="p-4 space-y-4">
        <PharmacySlot
          label="Primary pharmacy"
          ncpdp={values.primaryPharmacyNcpdp}
          canEdit={canEdit}
          patientZip={patientZip}
          saving={savingSlot === "primaryPharmacyNcpdp"}
          onSelect={(p) => save("primaryPharmacyNcpdp", p?.ncpdpId || "")}
          onClear={() => save("primaryPharmacyNcpdp", "")}
        />
        <PharmacySlot
          label="Alternative pharmacy (optional)"
          ncpdp={values.alternativePharmacyNcpdp}
          canEdit={canEdit}
          patientZip={patientZip}
          saving={savingSlot === "alternativePharmacyNcpdp"}
          onSelect={(p) => save("alternativePharmacyNcpdp", p?.ncpdpId || "")}
          onClear={() => save("alternativePharmacyNcpdp", "")}
        />

        {/* Section 6 (Weno Test Plan) — Patient Check-in Flag: mark that the
            patient needs a WENO-connected alternative pharmacy chosen at their
            next encounter/visit. Surfaced to front desk / clinicians at check-in. */}
        <div className={`rounded-lg ring-1 px-3 py-2 ${flag ? "bg-amber-50 ring-amber-200" : "bg-slate-50 ring-slate-200"}`}>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={flag}
              disabled={!canEdit || flagSaving}
              onChange={(e) => toggleFlag(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-semibold text-slate-800">Needs a WENO-connected alternative pharmacy</span>
              <span className="block text-xs text-slate-500">
                {flag
                  ? "Flagged — prompt the user to select a WENO-connected pharmacy at the next visit / encounter."
                  : "Flag this patient so staff choose a WENO-connected pharmacy at the next check-in."}
              </span>
            </span>
          </label>
          {flag && (
            <div className="mt-1 flex items-center gap-2">
              <span className="chip bg-amber-100 text-amber-800 ring-amber-200">Check-in follow-up</span>
              {flagSaving && <span className="text-xs text-slate-500">Saving…</span>}
            </div>
          )}
        </div>

        {err && <p className="text-sm text-rose-600">{err}</p>}
        {!canEdit && <p className="text-xs text-slate-500">Your role has read-only access.</p>}
      </div>
    </section>
  );
}

function PharmacySlot({
  label,
  ncpdp,
  canEdit,
  saving,
  onSelect,
  onClear,
  patientZip,
}: {
  label: string;
  ncpdp: string;
  canEdit: boolean;
  saving: boolean;
  onSelect: (p: Pharmacy | null) => void;
  onClear: () => void;
  patientZip?: string | null;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      {ncpdp && !picking ? (
        <div className="flex items-center justify-between gap-2 rounded-lg ring-1 ring-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-sm text-slate-800">NCPDP <span className="font-mono font-semibold">{ncpdp}</span></span>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button type="button" className="chip bg-white text-slate-600 ring-slate-200 hover:bg-slate-50" onClick={() => setPicking(true)} disabled={saving}>Change</button>
              <button type="button" className="chip bg-white text-rose-600 ring-rose-200 hover:bg-rose-50" onClick={onClear} disabled={saving}>Remove</button>
            </div>
          )}
        </div>
      ) : canEdit ? (
        <PharmacyPicker
          compact
          selected={null}
          patientZip={patientZip}
          onSelect={(p) => { if (p) { onSelect(p); setPicking(false); } }}
        />
      ) : (
        <div className="text-sm text-slate-500">Not set</div>
      )}
      {saving && <p className="mt-1 text-xs text-slate-500">Saving…</p>}
    </div>
  );
}
