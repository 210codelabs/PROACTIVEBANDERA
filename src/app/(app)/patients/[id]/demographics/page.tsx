import { requireSession } from "@/lib/auth";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import PatientManage from "@/components/PatientManage";
import { fmtDate, fmtPhone, ageFromDob } from "@/lib/utils";
import { getStediConfig } from "@/lib/stedi";
import EligibilityChecker from "@/components/billing/EligibilityChecker";
import PatientLedger from "@/components/billing/PatientLedger";
import InsuranceCard from "@/components/billing/InsuranceCard";
import CoverageHistory from "@/components/billing/CoverageHistory";
import PatientPharmacyCard from "@/components/erx/PatientPharmacyCard";

export default async function DemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  const p = ctx.patient;
  const stedi = await getStediConfig();

  return (
    <PatientChart user={user} {...ctx} active="demographics">
      <PatientManage patient={JSON.parse(JSON.stringify(p))} role={user.role} />
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
        <InsuranceCard
          patient={{ id: p.id, insurerName: p.insurerName, insurerPlan: p.insurerPlan, memberId: p.memberId, groupNumber: p.groupNumber, payerId: (p as any).payerId }}
          role={user.role}
        />
        <PatientPharmacyCard
          patientId={p.id}
          primary={(p as any).primaryPharmacyNcpdp || null}
          alternative={(p as any).alternativePharmacyNcpdp || null}
          checkinFlag={Boolean((p as any).pharmacyCheckinFlag)}
          canEdit={["admin", "provider", "nurse", "frontdesk"].includes(user.role)}
        />
      </div>
      {stedi.enabled && stedi.apiKey && (
        <section className="card mt-4">
          <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Insurance Eligibility (Stedi)</header>
          <div className="p-4">
            <EligibilityChecker
              defaultPayerId={stedi.defaultPayerId}
              patient={{ id: p.id, firstName: p.firstName, lastName: p.lastName, dob: typeof p.dob === "string" ? p.dob : new Date(p.dob).toISOString(), memberId: p.memberId, insurerName: p.insurerName }}
            />
          </div>
        </section>
      )}
      <section className="card mt-4">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Coverage history</header>
        <div className="p-4">
          <CoverageHistory patientId={p.id} />
        </div>
      </section>
      <section className="card mt-4">
        <header className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Account / Statement</header>
        <div className="p-4">
          <PatientLedger patientId={p.id} />
        </div>
      </section>
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
