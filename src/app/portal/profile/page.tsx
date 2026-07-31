import PortalShell from "@/components/portal/PortalShell";
import { db } from "@/lib/db";
import { requirePortalSession } from "@/lib/portalAuth";

export default async function PortalProfilePage() {
  const session = await requirePortalSession();
  let patient: Awaited<ReturnType<typeof db.patient.findUnique>> = null;
  let dataUnavailable = false;
  try {
    patient = await db.patient.findUnique({ where: { id: session.patientId } });
  } catch {
    dataUnavailable = true;
  }
  if (!patient && !dataUnavailable) return null;
  if (!patient && dataUnavailable) {
    patient = {
      id: session.patientId,
      mrn: session.mrn,
      firstName: session.firstName,
      lastName: session.lastName,
      dob: new Date(),
      sex: "-",
      email: session.email,
      phone: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      postalCode: null,
      country: null,
      preferredLang: null,
      insurerName: null,
      insurerPlan: null,
      memberId: null,
      ecName: null,
      ecPhone: null,
    } as any;
  }
  const profilePatient = patient as any;

  return (
    <PortalShell session={session} active="/portal/profile">
      {dataUnavailable && <div className="card card-pad mb-3 border-amber-200 bg-amber-50 text-amber-900">Profile data is temporarily unavailable.</div>}
      <section className="card card-pad">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Profile and Demographics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label="Full name" value={`${profilePatient.firstName} ${profilePatient.lastName}`} />
          <Field label="DOB" value={new Date(profilePatient.dob).toLocaleDateString()} />
          <Field label="MRN" value={profilePatient.mrn} />
          <Field label="Sex" value={profilePatient.sex} />
          <Field label="Email" value={profilePatient.email || "-"} />
          <Field label="Phone" value={profilePatient.phone || "-"} />
          <Field label="Address" value={[profilePatient.addressLine1, profilePatient.addressLine2, profilePatient.city, profilePatient.state, profilePatient.postalCode].filter(Boolean).join(", ") || "-"} />
          <Field label="Language" value={profilePatient.preferredLang || "-"} />
          <Field label="Insurance" value={[profilePatient.insurerName, profilePatient.insurerPlan].filter(Boolean).join(" / ") || "-"} />
          <Field label="Member ID" value={profilePatient.memberId || "-"} />
          <Field label="Emergency Contact" value={profilePatient.ecName || "-"} />
          <Field label="Emergency Phone" value={profilePatient.ecPhone || "-"} />
        </div>
      </section>
    </PortalShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 ring-1 ring-slate-200 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-slate-900 font-medium mt-1">{value}</div>
    </div>
  );
}
