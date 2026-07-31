"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Voice-to-text dictation button using the browser's Web Speech API
 * (SpeechRecognition). Free, on-device in Chrome/Edge, supports English and
 * Spanish. Appends recognized final text via onText. Renders nothing if the
 * browser does not support speech recognition.
 */
type Props = {
  onText: (text: string) => void;
  disabled?: boolean;
  className?: string;
};

const MIC_PATH = "M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z";

export default function DictateButton({ onText, disabled, className }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState<"en-US" | "es-MX">("en-US");
  const recRef = useRef<any>(null);

  useEffect(() => {
    const w = window as any;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      try { recRef.current?.stop(); } catch { /* ignore */ }
    };
  }, []);

  function toggle() {
    if (listening) {
      try { recRef.current?.stop(); } catch { /* ignore */ }
      setListening(false);
      return;
    }
    const w = window as any;
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
      }
      if (finalText.trim()) onText(finalText.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch { /* already started */ }
  }

  if (!supported) return null;

  return (
    <span className={`inline-flex items-center gap-1 ${className || ""}`}>
      <button
        type="button"
        onClick={() => setLang((l) => (l === "en-US" ? "es-MX" : "en-US"))}
        disabled={disabled || listening}
        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
        title="Dictation language / Idioma de dictado"
      >
        {lang === "en-US" ? "EN" : "ES"}
      </button>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md transition disabled:opacity-50 ${
          listening
            ? "bg-rose-100 text-rose-700 ring-1 ring-rose-300 animate-pulse"
            : "bg-brand-50 text-brand-700 hover:bg-brand-100"
        }`}
        title={listening ? "Stop dictation" : "Dictate"}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={MIC_PATH} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 10v1a7 7 0 01-14 0v-1M12 18v4M8 22h8" />
        </svg>
        {listening ? "Listening…" : "Dictate"}
      </button>
    </span>
  );
}
