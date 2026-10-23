import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import PatientIntakePanel, { IntakeDoc } from "@/components/PatientIntakePanel";
import { fmtDate } from "@/lib/utils";
import ChartDocumentList from "@/components/ChartDocumentList";
import { extractDocumentFile } from "@/lib/documentFile";

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

  const intakeDocs: IntakeDoc[] = docs
    .filter((d) => ["intake", "intake-followup", "intake-upload"].includes(d.category || ""))
    .map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.category === "intake-upload" ? "upload" : "online",
      createdAt: (d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt)),
    }));

  return (
    <PatientChart user={user} {...ctx} active="documents">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Documents are temporarily unavailable.</div>}
      <PatientIntakePanel patientId={id} intakeDocs={intakeDocs} />
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">Documents ({docs.length})</header>
        {docs.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No documents on file. HIPAA intake completed at the kiosk will appear here automatically.</div>
        ) : (
          <ChartDocumentList
            patientId={id}
            docs={docs.map((d) => {
              const f = extractDocumentFile(d.body);
              const isConsent = d.category === "consent";
              const j = !f && !isConsent ? parseBody(d.body) : null;
              return {
                id: d.id,
                title: d.title,
                category: d.category || null,
                createdLabel: fmtDate(d.createdAt),
                file: f ? { mime: f.mime, fileName: f.fileName } : null,
                meta: isConsent ? parseBody(d.body) : null,
                // Never ship raw base64 / JSON blobs to the client as text.
                text: f || isConsent || j ? null : (d.body ? String(d.body).slice(0, 400) : null),
              };
            })}
          />
        )}
      </section>
    </PatientChart>
  );
}
