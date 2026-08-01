import { requireSession } from "@/lib/auth";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import { fmtDate, fmtPhone, ageFromDob } from "@/lib/utils";

export default async function DemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  const p = ctx.patient;

  return (
    <PatientChart user={user} {...ctx} active="demographics">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Identity">
          <Row k="Name">{p.firstName} {p.lastName}</Row>
          <Row k="Pronouns">{p.pronouns || "—"}</Row>
          <Row k="Sex">{p.sex}</Row>
          <Row k="DOB">{fmtDate(p.dob)} ({ageFromDob(p.dob)} years)</Row>
          <Row k="MRN">{p.mrn}</Row>
          <Row k="Race">{p.race || "—"}</Row>
          <Row k="Ethnicity">{p.ethnicity || "—"}</Row>
          <Row k="Marital">{p.maritalStatus || "—"}</Row>
          <Row k="Language">{p.preferredLang || "English"}</Row>
        </Card>
        <Card title="Contact">
          <Row k="Phone">{fmtPhone(p.phone)}</Row>
          <Row k="Email">{p.email || "—"}</Row>
          <Row k="Address">
            {p.addressLine1 ? <>
              {p.addressLine1}{p.addressLine2 ? <>, {p.addressLine2}</> : null}<br />
              {p.city}{p.state ? `, ${p.state}` : ""} {p.postalCode}<br />
              {p.country}
            </> : "—"}
          </Row>
          <Row k="Emergency">{p.ecName ? `${p.ecName} (${p.ecRelation || "—"}) · ${fmtPhone(p.ecPhone)}` : "—"}</Row>
        </Card>
        <Card title="Insurance">
          <Row k="Insurer">{p.insurerName || "—"}</Row>
          <Row k="Plan">{p.insurerPlan || "—"}</Row>
          <Row k="Member ID">{p.memberId || "—"}</Row>
          <Row k="Group #">{p.groupNumber || "—"}</Row>
        </Card>
      </div>
    </PatientChart>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">{title}</header>
      <div className="p-4 space-y-2">{children}</div>
    </section>
  );
}
function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <div className="text-slate-500">{k}</div>
      <div className="col-span-2 text-slate-900">{children}</div>
    </div>
  );
}
