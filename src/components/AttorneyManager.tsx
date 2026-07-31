"use client";
import { useEffect, useState } from "react";

type Attorney = { id: string; name: string; firm: string | null; email: string; accessCode: string; active: boolean; _count?: { requests: number } };

export default function AttorneyManager() {
  const [items, setItems] = useState<Attorney[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/attorneys");
      const json = await res.json();
      setItems(json.attorneys || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/attorneys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(fd.entries())) });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Could not create"); return; }
    form.reset(); await load();
  }
  async function patch(id: string, body: any) {
    setBusy(id);
    try { await fetch(`/api/attorneys/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); await load(); }
    finally { setBusy(null); }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <section className="lg:col-span-1 card card-pad h-fit">
        <h2 className="font-semibold text-slate-900 mb-3">Add attorney</h2>
        <form onSubmit={create} className="space-y-3">
          <label className="block"><span className="label">Name</span><input name="name" required className="input" /></label>
          <label className="block"><span className="label">Firm</span><input name="firm" className="input" /></label>
          <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" /></label>
          <label className="block"><span className="label">Access code (blank = auto)</span><input name="accessCode" className="input font-mono" placeholder="auto-generate" /></label>
          {error && <div className="rounded bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>}
          <button className="btn-primary w-full">Create attorney</button>
        </form>
      </section>

      <section className="lg:col-span-2 card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">Attorneys ({items.length})</header>
        {loading ? <div className="p-6 text-sm text-slate-400">Loading…</div> : (
          <table className="data">
            <thead><tr><th>Attorney</th><th>Email</th><th>Access code</th><th>Requests</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6} className="p-6 text-sm text-slate-500">No attorneys yet.</td></tr>}
              {items.map((a) => (
                <tr key={a.id} className={a.active ? "" : "opacity-50"}>
                  <td><div className="font-medium">{a.name}</div><div className="text-xs text-slate-500">{a.firm || "—"}</div></td>
                  <td className="text-xs">{a.email}</td>
                  <td className="font-mono text-xs">
                    {reveal[a.id] ? a.accessCode : "••••••"}
                    <button onClick={() => setReveal((r) => ({ ...r, [a.id]: !r[a.id] }))} className="ml-2 text-brand-600 hover:text-brand-800">{reveal[a.id] ? "hide" : "show"}</button>
                  </td>
                  <td className="text-xs">{a._count?.requests ?? 0}</td>
                  <td><span className={`chip ${a.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{a.active ? "active" : "disabled"}</span></td>
                  <td className="text-right space-x-2 text-xs">
                    <button disabled={busy === a.id} onClick={() => patch(a.id, { resetCode: true })} className="text-brand-600 hover:text-brand-800">Reset code</button>
                    <button disabled={busy === a.id} onClick={() => patch(a.id, { active: !a.active })} className={a.active ? "text-rose-500 hover:text-rose-700" : "text-emerald-600 hover:text-emerald-800"}>{a.active ? "Deactivate" : "Activate"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
