"use client";

import { useEffect, useRef, useState } from "react";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import InstallAppButton from "@/components/InstallAppButton"; // eslint-disable-line @typescript-eslint/no-unused-vars
import BookingButton from "@/components/BookingButton";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type LandingDict = Dictionary["landing"];

export default function LandingHeader({ L }: { L: LandingDict }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const solid = scrolled || menuOpen;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu when the viewport grows to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close the mobile menu when tapping/clicking anywhere outside the header,
  // or pressing Escape.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const navLink = `relative py-1 transition-colors duration-200 after:absolute after:left-0 after:-bottom-0.5 after:h-0.5 after:w-0 after:rounded-full after:bg-current after:transition-all after:duration-300 hover:after:w-full ${
    solid ? "text-slate-600 hover:text-brand-700" : "text-white/90 hover:text-white"
  }`;

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        solid
          ? "bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-20">
          <a href="#top" className="flex items-center gap-4 shrink-0">
            {/* Color logo on solid header, white logo over the hero */}
            <img
              src={solid ? "/pclinic-header.png?v=2" : "/pclinic-footer.png?v=2"}
              alt="Proactive Clinic"
              className="h-12 sm:h-14 w-auto object-contain transition-all duration-300"
            />
          </a>

          <nav className="hidden md:flex flex-nowrap items-center gap-4 lg:gap-6 xl:gap-8 text-[13px] lg:text-sm font-semibold whitespace-nowrap">
            <a href="#services" className={navLink}>{L.navServices}</a>
            <a href="#why" className={navLink}>{L.navWhy}</a>
            <a href="#contact" className={navLink}>{L.navContact}</a>
            <a href="/guide" className={navLink}>Guide</a>
            <a
              href="/enterprise/login"
              className="inline-flex items-center whitespace-nowrap rounded-lg bg-brand-700 px-3 lg:px-4 py-2 text-white font-bold transition-colors duration-200 hover:bg-brand-600 shadow-sm"
            >
              Enterprise Portal
            </a>
            <a
              href="/attorney"
              className="inline-flex items-center whitespace-nowrap rounded-lg bg-orange-700 px-3 lg:px-4 py-2 text-white font-bold transition-colors duration-200 hover:bg-red-600 shadow-sm"
            >
              Attorney Portal
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden md:block">
              <LanguageSwitcher className={`mr-1 ${solid ? "" : "text-white"}`} />
            </span>

            {/* Kiosk mode — ALWAYS visible (kiosks are large tablets) */}
            <a
              href="/kiosk"
              aria-label="Kiosk mode"
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full text-[13px] xl:text-sm font-bold px-2.5 sm:px-3 xl:px-4 py-2.5 transition-all duration-200 hover:-translate-y-0.5 ${
                solid
                  ? "text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
                  : "text-white ring-1 ring-white/50 hover:bg-white/10"
              }`}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17.25V21m6-3.75V21M4.5 4.5h15a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 15V6a1.5 1.5 0 011.5-1.5z" /></svg>
              <span className="hidden sm:inline">Modo Kiosco</span>
            </a>

            <BookingButton
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full text-[13px] xl:text-sm font-bold px-3.5 sm:px-5 py-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 ${
                solid
                  ? "bg-brand-700 hover:bg-brand-800 text-white"
                  : "bg-white text-brand-700 hover:bg-brand-50 ring-1 ring-white/60"
              }`}
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="hidden sm:inline">{L.scheduleVisit}</span>
              <span className="sr-only sm:hidden">{L.scheduleVisit}</span>
            </BookingButton>

            {/* Hamburger — mobile only */}
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className={`md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg ring-1 transition-colors ${
                solid ? "text-slate-700 ring-slate-200 hover:bg-slate-100" : "text-white ring-white/40 hover:bg-white/10"
              }`}
            >
              {menuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu (animated slide + fade) */}
      <div
        className={`md:hidden grid overflow-hidden transition-all duration-300 ease-out ${
          menuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
        aria-hidden={!menuOpen}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={`border-t border-slate-100 bg-white shadow-lg transition-transform duration-300 ease-out ${menuOpen ? "translate-y-0" : "-translate-y-2"}`}>
            <nav className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex flex-col gap-1 text-[15px] font-semibold text-slate-700">
              <a href="#services" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 hover:bg-slate-50">{L.navServices}</a>
              <a href="#why" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 hover:bg-slate-50">{L.navWhy}</a>
              <a href="#contact" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 hover:bg-slate-50">{L.navContact}</a>
              <a href="/guide" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 hover:bg-slate-50">Guide</a>
              <a href="/enterprise/login" onClick={() => setMenuOpen(false)} className="mt-1 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-2.5 text-white font-bold hover:bg-brand-600">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" /></svg>
                Enterprise Portal
              </a>
              <a href="/attorney" onClick={() => setMenuOpen(false)} className="mt-1 inline-flex items-center gap-2 rounded-lg bg-orange-700 px-3 py-2.5 text-white font-bold hover:bg-red-600">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21h18M6 18V9m12 9V9M4 9h16L12 3 4 9zm5 9v-4h6v4" /></svg>
                Attorney Portal
              </a>
              <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
                <LanguageSwitcher />
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
