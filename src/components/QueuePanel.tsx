"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Entry = {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId?: string | null;
  providerId?: string | null;
  providerName?: string | null;
  kind: string;
  status: string;
  reason?: string | null;
  scheduledAt?: string | null;
  checkInAt: string;
  inRoomAt?: string | null;
  room?: string | null;
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
type QUser = { id: string; firstName: string; lastName: string; role: string };
type Provider = { id: string; firstName: string; lastName: string; credential?: string | null };
type Service = { id: string; name: string; durationMin: number; category?: string };

type SF = {
  mode: "new" | "move";
  patientId: string;
  patientName: string;
  appointmentId?: string;
  fromEntryId?: string; // queue entry to mark 'rescheduled' after a successful move/new
  day: string;
  time: string;
  providerId: string;
  serviceTypeId: string;
  reason: string;
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayStrOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function hhmmOf(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
function fmtDayShort(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function nextSlot() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  let hh = d.getHours();
  if (hh < 9) return "09:00";
  if (hh >= 20) return "09:00";
  return hhmmOf(d);
}

export default function QueuePanel({ user }: { user?: QUser }) {
  const [open, setOpen] = useState(true); // visible by default
  const [entries, setEntries] = useState<Entry[]>([]);
  const [scheduled, setScheduled] = useState<Sched[]>([]);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // walk-in search
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<any>(null);

  // provider filter
  const [providerFilter, setProviderFilter] = useState<string>("all");

  // room assignment inline editor
  const [roomEditId, setRoomEditId] = useState<string | null>(null);
  const [roomVal, setRoomVal] = useState("");

  // schedule / reschedule form
  const [sf, setSf] = useState<SF | null>(null);
  const [sfBusy, setSfBusy] = useState(false);
  const [refs, setRefs] = useState<{ providers: Provider[]; services: Service[] }>({ providers: [], services: [] });
  const refsLoaded = useRef(false);

  // long-wait sound + toast alerts
  const [muted, setMuted] = useState(false);
  const [threshMin, setThreshMin] = useState(15); // configurable long-wait alert threshold
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  const alertedRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<any>(null);
  const dayKey = todayStr();

  useEffect(() => {
    try {
      setMuted(localStorage.getItem("queueMuted") === "1");
      const tm = Number(localStorage.getItem("queueThreshMin"));
      if (tm && tm > 0) setThreshMin(tm);
      const raw = localStorage.getItem(`queueAlerted:${dayKey}`);
      if (raw) alertedRef.current = new Set(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [dayKey]);

  function changeThresh(v: number) {
    setThreshMin(v);
    try { localStorage.setItem("queueThreshMin", String(v)); } catch { /* ignore */ }
  }

  function persistAlerted() {
    try { localStorage.setItem(`queueAlerted:${dayKey}`, JSON.stringify([...alertedRef.current])); } catch { /* ignore */ }
  }
  function toggleMute() {
    setMuted((m) => { const n = !m; try { localStorage.setItem("queueMuted", n ? "1" : "0"); } catch {} return n; });
  }
  function playChime() {
    if (muted) return;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!audioRef.current) audioRef.current = new AC();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const play = (freq: number, start: number, dur: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        o.connect(g); g.connect(ctx.destination);
        const t0 = ctx.currentTime + start;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.start(t0); o.stop(t0 + dur + 0.02);
      };
      play(880, 0, 0.35);
      play(1174, 0.18, 0.4);
    } catch { /* ignore */ }
  }
  function pushToast(text: string) {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 8000);
  }

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/queue?day=${todayStr()}`);
      if (!r.ok) return;
      const d = await r.json();
      setEntries(d.entries || []);
      setScheduled(d.scheduled || []);
    } catch { /* keep prior */ }
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  async function manualRefresh() {
    setRefreshing(true);
    await load();
    setTimeout(() => setRefreshing(false), 500);
  }

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

  async function loadRefs() {
    if (refsLoaded.current) return;
    try {
      // far-future window returns no appointments but the full provider/service lists
      const r = await fetch(`/api/appointments?from=2100-01-01&to=2100-01-01`);
      const d = await r.json();
      setRefs({ providers: d.providers || [], services: d.services || [] });
      refsLoaded.current = true;
    } catch { /* ignore */ }
  }

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
      else { setQ(""); setResults([]); }
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
  async function saveRoom(id: string) {
    setBusy(id); setErr(null);
    try {
      await fetch(`/api/queue/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room: roomVal }) });
      setRoomEditId(null); setRoomVal("");
      await load();
    } finally { setBusy(null); }
  }
  async function apptNoShow(appointmentId: string) {
    setBusy(appointmentId); setErr(null);
    try {
      await fetch("/api/appointments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: appointmentId, status: "no-show" }) });
      await load();
    } finally { setBusy(null); }
  }

  // ---- schedule / reschedule form openers ----
  function openScheduleForPatient(p: any) {
    loadRefs();
    setSf({ mode: "new", patientId: p.id, patientName: `${p.firstName} ${p.lastName}`, day: todayStr(), time: nextSlot(), providerId: "", serviceTypeId: "", reason: "" });
  }
  function openScheduleForEntry(e: Entry) {
    loadRefs();
    setSf({ mode: "new", patientId: e.patientId, patientName: e.patientName, fromEntryId: e.id, day: todayStr(), time: nextSlot(), providerId: e.providerId || "", serviceTypeId: "", reason: e.reason || "" });
  }
  function openReschedule(appointmentId: string, patientName: string, startsAt: string, providerId: string, fromEntryId?: string) {
    loadRefs();
    const d = new Date(startsAt);
    setSf({ mode: "move", patientId: "", patientName, appointmentId, fromEntryId, day: dayStrOf(d), time: hhmmOf(d), providerId: providerId || "", serviceTypeId: "", reason: "" });
  }
  async function submitSf() {
    if (!sf) return;
    setErr(null);
    if (sf.mode === "new" && !sf.providerId) { setErr("Choose a provider"); return; }
    setSfBusy(true);
    try {
      let ok = false;
      if (sf.mode === "new") {
        const r = await fetch("/api/appointments", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId: sf.patientId, providerId: sf.providerId, serviceTypeId: sf.serviceTypeId || undefined, day: sf.day, time: sf.time, reason: sf.reason || undefined }),
        });
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "Could not schedule"); }
        else ok = true;
      } else {
        const r = await fetch("/api/appointments", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: sf.appointmentId, day: sf.day, time: sf.time, ...(sf.providerId ? { providerId: sf.providerId } : {}) }),
        });
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "Could not reschedule"); }
        else ok = true;
      }
      if (ok) {
        if (sf.fromEntryId) {
          await fetch(`/api/queue/${sf.fromEntryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rescheduled" }) });
        }
        setSf(null); setQ(""); setResults([]);
        await load();
      }
    } finally { setSfBusy(false); }
  }

  // Long-wait watcher: chime + toast when someone crosses the set threshold.
  useEffect(() => {
    const THRESH = threshMin * 60 * 1000;
    let fired = false;
    for (const e of entries) {
      if (e.status !== "waiting") continue;
      const waitMs = now - new Date(e.checkInAt).getTime();
      if (waitMs >= THRESH && !alertedRef.current.has(e.id)) {
        alertedRef.current.add(e.id);
        pushToast(`${e.patientName} has been waiting over ${threshMin} minutes.`);
        fired = true;
      }
    }
    if (fired) { persistAlerted(); playChime(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, entries, threshMin]);

  // provider filter
  const matchProv = (providerId?: string | null) => {
    if (providerFilter === "all") return true;
    if (providerFilter === "mine") return !!user && providerId === user.id;
    return providerId === providerFilter;
  };

  const inRoom = entries.filter((e) => e.status === "in-room" && matchProv(e.providerId));
  const waiting = entries
    .filter((e) => e.status === "waiting" && matchProv(e.providerId))
    .sort((a, b) => {
      const rank = (e: Entry) => (e.kind === "scheduled" ? 0 : 1);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime();
    });
  const done = entries.filter((e) => ["checked-out", "no-show", "rescheduled"].includes(e.status) && matchProv(e.providerId));
  const notArrived = scheduled.filter((a) => !a.alreadyQueued && !["completed", "no-show", "cancelled"].includes(a.status) && matchProv(a.providerId))
    .sort((x, y) => new Date(x.startsAt).getTime() - new Date(y.startsAt).getTime());
  const waitingCount = waiting.length;
  const inRoomCount = inRoom.length;

  const providerOpts = (() => {
    const m = new Map<string, string>();
    for (const e of entries) if (e.providerId && e.providerName) m.set(e.providerId, e.providerName);
    for (const a of scheduled) if (a.providerId && a.providerName) m.set(a.providerId, a.providerName);
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((x, y) => x.name.localeCompare(y.name));
  })();

  const report = (() => {
    const total = entries.length;
    const noShow = entries.filter((e) => e.status === "no-show").length;
    const checkedOut = entries.filter((e) => e.status === "checked-out").length;
    const rescheduled = entries.filter((e) => e.status === "rescheduled").length;
    const walkins = entries.filter((e) => e.kind === "walkin").length;
    const scheduledCount = entries.filter((e) => e.kind === "scheduled").length;
    const seenWaits = entries
      .filter((e) => e.inRoomAt)
      .map((e) => new Date(e.inRoomAt as string).getTime() - new Date(e.checkInAt).getTime())
      .filter((ms) => ms >= 0);
    const seen = seenWaits.length;
    const avgWaitMs = seen ? seenWaits.reduce((s, x) => s + x, 0) / seen : 0;
    const longestWaitMs = seenWaits.length ? Math.max(...seenWaits) : 0;
    return { total, noShow, checkedOut, rescheduled, walkins, scheduledCount, seen, avgWaitMs, longestWaitMs };
  })();

  const badgeCount = inRoomCount + waitingCount;

  const RoomCtl = ({ e }: { e: Entry }) => (
    roomEditId === e.id ? (
      <span className="flex items-center gap-1">
        <input value={roomVal} onChange={(ev) => setRoomVal(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") saveRoom(e.id); if (ev.key === "Escape") { setRoomEditId(null); setRoomVal(""); } }} placeholder="Room #" autoFocus className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs" />
        <button disabled={busy === e.id} onClick={() => saveRoom(e.id)} className="qbtn bg-indigo-600 text-white">Save</button>
        <button onClick={() => { setRoomEditId(null); setRoomVal(""); }} className="qbtn bg-slate-100 text-slate-600 ring-1 ring-slate-200">Cancel</button>
      </span>
    ) : (
      <button onClick={() => { setRoomEditId(e.id); setRoomVal(e.room || ""); }} className={`qbtn ${e.room ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"}`} title="Assign room">{e.room ? `Room ${e.room}` : "+ Room"}</button>
    )
  );

  const WaitBtn = ({ e }: { e: Entry }) => (
    <div className="flex flex-wrap gap-1 mt-1.5">
      <button disabled={busy === e.id} onClick={() => setStatus(e.id, "in-room")} className="qbtn bg-indigo-600 text-white">In room</button>
      <RoomCtl e={e} />
      <button disabled={busy === e.id} onClick={() => setStatus(e.id, "checked-out")} className="qbtn bg-emerald-600 text-white">Check out</button>
      <button disabled={busy === e.id} onClick={() => setStatus(e.id, "no-show")} className="qbtn bg-slate-100 text-slate-600 ring-1 ring-slate-200">No-show</button>
      <button disabled={busy === e.id} onClick={() => e.appointmentId ? openReschedule(e.appointmentId, e.patientName, e.scheduledAt || e.checkInAt, e.providerId || "", e.id) : openScheduleForEntry(e)} className="qbtn bg-violet-100 text-violet-700 ring-1 ring-violet-200">Reschedule</button>
    </div>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Waiting Room"
        className="relative h-9 w-9 rounded-lg bg-blue-600 hover:bg-blue-700 grid place-items-center text-white shadow-sm transition-colors"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-3-3" /></svg>
        {badgeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-[5px] bg-red-600 text-white text-[10px] font-bold ring-2 ring-white">{badgeCount}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[420px] max-w-[94vw] rounded-2xl bg-white ring-1 ring-slate-200 shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 text-white">
            <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
              <span className="text-[15px] font-extrabold tracking-tight whitespace-nowrap truncate">Waiting Room</span>
              <span className="hidden sm:inline text-[11px] text-white/70 whitespace-nowrap shrink-0">{fmtDayShort()}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="pill">Waiting {waitingCount}</span>
              <span className="pill">In-room {inRoomCount}</span>
              <button onClick={manualRefresh} title="Refresh now" className="h-7 w-7 grid place-items-center rounded-md hover:bg-white/15">
                <svg className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 8a8 8 0 00-14.9-2M4 16a8 8 0 0014.9 2" /></svg>
              </button>
              <button onClick={toggleMute} title={muted ? "Unmute long-wait alerts" : "Mute long-wait alerts"} className="h-7 w-7 grid place-items-center rounded-md hover:bg-white/15">
                {muted ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M23 9l-6 6M17 9l6 6" /></svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /></svg>
                )}
              </button>
              <button onClick={() => setOpen(false)} title="Fold up" className="h-7 w-7 grid place-items-center rounded-md hover:bg-white/15">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>
          </div>

          {/* Search / add walk-in */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add walk-in — search registered patient…" className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none" />
              </div>
              <Link href="/patients/new" prefetch={false} className="shrink-0 rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 px-3 py-2 text-xs font-semibold hover:bg-indigo-100 whitespace-nowrap">+ New patient</Link>
            </div>
            {searching && <div className="text-[11px] text-slate-400 mt-1.5">Searching…</div>}
            {results.length > 0 && (
              <ul className="mt-2 max-h-52 overflow-y-auto divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200 bg-white">
                {results.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-2.5 py-2 text-sm">
                    <span className="min-w-0"><span className="font-medium text-slate-800">{p.firstName} {p.lastName}</span> <span className="text-[11px] text-slate-400">MRN {p.mrn}</span></span>
                    <span className="flex items-center gap-1 shrink-0">
                      <button disabled={busy === p.id} onClick={() => checkInWalkin(p)} className="qbtn bg-indigo-600 text-white">Check in</button>
                      <button onClick={() => openScheduleForPatient(p)} className="qbtn bg-violet-100 text-violet-700 ring-1 ring-violet-200">Schedule</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {q && !searching && results.length === 0 && <div className="text-[11px] text-slate-400 mt-1.5">No registered patient found. Use “+ New patient”.</div>}
          </div>

          {/* Provider filter + wait-alert threshold */}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-y border-slate-100">
            <label className="flex items-center gap-1 text-[11px] text-slate-500">
              <span className="font-semibold uppercase tracking-wide text-[10px]">View</span>
              <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 max-w-[120px]">
                <option value="all">All providers</option>
                {user && user.role === "provider" && <option value="mine">My patients</option>}
                {providerOpts.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-[11px] text-slate-500" title="Long-wait alert threshold">
              <span className="font-semibold uppercase tracking-wide text-[10px]">Alert</span>
              <select value={threshMin} onChange={(e) => changeThresh(Number(e.target.value))} className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-700">
                {[5, 10, 15, 20, 30, 45].map((m) => <option key={m} value={m}>{`>${m}m`}</option>)}
              </select>
            </label>
          </div>

          {err && <div className="px-4 py-2 text-xs text-rose-600 bg-rose-50">{err}</div>}

          {/* Body */}
          <div className="max-h-[58vh] overflow-y-auto">
            {/* In room */}
            {inRoom.length > 0 && (
              <Section title={`In room (${inRoom.length})`} accent="violet">
                {inRoom.map((e) => (
                  <Row key={e.id}>
                    <RowMain e={e} now={now} phase="room" />
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      <RoomCtl e={e} />
                      <button disabled={busy === e.id} onClick={() => setStatus(e.id, "checked-out")} className="qbtn bg-emerald-600 text-white">Check out</button>
                      <button disabled={busy === e.id} onClick={() => setStatus(e.id, "no-show")} className="qbtn bg-slate-100 text-slate-600 ring-1 ring-slate-200">No-show</button>
                    </div>
                  </Row>
                ))}
              </Section>
            )}

            {/* In line (waiting) */}
            <Section title={`In line (${waiting.length})`} accent="indigo">
              {waiting.length === 0 && <Empty>No one is currently waiting.</Empty>}
              {waiting.map((e, i) => {
                const over = (now - new Date(e.checkInAt).getTime()) >= threshMin * 60000;
                return (
                  <Row key={e.id} flag={over}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-[11px] font-bold ${over ? "bg-rose-500" : "bg-indigo-600"}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <RowMain e={e} now={now} phase="wait" />
                        {over && (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-rose-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />Waiting over {threshMin}m
                          </div>
                        )}
                        <WaitBtn e={e} />
                      </div>
                    </div>
                  </Row>
                );
              })}
            </Section>

            {/* Expected — scheduled, not arrived */}
            <Section title={`Expected — scheduled, not arrived (${notArrived.length})`} accent="slate">
              {notArrived.length === 0 && <Empty>No pending scheduled arrivals.</Empty>}
              {notArrived.map((a) => (
                <Row key={a.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{a.patientName}</div>
                      <div className="text-[11px] text-slate-400">{fmtTime(a.startsAt)}{a.providerName ? ` · ${a.providerName}` : ""}{a.reason ? ` · ${a.reason}` : ""}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <button disabled={busy === a.id} onClick={() => checkInScheduled(a)} className="qbtn bg-indigo-600 text-white">Check in</button>
                    <button disabled={busy === a.id} onClick={() => openReschedule(a.id, a.patientName, a.startsAt, a.providerId)} className="qbtn bg-violet-100 text-violet-700 ring-1 ring-violet-200">Reschedule</button>
                    <button disabled={busy === a.id} onClick={() => apptNoShow(a.id)} className="qbtn bg-slate-100 text-slate-600 ring-1 ring-slate-200">No-show</button>
                  </div>
                </Row>
              ))}
            </Section>

            {/* Done today */}
            {done.length > 0 && (
              <Section title={`Done today (${done.length})`} accent="slate">
                {done.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-1.5 text-xs text-slate-500">
                    <span className="truncate">{e.patientName}</span>
                    <span className="uppercase text-[10px] font-semibold">{e.status === "checked-out" ? "checked out" : e.status}</span>
                  </div>
                ))}
              </Section>
            )}
          </div>

          {/* Today's recap (inline) */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Today's recap</div>
            <div className="grid grid-cols-3 gap-2">
              <RecapCard label="Seen" value={report.seen} tone="emerald" />
              <RecapCard label="No-shows" value={report.noShow} tone="rose" />
              <RecapCard label="Avg wait" value={report.seen ? fmtDur(report.avgWaitMs) : "—"} tone="slate" />
            </div>
            <div className="mt-2 flex items-center gap-5 text-[11px] text-slate-500">
              <span>Walk-ins: <span className="font-bold text-slate-700">{report.walkins}</span></span>
              <span>Rescheduled: <span className="font-bold text-slate-700">{report.rescheduled}</span></span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400">
            Shared live queue · scheduled patients are prioritized by arrival · updates every 15s
          </div>

          {/* Schedule / reschedule form overlay */}
          {sf && (
            <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-sm flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-bold text-slate-800">{sf.mode === "new" ? "Schedule appointment" : "Reschedule appointment"}</div>
                <button onClick={() => { setSf(null); setErr(null); }} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
              </div>
              <div className="px-4 py-3 space-y-2.5 overflow-y-auto">
                <div className="text-xs text-slate-500">Patient: <span className="font-semibold text-slate-800">{sf.patientName}</span></div>
                {sf.mode === "new" && (
                  <>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-500">Provider *</span>
                      <select value={sf.providerId} onChange={(e) => setSf({ ...sf, providerId: e.target.value })} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                        <option value="">Select provider…</option>
                        {refs.providers.map((p) => (<option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.credential ? `, ${p.credential}` : ""}</option>))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-500">Service</span>
                      <select value={sf.serviceTypeId} onChange={(e) => setSf({ ...sf, serviceTypeId: e.target.value })} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                        <option value="">Default (30 min)</option>
                        {refs.services.map((s) => (<option key={s.id} value={s.id}>{s.name} · {s.durationMin}m</option>))}
                      </select>
                    </label>
                  </>
                )}
                {sf.mode === "move" && refs.providers.length > 0 && (
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-500">Provider</span>
                    <select value={sf.providerId} onChange={(e) => setSf({ ...sf, providerId: e.target.value })} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                      <option value="">Keep current provider</option>
                      {refs.providers.map((p) => (<option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.credential ? `, ${p.credential}` : ""}</option>))}
                    </select>
                  </label>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-500">Date</span>
                    <input type="date" value={sf.day} onChange={(e) => setSf({ ...sf, day: e.target.value })} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-500">Time</span>
                    <input type="time" value={sf.time} onChange={(e) => setSf({ ...sf, time: e.target.value })} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                  </label>
                </div>
                {sf.mode === "new" && (
                  <label className="block">
                    <span className="text-[11px] font-semibold text-slate-500">Reason</span>
                    <input value={sf.reason} onChange={(e) => setSf({ ...sf, reason: e.target.value })} placeholder="Office visit" className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                  </label>
                )}
                <div className="text-[10px] text-slate-400">Clinic hours 9:00 AM – 8:00 PM. Double-bookings are blocked.</div>
                {err && <div className="text-xs text-rose-600">{err}</div>}
              </div>
              <div className="mt-auto flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100">
                <button onClick={() => { setSf(null); setErr(null); }} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button disabled={sfBusy} onClick={submitSf} className="rounded-lg bg-indigo-600 text-white px-4 py-1.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">{sfBusy ? "Saving…" : (sf.mode === "new" ? "Schedule" : "Reschedule")}</button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Long-wait toast alerts */}
      {toasts.length > 0 && (
        <div className="fixed top-16 right-4 z-[60] flex flex-col gap-2 w-[300px] max-w-[90vw]">
          {toasts.map((t) => (
            <div key={t.id} className="flex items-start gap-2 rounded-xl bg-white ring-1 ring-amber-200 shadow-lg px-3 py-2.5">
              <span className="mt-0.5 h-6 w-6 shrink-0 grid place-items-center rounded-full bg-amber-100 text-amber-600">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M10.29 3.86l-8.48 14.7A1.5 1.5 0 003.11 21h17.78a1.5 1.5 0 001.3-2.44l-8.48-14.7a1.5 1.5 0 00-2.62 0z" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-800">Long wait</div>
                <div className="text-[11px] text-slate-600">{t.text}</div>
              </div>
              <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-slate-400 hover:text-slate-600 text-sm leading-none">×</button>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        :global(.qbtn){font-size:11px;font-weight:600;padding:4px 9px;border-radius:7px;line-height:1;transition:opacity .15s, background-color .15s}
        :global(.qbtn:hover){opacity:.92}
        :global(.qbtn:disabled){opacity:.5;cursor:not-allowed}
        :global(.pill){font-size:10px;font-weight:700;padding:3px 8px;border-radius:9999px;background:rgba(255,255,255,.18);color:#fff;line-height:1;white-space:nowrap}
      `}</style>
    </div>
  );
}

function Section({ title, children, accent = "slate" }: { title: string; children: React.ReactNode; accent?: "indigo" | "violet" | "slate" }) {
  const dot = accent === "indigo" ? "bg-indigo-500" : accent === "violet" ? "bg-violet-500" : "bg-slate-300";
  return (
    <div className="border-b border-slate-100">
      <div className="px-4 pt-2.5 pb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{title}
      </div>
      <div className="pb-1">{children}</div>
    </div>
  );
}
function Row({ children, flag }: { children: React.ReactNode; flag?: boolean }) {
  return <div className={`px-4 py-2 ${flag ? "bg-rose-50 border-l-2 border-rose-400" : ""}`}>{children}</div>;
}
function RecapCard({ label, value, tone }: { label: string; value: React.ReactNode; tone: "emerald" | "rose" | "slate" }) {
  const bg: Record<string, string> = {
    emerald: "bg-emerald-50 ring-emerald-100", rose: "bg-rose-50 ring-rose-100", slate: "bg-slate-100 ring-slate-200",
  };
  const fg: Record<string, string> = {
    emerald: "text-emerald-600", rose: "text-rose-600", slate: "text-slate-500",
  };
  return (
    <div className={`rounded-xl ring-1 px-2 py-2.5 text-center ${bg[tone]}`}>
      <div className={`text-lg font-extrabold tabular-nums leading-none ${fg[tone]}`}>{value}</div>
      <div className="mt-1 text-[10px] font-semibold text-slate-500">{label}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4 text-center text-xs text-slate-400">{children}</div>;
}
function RowMain({ e, now, phase }: { e: Entry; now: number; phase: "wait" | "room" }) {
  const waitMs = now - new Date(e.checkInAt).getTime();
  const roomMs = e.inRoomAt ? now - new Date(e.inRoomAt).getTime() : 0;
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-slate-800 truncate">{e.patientName}</span>
          <span className="shrink-0"><span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${e.kind === "scheduled" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>{e.kind === "scheduled" ? "Sched" : "Walk-in"}</span></span>
          {e.room && <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">Rm {e.room}</span>}
        </div>
        <div className="text-[11px] text-slate-400 truncate">
          Arrived {fmtTime(e.checkInAt)}{e.providerName ? ` · ${e.providerName}` : ""}{e.reason ? ` · ${e.reason}` : ""}
        </div>
      </div>
      <div className="text-right shrink-0">
        {phase === "room" ? (
          <><div className="text-xs font-bold text-violet-600 tabular-nums">{fmtDur(roomMs)}</div><div className="text-[9px] text-slate-400">in room</div></>
        ) : (
          <><div className={`text-xs font-bold tabular-nums ${waitColor(waitMs)}`}>{fmtDur(waitMs)}</div><div className="text-[9px] text-slate-400">waiting</div></>
        )}
      </div>
    </div>
  );
}
