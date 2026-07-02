import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import PatientHeader from "@/components/PatientHeader";
import { fmtDateTime, fmtMoney } from "@/lib/utils";
import EncounterEditor from "./EncounterEditor";

export default async function EncounterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const enc = await db.encounter.findUnique({
    where: { id },
    include: {
      patient: { include: { allergies: { where: { status: "active" } }, problems: { where: { status: { in: ["active", "chronic"] } } } } },
      provider: true,
      diagnoses: true,
      charges: true,
      orders: { include: { provider: true } },
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!enc) notFound();

  return (
    <Shell user={user} jellyBeans={<JellyBeans patientId={enc.patientId} />} patientHeader={
      <PatientHeader patient={enc.patient} allergies={enc.patient.allergies} problems={enc.patient.problems} />
    }>
      <div className="flex items-center gap-3 mb-3">
        <h1 className="text-xl font-bold text-slate-900">Encounter — {fmtDateTime(enc.startedAt)}</h1>
        <span className={`chip ${enc.status === "signed" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"}`}>{enc.status}</span>
        <span className="text-xs text-slate-500">with {enc.provider.firstName} {enc.provider.lastName}{enc.provider.credential ? `, ${enc.provider.credential}` : ""}</span>
        <Link href={`/patients/${enc.patientId}`} className="ml-auto text-xs font-semibold text-brand-700 hover:underline">← Back to chart</Link>
      </div>
      <EncounterEditor encounter={JSON.parse(JSON.stringify(enc))} />
    </Shell>
  );
}
