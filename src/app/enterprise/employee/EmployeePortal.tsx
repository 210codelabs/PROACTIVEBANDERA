"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const RESULT_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600", pass: "bg-emerald-100 text-emerald-700", fail: "bg-rose-100 text-rose-700", inconclusive: "bg-amber-100 text-amber-700", na: "bg-slate-100 text-slate-500",
};

export default function EmployeePortal({ name, companyName }: { name: string; companyName: string }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const load = useCallback(async () => {
    const d = await fetch("/api/enterprise/employee-portal/me").then((r) => r.json()).catch(() => null);
    setData(d);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function logout() { await fetch("/api/enterprise/employee-portal/logout", { method: "POST" }); router.push("/enterprise/employee/login"); }

  async function sign(consentId: string) {
    const sig = window.prompt("Type your full legal name to e-sign this form:");
    if (!sig) return;
    const r = await fetch(`/api/enterprise/employee-portal/consents/${consentId}/sign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signatureText: sig }) });
    if (r.ok) { await load(); flash("Form signed — thank you."); }
    else { const d = await r.json(); flash(d.error || "Could not sign"); }
  }

  const results = data?.results || [];
  const consents = data?.consents || [];
  const requests = data?.requests || [];
  const pendingConsents = consents.filter((c: any) => c.status !== "signed");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div>
            <div className="font-bold">Employee Portal</div>
            <div className="text-xs text-white/60">{companyName}</div>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-white/70">{name}</span>
            <button onClick={logout} className="rounded-md bg-white/10 px-3 py-1.5 hover:bg-white/20">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {pendingConsents.length > 0 && (
          <div className="card card-pad">
            <h2 className="font-semibold text-slate-900 mb-2">Forms to sign</h2>
            <ul className="space-y-2">
              {pendingConsents.map((c: any) => (
                <li key={c.id} className="flex items-center gap-2 text-sm rounded-lg bg-amber-50 ring-1 ring-amber-200 p-2">
                  <span className="flex-1 text-slate-800">{c.formTitle}</span>
                  <button onClick={() => sign(c.id)} className="btn-primary text-xs">e-Sign</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card card-pad">
          <h2 className="font-semibold text-slate-900 mb-2">My results</h2>
          {requests.length === 0 && <p className="text-sm text-slate-400">No services on file yet.</p>}
          <ul className="divide-y divide-slate-100">
            {requests.map((r: any) => {
              const doc = results.find((d: any) => d.requestId === r.id);
              return (
                <li key={r.id} className="py-2 flex items-center gap-2 text-sm">
                  <div className="flex-1">
                    <div className="text-slate-800">{r.serviceLabel}</div>
                    <div className="text-[11px] text-slate-400">{new Date(r.createdAt).toLocaleDateString()} · {String(r.status).replace("_", " ")}</div>
                  </div>
                  <span className={`chip ${RESULT_COLORS[r.resultStatus] || ""}`}>{r.resultStatus}</span>
                  {doc && <a href={`/api/enterprise/employee-portal/documents/${doc.id}`} target="_blank" rel="noopener" className="chip bg-emerald-100 text-emerald-700 text-xs">Result PDF</a>}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card card-pad">
          <h2 className="font-semibold text-slate-900 mb-2">Signed forms</h2>
          {consents.filter((c: any) => c.status === "signed").length === 0 && <p className="text-sm text-slate-400">No signed forms yet.</p>}
          <ul className="divide-y divide-slate-100">
            {consents.filter((c: any) => c.status === "signed").map((c: any) => (
              <li key={c.id} className="py-2 flex items-center gap-2 text-sm">
                <span className="flex-1 text-slate-800">{c.formTitle}</span>
                <span className="chip bg-emerald-100 text-emerald-700 text-[10px]">signed</span>
                {c.documentId && <a href={`/api/enterprise/employee-portal/documents/${c.documentId}`} target="_blank" rel="noopener" className="text-brand-600 underline text-xs">PDF</a>}
              </li>
            ))}
          </ul>
        </div>
      </main>
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-slate-900 text-white text-sm px-4 py-2 shadow-lg">{toast}</div>}
    </div>
  );
}
