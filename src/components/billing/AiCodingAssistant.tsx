"use client";

import React, { useState } from "react";
import PayerAutocomplete from "@/components/billing/PayerAutocomplete";

type Review = {
  summary: string; cleanClaimReady: boolean; medicalNecessity: string;
  suggestedCpt: { code: string; description: string; modifier: string; rationale: string }[];
  suggestedIcd10: { code: string; description: string; rationale: string }[];
  issues: { severity: string; message: string }[];
};
type Scrub = { environment: string; readyToSubmit: boolean; errors: string[]; warnings: string[] };

const SEV: Record<string, string> = { error: "text-rose-700", warning: "text-amber-700", info: "text-slate-600" };

export default function AiCodingAssistant() {
  const [cpt, setCpt] = useState("");
  const [icd, setIcd] = useState("");
  const [note, setNote] = useState("");
  const [payerName, setPayerName] = useState("");
  const [memberId, setMemberId] = useState("");
  const [payerId, setPayerId] = useState("");
  const [busy, setBusy] = useState<"ai" | "scrub" | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [scrub, setScrub] = useState<Scrub | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runAi() {
    setBusy("ai"); setErr(null); setReview(null);
    try {
      const r = await fetch("/api/billing/ai-coding", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cptCodes: cpt, icd10Codes: icd, note, payerName, specialty: "wellness & physical rehabilitation" }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "AI review failed."); else setReview(d.review);
    } catch { setErr("Network error."); } finally { setBusy(null); }
  }

  async function runScrub() {
    setBusy("scrub"); setErr(null); setScrub(null);
    try {
      const r = await fetch("/api/billing/scrub", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cptCodes: cpt, icd10Codes: icd, memberId, payerId }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "Scrub failed."); else setScrub(d);
    } catch { setErr("Network error."); } finally { setBusy(null); }
  }

  return (
    <section className="card">
      <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Superbill AI assistant &amp; claim scrubber</h2>
        <span className="chip bg-violet-100 text-violet-800 ring-violet-200">GPT-4o</span>
      </header>
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm"><span className="label">CPT / HCPCS</span><input className="input" value={cpt} onChange={(e) => setCpt(e.target.value)} placeholder="97161, 97110, 99213" /></label>
            <label className="block text-sm"><span className="label">ICD-10</span><input className="input" value={icd} onChange={(e) => setIcd(e.target.value)} placeholder="M54.5, M25.561" /></label>
            <label className="block text-sm col-span-2"><span className="label">Payer (search Stedi)</span>
              <PayerAutocomplete
                value={payerName}
                onChange={(v) => setPayerName(v)}
                onSelect={({ name, payerId }) => { setPayerName(name); setPayerId(payerId); }}
                placeholder="Search insurer / payer name…"
              />
              {payerId && <span className="text-[11px] text-slate-400">Stedi payer ID: <span className="font-mono">{payerId}</span></span>}
            </label>
            <label className="block text-sm col-span-2"><span className="label">Member / subscriber ID</span><input className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="UHC123456789" /></label>
          </div>
          <label className="block text-sm"><span className="label">Clinical note / superbill context</span>
            <textarea className="input min-h-[120px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paste the visit note or describe the services performed…" />
          </label>
          <div className="flex gap-2">
            <button onClick={runAi} disabled={busy !== null} className="btn-primary">{busy === "ai" ? "Reviewing…" : "AI coding review"}</button>
            <button onClick={runScrub} disabled={busy !== null} className="btn-secondary">{busy === "scrub" ? "Scrubbing…" : "Scrub claim"}</button>
          </div>
          {err && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{err}</div>}
        </div>

        <div className="space-y-3">
          {scrub && (
            <div className={`rounded-lg ring-1 p-3 ${scrub.readyToSubmit ? "ring-emerald-200 bg-emerald-50" : "ring-rose-200 bg-rose-50"}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Claim scrub</span>
                <span className={`chip ${scrub.readyToSubmit ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-800 ring-rose-200"}`}>{scrub.readyToSubmit ? "Ready to submit" : "Not ready"} · {scrub.environment.toUpperCase()}</span>
              </div>
              {scrub.errors.length > 0 && <ul className="mt-2 list-disc ml-5 text-sm text-rose-700">{scrub.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
              {scrub.warnings.length > 0 && <ul className="mt-2 list-disc ml-5 text-sm text-amber-700">{scrub.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
              {scrub.errors.length === 0 && scrub.warnings.length === 0 && <p className="mt-1 text-sm text-emerald-700">No issues found.</p>}
            </div>
          )}
          {review && (
            <div className="rounded-lg ring-1 ring-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">AI coding review</span>
                <span className={`chip ${review.cleanClaimReady ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>{review.cleanClaimReady ? "Clean" : "Needs review"}</span>
              </div>
              {review.summary && <p className="text-sm text-slate-700">{review.summary}</p>}
              {review.medicalNecessity && <p className="text-xs text-slate-500"><b>Medical necessity:</b> {review.medicalNecessity}</p>}
              {review.issues.length > 0 && (
                <ul className="text-sm space-y-0.5">{review.issues.map((i, k) => <li key={k} className={SEV[i.severity]}>• [{i.severity}] {i.message}</li>)}</ul>
              )}
              {review.suggestedCpt.length > 0 && (
                <div className="text-sm"><b className="text-slate-700">Suggested CPT:</b>
                  <ul className="ml-4 list-disc text-slate-600">{review.suggestedCpt.map((c, k) => <li key={k}><span className="font-mono">{c.code}</span>{c.modifier ? `-${c.modifier}` : ""} — {c.description} <span className="text-xs text-slate-400">{c.rationale}</span></li>)}</ul>
                </div>
              )}
              {review.suggestedIcd10.length > 0 && (
                <div className="text-sm"><b className="text-slate-700">Suggested ICD-10:</b>
                  <ul className="ml-4 list-disc text-slate-600">{review.suggestedIcd10.map((c, k) => <li key={k}><span className="font-mono">{c.code}</span> — {c.description} <span className="text-xs text-slate-400">{c.rationale}</span></li>)}</ul>
                </div>
              )}
              <p className="text-[11px] text-slate-400">AI draft guidance — a certified coder must verify. Not a compliance guarantee.</p>
            </div>
          )}
          {!scrub && !review && <p className="text-sm text-slate-400">Enter codes and a note, then run an AI review or scrub the claim before submission.</p>}
        </div>
      </div>
    </section>
  );
}
