import Link from "next/link";
import {
  addDays, format, startOfDay, endOfDay, parseISO,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths,
  eachDayOfInterval, isSameDay,
} from "date-fns";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import NewApptButton from "./NewApptButton";
import MonthCalendar, { type MAppt } from "./MonthCalendar";
import DayCalendar from "./DayCalendar";
import WeekCalendar from "./WeekCalendar";
import StaffDayCalendar from "./StaffDayCalendar";
import { GRID_START_HOUR, SLOT_PX, type CalAppt } from "./reschedule";
import ClinicTZBadge from "@/components/ClinicTZBadge";
import { PROVIDER_PALETTE } from "./palette";
import { mapByIds } from "@/lib/safe-relations";
import { getCopayMap, getLatestCoverageMap, classifyCoverage } from "@/lib/coverage";
import { getBalanceMap } from "@/lib/balances";
import { clinicDayKey, clinicHHmm, clinicTimeLabel, clinicMinutesOfDay } from "@/lib/clinic";

type View = "day" | "week" | "month" | "staff";
type Provider = { id: string; firstName: string; lastName: string; credential: string | null };
type Service = { id: string; name: string; durationMin: number; category: string; homeEligible: boolean };
type Appt = {
  id: string; patientId: string; providerId: string;
  startsAt: Date; endsAt: Date; status: string; reason: string | null; notes: string | null;
  pFirst: string; pLast: string; provLast: string;
  svcName: string | null; svcCat: string | null;
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

  // Serializable, Central-time-computed appointments for the interactive
  // (drag-and-drop) day / week / staff calendars. Positions (top/height) are
  // computed here on the server (TZ pinned to America/Chicago) so drag works
  // consistently regardless of the browser's timezone.
  const calAppts: CalAppt[] = appts.map((a) => {
    const start = new Date(a.startsAt);
    const end = new Date(a.endsAt);
    const startMin = clinicMinutesOfDay(start) - GRID_START_HOUR * 60;
    const durMin = (end.getTime() - start.getTime()) / 60000;
    return {
      id: a.id, patientId: a.patientId, providerId: a.providerId, status: a.status,
      pFirst: a.pFirst, pLast: a.pLast, provLast: a.provLast,
      svcName: a.svcName, svcCat: a.svcCat, reason: a.reason,
      dayKey: clinicDayKey(start), timeHHmm: clinicHHmm(start),
      startLabel: clinicTimeLabel(start), endLabel: clinicTimeLabel(end),
      top: Math.max(0, (startMin / 30) * SLOT_PX),
      height: Math.max(40, (durMin / 30) * SLOT_PX - 4),
      slotIndex: Math.round(startMin / 30),
      durationMin: Math.max(15, Math.round(durMin)),
    };
  });
  const dayKeyStr = format(day, "yyyy-MM-dd");
  const dayCal = calAppts.filter((a) => a.dayKey === dayKeyStr);
  const weekDays = eachDayOfInterval({ start: rangeStart, end: addDays(rangeStart, 6) }).map((d) => ({
    key: format(d, "yyyy-MM-dd"), dow: format(d, "EEE"), dom: format(d, "d"), isToday: isSameDay(d, new Date()),
  }));
  const copayRec: Record<string, string> = Object.fromEntries(copayMap);
  const balanceRec: Record<string, number> = Object.fromEntries(balanceMap);

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
            <Link href="/schedule/waitlist" className="btn-secondary whitespace-nowrap">Waitlist</Link>
            <NewApptButton providers={providers} services={services} day={format(day, "yyyy-MM-dd")} providerId={providerId || undefined} />
          </div>
        </header>

        {view === "day" && <DayCalendar dayKey={dayKeyStr} appts={dayCal} copay={copayRec} balance={balanceRec} providerId={providerId || undefined} />}
        {view === "staff" && <StaffDayCalendar dayKey={dayKeyStr} providers={providersShown} appts={dayCal} />}
        {view === "week" && <WeekCalendar days={weekDays} appts={calAppts} providerColors={providerColors} providerQuery={providerId ? `&providerId=${providerId}` : ""} />}
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
