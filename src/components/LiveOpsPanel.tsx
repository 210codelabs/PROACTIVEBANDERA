"use client";

import { useEffect, useRef, useState } from "react";

type Metrics = {
  apptsToday: number;
  checkedIn: number;
  inRoom: number;
  completed: number;
  noShow: number;
  waiting: number;
  throughputPct: number;
  openEncounters: number;
  pendingRx: number;
  pendingLabs: number;
  sentRxToday: number;
  unreadMessages: number;
};

const REFRESH_MS = 15000;

function timeLabel(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

export default function LiveOpsPanel({ initialMetrics }: { initialMetrics: Metrics }) {
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [pulseKey, setPulseKey] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;

    async function tick() {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/reporting/live", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (active && data?.metrics) {
          setMetrics(data.metrics as Metrics);
          setUpdatedAt(typeof data.at === "string" ? data.at : null);
          setLive(true);
          setPulseKey((k) => k + 1);
        }
      } catch {
        if (active) setLive(false);
      }
    }

    void tick();
    timer.current = setInterval(tick, REFRESH_MS);
    return () => {
      active = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const flow = [
    { label: "Scheduled", value: metrics.apptsToday - metrics.waiting - metrics.completed - metrics.noShow, tone: "slate" as const },
    { label: "Checked-in", value: metrics.checkedIn, tone: "amber" as const },
    { label: "In room", value: metrics.inRoom, tone: "violet" as const },
    { label: "Completed", value: metrics.completed, tone: "emerald" as const },
    { label: "No-show", value: metrics.noShow, tone: "rose" as const },
  ];
  const flowMax = Math.max(1, ...flow.map((f) => Math.max(0, f.value)));

  const toneBar: Record<string, string> = {
    slate: "bg-slate-400",
    amber: "bg-amber-400",
    violet: "bg-violet-400",
    emerald: "bg-emerald-400",
    rose: "bg-rose-400",
  };

  return (
    <section className="card overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-[var(--navy-900)] to-[var(--navy-800)] text-white">
        <div className="flex items-center gap-2">
          <span className={live ? "live-dot" : "h-2 w-2 rounded-full bg-rose-400"} />
          <span className="font-semibold">Live Operations</span>
        </div>
        <span className="text-[11px] text-teal-100/80">
          {live ? `Updated ${timeLabel(updatedAt)} · auto-refresh ${REFRESH_MS / 1000}s` : "Reconnecting…"}
        </span>
      </header>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <LiveStat key={`a-${pulseKey}`} label="Today" value={metrics.apptsToday} tone="brand" />
        <LiveStat key={`b-${pulseKey}`} label="Waiting" value={metrics.waiting} tone="amber" />
        <LiveStat key={`c-${pulseKey}`} label="Completed" value={metrics.completed} tone="emerald" />
        <LiveStat key={`d-${pulseKey}`} label="Open notes" value={metrics.openEncounters} tone="violet" />
        <LiveStat key={`e-${pulseKey}`} label="Pending Rx" value={metrics.pendingRx} tone="rose" />
        <LiveStat key={`f-${pulseKey}`} label="Rx sent today" value={metrics.sentRxToday} tone="teal" />
      </div>

      <div className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Patient flow meter */}
        <div className="rounded-lg ring-1 ring-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="section-title">Patient Flow · Today</div>
            <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200">{metrics.throughputPct}% complete</span>
          </div>
          <div className="space-y-2">
            {flow.map((f) => (
              <div key={f.label} className="flex items-center gap-2">
                <div className="w-20 text-xs text-slate-500 shrink-0">{f.label}</div>
                <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    key={`${f.label}-${pulseKey}`}
                    className={`h-full rounded-full meter-fill ${toneBar[f.tone]}`}
                    style={{ width: `${Math.min(100, (Math.max(0, f.value) / flowMax) * 100)}%` }}
                  />
                </div>
                <div className="w-6 text-right text-xs font-semibold text-slate-700">{Math.max(0, f.value)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Queues */}
        <div className="rounded-lg ring-1 ring-slate-200 p-3">
          <div className="section-title mb-2">Work Queues</div>
          <ul className="space-y-1.5 text-sm">
            <QueueRow label="Pending lab orders" value={metrics.pendingLabs} tone="amber" />
            <QueueRow label="Pending prescriptions" value={metrics.pendingRx} tone="rose" />
            <QueueRow label="Open encounter notes" value={metrics.openEncounters} tone="violet" />
            <QueueRow label="Unread messages" value={metrics.unreadMessages} tone="brand" />
          </ul>
        </div>
      </div>
    </section>
  );
}

function LiveStat({ label, value, tone }: { label: string; value: number; tone: "brand" | "amber" | "emerald" | "violet" | "rose" | "teal" }) {
  const grad: Record<string, string> = {
    brand: "from-brand-100",
    amber: "from-amber-100",
    emerald: "from-emerald-100",
    violet: "from-violet-100",
    rose: "from-rose-100",
    teal: "from-teal-100",
  };
  return (
    <div className={`rounded-lg bg-gradient-to-br ${grad[tone]} to-white ring-1 ring-slate-200 px-3 py-2`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900 leading-tight animate-count-pop">{value}</div>
    </div>
  );
}

function QueueRow({ label, value, tone }: { label: string; value: number; tone: "amber" | "rose" | "violet" | "brand" }) {
  const dot: Record<string, string> = {
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    violet: "bg-violet-400",
    brand: "bg-brand-500",
  };
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-slate-600">
        <span className={`h-2 w-2 rounded-full ${dot[tone]} ${value > 0 ? "animate-pulse-soft" : ""}`} />
        {label}
      </span>
      <span className={`chip ${value > 0 ? "bg-slate-100 text-slate-800 ring-slate-200" : "bg-slate-50 text-slate-400 ring-slate-100"}`}>{value}</span>
    </li>
  );
}
