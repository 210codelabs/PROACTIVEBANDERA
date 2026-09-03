"use client";

import React, { useCallback, useEffect, useState } from "react";

type DayHours = { open: number; close: number; closed: boolean };
type Hours = Record<string, DayHours>;

const DAYS = [
  { k: "0", label: "Sunday" }, { k: "1", label: "Monday" }, { k: "2", label: "Tuesday" },
  { k: "3", label: "Wednesday" }, { k: "4", label: "Thursday" }, { k: "5", label: "Friday" }, { k: "6", label: "Saturday" },
];

// Time options every 30 min, 6:00 AM – 10:00 PM.
const TIME_OPTS: { v: number; label: string }[] = [];
for (let m = 360; m <= 1320; m += 30) {
  const h = Math.floor(m / 60), mm = m % 60;
  const h12 = ((h + 11) % 12) + 1;
  TIME_OPTS.push({ v: m, label: `${h12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}` });
}

const DEFAULT_OPEN = 540, DEFAULT_CLOSE = 1200; // 9:00–20:00

function seed(clinic: { open: number; close: number }): Hours {
  const h: Hours = {};
  for (const d of DAYS) h[d.k] = { open: clinic.open, close: clinic.close, closed: d.k === "0" || d.k === "6" };
  return h;
}

export default function WorkingHoursEditor() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [providerId, setProviderId] = useState("");
  const [providerName, setProviderName] = useState("");
  const [clinic, setClinic] = useState({ open: DEFAULT_OPEN, close: DEFAULT_CLOSE });
  const [hours, setHours] = useState<Hours>(seed({ open: DEFAULT_OPEN, close: DEFAULT_CLOSE }));
  const [usingDefault, setUsingDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async (pid?: string) => {
    setLoading(true); setMsg(null);
    try {
      const r = await fetch(`/api/providers/hours${pid ? `?providerId=${pid}` : ""}`);
      const d = await r.json();
      setIsAdmin(Boolean(d.isAdmin));
      setProviders(d.providers || []);
      setProviderId(d.providerId || "");
      setProviderName(d.providerName || "");
      const cd = d.clinicDefault || { open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
      setClinic(cd);
      if (d.workingHours) {
        const base = seed(cd);
        for (const k of Object.keys(d.workingHours)) base[k] = { open: d.workingHours[k].open, close: d.workingHours[k].close, closed: Boolean(d.workingHours[k].closed) };
        setHours(base);
        setUsingDefault(false);
      } else {
        setHours(seed(cd));
        setUsingDefault(true);
      }
    } catch { setMsg({ tone: "err", text: "Could not load working hours." }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function setDay(k: string, patch: Partial<DayHours>) {
    setHours((h) => ({ ...h, [k]: { ...h[k], ...patch } }));
    setUsingDefault(false);
  }
  function copyToAll(fromK: string) {
    const src = hours[fromK];
    setHours((h) => { const n = { ...h }; for (const d of DAYS) if (d.k !== fromK) n[d.k] = { ...src }; return n; });
    setUsingDefault(false);
  }

  async function save(reset = false) {
    setBusy(true); setMsg(null);
    try {
      const body: any = { workingHours: reset ? null : hours };
      if (isAdmin && providerId) body.providerId = providerId;
      const r = await fetch("/api/providers/hours", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setMsg({ tone: "err", text: d.error || "Could not save." }); return; }
      setMsg({ tone: "ok", text: reset ? "Reset to clinic default hours." : "Working hours saved." });
      if (reset) { setHours(seed(clinic)); setUsingDefault(true); } else { setUsingDefault(false); }
    } catch { setMsg({ tone: "err", text: "Network error." }); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-4">
      {isAdmin && providers.length > 0 && (
        <label className="block max-w-sm">
          <span className="label">Provider</span>
          <select className="input" value={providerId} onChange={(e) => { setProviderId(e.target.value); load(e.target.value); }}>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}

      {msg && <div className={`rounded-md px-3 py-2 text-sm ring-1 ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>{msg.text}</div>}

      {usingDefault && (
        <div className="rounded-md bg-brand-50 text-brand-800 ring-1 ring-brand-200 px-3 py-2 text-xs">
          {providerName || "This provider"} is currently using the clinic default hours. Adjust any day below and Save to set custom availability.
        </div>
      )}

      <div className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200 overflow-hidden">
        {DAYS.map((d) => {
          const row = hours[d.k];
          return (
            <div key={d.k} className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-white">
              <div className="w-28 font-medium text-slate-800 text-sm">{d.label}</div>
              <label className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <input type="checkbox" checked={!row.closed} onChange={(e) => setDay(d.k, { closed: !e.target.checked })} />
                Open
              </label>
              {row.closed ? (
                <span className="chip bg-slate-100 text-slate-500 ring-slate-200">Closed</span>
              ) : (
                <div className="flex items-center gap-2">
                  <select className="input w-[120px] py-1" value={row.open} onChange={(e) => setDay(d.k, { open: Number(e.target.value) })}>
                    {TIME_OPTS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </select>
                  <span className="text-slate-400">to</span>
                  <select className="input w-[120px] py-1" value={row.close} onChange={(e) => setDay(d.k, { close: Number(e.target.value) })}>
                    {TIME_OPTS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </select>
                  {row.close <= row.open && <span className="text-[11px] text-rose-600">End must be after start</span>}
                </div>
              )}
              <button type="button" onClick={() => copyToAll(d.k)} className="ml-auto text-[11px] text-brand-600 hover:underline">Copy to all days</button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => save(false)} disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save working hours"}</button>
        <button onClick={() => save(true)} disabled={busy} className="btn-secondary">Reset to clinic default</button>
      </div>
      <p className="text-xs text-slate-400">The scheduler blocks click-to-create and auto-shift outside these hours, and greys out days marked Closed. Clinic hours ({TIME_OPTS.find((t) => t.v === clinic.open)?.label} – {TIME_OPTS.find((t) => t.v === clinic.close)?.label} Central) remain the outer boundary.</p>
    </div>
  );
}
