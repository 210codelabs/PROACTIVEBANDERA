import type { Metadata } from "next";
import Link from "next/link";
import DemoRequestForm from "./DemoRequestForm";

export const metadata: Metadata = {
  title: "Request a Demo | ProactiveClinic — Unified Healthcare Intelligence",
  description: "See ProactiveClinic in action. Request a personalized walkthrough of the all-in-one EHR/EMR + AI healthcare operating platform tailored to your practice.",
};

const HIGHLIGHTS = [
  { title: "Clinical & Charting", desc: "Encounters, SOAP, orders, e-Rx, medication intelligence." },
  { title: "Revenue Cycle", desc: "Eligibility, claims, ERA/remittance and analytics." },
  { title: "Patient Engagement", desc: "Portal, intake, scheduling, kiosk and telehealth." },
  { title: "Interoperability", desc: "FHIR R4, HL7, C-CDA, X12 EDI and CMS Blue Button." },
  { title: "Legal / PI Workflows", desc: "Attorney portal, records requests, case tracking." },
  { title: "Analytics & Insights", desc: "Practice-wide dashboards, exportable and presentable." },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Branded header */}
      <header className="bg-gradient-to-r from-[#0a2540] via-[#0a2540] to-[#0d9488] text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="ProactiveClinic" className="h-10 w-10 rounded-lg ring-1 ring-white/30 bg-black/20" />
            <div>
              <div className="font-bold tracking-tight leading-tight">ProactiveClinic</div>
              <div className="text-[11px] text-white/70">Unified Healthcare Intelligence</div>
            </div>
          </Link>
          <Link href="/" className="ml-auto text-sm text-white/80 hover:text-white">← Back to home</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Marketing pitch */}
        <section>
          <span className="inline-block text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700 bg-teal-50 ring-1 ring-teal-200 rounded-full px-3 py-1">Request a Demo</span>
          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">See the whole practice run on one platform.</h1>
          <p className="mt-3 text-slate-600 text-lg">
            Get a personalized walkthrough of ProactiveClinic — the all-in-one EHR/EMR + AI operating platform covering clinical,
            financial, administrative, patient engagement, interoperability and legal workflows. We&apos;ll tailor the demo to your practice.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
                <div className="font-semibold text-slate-900">{h.title}</div>
                <div className="text-sm text-slate-500 mt-0.5">{h.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-semibold">
            {["FHIR R4", "HL7 v2.x", "C-CDA", "X12 EDI", "SMART on FHIR", "ICD-10", "CPT", "NPI"].map((s) => (
              <span key={s} className="rounded-full bg-white ring-1 ring-slate-200 text-slate-600 px-3 py-1">{s}</span>
            ))}
          </div>
        </section>

        {/* Form */}
        <section className="lg:pl-4">
          <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-6 sm:p-7">
            <h2 className="text-xl font-bold text-slate-900">Tell us about your practice</h2>
            <p className="text-sm text-slate-500 mt-1">A specialist will reach out to schedule your walkthrough.</p>
            <DemoRequestForm />
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">ProactiveClinic — A Division of Proactive UMS Inc. Your information is used only to contact you about a demo.</p>
        </section>
      </main>
    </div>
  );
}
