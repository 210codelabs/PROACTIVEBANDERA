import PortalShell from "@/components/portal/PortalShell";
import { db } from "@/lib/db";
import { requirePortalSession } from "@/lib/portalAuth";

export default async function PortalMessagesPage() {
  const session = await requirePortalSession();
  let messages: Array<{ id: string; subject: string; read: boolean; createdAt: Date; body: string; fromUser: { firstName: string; lastName: string } }> = [];
  let dataUnavailable = false;

  try {
    messages = await db.message.findMany({
      where: { patientId: session.patientId },
      include: { fromUser: true },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    dataUnavailable = true;
  }

  return (
    <PortalShell session={session} active="/portal/messages">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Messages are temporarily unavailable.</div>}
      <section className="card">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold">Secure Messages</header>
        {messages.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">No messages yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {messages.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-900">{m.subject}</div>
                  {!m.read && <span className="chip bg-amber-100 text-amber-800 ring-amber-200">new</span>}
                </div>
                <div className="text-xs text-slate-500 mt-1">From {m.fromUser.firstName} {m.fromUser.lastName} · {new Date(m.createdAt).toLocaleString()}</div>
                <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PortalShell>
  );
}
