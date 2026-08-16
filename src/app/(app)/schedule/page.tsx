import Link from "next/link";
import {
  addDays, format, startOfDay, endOfDay, parseISO, addMinutes,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths,
  eachDayOfInterval, isSameDay,
} from "date-fns";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import { fmtTime, colorForApptStatus, colorForCategory } from "@/lib/utils";
import NewApptButton from "./NewApptButton";
import MonthCalendar, { type MAppt } from "./MonthCalendar";
import ClinicTZBadge from "@/components/ClinicTZBadge";
import { PROVIDER_PALETTE } from "./palette";
import { mapByIds } from "@/lib/safe-relations";
import CopayButton from "@/components/billing/CopayButton";
import CheckInButton from "@/components/billing/CheckInButton";
import { getCopayMap, getLatestCoverageMap, classifyCoverage } from "@/lib/coverage";
import { getBalanceMap, fmtCents } from "@/lib/balances";

type View = "day" | "week" | "month" | "staff";
type Provider = { id: string; firstName: string; lastName: string; credential: string | null };
type Service = { id: string; name: string; durationMin: number; category: string; homeEligible: boolean };
type Appt = {
  id: string; patientId: string; providerId: string;
  startsAt: Date; endsAt: Date; status: string; reason: string | null; notes: string | null;
  pFirst: string; pLast: string; provLast: string;
  svcName: string | null; svcCat: string | null;
};

const DOT: Record<string, string> = {
  scheduled: "bg-slate-400", "checked-in": "bg-amber-500", "in-room": "bg-violet-500",
  completed: "bg-emerald-500", "no-show": "bg-rose-500", cancelled: "bg-slate-300",
};

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ d?: string; providerId?: string; view?: string }> }) {
  const sp = await searchParams;
  const user = await requireSession();
  const day = sp.d ? parseISO(sp.d) : new Date();
  const providerId = sp.providerId || "";
  const view: View = (["day", "week", "month", "staff"].includes(sp.view || "") ? sp.view : "month") as View;

  // Visible range per view
  let rangeStart: Date, rangeEnd: Date;
  if (view === "week") { rangeStart = startOfWeek(day, { weekStartsOn: 0 }); rangeEnd = endOfWeek(day, { weekStartsOn: 0 }); }
  else if (view === "month") { rangeStart = startOfWeek(startOfMonth(day), { weekStartsOn: 0 }); rangeEnd = endOfWeek(endOfMonth(day), { weekStartsOn: 0 }); }
  else { rangeStart = startOfDay(day); rangeEnd = endOfDay(day); }

  let providers: Provider[] = [];
  let services: Service[] = [];
  let appts: Appt[] = [];
  let dataUnavailable = false;
  let copayMap = new Map<string, string>();
  let balanceMap = new Map<string, number>();

  try {
    const results = await Promise.allSettled([
      db.user.findMany({ where: { role: "provider", active: true }, orderBy: { lastName: "asc" } }),
      db.serviceType.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      db.appointment.findMany({
        where: { startsAt: { gte: rangeStart, lte: rangeEnd }, ...(providerId ? { providerId } : {}) },
        orderBy: { startsAt: "asc" },
        take: 1000,
      }),
    ]);
    providers = results[0].status === "fulfilled" ? (results[0].value as Provider[]) : [];
    services = results[1].status === "fulfilled" ? (results[1].value as Service[]) : [];
    const rows = results[2].status === "fulfilled" ? results[2].value : [];

    const pMap = await mapByIds("patient", rows.map((r) => r.patientId));
    const uMap = await mapByIds("user", rows.map((r) => r.providerId));
    const sMap = await mapByIds("serviceType", rows.map((r) => r.serviceTypeId).filter(Boolean) as string[]);
    appts = rows.map((r) => {
      const p: any = pMap.get(r.patientId); const u: any = uMap.get(r.providerId);
      const s: any = r.serviceTypeId ? sMap.get(r.serviceTypeId) : null;
      return {
        id: r.id, patientId: r.patientId, providerId: r.providerId,
        startsAt: r.startsAt, endsAt: r.endsAt, status: r.status, reason: r.reason, notes: r.notes,
        pFirst: p?.firstName || "", pLast: p?.lastName || "", provLast: u?.lastName || "",
        svcName: s?.name || null, svcCat: s?.category || null,
      } as Appt;
    }).filter((a) => a.pLast || a.pFirst);

    if (view === "day" || view === "staff") {
      const todays = appts.filter((a) => isSameDay(a.startsAt, day));
      copayMap = await getCopayMap(todays.map((a) => a.patientId));
      balanceMap = await getBalanceMap(todays.map((a) => a.patientId));
    }
    dataUnavailable = results.some((r) => r.status === "rejected");
  } catch {
    dataUnavailable = true;
  }

  // Navigation deltas depend on the view
  const step = view === "week" ? { prev: addWeeks(day, -1), next: addWeeks(day, 1) }
    : view === "month" ? { prev: addMonths(day, -1), next: addMonths(day, 1) }
    : { prev: addDays(day, -1), next: addDays(day, 1) };
  const qp = (d: Date, v: View = view) => `/schedule?view=${v}&d=${format(d, "yyyy-MM-dd")}${providerId ? `&providerId=${providerId}` : ""}`;
  const title = view === "week" ? `Week of ${format(rangeStart, "MMM d")} – ${format(rangeEnd, "MMM d, yyyy")}`
    : view === "month" ? format(day, "MMMM yyyy")
    : format(day, "EEEE, MMM d, yyyy");

  const providersShown = providerId ? providers.filter((p) => p.id === providerId) : providers;

  // Per-provider color index for calendar tints + legend.
  const providerColors: Record<string, number> = {};
  providers.forEach((p, i) => { providerColors[p.id] = i % PROVIDER_PALETTE.length; });
  const monthAppts: MAppt[] = appts.map((a) => ({
    id: a.id, patientId: a.patientId, providerId: a.providerId,
    startsAt: new Date(a.startsAt).toISOString(), endsAt: new Date(a.endsAt).toISOString(),
    status: a.status, pFirst: a.pFirst, pLast: a.pLast, provLast: a.provLast, svcName: a.svcName,
  }));
  const STATUS_LEGEND: { k: string; c: string }[] = [
    { k: "scheduled", c: "bg-slate-400" }, { k: "checked-in", c: "bg-amber-500" }, { k: "in-room", c: "bg-violet-500" },
    { k: "completed", c: "bg-emerald-500" }, { k: "no-show", c: "bg-rose-500" }, { k: "cancelled", c: "bg-slate-300" },
  ];

  // Coverage (Stedi eligibility) status per patient for month-view chips.
  const coverageByPatient: Record<string, "ok" | "stale" | "lapsed" | "none"> = {};
  if (view === "month") {
    const covMap = await getLatestCoverageMap(appts.map((a) => a.patientId));
    for (const a of appts) {
      if (coverageByPatient[a.patientId]) continue;
      coverageByPatient[a.patientId] = classifyCoverage(covMap.get(a.patientId)).kind;
    }
  }
  const COVERAGE_LEGEND: { k: string; c: string; label: string }[] = [
    { k: "ok", c: "bg-emerald-500", label: "Active" }, { k: "stale", c: "bg-amber-500", label: "Stale" },
    { k: "lapsed", c: "bg-rose-500", label: "Not confirmed" }, { k: "none", c: "bg-slate-300", label: "No check" },
  ];

  return (
    <Shell user={user} jellyBeans={<JellyBeans />} pageTitle={`Schedule — ${title}`}>
      {dataUnavailable && (
        <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Schedule data is temporarily unavailable. Calendar actions are limited.</div>
      )}
      <div className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="inline-flex rounded-lg ring-1 ring-slate-200 overflow-hidden">
            {(["day", "week", "month", "staff"] as View[]).map((v) => (
              <Link key={v} href={qp(day, v)} className={`px-3 py-1.5 text-sm font-medium capitalize ${view === v ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{v}</Link>
            ))}
          </div>
          <Link href={qp(step.prev)} className="btn-secondary ml-2">←</Link>
          <Link href={qp(new Date())} className="btn-secondary">Today</Link>
          <Link href={qp(step.next)} className="btn-secondary">→</Link>
          <form className="ml-2 flex items-center gap-2">
            <input type="hidden" name="view" defaultValue={view} />
            <input type="hidden" name="d" defaultValue={format(day, "yyyy-MM-dd")} />
            <select name="providerId" defaultValue={providerId} className="input min-w-[180px]">
              <option value="">All providers</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.credential ? `, ${p.credential}` : ""}</option>)}
            </select>
            <button className="btn-secondary">Apply</button>
          </form>
          <div className="ml-auto flex items-center gap-3">
            <ClinicTZBadge showHours />
            <NewApptButton providers={providers} services={services} day={format(day, "yyyy-MM-dd")} />
          </div>
        </header>

        {view === "day" && <DayGrid day={day} appts={appts.filter((a) => isSameDay(a.startsAt, day))} copayMap={copayMap} balanceMap={balanceMap} />}
        {view === "staff" && <StaffGrid day={day} providers={providersShown} appts={appts.filter((a) => isSameDay(a.startsAt, day))} qp={qp} />}
        {view === "week" && <WeekView start={rangeStart} appts={appts} qp={qp} />}
        {view === "month" && (
          <>
            <MonthCalendar
              monthISO={day.toISOString()}
              startISO={rangeStart.toISOString()}
              endISO={rangeEnd.toISOString()}
              appts={monthAppts}
              providerColors={providerColors}
              providerQuery={providerId ? `&providerId=${providerId}` : ""}
              coverage={coverageByPatient}
            />
            {/* Legends */}
            <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-start gap-x-8 gap-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Status</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {STATUS_LEGEND.map((s) => (
                    <span key={s.k} className="inline-flex items-center gap-1 text-[11px] text-slate-600 capitalize"><span className={`h-2 w-2 rounded-full ${s.c}`} />{s.k}</span>
                  ))}
                </div>
              </div>
              {providersShown.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Providers</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {providersShown.map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                        <span className={`h-2.5 w-2.5 rounded-sm ${PROVIDER_PALETTE[(providerColors[p.id] ?? 0) % PROVIDER_PALETTE.length].legend}`} />
                        {p.firstName} {p.lastName}{p.credential ? `, ${p.credential}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-[11px] text-slate-400 ml-auto self-center">Tip: drag an appointment to another day to reschedule (time is preserved).</div>
            </div>
            <div className="px-4 pb-3 -mt-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Coverage (Stedi eligibility)</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {COVERAGE_LEGEND.map((s) => (
                  <span key={s.k} className="inline-flex items-center gap-1 text-[11px] text-slate-600"><span className={`h-2 w-2 rounded-sm ${s.c}`} />{s.label}</span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

/* ---------- Day view (rich: check-in / copay / balance) ---------- */
// Grid spans clinic hours: 9:00 AM – 8:00 PM Central (22 half-hour rows).
const GRID_START_HOUR = 9;
const GRID_SLOTS = 22; // 9:00 → 20:00
function buildSlots(day: Date) {
  const slots: Date[] = [];
  const s = new Date(day); s.setHours(GRID_START_HOUR, 0, 0, 0);
  for (let i = 0; i < GRID_SLOTS; i++) slots.push(addMinutes(s, i * 30));
  return slots;
}
function posFor(a: Appt) {
  const startMin = (new Date(a.startsAt).getHours() * 60 + new Date(a.startsAt).getMinutes()) - GRID_START_HOUR * 60;
  const dur = (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60000;
  return { top: (startMin / 30) * 64, height: Math.max(40, (dur / 30) * 64 - 4) };
}

function DayGrid({ day, appts, copayMap, balanceMap }: { day: Date; appts: Appt[]; copayMap: Map<string, string>; balanceMap: Map<string, number> }) {
  const slots = buildSlots(day);
  return (
    <div className="grid grid-cols-12 divide-x divide-slate-100">
      <div className="col-span-2">
        {slots.map((s) => <div key={s.toISOString()} className="h-16 px-3 py-1 text-xs font-mono text-slate-500 border-b border-slate-100">{format(s, "h:mm a")}</div>)}
      </div>
      <div className="col-span-10 relative">
        {slots.map((s) => <div key={s.toISOString()} className="h-16 border-b border-slate-100" />)}
        <div className="absolute inset-0 p-2">
          {appts.map((a) => {
            const { top, height } = posFor(a);
            return (
              <div key={a.id} className="absolute left-2 right-2" style={{ top, height }}>
                <Link href={`/patients/${a.patientId}`} className="block h-full rounded-md bg-white ring-1 ring-brand-200 shadow-sm hover:shadow-md hover:ring-brand-400 transition px-2 py-1 overflow-hidden">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">{fmtTime(a.startsAt)}</span><span>–</span><span>{fmtTime(a.endsAt)}</span>
                    {balanceMap.get(a.patientId) ? <span className="chip bg-rose-100 text-rose-800 ring-rose-200 font-semibold" title="Outstanding balance">Bal {fmtCents(balanceMap.get(a.patientId)!)}</span> : null}
                    <span className={`chip ml-auto ${colorForApptStatus(a.status)}`}>{a.status}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 truncate">{a.pLast}, {a.pFirst}</div>
                  <div className="text-xs text-slate-600 truncate flex items-center gap-1">
                    {a.svcName && <span className={`chip ${colorForCategory(a.svcCat || "")}`}>{a.svcName}</span>}
                    {a.reason && !a.svcName && <span>{a.reason}</span>}
                    <span className="ml-auto">{a.provLast}</span>
                  </div>
                </Link>
                <div className="absolute bottom-1 left-1 z-10"><CheckInButton appointmentId={a.id} status={a.status} /></div>
                <div className="absolute bottom-1 right-1 z-10"><CopayButton patientId={a.patientId} patientName={`${a.pLast}, ${a.pFirst}`} amountDefault={copayMap.get(a.patientId) || ""} /></div>
              </div>
            );
          })}
          {appts.length === 0 && <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">No appointments scheduled for this day.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Staff view (per-provider columns for the day) ---------- */
function StaffGrid({ day, providers, appts, qp }: { day: Date; providers: Provider[]; appts: Appt[]; qp: (d: Date, v?: View) => string }) {
  const slots = buildSlots(day);
  if (providers.length === 0) return <div className="p-8 text-center text-sm text-slate-400">No active providers to display.</div>;
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max">
        {/* time gutter */}
        <div className="w-20 shrink-0 border-r border-slate-100">
          <div className="h-10 border-b border-slate-100" />
          {slots.map((s) => <div key={s.toISOString()} className="h-16 px-2 py-1 text-[11px] font-mono text-slate-500 border-b border-slate-100">{format(s, "h:mm")}</div>)}
        </div>
        {providers.map((prov) => {
          const list = appts.filter((a) => a.providerId === prov.id);
          return (
            <div key={prov.id} className="w-56 shrink-0 border-r border-slate-100">
              <div className="h-10 px-2 grid place-items-center border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-700 truncate">{prov.firstName} {prov.lastName}{prov.credential ? `, ${prov.credential}` : ""}</div>
              <div className="relative">
                {slots.map((s) => <div key={s.toISOString()} className="h-16 border-b border-slate-100" />)}
                <div className="absolute inset-0 p-1">
                  {list.map((a) => {
                    const { top, height } = posFor(a);
                    return (
                      <Link key={a.id} href={`/patients/${a.patientId}`} className="absolute left-1 right-1 rounded-md bg-white ring-1 ring-brand-200 shadow-sm hover:ring-brand-400 px-2 py-1 overflow-hidden" style={{ top, height }}>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500"><span className="font-semibold text-slate-700">{fmtTime(a.startsAt)}</span><span className={`chip ml-auto ${colorForApptStatus(a.status)}`}>{a.status}</span></div>
                        <div className="text-xs font-semibold text-slate-900 truncate">{a.pLast}, {a.pFirst}</div>
                        {a.svcName && <div className="text-[10px] text-slate-500 truncate">{a.svcName}</div>}
                      </Link>
                    );
                  })}
                  {list.length === 0 && <div className="absolute inset-x-0 top-2 text-center text-[11px] text-slate-300">—</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Week view (7 day columns, chip lists) ---------- */
function WeekView({ start, appts, qp }: { start: Date; appts: Appt[]; qp: (d: Date, v?: View) => string }) {
  const days = eachDayOfInterval({ start, end: addDays(start, 6) });
  return (
    <div className="grid grid-cols-7 divide-x divide-slate-100">
      {days.map((d) => {
        const list = appts.filter((a) => isSameDay(a.startsAt, d)).sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());
        const today = isSameDay(d, new Date());
        return (
          <div key={d.toISOString()} className="min-h-[220px]">
            <Link href={qp(d, "day")} className={`block px-2 py-2 border-b text-center hover:bg-slate-50 ${today ? "bg-brand-50 border-brand-200" : "border-slate-100"}`}>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">{format(d, "EEE")}</div>
              <div className={`text-lg font-semibold ${today ? "text-brand-700" : "text-slate-800"}`}>{format(d, "d")}</div>
              <div className="text-[10px] text-slate-400">{list.length} appt{list.length === 1 ? "" : "s"}</div>
            </Link>
            <div className="p-1.5 space-y-1">
              {list.map((a) => (
                <Link key={a.id} href={`/patients/${a.patientId}`} className="block rounded-md ring-1 ring-slate-200 bg-white hover:ring-brand-400 px-2 py-1">
                  <div className="flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${DOT[a.status] || DOT.scheduled}`} />
                    <span className="text-[11px] font-semibold text-slate-700">{fmtTime(a.startsAt)}</span>
                  </div>
                  <div className="text-xs font-medium text-slate-900 truncate">{a.pLast}, {a.pFirst}</div>
                  <div className="text-[10px] text-slate-500 truncate">{a.svcName || a.reason || "Visit"} · {a.provLast}</div>
                </Link>
              ))}
              {list.length === 0 && <div className="text-center text-[11px] text-slate-300 py-4">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Month view now handled by the interactive client MonthCalendar ---------- */
