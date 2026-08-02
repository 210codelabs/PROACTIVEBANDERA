"use client";

import React, { useState } from "react";
import ScheduleForm from "@/components/ScheduleForm";

type Lang = "en" | "es";

const H: Record<Lang, { title: string; subtitle: string; home: string }> = {
  en: { title: "Schedule a Visit", subtitle: "Request an appointment online. New and current patients welcome.", home: "← Home" },
  es: { title: "Agendar una Visita", subtitle: "Solicite una cita en línea. Pacientes nuevos y actuales bienvenidos.", home: "← Inicio" },
};

export default function BookClient({ initialLang = "en" }: { initialLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const h = H[lang];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-brand-800 to-brand-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">{h.title}</h1>
            <p className="text-brand-100 mt-1">{h.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex rounded-full bg-white/15 ring-1 ring-white/30 p-0.5">
              <button
                onClick={() => setLang("en")}
                className={`px-3 py-1 text-sm font-semibold rounded-full transition ${lang === "en" ? "bg-white text-brand-700" : "text-white/90 hover:bg-white/10"}`}
              >EN</button>
              <button
                onClick={() => setLang("es")}
                className={`px-3 py-1 text-sm font-semibold rounded-full transition ${lang === "es" ? "bg-white text-brand-700" : "text-white/90 hover:bg-white/10"}`}
              >ES</button>
            </div>
            <a href="/" className="chip bg-white/15 text-white ring-white/30 hover:bg-white/25 whitespace-nowrap">{h.home}</a>
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <ScheduleForm lang={lang} />
      </div>
    </main>
  );
}
