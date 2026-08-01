import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import { fmtDateTime } from "@/lib/utils";

export default async function EncList({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const user = await requireSession();
  const status = sp.status;
  let enc: Array<{
    id: string;
    patientId: string;
    startedAt: Date;
    chiefComplaint: string | null;
    status: string;
    patient: { firstName: string; lastName: string };
    provider: { firstName: string; lastName: string };
  }> = [];
  let dataUnavailable = false;

  try {
    enc = await db.encounter.findMany({
      where: status ? { status } : undefined,
      include: { patient: true, provider: true },
      orderBy: { startedAt: "desc" },
      take: 100,
    });
  } catch {
    dataUnavailable = true;
  }
  return (
    <Shell user={user} pageTitle="Encounters" jellyBeans={<JellyBeans />}>
      {dataUnavailable && (
        <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">
          Encounter data is temporarily unavailable. Try again in a moment.
        </div>
      )}
      <div className="card">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <Link href="/encounters" className={`chip ring-1 ring-inset ${!status ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>All</Link>
          <Link href="/encounters?status=open" className={`chip ring-1 ring-inset ${status === "open" ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>Open</Link>
          <Link href="/encounters?status=signed" className={`chip ring-1 ring-inset ${status === "signed" ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>Signed</Link>
        </header>
        <table className="data">
          <thead><tr><th>Date</th><th>Patient</th><th>Provider</th><th>CC</th><th>Status</th></tr></thead>
          <tbody>
            {enc.length === 0 && <tr><td colSpan={5} className="text-center text-slate-500 py-10">No encounters.</td></tr>}
            {enc.map(e => (
              <tr key={e.id}>
                <td className="text-xs">{fmtDateTime(e.startedAt)}</td>
                <td><Link href={`/patients/${e.patientId}`} className="text-brand-700 hover:underline">{e.patient.lastName}, {e.patient.firstName}</Link></td>
                <td>{e.provider.firstName} {e.provider.lastName}</td>
                <td><Link href={`/encounters/${e.id}`} className="hover:underline">{e.chiefComplaint || "—"}</Link></td>
                <td><span className={`chip ${e.status === "signed" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
