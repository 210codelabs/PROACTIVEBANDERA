"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ----------------------------- i18n helpers ----------------------------- */
function useLang() {
  return useMemo<"es" | "en">(() => {
    if (typeof navigator === "undefined") return "en";
    return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
  }, []);
}

/* ----------------------------- Slideshow data ---------------------------- */
type Slide = { img: string; kicker: [string, string]; title: [string, string]; text: [string, string] };
const SLIDES: Slide[] = [
  {
    img: "/hero-slide-1.jpg",
    kicker: ["WELCOME TO PROACTIVE CLINIC", "BIENVENIDO A PROACTIVE CLINIC"],
    title: ["Comprehensive Care, Personalized for You", "Atención integral, personalizada para ti"],
    text: [
      "Primary care, rehabilitation, pain management & wellness — all under one roof in San Antonio.",
      "Atención primaria, rehabilitación, manejo del dolor y bienestar — todo bajo un mismo techo en San Antonio.",
    ],
  },
  {
    img: "/svc-6.jpg",
    kicker: ["CONNECTED CARE", "ATENCIÓN CONECTADA"],
    title: ["Telehealth & Virtual Visits", "Telesalud y visitas virtuales"],
    text: [
      "See your provider from anywhere with secure, HIPAA-compliant video visits.",
      "Consulta a tu proveedor desde cualquier lugar con videollamadas seguras y conformes con HIPAA.",
    ],
  },
  {
    img: "/svc-2.jpg",
    kicker: ["RECOVER STRONGER", "RECUPÉRATE MEJOR"],
    title: ["Advanced Physical Rehabilitation", "Rehabilitación física avanzada"],
    text: [
      "Licensed therapists and evidence-based recovery plans tailored to you.",
      "Terapeutas licenciados y planes de recuperación basados en evidencia, hechos a tu medida.",
    ],
  },
  {
    img: "/hero-slide-3.jpg",
    kicker: ["YOUR DATA, PROTECTED", "TUS DATOS, PROTEGIDOS"],
    title: ["HIPAA-Grade Security & Privacy", "Seguridad y privacidad nivel HIPAA"],
    text: [
      "End-to-end safeguards keep your health information private and secure.",
      "Protecciones de extremo a extremo mantienen tu información de salud privada y segura.",
    ],
  },
  {
    img: "/svc-1.jpg",
    kicker: ["TOOLS FOR EVERYONE", "HERRAMIENTAS PARA TODOS"],
    title: ["Patient Portal & Attorney Portal", "Portal del paciente y portal de abogados"],
    text: [
      "Patients manage appointments & records; partners and attorneys access authorized documents securely.",
      "Los pacientes gestionan citas y expedientes; socios y abogados acceden a documentos autorizados de forma segura.",
    ],
  },
];

type Tab = "kiosk" | "portal" | "admission";

export default function KioskPage() {
  const lang = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);

  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState<Tab>("kiosk");
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Slideshow autoplay (only on kiosk tab and not paused)
  useEffect(() => {
    if (tab !== "kiosk" || paused) return;
    timer.current = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 6000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [tab, paused]);

  async function enterKiosk() {
    try { await document.documentElement.requestFullscreen?.(); } catch {}
    setEntered(true);
    setTab("kiosk");
    setPaused(false);
  }

  async function exitKiosk() {
    // Close any open sessions in this browser (best-effort), clear storage, leave fullscreen.
    for (const url of ["/api/auth/logout", "/api/portal/auth/logout"]) {
      try { await fetch(url, { method: "POST" }); } catch {}
      try { await fetch(url, { method: "GET" }); } catch {}
    }
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
    window.location.href = "/";
  }

  /* --------------------------- Entry splash screen -------------------------- */
  if (!entered) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 text-white p-6">
        <div className="text-center max-w-lg">
          <img src="/pclinic-footer.png?v=2" alt="Proactive Clinic" className="h-20 sm:h-24 w-auto mx-auto mb-8 object-contain" />
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">{t("Welcome", "Bienvenido")}</h1>
          <p className="text-white/80 mb-8">
            {t(
              "Tap below to start the on-screen experience: browse our services, complete your intake and HIPAA documents, or open the patient portal.",
              "Toca abajo para iniciar la experiencia en pantalla: explora nuestros servicios, completa tu admisión y documentos HIPAA, o abre el portal del paciente.",
            )}
          </p>
          <button
            onClick={enterKiosk}
            className="inline-flex items-center gap-3 rounded-full bg-white text-brand-800 px-8 py-4 text-lg font-bold shadow-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-white/20"
          >
            <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M9 5l3 3m-3-3v6h6" /></svg>
            {t("Start Kiosk Mode", "Iniciar Modo Kiosco")}
          </button>
          <div className="mt-6">
            <a href="/" className="text-sm text-white/60 hover:text-white underline">{t("Back to website", "Volver al sitio")}</a>
          </div>
        </div>
      </div>
    );
  }

  const cur = SLIDES[slide];
  const tabBtn = (id: Tab, label: string) =>
    (
      <button
        key={id}
        onClick={() => { setTab(id); if (id !== "kiosk") setPaused(true); }}
        className={`px-4 sm:px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
          tab === id ? "bg-white text-brand-800 shadow" : "text-white/85 hover:bg-white/10"
        }`}
      >
        {label}
      </button>
    );

  /* ------------------------------- Kiosk shell ------------------------------ */
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-brand-950 text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-brand-900/80 backdrop-blur border-b border-white/10">
        <img src="/pclinic-footer.png?v=2" alt="Proactive Clinic" className="h-9 sm:h-11 w-auto object-contain" />
        <nav className="hidden sm:flex items-center gap-1.5">
          {tabBtn("kiosk", "ProactiveKIOSK")}
          {tabBtn("admission", t("Admission & HIPAA", "Admisión & HIPAA"))}
          {tabBtn("portal", t("Patient Portal", "Portal del Paciente"))}
        </nav>
        <button
          onClick={exitKiosk}
          className="inline-flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-bold shadow transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" /></svg>
          {t("Exit", "Salir")}
        </button>
      </header>

      {/* Mobile tabs */}
      <nav className="sm:hidden flex items-center gap-1.5 px-3 py-2 bg-brand-900/60 overflow-x-auto">
        {tabBtn("kiosk", "ProactiveKIOSK")}
        {tabBtn("admission", "HIPAA")}
        {tabBtn("portal", t("Portal", "Portal"))}
      </nav>

      <main className="flex-1 min-h-0 overflow-auto">
        {tab === "kiosk" && (
          <KioskSlideshow
            slide={cur}
            index={slide}
            total={SLIDES.length}
            lang={lang}
            paused={paused}
            onToggle={() => setPaused((p) => !p)}
            onGoto={(i) => setSlide(i)}
            onOpenTab={(id) => { setTab(id); setPaused(true); }}
            onExit={exitKiosk}
            t={t}
          />
        )}
        {tab === "admission" && <AdmissionForm lang={lang} t={t} />}
        {tab === "portal" && <PortalPanel t={t} />}
      </main>
    </div>
  );
}

/* ------------------------------- Slideshow ------------------------------- */
function KioskSlideshow({
  slide, index, total, lang, paused, onToggle, onGoto, onOpenTab, onExit, t,
}: {
  slide: Slide; index: number; total: number; lang: "es" | "en"; paused: boolean;
  onToggle: () => void; onGoto: (i: number) => void; onOpenTab: (id: Tab) => void; onExit: () => void;
  t: (en: string, es: string) => string;
}) {
  const li = lang === "es" ? 1 : 0;
  return (
    <div className="relative h-full w-full cursor-pointer select-none" onClick={onToggle}>
      {/* Background image */}
      <img src={slide.img} alt="" className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700" key={slide.img} />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/60 to-brand-950/20" />

      {/* Dynamic text */}
      <div className="absolute inset-x-0 bottom-0 p-8 sm:p-14 max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-600/90 px-4 py-1.5 text-xs font-bold uppercase tracking-wide mb-4">
          <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
          {slide.kicker[li]}
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight drop-shadow mb-3">{slide.title[li]}</h2>
        <p className="text-lg sm:text-xl text-white/90 max-w-3xl">{slide.text[li]}</p>
      </div>

      {/* Progress dots */}
      <div className="absolute top-5 right-6 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => onGoto(i)}
            className={`h-2 rounded-full transition-all ${i === index ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/70"}`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Tap hint */}
      {!paused && (
        <div className="absolute top-5 left-6 text-xs font-medium text-white/70 bg-black/20 rounded-full px-3 py-1.5">
          {t("Tap anywhere for the menu", "Toca en cualquier parte para el menú")}
        </div>
      )}

      {/* Paused menu overlay */}
      {paused && (
        <div className="absolute inset-0 grid place-items-center bg-brand-950/80 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
          <div className="text-center max-w-md w-full px-6">
            <img src="/pclinic-footer.png?v=2" alt="Proactive Clinic" className="h-14 w-auto mx-auto mb-6 object-contain" />
            <h3 className="text-2xl font-bold mb-6">{t("Kiosk Menu", "Menú del Kiosco")}</h3>
            <div className="grid gap-3">
              <button onClick={onToggle} className="rounded-xl bg-white text-brand-800 px-5 py-3 font-bold hover:-translate-y-0.5 transition-all">
                {t("Resume presentation", "Reanudar presentación")}
              </button>
              <button onClick={() => onOpenTab("admission")} className="rounded-xl bg-brand-600 hover:bg-brand-700 px-5 py-3 font-bold transition">
                {t("Start Admission & HIPAA", "Iniciar Admisión & HIPAA")}
              </button>
              <button onClick={() => onOpenTab("portal")} className="rounded-xl bg-white/10 hover:bg-white/20 px-5 py-3 font-bold transition">
                {t("Open Patient Portal", "Abrir Portal del Paciente")}
              </button>
              <button onClick={onExit} className="mt-2 rounded-xl bg-red-600 hover:bg-red-700 px-5 py-3 font-bold transition">
                {t("Exit Kiosk Mode", "Salir del Modo Kiosco")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Portal panel ----------------------------- */
function PortalPanel({ t }: { t: (en: string, es: string) => string }) {
  return (
    <div className="h-full grid place-items-center p-6">
      <div className="max-w-lg text-center bg-white/5 ring-1 ring-white/10 rounded-2xl p-8">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand-600">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">{t("Patient Portal", "Portal del Paciente")}</h2>
        <p className="text-white/75 mb-6">
          {t(
            "Access your appointments, messages, results and records with your Medical Record Number and date of birth.",
            "Accede a tus citas, mensajes, resultados y expedientes con tu Número de Expediente y fecha de nacimiento.",
          )}
        </p>
        <a href="/portal/login" className="inline-flex items-center gap-2 rounded-full bg-white text-brand-800 px-6 py-3 font-bold hover:-translate-y-0.5 transition-all">
          {t("Open Patient Portal", "Abrir Portal del Paciente")}
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </a>
      </div>
    </div>
  );
}

/* ---------------------------- Admission + HIPAA --------------------------- */
function AdmissionForm({ lang, t }: { lang: "es" | "en"; t: (en: string, es: string) => string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ confirmation: string; mrn: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    body.hipaaConsent = fd.get("hipaaConsent") ? "true" : "";
    if (!body.hipaaConsent) { setError(t("Please acknowledge the HIPAA notice.", "Por favor confirma el aviso HIPAA.")); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/kiosk/intake", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Error"); return; }
      setDone({ confirmation: json.confirmation, mrn: json.mrn });
    } catch {
      setError(t("Network error. Please try again.", "Error de red. Intenta de nuevo."));
    } finally { setLoading(false); }
  }

  if (done) {
    return (
      <div className="h-full grid place-items-center p-6">
        <div className="max-w-lg w-full text-center bg-white text-slate-900 rounded-2xl p-8 shadow-2xl">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">{t("Check-in complete", "Admisión completada")}</h2>
          <p className="text-slate-600 mb-4">
            {t("Your intake and HIPAA acknowledgement were saved to your record. Please take a seat — the front desk has been notified.",
               "Tu admisión y consentimiento HIPAA se guardaron en tu expediente. Toma asiento — la recepción ha sido notificada.")}
          </p>
          <div className="inline-flex flex-col gap-1 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-6 py-4">
            <span className="text-xs uppercase tracking-wide text-slate-400">{t("Confirmation", "Confirmación")}</span>
            <span className="text-xl font-mono font-bold text-brand-700">{done.confirmation}</span>
            <span className="text-xs text-slate-500">MRN: {done.mrn}</span>
          </div>
          <div className="mt-6">
            <button onClick={() => setDone(null)} className="text-sm font-semibold text-brand-700 hover:text-brand-900 underline">
              {t("New check-in", "Nueva admisión")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-8">
      <form onSubmit={onSubmit} className="max-w-3xl mx-auto bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <h2 className="text-2xl font-bold mb-1">{t("Patient Self Check-in", "Auto-Admisión del Paciente")}</h2>
        <p className="text-sm text-slate-500 mb-6">
          {t("Complete your intake and HIPAA documentation. It will be saved directly to your Proactive Clinic record.",
             "Completa tu admisión y documentación HIPAA. Se guardará directamente en tu expediente de Proactive Clinic.")}
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <K label={t("First name", "Nombre")}><input name="firstName" required className="input" /></K>
          <K label={t("Last name", "Apellido")}><input name="lastName" required className="input" /></K>
          <K label={t("Date of birth", "Fecha de nacimiento")}><input name="dob" type="date" required className="input" /></K>
          <K label={t("Sex", "Sexo")}>
            <select name="sex" className="input" defaultValue="">
              <option value="">—</option><option value="M">{t("Male","Masculino")}</option>
              <option value="F">{t("Female","Femenino")}</option><option value="X">{t("Other","Otro")}</option>
            </select>
          </K>
          <K label={t("Phone", "Teléfono")}><input name="phone" type="tel" className="input" /></K>
          <K label={t("Email", "Correo")}><input name="email" type="email" className="input" /></K>
          <K label={t("Care module", "Módulo de atención")}>
            <select name="module" className="input" defaultValue="ProactiveMed">
              <option value="ProactiveMed">ProactiveMed (Medical)</option>
              <option value="Physical Rehabilitation">{t("Physical Rehabilitation","Rehabilitación Física")}</option>
            </select>
          </K>
          <K label={t("Reason for visit", "Motivo de la visita")}><input name="reason" className="input" /></K>
        </div>

        {/* HIPAA notice */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="font-semibold text-slate-800 mb-1">{t("HIPAA Notice of Privacy Practices", "Aviso HIPAA de Prácticas de Privacidad")}</div>
          <p className="text-xs text-slate-600 max-h-28 overflow-auto leading-relaxed">
            {t(
              "Proactive Clinic (a Division of Proactive UMS Inc.) is committed to protecting your health information under HIPAA. Your information is used to provide treatment, obtain payment, and support healthcare operations, and is shared only as permitted or required by law. By signing below you acknowledge you have received and understand this Notice and consent to the electronic capture of your intake information into your medical record.",
              "Proactive Clinic (una División de Proactive UMS Inc.) se compromete a proteger tu información de salud conforme a HIPAA. Tu información se usa para brindar tratamiento, obtener pago y apoyar operaciones de salud, y se comparte solo según lo permitido o requerido por la ley. Al firmar abajo, reconoces que recibiste y entiendes este Aviso y consientes la captura electrónica de tu información de admisión en tu expediente médico.",
            )}
          </p>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" name="hipaaConsent" className="mt-0.5 h-4 w-4" />
            <span>{t("I acknowledge and consent to the HIPAA Notice above.", "Reconozco y consiento el Aviso HIPAA anterior.")}</span>
          </label>
        </div>

        <K label={t("Electronic signature (type full legal name)", "Firma electrónica (escribe tu nombre legal completo)")} className="mt-4">
          <input name="signature" required className="input font-[cursive] text-lg" placeholder={t("Your full name", "Tu nombre completo")} />
        </K>

        {error && <div className="mt-4 rounded-lg bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>}

        <button disabled={loading} className="mt-6 w-full rounded-full bg-brand-700 hover:bg-brand-800 text-white font-bold py-3 shadow transition-all hover:-translate-y-0.5 disabled:opacity-50">
          {loading ? t("Submitting…", "Enviando…") : t("Submit Check-in", "Enviar Admisión")}
        </button>
      </form>
    </div>
  );
}

function K({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
