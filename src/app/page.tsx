import Link from "next/link";
import LandingLoginForm from "./LandingLoginForm";
import HeroAuth from "@/components/HeroAuth";
import LandingHeader from "@/components/LandingHeader";
import ClosestClinicContact from "@/components/ClosestClinicContact";
import { getT } from "@/lib/i18n/server";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const HERO_IMAGE = "/hero-proactive.png";

const SERVICE_IMAGES = [
  "/platform-clinical.jpg",       // Clinical & Charting
  "/platform-ai.jpg",             // AI Assistance
  "/platform-billing.jpg",        // Billing & Revenue Cycle
  "/platform-credentialing.jpg",  // Credentialing & Enterprise
  "/platform-attorney.jpg",       // Attorney / PI Workflows
  "/platform-interop.jpg",        // Interoperability & Data Exchange
];

// Brochure-inspired rotating accents: blue -> green -> red
const ACCENTS = [
  { circle: "bg-brand-600", soft: "bg-brand-50", text: "text-brand-600", bar: "from-brand-500 to-brand-700" },
  { circle: "bg-emerald-600", soft: "bg-emerald-50", text: "text-emerald-600", bar: "from-emerald-500 to-emerald-700" },
  { circle: "bg-red-600", soft: "bg-red-50", text: "text-red-600", bar: "from-red-500 to-red-700" },
];

const SERVICE_ICONS = [
  // Clinical & Charting — clipboard with check
  "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-5 8l1.5 1.5L15 11",
  // AI Assistance — sparkles
  "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  // Billing & Revenue Cycle — card / payments
  "M3 10h18M7 15h2m6 0h2M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",
  // Credentialing & Enterprise — verified shield
  "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944 11.955 11.955 0 013.382 5.984 12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  // Attorney / PI — scales of justice
  "M12 3v18m0-18l7 2m-7-2L5 5m0 0l-3 8a4 4 0 006 0L5 5zm14 0l3 8a4 4 0 01-6 0l3-8zM8 21h8",
  // Interoperability & Data Exchange — share / network
  "M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4M18 5a2 2 0 11-4 0 2 2 0 014 0zM18 19a2 2 0 11-4 0 2 2 0 014 0zM8 12a2 2 0 11-4 0 2 2 0 014 0z",
];

export default async function HomePage() {
  const { m } = await getT();
  const L = m.landing;
  return (
    <main id="top" className="min-h-screen bg-white text-slate-900">
      <svg width="0" height="0" aria-hidden className="absolute -z-10">
        <defs>
          <linearGradient id="pcIconGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1872f0" />
            <stop offset="55%" stopColor="#125ddc" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
        </defs>
      </svg>
      <LandingHeader L={L} />
      <HeroAuth
        heading={L.heroTitle}
        accent={L.heroAccent}
        tagline={L.heroTagline}
        subtitle={L.heroDesc}
        chips={[L.mostInsurances, L.homeVisits, L.ecosystem]}
      />
      <Services L={L} />
      <StandardsStrip />
      <WhyChooseUs L={L} />
      <Testimonials L={L} />
      <BookBand L={L} />
      <ContactAndHours L={L} />
      <Footer L={L} />
    </main>
  );
}

type LandingDict = Dictionary["landing"];

function Wave({ className = "", fill = "#ffffff" }: { className?: string; fill?: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path fill={fill} d="M0,64L60,58.7C120,53,240,43,360,48C480,53,600,75,720,80C840,85,960,75,1080,64C1200,53,1320,43,1380,37.3L1440,32L1440,120L0,120Z" />
    </svg>
  );
}

function Seal({ className = "" }: { className?: string }) {
  return (
    <div className={`drop-shadow-xl ${className}`}>
      <svg viewBox="0 0 120 120" className="animate-spin-slow h-full w-full">
        <defs>
          <path id="sealPath" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
        </defs>
        <circle cx="60" cy="60" r="58" fill="#dc2626" />
        <circle cx="60" cy="60" r="46" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1" />
        <text fill="#ffffff" fontSize="12.5" fontWeight="800" letterSpacing="2.5">
          <textPath href="#sealPath" startOffset="0">NOW ACCEPTING • NEW PATIENTS • </textPath>
        </text>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" />
        </svg>
      </div>
    </div>
  );
}

// Header replaced by the client component <LandingHeader /> (transparent-over-hero, solid on scroll).

function Hero({ L }: { L: LandingDict }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      {/* Gradient-blended hero background image */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-full lg:w-[64%]">
        <img src={HERO_IMAGE} alt={L.heroTitle} className="hero-bg-fade hero-animate h-full w-full object-cover object-center select-none" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white via-white/85 to-transparent lg:from-white/95 lg:via-white/45 lg:to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-brand-100/50 via-transparent to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-32 sm:pb-40">
        <div className="max-w-2xl space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white uppercase tracking-wide shadow-md">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              {L.badge}
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-brand-100 px-3 py-1 text-[11px] font-semibold text-brand-800 uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {L.ecosystem}
            </div>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.02] tracking-tight text-brand-900">
            {L.heroTitle}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-brand-700 to-red-600">
              {L.heroAccent}
            </span>
          </h1>
          <div className="flex items-center gap-3">
            <span className="h-1.5 w-12 rounded-full bg-emerald-500" />
            <p className="text-xl sm:text-2xl font-bold text-brand-700">{L.heroTagline}</p>
          </div>
          <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">{L.heroDesc}</p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a href="/demo" className="btn-primary text-base px-8 py-3.5">{L.scheduleVisit}</a>
            <a href="#services" className="btn-secondary text-base px-8 py-3.5">{L.ourServices}</a>
          </div>
        </div>
      </div>

      <Seal className="absolute z-20 right-6 sm:right-16 bottom-28 sm:bottom-32 h-24 w-24 sm:h-28 sm:w-28 hidden sm:block" />
      <Wave className="absolute bottom-0 left-0 w-full h-16 sm:h-24" fill="#ffffff" />
    </section>
  );
}

function StatStrip({ L }: { L: LandingDict }) {
  const stats = [
    { value: `${L.services.length}`, label: L.servicesKicker, icon: "M4 6h16M4 12h16M4 18h10" },
    { value: "EN / ES", label: "Bilingual", icon: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9L18 6.5m0 0l3 6M18 6.5l-3 6" },
    { value: "✓", label: L.homeVisits, icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { value: "✓", label: L.mostInsurances, icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944 11.955 11.955 0 013.382 5.984 12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  ];
  return (
    <section className="relative -mt-16 sm:-mt-20 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-white shadow-xl border border-slate-100 grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100 overflow-hidden">
          {stats.map((s, i) => {
            const a = ACCENTS[i % ACCENTS.length];
            return (
              <div key={s.label} className="flex items-center gap-3 p-5">
                <div className={`h-11 w-11 shrink-0 rounded-xl ${a.circle} grid place-items-center text-white`}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={s.icon} /></svg>
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-extrabold text-brand-900 leading-none">{s.value}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-tight">{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Emblem({ d, d2, size = "md" }: { d: string; d2?: string; size?: "sm" | "md" | "lg" }) {
  const tile = size === "lg" ? "h-16 w-16 rounded-2xl" : size === "sm" ? "h-11 w-11 rounded-xl" : "h-14 w-14 rounded-2xl";
  const ic = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-7 w-7";
  return (
    <span className={`relative inline-grid ${tile} shrink-0 place-items-center bg-white ring-1 ring-slate-200/70 shadow-[0_14px_30px_-12px_rgba(2,6,23,0.4)]`}>
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-brand-500/12 via-transparent to-red-500/12" />
      <span className="pointer-events-none absolute inset-px rounded-[inherit] ring-1 ring-inset ring-white/70" />
      <svg className={`relative ${ic}`} fill="none" viewBox="0 0 24 24" aria-hidden>
        <path stroke="url(#pcIconGrad)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={d} />
        {d2 && <path stroke="url(#pcIconGrad)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={d2} />}
      </svg>
    </span>
  );
}

function StandardsStrip() {
  const providers = [
    { name: "Weno", cat: "e‑Prescribing network", url: "https://wenoexchange.com", logo: "/providers/weno.png" },
    { name: "Stedi", cat: "Eligibility & claims", url: "https://www.stedi.com", logo: "/providers/stedi.png" },
    { name: "FMCSA", cat: "DOT driver physicals", url: "https://www.fmcsa.dot.gov", logo: "/providers/fmcsa.png" },
    { name: "CMS", cat: "Medicare · Blue Button", url: "https://www.cms.gov", logo: "/providers/cms.png" },
    { name: "openFDA", cat: "Drug label data", url: "https://open.fda.gov", logo: "/providers/openfda.png" },
    { name: "NLM", cat: "RxNorm terminology", url: "https://www.nlm.nih.gov", logo: "/providers/nlm.png" },
    { name: "NPPES", cat: "NPI Registry", url: "https://npiregistry.cms.hhs.gov", logo: "/providers/nppes.png" },
    { name: "HL7 FHIR", cat: "Interoperability standard", url: "https://www.hl7.org/fhir/", logo: "/providers/fhir.webp" },
  ];
  return (
    <section className="border-y border-slate-100 bg-gradient-to-b from-white to-brand-50/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-6">Integrated with trusted healthcare providers &amp; networks</p>
        <div className="flex flex-wrap items-stretch justify-center gap-3">
          {providers.map((p) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${p.name} — ${p.cat}`}
              className="group inline-flex h-16 items-center justify-center gap-3 rounded-xl bg-white px-4 ring-1 ring-slate-200 shadow-sm hover:ring-brand-300 hover:shadow-md hover:-translate-y-0.5 transition"
            >
              {p.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.logo} alt={`${p.name} logo`} className="h-8 w-auto object-contain" />
              ) : (
                <>
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white grayscale group-hover:grayscale-0 transition"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.mark}
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-sm font-extrabold tracking-tight text-brand-900">{p.name}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{p.cat}</span>
                  </span>
                </>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Services({ L }: { L: LandingDict }) {
  return (
    <section id="services" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 uppercase tracking-wider mb-3">
            <span className="h-1 w-6 rounded-full bg-emerald-500" />
            {L.servicesKicker}
            <span className="h-1 w-6 rounded-full bg-red-500" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-900">{L.servicesTitle}</h2>
          <p className="mt-4 text-slate-600 text-lg">{L.servicesDesc}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {L.services.map((s, i) => {
            return (
              <article key={s.title} className="group relative rounded-2xl border border-slate-100 bg-white hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col">
                <div className="relative h-44 overflow-hidden">
                  <img src={SERVICE_IMAGES[i % SERVICE_IMAGES.length]} alt={s.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/45 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-500 via-brand-600 to-red-500" />
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Emblem d={SERVICE_ICONS[i % SERVICE_ICONS.length]} />
                    <h3 className="text-lg font-bold text-brand-900 leading-tight">{s.title}</h3>
                  </div>
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">{s.description}</p>
                  <ul className="space-y-1.5 border-t border-slate-100 pt-4 mt-auto">
                    {s.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24"><path stroke="url(#pcIconGrad)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WhyChooseUs({ L }: { L: LandingDict }) {
  const icons = [
    // One Unified Stack — layers
    "M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5",
    // Patient Engagement — people
    "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0M13 7a4 4 0 11-2 0",
    // Analytics & Insights — chart
    "M3 3v18h18M7 15l3-3 3 3 5-6",
    // Built to Scale — enterprise building
    "M3 21h18M5 21V5a2 2 0 012-2h6a2 2 0 012 2v16M15 21V9h2a2 2 0 012 2v10M8 7h2m-2 4h2m-2 4h2",
  ];
  return (
    <section id="why" className="relative py-16 sm:py-24 bg-gradient-to-b from-brand-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 uppercase tracking-wider mb-3">
            <span className="h-1 w-6 rounded-full bg-emerald-500" />
            {L.whyKicker}
            <span className="h-1 w-6 rounded-full bg-red-500" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-900">{L.whyTitle}</h2>
          <p className="mt-4 text-slate-600 text-lg">{L.whyDesc}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {L.reasons.map((r, i) => {
            return (
              <div key={r.title} className="group relative rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all p-6 text-center">
                <div className="mx-auto mb-4 w-fit">
                  <Emblem d={icons[i % icons.length]} size="lg" />
                </div>
                <h3 className="font-bold text-brand-900 mb-1.5">{r.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{r.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Team({ L }: { L: LandingDict }) {
  const members = [
    { name: "Andy Manzano", cred: "PD", specialty: "Practice Director", initials: "AM", photo: "https://images.unsplash.com/photo-1585240975858-7264fd020798?crop=entropy&cs=srgb&fm=jpg&q=80&w=400" },
    { name: "Linh Tan", cred: "NP", specialty: "Primary Care / Aesthetics", initials: "LT", photo: "https://images.unsplash.com/photo-1606240569045-aca76646c656?crop=entropy&cs=srgb&fm=jpg&q=80&w=400" },
    { name: "Devon Jones", cred: "DPT", specialty: "Physical Rehabilitation", initials: "DJ", photo: "https://images.unsplash.com/photo-1639747279286-c07eecb47a0b?crop=entropy&cs=srgb&fm=jpg&q=80&w=400" },
    { name: "Aaron Smith", cred: "MD", specialty: "Pain Management / Wound Care", initials: "AS", photo: "https://images.unsplash.com/photo-1649705433263-5c80d699b5f5?crop=entropy&cs=srgb&fm=jpg&q=80&w=400" },
  ];
  return (
    <section id="team" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 uppercase tracking-wider mb-3">
            <span className="h-1 w-6 rounded-full bg-emerald-500" />
            {L.teamKicker}
            <span className="h-1 w-6 rounded-full bg-red-500" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-900">{L.teamTitle}</h2>
          <p className="mt-4 text-slate-600 text-lg">{L.teamDesc}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {members.map((mem, i) => {
            const a = ACCENTS[i % ACCENTS.length];
            return (
              <div key={mem.name} className="group rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-xl transition overflow-hidden text-center">
                <div className={`h-24 bg-gradient-to-r ${a.bar}`} />
                <div className="px-6 pb-6 -mt-12">
                  <div className={`mx-auto h-24 w-24 rounded-full ring-4 ring-white shadow-lg overflow-hidden ${a.circle}`}>
                    <img src={mem.photo} alt={mem.name} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <h3 className="mt-4 font-bold text-brand-900 text-lg">{mem.name}<span className="text-slate-400 font-semibold">, {mem.cred}</span></h3>
                  <p className={`text-sm font-semibold ${a.text} mt-0.5`}>{mem.specialty}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Testimonials({ L }: { L: LandingDict }) {
  return (
    <section id="testimonials" className="py-16 sm:py-24 bg-gradient-to-b from-white to-brand-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 uppercase tracking-wider mb-3">
            <span className="h-1 w-6 rounded-full bg-emerald-500" />
            {L.testKicker}
            <span className="h-1 w-6 rounded-full bg-red-500" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-900">{L.testTitle}</h2>
          <p className="mt-4 text-slate-600 text-lg">{L.testDesc}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {L.reviews.map((r) => {
            return (
              <figure key={r.name} className="relative rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl transition p-7 flex flex-col">
                <div className="flex items-center gap-1 text-amber-400 mb-4">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <svg key={s} className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.35 4.16a1 1 0 00.95.69h4.37c.97 0 1.37 1.24.59 1.81l-3.54 2.57a1 1 0 00-.36 1.12l1.35 4.16c.3.92-.76 1.69-1.54 1.12l-3.54-2.57a1 1 0 00-1.18 0l-3.54 2.57c-.78.57-1.84-.2-1.54-1.12l1.35-4.16a1 1 0 00-.36-1.12L1.44 9.6c-.78-.57-.38-1.81.59-1.81h4.37a1 1 0 00.95-.69L9.05 2.93z" /></svg>
                  ))}
                </div>
                <blockquote className="text-slate-600 text-sm leading-relaxed flex-1">&ldquo;{r.text}&rdquo;</blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-red-600 text-white font-bold ring-2 ring-white shadow-md">{r.name.charAt(0)}</div>
                  <div>
                    <div className="font-bold text-brand-900 text-sm">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.location}</div>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BookBand({ L }: { L: LandingDict }) {
  return (
    <section className="relative bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 text-white overflow-hidden">
      <Wave className="absolute top-0 left-0 w-full h-16 rotate-180" fill="#ffffff" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="flex items-center gap-5">
            <div className="hidden sm:grid h-20 w-20 rounded-2xl bg-white/15 place-items-center shrink-0">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{L.bookTitle}</h2>
              <p className="mt-3 text-brand-100 text-lg max-w-lg">{L.bookDesc}</p>
            </div>
          </div>
          <div className="lg:justify-self-end space-y-4">
            <div className="flex items-center gap-3 text-brand-50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M3.6 9h16.8 M3.6 15h16.8 M12 3a15 15 0 010 18 15 15 0 010-18z" /></svg>
              <span className="font-semibold">proactiveclinics.com</span>
            </div>
            <div className="flex items-center gap-3 text-brand-50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              <span className="font-semibold">(210) 500-2914</span>
            </div>
            <a href="/demo" className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3.5 shadow-lg transition">
              {L.bookCta}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PortalAccess({ L, t }: { L: LandingDict; t: (k: string) => string }) {
  return (
    <section id="portal" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-sm font-bold text-brand-700 uppercase tracking-wider mb-2">{L.portalKicker}</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-900">{L.portalTitle}</h2>
          <p className="mt-4 text-slate-600 text-lg">{L.portalDesc}</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50 to-white p-6 space-y-4">
              <h3 className="text-lg font-bold text-brand-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                {L.portalCardTitle}
              </h3>
              <p className="text-sm text-slate-600">{L.portalSignInDesc}</p>
              <ul className="space-y-2">
                {L.portalFeatures.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/portal/login" className="btn-primary w-full text-center mt-4">
                {L.openPortal}
              </Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-base font-bold text-brand-900 mb-2">{L.newPatient}</h3>
              <p className="text-sm text-slate-600 mb-3">
                {L.newPatientDesc}{" "}
                <a href="tel:+12105002914" className="text-brand-700 font-medium">(210) 500-2914</a>
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-brand-100 grid place-items-center">
                <svg className="w-4 h-4 text-brand-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-brand-900">{L.quickSignIn}</h3>
            </div>
            <LandingLoginForm />
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactAndHours({ L }: { L: LandingDict }) {
  // Closest clinic via browser geolocation; falls back to all 4 clinics.
  return (
    <section id="contact" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-sm font-bold text-brand-700 uppercase tracking-wider mb-2">{L.contactKicker}</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-900">{L.contactTitle}</h2>
        </div>
        <ClosestClinicContact
          L={{
            location: L.location, ourClinics: L.ourClinics, selectedClinic: L.selectedClinic, findingClinic: L.findingClinic,
            milesAway: L.milesAway, navigateTo: L.navigateTo, useMyLocation: L.useMyLocation, phone: L.phone, hours: L.hours,
            hoursWeek: L.hoursWeek, hoursSat: L.hoursSat, hoursSun: L.hoursSun, insuranceTitle: L.insuranceTitle,
            insuranceDesc: L.insuranceDesc, scheduleVisit: L.scheduleVisit, bookHere: L.bookHere,
          }}
        />
      </div>
    </section>
  );
}

export function Footer({ L }: { L: LandingDict }) {
  return (
    <footer className="bg-[#05080f] text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="flex flex-col items-start gap-3">
            <img src="/pclinic-footer.png?v=2" alt="Proactive Clinic" className="h-14 sm:h-16 w-auto object-contain -mt-1" />
            <p className="text-[13px] text-slate-400 leading-relaxed">{L.footerDesc}</p>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-brand-100 uppercase tracking-wide whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
              Proactive UMS Ecosystem
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">{L.footerServices}</h4>
            <ul className="space-y-2 text-sm">
              {L.services.slice(0, 5).map((s) => (
                <li key={s.title}><a href="/#services" className="hover:text-brand-300 transition">{s.title}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">{L.footerQuickLinks}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/portal/login" className="hover:text-brand-300 transition">{L.patientPortal}</Link></li>
              <li><Link href="/login" className="hover:text-brand-300 transition">{L.staffPortal}</Link></li>
              <li><a href="#contact" className="hover:text-brand-300 transition">{L.navContact}</a></li>
              <li><a href="/#services" className="hover:text-brand-300 transition">{L.navServices}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Compliance</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/legal/privacy" className="hover:text-brand-300 transition">Privacy Policy</Link></li>
              <li><Link href="/legal/terms" className="hover:text-brand-300 transition">Terms of Use</Link></li>
              <li><Link href="/legal/hipaa" className="hover:text-brand-300 transition">HIPAA Notice</Link></li>
              <li><Link href="/legal/accessibility" className="hover:text-brand-300 transition">Accessibility</Link></li>
              <li><Link href="/legal/cookies" className="hover:text-brand-300 transition">Cookie Policy</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">{L.footerContact}</h4>
            <ul className="space-y-2 text-sm">
              <li>8103 Bandera Rd, Suite 102</li>
              <li>San Antonio, TX 78250</li>
              <li><a href="tel:+12105002914" className="hover:text-brand-300 transition">(210) 500-2914</a></li>
              <li><a href="mailto:info@proactiveclinic.com" className="hover:text-brand-300 transition">info@proactiveclinic.com</a></li>
            </ul>
          </div>
        </div>

        {/* Developed by 210 CodeLabs */}
        <div className="border-t border-white/10 mt-10 pt-8 flex justify-center">
          <a
            href="https://210codelabs.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center transition hover:opacity-90"
            title="Developed by 210 CodeLabs — Precision Code, Innovative Solutions"
          >
            <img
              src="/developed-by-210codelabs-v2.png"
              alt="Developed by 210 CodeLabs — Precision Code, Innovative Solutions"
              className="h-16 sm:h-20 w-auto max-w-[600px] object-contain"
            />
          </a>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>&copy; {new Date().getFullYear()} {L.clinicName}. {L.rights} · A Division of Proactive UMS Inc.</div>
          <div>{L.demoBuild}</div>
        </div>
      </div>
    </footer>
  );
}
