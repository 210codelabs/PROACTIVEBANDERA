"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const KEY = "pclinic_cookie_consent";

function useLang() {
  return useMemo<"es" | "en">(() => {
    if (typeof navigator === "undefined") return "en";
    return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
  }, []);
}

export default function CookieConsent() {
  const lang = useLang();
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  function decide(value: "accepted" | "declined") {
    try {
      localStorage.setItem(KEY, value);
    } catch {}
    setShow(false);
  }

  if (!show) return null;

  const t = (en: string, es: string) => (lang === "es" ? es : en);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="max-w-4xl mx-auto rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-brand-600 grid place-items-center text-white">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 2a10 10 0 100 20 10 10 0 000-20zM9 9h.01M15 13h.01M8.5 14.5h.01M14 9.5h.01" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-700 leading-relaxed">
            {t(
              "We use cookies to keep your session secure, remember your preferences, and improve our services.",
              "Usamos cookies para mantener tu sesión segura, recordar tus preferencias y mejorar nuestros servicios.",
            )}{" "}
            <Link href="/legal/cookies" className="font-semibold text-brand-700 hover:underline">
              {t("Learn more", "Más información")}
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => decide("declined")} className="btn-secondary text-sm px-4 py-2">
            {t("Decline", "Rechazar")}
          </button>
          <button onClick={() => decide("accepted")} className="btn-primary text-sm px-5 py-2">
            {t("Accept", "Aceptar")}
          </button>
        </div>
      </div>
    </div>
  );
}
