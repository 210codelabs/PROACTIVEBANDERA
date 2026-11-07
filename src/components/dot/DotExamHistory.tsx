"use client";

import { useState } from "react";
import DotExamEditor from "@/components/dot/DotExamEditor";

type Exam = {
  id: string;
  status: string;
  outcome: string;
  examDate: string | Date | null;
  expiresOn: string | Date | null;
  createdAt: string | Date;
  kioskToken?: string | null;
};

const STATUS: Record<string, string> = {
  driver_pending: "Draft · awaiting driver history",
  exam_pending: "In progress · awaiting examiner",
  completed: "Stored examination record · signature status unverified",
};

export default function DotExamHistory({ patientId, role, registration, initialExams }: {
  patientId: string;
  role: string;
  registration: unknown;
  initialExams: Exam[];
}) {
  const [exams, setExams] = useState(initialExams);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  async function createExam() {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`/api/patients/${patientId}/dot-exams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create DOT examination");
      setExams((current) => [data.exam, ...current]);
      setSelectedExamId(data.exam.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create DOT examination");
    } finally {
      setCreating(false);
    }
  }

  const info = registration && typeof registration === "object" ? registration as Record<string, unknown> : {};

  return (
    <div className="space-y-5">
      <section className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="section-title">FMCSA DOT</h2>
            <p className="mt-1 text-sm text-slate-600">DOT registration details and examination history linked to this patient chart.</p>
          </div>
          <button type="button" className="btn-primary" onClick={createExam} disabled={creating}>
            {creating ? "Creating…" : "New DOT Examination"}
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-xs text-slate-500">Commercial license</dt><dd className="font-medium text-slate-800">{String(info.licenseNumber || "—")}</dd></div>
          <div><dt className="text-xs text-slate-500">License state</dt><dd className="font-medium text-slate-800">{String(info.licenseState || "—")}</dd></div>
          <div><dt className="text-xs text-slate-500">CDL / CLP</dt><dd className="font-medium text-slate-800">{info.hasCdl === "yes" ? `Yes${info.cdlClass ? ` · Class ${String(info.cdlClass)}` : ""}` : info.hasCdl === "no" ? "No" : "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Employer</dt><dd className="font-medium text-slate-800">{String(info.employerName || "—")}</dd></div>
          <div><dt className="text-xs text-slate-500">Payment responsibility</dt><dd className="font-medium text-slate-800">{String(info.paymentResponsibility || "—").replace(/_/g, " ")}</dd></div>
          <div><dt className="text-xs text-slate-500">Requested examination</dt><dd className="font-medium text-slate-800">{String(info.examReason || "—").replace(/_/g, " ")}</dd></div>
        </dl>
        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      </section>

      <section className="card">
        <header className="border-b border-slate-200 px-4 py-3 font-semibold">DOT Examination History ({exams.length})</header>
        {exams.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No DOT examinations are recorded for this patient.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {exams.map((exam) => (
              <article key={exam.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-800">{STATUS[exam.status] || exam.status}</p>
                  <p className="mt-1 text-xs text-slate-500">{exam.examDate ? `Recorded exam date ${new Date(exam.examDate).toLocaleDateString()}` : `Created ${new Date(exam.createdAt).toLocaleDateString()}`}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-slate-700">{exam.outcome === "pending" ? "Determination pending" : `Recorded determination: ${exam.outcome.replace(/_/g, " ")}`}</p>
                  {exam.expiresOn && <p className="text-xs text-slate-500">Recorded expiration: {new Date(exam.expiresOn).toLocaleDateString()}</p>}
                  {exam.kioskToken && <a className="mt-1 block text-xs text-brand-700 hover:underline" href={`/enterprise/dot/kiosk/${exam.kioskToken}`} target="_blank" rel="noreferrer">Driver history form</a>}
                  {["provider", "admin"].includes(role) && <button type="button" className="mt-1 text-xs font-medium text-brand-700 hover:underline" onClick={() => setSelectedExamId(exam.id)}>Open examination</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">Draft examinations cannot issue a certificate. Examiner credential verification, electronic signing, document locking, and MEC issuance must be completed before certified PDFs are made available.</p>
      {selectedExamId && <DotExamEditor patientId={patientId} examId={selectedExamId} role={role} onClose={() => setSelectedExamId(null)} onUpdated={(exam) => setExams((current) => current.map((item) => item.id === exam.id ? { ...item, ...exam } : item))} />}
    </div>
  );
}