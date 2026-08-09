import Link from "next/link";
import { addDays, format, startOfDay, endOfDay, parseISO } from "date-fns";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import { fmtTime } from "@/lib/utils";
import { mapByIds } from "@/lib/safe-relations";
import { getLatestCoverageMap, classifyCoverage } from "@/lib/coverage";
import ReverifyButton from "@/components/billing/ReverifyButton";

const KIND_STYLE: Record<string, string> = {
  none: "bg-slate-200 text-slate-700 ring-slate-300",
  stale: "bg-amber-100 text-amber-800 ring-amber-200",
  lapsed: "bg-rose-100 text-rose-800 ring-rose-200",
  ok: "bg-emerald-100 text-emerald-800 ring-emerald-200",
};

export default async function EligibilityReportPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const sp = await searchParams;
  const user = await requireSession();
  const day = sp.d ? parseISO(sp.d) : new Date();

  let rows: Array<{
    id: string;
    patientId: string;
    patientName: string;
    time: Date;
    reason: string;
    kind: "ok" | "stale" | "lapsed" | "none";
    label: string;
    payerName: string | null;
    payerId: string | null;
    memberId: string | null;
    lastChecked: Date | null;
  }> = [];
  let counts = { total: 0, ok: 0, stale: 0, lapsed: 0, none: 0 };
  let dataUnavailable = false;

  try {
    const appts = await db.appointment.findMany({
      where: { startsAt: { gte: startOfDay(day), lte: endOfDay(day) } },
      orderBy: { startsAt: "asc" },
    });
    const pMap = await mapByIds("patient", appts.map((a) => a.patientId));
    const covMap = await getLatestCoverageMap(appts.map((a) => a.patientId));

    for (const a of appts) {
      const p: any = pMap.get(a.patientId);
      if (!p) continue;
      const check = covMap.get(a.patientId);
      const { kind, label } = classifyCoverage(check);
      counts.total++;
      counts[kind]++;
      rows.push({
        id: a.id,
        patientId: a.patientId,
        patientName: `${p.lastName}, ${p.firstName}`,
        time: a.startsAt,
        reason: a.reason || "Office visit",
        kind,
        label,
        payerName: check?.payerName || p.insurerName || null,
        payerId: check?.payerId || null,
        memberId: check?.memberId || p.memberId || null,
        lastChecked: check?.createdAt || null,
      });
    }
    // Worklist first: everything that needs attention, then OK.
    rows.sort((x, y) => {
      const order = { lapsed: 0, none: 1, stale: 2, ok: 3 } as const;
      if (order[x.kind] !== order[y.kind]) return order[x.kind] - order[y.kind];
      return x.time.getTime() - y.time.getTime();
    });
  } catch {
    dataUnavailable = true;
  }

  const worklist = rows.filter((r) => r.kind !== "ok");
  const prev = format(addDays(day, -1), "yyyy-MM-dd");
  const next = format(addDays(day, 1), "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <Shell user={user} jellyBeans={<JellyBeans />} pageTitle={`Eligibility worklist — ${format(day, "EEE, MMM d, yyyy")}`}>
      {dataUnavailable && (
        <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Report data is temporarily unavailable.</div>
      )}

      <div className="card mb-4">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 flex-wrap">
          <Link href={`/billing/eligibility-report?d=${prev}`} className="btn-secondary">← Prev</Link>
          <Link href={`/billing/eligibility-report?d=${todayStr}`} className="btn-secondary">Today</Link>
          <Link href={`/billing/eligibility-report?d=${next}`} className="btn-secondary">Next →</Link>
          <Link href="/billing" className="btn-secondary ml-auto">← Billing</Link>
        </header>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <Stat label="Appointments" value={counts.total} tone="slate" />
          <Stat label="Needs attention" value={counts.lapsed + counts.none + counts.stale} tone="amber" />
          <Stat label="Lapsed" value={counts.lapsed} tone="rose" />
          <Stat label="Unverified" value={counts.none} tone="slate" />
          <Stat label="Active" value={counts.ok} tone="emerald" />
        </div>
      </div>

      <div className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Coverage to work ({worklist.length})</h2>
          <span className="text-xs text-slate-500">Lapsed & unverified first</span>
        </header>
        <div className="p-4">
          {worklist.length === 0 ? (
            <div className="text-sm text-slate-500 italic">All appointments for this day have active, current coverage. 🎉</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr><th>Time</th><th>Patient</th><th>Reason</th><th>Payer</th><th>Member</th><th>Status</th><th>Last checked</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {worklist.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-slate-600">{fmtTime(r.time)}</td>
                      <td className="font-medium text-slate-900"><Link href={`/patients/${r.patientId}`} className="hover:underline">{r.patientName}</Link></td>
                      <td className="text-slate-600">{r.reason}</td>
                      <td className="text-slate-600">{r.payerName || "—"}</td>
                      <td className="font-mono text-xs text-slate-500">{r.memberId || "—"}</td>
                      <td><span className={`chip ring-1 ${KIND_STYLE[r.kind]}`}>{r.label}</span></td>
                      <td className="text-xs text-slate-500">{r.lastChecked ? new Date(r.lastChecked).toLocaleDateString() : "—"}</td>
                      <td><ReverifyButton patientId={r.patientId} payerId={r.payerId} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "slate" | "amber" | "rose" | "emerald" }) {
  const styles = {
    slate: "bg-slate-50 ring-slate-200 text-slate-900",
    amber: "bg-amber-50 ring-amber-200 text-amber-900",
    rose: "bg-rose-50 ring-rose-200 text-rose-900",
    emerald: "bg-emerald-50 ring-emerald-200 text-emerald-900",
  }[tone];
  return (
    <div className={`rounded-lg ring-1 py-3 ${styles}`}>
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="text-[11px] uppercase tracking-wide font-semibold opacity-70">{label}</div>
    </div>
  );
}
