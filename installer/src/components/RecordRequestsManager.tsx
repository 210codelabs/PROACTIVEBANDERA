"use client";
import { useEffect, useState } from "react";

type Req = {
  id: string; patientMrn: string; patientLastName: string; reason: string | null;
  status: string; decision: string | null; createdAt: string;
  attorney?: { name: string; firm: string | null; email: string };
};

export default function RecordRequestsManager() {
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/records-requests");
      const json = await res.json();
      setItems(json.requests || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function decide(id: string, status: string) {
    setBusy(id);
    try {
      await fetch(`/api/records-requests/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally { setBusy(null); }
  }

  const badge = (s: string) =>
    s === "approved" ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
    : s === "denied" ? "bg-rose-100 text-rose-700 ring-rose-200"
    : "bg-amber-100 text-amber-800 ring-amber-200";

  if (loading) return <div className="card card-pad text-sm text-slate-400">Loading…</div>;

  return (
    <section className="card">
      <table className="data">
        <thead><tr><th>Attorney</th><th>Patient</th><th>Reason</th><th>Requested</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={6} className="p-6 text-sm text-slate-500">No record requests yet.</td></tr>}
          {items.map((r) => (
            <tr key={r.id}>
              <td><div className="font-medium">{r.attorney?.name || "—"}</div><div className="text-xs text-slate-500">{r.attorney?.firm || r.attorney?.email}</div></td>
              <td><div className="font-mono text-xs">{r.patientMrn}</div><div className="text-xs text-slate-500">{r.patientLastName}</div></td>
              <td className="text-xs max-w-[220px]">{r.reason || "—"}</td>
              <td className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
              <td><span className={`chip ${badge(r.status)} capitalize`}>{r.status}</span></td>
              <td className="text-right space-x-2 text-xs">
                {r.status !== "approved" && <button disabled={busy === r.id} onClick={() => decide(r.id, "approved")} className="text-emerald-600 font-medium hover:text-emerald-800">Approve</button>}
                {r.status !== "denied" && <button disabled={busy === r.id} onClick={() => decide(r.id, "denied")} className="text-rose-500 hover:text-rose-700">Deny</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
