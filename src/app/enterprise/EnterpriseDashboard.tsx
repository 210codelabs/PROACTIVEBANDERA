"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DotPanel from "@/components/enterprise/DotPanel";

type Svc = { key: string; label: string; category: string; priceCents: number };
type Session = { companyName: string; name: string; email: string; role?: "company_admin" | "super_admin"; enterpriseId?: string };

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
  const isSuper = session.role === "super_admin";
  const [tab, setTab] = useState<"overview" | "employees" | "new" | "requests" | "messages" | "documents" | "invoices" | "dot">("overview");
  const [stats, setStats] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [resultDocs, setResultDocs] = useState<Record<string, any>>({});
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  // Employees + super-admin company scope
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [empDetail, setEmpDetail] = useState<any>(null);
  const [forms, setForms] = useState<any[]>([]);
  const [dotWarn, setDotWarn] = useState<{ expiring: number; expired: number }>({ expiring: 0, expired: 0 });
  const entQS = (extra = "") => {
    const p = new URLSearchParams();
    if (isSuper && companyId) p.set("enterpriseId", companyId);
    const s = p.toString();
    return (s ? `?${s}` : "") + (extra && s ? `&${extra}` : extra ? `?${extra}` : "");
  };
  const entBody = (o: any) => (isSuper && companyId ? { ...o, enterpriseId: companyId } : o);

  const loadCore = useCallback(async () => {
    const [me, rq, dc] = await Promise.all([
      fetch("/api/enterprise/me").then((r) => r.json()),
      fetch("/api/enterprise/requests").then((r) => r.json()),
      fetch("/api/enterprise/documents").then((r) => r.json()).catch(() => ({ documents: [] })),
    ]);
    setStats(me.stats); setRequests(rq.requests || []);
    const map: Record<string, any> = {};
    for (const d of dc.documents || []) if (d.requestId && d.uploadedType === "clinic" && !map[d.requestId]) map[d.requestId] = d;
    setResultDocs(map);
  }, []);
  useEffect(() => { loadCore(); }, [loadCore]);

  // DOT MEC compliance banner — count expiring/expired for the current company.
  useEffect(() => {
    if (isSuper && !companyId) { setDotWarn({ expiring: 0, expired: 0 }); return; }
    fetch(`/api/enterprise/dot/exams${entQS()}`).then((r) => r.json()).then((d) => {
      const now = Date.now();
      let expiring = 0, expired = 0;
      for (const e of d.exams || []) {
        if (e.status !== "completed" || !["qualified", "qualified_with_restrictions"].includes(e.outcome) || !e.expiresOn) continue;
        const days = Math.ceil((new Date(e.expiresOn).getTime() - now) / 86400000);
        if (days < 0) expired++; else if (days <= 30) expiring++;
      }
      setDotWarn({ expiring, expired });
    }).catch(() => {});
  }, [isSuper, companyId]);
  useEffect(() => {
    if (tab === "messages") fetch("/api/enterprise/messages").then((r) => r.json()).then((d) => setMessages(d.messages || []));
    if (tab === "documents") fetch("/api/enterprise/documents").then((r) => r.json()).then((d) => setDocuments(d.documents || []));
    if (tab === "invoices") fetch("/api/enterprise/invoices").then((r) => r.json()).then((d) => setInvoices(d.invoices || []));
  }, [tab]);

  // Load companies once (super admin: many; company admin: their one)
  useEffect(() => {
    fetch("/api/enterprise/companies").then((r) => r.json()).then((d) => {
      setCompanies(d.companies || []);
      if (isSuper && !companyId && d.companies?.[0]) setCompanyId(d.companies[0].id);
    }).catch(() => {});
    fetch("/api/enterprise/forms").then((r) => r.json()).then((d) => setForms(d.forms || [])).catch(() => {});
  }, [isSuper]);

  const loadEmployees = useCallback(() => {
    if (isSuper && !companyId) { setEmployees([]); return; }
    fetch(`/api/enterprise/employees${entQS()}`).then((r) => r.json()).then((d) => setEmployees(d.employees || [])).catch(() => {});
  }, [isSuper, companyId]);
  useEffect(() => { if (tab === "employees") loadEmployees(); }, [tab, loadEmployees]);

  async function openEmployee(id: string) {
    setAccessCreds(null);
    const r = await fetch(`/api/enterprise/employees/${id}${entQS()}`);
    const d = await r.json();
    if (r.ok) setEmpDetail(d);
    else flash(d.error || "Could not open employee");
  }
  async function refreshDetail() { if (empDetail?.employee?.id) await openEmployee(empDetail.employee.id); }

  // New employee
  const [ef, setEf] = useState({ firstName: "", lastName: "", dob: "", sex: "X", email: "", phone: "", employeeNo: "", department: "", jobTitle: "" });
  const [empBusy, setEmpBusy] = useState(false);
  const [showAddEmp, setShowAddEmp] = useState(false);
  async function createEmployee(e: React.FormEvent) {
    e.preventDefault(); setEmpBusy(true);
    const r = await fetch("/api/enterprise/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entBody(ef)) });
    const d = await r.json(); setEmpBusy(false);
    if (r.ok) { setEf({ firstName: "", lastName: "", dob: "", sex: "X", email: "", phone: "", employeeNo: "", department: "", jobTitle: "" }); setShowAddEmp(false); loadEmployees(); flash("Employee added & clinical chart created."); openEmployee(d.employee.id); }
    else flash(d.error || "Could not add employee");
  }

  async function postDetail(path: string, body: any, ok: string) {
    if (!empDetail?.employee?.id) return;
    const r = await fetch(`/api/enterprise/employees/${empDetail.employee.id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (r.ok && d.ok !== false && !d.error) { await refreshDetail(); flash(ok); return true; }
    flash(d.error || "Action failed"); return false;
  }
  async function runEligibility() {
    if (!empDetail?.employee?.id) return;
    flash("Checking eligibility…");
    const r = await fetch(`/api/enterprise/employees/${empDetail.employee.id}/eligibility`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await r.json();
    if (r.ok && !d.error) { await refreshDetail(); flash(`Eligibility: ${String(d.status || "checked").toUpperCase()}${d.planName ? " · " + d.planName : ""}`); }
    else flash(d.error || "Eligibility check failed");
  }
  async function addConsent(formKey: string) {
    if (!empDetail?.employee?.id) return;
    const r = await fetch("/api/enterprise/consents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entBody({ employeeId: empDetail.employee.id, formKey })) });
    const d = await r.json();
    if (r.ok) { await refreshDetail(); flash("Form assigned — ready to e-sign."); }
    else flash(d.error || "Could not assign form");
  }
  async function signEmpConsent(consentId: string, who: string) {
    const sig = window.prompt(`Type the ${who}'s full legal name to e-sign this form:`);
    if (!sig) return;
    const r = await fetch(`/api/enterprise/consents/${consentId}/sign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signatureText: sig }) });
    const d = await r.json();
    if (r.ok) { await refreshDetail(); flash("Form e-signed — signed PDF saved to Documents."); }
    else flash(d.error || "Could not sign");
  }

  const [accessCreds, setAccessCreds] = useState<{ accessCode: string; pin: string } | null>(null);
  async function manageAccess(action: "enable" | "reset" | "disable") {
    if (!empDetail?.employee?.id) return;
    const r = await fetch(`/api/enterprise/employees/${empDetail.employee.id}/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const d = await r.json();
    if (!r.ok) { flash(d.error || "Action failed"); return; }
    if (action === "disable") { await refreshDetail(); setAccessCreds(null); flash("Employee login disabled."); }
    else { await refreshDetail(); setAccessCreds({ accessCode: d.accessCode, pin: d.pin }); flash("Employee login enabled."); }
  }

  async function logout() { await fetch("/api/enterprise/auth/logout", { method: "POST" }); router.push("/enterprise/login"); }

  // New request form
  const [f, setF] = useState({ employeeFirstName: "", employeeLastName: "", employeeDob: "", employeeEmail: "", employeePhone: "", serviceKey: catalog[0]?.key || "", priority: "routine", dueDate: "", consentEmployee: "", notes: "" });
  const [savingReq, setSavingReq] = useState(false);
  const [reqErr, setReqErr] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  async function bulkImport(file: File) {
    setBulkBusy(true);
    const text = await file.text();
    const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const start = /first/i.test(rows[0] || "") ? 1 : 0;
    const employees: any[] = [];
    for (let i = start; i < rows.length; i++) {
      const cols = rows[i].split(",").map((c) => c.trim());
      if (!cols[0] || !cols[1]) continue;
      employees.push({ firstName: cols[0], lastName: cols[1], dob: cols[2] || null, email: cols[3] || null, phone: cols[4] || null });
    }
    if (!employees.length) { setBulkBusy(false); flash("No valid rows. Use columns: First,Last,DOB,Email,Phone"); return; }
    const r = await fetch("/api/enterprise/requests/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceKey: f.serviceKey, priority: f.priority, dueDate: f.dueDate || null, employees }) });
    const d = await r.json(); setBulkBusy(false);
    if (r.ok) { await loadCore(); flash(`Imported ${d.created} request(s) for ${catalog.find((c) => c.key === f.serviceKey)?.label || "service"}.`); setTab("requests"); }
    else flash(d.error || "Import failed");
  }
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

  const TABS = [["overview", "Overview"], ["employees", "Employees"], ["new", "New request"], ["requests", "Requests"], ["dot", "DOT / FMCSA"], ["messages", "Messages"], ["documents", "Documents"], ["invoices", "Invoices"]] as const;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div>
            <div className="font-bold flex items-center gap-2">Enterprise Portal {isSuper && <span className="rounded bg-amber-400 text-slate-900 text-[10px] font-bold px-1.5 py-0.5">PLATFORM ADMIN</span>}</div>
            <div className="text-xs text-white/60">{isSuper ? "Platform super-admin · all companies" : session.companyName}</div>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {isSuper && companies.length > 0 && (
              <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setEmpDetail(null); }} className="rounded-md bg-white/10 text-white px-2 py-1.5 text-xs border border-white/20">
                {companies.map((c) => <option key={c.id} value={c.id} className="text-slate-900">{c.companyName} ({c.employeeCount ?? 0})</option>)}
              </select>
            )}
            <span className="text-white/70">{session.name}</span>
            <button onClick={logout} className="rounded-md bg-white/10 px-3 py-1.5 hover:bg-white/20">Sign out</button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map(([k, l]) => {
            const dotCount = k === "dot" ? dotWarn.expiring + dotWarn.expired : 0;
            return (
              <button key={k} onClick={() => setTab(k as any)} className={`relative px-3 py-2 text-sm border-b-2 whitespace-nowrap ${tab === k ? "border-brand-400 text-white" : "border-transparent text-white/60 hover:text-white"}`}>
                {l}
                {dotCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 px-1 text-[10px] font-bold text-white align-middle">{dotCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {(dotWarn.expiring > 0 || dotWarn.expired > 0) && (
          <button onClick={() => setTab("dot")} className="w-full text-left mb-4 flex items-center gap-3 rounded-xl px-4 py-3 ring-1 bg-amber-50 ring-amber-300 hover:bg-amber-100 transition-colors">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-slate-900 text-lg font-bold">!</span>
            <span className="text-sm text-amber-900">
              <strong>DOT medical certificates need attention.</strong>{" "}
              {dotWarn.expired > 0 && <span className="font-semibold text-rose-700">{dotWarn.expired} expired</span>}
              {dotWarn.expired > 0 && dotWarn.expiring > 0 && " · "}
              {dotWarn.expiring > 0 && <span>{dotWarn.expiring} expiring within 30 days</span>}
              . <span className="underline">Review in DOT / FMCSA →</span>
            </span>
          </button>
        )}
        {tab === "overview" && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(isSuper
                ? [["Companies", stats.companies], ["Employees", stats.employees], ["Total requests", stats.total], ["Balance due", money(stats.balanceDueCents || 0)]]
                : [["Total requests", stats.total], ["Open", stats.open], ["Pending consent", stats.pendingConsent], ["Completed", stats.completed]]
              ).map(([l, v]) => (
                <div key={l as string} className="card card-pad"><div className="text-2xl font-bold text-slate-900">{v as any}</div><div className="text-xs text-slate-500">{l as string}</div></div>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {/* Balance due + pay */}
              <div className="card card-pad flex flex-col justify-between">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Balance due</div>
                  <div className="text-3xl font-bold text-slate-900 mt-1">{money(stats.balanceDueCents || 0)}</div>
                  <div className="text-xs text-slate-400 mt-1">{stats.openInvoices} open invoice(s)</div>
                </div>
                <button onClick={() => flash("Online payments are coming soon — you'll be able to pay securely here.")} className={`btn-primary mt-3 w-full ${isSuper ? "hidden" : ""}`}>Pay your bill online</button>
              </div>
              {/* Requests-by-status bar graph */}
              <div className="card card-pad md:col-span-2">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Requests by status</div>
                {(() => {
                  const counts: Record<string, number> = {};
                  for (const r of requests) counts[r.status] = (counts[r.status] || 0) + 1;
                  const max = Math.max(1, ...Object.values(counts));
                  const order = ["requested", "scheduled", "in_progress", "completed", "cancelled"];
                  return (
                    <div className="flex items-end gap-3 h-32">
                      {order.map((k) => (
                        <div key={k} className="flex-1 flex flex-col items-center justify-end">
                          <div className="text-[11px] font-semibold text-slate-600">{counts[k] || 0}</div>
                          <div className={`w-full rounded-t ${STATUS_COLORS[k]?.replace("text-", "bg-").split(" ")[0] || "bg-slate-300"}`} style={{ height: `${((counts[k] || 0) / max) * 100}%`, minHeight: counts[k] ? 6 : 0 }} />
                          <div className="text-[9px] text-slate-400 mt-1 capitalize">{k.replace("_", " ")}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Monthly calendar of visits */}
            <div className="card card-pad">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-slate-900">{calMonth.toLocaleString(undefined, { month: "long", year: "numeric" })} — employee visits</div>
                <div className="flex gap-1">
                  <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="chip bg-white ring-1 ring-slate-200 text-xs">‹</button>
                  <button onClick={() => setCalMonth(new Date())} className="chip bg-white ring-1 ring-slate-200 text-xs">Today</button>
                  <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="chip bg-white ring-1 ring-slate-200 text-xs">›</button>
                </div>
              </div>
              {(() => {
                const y = calMonth.getFullYear(), m = calMonth.getMonth();
                const first = new Date(y, m, 1).getDay();
                const days = new Date(y, m + 1, 0).getDate();
                const byDay: Record<number, any[]> = {};
                for (const r of requests) {
                  const d = new Date(r.dueDate || r.createdAt);
                  if (d.getFullYear() === y && d.getMonth() === m) (byDay[d.getDate()] = byDay[d.getDate()] || []).push(r);
                }
                const cells: React.ReactNode[] = [];
                for (let i = 0; i < first; i++) cells.push(<div key={`e${i}`} />);
                for (let day = 1; day <= days; day++) {
                  const items = byDay[day] || [];
                  cells.push(
                    <div key={day} className="min-h-[64px] rounded border border-slate-100 p-1">
                      <div className="text-[10px] text-slate-400">{day}</div>
                      {items.slice(0, 3).map((r) => (
                        <div key={r.id} className={`mt-0.5 truncate rounded px-1 text-[9px] ${STATUS_COLORS[r.status] || "bg-slate-100 text-slate-600"}`} title={`${r.employeeLastName}, ${r.employeeFirstName} — ${r.serviceLabel} (${r.status})`}>{r.employeeLastName} · {r.serviceLabel.split(" ")[0]}</div>
                      ))}
                      {items.length > 3 && <div className="text-[9px] text-slate-400">+{items.length - 3} more</div>}
                    </div>
                  );
                }
                return (
                  <div>
                    <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-400 mb-1">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="text-center">{d}</div>)}</div>
                    <div className="grid grid-cols-7 gap-1">{cells}</div>
                  </div>
                );
              })()}
            </div>

            <button onClick={() => setTab("new")} className="btn-primary">+ New service request</button>
          </div>
        )}

        {tab === "employees" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Employees {isSuper && companyId && <span className="text-sm text-slate-400">· {companies.find((c) => c.id === companyId)?.companyName}</span>}</h2>
              <button onClick={() => setShowAddEmp((v) => !v)} className="btn-primary text-sm">{showAddEmp ? "Close" : "+ Add employee"}</button>
            </div>

            {showAddEmp && (
              <form onSubmit={createEmployee} className="card card-pad grid grid-cols-2 md:grid-cols-3 gap-3">
                <label className="text-sm"><span className="label">First name *</span><input className="input" value={ef.firstName} onChange={(e) => setEf({ ...ef, firstName: e.target.value })} required /></label>
                <label className="text-sm"><span className="label">Last name *</span><input className="input" value={ef.lastName} onChange={(e) => setEf({ ...ef, lastName: e.target.value })} required /></label>
                <label className="text-sm"><span className="label">Date of birth</span><input type="date" className="input" value={ef.dob} onChange={(e) => setEf({ ...ef, dob: e.target.value })} /></label>
                <label className="text-sm"><span className="label">Sex</span><select className="input" value={ef.sex} onChange={(e) => setEf({ ...ef, sex: e.target.value })}><option value="X">Unspecified</option><option value="M">M</option><option value="F">F</option></select></label>
                <label className="text-sm"><span className="label">Email</span><input className="input" value={ef.email} onChange={(e) => setEf({ ...ef, email: e.target.value })} /></label>
                <label className="text-sm"><span className="label">Phone</span><input className="input" value={ef.phone} onChange={(e) => setEf({ ...ef, phone: e.target.value })} /></label>
                <label className="text-sm"><span className="label">Employee #</span><input className="input" value={ef.employeeNo} onChange={(e) => setEf({ ...ef, employeeNo: e.target.value })} /></label>
                <label className="text-sm"><span className="label">Department</span><input className="input" value={ef.department} onChange={(e) => setEf({ ...ef, department: e.target.value })} /></label>
                <label className="text-sm"><span className="label">Job title</span><input className="input" value={ef.jobTitle} onChange={(e) => setEf({ ...ef, jobTitle: e.target.value })} /></label>
                <div className="col-span-full"><button disabled={empBusy} className="btn-primary disabled:opacity-60">{empBusy ? "Creating…" : "Create employee + chart"}</button><span className="ml-2 text-[11px] text-slate-400">Creates a real EMR patient chart linked to this employee.</span></div>
              </form>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Employee</th><th className="text-left px-3 py-2">Dept / Title</th><th className="text-left px-3 py-2">Chart</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {employees.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-400">No employees yet.</td></tr>}
                    {employees.map((e) => (
                      <tr key={e.id} onClick={() => openEmployee(e.id)} className={`cursor-pointer hover:bg-brand-50 ${empDetail?.employee?.id === e.id ? "bg-brand-50" : ""}`}>
                        <td className="px-3 py-2 font-medium text-slate-800">{e.lastName}, {e.firstName}</td>
                        <td className="px-3 py-2 text-slate-500 text-xs">{[e.department, e.jobTitle].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="px-3 py-2">{e.patientId ? <span className="chip bg-emerald-100 text-emerald-700 text-[10px]">linked</span> : <span className="chip bg-slate-100 text-slate-500 text-[10px]">none</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {empDetail && (() => {
                const emp = empDetail.employee; const chart = empDetail.chart || {};
                const ins = chart.insurance || {};
                return (
                  <div className="card card-pad space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{emp.firstName} {emp.lastName}</div>
                        <div className="text-xs text-slate-500">{chart.mrn ? `MRN ${chart.mrn}` : "No chart"} {emp.dob && `· DOB ${new Date(emp.dob).toLocaleDateString()}`}</div>
                      </div>
                      <button onClick={() => setEmpDetail(null)} className="text-slate-400 text-xs hover:text-slate-700">✕</button>
                    </div>

                    {/* Insurance */}
                    <details className="rounded-lg border border-slate-200 p-3" open>
                      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Insurance {ins.insurerName && <span className="ml-1 font-normal text-slate-500">· {ins.insurerName} {ins.memberId ? `(${ins.memberId})` : ""}</span>}</summary>
                      <InsuranceForm ins={ins} onSave={(b: any) => postDetail("insurance", b, "Insurance saved to chart.")} />
                    </details>

                    {/* Eligibility */}
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-800">Eligibility</div>
                        <button onClick={runEligibility} className="chip bg-brand-100 text-brand-800 text-xs">Check now</button>
                      </div>
                      {(chart.eligibility || []).slice(0, 3).map((c: any) => (
                        <div key={c.id} className="mt-1 text-xs text-slate-600 flex items-center gap-2">
                          <span className={`chip ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : c.status === "inactive" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{c.status}</span>
                          <span>{c.planName || c.payerName || "—"}</span>
                          <span className="text-slate-400 ml-auto">{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                      {(!chart.eligibility || chart.eligibility.length === 0) && <div className="text-[11px] text-slate-400 mt-1">No checks yet. Add insurance with a payer ID, then check.</div>}
                    </div>

                    {/* Medications */}
                    <details className="rounded-lg border border-slate-200 p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Medications ({(chart.medications || []).length})</summary>
                      <ul className="mt-2 space-y-1 text-xs text-slate-600">
                        {(chart.medications || []).map((m: any) => <li key={m.id}>• {m.name} {m.strength} {m.frequency ? `· ${m.frequency}` : ""}</li>)}
                      </ul>
                      <MedForm onSave={(b: any) => postDetail("medications", b, "Medication added to chart.")} />
                    </details>

                    {/* Referrals */}
                    <details className="rounded-lg border border-slate-200 p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-800">Referrals ({(chart.referrals || []).length})</summary>
                      <ul className="mt-2 space-y-1 text-xs text-slate-600">
                        {(chart.referrals || []).map((m: any) => <li key={m.id}>• {m.name} {m.specialty ? `· ${m.specialty}` : ""}</li>)}
                      </ul>
                      <ReferralForm onSave={(b: any) => postDetail("referrals", b, "Referral added to chart.")} />
                    </details>

                    {/* Consent forms */}
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="text-sm font-semibold text-slate-800 mb-1">Consent & forms (e-sign)</div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {forms.map((fm) => <button key={fm.key} onClick={() => addConsent(fm.key)} className="chip bg-white ring-1 ring-slate-200 text-[11px] hover:bg-slate-50" title={fm.summary}>+ {fm.title}</button>)}
                      </div>
                      <ul className="space-y-1">
                        {(chart.consents || []).map((c: any) => (
                          <li key={c.id} className="flex items-center gap-2 text-xs">
                            <span className="flex-1 text-slate-700">{c.formTitle}</span>
                            {c.status === "signed" ? (
                              <>
                                <span className="chip bg-emerald-100 text-emerald-700 text-[10px]">signed</span>
                                {c.documentId && <a href={`/api/enterprise/documents/${c.documentId}`} target="_blank" rel="noopener" className="text-brand-600 underline">PDF</a>}
                              </>
                            ) : (
                              <button onClick={() => signEmpConsent(c.id, c.signerRole || "employee")} className="chip bg-amber-100 text-amber-800 text-[10px]">e-sign</button>
                            )}
                          </li>
                        ))}
                        {(!chart.consents || chart.consents.length === 0) && <li className="text-[11px] text-slate-400">No forms yet.</li>}
                      </ul>
                    </div>

                    {/* Employee self-service login */}
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-800">Employee login (self-service)</div>
                        <span className={`chip text-[10px] ${emp.accessEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{emp.accessEnabled ? "enabled" : "off"}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Give the employee an access code + PIN so they can view results and e-sign forms themselves at <span className="font-mono">/enterprise/employee</span>.</p>
                      {accessCreds && (
                        <div className="mt-2 rounded-lg bg-blue-50 ring-1 ring-blue-200 p-2 text-sm">
                          <div>Access code: <span className="font-mono font-bold">{accessCreds.accessCode}</span></div>
                          <div>PIN: <span className="font-mono font-bold">{accessCreds.pin}</span></div>
                          <div className="text-[11px] text-blue-700 mt-1">Share these now — the PIN is shown only once.</div>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {!emp.accessEnabled && <button onClick={() => manageAccess("enable")} className="chip bg-brand-100 text-brand-800 text-xs">Enable login</button>}
                        {emp.accessEnabled && <button onClick={() => manageAccess("reset")} className="chip bg-white ring-1 ring-slate-200 text-xs">Reset PIN</button>}
                        {emp.accessEnabled && <button onClick={() => manageAccess("disable")} className="chip bg-rose-100 text-rose-700 text-xs">Disable</button>}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {!empDetail && <div className="card card-pad flex items-center justify-center text-sm text-slate-400 min-h-[200px]">Select an employee to manage insurance, medications, referrals, eligibility & consent.</div>}
            </div>
          </div>
        )}

        {tab === "new" && (
          <div className="max-w-2xl space-y-4">
            <div className="card card-pad">
              <h2 className="font-semibold text-slate-900">Bulk import (CSV)</h2>
              <p className="text-[11px] text-slate-500 mb-2">Request the same service for many employees at once. CSV columns: <span className="font-mono">First,Last,DOB(YYYY-MM-DD),Email,Phone</span>. Each employee is added to the clinic charts and gets a request.</p>
              <div className="flex flex-wrap items-center gap-2">
                <select className="input w-auto" value={f.serviceKey} onChange={(e) => setF({ ...f, serviceKey: e.target.value })}>
                  {catalog.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <label className="btn-secondary cursor-pointer text-sm">{bulkBusy ? "Importing…" : "Upload CSV"}<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) bulkImport(x); }} /></label>
              </div>
            </div>
            <form onSubmit={submitRequest} className="card card-pad space-y-3">
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
          </div>
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
                    <td className="px-3 py-2 text-right space-x-1">
                      {resultDocs[r.id] && <a href={`/api/enterprise/documents/${resultDocs[r.id].id}`} target="_blank" rel="noopener" className="chip bg-emerald-100 text-emerald-700 text-xs">Result PDF</a>}
                      {r.consentStatus !== "signed" && <button onClick={() => signConsent(r.id)} className="chip bg-brand-100 text-brand-800 text-xs">Sign consent</button>}
                    </td>
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
                  <tr key={i.id}><td className="px-3 py-2 font-mono text-slate-700">{i.number}</td><td className="px-3 py-2 text-slate-600">{new Date(i.issueDate).toLocaleDateString()}</td><td className="px-3 py-2 text-slate-600">{i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "—"}</td><td className="px-3 py-2 text-right font-semibold">{money(i.totalCents)}</td><td className="px-3 py-2"><span className={`chip ${i.status === "paid" ? "bg-emerald-100 text-emerald-700" : i.status === "void" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"}`}>{i.status}</span> <a href={`/api/enterprise/invoices/${i.id}/pdf`} target="_blank" rel="noopener" className="ml-1 text-xs text-brand-600 underline">PDF</a></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "dot" && <DotPanel isSuper={isSuper} companyId={companyId} />}
      </main>
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-slate-900 text-white text-sm px-4 py-2 shadow-lg">{toast}</div>}
    </div>
  );
}

function InsuranceForm({ ins, onSave }: { ins: any; onSave: (b: any) => void }) {
  const [v, setV] = useState({ insurerName: ins.insurerName || "", insurerPlan: ins.insurerPlan || "", memberId: ins.memberId || "", groupNumber: ins.groupNumber || "", payerId: ins.payerId || "" });
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <input className="input text-sm" placeholder="Insurer name" value={v.insurerName} onChange={(e) => setV({ ...v, insurerName: e.target.value })} />
      <input className="input text-sm" placeholder="Plan" value={v.insurerPlan} onChange={(e) => setV({ ...v, insurerPlan: e.target.value })} />
      <input className="input text-sm" placeholder="Member ID" value={v.memberId} onChange={(e) => setV({ ...v, memberId: e.target.value })} />
      <input className="input text-sm" placeholder="Group #" value={v.groupNumber} onChange={(e) => setV({ ...v, groupNumber: e.target.value })} />
      <input className="input text-sm" placeholder="Payer ID (for eligibility, e.g. 60054)" value={v.payerId} onChange={(e) => setV({ ...v, payerId: e.target.value })} />
      <button onClick={() => onSave(v)} className="btn-primary text-sm">Save insurance</button>
    </div>
  );
}

function MedForm({ onSave }: { onSave: (b: any) => void }) {
  const [v, setV] = useState({ name: "", strength: "", frequency: "" });
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <input className="input text-sm flex-1 min-w-[120px]" placeholder="Medication" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      <input className="input text-sm w-24" placeholder="Strength" value={v.strength} onChange={(e) => setV({ ...v, strength: e.target.value })} />
      <input className="input text-sm w-28" placeholder="Frequency" value={v.frequency} onChange={(e) => setV({ ...v, frequency: e.target.value })} />
      <button onClick={() => { if (v.name.trim()) { onSave(v); setV({ name: "", strength: "", frequency: "" }); } }} className="btn-secondary text-sm">Add</button>
    </div>
  );
}

function ReferralForm({ onSave }: { onSave: (b: any) => void }) {
  const [v, setV] = useState({ name: "", specialty: "", phone: "" });
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <input className="input text-sm flex-1 min-w-[120px]" placeholder="Referring provider" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      <input className="input text-sm w-32" placeholder="Specialty" value={v.specialty} onChange={(e) => setV({ ...v, specialty: e.target.value })} />
      <input className="input text-sm w-28" placeholder="Phone" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      <button onClick={() => { if (v.name.trim()) { onSave(v); setV({ name: "", specialty: "", phone: "" }); } }} className="btn-secondary text-sm">Add</button>
    </div>
  );
}
