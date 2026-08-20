"use client";

import React, { useRef, useState, useEffect } from "react";

/** Provider e-signature: type a name or draw with mouse/touch. Emits {type,data}. */
export default function SignaturePad({ onChange }: { onChange: (v: { type: "typed" | "drawn"; data: string } | null) => void }) {
  const [mode, setMode] = useState<"typed" | "drawn">("typed");
  const [typed, setTyped] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (mode === "typed") onChange(typed.trim() ? { type: "typed", data: typed.trim() } : null);
  }, [typed, mode]); // eslint-disable-line

  function pos(e: React.PointerEvent) {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function start(e: React.PointerEvent) { drawing.current = true; const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return; const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e);
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#0a2540"; ctx.lineTo(p.x, p.y); ctx.stroke(); dirty.current = true;
  }
  function end() { drawing.current = false; if (dirty.current) onChange({ type: "drawn", data: canvasRef.current!.toDataURL("image/png") }); }
  function clear() { const c = canvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); dirty.current = false; onChange(null); }

  return (
    <div className="rounded-lg ring-1 ring-slate-200 p-3">
      <div className="flex items-center gap-2 mb-2">
        <button type="button" onClick={() => { setMode("typed"); }} className={`chip text-xs ${mode === "typed" ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>Type</button>
        <button type="button" onClick={() => { setMode("drawn"); onChange(null); }} className={`chip text-xs ${mode === "drawn" ? "bg-brand-100 text-brand-800 ring-brand-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>Draw</button>
        <span className="text-[11px] text-slate-400 ml-auto">Provider e-signature</span>
      </div>
      {mode === "typed" ? (
        <input className="input w-full" style={{ fontFamily: "cursive", fontSize: 20 }} placeholder="Type your full name to sign" value={typed} onChange={(e) => setTyped(e.target.value)} />
      ) : (
        <div>
          <canvas ref={canvasRef} width={520} height={120} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} className="w-full h-[120px] rounded-md bg-slate-50 ring-1 ring-slate-200 touch-none" />
          <button type="button" onClick={clear} className="mt-1 text-xs text-rose-600 hover:underline">Clear signature</button>
        </div>
      )}
    </div>
  );
}
