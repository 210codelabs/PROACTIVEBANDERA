"use client";

import Link from "next/link";
import { useState } from "react";
import { PortalSession } from "@/lib/portalAuth";
import PortalLogoutButton from "./PortalLogoutButton";

const links = [
  { href: "/portal/dashboard", label: "Overview" },
  { href: "/portal/appointments", label: "Appointments" },
  { href: "/portal/assistant", label: "AI Assistant" },
  { href: "/portal/messages", label: "Messages" },
  { href: "/portal/documents", label: "Documents" },
  { href: "/portal/profile", label: "Profile" },
];

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 via-white to-white">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-0.5">
              <img
                src="/powered-by-proactiveums-attached.png"
                alt="ProactiveClinics"
                className="h-8 sm:h-9 w-auto object-contain max-w-[180px] sm:max-w-[240px]"
              />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100">
                Patient Portal
              </span>
            </div>
            <div className="text-xs text-slate-500 truncate">Welcome {session.firstName} {session.lastName} · MRN {session.mrn}</div>
          </div>
          <div className="flex items-center gap-2">
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
          <div className={`overflow-hidden transition-all duration-200 ${mobileMenuOpen ? "max-h-60" : "max-h-0"}`}>
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
