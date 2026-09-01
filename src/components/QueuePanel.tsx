"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Entry = {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId?: string | null;
  providerName?: string | null;
  kind: string;
  status: string;
  reason?: string | null;
  scheduledAt?: string | null;
  checkInAt: string;
  inRoomAt?: string | null;
};
type Sched = {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName?: string | null;
  startsAt: string;
  status: string;
  reason?: string | null;
  alreadyQueued: boolean;
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDur(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${s}s`;
}
function waitColor(ms: number) {
  const m = ms / 60000;
  if (m >= 30) return "text-rose-600";
  if (m >= 15) return "text-amber-600";
  return "text-emerald-600";
}
function fmtTime(iso?: string | null) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}

export default function QueuePanel() {
  const [open, setOpen] = useState(true); // visible by default
  const [entries, setEntries] = useState<Entry[]>([]);
  const [scheduled, setScheduled] = useState<Sched[]>([]);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // walk-in search
  const [showWalkin, setShowWalkin] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/queue?day=${todayStr()}`);
      if (!r.ok) return;
      const d = await r.json();
      setEntries(d.entries || []);
      setScheduled(d.scheduled || []);
    } catch { /* keep prior */ }
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 12000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // debounced patient search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}&limit=8`);
        const d = await r.json();
        setResults(d.results || []);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [q]);

  async function checkInScheduled(a: Sched) {
    setBusy(a.id); setErr(null);
    try {
      const r = await fetch("/api/queue", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: a.patientId, appointmentId: a.id, providerId: a.providerId, providerName: a.providerName, scheduledAt: a.startsAt, reason: a.reason, kind: "scheduled", day: todayStr() }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "Failed");
      await load();
    } finally { setBusy(null); }
  }
  async function checkInWalkin(p: any) {
    setBusy(p.id); setErr(null);
    try {
      const r = await fetch("/api/queue", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: p.id, kind: "walkin", day: todayStr() }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "Failed");
      else { setQ(""); setResults([]); setShowWalkin(false); }
      await load();
    } finally { setBusy(null); }
  }
  async function setStatus(id: string, status: string) {
    setBusy(id); setErr(null);
    try {
      await fetch(`/api/queue/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      await load();
    } finally { setBusy(null); }
  }

  const inRoom = entries.filter((e) => e.status === "in-room");
  const waiting = entries
    .filter((e) => e.status === "waiting")
    .sort((a, b) => {
      const rank = (e: Entry) => (e.kind === "scheduled" ? 0 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime();
    });
  const done = entries.filter((e) => ["checked-out", "no-show", "rescheduled"].includes(e.status));
  const notArrived = scheduled.filter((a) => !a.alreadyQueued && !["completed", "no-show", "cancelled"].includes(a.status));
  const activeCount = inRoom.length + waiting.length;

  const Actions = ({ e }: { e: Entry }) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {e.status === "waiting" && (
        <button disabled={busy === e.id} onClick={() => setStatus(e.id, "in-room")} className="qbtn bg-brand-600 text-white">In room</button>
      )}
      <button disabled={busy === e.id} onClick={() => setStatus(e.id, "checked-out")} className="qbtn bg-emerald-600 text-white">Check out</button>
      <button disabled={busy === e.id} onClick={() => setStatus(e.id, "no-show")} className="qbtn bg-slate-200 text-slate-700">No-show</button>
      <button disabled={busy === e.id} onClick={() => setStatus(e.id, "rescheduled")} className="qbtn bg-slate-200 text-slate-700">Re-sched</button>
    </div>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Patient queue / waiting room"
        className="relative h-9 w-9 rounded-full hover:bg-slate-100 grid place-items-center text-slate-500"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-3-3" /></svg>
        {activeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-brand-600 text-white text-[10px] font-bold ring-2 ring-white">{activeCount}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[92vw] rounded-2xl bg-white ring-1 ring-slate-200 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white">
            <div>
              <div className="text-sm font-bold">Patient Queue</div>
              <div className="text-[10px] text-white/60">{activeCount} in line · {new Date().toLocaleDateString()}</div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowWalkin((s) => !s)} className="qbtn bg-white/10 text-white hover:bg-white/20">+ Walk-in</button>
              <button onClick={() => setOpen(false)} title="Fold up" className="h-7 w-7 grid place-items-center rounded-md hover:bg-white/10">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>
          </div>

          {err && <div className="px-4 py-2 text-xs text-rose-600 bg-rose-50">{err}</div>}

          {/* Walk-in search */}
          {showWalkin && (
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-600">Add walk-in (registered patients only)</span>
                <Link href="/patients/new" prefetch={false} className="text-[11px] text-brand-600 hover:underline">Register new patient →</Link>
              </div>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, MRN, DOB…" className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm" autoFocus />
              {searching && <div className="text-[11px] text-slate-400 mt-1">Searching…</div>}
              {results.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-y-auto divide-y divide-slate-100 rounded-md ring-1 ring-slate-200 bg-white">
                  {results.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-2 py-1.5 text-sm">
                      <span className="min-w-0"><span className="font-medium text-slate-800">{p.firstName} {p.lastName}</span> <span className="text-[11px] text-slate-400">MRN {p.mrn}</span></span>
                      <button disabled={busy === p.id} onClick={() => checkInWalkin(p)} className="qbtn bg-brand-600 text-white shrink-0">Check in</button>
                    </li>
                  ))}
                </ul>
              )}
              {q && !searching && results.length === 0 && <div className="text-[11px] text-slate-400 mt-1">No registered patient found. Use “Register new patient”.</div>}
            </div>
          )}

          <div className="max-h-[62vh] overflow-y-auto">
            {/* In room */}
            {inRoom.length > 0 && (
              <Section title="In room">
                {inRoom.map((e) => (
                  <Row key={e.id}>
                    <RowMain e={e} now={now} phase="room" />
                    <Actions e={e} />
                  </Row>
                ))}
              </Section>
            )}

            {/* Waiting line */}
            <Section title={`Waiting (${waiting.length})`}>
              {waiting.length === 0 && <Empty>No one waiting.</Empty>}
              {waiting.map((e, i) => (
                <Row key={e.id}>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white text-[11px] font-bold">{i + 1}</span>
                    <div className="flex-1 min-w-0"><RowMain e={e} now={now} phase="wait" /></div>
                  </div>
                  <div className="pl-8"><Actions e={e} /></div>
                </Row>
              ))}
            </Section>

            {/* Scheduled, not arrived */}
            {notArrived.length > 0 && (
              <Section title={`Scheduled today (${notArrived.length})`}>
                {notArrived.map((a) => (
                  <Row key={a.id}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{a.patientName}</div>
                        <div className="text-[11px] text-slate-400">{fmtTime(a.startsAt)}{a.providerName ? ` · ${a.providerName}` : ""}{a.reason ? ` · ${a.reason}` : ""}</div>
                      </div>
                      <button disabled={busy === a.id} onClick={() => checkInScheduled(a)} className="qbtn bg-brand-600 text-white shrink-0">Check in</button>
                    </div>
                  </Row>
                ))}
              </Section>
            )}

            {/* Done today */}
            {done.length > 0 && (
              <Section title={`Done today (${done.length})`}>
                {done.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-1.5 text-xs text-slate-500">
                    <span className="truncate">{e.patientName}</span>
                    <span className="uppercase text-[10px] font-semibold">{e.status === "checked-out" ? "checked out" : e.status}</span>
                  </div>
                ))}
              </Section>
            )}
          </div>
        </div>
      )}

      <style jsx>{`:global(.qbtn){font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px;line-height:1;transition:opacity .15s}
      :global(.qbtn:hover){opacity:.9}
      :global(.qbtn:disabled){opacity:.5}`}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100">
      <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="pb-1">{children}</div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-2">{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-2 text-xs text-slate-400">{children}</div>;
}
function RowMain({ e, now, phase }: { e: Entry; now: number; phase: "wait" | "room" }) {
  const waitMs = now - new Date(e.checkInAt).getTime();
  const roomMs = e.inRoomAt ? now - new Date(e.inRoomAt).getTime() : 0;
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-slate-800 truncate">{e.patientName}</span>
          <span className="shrink-0"><span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${e.kind === "scheduled" ? "bg-brand-100 text-brand-700" : "bg-amber-100 text-amber-700"}`}>{e.kind === "scheduled" ? "Sched" : "Walk-in"}</span></span>
        </div>
        <div className="text-[11px] text-slate-400 truncate">
          Arrived {fmtTime(e.checkInAt)}{e.providerName ? ` · ${e.providerName}` : ""}{e.reason ? ` · ${e.reason}` : ""}
        </div>
      </div>
      <div className="text-right shrink-0">
        {phase === "room" ? (
          <><div className="text-xs font-bold text-brand-600 tabular-nums">{fmtDur(roomMs)}</div><div className="text-[9px] text-slate-400">in room</div></>
        ) : (
          <><div className={`text-xs font-bold tabular-nums ${waitColor(waitMs)}`}>{fmtDur(waitMs)}</div><div className="text-[9px] text-slate-400">waiting</div></>
        )}
      </div>
    </div>
  );
}
