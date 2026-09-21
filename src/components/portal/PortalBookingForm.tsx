"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CLINIC_OPEN_TIME, CLINIC_CLOSE_TIME, CLINIC_HOURS_LABEL, formatClinic, clinicDayKey } from "@/lib/clinic";
import ClinicTZBadge from "@/components/ClinicTZBadge";

type Service = { id: string; name: string; category: string };

function t(lang: "es" | "en", en: string, es: string) {
  return lang === "es" ? es : en;
}

export default function PortalBookingForm({ services }: { services: Service[] }) {
  const router = useRouter();
  const lang = useMemo<"es" | "en">(() => {
    if (typeof navigator === "undefined") return "en";
    return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
  }, []);

  const [open, setOpen] = useState(false);
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("in-office");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<null | { number: string; when: string; location: string; service: string }>(null);

  const today = clinicDayKey(new Date());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/portal/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceTypeId: serviceTypeId || null, date, time, location, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t(lang, "Could not submit your request.", "No se pudo enviar tu solicitud."));
        return;
      }
      const svc = services.find((s) => s.id === serviceTypeId);
      const locLabel = location === "telehealth" ? t(lang, "Telehealth", "Telesalud") : location === "home-visit" ? t(lang, "Home visit", "Visita a domicilio") : t(lang, "In-office", "En consultorio");
      const whenStr = formatClinic(`${date}T${time}`, { dateStyle: "full", timeStyle: "short" }, lang === "es" ? "es-US" : "en-US");
      setConfirmation({
        number: data.confirmationNumber || "PC-CONFIRMED",
        when: whenStr,
        location: locLabel,
        service: svc?.name || t(lang, "General visit", "Consulta general"),
      });
      setReason("");
      setDate("");
      setTime("");
      setServiceTypeId("");
      setOpen(false);
      router.refresh();
    } catch {
      setError(t(lang, "Network error. Please try again.", "Error de red. Intenta de nuevo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white shadow-sm mb-4 overflow-hidden">
      <header className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 rounded-xl bg-brand-600 grid place-items-center text-white shadow-sm">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" /></svg>
          </span>
          <div>
            <h2 className="font-bold text-brand-900">{t(lang, "Request an Appointment", "Solicitar una cita")}</h2>
            <p className="text-xs text-slate-500">{t(lang, "Tell us when works best — our team will confirm your visit.", "Dinos qué horario te conviene — nuestro equipo confirmará tu visita.")}</p>
            <ClinicTZBadge className="mt-1.5" showHours />
          </div>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn-primary text-sm shrink-0">
          {open ? t(lang, "Close", "Cerrar") : t(lang, "New Request", "Nueva solicitud")}
        </button>
      </header>

      {confirmation && (
        <div className="mx-5 mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <span className="h-10 w-10 shrink-0 rounded-full bg-emerald-600 grid place-items-center text-white">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" /></svg>
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-emerald-900">{t(lang, "Request received!", "¡Solicitud recibida!")}</h3>
              <p className="text-sm text-emerald-800">{t(lang, "Our front desk will confirm your visit shortly. Please save your confirmation number.", "Nuestra recepción confirmará tu visita en breve. Guarda tu número de confirmación.")}</p>
              <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div className="flex items-center gap-2"><span className="text-slate-500">{t(lang, "Confirmation", "Confirmación")}:</span> <span className="font-mono font-bold text-brand-900">{confirmation.number}</span></div>
                <div className="flex items-center gap-2"><span className="text-slate-500">{t(lang, "Service", "Servicio")}:</span> <span className="font-medium text-slate-800">{confirmation.service}</span></div>
                <div className="flex items-center gap-2"><span className="text-slate-500">{t(lang, "When", "Cuándo")}:</span> <span className="font-medium text-slate-800">{confirmation.when}</span></div>
                <div className="flex items-center gap-2"><span className="text-slate-500">{t(lang, "Visit type", "Tipo")}:</span> <span className="font-medium text-slate-800">{confirmation.location}</span></div>
              </div>
              <button type="button" onClick={() => { setConfirmation(null); setOpen(true); }} className="btn-secondary mt-4 text-sm">{t(lang, "Request another", "Solicitar otra")}</button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="px-5 pb-5 grid sm:grid-cols-2 gap-4 border-t border-brand-100 pt-4">
          <label className="text-sm">
            <span className="block font-medium text-slate-700 mb-1">{t(lang, "Service", "Servicio")}</span>
            <select className="input w-full" value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)}>
              <option value="">{t(lang, "General visit", "Consulta general")}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="block font-medium text-slate-700 mb-1">{t(lang, "Visit type", "Tipo de visita")}</span>
            <select className="input w-full" value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="in-office">{t(lang, "In-office", "En consultorio")}</option>
              <option value="telehealth">{t(lang, "Telehealth", "Telesalud")}</option>
              <option value="home-visit">{t(lang, "Home visit", "Visita a domicilio")}</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="block font-medium text-slate-700 mb-1">{t(lang, "Preferred date", "Fecha preferida")}</span>
            <input type="date" min={today} required className="input w-full" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="text-sm">
            <span className="block font-medium text-slate-700 mb-1">{t(lang, "Preferred time", "Hora preferida")}</span>
            <input type="time" required min={CLINIC_OPEN_TIME} max={CLINIC_CLOSE_TIME} step={900} className="input w-full" value={time} onChange={(e) => setTime(e.target.value)} />
            <span className="block text-[11px] text-slate-400 mt-1">{t(lang, `Clinic hours: ${CLINIC_HOURS_LABEL}`, `Horario: 9:00 AM – 8:00 PM (hora del Centro)`)}</span>
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="block font-medium text-slate-700 mb-1">{t(lang, "Reason / notes (optional)", "Motivo / notas (opcional)")}</span>
            <textarea className="input w-full" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t(lang, "e.g. follow-up for knee pain", "ej. seguimiento por dolor de rodilla")} />
          </label>

          {error && <div className="sm:col-span-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</div>}

          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? t(lang, "Submitting...", "Enviando...") : t(lang, "Submit Request", "Enviar solicitud")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
