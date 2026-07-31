"use client";

import { useEffect, useMemo, useState } from "react";

const SLIDES = ["/hero-slide-1.jpg", "/hero-proactive.png", "/hero-slide-2.jpg", "/hero-slide-3.jpg"];

function useLang() {
  return useMemo<"es" | "en">(() => {
    if (typeof navigator === "undefined") return "en";
    return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
  }, []);
}

function tt(lang: "es" | "en", en: string, es: string) {
  return lang === "es" ? es : en;
}

type HeroAuthProps = {
  heading: string;
  accent: string;
  tagline: string;
  subtitle: string;
  chips: string[];
};

export default function HeroAuth({ heading, accent, tagline, subtitle, chips }: HeroAuthProps) {
  const lang = useLang();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative overflow-hidden">
      {/* Slideshow background */}
      <div className="absolute inset-0">
        {SLIDES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-[1200ms] ease-in-out"
            style={{ opacity: i === slide ? 1 : 0 }}
          >
            <img src={src} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
        {/* Blue readability scrim */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-950/90 via-brand-900/70 to-brand-900/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* Left: copy */}
          <div className="text-white">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wide shadow-md mb-5">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              {tt(lang, "Now Accepting New Patients", "Aceptando nuevos pacientes")}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.04] tracking-tight">
              {heading}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-200 to-white">{accent}</span>
            </h1>
            <div className="flex items-center gap-3 mt-4">
              <span className="h-1.5 w-12 rounded-full bg-emerald-400" />
              <p className="text-lg sm:text-xl font-semibold text-brand-100">{tagline}</p>
            </div>
            <p className="mt-4 text-base sm:text-lg text-brand-50/90 max-w-xl leading-relaxed">{subtitle}</p>

            {/* Trust chips */}
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl">
              {chips.map((c, i) => (
                <div key={c} className="flex items-center gap-2.5 rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/15 px-3 py-2.5">
                  <span className={`h-8 w-8 shrink-0 rounded-lg grid place-items-center text-white ${["bg-brand-500", "bg-emerald-500", "bg-red-500"][i % 3]}`}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-white leading-tight">{c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: tabbed auth card */}
          <div className="lg:justify-self-end w-full max-w-md">
            <AuthCard lang={lang} />
          </div>
        </div>
      </div>
    </section>
  );
}

function AuthCard({ lang }: { lang: "es" | "en" }) {
  const [tab, setTab] = useState<"portal" | "staff">("portal");

  // Portal state
  const [mrn, setMrn] = useState("");
  const [dob, setDob] = useState("");
  // Staff state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submitPortal(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mrn, dob }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || tt(lang, "Unable to sign in.", "No se pudo iniciar sesión."));
        setBusy(false);
        return;
      }
      window.location.assign("/portal/dashboard");
    } catch {
      setError(tt(lang, "Portal is temporarily unavailable.", "El portal no está disponible temporalmente."));
      setBusy(false);
    }
  }

  async function submitStaff(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || tt(lang, "Invalid email or password.", "Correo o contraseña inválidos."));
        setBusy(false);
        return;
      }
      window.location.assign("/dashboard");
    } catch {
      setError(tt(lang, "Login is temporarily unavailable.", "El inicio de sesión no está disponible."));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
      {/* Tabs */}
      <div className="grid grid-cols-2">
        <button
          type="button"
          onClick={() => { setTab("portal"); setError(""); }}
          className={`flex items-center justify-center gap-2 py-4 text-sm font-bold transition ${tab === "portal" ? "bg-brand-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          {tt(lang, "Patient Portal", "Portal del Paciente")}
        </button>
        <button
          type="button"
          onClick={() => { setTab("staff"); setError(""); }}
          className={`flex items-center justify-center gap-2 py-4 text-sm font-bold transition ${tab === "staff" ? "bg-brand-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0M13 7a4 4 0 11-2 0" /></svg>
          {tt(lang, "Staff Access", "Acceso Personal")}
        </button>
      </div>

      <div className="p-6 sm:p-7">
        <h2 className="text-2xl font-extrabold text-brand-900 text-center">{tt(lang, "Welcome Back!", "¡Bienvenido!")}</h2>
        <p className="text-sm text-slate-500 text-center mt-1">
          {tab === "portal"
            ? tt(lang, "Login to access your health information", "Ingresa para acceder a tu información de salud")
            : tt(lang, "Sign in to the staff EHR workspace", "Ingresa al área de personal del EHR")}
        </p>

        {error && <div className="mt-4 rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>}

        {tab === "portal" ? (
          <form onSubmit={submitPortal} className="mt-5 space-y-4">
            <Field icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z">
              <input className="hero-input" placeholder={tt(lang, "Medical Record Number (e.g. PC-100000)", "N.º de expediente (ej. PC-100000)")} value={mrn} onChange={(e) => setMrn(e.target.value)} required suppressHydrationWarning />
            </Field>
            <Field icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z">
              <input type="date" className="hero-input" value={dob} onChange={(e) => setDob(e.target.value)} required suppressHydrationWarning />
            </Field>
            <button className="btn-primary w-full py-3 text-base" disabled={busy} suppressHydrationWarning>
              {busy ? tt(lang, "Signing in...", "Ingresando...") : tt(lang, "Login", "Ingresar")}
            </button>
            <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />{tt(lang, "or", "o")}<span className="h-px flex-1 bg-slate-200" /></div>
            <a href="tel:+13055550148" className="btn-secondary w-full py-3 text-center block">{tt(lang, "New patient? Call to register", "¿Paciente nuevo? Llama para registrarte")}</a>
            <p className="text-[11px] text-slate-400 text-center">{tt(lang, "Demo:", "Demo:")} PC-100000 · 1958-04-12</p>
          </form>
        ) : (
          <form onSubmit={submitStaff} className="mt-5 space-y-4">
            <Field icon="M16 12a4 4 0 10-8 0 4 4 0 008 0zM12 14v7m-7 0h14">
              <input type="email" className="hero-input" placeholder={tt(lang, "Work email", "Correo de trabajo")} value={email} onChange={(e) => setEmail(e.target.value)} required suppressHydrationWarning />
            </Field>
            <Field icon="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z">
              <div className="flex items-center w-full">
                <input type={showPw ? "text" : "password"} className="hero-input pr-8" placeholder={tt(lang, "Password", "Contraseña")} value={password} onChange={(e) => setPassword(e.target.value)} required suppressHydrationWarning />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="-ml-7 text-slate-400 hover:text-slate-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
              </div>
            </Field>
            <button className="btn-primary w-full py-3 text-base" disabled={busy} suppressHydrationWarning>
              {busy ? tt(lang, "Signing in...", "Ingresando...") : tt(lang, "Login", "Ingresar")}
            </button>
            <p className="text-[11px] text-slate-400 text-center">{tt(lang, "Demo:", "Demo:")} andy.manzano@proactiveclinic.com · apex123</p>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg ring-1 ring-slate-200 bg-white px-3 focus-within:ring-2 focus-within:ring-brand-500 transition">
      <svg className="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={icon} /></svg>
      {children}
    </div>
  );
}
