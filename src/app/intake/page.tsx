"use client";

import React, { useMemo, useState } from "react";
import { CLINIC, FORMS, FormDef, Field, Section } from "@/lib/intake/forms";

const BRAND = "#0E4770";
const ACCENT = "#0A8C8C";

const ONLINE_FORMS = FORMS.filter((f) => f.online);

type Values = Record<string, any>;

/* ----------------------------- small UI atoms ---------------------------- */
function Header() {
  return (
    <header className="w-full border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <img src="/pclinic-header.png" alt="Proactive Clinic" className="h-12 w-auto object-contain" />
        <div className="text-left text-xs leading-5 text-slate-500 sm:text-right">
          <div>{CLINIC.addr1}</div>
          <div>{CLINIC.addr2}</div>
          <div className="font-semibold" style={{ color: BRAND }}>
            {CLINIC.phone} · {CLINIC.web}
          </div>
        </div>
      </div>
      <div className="h-1 w-full" style={{ background: ACCENT }} />
    </header>
  );
}

/* ----------------------------- field renderer ---------------------------- */
function FieldView({
  field,
  values,
  set,
}: {
  field: Field;
  values: Values;
  set: (id: string, v: any) => void;
}) {
  switch (field.kind) {
    case "heading":
      return (
        <h4 className="col-span-full mt-2 text-sm font-semibold" style={{ color: ACCENT }}>
          {field.text}
        </h4>
      );

    case "text":
    case "date": {
      const id = field.id!;
      const span =
        field.kind === "text" && field.width === "full"
          ? "col-span-full"
          : "col-span-full sm:col-span-1";
      return (
        <div className={span}>
          <label className="mb-1 block text-xs font-semibold text-slate-700">{field.label}</label>
          <input
            type={field.kind === "date" ? "date" : "text"}
            value={values[id] || ""}
            onChange={(e) => set(id, e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </div>
      );
    }

    case "textarea": {
      const id = field.id!;
      return (
        <div className="col-span-full">
          <label className="mb-1 block text-xs font-semibold text-slate-700">{field.label}</label>
          <textarea
            rows={field.lines || 2}
            value={values[id] || ""}
            onChange={(e) => set(id, e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </div>
      );
    }

    case "yesno": {
      const id = field.id!;
      const cur = values[id];
      return (
        <div className="col-span-full flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-sm text-slate-700">{field.label}</span>
          <div className="flex gap-2">
            {["Yes", "No"].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => set(id, opt)}
                className={`rounded-md border px-4 py-1 text-sm font-medium transition ${
                  cur === opt
                    ? "border-transparent text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-teal-400"
                }`}
                style={cur === opt ? { background: BRAND } : {}}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case "checkboxes": {
      const id = field.id!;
      const single = id === "sex" || id === "painLevel" || id === "progress";
      const cur: string[] = Array.isArray(values[id]) ? values[id] : [];
      const toggle = (opt: string) => {
        if (single) {
          set(id, [opt]);
        } else {
          set(id, cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt]);
        }
      };
      return (
        <div className="col-span-full">
          {field.label && (
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">{field.label}</label>
          )}
          <div className="flex flex-wrap gap-2">
            {field.options.map((opt) => {
              const on = cur.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                    on ? "border-transparent text-white" : "border-slate-300 bg-white text-slate-600 hover:border-teal-400"
                  }`}
                  style={on ? { background: ACCENT } : {}}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    case "paragraph": {
      return (
        <div className="col-span-full">
          <p className="rounded-lg bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-600">{field.text}</p>
          {field.ack && (
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm font-medium" style={{ color: BRAND }}>
              <input
                type="checkbox"
                checked={!!values[field.id!]}
                onChange={(e) => set(field.id!, e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-teal-600"
              />
              <span>{field.ackLabel || "I acknowledge and agree."}</span>
            </label>
          )}
        </div>
      );
    }

    case "signature": {
      const id = field.id!;
      return (
        <div className="col-span-full">
          <label className="mb-1 block text-xs font-semibold text-slate-700">{field.label}</label>
          <input
            value={values[id] || ""}
            onChange={(e) => set(id, e.target.value)}
            placeholder="Type your full legal name"
            className="w-full rounded-lg border-2 border-dashed border-slate-300 px-3 py-2.5 text-base italic outline-none focus:border-teal-500"
            style={{ fontFamily: "cursive" }}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Typing your name serves as your electronic signature.
          </p>
        </div>
      );
    }

    default:
      return null;
  }
}

function SectionView({
  section,
  index,
  values,
  set,
}: {
  section: Section;
  index: number;
  values: Values;
  set: (id: string, v: any) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 rounded-t-2xl border-b border-slate-100 px-5 py-4" style={{ background: "#F1F7FB" }}>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ background: BRAND }}
        >
          {index + 1}
        </div>
        <div>
          <h3 className="text-base font-bold" style={{ color: BRAND }}>
            {section.title.replace(/^\d+\.\s*/, "")}
          </h3>
          {section.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{section.description}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        {section.fields.map((f, i) => (
          <FieldView key={i} field={f} values={values} set={set} />
        ))}
      </div>
    </section>
  );
}

/* ----------------------------- main experience --------------------------- */
export default function IntakePage() {
  const [selected, setSelected] = useState<FormDef | null>(null);
  const [values, setValues] = useState<Values>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | { confirmation: string; mrn: string; isNew: boolean }>(null);

  const set = (id: string, v: any) => setValues((p) => ({ ...p, [id]: v }));

  const requiredAcks = useMemo(() => {
    if (!selected) return [] as string[];
    const ids: string[] = [];
    selected.sections.forEach((s) =>
      s.fields.forEach((f) => {
        if (f.kind === "paragraph" && f.ack && f.id) ids.push(f.id);
      })
    );
    return ids;
  }, [selected]);

  function start(form: FormDef) {
    setSelected(form);
    setValues({});
    setError("");
    setDone(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setError("");
    if (!values.firstName?.trim() || !values.lastName?.trim() || !values.dob) {
      setError("Please provide your first name, last name and date of birth.");
      return;
    }
    if (!values.signature?.trim()) {
      setError("Please type your name as your electronic signature.");
      return;
    }
    for (const id of requiredAcks) {
      if (!values[id]) {
        setError("Please read and check each consent acknowledgement before submitting.");
        return;
      }
    }

    // Serialize checkbox arrays to strings; map sex to a chart code.
    const out: Values = {};
    for (const [k, v] of Object.entries(values)) {
      out[k] = Array.isArray(v) ? v.join(", ") : v;
    }
    if (Array.isArray(values.sex) && values.sex[0]) {
      out.sex = values.sex[0] === "Female" ? "F" : values.sex[0] === "Male" ? "M" : "U";
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/intake/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selected!.slug, values: out }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not submit your intake.");
      } else {
        setDone({ confirmation: data.confirmation, mrn: data.mrn, isNew: data.isNew });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setError("Network error. Please try again or ask the front desk for help.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- confirmation ---------- */
  if (done) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-2xl px-5 py-16 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "#DCFCE7" }}>
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Thank you — your intake was submitted</h1>
          <p className="mt-2 text-slate-500">A front-desk team member will verify your information at your visit.</p>
          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
            <Row label="Confirmation #" value={done.confirmation} />
            <Row label="Medical Record #" value={done.mrn} />
            <Row label="Record" value={done.isNew ? "New patient created" : "Matched to existing chart"} />
          </div>
          <button
            onClick={() => {
              setSelected(null);
              setDone(null);
            }}
            className="mt-8 rounded-xl px-6 py-3 text-sm font-semibold text-white"
            style={{ background: BRAND }}
          >
            Back to intake home
          </button>
        </main>
      </div>
    );
  }

  /* ---------- selected form ---------- */
  if (selected) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <button onClick={() => setSelected(null)} className="mb-4 text-sm font-medium text-slate-500 hover:text-slate-700">
            ← Back
          </button>
          <div className="mb-6 rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${BRAND}, ${ACCENT})` }}>
            <h1 className="text-2xl font-bold">{selected.title}</h1>
            <p className="mt-1 text-sm text-white/85">{selected.subtitle}</p>
            <p className="mt-3 text-xs text-white/75">{selected.audience}</p>
          </div>

          <div className="space-y-5">
            {selected.sections.map((s, i) => (
              <SectionView key={i} section={s} index={i} values={values} set={set} />
            ))}
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            <a
              href={`/api/intake/forms/${selected.slug}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-slate-500 underline-offset-2 hover:underline"
            >
              Prefer paper? Download a printable copy
            </a>
            <button
              onClick={submit}
              disabled={submitting}
              className="rounded-xl px-7 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: BRAND }}
            >
              {submitting ? "Submitting…" : "Submit Intake"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* ---------- landing ---------- */
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
            Patient Intake
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-800">Welcome to Proactive Clinic</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">
            Complete your Physical Recovery &amp; Therapy paperwork online before your visit — or download a printable
            copy to fill out offline. Choose the option that fits you.
          </p>
        </div>

        {/* online choices */}
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          {ONLINE_FORMS.map((f) => (
            <button
              key={f.slug}
              onClick={() => start(f)}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: BRAND }}>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{f.audience}</p>
              <span className="mt-4 text-sm font-semibold group-hover:underline" style={{ color: ACCENT }}>
                Start online →
              </span>
            </button>
          ))}
        </div>

        {/* printable downloads */}
        <div className="mt-12">
          <h2 className="text-lg font-bold text-slate-800">Printable forms (for offline / in-office use)</h2>
          <p className="mt-1 text-sm text-slate-500">
            Download beautifully formatted, brand-ready PDFs. Includes patient intake and clinical documentation forms.
          </p>
          <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {FORMS.map((f) => (
              <a
                key={f.slug}
                href={`/api/intake/forms/${f.slug}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-slate-800">{f.title}</p>
                    {f.online && (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-600">
                        Also online
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">{f.subtitle}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  PDF
                </span>
              </a>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          {CLINIC.name} · {CLINIC.addr1}, {CLINIC.addr2} · {CLINIC.phone} · {CLINIC.web}
        </p>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}
