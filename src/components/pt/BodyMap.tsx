"use client";

import React, { useState } from "react";

// Clickable body regions. Coordinates are in the 300x600 SVG viewBox.
type Region = { key: string; label: string; cx: number; cy: number };

const FRONT: Region[] = [
  { key: "Head", label: "Head", cx: 150, cy: 46 },
  { key: "Neck", label: "Neck", cx: 150, cy: 92 },
  { key: "Right shoulder", label: "R shoulder", cx: 108, cy: 118 },
  { key: "Left shoulder", label: "L shoulder", cx: 192, cy: 118 },
  { key: "Chest", label: "Chest", cx: 150, cy: 145 },
  { key: "Right elbow", label: "R elbow", cx: 84, cy: 205 },
  { key: "Left elbow", label: "L elbow", cx: 216, cy: 205 },
  { key: "Abdomen", label: "Abdomen", cx: 150, cy: 210 },
  { key: "Right wrist/hand", label: "R hand", cx: 74, cy: 278 },
  { key: "Left wrist/hand", label: "L hand", cx: 226, cy: 278 },
  { key: "Right hip", label: "R hip", cx: 124, cy: 262 },
  { key: "Left hip", label: "L hip", cx: 176, cy: 262 },
  { key: "Right knee", label: "R knee", cx: 128, cy: 400 },
  { key: "Left knee", label: "L knee", cx: 172, cy: 400 },
  { key: "Right ankle/foot", label: "R foot", cx: 130, cy: 520 },
  { key: "Left ankle/foot", label: "L foot", cx: 170, cy: 520 },
];

const BACK: Region[] = [
  { key: "Back of head", label: "Head", cx: 150, cy: 46 },
  { key: "Cervical spine (neck)", label: "Cervical", cx: 150, cy: 96 },
  { key: "Right shoulder blade", label: "R blade", cx: 120, cy: 138 },
  { key: "Left shoulder blade", label: "L blade", cx: 180, cy: 138 },
  { key: "Thoracic spine (mid back)", label: "Mid back", cx: 150, cy: 168 },
  { key: "Lumbar spine (lower back)", label: "Lower back", cx: 150, cy: 232 },
  { key: "Right buttock", label: "R glute", cx: 128, cy: 288 },
  { key: "Left buttock", label: "L glute", cx: 172, cy: 288 },
  { key: "Right calf", label: "R calf", cx: 130, cy: 440 },
  { key: "Left calf", label: "L calf", cx: 170, cy: 440 },
  { key: "Right heel", label: "R heel", cx: 130, cy: 532 },
  { key: "Left heel", label: "L heel", cx: 170, cy: 532 },
];

function BodySilhouette() {
  // Simple neutral humanoid built from basic shapes (front & back look the same).
  return (
    <g fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={1}>
      <circle cx={150} cy={46} r={30} />
      <rect x={112} y={80} width={76} height={20} rx={8} />
      <rect x={108} y={98} width={84} height={150} rx={26} />
      {/* arms */}
      <rect x={78} y={104} width={26} height={150} rx={13} />
      <rect x={196} y={104} width={26} height={150} rx={13} />
      <circle cx={91} cy={278} r={15} />
      <circle cx={209} cy={278} r={15} />
      {/* pelvis */}
      <rect x={112} y={244} width={76} height={44} rx={18} />
      {/* legs */}
      <rect x={116} y={286} width={28} height={230} rx={14} />
      <rect x={156} y={286} width={28} height={230} rx={14} />
      {/* feet */}
      <ellipse cx={130} cy={528} rx={18} ry={12} />
      <ellipse cx={170} cy={528} rx={18} ry={12} />
    </g>
  );
}

export default function BodyMap({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [view, setView] = useState<"front" | "back">("front");
  const regions = view === "front" ? FRONT : BACK;
  const selected = new Set(value);

  function toggle(key: string) {
    const next = new Set(value);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange([...next]);
  }

  return (
    <div className="rounded-xl ring-1 ring-slate-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Injury body map</span>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
          <button type="button" onClick={() => setView("front")} className={`px-2.5 py-1 rounded-md font-semibold ${view === "front" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>Front</button>
          <button type="button" onClick={() => setView("back")} className={`px-2.5 py-1 rounded-md font-semibold ${view === "back" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>Back</button>
        </div>
      </div>

      <div className="flex justify-center">
        <svg viewBox="0 0 300 600" className="h-[360px] w-auto select-none">
          <BodySilhouette />
          {regions.map((r) => {
            const on = selected.has(r.key);
            return (
              <g key={r.key} className="cursor-pointer" onClick={() => toggle(r.key)}>
                <circle
                  cx={r.cx}
                  cy={r.cy}
                  r={15}
                  fill={on ? "#4f46e5" : "#ffffff"}
                  stroke={on ? "#4338ca" : "#94a3b8"}
                  strokeWidth={on ? 2 : 1.5}
                  opacity={on ? 1 : 0.85}
                />
                <title>{r.key}</title>
                {on && (
                  <text x={r.cx} y={r.cy + 3.5} textAnchor="middle" fontSize={10} fill="#ffffff" fontWeight={700} pointerEvents="none">✓</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        {regions.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => toggle(r.key)}
            className={`flex items-center gap-1.5 text-left text-[11px] py-0.5 ${selected.has(r.key) ? "text-indigo-700 font-semibold" : "text-slate-500"}`}
          >
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${selected.has(r.key) ? "bg-indigo-600" : "bg-slate-300"}`} />
            {r.key}
          </button>
        ))}
      </div>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5">
              {v}
              <button type="button" onClick={() => toggle(v)} className="text-indigo-400 hover:text-indigo-700">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
