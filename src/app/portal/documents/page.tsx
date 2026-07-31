import PortalShell from "@/components/portal/PortalShell";
import { db } from "@/lib/db";
import { requirePortalSession } from "@/lib/portalAuth";

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
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">Clinical Documents</header>
        <table className="data">
          <thead>
            <tr><th>Title</th><th>Category</th><th>Date</th><th>Content</th></tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td className="font-medium">{doc.title}</td>
                <td>{doc.category || "document"}</td>
                <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
                <td className="text-xs max-w-[420px] truncate">{doc.body || "No attached text"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PortalShell>
  );
}
