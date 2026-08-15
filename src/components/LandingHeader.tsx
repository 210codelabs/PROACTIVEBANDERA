"use client";

import { useEffect, useState } from "react";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import InstallAppButton from "@/components/InstallAppButton";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type LandingDict = Dictionary["landing"];

export default function LandingHeader({ L }: { L: LandingDict }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLink = `relative py-1 transition-colors duration-200 after:absolute after:left-0 after:-bottom-0.5 after:h-0.5 after:w-0 after:rounded-full after:bg-current after:transition-all after:duration-300 hover:after:w-full ${
    scrolled ? "text-slate-600 hover:text-brand-700" : "text-white/90 hover:text-white"
  }`;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-20">
          <a href="#top" className="flex items-center gap-4 shrink-0">
            {/* Color logo on solid header, white logo over the hero */}
            <img
              src={scrolled ? "/pclinic-header.png?v=2" : "/pclinic-footer.png?v=2"}
              alt="Proactive Clinic"
              className="h-12 sm:h-14 w-auto object-contain transition-all duration-300"
            />
          </a>

          <nav className="hidden md:flex flex-nowrap items-center gap-4 lg:gap-6 xl:gap-8 text-[13px] lg:text-sm font-semibold whitespace-nowrap">
            <a href="#services" className={navLink}>{L.navServices}</a>
            <a href="#why" className={navLink}>{L.navWhy}</a>
            <a href="#testimonials" className={navLink}>{L.testKicker}</a>
            <a href="#contact" className={navLink}>{L.navContact}</a>
            <a
              href="/attorney"
              className="inline-flex items-center whitespace-nowrap rounded-lg bg-orange-700 px-3 lg:px-4 py-2 text-white font-bold transition-colors duration-200 hover:bg-red-600 shadow-sm"
            >
              Attorney Portal
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageSwitcher className={`mr-1 ${scrolled ? "" : "text-white"}`} />

            <InstallAppButton variant="landing" scrolled={scrolled} />

            <a
              href="/kiosk"
              className={`hidden lg:inline-flex items-center gap-2 whitespace-nowrap rounded-full text-[13px] xl:text-sm font-bold px-3 xl:px-4 py-2.5 transition-all duration-200 hover:-translate-y-0.5 ${
                scrolled
                  ? "text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
                  : "text-white ring-1 ring-white/50 hover:bg-white/10"
              }`}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17.25V21m6-3.75V21M4.5 4.5h15a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 15V6a1.5 1.5 0 011.5-1.5z" /></svg>
              Modo Kiosco
            </a>

            <a
              href="/book"
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full text-[13px] xl:text-sm font-bold px-4 sm:px-5 py-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 ${
                scrolled
                  ? "bg-brand-700 hover:bg-brand-800 text-white"
                  : "bg-white text-brand-700 hover:bg-brand-50 ring-1 ring-white/60"
              }`}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="hidden sm:inline">{L.scheduleVisit}</span>
              <span className="sm:hidden">Book</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
