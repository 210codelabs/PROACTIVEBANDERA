import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import { fmtDate } from "@/lib/utils";

function parseBody(body: string | null): Record<string, any> | null {
  if (!body) return null;
  try { const o = JSON.parse(body); return o && typeof o === "object" ? o : null; } catch { return null; }
}

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  let docs: any[] = [];
  let dataUnavailable = Boolean((ctx as any).dataUnavailable);
  try {
    docs = await db.document.findMany({ where: { patientId: id }, orderBy: { createdAt: "desc" } });
  } catch { dataUnavailable = true; }

  return (
    <PatientChart user={user} {...ctx} active="documents">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Documents are temporarily unavailable.</div>}
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">Documents ({docs.length})</header>
        {docs.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No documents on file. HIPAA intake completed at the kiosk will appear here automatically.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((d) => {
              const meta = d.category === "consent" ? parseBody(d.body) : null;
              return (
                <li key={d.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600 shrink-0">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h6l6 6v10a2 2 0 01-2 2z" /></svg>
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 truncate">{d.title}</div>
                        <div className="text-xs text-slate-500">{fmtDate(d.createdAt)}</div>
                      </div>
                    </div>
                    <span className="chip bg-slate-100 text-slate-600 ring-slate-200 capitalize shrink-0">{d.category || "other"}</span>
                  </div>
                  {meta ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-brand-700 hover:text-brand-900">View signed intake</summary>
                      <div className="mt-2 rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3 text-sm text-slate-700 grid sm:grid-cols-2 gap-y-1 gap-x-6">
                        {meta.confirmation && <div><span className="text-slate-400">Confirmation:</span> <span className="font-mono">{meta.confirmation}</span></div>}
                        {meta.module && <div><span className="text-slate-400">Module:</span> {meta.module}</div>}
                        {meta.reason && <div><span className="text-slate-400">Reason:</span> {meta.reason}</div>}
                        {meta.phone && <div><span className="text-slate-400">Phone:</span> {meta.phone}</div>}
                        {meta.email && <div><span className="text-slate-400">Email:</span> {meta.email}</div>}
                        <div><span className="text-slate-400">HIPAA consent:</span> {meta.hipaaConsent ? "Acknowledged" : "No"}</div>
                        {meta.signature && <div className="sm:col-span-2"><span className="text-slate-400">Signature:</span> <span className="font-[cursive] text-base">{meta.signature}</span></div>}
                        {meta.submittedAt && <div className="sm:col-span-2 text-xs text-slate-400">Submitted {new Date(meta.submittedAt).toLocaleString()} · source: {meta.source || "kiosk"}</div>}
                      </div>
                    </details>
                  ) : d.body ? (
                    <p className="mt-1 text-sm text-slate-600 line-clamp-2">{d.body}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PatientChart>
  );
}
