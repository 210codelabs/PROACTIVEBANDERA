import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import { fmtRelative } from "@/lib/utils";
import { mapByIds } from "@/lib/safe-relations";

export default async function Messages() {
  const user = await requireSession();
  let inbox: Array<{
    id: string;
    subject: string;
    body: string;
    read: boolean;
    createdAt: Date;
    patientId: string | null;
    fromUser: { firstName: string; lastName: string };
    patient: { firstName: string; lastName: string } | null;
  }> = [];
  let sent: Array<{
    id: string;
    subject: string;
    body: string;
    createdAt: Date;
    toUser: { firstName: string; lastName: string } | null;
  }> = [];
  let dataUnavailable = false;

  try {
    const results = await Promise.allSettled([
      db.message.findMany({
        where: { toUserId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.message.findMany({
        where: { fromUserId: user.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);

    const inboxRows = results[0].status === "fulfilled" ? results[0].value : [];
    const sentRows = results[1].status === "fulfilled" ? results[1].value : [];

    const uMap = await mapByIds("user", [...inboxRows.map((r) => r.fromUserId), ...sentRows.map((r) => r.toUserId)]);
    const pMap = await mapByIds("patient", [...inboxRows.map((r) => r.patientId), ...sentRows.map((r) => r.patientId)]);

    inbox = inboxRows
      .map((r) => ({ ...r, fromUser: uMap.get(r.fromUserId), patient: r.patientId ? (pMap.get(r.patientId) ?? null) : null }))
      .filter((r) => r.fromUser) as typeof inbox;
    sent = sentRows
      .map((r) => ({ ...r, toUser: r.toUserId ? (uMap.get(r.toUserId) ?? null) : null, patient: r.patientId ? (pMap.get(r.patientId) ?? null) : null })) as typeof sent;

    dataUnavailable = results.some((r) => r.status === "rejected");
  } catch {
    dataUnavailable = true;
  }

  return (
    <Shell user={user} pageTitle="Messages" jellyBeans={<JellyBeans />}>
      {dataUnavailable && (
        <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">
          Messages are temporarily unavailable.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Inbox ({inbox.filter(m => !m.read).length} unread)</header>
          <ul className="divide-y divide-slate-100">
            {inbox.length === 0 && <li className="p-6 text-sm text-slate-500">No messages.</li>}
            {inbox.map(m => (
              <li key={m.id} className={`px-4 py-3 ${m.read ? "" : "bg-amber-50/50"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-900">{m.subject}</span>
                  <span className="text-xs text-slate-500">{fmtRelative(m.createdAt)}</span>
                </div>
                <div className="text-xs text-slate-600">From <span className="font-medium">{m.fromUser.firstName} {m.fromUser.lastName}</span>{m.patient ? <> · re: <Link className="text-brand-700 hover:underline" href={`/patients/${m.patientId}`}>{m.patient.lastName}, {m.patient.firstName}</Link></> : null}</div>
                <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{m.body}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold">Sent</header>
          <ul className="divide-y divide-slate-100">
            {sent.length === 0 && <li className="p-6 text-sm text-slate-500">No sent messages.</li>}
            {sent.map(m => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-900">{m.subject}</span>
                  <span className="text-xs text-slate-500">{fmtRelative(m.createdAt)}</span>
                </div>
                <div className="text-xs text-slate-600">To <span className="font-medium">{m.toUser ? `${m.toUser.firstName} ${m.toUser.lastName}` : "—"}</span></div>
                <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{m.body}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}
