"use client";
import { useEffect, useMemo, useState } from "react";

type Req = { id: string; patientMrn: string; patientLastName: string; reason: string | null; status: string; createdAt: string };

export default function AttorneyPortal() {
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<{ name: string; firm: string | null; email: string } | null>(null);
  const [requests, setRequests] = useState<Req[]>([]);
  const [error, setError] = useState("");

  const lang = useMemo<"es" | "en">(() => (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es") ? "es" : "en"), []);
  const t = (en: string, es: string) => (lang === "es" ? es : en);

  async function refresh() {
    const res = await fetch("/api/attorney/requests");
    if (res.status === 401) { setAuth(null); setReady(true); return; }
    const json = await res.json();
    setAuth(json.attorney); setRequests(json.requests || []); setReady(true);
  }
  useEffect(() => { refresh(); }, []);

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/attorney/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(fd.entries())) });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Login failed"); return; }
    await refresh();
  }
  async function logout() { await fetch("/api/attorney/auth/logout", { method: "POST" }); setAuth(null); setRequests([]); }

  async function submitReq(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/attorney/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(fd.entries())) });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Could not submit"); return; }
    form.reset(); await refresh();
  }

  const badge = (s: string) => s === "approved" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : s === "denied" ? "bg-rose-100 text-rose-700 ring-rose-200" : "bg-amber-100 text-amber-800 ring-amber-200";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-brand-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <a href="/" className="inline-flex"><img src="/pclinic-footer.png?v=2" alt="Proactive Clinic" className="h-11 w-auto object-contain" /></a>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-white/80">{t("Attorney Portal", "Portal de Abogados")}</span>
            {auth && <button onClick={logout} className="rounded-full bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-semibold">{t("Sign out", "Cerrar sesión")}</button>}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {!ready ? (
          <div className="text-slate-400">Loading…</div>
        ) : !auth ? (
          <div className="max-w-md mx-auto card card-pad">
            <h1 className="text-xl font-bold text-slate-900 mb-1">{t("Attorney Sign In", "Ingreso de Abogados")}</h1>
            <p className="text-sm text-slate-500 mb-5">{t("Authorized legal partners can request and download patient records securely.", "Socios legales autorizados pueden solicitar y descargar expedientes de pacientes de forma segura.")}</p>
            <form onSubmit={login} className="space-y-3">
              <label className="block"><span className="label">{t("Email", "Correo")}</span><input name="email" type="email" required className="input" /></label>
              <label className="block"><span className="label">{t("Access code", "Código de acceso")}</span><input name="accessCode" required className="input" /></label>
              {error && <div className="rounded bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>}
              <button className="btn-primary w-full">{t("Sign In", "Ingresar")}</button>
            </form>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <section className="lg:col-span-1 card card-pad h-fit">
              <h2 className="font-semibold text-slate-900 mb-1">{t("New records request", "Nueva solicitud de expediente")}</h2>
              <p className="text-xs text-slate-500 mb-4">{t("Signed in as", "Sesión de")} {auth.name}{auth.firm ? ` · ${auth.firm}` : ""}</p>
              <form onSubmit={submitReq} className="space-y-3">
                <label className="block"><span className="label">{t("Patient MRN", "MRN del paciente")}</span><input name="patientMrn" required className="input font-mono" placeholder="PC-100000" /></label>
                <label className="block"><span className="label">{t("Patient last name", "Apellido del paciente")}</span><input name="patientLastName" required className="input" /></label>
                <label className="block"><span className="label">{t("Reason / matter", "Motivo / caso")}</span><textarea name="reason" rows={3} className="input" /></label>
                {error && <div className="rounded bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>}
                <button className="btn-primary w-full">{t("Submit request", "Enviar solicitud")}</button>
              </form>
            </section>
            <section className="lg:col-span-2 card">
              <header className="px-4 py-3 border-b border-slate-200 font-semibold">{t("My requests", "Mis solicitudes")} ({requests.length})</header>
              <table className="data">
                <thead><tr><th>{t("Patient", "Paciente")}</th><th>{t("Reason", "Motivo")}</th><th>{t("Status", "Estado")}</th><th className="text-right">{t("Records", "Expediente")}</th></tr></thead>
                <tbody>
                  {requests.length === 0 && <tr><td colSpan={4} className="p-6 text-sm text-slate-500">{t("No requests yet.", "Aún no hay solicitudes.")}</td></tr>}
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td><div className="font-mono text-xs">{r.patientMrn}</div><div className="text-xs text-slate-500">{r.patientLastName}</div></td>
                      <td className="text-xs max-w-[220px]">{r.reason || "—"}</td>
                      <td><span className={`chip ${badge(r.status)} capitalize`}>{r.status}</span></td>
                      <td className="text-right">
                        {r.status === "approved"
                          ? <a href={`/api/attorney/requests/${r.id}/download`} className="text-brand-700 font-semibold text-xs hover:text-brand-900">{t("Download", "Descargar")}</a>
                          : <span className="text-xs text-slate-400">{t("Pending approval", "Pendiente")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
