import Link from "next/link";
import { readAdminConfig } from "@/lib/admin/store";

export default async function LandingPage() {
  const config = await readAdminConfig();
  const { branding, landing, org } = config;

  return (
    <main className="min-h-screen bg-[#f4fbfa] text-slate-900">
      <section
        className="relative overflow-hidden"
        style={{
          background: `radial-gradient(circle at 12% 20%, ${branding.accentColor}33, transparent 35%), radial-gradient(circle at 88% 0%, ${branding.primaryColor}2b, transparent 40%), linear-gradient(120deg, #ffffff, #e6f7f5)`,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-8 pb-8 sm:pb-16">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8 sm:mb-14">
            <div className="flex items-center gap-2 sm:gap-3">
              <img src={branding.logoUrl} alt={branding.appName} className="h-8 sm:h-10 w-auto object-contain" />
              <div>
                <div className="text-lg sm:text-xl font-bold" style={{ color: branding.secondaryColor }}>{branding.appName}</div>
                <div className="text-xs text-slate-500">{branding.slogan}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Link className="btn-secondary text-sm sm:text-base" href={landing.ctaSecondaryHref}>{landing.ctaSecondaryLabel}</Link>
              <Link className="btn-primary text-sm sm:text-base" href={landing.ctaPrimaryHref}>{landing.ctaPrimaryLabel}</Link>
            </div>
          </header>

          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 items-center">
            <div className="space-y-4 order-2 lg:order-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight" style={{ color: branding.secondaryColor }}>
                {landing.heroTitle}
              </h1>
              <p className="text-base sm:text-lg text-slate-600 max-w-xl">{landing.heroSubtitle}</p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 pt-2">
                <Link href={landing.ctaPrimaryHref} className="btn-primary w-full sm:w-auto text-center text-sm sm:text-base">{landing.ctaPrimaryLabel}</Link>
                <Link href={landing.ctaSecondaryHref} className="btn-secondary w-full sm:w-auto text-center text-sm sm:text-base">{landing.ctaSecondaryLabel}</Link>
              </div>
            </div>
            <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-slate-200 p-4 sm:p-6 shadow-xl order-1 lg:order-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Care Intelligence</div>
              <div className="mt-2 text-xl sm:text-2xl font-bold" style={{ color: branding.primaryColor }}>Unified Clinical + Patient Experience</div>
              <ul className="mt-4 space-y-2 sm:space-y-3 text-xs sm:text-sm text-slate-700">
                <li>Real-time appointments, encounters, and messaging</li>
                <li>Patient self-service for documents, reminders, and visit history</li>
                <li>Admin console for users, roles, policies, branding, and portal governance</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-4 sm:-mt-8 pb-8 sm:pb-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {landing.featureCards.map((card) => (
            <article key={card.title} className="rounded-xl bg-white p-4 sm:p-5 ring-1 ring-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">{card.title}</h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-2">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 text-xs sm:text-sm flex flex-col sm:flex-row flex-wrap items-center justify-between gap-2 text-slate-600">
          <div className="text-center sm:text-left">{org.orgName} · {branding.supportEmail} · {branding.supportPhone}</div>
          <div className="text-center">© {new Date().getFullYear()} {org.legalName}</div>
        </div>
      </footer>
    </main>
  );
}
