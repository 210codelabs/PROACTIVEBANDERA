"use client";

import Link from "next/link";
import { useState } from "react";
import { PortalSession } from "@/lib/portalAuth";
import PortalLogoutButton from "./PortalLogoutButton";
import SessionGuard from "@/components/SessionGuard";
import { useI18n } from "@/components/i18n/I18nProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";

export default function PortalShell({
  session,
  active,
  children,
}: {
  session: PortalSession;
  active: string;
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useI18n();

  const links = [
    { href: "/portal/dashboard", label: t("portal.overview") },
    { href: "/portal/appointments", label: t("portal.appointments") },
    { href: "/portal/assistant", label: t("portal.aiAssistant") },
    { href: "/portal/messages", label: t("portal.messages") },
    { href: "/portal/documents", label: t("portal.documents") },
    { href: "/portal/profile", label: t("portal.profile") },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
      <SessionGuard refreshUrl="/api/portal/auth/refresh" logoutUrl="/api/portal/auth/logout" redirectTo="/portal/login" />
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Link href="/" className="shrink-0" title="Proactive Clinic">
              <img src="/proactive-logo.png" alt="Proactive Clinic" className="h-10 sm:h-12 w-auto object-contain" />
            </Link>
            <div className="min-w-0">
              <div className="text-base sm:text-lg font-bold text-brand-900 truncate">{t("portal.title")}</div>
              <div className="text-xs text-slate-500 truncate">{t("portal.welcome")} {session.firstName} {session.lastName} · MRN {session.mrn}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-md hover:bg-slate-100 text-slate-700"
              title="Toggle menu"
            >
              {mobileMenuOpen ? <Icon.X /> : <Icon.Menu />}
            </button>
            <PortalLogoutButton />
          </div>
        </div>

        {/* MOBILE NAVIGATION */}
        <nav className="md:hidden border-t border-slate-100 bg-slate-50">
          <div className={`overflow-hidden transition-all duration-200 ${mobileMenuOpen ? "max-h-72" : "max-h-0"}`}>
            <div className="p-2 space-y-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 text-sm font-semibold rounded-md transition ${
                    active === link.href
                      ? "bg-brand-600 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </nav>

        {/* DESKTOP NAVIGATION */}
        <nav className="hidden md:block border-t border-slate-100 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 py-2 flex gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  active === link.href ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

const Icon = {
  Menu: () => svgPath("M3 6h18M3 12h18M3 18h18"),
  X: () => svgPath("M18 6L6 18M6 6l12 12"),
};

function svgPath(d: string) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
