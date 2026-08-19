"use client";

import React, { useMemo, useRef, useState } from "react";
import { CLINIC, FORMS, FormDef, Field, Section } from "@/lib/intake/forms";
import { tr, ui, Lang } from "@/lib/intake/i18n";
import { MANNEQUIN, BODY_BOX, PAIN_TYPES, painType, BodyMapValue, emptyBodyMap } from "@/lib/intake/bodymap";
import DrugSearch from "@/components/drugs/DrugSearch";
import type { DrugHit } from "@/lib/openfda";

const BRAND = "#0E4770";
const ACCENT = "#0A8C8C";

const ONLINE_FORMS = FORMS.filter((f) => f.online);

type Values = Record<string, any>;

/* ----------------------------- header ---------------------------- */
function Header({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <header className="w-full border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <img src="/pclinic-header.png" alt="Proactive Clinic" className="h-12 w-auto object-contain" />
        <div className="flex items-center gap-4">
          <div className="text-left text-xs leading-5 text-slate-500 sm:text-right">
            <div>{CLINIC.addr1}</div>
            <div>{CLINIC.addr2}</div>
            <div className="font-semibold" style={{ color: BRAND }}>{CLINIC.phone} · {CLINIC.web}</div>
          </div>
          <button
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            className="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            title="Language"
          >
            🌐 {ui(lang, "langLabel")}
          </button>
        </div>
      </div>
      <div className="h-1 w-full" style={{ background: ACCENT }} />
    </header>
  );
}

/* ----------------------------- body map picker ---------------------------- */
function Silhouette({
  markers,
  onAdd,
  onRemove,
}: {
  markers: { x: number; y: number; type?: string }[];
  onAdd: (x: number, y: number) => void;
  onRemove: (i: number) => void;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  function handleClick(e: React.MouseEvent) {
    const svg = ref.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    onAdd(p.x / BODY_BOX.w, p.y / BODY_BOX.h);
  }
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${BODY_BOX.w} ${BODY_BOX.h}`}
      onClick={handleClick}
      className="w-full cursor-crosshair select-none"
      style={{ maxWidth: 180, touchAction: "manipulation" }}
    >
      {MANNEQUIN.map((s, i) =>
        s.type === "circle" ? (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#EAF3FA" stroke="#B9C6D2" strokeWidth={1.5} />
        ) : (
          <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill="#EAF3FA" stroke="#B9C6D2" strokeWidth={1.5} />
        )
      )}
      {markers.map((m, i) => (
        <g
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(i);
          }}
          className="cursor-pointer"
        >
          <circle cx={m.x * BODY_BOX.w} cy={m.y * BODY_BOX.h} r={11} fill={painType(m.type).color} />
          <text x={m.x * BODY_BOX.w} y={m.y * BODY_BOX.h + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

function BodyMapField({ lang, value, set }: { lang: Lang; value: BodyMapValue; set: (v: BodyMapValue) => void }) {
  const [penType, setPenType] = useState<string>("sharp");
  const v = value && typeof value === "object" && value.front ? value : emptyBodyMap();
  const add = (view: "front" | "back", x: number, y: number) =>
    set({ ...v, [view]: [...v[view], { x, y, type: penType }] });
  const remove = (view: "front" | "back", i: number) =>
    set({ ...v, [view]: v[view].filter((_, idx) => idx !== i) });

  return (
    <div className="col-span-full">
      <p className="mb-2 text-xs text-slate-500">{ui(lang, "bodyTapAdd")}</p>
      {/* pain-type selector (active "pen") */}
      <div className="mb-3 flex flex-wrap gap-2">
        {PAIN_TYPES.map((pt) => {
          const on = penType === pt.key;
          return (
            <button
              key={pt.key}
              type="button"
              onClick={() => setPenType(pt.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                on ? "border-transparent text-white shadow-sm" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
              style={on ? { background: pt.color } : {}}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: on ? "#fff" : pt.color }} />
              {lang === "es" ? pt.labelEs : pt.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(["front", "back"] as const).map((view) => (
          <div key={view} className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-3">
            <Silhouette markers={v[view]} onAdd={(x, y) => add(view, x, y)} onRemove={(i) => remove(view, i)} />
            <div className="mt-2 text-xs font-semibold text-slate-500">
              {ui(lang, view === "front" ? "bodyFront" : "bodyBack")} · {v[view].length} {ui(lang, "bodyPoints")}
            </div>
          </div>
        ))}
      </div>
      {/* legend of marked points */}
      {(v.front.length > 0 || v.back.length > 0) && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          {v.front.map((m, i) => (
            <div key={`f${i}`} className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: painType(m.type).color }}>{i + 1}</span>
              {ui(lang, "bodyFront")} · {lang === "es" ? painType(m.type).labelEs : painType(m.type).label}
            </div>
          ))}
          {v.back.map((m, i) => (
            <div key={`b${i}`} className="flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: painType(m.type).color }}>{i + 1}</span>
              {ui(lang, "bodyBack")} · {lang === "es" ? painType(m.type).labelEs : painType(m.type).label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- medication self-report (openFDA) ---------------------------- */
function MedsField({ lang, label, value, set }: { lang: Lang; label: string; value: any; set: (v: string) => void }) {
  const list = (typeof value === "string" ? value : "").split("\n").map((s) => s.trim()).filter(Boolean);
  const [free, setFree] = useState("");
  const es = lang === "es";
  const commit = (next: string[]) => set(next.join("\n"));
  function addItem(text: string) {
    const t = text.trim();
    if (!t || list.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    commit([...list, t]);
  }
  function addDrug(d: DrugHit) {
    const name = d.brandName || d.genericName || d.display;
    const lbl = [name, d.strengths?.[0], d.dosageForm].filter(Boolean).join(" ").trim();
    addItem(lbl || name);
  }
  const remove = (i: number) => commit(list.filter((_, idx) => idx !== i));

  return (
    <div className="col-span-full">
      <label className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
      <p className="mb-2 text-[11px] text-slate-500">
        {es ? "Busque su medicamento para agregar el nombre y la concentración estándar, o escríbalo manualmente." : "Search to add the standardized name & strength from the FDA database, or type it in manually."}
      </p>
      <DrugSearch onSelect={addDrug} searchUrl="/api/intake/drug-search" placeholder={es ? "Busque un medicamento…" : "Search a medication…"} />
      <div className="mt-2 flex gap-2">
        <input
          value={free}
          onChange={(e) => setFree(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(free); setFree(""); } }}
          placeholder={es ? "Agregar manualmente (nombre, dosis)" : "Add manually (name, dose)"}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
        <button type="button" onClick={() => { addItem(free); setFree(""); }} className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: ACCENT }}>
          {es ? "Agregar" : "Add"}
        </button>
      </div>
      {list.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {list.map((m, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span>💊 {m}</span>
              <button type="button" onClick={() => remove(i)} className="text-xs text-slate-400 hover:text-red-500" aria-label="remove">✕</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">{es ? "Si no toma medicamentos, deje esto en blanco." : "If you take no medications, leave this blank."}</p>
      )}
    </div>
  );
}

/* ----------------------------- field renderer ---------------------------- */
function FieldView({
  field,
  values,
  set,
  lang,
}: {
  field: Field;
  values: Values;
  set: (id: string, v: any) => void;
  lang: Lang;
}) {
  switch (field.kind) {
    case "heading":
      return (
        <h4 className="col-span-full mt-2 text-sm font-semibold" style={{ color: ACCENT }}>
          {tr(field.text, lang)}
        </h4>
      );

    case "text":
    case "date": {
      const id = field.id!;
      const span = field.kind === "text" && field.width === "full" ? "col-span-full" : "col-span-full sm:col-span-1";
      return (
        <div className={span}>
          <label className="mb-1 block text-xs font-semibold text-slate-700">{tr(field.label, lang)}</label>
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
          <label className="mb-1 block text-xs font-semibold text-slate-700">{tr(field.label, lang)}</label>
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
          <span className="text-sm text-slate-700">{tr(field.label, lang)}</span>
          <div className="flex gap-2">
            {[
              { canon: "Yes", label: ui(lang, "yes") },
              { canon: "No", label: ui(lang, "no") },
            ].map((opt) => (
              <button
                key={opt.canon}
                type="button"
                onClick={() => set(id, opt.canon)}
                className={`rounded-md border px-4 py-1 text-sm font-medium transition ${
                  cur === opt.canon ? "border-transparent text-white" : "border-slate-300 bg-white text-slate-600 hover:border-teal-400"
                }`}
                style={cur === opt.canon ? { background: BRAND } : {}}
              >
                {opt.label}
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
        if (single) set(id, [opt]);
        else set(id, cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt]);
      };
      return (
        <div className="col-span-full">
          {field.label && <label className="mb-1.5 block text-xs font-semibold text-slate-700">{tr(field.label, lang)}</label>}
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
                  {tr(opt, lang)}
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
          <p className="rounded-lg bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-600">{tr(field.text, lang)}</p>
          {field.ack && (
            <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm font-medium" style={{ color: BRAND }}>
              <input
                type="checkbox"
                checked={!!values[field.id!]}
                onChange={(e) => set(field.id!, e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-teal-600"
              />
              <span>{tr(field.ackLabel, lang)}</span>
            </label>
          )}
        </div>
      );
    }

    case "signature": {
      const id = field.id!;
      return (
        <div className="col-span-full">
          <label className="mb-1 block text-xs font-semibold text-slate-700">{tr(field.label, lang)}</label>
          <input
            value={values[id] || ""}
            onChange={(e) => set(id, e.target.value)}
            placeholder={ui(lang, "typeName")}
            className="w-full rounded-lg border-2 border-dashed border-slate-300 px-3 py-2.5 text-base italic outline-none focus:border-teal-500"
            style={{ fontFamily: "cursive" }}
          />
          <p className="mt-1 text-[11px] text-slate-400">{ui(lang, "sigNote")}</p>
        </div>
      );
    }

    case "bodymap": {
      const id = field.id;
      return <BodyMapField lang={lang} value={values[id]} set={(v) => set(id, v)} />;
    }

    case "meds": {
      const id = field.id!;
      return <MedsField lang={lang} label={tr(field.label, lang)} value={values[id]} set={(v) => set(id, v)} />;
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
  lang,
}: {
  section: Section;
  index: number;
  values: Values;
  set: (id: string, v: any) => void;
  lang: Lang;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 rounded-t-2xl border-b border-slate-100 px-5 py-4" style={{ background: "#F1F7FB" }}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: BRAND }}>
          {index + 1}
        </div>
        <div>
          <h3 className="text-base font-bold" style={{ color: BRAND }}>{tr(section.title, lang)}</h3>
          {section.description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{tr(section.description, lang)}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        {section.fields.map((f, i) => (
          <FieldView key={i} field={f} values={values} set={set} lang={lang} />
        ))}
      </div>
    </section>
  );
}

/* ----------------------------- main experience --------------------------- */
export default function IntakePage() {
  const [lang, setLang] = useState<Lang>("en");
  const [selected, setSelected] = useState<FormDef | null>(null);
  const [values, setValues] = useState<Values>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | { confirmation: string; mrn: string; isNew: boolean; slug: string; out: Values }>(null);

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

  function serialize(): Values {
    const out: Values = {};
    for (const [k, v] of Object.entries(values)) {
      if (k === "bodyMap") out[k] = v; // keep object
      else out[k] = Array.isArray(v) ? v.join(", ") : v;
    }
    if (Array.isArray(values.sex) && values.sex[0]) {
      out.sex = values.sex[0] === "Female" ? "F" : values.sex[0] === "Male" ? "M" : "U";
    }
    return out;
  }

  async function downloadFilled(slug: string, out: Values) {
    try {
      const res = await fetch(`/api/intake/forms/${slug}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: out, lang }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      /* ignore */
    }
  }

  async function submit() {
    setError("");
    if (!values.firstName?.trim() || !values.lastName?.trim() || !values.dob) {
      setError(ui(lang, "errRequired"));
      return;
    }
    if (!values.signature?.trim()) {
      setError(ui(lang, "errSignature"));
      return;
    }
    for (const id of requiredAcks) {
      if (!values[id]) {
        setError(ui(lang, "errAcks"));
        return;
      }
    }
    const out = serialize();
    setSubmitting(true);
    try {
      const res = await fetch("/api/intake/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selected!.slug, values: out, lang }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || ui(lang, "errSubmit"));
      else {
        setDone({ confirmation: data.confirmation, mrn: data.mrn, isNew: data.isNew, slug: selected!.slug, out });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setError(ui(lang, "errNetwork"));
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- confirmation ---------- */
  if (done) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header lang={lang} setLang={setLang} />
        <main className="mx-auto max-w-2xl px-5 py-16 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "#DCFCE7" }}>
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{ui(lang, "thanks")}</h1>
          <p className="mt-2 text-slate-500">{ui(lang, "thanksSub")}</p>
          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
            <Row label={ui(lang, "confirmationNo")} value={done.confirmation} />
            <Row label={ui(lang, "mrnNo")} value={done.mrn} />
            <Row label={ui(lang, "record")} value={done.isNew ? ui(lang, "newPatient") : ui(lang, "matched")} />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => downloadFilled(done.slug, done.out)}
              className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {ui(lang, "downloadCopy")}
            </button>
            <button
              onClick={() => { setSelected(null); setDone(null); }}
              className="rounded-xl px-6 py-3 text-sm font-semibold text-white"
              style={{ background: BRAND }}
            >
              {ui(lang, "backHome")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* ---------- selected form ---------- */
  if (selected) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header lang={lang} setLang={setLang} />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <button onClick={() => setSelected(null)} className="mb-4 text-sm font-medium text-slate-500 hover:text-slate-700">
            {ui(lang, "back")}
          </button>
          <div className="mb-6 rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${BRAND}, ${ACCENT})` }}>
            <h1 className="text-2xl font-bold">{tr(selected.title, lang)}</h1>
            <p className="mt-1 text-sm text-white/85">{tr(selected.subtitle, lang)}</p>
            <p className="mt-3 text-xs text-white/75">{tr(selected.audience, lang)}</p>
          </div>

          <div className="space-y-5">
            {selected.sections.map((s, i) => (
              <SectionView key={i} section={s} index={i} values={values} set={set} lang={lang} />
            ))}
          </div>

          {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            <a
              href={`/api/intake/forms/${selected.slug}/pdf?lang=${lang}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-slate-500 underline-offset-2 hover:underline"
            >
              {ui(lang, "preferPaper")}
            </a>
            <button
              onClick={submit}
              disabled={submitting}
              className="rounded-xl px-7 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: BRAND }}
            >
              {submitting ? ui(lang, "submitting") : ui(lang, "submit")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* ---------- landing ---------- */
  return (
    <div className="min-h-screen bg-slate-50">
      <Header lang={lang} setLang={setLang} />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>{ui(lang, "kicker")}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-800">{ui(lang, "welcome")}</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-500">{ui(lang, "intro")}</p>
        </div>

        {(["clinical", "personal-injury"] as const).map((track) => {
          const forms = ONLINE_FORMS.filter((f) => f.track === track);
          if (forms.length === 0) return null;
          return (
            <div key={track} className="mt-10">
              <h2 className="text-lg font-bold text-slate-800">
                {track === "clinical"
                  ? lang === "es" ? "Paciente Clínico (Terapia General)" : "Clinical Patient (General Therapy)"
                  : lang === "es" ? "Lesión Personal (Rehabilitación Física)" : "Personal Injury (Physical Rehab)"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {track === "clinical"
                  ? lang === "es" ? "Para terapia o rehabilitación no relacionada con un accidente automovilístico." : "For therapy or rehabilitation not related to an auto accident."
                  : lang === "es" ? "Para pacientes de accidentes automovilísticos / reclamos PIP." : "For auto-accident / personal-injury (PIP) patients."}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                {forms.map((f) => (
                  <button
                    key={f.slug}
                    onClick={() => start(f)}
                    className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: track === "clinical" ? ACCENT : BRAND }}>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">{tr(f.title, lang)}</h3>
                    <p className="mt-1 text-sm text-slate-500">{tr(f.audience, lang)}</p>
                    <span className="mt-4 text-sm font-semibold group-hover:underline" style={{ color: ACCENT }}>{ui(lang, "startOnline")}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-12">
          <h2 className="text-lg font-bold text-slate-800">{ui(lang, "printableTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{ui(lang, "printableDesc")}</p>
          <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {FORMS.map((f) => (
              <a
                key={f.slug}
                href={`/api/intake/forms/${f.slug}/pdf?lang=${lang}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-slate-800">{tr(f.title, lang)}</p>
                    {f.online && (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-600">
                        {ui(lang, "alsoOnline")}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">{tr(f.subtitle, lang)}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  {ui(lang, "pdf")}
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
