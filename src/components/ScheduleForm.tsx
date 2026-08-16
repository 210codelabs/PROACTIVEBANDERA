"use client";

import React, { useState } from "react";

type Lang = "en" | "es";

const SERVICES: Record<Lang, { new: string[]; existing: string[] }> = {
  en: {
    new: ["Primary Care", "Physical Rehabilitation", "Pain Management", "Wellness & Recovery", "Telehealth", "Not sure yet"],
    existing: ["Primary Care", "Physical Therapy", "Pain Management", "Chiropractic", "IV Therapy", "Wellness & Recovery", "Telehealth", "Follow-up Visit", "Lab / Imaging Review", "Medication Refill"],
  },
  es: {
    new: ["Atención primaria", "Rehabilitación física", "Manejo del dolor", "Bienestar y recuperación", "Telemedicina", "Aún no estoy seguro"],
    existing: ["Atención primaria", "Terapia física", "Manejo del dolor", "Quiropráctica", "Terapia IV", "Bienestar y recuperación", "Telemedicina", "Cita de seguimiento", "Revisión de laboratorio / imágenes", "Resurtido de medicamentos"],
  },
};

const T: Record<Lang, Record<string, string>> = {
  en: {
    newTitle: "New Patient", newDesc: "First time here? Share a few basics and we'll reach out to schedule your first visit.",
    newStart: "Start →",
    existingTitle: "Current Patient", existingDesc: "Already have an MRN? Verify your identity for more services and", priority: "priority check-in",
    existingStart: "Verify & schedule →",
    change: "← Change patient type",
    newFormTitle: "New Patient — Request a Visit", existingFormTitle: "Current Patient — Request a Visit",
    disclaimer: "As a new patient you don't need a Medical Record Number (MRN). Your MRN is created and activated in person at the clinic during your first visit. This form submits a request; our team will contact you to confirm.",
    mrn: "Medical Record Number (MRN)", dob: "Date of birth", first: "First name", last: "Last name",
    phone: "Phone", email: "Email", service: "Service of interest", select: "Select…",
    prefDate: "Preferred date", prefTime: "Preferred time", notes: "Notes (optional)",
    submit: "Submit request", submitting: "Submitting…",
    received: "Request received", yourConf: "Your confirmation number is",
    priorityChip: "★ Priority check-in as a current patient",
    contactSoon: "Our front desk will contact you shortly to confirm your appointment. Please save your confirmation number.",
    emailSent: "A confirmation email is on its way.", home: "Back to home",
    errGeneric: "Something went wrong. Please try again.", errNetwork: "Network error. Please try again.",
  },
  es: {
    newTitle: "Paciente Nuevo", newDesc: "¿Primera vez aquí? Comparta algunos datos y nos comunicaremos para agendar su primera visita.",
    newStart: "Comenzar →",
    existingTitle: "Paciente Actual", existingDesc: "¿Ya tiene un MRN? Verifique su identidad para más servicios y", priority: "registro prioritario",
    existingStart: "Verificar y agendar →",
    change: "← Cambiar tipo de paciente",
    newFormTitle: "Paciente Nuevo — Solicitar una Visita", existingFormTitle: "Paciente Actual — Solicitar una Visita",
    disclaimer: "Como paciente nuevo no necesita un Número de Registro Médico (MRN). Su MRN se crea y activa en persona en la clínica durante su primera visita. Este formulario envía una solicitud; nuestro equipo se comunicará para confirmar.",
    mrn: "Número de Registro Médico (MRN)", dob: "Fecha de nacimiento", first: "Nombre", last: "Apellido",
    phone: "Teléfono", email: "Correo electrónico", service: "Servicio de interés", select: "Seleccione…",
    prefDate: "Fecha preferida", prefTime: "Hora preferida", notes: "Notas (opcional)",
    submit: "Enviar solicitud", submitting: "Enviando…",
    received: "Solicitud recibida", yourConf: "Su número de confirmación es",
    priorityChip: "★ Registro prioritario como paciente actual",
    contactSoon: "Nuestra recepción se comunicará con usted en breve para confirmar su cita. Guarde su número de confirmación.",
    emailSent: "Un correo de confirmación va en camino.", home: "Volver al inicio",
    errGeneric: "Algo salió mal. Inténtelo de nuevo.", errNetwork: "Error de red. Inténtelo de nuevo.",
  },
};

export default function ScheduleForm({ lang = "en" }: { lang?: Lang }) {
  const t = T[lang];
  const [mode, setMode] = useState<"choice" | "new" | "existing">("choice");
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ confirmation: string; priorityCheckin: boolean; emailStatus?: string } | null>(null);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(patientType: "new" | "existing") {
    setBusy(true); setError("");
    try {
      const resp = await fetch("/api/appointments/request", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, patientType, lang }),
      });
      const j = await resp.json();
      if (!resp.ok) { setError(j.error || t.errGeneric); setBusy(false); return; }
      setDone({ confirmation: j.confirmation, priorityCheckin: j.priorityCheckin, emailStatus: j.emailStatus });
    } catch { setError(t.errNetwork); }
    setBusy(false);
  }

  if (done) {
    return (
      <div className="card card-pad text-center max-w-lg mx-auto">
        <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center mx-auto text-2xl">✓</div>
        <h2 className="text-xl font-bold text-slate-900 mt-3">{t.received}</h2>
        <p className="text-slate-600 mt-1">{t.yourConf}</p>
        <div className="text-2xl font-extrabold text-brand-700 my-2 tracking-wider">{done.confirmation}</div>
        {done.priorityCheckin && (
          <div className="inline-block rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 mb-2">{t.priorityChip}</div>
        )}
        <p className="text-sm text-slate-500">{t.contactSoon}</p>
        {done.emailStatus === "sent" && <p className="text-sm text-emerald-600 mt-1">{t.emailSent}</p>}
        <a href="/" className="btn-primary inline-block mt-4">{t.home}</a>
      </div>
    );
  }

  if (mode === "choice") {
    return (
      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
        <button onClick={() => { setForm({}); setError(""); setMode("new"); }} className="card card-pad text-left hover:ring-2 hover:ring-brand-300 transition">
          <div className="text-lg font-bold text-slate-900">{t.newTitle}</div>
          <p className="text-sm text-slate-500 mt-1">{t.newDesc}</p>
          <span className="chip bg-brand-100 text-brand-800 ring-brand-200 mt-3">{t.newStart}</span>
        </button>
        <button onClick={() => { setForm({}); setError(""); setMode("existing"); }} className="card card-pad text-left hover:ring-2 hover:ring-brand-300 transition">
          <div className="text-lg font-bold text-slate-900">{t.existingTitle}</div>
          <p className="text-sm text-slate-500 mt-1">{t.existingDesc} <b>{t.priority}</b>.</p>
          <span className="chip bg-emerald-100 text-emerald-800 ring-emerald-200 mt-3">{t.existingStart}</span>
        </button>
      </div>
    );
  }

  const services = mode === "new" ? SERVICES[lang].new : SERVICES[lang].existing;

  return (
    <div className="card card-pad max-w-2xl mx-auto">
      <button onClick={() => setMode("choice")} className="text-sm text-brand-700 hover:underline mb-3">{t.change}</button>
      <h2 className="text-lg font-bold text-slate-900">{mode === "new" ? t.newFormTitle : t.existingFormTitle}</h2>

      {mode === "new" && (
        <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-900 mt-2">{t.disclaimer}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        {mode === "existing" && (<>
          <label className="block"><span className="label">{t.mrn}</span><input className="input" value={form.mrn || ""} onChange={(e) => set("mrn", e.target.value)} placeholder="PC-XXXXXX" /></label>
          <label className="block"><span className="label">{t.dob}</span><input type="date" className="input" value={form.dob || ""} onChange={(e) => set("dob", e.target.value)} /></label>
        </>)}
        <label className="block"><span className="label">{t.first}</span><input className="input" value={form.firstName || ""} onChange={(e) => set("firstName", e.target.value)} /></label>
        <label className="block"><span className="label">{t.last}</span><input className="input" value={form.lastName || ""} onChange={(e) => set("lastName", e.target.value)} /></label>
        <label className="block"><span className="label">{t.phone}</span><input className="input" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} /></label>
        <label className="block"><span className="label">{t.email}</span><input className="input" value={form.email || ""} onChange={(e) => set("email", e.target.value)} /></label>
        {mode === "new" && (
          <label className="block"><span className="label">{t.dob}</span><input type="date" className="input" value={form.dob || ""} onChange={(e) => set("dob", e.target.value)} /></label>
        )}
        <label className="block"><span className="label">{t.service}</span>
          <select className="input" value={form.serviceInterest || ""} onChange={(e) => set("serviceInterest", e.target.value)}>
            <option value="">{t.select}</option>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">{t.prefDate}</span><input type="date" className="input" value={form.preferredDate || ""} onChange={(e) => set("preferredDate", e.target.value)} /></label>
        <label className="block"><span className="label">{t.prefTime}</span><input type="time" min="09:00" max="20:00" step={900} className="input" value={form.preferredTime || ""} onChange={(e) => set("preferredTime", e.target.value)} /></label>
        <label className="block sm:col-span-2"><span className="label">{t.notes}</span><textarea className="input" rows={3} value={form.message || ""} onChange={(e) => set("message", e.target.value)} /></label>
      </div>

      {error && <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 p-3 text-sm text-rose-700 mt-3">{error}</div>}

      <button disabled={busy} onClick={() => submit(mode as "new" | "existing")} className="btn-primary w-full mt-4">
        {busy ? t.submitting : t.submit}
      </button>
    </div>
  );
}
