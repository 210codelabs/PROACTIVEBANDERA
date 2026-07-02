"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const STARTER_PROMPTS = [
  "What is the practice support phone number?",
  "Cual es el telefono de soporte de la clinica?",
  "Show my next appointment",
  "Muestrame mi proxima cita",
  "Schedule on 2026-06-01 at 3:00 PM for physical therapy",
  "Agenda una cita el 2026-06-01 a las 3:00 PM para terapia fisica",
];

function detectLang(input: string) {
  const text = input.toLowerCase();
  if (/[À-ſ]/.test(text)) return "es" as const;
  if (/(hola|buenos|buenas|gracias|cita|agendar|reagendar|cancelar|portal|ayuda|clinica|correo|telefono)/.test(text)) return "es" as const;
  return "en" as const;
}

function t(lang: "es" | "en", en: string, es: string) {
  return lang === "es" ? es : en;
}

export default function FloatingAssistantWidget() {
  const pathname = usePathname();
  const [uiLang, setUiLang] = useState<"es" | "en">("en");
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const isPortalPath = pathname?.startsWith("/portal") ?? false;
  const endpoint = useMemo(() => (isPortalPath ? "/api/portal/assistant" : "/api/assistant"), [isPortalPath]);

  useEffect(() => {
    const lang = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
    setUiLang(lang);
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: lang === "es"
          ? "Hola. Soy tu asistente ProactiveClinics. Puedes conversar conmigo en espanol o ingles, y te ayudo con informacion de la clinica y tus citas."
          : "Hi. I am your ProactiveClinics assistant. You can chat with me in English or Spanish, and I will help with practice info and appointments.",
      },
    ]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        text,
      },
    ]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json().catch(() => ({}));
      const replyText =
        typeof data.reply === "string"
          ? data.reply
          : res.status === 401
            ? t(uiLang, "Please sign in to the patient portal to manage appointments.", "Inicia sesion en el portal de pacientes para gestionar citas.")
            : t(uiLang, "Assistant is temporarily unavailable. Please try again.", "El asistente no esta disponible temporalmente. Intenta de nuevo.");

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: replyText,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: t(uiLang, "Assistant is temporarily unavailable. Please try again.", "El asistente no esta disponible temporalmente. Intenta de nuevo."),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      {open && (
        <section className="mb-3 w-[calc(100vw-2rem)] sm:w-[368px] max-h-[72vh] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col overflow-hidden animate-pop-in">
          <header className="px-3.5 py-3 border-b border-slate-200 bg-[linear-gradient(135deg,var(--teal-700),var(--navy-800))] text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-full bg-white/15 ring-1 ring-white/25 grid place-items-center text-sm font-bold">AI</span>
              <div>
                <h2 className="text-sm font-semibold leading-tight">ProactiveClinics Assistant</h2>
                <p className="text-[11px] text-teal-100/90 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse-soft" />
                  {t(uiLang, "Online · EN / ES", "En linea · EN / ES")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white text-sm font-medium"
              aria-label="Close assistant"
            >
              {t(uiLang, "Close", "Cerrar")}
            </button>
          </header>

          <div className="px-2.5 pt-2 flex flex-wrap gap-1.5">
            <button type="button" className="chip bg-white text-slate-700 ring-slate-200 hover:bg-slate-50" onClick={() => setLargeText((v) => !v)}>
              {largeText ? t(uiLang, "Normal text", "Texto normal") : t(uiLang, "Large text", "Texto grande")}
            </button>
          </div>

          <div
            ref={scrollRef}
            className={`p-2.5 bg-slate-50 h-[250px] overflow-y-auto space-y-2 scroll-smooth ${largeText ? "text-sm" : "text-xs"}`}
            aria-live="polite"
            aria-label={t(uiLang, "Assistant conversation", "Conversacion del asistente")}
          >
            {messages.map((m) => (
              <div key={m.id} className={`flex animate-fade-in-up ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 shadow-sm ${largeText ? "text-sm" : "text-xs"} ${
                    m.role === "user" ? "bg-brand-600 text-white rounded-br-sm" : "bg-white text-slate-800 ring-1 ring-slate-200 rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "240ms" }} />
              </div>
            )}
          </div>

          <div className="px-2.5 pt-2 flex flex-wrap gap-1.5">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                disabled={sending}
                className="chip bg-white text-slate-700 ring-slate-200 hover:bg-brand-50 hover:ring-brand-200 hover:text-brand-800 transition text-[10px]"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            className="p-2.5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t(uiLang, "Ask anything...", "Pregunta lo que necesites...")}
              className="input flex-1 text-xs"
              disabled={sending}
              suppressHydrationWarning
            />
            <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={sending || !input.trim()} suppressHydrationWarning>
              {t(uiLang, "Send", "Enviar")}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="h-[52px] w-[52px] rounded-full shadow-lg text-white flex items-center justify-center bg-[linear-gradient(135deg,var(--teal-600),var(--teal-700))] hover:brightness-110 hover:scale-105 active:scale-95 transition-transform duration-200"
        aria-label={open ? t(uiLang, "Close assistant", "Cerrar asistente") : t(uiLang, "Open assistant", "Abrir asistente")}
        suppressHydrationWarning
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
        )}
      </button>
    </div>
  );
}
