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
type Bi = [string, string]; // [en, es]
type Feature = { icon: string; label: Bi; sub: Bi };
type Slide =
  | { kind: "photo"; img: string; kicker: Bi; title: Bi; text: Bi; bullets: Bi[] }
  | { kind: "flyer"; img: string; alt: string }
  | {
      kind: "flyerad";
      photo: string;
      accent: "blue" | "red" | "teal" | "green";
      titleA: Bi;
      titleB: Bi;
      tagline: Bi;
      subtitle: Bi;
      desc: Bi;
      features: Feature[];
      cta: Bi;
    }
  | { kind: "ad"; accent: "blue" | "red" | "green" | "teal"; badge: Bi; title: Bi; subtitle: Bi; bullets: Bi[]; cta: Bi };

/* Clinic-wide contact info (San Antonio) */
const CLINIC = {
  phone: "(210) 500-2914",
  web: "proactiveclinics.com",
  city: "San Antonio, TX",
  hours: ["Monday to Sunday · 9:00 AM – 8:00 PM", "Lunes a Domingo · 9:00 AM – 8:00 PM"] as Bi,
  walkins: ["Walk-ins Welcome", "Sin cita — Bienvenidos"] as Bi,
};

/* Reusable SVG path data */
const IC = {
  clip: "M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  lang: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129",
  shield: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  bolt: "M13 10V3L4 14h7v7l9-11h-7",
  heart: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  video: "M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 6h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  spark: "M5 3v4M3 5h4M6 17v4m-2-2h4M13 3l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
};

const SLIDES: Slide[] = [
  {
    kind: "photo",
    img: "/hero-slide-1.jpg",
    kicker: ["WELCOME TO PROACTIVE CLINIC", "BIENVENIDO A PROACTIVE CLINIC"],
    title: ["Comprehensive Care, Personalized for You", "Atención integral, personalizada para ti"],
    text: ["One connected team for your whole family — in San Antonio.", "Un equipo conectado para toda tu familia — en San Antonio."],
    bullets: [
      ["Primary & Preventive Care", "Atención primaria y preventiva"],
      ["Physical Rehabilitation", "Rehabilitación física"],
      ["Pain Management Clinic", "Clínica de manejo del dolor"],
      ["Telehealth & Follow-up", "Telesalud y seguimiento"],
    ],
  },
  { kind: "flyer", img: "/promo-dot.png", alt: "DOT Medical Exams — Same Day. Certified. Bilingual." },
  {
    kind: "flyerad",
    accent: "teal",
    photo: "/flyer-rehab.jpg",
    titleA: ["PHYSICAL", "TERAPIA"],
    titleB: ["THERAPY", "FÍSICA"],
    tagline: ["FEEL STRONG AGAIN", "RECUPERA TU FUERZA"],
    subtitle: ["One-on-one therapy with licensed therapists", "Terapia uno a uno con terapeutas licenciados"],
    desc: [
      "Post-injury and post-surgical recovery plans built around you — restore mobility, strength and confidence.",
      "Planes de recuperación post-lesión y post-quirúrgica hechos a tu medida — recupera movilidad, fuerza y confianza.",
    ],
    features: [
      { icon: IC.clip, label: ["Personalized Plans", "Planes personalizados"], sub: ["Built for your goals", "Según tus metas"] },
      { icon: IC.bolt, label: ["Manual Therapy", "Terapia manual"], sub: ["Hands-on recovery", "Recuperación práctica"] },
      { icon: IC.lang, label: ["Bilingual Care", "Atención bilingüe"], sub: ["English & Spanish", "Inglés y Español"] },
      { icon: IC.heart, label: ["Compassionate Team", "Equipo humano"], sub: ["Here for you", "Contigo siempre"] },
    ],
    cta: ["START YOUR RECOVERY TODAY", "COMIENZA TU RECUPERACIÓN HOY"],
  },
  {
    kind: "flyerad",
    accent: "red",
    photo: "/flyer-pain.jpg",
    titleA: ["PAIN", "MANEJO DEL"],
    titleB: ["MANAGEMENT", "DOLOR"],
    tagline: ["LASTING RELIEF", "ALIVIO DURADERO"],
    subtitle: ["Advanced, non-opioid pain relief", "Alivio avanzado del dolor, sin opioides"],
    desc: [
      "Back, neck and joint pain evaluated and treated with a personalized, evidence-based approach.",
      "Dolor de espalda, cuello y articulaciones evaluado y tratado con un enfoque personalizado basado en evidencia.",
    ],
    features: [
      { icon: IC.clip, label: ["Full Evaluation", "Evaluación completa"], sub: ["Find the source", "Encuentra el origen"] },
      { icon: IC.spark, label: ["Targeted Treatment", "Tratamiento dirigido"], sub: ["Where it hurts", "Donde duele"] },
      { icon: IC.shield, label: ["Non-Opioid Options", "Sin opioides"], sub: ["Safer relief", "Alivio más seguro"] },
      { icon: IC.lang, label: ["Bilingual Care", "Atención bilingüe"], sub: ["English & Spanish", "Inglés y Español"] },
    ],
    cta: ["BOOK A PAIN CONSULT TODAY", "AGENDA UNA CONSULTA HOY"],
  },
  {
    kind: "flyerad",
    accent: "blue",
    photo: "/svc-6.jpg",
    titleA: ["TELEHEALTH", "VISITAS"],
    titleB: ["VISITS", "VIRTUALES"],
    tagline: ["CARE FROM HOME", "ATENCIÓN DESDE CASA"],
    subtitle: ["Secure, HIPAA-compliant video visits", "Videollamadas seguras conforme a HIPAA"],
    desc: [
      "See a provider from anywhere — same-week appointments and prescriptions sent to your pharmacy.",
      "Consulta a un proveedor desde donde estés — citas la misma semana y recetas enviadas a tu farmacia.",
    ],
    features: [
      { icon: IC.video, label: ["Video Visits", "Videoconsultas"], sub: ["From any device", "Desde cualquier equipo"] },
      { icon: IC.clock, label: ["Same-Week Slots", "Citas esta semana"], sub: ["Fast access", "Acceso rápido"] },
      { icon: IC.clip, label: ["e-Prescriptions", "Recetas digitales"], sub: ["Sent to pharmacy", "A tu farmacia"] },
      { icon: IC.lang, label: ["Bilingual Support", "Soporte bilingüe"], sub: ["English & Spanish", "Inglés y Español"] },
    ],
    cta: ["SCHEDULE A VIRTUAL VISIT", "AGENDA UNA VISITA VIRTUAL"],
  },
  {
    kind: "flyerad",
    accent: "green",
    photo: "/flyer-primary.jpg",
    titleA: ["PRIMARY", "ATENCIÓN"],
    titleB: ["CARE", "PRIMARIA"],
    tagline: ["WHOLE-FAMILY CARE", "PARA TODA LA FAMILIA"],
    subtitle: ["Preventive & primary care for every age", "Atención primaria y preventiva a toda edad"],
    desc: [
      "Check-ups, chronic-condition management and preventive care from a team that knows your family.",
      "Chequeos, manejo de enfermedades crónicas y prevención con un equipo que conoce a tu familia.",
    ],
    features: [
      { icon: IC.user, label: ["Family Medicine", "Medicina familiar"], sub: ["Every age", "A toda edad"] },
      { icon: IC.clip, label: ["Annual Check-ups", "Chequeos anuales"], sub: ["Stay ahead", "Prevención"] },
      { icon: IC.activity, label: ["Chronic Care", "Enfermedades crónicas"], sub: ["Ongoing support", "Apoyo continuo"] },
      { icon: IC.shield, label: ["Preventive Care", "Atención preventiva"], sub: ["Screenings", "Detección temprana"] },
    ],
    cta: ["BOOK YOUR CHECK-UP TODAY", "AGENDA TU CHEQUEO HOY"],
  },
  {
    kind: "ad",
    accent: "blue",
    badge: ["YOUR DATA, PROTECTED", "TUS DATOS, PROTEGIDOS"],
    title: ["HIPAA-Grade Security & Privacy", "Seguridad y Privacidad nivel HIPAA"],
    subtitle: ["Your health information stays private, encrypted and yours.", "Tu información de salud permanece privada, cifrada y tuya."],
    bullets: [
      ["Patient Portal — records, results & messages", "Portal del paciente — expedientes, resultados y mensajes"],
      ["Attorney Portal — authorized record requests", "Portal de abogados — solicitudes autorizadas"],
      ["End-to-end safeguards under HIPAA", "Protecciones de extremo a extremo bajo HIPAA"],
    ],
    cta: ["Tap “Patient Portal” to sign in", "Toca “Portal del Paciente” para ingresar"],
  },
];

type Product = { icon: string; name: Bi; desc: Bi; go: Tab };
const PRODUCTS: Product[] = [
  { icon: "M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", name: ["DOT Medical Exams", "Exámenes Médicos DOT"], desc: ["Same-day certified physicals", "Físicos certificados el mismo día"], go: "admission" },
  { icon: "M13 10V3L4 14h7v7l9-11h-7", name: ["Physical Therapy", "Terapia Física"], desc: ["One-on-one recovery therapy", "Terapia de recuperación 1 a 1"], go: "admission" },
  { icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z", name: ["Pain Management", "Manejo del Dolor"], desc: ["Non-opioid pain relief", "Alivio del dolor sin opioides"], go: "admission" },
  { icon: "M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 6h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z", name: ["Telehealth Visits", "Visitas de Telesalud"], desc: ["Secure video appointments", "Videollamadas seguras"], go: "portal" },
  { icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", name: ["Primary Care", "Atención Primaria"], desc: ["Check-ups & preventive care", "Chequeos y prevención"], go: "admission" },
  { icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", name: ["Patient Portal", "Portal del Paciente"], desc: ["Records, results & messages", "Expedientes, resultados y mensajes"], go: "portal" },
];

type Tab = "kiosk" | "portal" | "admission";

export default function KioskPage() {
  const lang = useLang();
  const t = (en: string, es: string) => (lang === "es" ? es : en);

  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState<Tab>("kiosk");
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Slideshow autoplay (only on kiosk tab and not paused)
  useEffect(() => {
    if (tab !== "kiosk" || paused) return;
    timer.current = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 8000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [tab, paused]);

  // Idle reset: after 2 min of no interaction, return to the slideshow for the next patient
  useEffect(() => {
    if (!entered) return;
    let idle: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(idle);
      idle = setTimeout(() => {
        setTab("kiosk"); setPaused(false); setSlide(0); setResetKey((k) => k + 1);
      }, 120000);
    };
    const evts = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    evts.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(idle); evts.forEach((e) => window.removeEventListener(e, reset)); };
  }, [entered]);

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
        {tab === "admission" && <AdmissionForm key={resetKey} lang={lang} t={t} />}
        {tab === "portal" && <PortalPanel key={resetKey} t={t} />}
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
  const ACCENT: Record<string, { grad: string; chip: string; dot: string }> = {
    blue: { grad: "from-brand-800 via-brand-900 to-brand-950", chip: "bg-brand-600", dot: "bg-emerald-300" },
    teal: { grad: "from-teal-700 via-brand-900 to-brand-950", chip: "bg-teal-500", dot: "bg-teal-200" },
    green: { grad: "from-emerald-700 via-brand-900 to-brand-950", chip: "bg-emerald-500", dot: "bg-emerald-200" },
    red: { grad: "from-rose-700 via-brand-900 to-brand-950", chip: "bg-rose-500", dot: "bg-rose-200" },
  };

  return (
    <div className="relative h-full w-full overflow-hidden select-none bg-brand-950">
      {/* ---- Slide body by kind ---- */}
      {slide.kind === "photo" && (
        <>
          <img key={slide.img} src={slide.img} alt="" className="kb-anim absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/65 to-brand-950/10" />
          <div key={index} className="absolute inset-x-0 bottom-0 p-8 sm:p-14 max-w-4xl">
            <div className="fu inline-flex items-center gap-2 rounded-full bg-brand-600/90 px-4 py-1.5 text-xs font-bold uppercase tracking-wide mb-4" style={{ animationDelay: "0ms" }}>
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />{slide.kicker[li]}
            </div>
            <h2 className="fu text-3xl sm:text-5xl font-extrabold leading-tight drop-shadow mb-3" style={{ animationDelay: "120ms" }}>{slide.title[li]}</h2>
            <p className="fu text-lg sm:text-xl text-white/90 max-w-3xl mb-4" style={{ animationDelay: "240ms" }}>{slide.text[li]}</p>
            <ul className="fu flex flex-wrap gap-2" style={{ animationDelay: "360ms" }}>
              {slide.bullets.map((b, i) => (
                <li key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/20 px-3 py-1.5 text-sm">
                  <svg className="h-3.5 w-3.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  {b[li]}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {slide.kind === "flyer" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 px-4 pt-4 pb-24">
          <img key={slide.img} src={slide.img} alt={slide.alt} className="fi max-h-full w-auto object-contain rounded-xl shadow-2xl ring-1 ring-white/10" />
        </div>
      )}

      {slide.kind === "flyerad" && (
        <FlyerAd slide={slide} index={index} li={li} />
      )}

      {slide.kind === "ad" && (
        <div className={`absolute inset-0 bg-gradient-to-br ${ACCENT[slide.accent].grad}`}>
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
          <div className="absolute -left-16 bottom-0 h-80 w-80 rounded-full bg-white/5" />
          <div key={index} className="relative h-full flex flex-col justify-center max-w-3xl px-8 sm:px-16">
            <div className={`fu inline-flex w-fit items-center gap-2 rounded-full ${ACCENT[slide.accent].chip} px-4 py-1.5 text-xs font-bold uppercase tracking-wide mb-5`} style={{ animationDelay: "0ms" }}>
              <span className={`h-2 w-2 rounded-full ${ACCENT[slide.accent].dot} animate-pulse`} />{slide.badge[li]}
            </div>
            <h2 className="fu text-4xl sm:text-6xl font-extrabold leading-none mb-4" style={{ animationDelay: "120ms" }}>{slide.title[li]}</h2>
            <p className="fu text-xl text-white/85 mb-6 max-w-2xl" style={{ animationDelay: "240ms" }}>{slide.subtitle[li]}</p>
            <ul className="fu space-y-2.5 mb-7" style={{ animationDelay: "360ms" }}>
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-center gap-3 text-lg">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg></span>
                  {b[li]}
                </li>
              ))}
            </ul>
            <div className="fu inline-flex w-fit items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/25 px-5 py-2.5 text-sm font-semibold" style={{ animationDelay: "480ms" }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              {slide.cta[li]}
            </div>
          </div>
        </div>
      )}

      {/* ---- Progress bar (restarts each slide) ---- */}
      {!paused && (
        <div className="absolute top-0 inset-x-0 h-1 bg-white/10">
          <div key={index} className="h-full bg-white/80" style={{ animation: "kioskProgress 8s linear forwards" }} />
        </div>
      )}

      {/* Progress dots */}
      <div className="absolute top-4 right-6 flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <button key={i} onClick={() => onGoto(i)} className={`h-2 rounded-full transition-all ${i === index ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/70"}`} aria-label={`Slide ${i + 1}`} />
        ))}
      </div>

      {/* ---- "Click here to interact" button (kiosk only) ---- */}
      {!paused && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
          <button
            onClick={onToggle}
            className="kiosk-float pointer-events-auto inline-flex items-center gap-2.5 rounded-full bg-white text-brand-800 px-7 py-3.5 text-base font-bold shadow-2xl ring-1 ring-black/5 transition-all hover:scale-105"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-white"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg></span>
            {t("Click here to interact", "Toca aquí para interactuar")}
          </button>
        </div>
      )}

      {/* ---- Paused menu + featured offers ---- */}
      {paused && (
        <div className="absolute inset-0 overflow-auto bg-brand-950/85 backdrop-blur-sm">
          <div className="min-h-full flex items-center justify-center p-6">
            <div className="w-full max-w-4xl">
              <div className="text-center mb-8">
                <img src="/pclinic-footer.png?v=2" alt="Proactive Clinic" className="h-14 w-auto mx-auto mb-4 object-contain" />
                <h3 className="text-3xl font-extrabold">{t("How can we help you today?", "¿Cómo podemos ayudarte hoy?")}</h3>
                <p className="text-white/70 mt-1">{t("Choose an option or explore our services & offers.", "Elige una opción o explora nuestros servicios y ofertas.")}</p>
              </div>

              {/* Primary actions */}
              <div className="grid sm:grid-cols-3 gap-3 mb-8">
                <button onClick={() => onOpenTab("admission")} className="rounded-2xl bg-brand-600 hover:bg-brand-700 px-5 py-5 font-bold text-lg transition hover:-translate-y-0.5">
                  {t("Check-in & HIPAA", "Admisión & HIPAA")}
                </button>
                <button onClick={() => onOpenTab("portal")} className="rounded-2xl bg-white text-brand-800 px-5 py-5 font-bold text-lg transition hover:-translate-y-0.5">
                  {t("Patient Portal", "Portal del Paciente")}
                </button>
                <button onClick={onToggle} className="rounded-2xl bg-white/10 ring-1 ring-white/20 hover:bg-white/20 px-5 py-5 font-bold text-lg transition">
                  {t("Resume presentation", "Reanudar presentación")}
                </button>
              </div>

              {/* Featured services & offers */}
              <div className="mb-2 text-sm font-bold uppercase tracking-wide text-white/60">{t("Services & offers", "Servicios y ofertas")}</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                {PRODUCTS.map((p, i) => (
                  <button key={i} onClick={() => onOpenTab(p.go)} className="text-left rounded-2xl bg-white/5 ring-1 ring-white/10 hover:ring-white/30 hover:bg-white/10 p-4 transition">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 mb-3"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={p.icon} /></svg></span>
                    <div className="font-bold">{p.name[li]}</div>
                    <div className="text-xs text-white/70 mt-0.5">{p.desc[li]}</div>
                  </button>
                ))}
              </div>

              <div className="text-center">
                <button onClick={onExit} className="inline-flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-700 px-6 py-3 font-bold transition">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" /></svg>
                  {t("Exit Kiosk Mode", "Salir del Modo Kiosco")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Flyer ad card ---------------------------- */
function FlyerAd({
  slide, index, li,
}: {
  slide: Extract<Slide, { kind: "flyerad" }>; index: number; li: number;
}) {
  const PILL: Record<string, string> = {
    blue: "bg-brand-600", red: "bg-rose-600", teal: "bg-teal-600", green: "bg-emerald-600",
  };
  const ICONBOX: Record<string, string> = {
    blue: "bg-brand-50 text-brand-700", red: "bg-rose-50 text-rose-600",
    teal: "bg-teal-50 text-teal-700", green: "bg-emerald-50 text-emerald-700",
  };
  const pill = PILL[slide.accent];
  const iconbox = ICONBOX[slide.accent];

  return (
    <div className="absolute inset-0 flex items-start justify-center px-3 sm:px-6 pt-3 sm:pt-5 pb-24 bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950">
      {/* soft decorative glows */}
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
      <div className="absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-white/5" />

      <div key={index} className="fi relative w-full max-w-6xl h-full overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl ring-1 ring-black/10 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-10 pt-4 sm:pt-5 pb-2 shrink-0">
          <img src="/pclinic-header.png?v=2" alt="Proactive Clinic" className="h-9 sm:h-14 w-auto object-contain" />
          <div className="flex flex-col items-end leading-tight text-right">
            <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.2em] text-slate-400">PART OF THE</span>
            <span className="text-xs sm:text-sm font-extrabold text-brand-700">
              PROACTIVE <span className="text-emerald-600">UMS</span> ECOSYSTEM
            </span>
          </div>
        </div>

        {/* Main: text + photo */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="fu flex flex-col justify-center px-5 sm:px-10 py-3 order-2 lg:order-1">
            <h2 className="text-4xl sm:text-6xl font-black leading-[0.9] tracking-tight">
              <span className="text-brand-700">{slide.titleA[li]}</span>{" "}
              <span className="text-rose-600">{slide.titleB[li]}</span>
            </h2>
            <div className={`mt-3 inline-flex w-fit rounded-md ${pill} px-3.5 py-1.5 text-xs sm:text-sm font-extrabold uppercase tracking-wide text-white shadow`}>
              {slide.tagline[li]}
            </div>
            <p className="mt-3 text-base sm:text-lg font-semibold text-slate-800">{slide.subtitle[li]}</p>
            <p className="mt-1.5 text-sm sm:text-base text-slate-500 max-w-md leading-relaxed">{slide.desc[li]}</p>

            {/* Hours box */}
            <div className="mt-4 inline-flex w-fit items-center gap-3 rounded-xl bg-slate-50 ring-1 ring-slate-200 px-4 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={IC.clock} /></svg>
              </span>
              <div className="leading-tight">
                <div className="text-xs sm:text-sm font-bold text-slate-800">{CLINIC.hours[li]}</div>
                <div className="text-[11px] sm:text-xs font-bold text-emerald-600">{CLINIC.walkins[li]}</div>
              </div>
            </div>
          </div>

          {/* Photo */}
          <div className="relative min-h-[26vh] lg:min-h-0 order-1 lg:order-2 overflow-hidden">
            <img key={slide.photo} src={slide.photo} alt="" className="kb-anim absolute inset-0 h-full w-full object-cover" />
            {/* blend photo's inner edge into the white card */}
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent hidden lg:block" />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent lg:hidden" />
          </div>
        </div>

        {/* Features row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100 border-t border-slate-100 shrink-0">
          {slide.features.map((f, i) => (
            <div key={i} className="bg-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2.5 sm:gap-3">
              <span className={`grid h-8 w-8 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-lg ${iconbox}`}>
                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={f.icon} /></svg>
              </span>
              <div className="leading-tight min-w-0">
                <div className="text-xs sm:text-sm font-extrabold text-slate-800 truncate">{f.label[li]}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 truncate">{f.sub[li]}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Navy CTA footer */}
        <div className="bg-brand-900 text-white px-5 sm:px-10 py-3.5 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="text-lg sm:text-2xl font-black tracking-tight text-center sm:text-left">{slide.cta[li]}</div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs sm:text-sm font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              {CLINIC.phone}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {CLINIC.city}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" /></svg>
              {CLINIC.web}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Portal panel ----------------------------- */
function PortalPanel({ t }: { t: (en: string, es: string) => string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mrn: fd.get("mrn"), dob: fd.get("dob") }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || t("Invalid MRN or date of birth.", "MRN o fecha de nacimiento inválidos.")); return; }
      setSignedIn(true);
    } catch {
      setError(t("Network error. Please try again.", "Error de red. Intenta de nuevo."));
    } finally { setLoading(false); }
  }

  async function signOut() {
    try { await fetch("/api/portal/auth/logout", { method: "POST" }); } catch {}
    setSignedIn(false);
  }

  if (signedIn) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-2 bg-brand-50 border-b border-brand-100">
          <span className="text-sm font-semibold text-brand-800">{t("Patient Portal", "Portal del Paciente")}</span>
          <button onClick={signOut} className="rounded-full bg-white ring-1 ring-brand-200 text-brand-700 px-3 py-1.5 text-xs font-bold hover:bg-brand-50">
            {t("Sign out", "Cerrar sesión")}
          </button>
        </div>
        {/* Stays inside kiosk fullscreen via same-origin iframe */}
        <iframe src="/portal/dashboard" title="Patient Portal" className="flex-1 w-full border-0" />
      </div>
    );
  }

  return (
    <div className="h-full grid place-items-center p-6">
      <div className="w-full max-w-sm bg-white text-slate-900 rounded-2xl p-8 shadow-2xl">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        </div>
        <h2 className="text-xl font-bold text-center mb-1">{t("Patient Portal Sign In", "Ingreso al Portal")}</h2>
        <p className="text-sm text-slate-500 text-center mb-5">
          {t("Enter your Medical Record Number and date of birth.", "Ingresa tu Número de Expediente y fecha de nacimiento.")}
        </p>
        <form onSubmit={login} className="space-y-3">
          <label className="block"><span className="label">MRN</span><input name="mrn" required className="input font-mono" placeholder="PC-100000" /></label>
          <label className="block"><span className="label">{t("Date of birth", "Fecha de nacimiento")}</span><input name="dob" type="date" required className="input" /></label>
          {error && <div className="rounded bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{error}</div>}
          <button disabled={loading} className="btn-primary w-full">{loading ? t("Signing in…", "Ingresando…") : t("Sign In", "Ingresar")}</button>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------- Admission + HIPAA --------------------------- */
function AdmissionForm({ lang, t }: { lang: "es" | "en"; t: (en: string, es: string) => string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ confirmation: string; mrn: string; name: string; module: string } | null>(null);

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
      setDone({
        confirmation: json.confirmation,
        mrn: json.mrn,
        name: `${(body.firstName as string) || ""} ${(body.lastName as string) || ""}`.trim(),
        module: (body.module as string) || "ProactiveMed",
      });
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
          <div className="mt-6 flex items-center justify-center gap-4">
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-brand-700 hover:bg-brand-800 text-white px-5 py-2.5 text-sm font-bold transition">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M6 9V4h12v5M6 18H4a2 2 0 01-2-2v-4a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-2M6 14h12v6H6v-6z" /></svg>
              {t("Print receipt", "Imprimir comprobante")}
            </button>
            <button onClick={() => setDone(null)} className="text-sm font-semibold text-brand-700 hover:text-brand-900 underline">
              {t("New check-in", "Nueva admisión")}
            </button>
          </div>
        </div>

        {/* Print-only confirmation slip */}
        <div className="kiosk-receipt hidden text-slate-900">
          <div style={{ maxWidth: 420, margin: "0 auto", fontFamily: "sans-serif" }}>
            <img src="/pclinic-header.png?v=2" alt="Proactive Clinic" style={{ height: 56, marginBottom: 12 }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "6px 0" }}>{t("Check-in Confirmation", "Comprobante de Admisión")}</h2>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              Proactive Clinic · A Division of Proactive UMS Inc.<br />
              8103 Bandera Rd, Suite 102, San Antonio, TX 78250 · (210) 500-2914
            </div>
            <hr />
            <table style={{ width: "100%", fontSize: 13, marginTop: 10 }}>
              <tbody>
                <tr><td style={{ color: "#64748b", padding: "4px 0" }}>{t("Patient", "Paciente")}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{done.name || "—"}</td></tr>
                <tr><td style={{ color: "#64748b", padding: "4px 0" }}>MRN</td><td style={{ textAlign: "right", fontFamily: "monospace" }}>{done.mrn}</td></tr>
                <tr><td style={{ color: "#64748b", padding: "4px 0" }}>{t("Confirmation", "Confirmación")}</td><td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{done.confirmation}</td></tr>
                <tr><td style={{ color: "#64748b", padding: "4px 0" }}>{t("Module", "Módulo")}</td><td style={{ textAlign: "right" }}>{done.module}</td></tr>
                <tr><td style={{ color: "#64748b", padding: "4px 0" }}>{t("Date", "Fecha")}</td><td style={{ textAlign: "right" }}>{new Date().toLocaleString()}</td></tr>
              </tbody>
            </table>
            <hr style={{ marginTop: 10 }} />
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 10 }}>
              {t("HIPAA acknowledgement recorded. Please take a seat — a team member will call you shortly.",
                 "Consentimiento HIPAA registrado. Toma asiento — un miembro del equipo te llamará en breve.")}
            </p>
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
