"use client";

import { useState } from "react";
import { bookingIntakeText } from "@/lib/bookingIntakeText";

export default function BookingIntake({ token, lang }: { token: string; lang: "en" | "es" }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const es = lang === "es";
  const text = bookingIntakeText[lang];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/appointments/request/intake", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, lang, signature: form.get("signature"), insurance: form.get("insurance"), medicalHistory: form.get("medicalHistory"), medications: form.get("medications"), allergies: form.get("allergies"), privacyAcknowledged: form.has("privacyAcknowledged"), treatmentConsent: form.has("treatmentConsent"), insuranceConsent: form.has("insuranceConsent"), reviewAcknowledged: form.has("reviewAcknowledged") }),
      });
      if (!response.ok) throw new Error();
      setDone(true);
    } catch {
      setError(es ? "No se pudo enviar el formulario. Comuníquese con la clínica." : "Could not submit the form. Please contact the clinic.");
    } finally { setBusy(false); }
  }

  if (done) return <p role="status" className="mt-5 text-sm font-semibold text-emerald-700">{es ? "Formulario enviado para revisión en su visita." : "Form submitted for review at your visit."}</p>;

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 border-t border-slate-200 pt-5 text-left">
      <h3 className="text-lg font-bold text-slate-900">{es ? "Datos y consentimiento del paciente nuevo" : "New patient information and consent"}</h3>
      <label className="block"><span className="label">{es ? "Seguro: aseguradora y número de miembro" : "Insurance: insurer and member number"}</span><textarea name="insurance" className="input" rows={2} maxLength={500} /></label>
      <label className="block"><span className="label">{es ? "Historial médico" : "Medical history"}</span><textarea name="medicalHistory" className="input" rows={3} maxLength={4000} /></label>
      <label className="block"><span className="label">{es ? "Medicamentos" : "Medications"}</span><textarea name="medications" className="input" rows={2} maxLength={2000} /></label>
      <label className="block"><span className="label">{es ? "Alergias" : "Allergies"}</span><textarea name="allergies" className="input" rows={2} maxLength={2000} /></label>
      <a href="/legal/hipaa" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand-700 underline">{es ? "Aviso de Prácticas de Privacidad" : "Notice of Privacy Practices"}</a>
      {([["privacyAcknowledged", text.privacy], ["treatmentConsent", text.treatment], ["insuranceConsent", text.insurance], ["reviewAcknowledged", text.review]] as const).map(([name, label]) => (
        <label key={name} className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" name={name} required className="mt-1" /><span>{label}</span></label>
      ))}
      <label className="block"><span className="label">{es ? "Firma electrónica (nombre completo)" : "Electronic signature (full name)"}</span><input name="signature" className="input" required minLength={2} maxLength={120} /></label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? (es ? "Enviando…" : "Submitting…") : (es ? "Enviar formulario" : "Submit form")}</button>
    </form>
  );
}