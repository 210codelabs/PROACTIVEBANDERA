import Link from "next/link";
import LandingLoginForm from "./LandingLoginForm";
import { getT } from "@/lib/i18n/server";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const SERVICE_IMAGES = [
  "https://images.unsplash.com/photo-1706353399656-210cca727a33?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
  "https://images.unsplash.com/photo-1625751001393-71a69ef50291?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
  "https://images.unsplash.com/photo-1761819922656-d1b77eef49c0?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
  "https://images.pexels.com/photos/6129441/pexels-photo-6129441.jpeg?auto=compress&cs=tinysrgb&w=800",
  "https://images.unsplash.com/photo-1576091358783-a212ec293ff3?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
  "https://images.unsplash.com/photo-1639772823849-6efbd173043c?crop=entropy&cs=srgb&fm=jpg&q=80&w=800",
];

const HERO_IMAGE = "/hero-proactive.png";

// Brochure-inspired rotating accents: blue -> green -> red
const ACCENTS = [
  { circle: "bg-brand-600", soft: "bg-brand-50", ring: "ring-brand-100", text: "text-brand-600", bar: "from-brand-500 to-brand-700" },
  { circle: "bg-emerald-600", soft: "bg-emerald-50", ring: "ring-emerald-100", text: "text-emerald-600", bar: "from-emerald-500 to-emerald-700" },
  { circle: "bg-red-600", soft: "bg-red-50", ring: "ring-red-100", text: "text-red-600", bar: "from-red-500 to-red-700" },
];

const SERVICE_ICONS = [
  "M3 12h4l3 8 4-16 3 8h4",
  "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944 11.955 11.955 0 013.382 5.984 12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  "M9 3v6l-5 8a2 2 0 001.7 3h12.6a2 2 0 001.7-3l-5-8V3M8 3h8",
  "M9 17v2m6-2v2M5 3h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z",
];

export default async function HomePage() {
  const { m } = await getT();
  const L = m.landing;
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <Header L={L} />
      <Hero L={L} />
      <Services L={L} />
      <WhyChooseUs L={L} />
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

function Header({ L }: { L: LandingDict }) {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-4">
            <img src="/proactive-logo.png" alt="Proactive Clinic" className="h-14 sm:h-16 w-auto object-contain" />
            <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-100 px-3 py-1 text-[11px] font-semibold text-brand-800 uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {L.ecosystem}
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <a href="#services" className="hover:text-brand-700 transition">{L.navServices}</a>
            <a href="#why" className="hover:text-brand-700 transition">{L.navWhy}</a>
            <Link href="/portal/login" className="hover:text-brand-700 transition">{L.navPortal}</Link>
            <a href="#contact" className="hover:text-brand-700 transition">{L.navContact}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="mr-1" />
            <Link href="/login" className="hidden sm:inline-flex text-sm font-semibold text-slate-600 hover:text-brand-700 transition px-3 py-1.5">
              {L.staffLogin}
            </Link>
            <Link href="/portal/login" className="btn-primary text-sm">{L.patientPortal}</Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function Hero({ L }: { L: LandingDict }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-28 sm:pb-36">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-8 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white uppercase tracking-wide shadow-md">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              {L.badge}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight text-brand-900">
              {L.heroTitle}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-brand-700 to-red-600">
                {L.heroAccent}
              </span>
            </h1>
            <div className="flex items-center gap-3">
              <span className="h-1 w-10 rounded-full bg-emerald-500" />
              <p className="text-lg sm:text-xl font-semibold text-brand-700">{L.heroTagline}</p>
            </div>
            <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">{L.heroDesc}</p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a href="#contact" className="btn-primary text-base px-7 py-3">{L.scheduleVisit}</a>
              <a href="#services" className="btn-secondary text-base px-7 py-3">{L.ourServices}</a>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 text-sm font-medium text-slate-600">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                {L.mostInsurances}
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                {L.homeVisits}
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-brand-100 to-emerald-100 rounded-[2rem] blur-2xl opacity-70" aria-hidden />
            <div className="relative rounded-[1.75rem] overflow-hidden ring-4 ring-white shadow-2xl">
              <img src={HERO_IMAGE} alt={L.heroTitle} className="w-full h-[320px] sm:h-[420px] object-cover" />
            </div>
            <div className="absolute -bottom-5 -left-5 sm:-left-8 bg-white rounded-2xl shadow-xl border border-slate-100 px-5 py-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-brand-600 grid place-items-center text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">{L.clinicName}</div>
                <div className="text-xs text-slate-500">{L.heroTagline}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Wave className="absolute bottom-0 left-0 w-full h-16 sm:h-24" fill="#ffffff" />
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
            const a = ACCENTS[i % ACCENTS.length];
            return (
              <article key={s.title} className="group relative rounded-2xl border border-slate-100 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 bg-white">
                <div className={`h-1.5 w-full bg-gradient-to-r ${a.bar}`} />
                <div className="relative h-44 overflow-hidden">
                  <img src={SERVICE_IMAGES[i]} alt={s.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                  <div className={`absolute -bottom-6 left-5 h-14 w-14 rounded-2xl ${a.circle} grid place-items-center text-white shadow-lg ring-4 ring-white`}>
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={SERVICE_ICONS[i % SERVICE_ICONS.length]} /></svg>
                  </div>
                </div>
                <div className="p-6 pt-8">
                  <h3 className="text-lg font-bold text-brand-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">{s.description}</p>
                  <ul className="space-y-1.5">
                    {s.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs text-slate-500">
                        <svg className={`w-3.5 h-3.5 ${a.text} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
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
  return (
    <section id="why" className="py-16 sm:py-24 bg-gradient-to-b from-brand-50 to-white">
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {L.reasons.map((r, i) => {
            const a = ACCENTS[i % ACCENTS.length];
            return (
              <div key={r.title} className="flex gap-4 p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-lg transition">
                <div className={`shrink-0 h-12 w-12 rounded-2xl ${a.circle} grid place-items-center text-white shadow-md`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-brand-900 mb-1">{r.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{r.description}</p>
                </div>
              </div>
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
              <span className="font-semibold">(305) 555-0148</span>
            </div>
            <a href="#contact" className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3.5 shadow-lg transition">
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
                <a href="tel:+13055550148" className="text-brand-700 font-medium">(305) 555-0148</a>
              </p>
              <p className="text-xs text-slate-500">
                {L.demoMrn}: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">PC-100000</code> (DOB: 1958-04-12)
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
  const cards = [
    {
      title: L.location, icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z",
      icon2: "M15 11a3 3 0 11-6 0 3 3 0 016 0z",
      body: (<><p className="text-sm text-slate-600">800 NW 57th Ave, Suite 200</p><p className="text-sm text-slate-600">Miami, FL 33126</p></>),
    },
    {
      title: L.phone, icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
      body: (<><a href="tel:+13055550148" className="text-sm text-brand-700 font-medium hover:underline">(305) 555-0148</a><p className="text-xs text-slate-500 mt-1">Fax: (305) 555-0149</p></>),
    },
    {
      title: L.hours, icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      body: (<><p className="text-sm text-slate-600">{L.hoursWeek}</p><p className="text-sm text-slate-600">{L.hoursSat}</p><p className="text-sm text-slate-500">{L.hoursSun}</p></>),
    },
  ];
  return (
    <section id="contact" className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-sm font-bold text-brand-700 uppercase tracking-wider mb-2">{L.contactKicker}</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-900">{L.contactTitle}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((c, i) => {
            const a = ACCENTS[i % ACCENTS.length];
            return (
              <div key={c.title} className="rounded-2xl border border-slate-200 bg-white p-6 text-center hover:shadow-lg transition">
                <div className={`h-14 w-14 rounded-2xl ${a.circle} grid place-items-center mx-auto mb-4 text-white shadow-md`}>
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={c.icon} />{c.icon2 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={c.icon2} />}</svg>
                </div>
                <h3 className="font-bold text-brand-900 mb-1">{c.title}</h3>
                {c.body}
              </div>
            );
          })}
        </div>
        <div className="mt-8 rounded-2xl border border-brand-100 bg-brand-50 p-6 text-center">
          <h3 className="font-bold text-brand-900 mb-2">{L.insuranceTitle}</h3>
          <p className="text-sm text-slate-600 max-w-2xl mx-auto">{L.insuranceDesc}</p>
        </div>
      </div>
    </section>
  );
}

export function Footer({ L }: { L: LandingDict }) {
  return (
    <footer className="bg-brand-950 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="inline-flex bg-white rounded-xl p-2.5 shadow-sm">
              <img src="/proactive-logo.png" alt="Proactive Clinic" className="h-11 w-auto object-contain" />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">{L.footerDesc}</p>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-brand-100 uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {L.ecosystem}
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
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">{L.footerContact}</h4>
            <ul className="space-y-2 text-sm">
              <li>800 NW 57th Ave, Suite 200</li>
              <li>Miami, FL 33126</li>
              <li><a href="tel:+13055550148" className="hover:text-brand-300 transition">(305) 555-0148</a></li>
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
          <div>&copy; {new Date().getFullYear()} {L.clinicName}. {L.rights}</div>
          <div>{L.demoBuild}</div>
        </div>
      </div>
    </footer>
  );
}
