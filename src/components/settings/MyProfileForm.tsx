"use client";

import React, { useEffect, useState } from "react";

type Profile = {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  credential: string;
  specialty: string;
  npi: string;
  dea: string;
  licenseNo: string;
};

const EMPTY: Profile = { credential: "", specialty: "", npi: "", dea: "", licenseNo: "" };

export default function MyProfileForm() {
  const [p, setP] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/me/profile");
        const d = await r.json();
        if (d.profile) setP({ ...EMPTY, ...d.profile });
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  function set(k: keyof Profile, v: string) { setP((cur) => ({ ...cur, [k]: v })); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const r = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: p.credential, specialty: p.specialty, npi: p.npi, dea: p.dea, licenseNo: p.licenseNo }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.error || "Could not save." }); }
      else { setMsg({ ok: true, text: "Saved. New PT/PI notes you sign will now carry your NPI and license." }); if (d.profile) setP((cur) => ({ ...cur, ...d.profile })); }
    } catch { setMsg({ ok: false, text: "Network error. Please try again." }); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="text-sm text-slate-400">Loading your profile…</div>;

  return (
    <form onSubmit={save} className="space-y-4 max-w-2xl">
      <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3 text-sm text-slate-600">
        Signed in as <b>{p.firstName} {p.lastName}</b> · {p.email} · role <b>{p.role}</b>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Credential (e.g. DPT, PT, MD, DO, NP)" value={p.credential} onChange={(v) => set("credential", v)} placeholder="DPT" />
        <Field label="Specialty" value={p.specialty} onChange={(v) => set("specialty", v)} placeholder="Physical Therapy" />
        <Field label="Individual NPI (10 digits)" value={p.npi} onChange={(v) => set("npi", v.replace(/[^0-9]/g, "").slice(0, 10))} placeholder="1234567890" mono />
        <Field label="State professional license #" value={p.licenseNo} onChange={(v) => set("licenseNo", v)} placeholder="PT-123456" mono />
        <Field label="DEA (optional)" value={p.dea} onChange={(v) => set("dea", v)} placeholder="—" mono />
      </div>
      {p.npi && p.npi.length !== 10 && (
        <div className="text-xs text-amber-600">NPI should be exactly 10 digits.</div>
      )}
      {msg && (
        <div className={`text-sm rounded-lg px-3 py-2 ${msg.ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>{msg.text}</div>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save credentials"}</button>
        <span className="text-xs text-slate-500">These feed your PT/PI note signature and PT claims (rendering provider NPI).</span>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`input w-full mt-0.5 ${mono ? "font-mono" : ""}`} />
    </label>
  );
}
