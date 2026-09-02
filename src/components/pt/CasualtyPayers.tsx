"use client";

import React, { useEffect, useState } from "react";

type Payer = { id: string; name: string; stediId: string | null; casualty: boolean; supportsClaims: boolean; active: boolean };
type Enrollment = { id: string; payerId: string; payerName: string | null; status: string; stediEnrollmentId: string | null };

function pickName(r: any): string {
  return r.displayName || r.name || r.payerName || r.primaryPayerId || "(unnamed payer)";
}
function pickId(r: any): string {
  return String(r.stediId || r.payerId || r.tradingPartnerServiceId || r.primaryPayerId || r.id || "");
}

export default function CasualtyPayers() {
  const [payers, setPayers] = useState<Payer[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  // Stedi live search
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  // connection diagnostic
  const [conn, setConn] = useState<{ state: "idle" | "ok" | "err" | "testing"; text: string }>({ state: "idle", text: "" });

  // manual add
  const [mName, setMName] = useState("");
  const [mId, setMId] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        fetch("/api/stedi/payers").then((r) => r.json()),
        fetch("/api/stedi/enrollments").then((r) => r.json()).catch(() => ({ enrollments: [] })),
      ]);
      setPayers((p.payers || []).filter((x: Payer) => x.casualty));
      setEnrollments(e.enrollments || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function testConnection() {
    setConn({ state: "testing", text: "Contacting Stedi…" });
    try {
      const r = await fetch(`/api/stedi/payers?stedi=${encodeURIComponent(q.trim() || "aetna")}`);
      const d = await r.json();
      if (r.ok && Array.isArray(d.results)) setConn({ state: "ok", text: `Connected — Stedi returned ${d.results.length} payer match(es).` });
      else setConn({ state: "err", text: d.error || "Stedi did not return results." });
    } catch (e: any) { setConn({ state: "err", text: `Request failed: ${String(e?.message || e).slice(0, 200)}` }); }
  }

  async function searchStedi() {
    if (q.trim().length < 2) return;
    setSearching(true); setSearchMsg(null); setResults([]);
    try {
      const r = await fetch(`/api/stedi/payers?stedi=${encodeURIComponent(q.trim())}`);
      const d = await r.json();
      if (!r.ok) { setSearchMsg(d.error || "Search failed."); }
      else if (d.error) { setSearchMsg(d.error); }
      else { setResults(d.results || []); if (!(d.results || []).length) setSearchMsg("No payers matched."); }
    } catch (e: any) { setSearchMsg(`Request failed: ${String(e?.message || e).slice(0, 200)}`); }
    finally { setSearching(false); }
  }

  async function savePayer(name: string, stediId: string) {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/stedi/payers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), stediId: stediId.trim() || null, casualty: true, supportsClaims: true, supportsEligibility: true }),
      });
      setMName(""); setMId("");
      await load();
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  async function removePayer(id: string) {
    setBusy(true);
    try { await fetch(`/api/stedi/payers?id=${id}`, { method: "DELETE" }); await load(); }
    catch { /* ignore */ } finally { setBusy(false); }
  }

  async function requestEnrollment(p: Payer) {
    if (!p.stediId) { alert("Add the Stedi payer ID first."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/stedi/enrollments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payerIdOrAlias: p.stediId, payerName: p.name, transactions: { claims: true, claimPayment: true }, submit: false }),
      });
      const d = await r.json();
      if (d.error) alert(d.error);
      await load();
    } catch (e: any) { alert(String(e?.message || e)); } finally { setBusy(false); }
  }

  const enrByPayer = new Map(enrollments.map((e) => [e.payerId, e]));

  return (
    <div className="space-y-4 max-w-5xl">
      <section className="card card-pad">
        <h1 className="text-lg font-bold text-slate-900">Auto / PIP Casualty Payers</h1>
        <p className="text-sm text-slate-500">Find and save the auto / personal-injury-protection (PIP) / med-pay payers you bill through <b>Stedi</b>. Saved casualty payers appear in the PT Claims &quot;Prepare &amp; submit&quot; picker.</p>
        <div className={`mt-3 rounded-lg px-3 py-2 text-sm ring-1 ${conn.state === "ok" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : conn.state === "err" ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-slate-50 text-slate-600 ring-slate-200"}`}>
          <div className="flex items-center justify-between gap-2">
            <span>{conn.state === "idle" ? "Test your Stedi connection before enrolling casualty payers." : conn.text}</span>
            <button onClick={testConnection} disabled={conn.state === "testing"} className="btn-secondary shrink-0">{conn.state === "testing" ? "Testing…" : "Test connection"}</button>
          </div>
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="font-semibold text-slate-900">Search the Stedi payer directory</h2>
        <div className="mt-2 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchStedi()} placeholder="e.g. GEICO, State Farm, Progressive, Allstate…" className="input flex-1" />
          <button onClick={searchStedi} disabled={searching} className="btn-primary shrink-0">{searching ? "Searching…" : "Search Stedi"}</button>
        </div>
        {searchMsg && <div className="mt-2 text-xs text-amber-700">{searchMsg}</div>}
        {results.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-slate-800">{pickName(r)}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{pickId(r) || "no id"}</div>
                </div>
                <button onClick={() => savePayer(pickName(r), pickId(r))} disabled={busy} className="btn-secondary shrink-0">Save as casualty payer</button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Or add manually</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Payer name (e.g. GEICO Casualty)" className="input flex-1" />
            <input value={mId} onChange={(e) => setMId(e.target.value)} placeholder="Stedi payer ID (optional)" className="input sm:w-56 font-mono" />
            <button onClick={() => savePayer(mName, mId)} disabled={busy || !mName.trim()} className="btn-primary shrink-0">Add</button>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Saved casualty payers ({payers.length})</header>
        {loading ? (
          <div className="p-4 text-sm text-slate-400">Loading…</div>
        ) : payers.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">None yet. Search or add a payer above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr><th className="text-left px-4 py-2">Payer</th><th className="text-left px-4 py-2">Stedi ID</th><th className="text-left px-4 py-2">Claims enrollment</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payers.map((p) => {
                const enr = p.stediId ? enrByPayer.get(p.stediId) : undefined;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.stediId || "—"}</td>
                    <td className="px-4 py-2">
                      {enr ? (
                        <span className={`chip ${/complete|active|approved/i.test(enr.status) ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{enr.status}</span>
                      ) : (
                        <button onClick={() => requestEnrollment(p)} disabled={busy} className="text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-50">Request claims enrollment</button>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => removePayer(p.id)} disabled={busy} className="text-xs text-rose-500 hover:underline">Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs text-slate-400">Live submission stays gated until the specific casualty payer’s claims enrollment is active on your Stedi account. Preview and production have separate Stedi configuration.</p>
    </div>
  );
}
