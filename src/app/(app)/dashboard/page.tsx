import Link from "next/link";
import { startOfDay, endOfDay } from "date-fns";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import { fmtTime, fmtDateTime, colorForApptStatus, colorForCategory } from "@/lib/utils";
import JellyBeans from "@/components/JellyBeans";
import LiveOpsPanel from "@/components/LiveOpsPanel";

export default async function DashboardPage() {
  const user = await requireSession();
  const today = new Date();

  let todays: Array<any> = [];
  let openEncounters: Array<any> = [];
  let recentPatients: Array<any> = [];
  let openOrders: Array<any> = [];
  let unreadMessages = 0;
  let patientCount = 0;
  let dataUnavailable = false;

  try {
    const results = await Promise.allSettled([
      db.appointment.findMany({
        where: {
          startsAt: { gte: startOfDay(today), lte: endOfDay(today) },
          ...(user.role === "provider" ? { providerId: user.id } : {}),
        },
        include: { patient: true, provider: true, serviceType: true },
        orderBy: { startsAt: "asc" },
      }),
      db.encounter.findMany({
        where: { status: "open", ...(user.role === "provider" ? { providerId: user.id } : {}) },
        include: { patient: true, provider: true },
        orderBy: { startedAt: "desc" },
        take: 6,
      }),
      db.patient.findMany({
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      db.order.findMany({
        where: { status: "pending", ...(user.role === "provider" ? { providerId: user.id } : {}) },
        include: { patient: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      db.message.count({ where: { toUserId: user.id, read: false } }),
      db.patient.count(),
    ]);

    todays = results[0].status === "fulfilled" ? results[0].value : [];
    openEncounters = results[1].status === "fulfilled" ? results[1].value : [];
    recentPatients = results[2].status === "fulfilled" ? results[2].value : [];
    openOrders = results[3].status === "fulfilled" ? results[3].value : [];
    unreadMessages = results[4].status === "fulfilled" ? results[4].value : 0;
    patientCount = results[5].status === "fulfilled" ? results[5].value : 0;
    dataUnavailable = results.some((r) => r.status === "rejected");
  } catch {
    // Keep dashboard responsive when DB initialization fails in serverless runtime.
    dataUnavailable = true;
  }

  const completed = todays.filter(a => a.status === "completed").length;
  const checkedIn = todays.filter(a => a.status === "checked-in").length;
  const inRoom = todays.filter(a => a.status === "in-room").length;
  const noShow = todays.filter(a => a.status === "no-show").length;
  const pendingRx = openOrders.filter(o => o.type === "rx").length;
  const pendingLabs = openOrders.filter(o => o.type === "lab").length;
  const initialMetrics = {
    apptsToday: todays.length,
    checkedIn,
    inRoom,
    completed,
    noShow,
    waiting: checkedIn + inRoom,
    throughputPct: todays.length > 0 ? Math.round((completed / todays.length) * 100) : 0,
    openEncounters: openEncounters.length,
    pendingRx,
    pendingLabs,
    sentRxToday: 0,
    unreadMessages,
  };

  return (
    <Shell user={user} jellyBeans={<JellyBeans />}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
        {dataUnavailable && (
          <div className="lg:col-span-3 card card-pad border-amber-200 bg-amber-50 text-amber-900">
            Some dashboard metrics are temporarily unavailable.
          </div>
        )}
        {/* greeting + KPIs */}
        <div className="lg:col-span-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Good {greeting()}, {user.firstName}.</h1>
            <p className="text-sm text-slate-500">{fmtDateTime(today)} · {todays.length} appointment{todays.length === 1 ? "" : "s"} today</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Kpi label="Today" value={todays.length} sub={`${completed} completed`} />
            <Kpi label="Open notes" value={openEncounters.length} accent="amber" />
            <Kpi label="Pending orders" value={openOrders.length} accent="violet" />
            <Kpi label="Unread msgs" value={unreadMessages} accent="rose" />
            <Kpi label="Patients" value={patientCount} accent="brand" />
          </div>
        </div>

        {/* live operations reporting */}
        <div className="lg:col-span-3">
          <LiveOpsPanel initialMetrics={initialMetrics} />
        </div>

        {/* today's schedule */}
        <section className="card card-interactive lg:col-span-2 border-l-4 border-l-brand-500">
          <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="font-semibold text-slate-900">Today's Schedule</div>
            <Link href="/schedule" prefetch={false} className="text-xs font-semibold text-brand-700 hover:underline">Open schedule →</Link>
          </header>
          {todays.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No appointments today.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todays.map(a => (
                <li key={a.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50">
                  <div className="w-20 text-sm font-semibold text-slate-700">{fmtTime(a.startsAt)}</div>
                  <Link href={`/patients/${a.patientId}`} prefetch={false} className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{a.patient.lastName}, {a.patient.firstName}</div>
                    <div className="text-xs text-slate-500 truncate">{a.reason || a.serviceType?.name || "Office visit"} · with {a.provider.firstName} {a.provider.lastName}{a.provider.credential ? `, ${a.provider.credential}` : ""}</div>
                  </Link>
                  {a.serviceType && (
                    <span className={`chip ${colorForCategory(a.serviceType.category)}`}>{a.serviceType.name}</span>
                  )}
                  <span className={`chip ${colorForApptStatus(a.status)}`}>{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* open notes */}
        <section className="card card-interactive border-l-4 border-l-amber-500">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Open Encounter Notes</header>
          {openEncounters.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No open notes.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {openEncounters.map(e => (
                <li key={e.id} className="px-4 py-3 hover:bg-slate-50">
                  <Link href={`/encounters/${e.id}`} prefetch={false} className="block">
                    <div className="font-medium text-slate-900">{e.patient.lastName}, {e.patient.firstName}</div>
                    <div className="text-xs text-slate-500 truncate">{e.chiefComplaint || "—"} · {fmtDateTime(e.startedAt)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* recent patients */}
        <section className="card card-interactive border-l-4 border-l-emerald-500">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Recent Patients</header>
          <ul className="divide-y divide-slate-100">
            {recentPatients.map(p => (
              <li key={p.id} className="px-4 py-3 hover:bg-slate-50">
                <Link href={`/patients/${p.id}`} prefetch={false}>
                  <div className="font-medium text-slate-900">{p.lastName}, {p.firstName}</div>
                  <div className="text-xs text-slate-500">MRN {p.mrn} · DOB {new Date(p.dob).toLocaleDateString()}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* pending orders */}
        <section className="card card-interactive lg:col-span-2 border-l-4 border-l-violet-500">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Pending Orders</header>
          {openOrders.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No pending orders.</div>
          ) : (
            <table className="data">
              <thead>
                <tr><th>Patient</th><th>Type</th><th>Item</th><th>Priority</th><th>Created</th></tr>
              </thead>
              <tbody>
                {openOrders.map(o => (
                  <tr key={o.id}>
                    <td><Link href={`/patients/${o.patientId}`} prefetch={false} className="text-brand-700 hover:underline">{o.patient.lastName}, {o.patient.firstName}</Link></td>
                    <td className="uppercase text-xs font-semibold text-slate-600">{o.type}</td>
                    <td className="truncate max-w-[280px]">{o.itemName}</td>
                    <td><span className={`chip ${o.priority === "stat" ? "bg-rose-100 text-rose-800 ring-rose-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>{o.priority}</span></td>
                    <td className="text-xs text-slate-500">{fmtDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </Shell>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function Kpi({ label, value, sub, accent = "slate" }: { label: string; value: number | string; sub?: string; accent?: "slate" | "amber" | "violet" | "rose" | "brand" }) {
  const ring: Record<string, string> = {
    slate: "from-slate-100",
    amber: "from-amber-100",
    violet: "from-violet-100",
    rose: "from-rose-100",
    brand: "from-brand-100",
  };
  return (
    <div className={`card card-pad bg-gradient-to-br ${ring[accent]} to-white min-w-[120px]`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900 leading-tight">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
