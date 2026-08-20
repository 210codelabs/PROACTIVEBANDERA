"use client";

import React, { useCallback, useEffect, useState } from "react";
import PayerAutocomplete from "@/components/billing/PayerAutocomplete";

type Patient = { id: string; firstName: string; lastName: string; dob?: string; memberId?: string | null; insurerName?: string | null };
type Summary = { label: string; value: string };
type Check = {
  id: string;
  patientName?: string | null;
  payerId: string;
  payerName?: string | null;
  memberId?: string | null;
  status: string;
  planName?: string | null;
  summary?: Summary[] | null;
  createdAt: string;
  checkedByName?: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  inactive: "bg-slate-200 text-slate-700 ring-slate-300",
  error: "bg-rose-100 text-rose-800 ring-rose-200",
  unknown: "bg-amber-100 text-amber-800 ring-amber-200",
};

export default function EligibilityChecker({ patient, defaultPayerId = "" }: { patient?: Patient; defaultPayerId?: string }) {
  const [payerId, setPayerId] = useState(defaultPayerId);
  const [payerName, setPayerName] = useState(patient?.insurerName ?? "");
  const [firstName, setFirstName] = useState(patient?.firstName ?? "");
  const [lastName, setLastName] = useState(patient?.lastName ?? "");
  const [dob, setDob] = useState(patient?.dob ? String(patient.dob).slice(0, 10) : "");
  const [memberId, setMemberId] = useState(patient?.memberId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Check | null>(null);
  const [history, setHistory] = useState<Check[]>([]);
  const [force, setForce] = useState(false);
  const [cachedNote, setCachedNote] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const url = patient?.id ? `/api/stedi/eligibility?patientId=${patient.id}` : "/api/stedi/eligibility";
      const res = await fetch(url);
      if (!res.ok) return;
      const d = await res.json();
      setHistory(d.checks || []);
    } catch {
      /* ignore */
    }
  }, [patient?.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!payerId) { setError("Select a payer from the Stedi directory first."); return; }
    setLoading(true); setError(null); setResult(null); setCachedNote(null);
    try {
      const res = await fetch("/api/stedi/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patient?.id, payerId, payerName, firstName, lastName, dateOfBirth: dob, memberId, force }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setError(d.error || "Eligibility check failed."); }
      if (d.check) setResult(d.check);
      if (d.cached && d.skippedReason) setCachedNote(d.skippedReason);
      loadHistory();
    } catch {
      setError("Could not reach the eligibility service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={run} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label className="text-sm sm:col-span-2">
          <span className="label">Payer (search Stedi directory)</span>
          <PayerAutocomplete
            value={payerName}
            onChange={(v) => { setPayerName(v); }}
            onSelect={(s) => { setPayerName(s.name); setPayerId(s.payerId); }}
            placeholder="Search insurer / payer name…"
          />
          <input type="hidden" value={payerId} readOnly required />
          {payerId && <span className="text-[11px] text-slate-400">Stedi payer ID: <span className="font-mono">{payerId}</span></span>}
        </label>
        <label className="text-sm">
          <span className="label">Member ID</span>
          <input className="input" value={memberId ?? ""} onChange={(e) => setMemberId(e.target.value)} placeholder="Subscriber member ID" />
        </label>
        <label className="text-sm">
          <span className="label">Date of Birth</span>
          <input type="date" className="input" value={dob} onChange={(e) => setDob(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="label">First name</span>
          <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={Boolean(patient)} />
        </label>
        <label className="text-sm">
          <span className="label">Last name</span>
          <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={Boolean(patient)} />
        </label>
        <div className="flex items-end">
          <button className="btn-primary w-full" disabled={loading} type="submit">
            {loading ? "Checking…" : force ? "Force re-check" : "Verify eligibility"}
          </button>
        </div>
      </form>

      <label className="flex items-center gap-2 text-xs text-slate-600 -mt-1">
        <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="rounded border-slate-300" />
        Force re-check (bypass the 30-day reuse window — runs a new paid clearinghouse check)
      </label>

      {cachedNote && (
        <div className="rounded-md bg-sky-50 text-sky-800 ring-1 ring-sky-200 px-3 py-2 text-sm">{cachedNote}</div>
      )}

      {error && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>}

      {result && (
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <span className={`chip ring-1 ${STATUS_STYLE[result.status] || STATUS_STYLE.unknown}`}>{result.status.toUpperCase()}</span>
            <span className="text-sm font-medium text-slate-800">{result.payerName || result.payerId}</span>
            {result.planName && <span className="text-xs text-slate-500">· {result.planName}</span>}
          </div>
          {Array.isArray(result.summary) && result.summary.length > 0 && (
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {result.summary.map((s, i) => (
                <li key={i} className="flex justify-between"><span className="text-slate-500">{s.label}</span><span className="font-medium text-slate-800">{s.value}</span></li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Recent checks</h4>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No eligibility checks yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  {!patient && <th className="px-3 py-2">Patient</th>}
                  <th className="px-3 py-2">Payer</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100">
                    {!patient && <td className="px-3 py-2 text-slate-700">{h.patientName || "—"}</td>}
                    <td className="px-3 py-2 text-slate-600">{h.payerName || h.payerId}</td>
                    <td className="px-3 py-2"><span className={`chip ring-1 ${STATUS_STYLE[h.status] || STATUS_STYLE.unknown}`}>{h.status}</span></td>
                    <td className="px-3 py-2 text-xs text-slate-500">{new Date(h.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{h.checkedByName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
