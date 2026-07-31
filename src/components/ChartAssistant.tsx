"use client";

import { useEffect, useRef, useState } from "react";
import DictateButton from "@/components/DictateButton";

type Msg = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "Summarize this patient's history",
  "Any drug interactions with current meds?",
  "Draft a follow-up plan",
  "What was the last visit about?",
];

export default function ChartAssistant({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: `Hi, I'm the Clinical AI Assistant. Ask me anything about ${patientName}'s chart — history, medications, interactions, or draft notes and plans. I'm a decision-support tool; the provider makes final decisions.` },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/assistant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const json = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: res.ok ? json.reply : json.error || "Sorry, I could not answer that." }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg px-4 py-3 text-sm font-semibold transition"
        title="Ask the Clinical AI about this patient"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3v4M3 5h4M6 17v4m-2-2h4M13 3l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
        Ask AI
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            {/* header */}
            <div className="bg-brand-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-semibold flex items-center gap-2">
                  <svg className="h-4 w-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 3l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                  Clinical AI Assistant
                </div>
                <div className="text-[11px] text-brand-200 truncate">{patientName} · decision support — verify clinically</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white text-xl leading-none px-2" aria-label="Close">×</button>
            </div>

            {/* messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-brand-600 text-white rounded-br-sm" : "bg-white ring-1 ring-slate-200 text-slate-800 rounded-bl-sm"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white ring-1 ring-slate-200 text-slate-500 text-sm rounded-2xl rounded-bl-sm px-3.5 py-2">Thinking…</div>
                </div>
              )}
              {messages.length <= 1 && !loading && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="text-[12px] rounded-full bg-white ring-1 ring-slate-200 hover:ring-brand-300 hover:text-brand-700 px-3 py-1 text-slate-600 transition">{s}</button>
                  ))}
                </div>
              )}
            </div>

            {/* input */}
            <div className="border-t border-slate-200 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  className="input text-sm flex-1 resize-none"
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Ask about this patient…"
                  disabled={loading}
                />
                <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary px-3 py-2 shrink-0">Send</button>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <DictateButton onText={(t) => setInput((p) => (p ? `${p.trimEnd()} ${t}` : t))} disabled={loading} />
                <span className="text-[10px] text-slate-400">Enter to send · Shift+Enter for newline</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
