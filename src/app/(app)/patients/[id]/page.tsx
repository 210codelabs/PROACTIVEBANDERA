import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import PatientHeader, { PatientTabs } from "@/components/PatientHeader";
import { fmtDateTime, fmtTime, colorForApptStatus } from "@/lib/utils";

export default async function PatientSummary({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  let patient: any = {
    id,
    firstName: "Patient",
    lastName: "Unavailable",
    sex: "-",
    dob: new Date(),
    mrn: "N/A",
    phone: null,
    email: null,
    pronouns: null,
    preferredLang: null,
    insurerName: null,
  };
  let allergies: any[] = [];
  let problems: any[] = [];
  let medications: any[] = [];
  let vitalsLatest: any = null;
  let encounters: any[] = [];
  let upcoming: any[] = [];
  let orders: any[] = [];
  let dataUnavailable = false;

  try {
    patient = await db.patient.findUnique({ where: { id } });
    if (!patient) notFound();

    const results = await Promise.allSettled([
      db.allergy.findMany({ where: { patientId: id, status: "active" }, orderBy: { createdAt: "desc" } }),
      db.problem.findMany({ where: { patientId: id, status: { in: ["active", "chronic"] } }, orderBy: { createdAt: "desc" } }),
      db.medication.findMany({ where: { patientId: id, status: "active" }, orderBy: { createdAt: "desc" }, take: 8 }),
      db.vital.findFirst({ where: { patientId: id }, orderBy: { takenAt: "desc" } }),
      db.encounter.findMany({ where: { patientId: id }, include: { provider: true }, orderBy: { startedAt: "desc" }, take: 5 }),
      db.appointment.findMany({ where: { patientId: id, startsAt: { gte: new Date() } }, include: { provider: true, serviceType: true }, orderBy: { startsAt: "asc" }, take: 5 }),
      db.order.findMany({ where: { patientId: id }, orderBy: { createdAt: "desc" }, take: 8 }),
    ]);

    allergies = results[0].status === "fulfilled" ? results[0].value : [];
    problems = results[1].status === "fulfilled" ? results[1].value : [];
    medications = results[2].status === "fulfilled" ? results[2].value : [];
    vitalsLatest = results[3].status === "fulfilled" ? results[3].value : null;
    encounters = results[4].status === "fulfilled" ? results[4].value : [];
    upcoming = results[5].status === "fulfilled" ? results[5].value : [];
    orders = results[6].status === "fulfilled" ? results[6].value : [];
    dataUnavailable = results.some((r) => r.status === "rejected");
  } catch {
    dataUnavailable = true;
  }

  return (
    <Shell user={user} jellyBeans={<JellyBeans patientId={id} />} patientHeader={
      <>
        <PatientHeader patient={patient} allergies={allergies} problems={problems} />
        <PatientTabs patientId={id} active="summary" />
      </>
    }>
      {dataUnavailable && (
        <section className="card card-pad mb-4 border-amber-200 bg-amber-50 text-amber-900">
          Patient chart data is temporarily unavailable.
        </section>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Active Problems" href={`/patients/${id}/problems`} cta="Manage">
          {problems.length === 0 ? <Empty>No active problems</Empty> : (
            <ul className="space-y-1.5 text-sm">
              {problems.slice(0, 8).map(p => (
                <li key={p.id} className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-slate-500 w-14 shrink-0">{p.icd10 || ""}</span>
                  <span className="text-slate-800">{p.description}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Allergies" href={`/patients/${id}/allergies`} cta="Manage">
          {allergies.length === 0 ? <Empty>NKDA</Empty> : (
            <ul className="space-y-1.5 text-sm">
              {allergies.map(a => (
                <li key={a.id}>
                  <span className="font-medium text-slate-900">{a.substance}</span>
                  {a.reaction && <span className="text-slate-600"> — {a.reaction}</span>}
                  {a.severity && <span className={`chip ml-2 ${a.severity === "severe" || a.severity === "life-threatening" ? "bg-rose-100 text-rose-800 ring-rose-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>{a.severity}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Medications" href={`/patients/${id}/medications`} cta="Manage">
          {medications.length === 0 ? <Empty>No active medications</Empty> : (
            <ul className="space-y-1.5 text-sm">
              {medications.map(m => (
                <li key={m.id}>
                  <span className="font-medium text-slate-900">{m.name}</span>
                  {m.strength && <span className="text-slate-600"> {m.strength}</span>}
                  {m.sig && <span className="text-slate-500"> — {m.sig}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Latest Vitals" href={`/patients/${id}/vitals`} cta="History">
          {!vitalsLatest ? <Empty>No vitals on file</Empty> : (
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="BP" value={vitalsLatest.systolic && vitalsLatest.diastolic ? `${vitalsLatest.systolic}/${vitalsLatest.diastolic}` : "—"} />
              <Stat label="HR" value={vitalsLatest.pulse ?? "—"} unit="bpm" />
              <Stat label="Temp" value={vitalsLatest.temperatureC ? vitalsLatest.temperatureC.toFixed(1) : "—"} unit="°C" />
              <Stat label="SpO₂" value={vitalsLatest.spo2 ?? "—"} unit="%" />
              <Stat label="Wt" value={vitalsLatest.weightKg ? vitalsLatest.weightKg.toFixed(1) : "—"} unit="kg" />
              <Stat label="BMI" value={vitalsLatest.bmi ? vitalsLatest.bmi.toFixed(1) : "—"} />
            </div>
          )}
        </Card>

        <Card title="Upcoming Appointments" href={`/schedule?patientId=${id}`} cta="Schedule" className="lg:col-span-2">
          {upcoming.length === 0 ? <Empty>No upcoming appointments</Empty> : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map(a => (
                <li key={a.id} className="py-2 flex items-center gap-3 text-sm">
                  <div className="w-32 text-xs text-slate-500">{new Date(a.startsAt).toLocaleDateString()} · {fmtTime(a.startsAt)}</div>
                  <div className="flex-1">{a.reason || a.serviceType?.name || "Office visit"}</div>
                  <div className="text-xs text-slate-500">{a.provider.firstName} {a.provider.lastName}</div>
                  <span className={`chip ${colorForApptStatus(a.status)}`}>{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent Encounters" href={`/patients/${id}/encounters`} cta="All">
          {encounters.length === 0 ? <Empty>No encounters</Empty> : (
            <ul className="divide-y divide-slate-100">
              {encounters.map(e => (
                <li key={e.id} className="py-2">
                  <Link href={`/encounters/${e.id}`} className="block text-sm hover:underline">
                    <div className="font-medium text-slate-900">{e.chiefComplaint || "Office visit"}</div>
                    <div className="text-xs text-slate-500">{fmtDateTime(e.startedAt)} · {e.provider.firstName} {e.provider.lastName} · {e.status}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent Orders" href={`/patients/${id}/orders`} cta="All" className="lg:col-span-3">
          {orders.length === 0 ? <Empty>No orders</Empty> : (
            <table className="data">
              <thead><tr><th>Type</th><th>Item</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td className="uppercase text-xs font-semibold text-slate-600">{o.type}</td>
                    <td>{o.itemName}{o.rxStrength ? ` ${o.rxStrength}` : ""}</td>
                    <td><span className="chip bg-slate-100 text-slate-700 ring-slate-200">{o.status}</span></td>
                    <td className="text-xs text-slate-500">{fmtDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </Shell>
  );
}

function Card({ title, href, cta, children, className = "" }: { title: string; href?: string; cta?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {href && <Link href={href} className="text-xs font-semibold text-brand-700 hover:underline">{cta || "Open"} →</Link>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, unit }: { label: string; value: any; unit?: string }) {
  return (
    <div className="rounded-md bg-slate-50 ring-1 ring-slate-200 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-lg font-bold text-slate-900 leading-tight">{String(value)}{unit && <span className="text-xs font-normal text-slate-500"> {unit}</span>}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-500 italic">{children}</div>;
}
