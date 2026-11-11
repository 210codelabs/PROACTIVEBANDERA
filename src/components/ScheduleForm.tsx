"use client";

import React, { useEffect, useState } from "react";
import { CLINIC_LOCATIONS, findClinic } from "@/lib/clinicLocations";
import BookingIntake from "@/components/BookingIntake";

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
    newTitle: "New Patient", newDesc: "Reserve your first visit. Your information will be verified at the clinic.",
    newStart: "Start →",
    existingTitle: "Current Patient", existingDesc: "Already have an MRN? Verify your identity for more services and", priority: "priority check-in",
    existingStart: "Verify & schedule →",
    change: "← Change patient type",
    newFormTitle: "New Patient — Book a Visit", existingFormTitle: "Current Patient — Book a Visit",
    disclaimer: "Your appointment will be reserved. Your identity and insurance information will be reviewed by clinic staff at your first visit.",
    mrn: "Medical Record Number (MRN)", dob: "Date of birth", zip: "ZIP code", first: "First name", last: "Last name", lookup: "Find my booking ID", lookupOk: "Booking ID found. It can only be used to book this appointment.", lookupError: "Unable to verify your details. Please contact the clinic.",
    phone: "Phone", email: "Email", service: "Service of interest", select: "Select…",
    clinic: "Clinic location", clinicPick: "Choose a clinic…", clinicReq: "Please choose a clinic location.", bookingAt: "Booking at",
    prefDate: "Appointment date", prefTime: "Appointment time (Central Time)", notes: "Notes (optional)", booked: "Booked", selectTime: "Choose a time…", availabilityError: "Availability is temporarily unavailable.",
    submit: "Book appointment", submitting: "Booking…",
    received: "Appointment booked", yourConf: "Your confirmation number is",
    priorityChip: "★ Priority check-in as a current patient",
    contactSoon: "Your appointment is reserved. Our staff will verify your information and insurance at your visit. Please save your confirmation number.",
    emailSent: "A confirmation email is on its way.", home: "Back to home",
    errGeneric: "Something went wrong. Please try again.", errNetwork: "Network error. Please try again.",
  },
  es: {
    newTitle: "Paciente Nuevo", newDesc: "Reserve su primera visita. Sus datos se verificarán en la clínica.",
    newStart: "Comenzar →",
    existingTitle: "Paciente Actual", existingDesc: "¿Ya tiene un MRN? Verifique su identidad para más servicios y", priority: "registro prioritario",
    existingStart: "Verificar y agendar →",
    change: "← Cambiar tipo de paciente",
    newFormTitle: "Paciente Nuevo — Reservar una Visita", existingFormTitle: "Paciente Actual — Reservar una Visita",
    disclaimer: "Su cita será reservada. El personal de la clínica revisará su identidad y seguro en su primera visita.",
    mrn: "Número de Registro Médico (MRN)", dob: "Fecha de nacimiento", zip: "Código postal", first: "Nombre", last: "Apellido", lookup: "Buscar mi identificador de reserva", lookupOk: "Identificador encontrado. Solo se puede usar para reservar esta cita.", lookupError: "No se pudieron verificar sus datos. Comuníquese con la clínica.",
    phone: "Teléfono", email: "Correo electrónico", service: "Servicio de interés", select: "Seleccione…",
    clinic: "Clínica", clinicPick: "Elija una clínica…", clinicReq: "Por favor elija una clínica.", bookingAt: "Agendando en",
    prefDate: "Fecha de la cita", prefTime: "Hora de la cita (hora central)", notes: "Notas (opcional)", booked: "Ocupado", selectTime: "Elija una hora…", availabilityError: "La disponibilidad no está disponible temporalmente.",
    submit: "Reservar cita", submitting: "Reservando…",
    received: "Cita reservada", yourConf: "Su número de confirmación es",
    priorityChip: "★ Registro prioritario como paciente actual",
    contactSoon: "Su cita está reservada. Nuestro personal verificará sus datos y seguro durante su visita. Guarde su número de confirmación.",
    emailSent: "Un correo de confirmación va en camino.", home: "Volver al inicio",
    errGeneric: "Algo salió mal. Inténtelo de nuevo.", errNetwork: "Error de red. Inténtelo de nuevo.",
  },
};

export default function ScheduleForm({ lang = "en", initialLocation = "" }: { lang?: Lang; initialLocation?: string }) {
  const t = T[lang];
  const [mode, setMode] = useState<"choice" | "new" | "existing">("choice");
  const [form, setForm] = useState<Record<string, string>>({});
  // Clinic chosen on the landing page ("Book at this clinic") or here.
  const [clinicId, setClinicId] = useState<string>(findClinic(initialLocation)?.id || "");
  const clinic = findClinic(clinicId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([]);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupFound, setLookupFound] = useState(false);
  const [done, setDone] = useState<{ confirmation: string; priorityCheckin: boolean; emailStatus?: string; clinic?: string; intakeToken?: string } | null>(null);

  useEffect(() => {
    const day = form.preferredDate;
    setSlots([]);
    setAvailabilityError(false);
    if (!day) return;
    const controller = new AbortController();
    fetch(`/api/appointments/request/availability?day=${encodeURIComponent(day)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Unavailable"); return response.json(); })
      .then((data) => setSlots(data.slots))
      .catch(() => { if (!controller.signal.aborted) setAvailabilityError(true); });
    return () => controller.abort();
  }, [form.preferredDate]);

  function set(k: string, v: string) {
    const identityField = ["mrn", "firstName", "lastName", "dob", "postalCode"].includes(k);
    if (identityField) setLookupFound(false);
    setForm((f) => ({ ...f, [k]: v, ...(identityField ? { bookingId: "" } : {}) }));
  }

  async function lookupPatient() {
    setLookupBusy(true); setError(""); setLookupFound(false);
    try {
      const response = await fetch("/api/appointments/request/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, dob: form.dob, postalCode: form.postalCode }) });
      const result = await response.json();
      if (!response.ok) throw new Error();
      setForm((current) => ({ ...current, mrn: "", bookingId: result.bookingId }));
      setLookupFound(true);
    } catch { setError(t.lookupError); }
    finally { setLookupBusy(false); }
  }

  async function submit(patientType: "new" | "existing") {
    if (!clinicId) { setError(t.clinicReq); return; }
    setBusy(true); setError("");
    try {
      const resp = await fetch("/api/appointments/request", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, patientType, lang, location: clinicId }),
      });
      const j = await resp.json();
      if (!resp.ok) { setError(j.error || t.errGeneric); setBusy(false); return; }
      setDone({ confirmation: j.confirmation, priorityCheckin: j.priorityCheckin, emailStatus: j.emailStatus, clinic: clinic ? `${clinic.name} — ${clinic.address}` : undefined, intakeToken: j.intakeToken });
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
        {done.clinic && <p className="text-sm font-medium text-slate-700 mb-1" data-testid="booking-done-clinic">{t.bookingAt}: {done.clinic}</p>}
        <p className="text-sm text-slate-500">{t.contactSoon}</p>
        {done.emailStatus === "sent" && <p className="text-sm text-emerald-600 mt-1">{t.emailSent}</p>}
        {done.intakeToken && <BookingIntake token={done.intakeToken} lang={lang} />}
        <a href="/" className="btn-primary inline-block mt-4">{t.home}</a>
      </div>
    );
  }

  const clinicBanner = (
    <div className="max-w-3xl mx-auto mb-4 rounded-xl bg-white ring-1 ring-slate-200 p-3 flex flex-wrap items-center gap-3" data-testid="booking-clinic">
      <span className="text-sm font-semibold text-slate-800">{t.clinic}:</span>
      <select data-testid="booking-clinic-select" className="input flex-1 min-w-[240px]" value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
        <option value="">{t.clinicPick}</option>
        {CLINIC_LOCATIONS.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.street}, {c.suite}, {c.cityLine}</option>)}
      </select>
      {clinic && <a href={`tel:+1${clinic.phones[0].replace(/\D/g, "")}`} className="text-sm text-brand-700 font-medium hover:underline">{clinic.phones[0]}</a>}
    </div>
  );

  if (mode === "choice") {
    return (
      <>
      {clinicBanner}
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
      </>
    );
  }

  const services = mode === "new" ? SERVICES[lang].new : SERVICES[lang].existing;

  return (
    <>
    {clinicBanner}
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
          <label className="block"><span className="label">{t.zip}</span><input className="input" inputMode="numeric" maxLength={5} autoComplete="postal-code" value={form.postalCode || ""} onChange={(e) => set("postalCode", e.target.value)} /></label>
        </>)}
        <label className="block"><span className="label">{t.first}</span><input className="input" value={form.firstName || ""} onChange={(e) => set("firstName", e.target.value)} /></label>
        <label className="block"><span className="label">{t.last}</span><input className="input" value={form.lastName || ""} onChange={(e) => set("lastName", e.target.value)} /></label>
        {mode === "existing" && <div className="sm:col-span-2"><button type="button" className="btn-secondary text-sm" disabled={lookupBusy} onClick={lookupPatient}>{t.lookup}</button>{lookupFound && <p role="status" className="mt-2 text-sm text-emerald-700">{t.lookupOk}</p>}</div>}
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
        <label className="block"><span className="label">{t.prefDate}</span><input type="date" className="input" value={form.preferredDate || ""} onChange={(e) => setForm((current) => ({ ...current, preferredDate: e.target.value, preferredTime: "" }))} /></label>
        <label className="block"><span className="label">{t.prefTime}</span><select className="input" value={form.preferredTime || ""} onChange={(e) => set("preferredTime", e.target.value)}><option value="">{t.selectTime}</option>{slots.map((slot) => <option key={slot.time} value={slot.time} disabled={!slot.available}>{slot.time}{!slot.available ? ` — ${t.booked}` : ""}</option>)}</select>{availabilityError && <span className="text-sm text-rose-700">{t.availabilityError}</span>}</label>
        <label className="block sm:col-span-2"><span className="label">{t.notes}</span><textarea className="input" rows={3} value={form.message || ""} onChange={(e) => set("message", e.target.value)} /></label>
      </div>

      {error && <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 p-3 text-sm text-rose-700 mt-3">{error}</div>}

      <button disabled={busy} onClick={() => submit(mode as "new" | "existing")} className="btn-primary w-full mt-4">
        {busy ? t.submitting : t.submit}
      </button>
    </div>
    </>
  );
}
