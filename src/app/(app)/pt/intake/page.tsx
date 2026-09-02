import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function PiIntakeListPage() {
  const user = await requireSession();
  let intakes: any[] = [];
  let pMap = new Map<string, any>();
  try {
    intakes = await db.piIntake.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    const pids = [...new Set(intakes.map((i) => i.patientId))];
    const patients = pids.length ? await db.patient.findMany({ where: { id: { in: pids } } }) : [];
    pMap = new Map(patients.map((p) => [p.id, p]));
  } catch { /* ignore */ }

  return (
    <Shell user={user}>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900">PI Accident Intakes</h1>
            <p className="text-sm text-slate-500">Legally-formatted personal-injury intakes. Create new intakes from <Link href="/pt/encounters" prefetch={false} className="text-brand-700 hover:underline">PT Encounters</Link>.</p>
          </div>
        </div>
        <section className="card mt-4 overflow-hidden">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-800">Intakes ({intakes.length})</header>
          {intakes.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">No PI intakes yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-2">Patient</th>
                    <th className="text-left px-4 py-2">Accident</th>
                    <th className="text-left px-4 py-2">Date</th>
                    <th className="text-left px-4 py-2">Areas</th>
                    <th className="text-left px-4 py-2">Pain</th>
                    <th className="text-left px-4 py-2">Auto insurer</th>
                    <th className="text-left px-4 py-2">Claim #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {intakes.map((i) => {
                    const p: any = pMap.get(i.patientId);
                    return (
                      <tr key={i.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-800">{p ? `${p.lastName}, ${p.firstName}` : "Unknown"}</td>
                        <td className="px-4 py-2 text-slate-600">{i.accidentType || "—"}</td>
                        <td className="px-4 py-2 text-slate-600">{i.accidentDate ? String(i.accidentDate).slice(0, 10) : "—"}</td>
                        <td className="px-4 py-2 text-slate-600">{(i.bodyParts || []).join(", ") || "—"}</td>
                        <td className="px-4 py-2 text-slate-600">{i.painLevel != null ? `${i.painLevel}/10` : "—"}</td>
                        <td className="px-4 py-2 text-slate-600">{i.autoInsurer || "—"}</td>
                        <td className="px-4 py-2 text-slate-600">{i.claimNumber || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
