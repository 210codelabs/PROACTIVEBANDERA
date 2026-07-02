import Link from "next/link";
import { addDays, format, startOfDay, endOfDay, parseISO, addMinutes } from "date-fns";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import { fmtTime, colorForApptStatus, colorForCategory } from "@/lib/utils";
import NewApptButton from "./NewApptButton";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ d?: string; providerId?: string }> }) {
  const sp = await searchParams;
  const user = await requireSession();
  const day = sp.d ? parseISO(sp.d) : new Date();
  const providerId = sp.providerId || "";

  let providers: Array<{ id: string; firstName: string; lastName: string; credential: string | null }> = [];
  let services: Array<{ id: string; name: string; durationMin: number; category: string; homeEligible: boolean }> = [];
  let appts: Array<{
    id: string;
    patientId: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    notes: string | null;
    reason: string | null;
    patient: { firstName: string; lastName: string };
    provider: { lastName: string };
    serviceType: { name: string; category: string } | null;
  }> = [];
  let dataUnavailable = false;

  try {
    const results = await Promise.allSettled([
      db.user.findMany({ where: { role: "provider", active: true }, orderBy: { lastName: "asc" } }),
      db.serviceType.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      db.appointment.findMany({
        where: {
          startsAt: { gte: startOfDay(day), lte: endOfDay(day) },
          ...(providerId ? { providerId } : {}),
        },
        include: { patient: true, provider: true, serviceType: true },
        orderBy: { startsAt: "asc" },
      }),
    ]);

    providers = results[0].status === "fulfilled" ? results[0].value : [];
    services = results[1].status === "fulfilled" ? results[1].value : [];
    appts = results[2].status === "fulfilled" ? results[2].value : [];
    dataUnavailable = results.some((r) => r.status === "rejected");
  } catch {
    dataUnavailable = true;
  }

  const prev = format(addDays(day, -1), "yyyy-MM-dd");
  const next = format(addDays(day, 1), "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // 30-minute slots from 7am to 7pm
  const slots: Date[] = [];
  const dayStart = new Date(day);
  dayStart.setHours(7, 0, 0, 0);
  for (let i = 0; i < 24; i++) slots.push(addMinutes(dayStart, i * 30));

  return (
    <Shell user={user} jellyBeans={<JellyBeans />} pageTitle={`Schedule — ${format(day, "EEEE, MMM d, yyyy")}`}>
      {dataUnavailable && (
        <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">
          Schedule data is temporarily unavailable. Calendar actions are limited.
        </div>
      )}
      <div className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 flex-wrap">
          <Link href={`/schedule?d=${prev}${providerId ? `&providerId=${providerId}` : ""}`} className="btn-secondary">← Prev</Link>
          <Link href={`/schedule?d=${todayStr}${providerId ? `&providerId=${providerId}` : ""}`} className="btn-secondary">Today</Link>
          <Link href={`/schedule?d=${next}${providerId ? `&providerId=${providerId}` : ""}`} className="btn-secondary">Next →</Link>
          <form className="ml-2 flex items-center gap-2">
            <input type="hidden" name="d" defaultValue={format(day, "yyyy-MM-dd")} />
            <select name="providerId" defaultValue={providerId} className="input min-w-[200px]">
              <option value="">All providers</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}{p.credential ? `, ${p.credential}` : ""}</option>)}
            </select>
            <button className="btn-secondary">Apply</button>
          </form>
          <div className="ml-auto">
            <NewApptButton providers={providers} services={services} day={format(day, "yyyy-MM-dd")} />
          </div>
        </header>

        <div className="grid grid-cols-12 divide-x divide-slate-100">
          <div className="col-span-2">
            {slots.map(s => (
              <div key={s.toISOString()} className="h-16 px-3 py-1 text-xs font-mono text-slate-500 border-b border-slate-100">{format(s, "h:mm a")}</div>
            ))}
          </div>
          <div className="col-span-10 relative">
            {slots.map(s => (
              <div key={s.toISOString()} className="h-16 border-b border-slate-100"></div>
            ))}
            <div className="absolute inset-0 p-2 grid gap-1">
              {appts.map(a => {
                const startMin = (new Date(a.startsAt).getHours() * 60 + new Date(a.startsAt).getMinutes()) - 7 * 60;
                const dur = (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60000;
                const top = (startMin / 30) * 64;
                const height = Math.max(40, (dur / 30) * 64 - 4);
                return (
                  <Link key={a.id} href={`/patients/${a.patientId}`}
                    className="absolute left-2 right-2 rounded-md bg-white ring-1 ring-brand-200 shadow-sm hover:shadow-md hover:ring-brand-400 transition px-2 py-1 overflow-hidden"
                    style={{ top, height }}
                  >
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">{fmtTime(a.startsAt)}</span>
                      <span>–</span>
                      <span>{fmtTime(a.endsAt)}</span>
                      <span className={`chip ml-auto ${colorForApptStatus(a.status)}`}>{a.status}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 truncate">{a.patient.lastName}, {a.patient.firstName}</div>
                    <div className="text-xs text-slate-600 truncate flex items-center gap-1">
                      {a.serviceType && <span className={`chip ${colorForCategory(a.serviceType.category)}`}>{a.serviceType.name}</span>}
                      {a.reason && !a.serviceType && <span>{a.reason}</span>}
                      <span className="ml-auto">{a.provider.lastName}</span>
                    </div>
                    {a.notes && (
                      <div className="text-[11px] text-slate-500 truncate" title={a.notes}>
                        {a.notes}
                      </div>
                    )}
                  </Link>
                );
              })}
              {appts.length === 0 && (
                <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">No appointments scheduled for this day.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
