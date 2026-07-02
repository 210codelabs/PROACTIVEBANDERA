"use client";

import { useEffect, useMemo, useState } from "react";

type AgentKey = "coding-billing" | "medical-notes" | "validation" | "data-correction" | "flow-optimizer";

type AgentDefinition = {
  key: AgentKey;
  name: string;
  purpose: string;
  scope: string[];
};

type AgentFinding = {
  agent: AgentKey;
  severity: "high" | "medium" | "low";
  entityType: "encounter" | "patient" | "order" | "system";
  entityId: string;
  title: string;
  detail: string;
  recommendation: string;
  fixed: boolean;
};

type AgentRun = {
  id: string;
  startedAt: string;
  completedAt: string;
  mode: "scan" | "autofix" | "autonomous";
  triggeredBy: string;
  findings: AgentFinding[];
  metrics: {
    totalFindings: number;
    fixedCount: number;
    bySeverity: Record<"high" | "medium" | "low", number>;
    byAgent: Record<AgentKey, number>;
  };
};

export default function AdminAgentsConsole({
  initialAgents,
  initialRuns,
}: {
  initialAgents: AgentDefinition[];
  initialRuns: AgentRun[];
}) {
  const [agents] = useState<AgentDefinition[]>(initialAgents);
  const [runs, setRuns] = useState<AgentRun[]>(initialRuns);
  const [selected, setSelected] = useState<Record<AgentKey, boolean>>({
    "coding-billing": true,
    "medical-notes": true,
    validation: true,
    "data-correction": true,
    "flow-optimizer": true,
  });
  const [runningMode, setRunningMode] = useState<"scan" | "autofix" | "autonomous" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const latest = runs[0] ?? null;

  const selectedIds = useMemo(
    () => (Object.keys(selected) as AgentKey[]).filter((key) => selected[key]),
    [selected],
  );

  async function run(mode: "scan" | "autofix" | "autonomous") {
    setRunningMode(mode);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, agentIds: selectedIds }),
      });
      const raw = await res.text();
      let data: { error?: string; run?: AgentRun } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!res.ok) throw new Error(data.error ?? `Agent run failed (${res.status})`);
      if (!data.run) throw new Error("Agent run response missing run payload");
      const run = data.run;

      setRuns((prev) => [run, ...prev]);
      setMessage(`Run ${run.id} completed with ${run.metrics.totalFindings} findings.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Agent run failed");
    } finally {
      setRunningMode(null);
    }
  }

  const formatTimestamp = (value: string) => {
    if (!mounted) return "--";
    return new Date(value).toLocaleString();
  };

  return (
    <section className="space-y-4">
      <div className="card card-pad space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Autonomous Agent Operations</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => run("scan")} disabled={!!runningMode || selectedIds.length === 0}>
              {runningMode === "scan" ? "Running scan..." : "Run Validation Scan"}
            </button>
            <button className="btn-secondary" onClick={() => run("autofix")} disabled={!!runningMode || selectedIds.length === 0}>
              {runningMode === "autofix" ? "Applying fixes..." : "Run Auto-Fix"}
            </button>
            <button className="btn-primary" onClick={() => run("autonomous")} disabled={!!runningMode || selectedIds.length === 0}>
              {runningMode === "autonomous" ? "Executing autonomous run..." : "Autonomous Optimize"}
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Agents continuously validate coding, notes, data quality, and order flow. Autonomous mode runs selected agents with auto-fix enabled.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {agents.map((agent) => (
            <label key={agent.key} className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-3 block">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-slate-900">{agent.name}</div>
                <input
                  type="checkbox"
                  checked={selected[agent.key]}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [agent.key]: e.target.checked }))}
                />
              </div>
              <div className="text-xs text-slate-600 mt-1">{agent.purpose}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {agent.scope.map((scope) => (
                  <span key={scope} className="chip bg-white text-slate-700 ring-slate-200 text-[11px]">{scope}</span>
                ))}
              </div>
            </label>
          ))}
        </div>
      </div>

      {latest && (
        <div className="card card-pad space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900">Latest Run Snapshot</h3>
            <span className="text-xs text-slate-500" suppressHydrationWarning>{formatTimestamp(latest.completedAt)}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Metric label="Findings" value={latest.metrics.totalFindings} />
            <Metric label="Fixed" value={latest.metrics.fixedCount} />
            <Metric label="High" value={latest.metrics.bySeverity.high} tone="rose" />
            <Metric label="Medium" value={latest.metrics.bySeverity.medium} tone="amber" />
            <Metric label="Low" value={latest.metrics.bySeverity.low} tone="slate" />
          </div>
          <div className="overflow-x-auto">
            <table className="data min-w-[920px]">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Severity</th>
                  <th>Entity</th>
                  <th>Issue</th>
                  <th>Recommendation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {latest.findings.slice(0, 40).map((finding, idx) => (
                  <tr key={`${finding.entityId}-${idx}`}>
                    <td className="text-xs">{finding.agent}</td>
                    <td>
                      <span className={`chip ${
                        finding.severity === "high"
                          ? "bg-rose-100 text-rose-800 ring-rose-200"
                          : finding.severity === "medium"
                            ? "bg-amber-100 text-amber-800 ring-amber-200"
                            : "bg-slate-100 text-slate-700 ring-slate-200"
                      }`}>{finding.severity}</span>
                    </td>
                    <td className="text-xs">{finding.entityType} · {finding.entityId}</td>
                    <td>
                      <div className="font-medium text-slate-900">{finding.title}</div>
                      <div className="text-xs text-slate-500">{finding.detail}</div>
                    </td>
                    <td className="text-xs text-slate-600">{finding.recommendation}</td>
                    <td>
                      <span className={`chip ${finding.fixed ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>
                        {finding.fixed ? "auto-fixed" : "open"}
                      </span>
                    </td>
                  </tr>
                ))}
                {latest.findings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-500 py-8">No findings in latest run.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card card-pad">
        <h3 className="font-semibold text-slate-900 mb-2">Recent Runs</h3>
        <div className="space-y-2">
          {runs.slice(0, 10).map((run) => (
            <div key={run.id} className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-2 text-xs flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-800">{run.id}</span>
              <span className="chip bg-slate-100 text-slate-700 ring-slate-200">{run.mode}</span>
              <span>Findings {run.metrics.totalFindings}</span>
              <span>Fixed {run.metrics.fixedCount}</span>
              <span className="text-slate-500 ml-auto" suppressHydrationWarning>{formatTimestamp(run.completedAt)}</span>
            </div>
          ))}
          {runs.length === 0 && <div className="text-sm text-slate-500">No agent runs yet.</div>}
        </div>
      </div>

      {message && <p className="text-xs text-slate-600">{message}</p>}
    </section>
  );
}

function Metric({ label, value, tone = "brand" }: { label: string; value: number; tone?: "brand" | "rose" | "amber" | "slate" }) {
  const toneClass =
    tone === "rose"
      ? "bg-rose-50 ring-rose-200 text-rose-800"
      : tone === "amber"
        ? "bg-amber-50 ring-amber-200 text-amber-800"
        : tone === "slate"
          ? "bg-slate-50 ring-slate-200 text-slate-700"
          : "bg-brand-50 ring-brand-200 text-brand-800";

  return (
    <div className={`rounded-md ring-1 p-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
