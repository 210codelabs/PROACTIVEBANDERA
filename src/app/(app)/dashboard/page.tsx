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
    // Fetch base rows WITHOUT relation includes. Prisma + MongoDB throws an
    // "inconsistent query result / required relation" error whenever an
    // include points at a record that no longer exists (a dangling patient or
    // provider reference). Even one such orphan makes the whole findMany reject
    // and permanently shows the "metrics unavailable" banner in production.
    // Hydrating relations separately (below) makes the dashboard resilient.
    const base = await Promise.allSettled([
      db.appointment.findMany({
        where: {
          startsAt: { gte: startOfDay(today), lte: endOfDay(today) },
          ...(user.role === "provider" ? { providerId: user.id } : {}),
        },
        orderBy: { startsAt: "asc" },
      }),
      db.encounter.findMany({
        where: { status: "open", ...(user.role === "provider" ? { providerId: user.id } : {}) },
        orderBy: { startedAt: "desc" },
        take: 6,
      }),
      db.patient.findMany({
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      db.order.findMany({
        where: { status: "pending", ...(user.role === "provider" ? { providerId: user.id } : {}) },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      db.message.count({ where: { toUserId: user.id, read: false } }),
      db.patient.count(),
    ]);

    const apptRows = base[0].status === "fulfilled" ? base[0].value : [];
    const encRows = base[1].status === "fulfilled" ? base[1].value : [];
    recentPatients = base[2].status === "fulfilled" ? base[2].value : [];
    const orderRows = base[3].status === "fulfilled" ? base[3].value : [];
    unreadMessages = base[4].status === "fulfilled" ? base[4].value : 0;
    patientCount = base[5].status === "fulfilled" ? base[5].value : 0;

    // Collect the related IDs and load them in bulk.
    const patientIds = new Set<string>();
    const providerIds = new Set<string>();
    const serviceTypeIds = new Set<string>();
    for (const a of apptRows) { patientIds.add(a.patientId); providerIds.add(a.providerId); if (a.serviceTypeId) serviceTypeIds.add(a.serviceTypeId); }
    for (const e of encRows) { patientIds.add(e.patientId); }
    for (const o of orderRows) { patientIds.add(o.patientId); }

    const rel = await Promise.allSettled([
      patientIds.size ? db.patient.findMany({ where: { id: { in: [...patientIds] } } }) : Promise.resolve([] as any[]),
      providerIds.size ? db.user.findMany({ where: { id: { in: [...providerIds] } } }) : Promise.resolve([] as any[]),
      serviceTypeIds.size ? db.serviceType.findMany({ where: { id: { in: [...serviceTypeIds] } } }) : Promise.resolve([] as any[]),
    ]);
    const pats = rel[0].status === "fulfilled" ? rel[0].value : [];
    const provs = rel[1].status === "fulfilled" ? rel[1].value : [];
    const svcs = rel[2].status === "fulfilled" ? rel[2].value : [];
    const pMap = new Map(pats.map((p: any) => [p.id, p]));
    const uMap = new Map(provs.map((u: any) => [u.id, u]));
    const sMap = new Map(svcs.map((s: any) => [s.id, s]));

    // Attach relations; silently drop rows whose required patient/provider is
    // missing so the UI never dereferences a null relation.
    todays = apptRows
      .map((a: any) => ({ ...a, patient: pMap.get(a.patientId), provider: uMap.get(a.providerId), serviceType: a.serviceTypeId ? (sMap.get(a.serviceTypeId) ?? null) : null }))
      .filter((a: any) => a.patient && a.provider);
    openEncounters = encRows
      .map((e: any) => ({ ...e, patient: pMap.get(e.patientId) }))
      .filter((e: any) => e.patient);
    openOrders = orderRows
      .map((o: any) => ({ ...o, patient: pMap.get(o.patientId) }))
      .filter((o: any) => o.patient);

    // Only flag "unavailable" for a genuine DB failure on the base queries.
    dataUnavailable = base.some((r) => r.status === "rejected");
    if (dataUnavailable) {
      console.error("[dashboard] base query rejected:", base.filter((r) => r.status === "rejected"));
    }
  } catch (err) {
    // Keep dashboard responsive when DB initialization fails in serverless runtime.
    console.error("[dashboard] data load failed:", err);
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
            <h1 className="text-2xl font-bold text-brand-900">Good {greeting()}, {user.firstName}.</h1>
            <p className="text-sm text-slate-500">{fmtDateTime(today)} · {todays.length} appointment{todays.length === 1 ? "" : "s"} today</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Kpi label="Today" value={todays.length} sub={`${completed} completed`} accent="brand" href="/schedule" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            <Kpi label="Open notes" value={openEncounters.length} accent="amber" href="/encounters?status=open" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            <Kpi label="Pending orders" value={openOrders.length} accent="violet" href="/orders?status=pending" icon="M9 3v6L4 19a2 2 0 002 3h12a2 2 0 002-3l-5-10V3M9 3h6" />
            <Kpi label="Unread msgs" value={unreadMessages} accent="rose" href="/messages" icon="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            <Kpi label="Patients" value={patientCount} accent="emerald" href="/patients" icon="M16 14a4 4 0 10-8 0M4 20c0-3 3-5 8-5s8 2 8 5" />
          </div>
        </div>

        {/* live operations reporting */}
        <div className="lg:col-span-3">
          <LiveOpsPanel initialMetrics={initialMetrics} />
        </div>

        {/* today's schedule */}
        <section className="card card-interactive lg:col-span-2 border-l-4 border-l-brand-500">
          <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="font-semibold text-brand-900 flex items-center gap-2"><span className="h-7 w-7 rounded-lg bg-brand-100 grid place-items-center text-brand-700"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></span>Today's Schedule</div>
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
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-brand-900 flex items-center gap-2"><span className="h-7 w-7 rounded-lg bg-amber-100 grid place-items-center text-amber-700"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg></span>Open Encounter Notes</header>
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
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-brand-900 flex items-center gap-2"><span className="h-7 w-7 rounded-lg bg-emerald-100 grid place-items-center text-emerald-700"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 14a4 4 0 10-8 0M4 20c0-3 3-5 8-5s8 2 8 5" /></svg></span>Recent Patients</header>
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
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-brand-900 flex items-center gap-2"><span className="h-7 w-7 rounded-lg bg-violet-100 grid place-items-center text-violet-700"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v6L4 19a2 2 0 002 3h12a2 2 0 002-3l-5-10V3M9 3h6" /></svg></span>Pending Orders</header>
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

function Kpi({ label, value, sub, accent = "brand", icon, href }: { label: string; value: number | string; sub?: string; accent?: "amber" | "violet" | "rose" | "brand" | "emerald"; icon?: string; href?: string }) {
  const bg: Record<string, string> = {
    brand: "bg-brand-600",
    amber: "bg-amber-500",
    violet: "bg-violet-600",
    rose: "bg-rose-600",
    emerald: "bg-emerald-600",
  };
  const inner = (
    <>
      <div className={`h-11 w-11 shrink-0 rounded-xl ${bg[accent]} grid place-items-center text-white shadow-sm`}>
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon || "M5 13l4 4L19 7"} /></svg>
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold text-brand-900 leading-none">{value}</div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-1">{label}</div>
        {sub && <div className="text-[11px] text-slate-400 leading-tight">{sub}</div>}
      </div>
    </>
  );
  const base = "rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm p-4 min-w-[150px] flex items-center gap-3 transition-all";
  if (href) {
    return (
      <Link href={href} prefetch={false} className={`${base} hover:shadow-md hover:-translate-y-0.5 hover:ring-brand-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-400`} aria-label={`${label} — open`}>
        {inner}
      </Link>
    );
  }
  return <div className={`${base} hover:shadow-md hover:-translate-y-0.5`}>{inner}</div>;
}
