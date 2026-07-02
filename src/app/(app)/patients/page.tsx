import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import { ageFromDob, fmtPhone } from "@/lib/utils";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const user = await requireSession();
  const q = (sp.q || "").trim();

  let patients: Array<{
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    sex: string;
    dob: Date;
    phone: string | null;
    insurerName: string | null;
    status: string;
  }> = [];
  let dataUnavailable = false;

  try {
    patients = await db.patient.findMany({
      where: q ? {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { mrn: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
        ],
      } : undefined,
      orderBy: { lastName: "asc" },
      take: 100,
    });
  } catch {
    dataUnavailable = true;
  }

  return (
    <Shell user={user} pageTitle="Patients" jellyBeans={<JellyBeans />}>
      {dataUnavailable && (
        <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">
          Patient records are temporarily unavailable. Try again shortly.
        </div>
      )}
      <div className="card">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
          <form className="flex-1">
            <input
              name="q"
              defaultValue={q}
              placeholder="Filter by name, MRN, phone, email…"
              className="input max-w-md"
            />
          </form>
          <Link href="/patients/new" className="btn-primary">+ New Patient</Link>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>MRN</th>
              <th>Sex</th>
              <th>Age / DOB</th>
              <th>Phone</th>
              <th>Insurance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 && (
              <tr><td colSpan={7} className="text-center text-slate-500 py-10">No patients found.</td></tr>
            )}
            {patients.map(p => (
              <tr key={p.id}>
                <td>
                  <Link href={`/patients/${p.id}`} className="font-medium text-brand-700 hover:underline">
                    {p.lastName}, {p.firstName}
                  </Link>
                </td>
                <td className="font-mono text-xs">{p.mrn}</td>
                <td>{p.sex}</td>
                <td>{ageFromDob(p.dob)} · <span className="text-slate-500 text-xs">{new Date(p.dob).toLocaleDateString()}</span></td>
                <td>{fmtPhone(p.phone)}</td>
                <td className="truncate max-w-[200px]">{p.insurerName || "—"}</td>
                <td>
                  <span className={`chip ${p.status === "active" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
