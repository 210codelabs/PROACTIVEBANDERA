"use client";

import React from "react";
import { CLINIC, FORMS } from "@/lib/intake/forms";

const BRAND = "#0E4770";
const ACCENT = "#0A8C8C";

export default function IntakeFormsPage() {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const onlineUrl = `${base}/intake`;

  const online = FORMS.filter((f) => f.online);
  const clinical = FORMS.filter((f) => !f.online);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Intake &amp; Clinical Forms</h1>
        <p className="mt-1 text-sm text-slate-500">
          Branded Proactive Clinic intake and documentation forms for Physical Recovery &amp; Therapy patients. Share the
          online link with patients, or print the PDFs for offline / in-office completion.
        </p>
      </div>

      {/* Online intake link */}
      <div className="mb-8 rounded-2xl p-6 text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${BRAND}, ${ACCENT})` }}>
        <h2 className="text-lg font-bold">Online patient intake</h2>
        <p className="mt-1 text-sm text-white/85">
          Send patients here to complete their intake before a visit. New-patient records are created automatically and
          appear in the patient&apos;s Documents tab.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-white/15 px-3 py-2 text-sm">{onlineUrl}</code>
          <button
            onClick={() => navigator.clipboard?.writeText(onlineUrl)}
            className="rounded-lg bg-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/30"
          >
            Copy link
          </button>
          <a
            href="/intake"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold"
            style={{ color: BRAND }}
          >
            Open intake portal →
          </a>
        </div>
      </div>

      <FormGroup title="Patient intake forms" subtitle="Available online and as printable PDFs." forms={online} accent />
      <FormGroup
        title="Clinical documentation forms"
        subtitle="Provider-completed forms for in-office / offline use."
        forms={clinical}
      />

      <p className="mt-10 text-center text-xs text-slate-400">
        {CLINIC.name} · {CLINIC.addr1}, {CLINIC.addr2} · {CLINIC.phone} · {CLINIC.web}
      </p>
    </div>
  );
}

function FormGroup({
  title,
  subtitle,
  forms,
  accent,
}: {
  title: string;
  subtitle: string;
  forms: typeof FORMS;
  accent?: boolean;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      <p className="mb-3 text-xs text-slate-500">{subtitle}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {forms.map((f) => (
          <div key={f.slug} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-slate-800">{f.title}</h3>
              {accent && (
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-600">
                  Online
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">{f.subtitle}</p>
            <p className="mt-2 flex-1 text-xs text-slate-400">{f.audience}</p>
            <div className="mt-4 flex gap-2">
              <a
                href={`/api/intake/forms/${f.slug}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white"
                style={{ background: BRAND }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                View / Print PDF
              </a>
              {f.online && (
                <a
                  href="/intake"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Preview online
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
