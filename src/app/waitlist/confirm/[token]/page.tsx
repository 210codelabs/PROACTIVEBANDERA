"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Offer = { status: string; expired: boolean; filled: boolean; patientName: string; providerName: string | null; day: string | null; time: string | null };

function pretty(day?: string | null, time?: string | null) {
  if (!day || !time) return "";
  try { return new Date(`${day}T${time}:00`).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  catch { return `${day} ${time}`; }
}

export default function WaitlistConfirmPage() {
  const { token } = useParams<{ token: string }>();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try { const r = await fetch(`/api/waitlist/confirm/${token}`); const d = await r.json(); if (r.ok) setOffer(d); else setResult({ ok: false, text: "This link is no longer valid." }); }
      catch { setResult({ ok: false, text: "Something went wrong. Please try again later." }); }
      finally { setLoading(false); }
    })();
  }, [token]);

  async function claim() {
    setBusy(true);
    try {
      const r = await fetch(`/api/waitlist/confirm/${token}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) setResult({ ok: true, text: d.alreadyFilled ? "This appointment was already confirmed. See you then!" : "You're booked! We've reserved this appointment for you." });
      else setResult({ ok: false, text: d.message || "This offer is no longer available." });
    } catch { setResult({ ok: false, text: "Something went wrong. Please try again." }); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50 grid place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-brand-600 to-brand-800 text-white px-6 py-5">
          <h1 className="text-lg font-extrabold">Proactive Clinic</h1>
          <p className="text-brand-100 text-sm">Appointment offer</p>
        </div>
        <div className="p-6 space-y-4">
          {loading ? (
            <p className="text-slate-500">Loading…</p>
          ) : result ? (
            <div className={`rounded-lg px-4 py-4 text-sm ring-1 ${result.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>{result.text}</div>
          ) : offer ? (
            offer.filled ? (
              <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 px-4 py-4 text-sm text-slate-600">This appointment has already been confirmed.</div>
            ) : offer.expired ? (
              <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 px-4 py-4 text-sm text-amber-800">This offer has expired. We'll reach out if another slot opens.</div>
            ) : (
              <>
                <p className="text-slate-600">Hi {offer.patientName || "there"}, a spot just opened up:</p>
                <div className="rounded-lg bg-brand-50 ring-1 ring-brand-200 px-4 py-3">
                  <div className="text-lg font-bold text-brand-900">{pretty(offer.day, offer.time)}</div>
                  {offer.providerName && <div className="text-sm text-brand-700">with {offer.providerName}</div>}
                </div>
                <p className="text-xs text-slate-400">This offer expires 2 hours after it was sent.</p>
                <button onClick={claim} disabled={busy} className="btn-primary w-full">{busy ? "Confirming…" : "Claim this appointment"}</button>
              </>
            )
          ) : null}
        </div>
      </div>
    </main>
  );
}
