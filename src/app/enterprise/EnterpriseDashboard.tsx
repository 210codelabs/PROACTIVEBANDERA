"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Svc = { key: string; label: string; category: string; priceCents: number };
type Session = { companyName: string; name: string; email: string };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const STATUS_COLORS: Record<string, string> = {
  requested: "bg-slate-100 text-slate-700", scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700", completed: "bg-emerald-100 text-emerald-700", cancelled: "bg-rose-100 text-rose-700",
};
const RESULT_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600", pass: "bg-emerald-100 text-emerald-700", fail: "bg-rose-100 text-rose-700", inconclusive: "bg-amber-100 text-amber-700", na: "bg-slate-100 text-slate-500",
};

export default function EnterpriseDashboard({ session, catalog }: { session: Session; catalog: Svc[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "new" | "requests" | "messages" | "documents" | "invoices">("overview");
  const [stats, setStats] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const loadCore = useCallback(async () => {
    const [me, rq] = await Promise.all([fetch("/api/enterprise/me").then((r) => r.json()), fetch("/api/enterprise/requests").then((r) => r.json())]);
    setStats(me.stats); setRequests(rq.requests || []);
  }, []);
  useEffect(() => { loadCore(); }, [loadCore]);
  useEffect(() => {
    if (tab === "messages") fetch("/api/enterprise/messages").then((r) => r.json()).then((d) => setMessages(d.messages || []));
    if (tab === "documents") fetch("/api/enterprise/documents").then((r) => r.json()).then((d) => setDocuments(d.documents || []));
    if (tab === "invoices") fetch("/api/enterprise/invoices").then((r) => r.json()).then((d) => setInvoices(d.invoices || []));
  }, [tab]);

  async function logout() { await fetch("/api/enterprise/auth/logout", { method: "POST" }); router.push("/enterprise/login"); }

  // New request form
  const [f, setF] = useState({ employeeFirstName: "", employeeLastName: "", employeeDob: "", employeeEmail: "", employeePhone: "", serviceKey: catalog[0]?.key || "", priority: "routine", dueDate: "", consentEmployee: "", notes: "" });
  const [savingReq, setSavingReq] = useState(false);
  const [reqErr, setReqErr] = useState<string | null>(null);
  async function submitRequest(e: React.FormEvent) {
    e.preventDefault(); setSavingReq(true); setReqErr(null);
    try {
      const r = await fetch("/api/enterprise/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json();
      if (!r.ok) { setReqErr(d.error || "Could not submit"); return; }
      setF({ employeeFirstName: "", employeeLastName: "", employeeDob: "", employeeEmail: "", employeePhone: "", serviceKey: catalog[0]?.key || "", priority: "routine", dueDate: "", consentEmployee: "", notes: "" });
      await loadCore(); flash("Request submitted — employee added to the clinic charts."); setTab("requests");
    } catch { setReqErr("Could not submit"); } finally { setSavingReq(false); }
  }

  async function signConsent(id: string) {
    const sig = window.prompt("Type the employee's full legal name to record consent:");
    if (!sig) return;
    const r = await fetch(`/api/enterprise/requests/${id}/consent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consentEmployee: sig }) });
    if (r.ok) { await loadCore(); flash("Consent recorded."); }
  }

  // Messages
  const [msg, setMsg] = useState("");
  async function sendMsg(e: React.FormEvent) {
    e.preventDefault(); if (!msg.trim()) return;
    const r = await fetch("/api/enterprise/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: msg }) });
    if (r.ok) { setMsg(""); fetch("/api/enterprise/messages").then((x) => x.json()).then((d) => setMessages(d.messages || [])); }
  }

  // Documents
  const [upBusy, setUpBusy] = useState(false);
  async function uploadDoc(file: File) {
    if (file.size > 5 * 1024 * 1024) { flash("File too large (max 5MB)."); return; }
    setUpBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataBase64 = String(reader.result).split(",")[1] || "";
      const r = await fetch("/api/enterprise/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, mimeType: file.type, dataBase64 }) });
      setUpBusy(false);
      if (r.ok) { fetch("/api/enterprise/documents").then((x) => x.json()).then((d) => setDocuments(d.documents || [])); flash("Uploaded."); }
      else { const d = await r.json(); flash(d.error || "Upload failed"); }
    };
    reader.readAsDataURL(file);
  }

  const TABS = [["overview", "Overview"], ["new", "New request"], ["requests", "Requests"], ["messages", "Messages"], ["documents", "Documents"], ["invoices", "Invoices"]] as const;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div>
            <div className="font-bold">Enterprise Portal</div>
            <div className="text-xs text-white/60">{session.companyName}</div>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-white/70">{session.name}</span>
            <button onClick={logout} className="rounded-md bg-white/10 px-3 py-1.5 hover:bg-white/20">Sign out</button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k as any)} className={`px-3 py-2 text-sm border-b-2 whitespace-nowrap ${tab === k ? "border-brand-400 text-white" : "border-transparent text-white/60 hover:text-white"}`}>{l}</button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "overview" && stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[["Total requests", stats.total], ["Open", stats.open], ["Pending consent", stats.pendingConsent], ["Completed", stats.completed], ["Open invoices", stats.openInvoices]].map(([l, v]) => (
              <div key={l as string} className="card card-pad"><div className="text-2xl font-bold text-slate-900">{v as number}</div><div className="text-xs text-slate-500">{l as string}</div></div>
            ))}
            <div className="col-span-2 md:col-span-5"><button onClick={() => setTab("new")} className="btn-primary">+ New service request</button></div>
          </div>
        )}

        {tab === "new" && (
          <form onSubmit={submitRequest} className="card card-pad max-w-2xl space-y-3">
            <h2 className="font-semibold text-slate-900">New occupational-health request</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm"><span className="label">Employee first name *</span><input className="input" value={f.employeeFirstName} onChange={(e) => setF({ ...f, employeeFirstName: e.target.value })} required /></label>
              <label className="text-sm"><span className="label">Employee last name *</span><input className="input" value={f.employeeLastName} onChange={(e) => setF({ ...f, employeeLastName: e.target.value })} required /></label>
              <label className="text-sm"><span className="label">Date of birth</span><input type="date" className="input" value={f.employeeDob} onChange={(e) => setF({ ...f, employeeDob: e.target.value })} /></label>
              <label className="text-sm"><span className="label">Employee email</span><input className="input" value={f.employeeEmail} onChange={(e) => setF({ ...f, employeeEmail: e.target.value })} /></label>
              <label className="text-sm"><span className="label">Employee phone</span><input className="input" value={f.employeePhone} onChange={(e) => setF({ ...f, employeePhone: e.target.value })} /></label>
              <label className="text-sm"><span className="label">Service *</span>
                <select className="input" value={f.serviceKey} onChange={(e) => setF({ ...f, serviceKey: e.target.value })}>
                  {catalog.map((s) => <option key={s.key} value={s.key}>{s.label} — {money(s.priceCents)}</option>)}
                </select>
              </label>
              <label className="text-sm"><span className="label">Priority</span><select className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="routine">Routine</option><option value="urgent">Urgent</option></select></label>
              <label className="text-sm"><span className="label">Needed by</span><input type="date" className="input" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></label>
            </div>
            <label className="text-sm block"><span className="label">Notes for the clinic</span><textarea className="input min-h-[70px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
            <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3">
              <div className="text-sm font-semibold text-amber-900">Employee consent</div>
              <p className="text-[11px] text-amber-700 mb-1">By typing the employee's name, you confirm the employee authorizes ProactiveClinics to perform this service and share the result with {session.companyName}. Can also be signed later.</p>
              <input className="input" placeholder="Employee full name (e-signature)" value={f.consentEmployee} onChange={(e) => setF({ ...f, consentEmployee: e.target.value })} />
            </div>
            {reqErr && <p className="text-sm text-rose-600">{reqErr}</p>}
            <button type="submit" disabled={savingReq} className="btn-primary disabled:opacity-60">{savingReq ? "Submitting…" : "Submit request"}</button>
          </form>
        )}

        {tab === "requests" && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Employee</th><th className="text-left px-3 py-2">Service</th><th className="text-left px-3 py-2">Status</th><th className="text-left px-3 py-2">Consent</th><th className="text-left px-3 py-2">Result</th><th className="px-3 py-2"></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {requests.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No requests yet.</td></tr>}
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{r.employeeLastName}, {r.employeeFirstName}</td>
                    <td className="px-3 py-2 text-slate-600">{r.serviceLabel}{r.priority === "urgent" && <span className="ml-1 text-[10px] font-bold text-rose-600">URGENT</span>}</td>
                    <td className="px-3 py-2"><span className={`chip ${STATUS_COLORS[r.status] || ""}`}>{r.status.replace("_", " ")}</span></td>
                    <td className="px-3 py-2">{r.consentStatus === "signed" ? <span className="chip bg-emerald-100 text-emerald-700">signed</span> : <span className="chip bg-amber-100 text-amber-700">pending</span>}</td>
                    <td className="px-3 py-2"><span className={`chip ${RESULT_COLORS[r.resultStatus] || ""}`}>{r.resultStatus}</span>{r.resultSummary && <div className="text-[11px] text-slate-500 mt-0.5">{r.resultSummary}</div>}</td>
                    <td className="px-3 py-2 text-right">{r.consentStatus !== "signed" && <button onClick={() => signConsent(r.id)} className="chip bg-brand-100 text-brand-800 text-xs">Sign consent</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "messages" && (
          <div className="card card-pad max-w-2xl">
            <h2 className="font-semibold text-slate-900 mb-2">Secure messages with the clinic</h2>
            <div className="space-y-2 max-h-96 overflow-auto mb-3">
              {messages.length === 0 && <p className="text-sm text-slate-400">No messages yet.</p>}
              {messages.map((m) => (
                <div key={m.id} className={`rounded-lg p-2 text-sm ${m.senderType === "employer" ? "bg-brand-50 ml-8" : "bg-slate-100 mr-8"}`}>
                  <div className="text-[11px] text-slate-500">{m.senderName} · {new Date(m.createdAt).toLocaleString()}</div>
                  <div className="text-slate-800 whitespace-pre-wrap">{m.body}</div>
                </div>
              ))}
            </div>
            <form onSubmit={sendMsg} className="flex gap-2"><input className="input" placeholder="Type a secure message…" value={msg} onChange={(e) => setMsg(e.target.value)} /><button className="btn-primary">Send</button></form>
          </div>
        )}

        {tab === "documents" && (
          <div className="card card-pad max-w-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900">Documents</h2>
              <label className="btn-secondary cursor-pointer text-sm">{upBusy ? "Uploading…" : "Upload document"}<input type="file" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) uploadDoc(x); }} /></label>
            </div>
            <ul className="divide-y divide-slate-100">
              {documents.length === 0 && <li className="text-sm text-slate-400 py-3">No documents uploaded.</li>}
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="flex-1 truncate text-slate-800">{d.name}</span>
                  <span className="text-[11px] text-slate-400">{(d.size / 1024).toFixed(0)} KB · {d.uploadedType}</span>
                  <a href={`/api/enterprise/documents/${d.id}`} target="_blank" rel="noopener" className="chip bg-white ring-1 ring-slate-200 text-xs">View</a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "invoices" && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Invoice</th><th className="text-left px-3 py-2">Issued</th><th className="text-left px-3 py-2">Due</th><th className="text-right px-3 py-2">Total</th><th className="text-left px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No invoices yet.</td></tr>}
                {invoices.map((i) => (
                  <tr key={i.id}><td className="px-3 py-2 font-mono text-slate-700">{i.number}</td><td className="px-3 py-2 text-slate-600">{new Date(i.issueDate).toLocaleDateString()}</td><td className="px-3 py-2 text-slate-600">{i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "—"}</td><td className="px-3 py-2 text-right font-semibold">{money(i.totalCents)}</td><td className="px-3 py-2"><span className={`chip ${i.status === "paid" ? "bg-emerald-100 text-emerald-700" : i.status === "void" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"}`}>{i.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-slate-900 text-white text-sm px-4 py-2 shadow-lg">{toast}</div>}
    </div>
  );
}
