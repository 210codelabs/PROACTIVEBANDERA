"use client";
import { useEffect, useState } from "react";

type Release = {
  id: string;
  at: string;
  channel: string;
  actor: string;
  actorDetail: string;
  chart: string;
  mrn: string;
  format: string;
};

export default function RecordsReleaseLog() {
  const [items, setItems] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/records-releases");
        const json = await res.json();
        setItems(json.releases || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = items.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return [r.actor, r.actorDetail, r.chart, r.mrn, r.format, r.channel].some((v) => String(v || "").toLowerCase().includes(s));
  });

  const channelChip = (c: string) =>
    c === "Attorney portal" ? "bg-indigo-100 text-indigo-800 ring-indigo-200" : "bg-sky-100 text-sky-800 ring-sky-200";

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Records Released</h2>
          <p className="text-sm text-slate-500">Audit history of every chart released &mdash; who, which patient, when, and in what format (attorney downloads and staff exports).</p>
        </div>
        <input
          className="input max-w-xs"
          placeholder="Filter by name, MRN, format…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <section className="card">
        {loading ? (
          <div className="card-pad text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="data">
            <thead>
              <tr><th>When</th><th>Released by</th><th>Chart</th><th>Format</th><th>Channel</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-sm text-slate-500">No records have been released yet.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs text-slate-600 whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                  <td>
                    <div className="font-medium text-slate-900">{r.actor}</div>
                    {r.actorDetail && <div className="text-xs text-slate-500">{r.actorDetail}</div>}
                  </td>
                  <td>
                    <div className="font-medium text-slate-800">{r.chart}</div>
                    <div className="font-mono text-xs text-slate-500">{r.mrn}</div>
                  </td>
                  <td className="text-xs"><span className="chip bg-slate-100 text-slate-700 ring-slate-200">{r.format}</span></td>
                  <td><span className={`chip ${channelChip(r.channel)}`}>{r.channel}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
