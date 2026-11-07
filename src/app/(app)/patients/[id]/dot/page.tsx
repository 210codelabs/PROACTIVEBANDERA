import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import PatientChart, { loadPatientCtx } from "@/components/PatientChart";
import DotExamHistory from "@/components/dot/DotExamHistory";

export default async function PatientDotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const ctx = await loadPatientCtx(id);
  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) notFound();
  const exams = await db.dotExam.findMany({
    where: { patientId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, status: true, outcome: true, examDate: true, expiresOn: true, createdAt: true },
  });

  return (
    <PatientChart user={user} {...ctx} patient={patient} active="dot">
      <DotExamHistory patientId={id} role={user.role} registration={patient.dotRegistration} initialExams={exams} />
    </PatientChart>
  );
}