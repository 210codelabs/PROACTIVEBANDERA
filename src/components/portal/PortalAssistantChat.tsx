"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const STARTER_PROMPTS = [
  "Show my next appointment",
  "Muestrame mi proxima cita",
  "Schedule on 2026-06-01 at 3:00 PM for physical therapy",
  "Agenda una cita el 2026-06-01 a las 3:00 PM para terapia fisica",
  "Reschedule my appointment to 2026-06-03 at 10:30 AM",
  "Reagenda mi cita para 2026-06-03 a las 10:30 AM",
  "Cancel my appointment",
  "Cancela mi cita",
  "What is the practice support phone number?",
  "Cual es el telefono de soporte de la clinica?",
];

function t(lang: "es" | "en", en: string, es: string) {
  return lang === "es" ? es : en;
}

export default function PortalAssistantChat() {
  const uiLang = useMemo<"es" | "en">(() => {
    if (typeof navigator === "undefined") return "en";
    return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
  }, []);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: t(
        uiLang,
        "Hello. I am your ProactiveClinics portal assistant. You can chat with me in English or Spanish, and I can help with appointments and practice questions.",
        "Hola. Soy tu asistente del portal ProactiveClinics. Puedes conversar conmigo en espanol o ingles, y te ayudo con citas y preguntas de la clinica.",
      ),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/portal/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json().catch(() => ({}));
      const replyText =
        typeof data.reply === "string"
          ? data.reply
          : res.ok
            ? t(uiLang, "Done.", "Listo.")
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
    <section className="card card-pad space-y-3">
      <header>
        <h2 className="text-base sm:text-lg font-semibold text-slate-900">AI Assistant</h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          {t(
            uiLang,
            "Ask about practice information or appointment tasks in plain language. English and Spanish are supported.",
            "Pregunta sobre informacion de la clinica o tareas de citas en lenguaje natural. Se admite espanol e ingles.",
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="chip bg-white text-slate-700 ring-slate-200 hover:bg-slate-50" onClick={() => setLargeText((v) => !v)}>
            {largeText ? t(uiLang, "Normal text", "Texto normal") : t(uiLang, "Large text", "Texto grande")}
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className={`rounded-md ring-1 ring-slate-200 bg-slate-50 p-3 h-[420px] overflow-y-auto space-y-2 scroll-smooth ${largeText ? "text-base" : "text-sm"}`}
        aria-live="polite"
        aria-label={t(uiLang, "Assistant conversation", "Conversacion del asistente")}
      >
        {messages.map((m) => (
          <div key={m.id} className={`flex animate-fade-in-up ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 shadow-sm ${largeText ? "text-base" : "text-sm"} ${
                m.role === "user"
                  ? "bg-brand-600 text-white rounded-br-sm"
                  : "bg-white text-slate-800 ring-1 ring-slate-200 rounded-bl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "120ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "240ms" }} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => sendMessage(prompt)}
            disabled={sending}
            className="chip bg-white text-slate-700 ring-slate-200 hover:bg-brand-50 hover:ring-brand-200 hover:text-brand-800 transition"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t(uiLang, "Type your question or request...", "Escribe tu pregunta o solicitud...")}
          aria-label={t(uiLang, "Assistant message", "Mensaje para el asistente")}
          className="input flex-1"
          disabled={sending}
          suppressHydrationWarning
        />
        <button type="submit" className="btn-primary" disabled={sending || !input.trim()} suppressHydrationWarning>
          {t(uiLang, "Send", "Enviar")}
        </button>
      </form>
    </section>
  );
}
