import PortalShell from "@/components/portal/PortalShell";
import { db } from "@/lib/db";
import { requirePortalSession } from "@/lib/portalAuth";
import { getT } from "@/lib/i18n/server";

export default async function PortalDashboardPage() {
  const session = await requirePortalSession();
  const { t } = await getT();

  let upcoming: Array<{ id: string; startsAt: Date; reason: string | null; provider: { firstName: string; lastName: string }; serviceType: { name: string } | null }> = [];
  let recentDocs: Array<{ id: string; title: string; category: string | null; createdAt: Date }> = [];
  let unreadCount = 0;
  let dataUnavailable = false;

  try {
    const results = await Promise.allSettled([
      db.appointment.findMany({
        where: { patientId: session.patientId, startsAt: { gte: new Date() } },
        include: { provider: true, serviceType: true },
        orderBy: { startsAt: "asc" },
        take: 5,
      }),
      db.document.findMany({
        where: { patientId: session.patientId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.message.count({ where: { patientId: session.patientId, read: false } }),
    ]);

    upcoming = results[0].status === "fulfilled" ? results[0].value : [];
    recentDocs = results[1].status === "fulfilled" ? results[1].value : [];
    unreadCount = results[2].status === "fulfilled" ? results[2].value : 0;
    dataUnavailable = results.some((r) => r.status === "rejected");
  } catch {
    dataUnavailable = true;
  }

  return (
    <PortalShell session={session} active="/portal/dashboard">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">{t("portal.dataUnavailable")}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <section className="card card-pad sm:col-span-2 lg:col-span-3 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
          <Metric label={t("portal.upcomingAppointments")} value={upcoming.length} />
          <Metric label={t("portal.unreadMessages")} value={unreadCount} />
          <Metric label={t("portal.recentDocuments")} value={recentDocs.length} />
        </section>

        <section className="card sm:col-span-2">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-sm sm:text-base">{t("portal.upcomingAppointments")}</header>
          {upcoming.length === 0 ? (
            <div className="p-4 text-xs sm:text-sm text-slate-500">{t("portal.noUpcoming")}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((item) => (
                <li key={item.id} className="px-3 sm:px-4 py-2 sm:py-3">
                  <div className="font-medium text-xs sm:text-sm text-slate-900">{new Date(item.startsAt).toLocaleString()}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.serviceType?.name || item.reason || t("portal.visit")} · {item.provider.firstName} {item.provider.lastName}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-sm sm:text-base">{t("portal.recentDocuments")}</header>
          {recentDocs.length === 0 ? (
            <div className="p-4 text-xs sm:text-sm text-slate-500">{t("portal.noDocuments")}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentDocs.map((doc) => (
                <li key={doc.id} className="px-3 sm:px-4 py-2 sm:py-3">
                  <div className="font-medium text-xs sm:text-sm text-slate-900 line-clamp-2">{doc.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{doc.category || t("portal.documentLabel")} · {new Date(doc.createdAt).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PortalShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-2 sm:p-3 flex-1 sm:flex-none sm:min-w-[160px]">
      <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
