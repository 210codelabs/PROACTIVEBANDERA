import PortalShell from "@/components/portal/PortalShell";
import PortalIntakeUpload from "@/components/portal/PortalIntakeUpload";
import { db } from "@/lib/db";
import { requirePortalSession } from "@/lib/portalAuth";

function parse(body: string | null): any {
  if (!body) return {};
  try { return JSON.parse(body) || {}; } catch { return {}; }
}

export default async function PortalDocumentsPage() {
  const session = await requirePortalSession();
  let docs: Array<{ id: string; title: string; category: string | null; createdAt: Date; body: string | null }> = [];
  let dataUnavailable = false;

  try {
    docs = await db.document.findMany({
      where: { patientId: session.patientId },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    dataUnavailable = true;
  }

  return (
    <PortalShell session={session} active="/portal/documents">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Documents are temporarily unavailable.</div>}

      <PortalIntakeUpload />

      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">Clinical Documents ({docs.length})</header>
        {docs.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No documents on file yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((doc) => {
              const b = parse(doc.body);
              const isOnline = doc.category === "intake" || doc.category === "intake-followup";
              const isUpload = doc.category === "intake-upload";
              const status = b.reviewStatus;
              return (
                <li key={doc.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{doc.title}</span>
                        {status && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${status === "approved" ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500"}`}>
                            {status === "approved" ? "Approved" : "Pending review"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {(doc.category || "document")} · {new Date(doc.createdAt).toLocaleString()}
                        {b.confirmation ? ` · Conf ${b.confirmation}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOnline && b.values && (
                        <a href={`/api/portal/intake/${doc.id}/pdf`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                          Download PDF
                        </a>
                      )}
                      {isUpload && (
                        <a href={`/api/portal/intake/${doc.id}/file`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                          Download file
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PortalShell>
  );
}
