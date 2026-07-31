import PortalShell from "@/components/portal/PortalShell";
import Link from "next/link";
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

      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-700 to-brand-900 text-white p-5 sm:p-7 mb-4">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div>
            <div className="text-brand-100 text-sm">{t("portal.welcome")}</div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{session.firstName} {session.lastName}</h1>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">MRN {session.mrn}</div>
          </div>
          <div className="hidden sm:grid h-16 w-16 rounded-2xl bg-white/15 place-items-center shrink-0">
            <svg className="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-8 -bottom-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute right-16 -top-12 h-32 w-32 rounded-full bg-emerald-400/10" />
      </section>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <Metric label={t("portal.upcomingAppointments")} value={upcoming.length} accent="brand" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        <Metric label={t("portal.unreadMessages")} value={unreadCount} accent="rose" icon="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        <Metric label={t("portal.recentDocuments")} value={recentDocs.length} accent="emerald" icon="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </div>

      {/* Quick actions */}
      <div className="mb-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t("portal.quickActions")}</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { href: "/portal/appointments", label: t("portal.appointments"), bg: "bg-brand-600", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
            { href: "/portal/messages", label: t("portal.messages"), bg: "bg-rose-600", icon: "M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
            { href: "/portal/documents", label: t("portal.documents"), bg: "bg-emerald-600", icon: "M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
            { href: "/portal/assistant", label: t("portal.aiAssistant"), bg: "bg-violet-600", icon: "M12 8V4m0 0H8m4 0h4M5 12a7 7 0 0114 0v3a2 2 0 01-2 2h-1l-2 3-2-3H7a2 2 0 01-2-2v-3z" },
          ].map((q) => (
            <Link key={q.href} href={q.href} prefetch={false} className="group rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <span className={`h-11 w-11 shrink-0 rounded-xl ${q.bg} grid place-items-center text-white shadow-sm`}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={q.icon} /></svg>
              </span>
              <span className="font-semibold text-sm text-brand-900">{q.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <section className="card lg:col-span-2 border-l-4 border-l-brand-500">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-sm sm:text-base flex items-center gap-2 text-brand-900">
            <span className="h-7 w-7 rounded-lg bg-brand-100 grid place-items-center text-brand-700"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></span>
            {t("portal.upcomingAppointments")}
          </header>
          {upcoming.length === 0 ? (
            <div className="p-4 text-xs sm:text-sm text-slate-500">{t("portal.noUpcoming")}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((item) => (
                <li key={item.id} className="px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-slate-50 flex items-center gap-3">
                  <span className="h-9 w-9 shrink-0 rounded-full bg-brand-50 text-brand-700 grid place-items-center text-xs font-bold ring-1 ring-brand-100">{new Date(item.startsAt).toLocaleDateString(undefined, { day: "2-digit" })}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-xs sm:text-sm text-slate-900">{new Date(item.startsAt).toLocaleString()}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{item.serviceType?.name || item.reason || t("portal.visit")} · {item.provider.firstName} {item.provider.lastName}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card border-l-4 border-l-emerald-500">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-sm sm:text-base flex items-center gap-2 text-brand-900">
            <span className="h-7 w-7 rounded-lg bg-emerald-100 grid place-items-center text-emerald-700"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></span>
            {t("portal.recentDocuments")}
          </header>
          {recentDocs.length === 0 ? (
            <div className="p-4 text-xs sm:text-sm text-slate-500">{t("portal.noDocuments")}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentDocs.map((doc) => (
                <li key={doc.id} className="px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-slate-50">
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

function Metric({ label, value, accent = "brand", icon }: { label: string; value: number; accent?: "brand" | "rose" | "emerald"; icon?: string }) {
  const bg: Record<string, string> = { brand: "bg-brand-600", rose: "bg-rose-600", emerald: "bg-emerald-600" };
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition">
      <div className={`h-12 w-12 shrink-0 rounded-xl ${bg[accent]} grid place-items-center text-white shadow-sm`}>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon || "M5 13l4 4L19 7"} /></svg>
      </div>
      <div>
        <div className="text-2xl font-extrabold text-brand-900 leading-none">{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1">{label}</div>
      </div>
    </div>
  );
}
