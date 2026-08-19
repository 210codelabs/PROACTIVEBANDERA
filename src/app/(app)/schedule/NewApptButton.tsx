"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ClinicTZBadge from "@/components/ClinicTZBadge";

type Provider = { id: string; firstName: string; lastName: string; credential: string | null };
type Service = { id: string; name: string; durationMin: number; category: string; homeEligible: boolean };
type Hit = { id: string; mrn: string; firstName: string; lastName: string };

export default function NewApptButton({ providers, services, day }: { providers: Provider[]; services: Service[]; day: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [patientId, setPatientId] = useState("");
  const [patientLabel, setPatientLabel] = useState("");
  const [providerId, setProviderId] = useState(providers[0]?.id || "");
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [time, setTime] = useState("09:00");
  const [reason, setReason] = useState("");
  const [location, setLocation] = useState("in-office");
  const [submissionTrack, setSubmissionTrack] = useState("insured");
  const [telehealthPlatform, setTelehealthPlatform] = useState("google-meet");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [repeat, setRepeat] = useState("none");
  const [occurrences, setOccurrences] = useState(4);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  // Open (prefilled to a time) when a day-view empty slot is clicked.
  useEffect(() => {
    function onNew(e: Event) {
      const detail = (e as CustomEvent).detail || {};
      if (typeof detail.time === "string" && detail.time) setTime(detail.time);
      setError("");
      setResult(null);
      setOpen(true);
    }
    window.addEventListener("schedule:new-appt", onNew as EventListener);
    return () => window.removeEventListener("schedule:new-appt", onNew as EventListener);
  }, []);

  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setHits(data.results || []);
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  async function submit() {
    if (!patientId || !providerId) return;
    const mergedNotes = [
      `Clinical intake: ${submissionTrack}`,
      location === "telehealth" ? `Telehealth platform: ${telehealthPlatform}` : "",
      notes.trim(),
    ].filter(Boolean).join(" | ");

    setLoading(true);
    setError("");
    setResult(null);
    try {
      if (repeat === "none") {
        const res = await fetch("/api/appointments", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ patientId, providerId, serviceTypeId: serviceId, day, time, reason, location, notes: mergedNotes }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data.error || "Could not schedule this appointment."); setLoading(false); return; }
        setOpen(false);
        router.refresh();
      } else {
        const res = await fetch("/api/appointments/recurring", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ patientId, providerId, serviceTypeId: serviceId, day, time, reason, location, notes: mergedNotes, frequency: repeat, count: occurrences }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setError(data.error || "Could not schedule the series."); setLoading(false); return; }
        setResult({ created: data.created || 0, skipped: data.skipped || 0 });
        router.refresh();
        if (!data.skipped) setTimeout(() => setOpen(false), 1400);
      }
    } catch {
      setError("Scheduling is temporarily unavailable.");
    }
    setLoading(false);
  }

  return (
    <>
      <button className="btn-primary" onClick={() => { setError(""); setResult(null); setOpen(true); }}>+ New Appointment</button>
      {open && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="card max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <header className="px-4 py-3 border-b border-slate-200 font-semibold flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">New Appointment — {day} <ClinicTZBadge /></span>
              <button onClick={() => setOpen(false)} className="text-slate-500">✕</button>
            </header>
            <div className="p-4 space-y-3">
              {error && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>}
              {result && <div className="rounded-md bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 px-3 py-2 text-sm">Created {result.created} visit{result.created === 1 ? "" : "s"}{result.skipped ? ` · ${result.skipped} skipped (outside hours or double-booked)` : ""}.</div>}
              <div>
                <span className="label">Patient</span>
                {patientId ? (
                  <div className="flex items-center gap-2">
                    <span className="chip bg-brand-100 text-brand-800 ring-brand-200">{patientLabel}</span>
                    <button onClick={() => { setPatientId(""); setPatientLabel(""); setQ(""); }} className="text-xs text-slate-500 hover:text-slate-900">change</button>
                  </div>
                ) : (
                  <>
                    <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search patient…" />
                    {hits.length > 0 && (
                      <ul className="mt-1 ring-1 ring-slate-200 rounded-md max-h-40 overflow-auto bg-white">
                        {hits.map(h => (
                          <li key={h.id}>
                            <button type="button" onClick={() => { setPatientId(h.id); setPatientLabel(`${h.lastName}, ${h.firstName} (${h.mrn})`); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-brand-50">
                              {h.lastName}, {h.firstName} <span className="text-xs text-slate-500">MRN {h.mrn}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block col-span-2">
                  <span className="label">Submitting New Appointments (Clinical)</span>
                  <select className="input" value={submissionTrack} onChange={e => setSubmissionTrack(e.target.value)}>
                    <option value="physical-rehabilitation">Physical Rehabilitation</option>
                    <option value="lawyers">Lawyers</option>
                    <option value="workers-comp">Workers Comp</option>
                    <option value="insured">Insured</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Provider</span>
                  <select className="input" value={providerId} onChange={e => setProviderId(e.target.value)}>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.credential ? `, ${p.credential}` : ""}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Service Type</span>
                  <select className="input" value={serviceId} onChange={e => setServiceId(e.target.value)}>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.durationMin} min)</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Time <span className="text-slate-400 font-normal">(9:00 AM – 8:00 PM CT)</span></span>
                  <input className="input" type="time" min="09:00" max="20:00" step={900} value={time} onChange={e => setTime(e.target.value)} />
                </label>
                <label className="block">
                  <span className="label">Location</span>
                  <select className="input" value={location} onChange={e => setLocation(e.target.value)}>
                    <option value="in-office">In office</option>
                    <option value="home-visit">Home visit</option>
                    <option value="telehealth">Telehealth</option>
                  </select>
                </label>
                <div className="col-span-2 rounded-lg ring-1 ring-slate-200 bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="label">Repeat</span>
                      <select className="input" value={repeat} onChange={e => setRepeat(e.target.value)}>
                        <option value="none">Does not repeat</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 weeks</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </label>
                    {repeat !== "none" && (
                      <label className="block">
                        <span className="label">Occurrences</span>
                        <input className="input" type="number" min={2} max={26} value={occurrences} onChange={e => setOccurrences(Math.max(2, Math.min(26, parseInt(e.target.value) || 2)))} />
                      </label>
                    )}
                  </div>
                  {repeat !== "none" && (
                    <p className="mt-2 text-[11px] text-slate-500">Creates up to {occurrences} visits from {day} at {time}. Dates outside 9 AM–8 PM CT or that clash with the provider are skipped.</p>
                  )}
                </div>
                {location === "telehealth" && (
                  <label className="block col-span-2">
                    <span className="label">Telehealth platform</span>
                    <select className="input" value={telehealthPlatform} onChange={e => setTelehealthPlatform(e.target.value)}>
                      <option value="google-meet">Google Meet</option>
                      <option value="phone">Phone</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                )}
              </div>
              <label className="block">
                <span className="label">Reason / chief complaint</span>
                <input className="input" value={reason} onChange={e => setReason(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">Billing / referral notes</span>
                <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional case details" />
              </label>
            </div>
            <footer className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={submit} disabled={loading || !patientId} className="btn-primary">{loading ? "Saving…" : repeat === "none" ? "Schedule" : `Schedule ${occurrences} visits`}</button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
