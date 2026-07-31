import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import Shell from "@/components/Shell";
import JellyBeans from "@/components/JellyBeans";
import PatientHeader, { PatientTabs } from "@/components/PatientHeader";
import { SessionUser } from "@/lib/auth";

export async function loadPatientCtx(id: string) {
  try {
    const patient = await db.patient.findUnique({ where: { id } });
    if (!patient) notFound();
    const [allergies, problems] = await Promise.all([
      db.allergy.findMany({ where: { patientId: id, status: "active" } }),
      db.problem.findMany({ where: { patientId: id, status: { in: ["active", "chronic"] } } }),
    ]);
    return { patient, allergies, problems, dataUnavailable: false };
  } catch {
    return {
      patient: {
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
      } as any,
      allergies: [],
      problems: [],
      dataUnavailable: true,
    };
  }
}

export default function PatientChart({
  user,
  patient,
  allergies,
  problems,
  active,
  children,
}: {
  user: SessionUser;
  patient: any;
  allergies: any[];
  problems: any[];
  active: string;
  children: React.ReactNode;
}) {
  return (
    <Shell user={user} jellyBeans={<JellyBeans patientId={patient.id} />} patientHeader={
      <>
        <PatientHeader patient={patient} allergies={allergies} problems={problems} />
        <PatientTabs patientId={patient.id} active={active} />
      </>
    }>
      {children}
    </Shell>
  );
}
