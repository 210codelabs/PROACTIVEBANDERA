import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function PtReportingPage() {
  const user = await requireSession();
  let legalPatients = 0, notesTotal = 0, notesSigned = 0, notesDraft = 0, intakes = 0, notesThisMonth = 0;
  let byInsurer: { name: string; count: number }[] = [];
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [lp, nt, ns, nd, it, nm, legalCases] = await Promise.all([
      db.patient.count({ where: { patientType: "legal" } }),
      db.ptNote.count(),
      db.ptNote.count({ where: { status: "signed" } }),
      db.ptNote.count({ where: { status: "draft" } }),
      db.piIntake.count(),
      db.ptNote.count({ where: { visitDate: { gte: monthStart } } }),
      db.legalCase.findMany({ take: 500, select: { defendantInsurer: true } }),
    ]);
    legalPatients = lp; notesTotal = nt; notesSigned = ns; notesDraft = nd; intakes = it; notesThisMonth = nm;
    const m = new Map<string, number>();
    for (const c of legalCases) {
      const key = c.defendantInsurer || "(unspecified)";
      m.set(key, (m.get(key) || 0) + 1);
    }
    byInsurer = [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  } catch { /* ignore */ }

  const stats = [
    { label: "PI patients", value: legalPatients, tone: "text-indigo-600" },
    { label: "Encounter notes", value: notesTotal, tone: "text-slate-800" },
    { label: "Signed", value: notesSigned, tone: "text-emerald-600" },
    { label: "Draft", value: notesDraft, tone: "text-amber-600" },
    { label: "Intakes", value: intakes, tone: "text-violet-600" },
    { label: "Notes this month", value: notesThisMonth, tone: "text-sky-600" },
  ];

  return (
    <Shell user={user}>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-slate-900">Physical Rehab — Reporting</h1>
        <p className="text-sm text-slate-500">Personal-injury / PIP volumes and claim readiness.</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          {stats.map((s) => (
            <div key={s.label} className="card p-4">
              <div className={`text-2xl font-extrabold tabular-nums ${s.tone}`}>{s.value}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <section className="card mt-5 overflow-hidden">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">PI cases by auto / casualty insurer</header>
          {byInsurer.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">No legal/PI cases on file.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {byInsurer.map((r) => (
                <li key={r.name} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-slate-700">{r.name}</span>
                  <span className="font-bold text-slate-800 tabular-nums">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}
