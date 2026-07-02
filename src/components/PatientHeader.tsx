import Link from "next/link";
import { Patient } from "@prisma/client";
import { ageFromDob, fmtPhone, initials } from "@/lib/utils";

export default function PatientHeader({
  patient,
  allergies = [],
  problems = [],
  rightSlot,
}: {
  patient: Patient;
  allergies?: { substance: string; severity: string | null }[];
  problems?: { description: string }[];
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-r from-brand-50 via-white to-emerald-50 border-b border-slate-200 px-6 py-4">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-xl bg-brand-600 grid place-items-center text-white font-bold text-lg">
          {initials(patient.firstName, patient.lastName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900">{patient.lastName}, {patient.firstName}</h1>
            <span className="chip bg-slate-100 text-slate-700 ring-slate-200">{patient.sex} · {ageFromDob(patient.dob)} y</span>
            <span className="chip bg-slate-100 text-slate-700 ring-slate-200 font-mono">MRN {patient.mrn}</span>
            {patient.pronouns && <span className="chip bg-slate-100 text-slate-700 ring-slate-200">{patient.pronouns}</span>}
            {patient.preferredLang && patient.preferredLang !== "English" && (
              <span className="chip bg-amber-100 text-amber-800 ring-amber-200">Lang: {patient.preferredLang}</span>
            )}
          </div>
          <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-4">
            <span>DOB {new Date(patient.dob).toLocaleDateString()}</span>
            <span>{fmtPhone(patient.phone)}</span>
            {patient.email && <span>{patient.email}</span>}
            {patient.insurerName && <span>Insurance: <span className="font-medium">{patient.insurerName}</span></span>}
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end max-w-[280px]">
          {allergies.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-end">
              <span className="chip bg-rose-100 text-rose-800 ring-rose-200 font-semibold">⚠ Allergies</span>
              {allergies.slice(0, 4).map((a, i) => (
                <span key={i} className="chip bg-rose-50 text-rose-700 ring-rose-200">{a.substance}{a.severity === "severe" || a.severity === "life-threatening" ? "!" : ""}</span>
              ))}
            </div>
          )}
          {problems.length > 0 && (
            <div className="text-[11px] text-slate-600 text-right max-w-[280px]">
              <span className="font-semibold text-slate-700">Active problems: </span>
              {problems.slice(0, 3).map(p => p.description).join(", ")}{problems.length > 3 ? "…" : ""}
            </div>
          )}
          {rightSlot}
        </div>
      </div>
    </div>
  );
}

export function PatientTabs({ patientId, active }: { patientId: string; active: string }) {
  const tabs = [
    { id: "summary", label: "Summary", href: `/patients/${patientId}` },
    { id: "demographics", label: "Demographics", href: `/patients/${patientId}/demographics` },
    { id: "allergies", label: "Allergies", href: `/patients/${patientId}/allergies` },
    { id: "problems", label: "Problems", href: `/patients/${patientId}/problems` },
    { id: "medications", label: "Medications", href: `/patients/${patientId}/medications` },
    { id: "vitals", label: "Vitals", href: `/patients/${patientId}/vitals` },
    { id: "encounters", label: "Encounters", href: `/patients/${patientId}/encounters` },
    { id: "orders", label: "Orders", href: `/patients/${patientId}/orders` },
    { id: "billing", label: "Billing", href: `/patients/${patientId}/billing` },
    { id: "documents", label: "Documents", href: `/patients/${patientId}/documents` },
  ];
  return (
    <div className="border-b border-slate-200 bg-white px-4 sticky top-[var(--header-h)] z-20">
      <nav className="flex flex-wrap items-center -mb-px">
        {tabs.map(t => (
          <Link key={t.id} href={t.href} prefetch={false} className={`tab-link ${active === t.id ? "active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
