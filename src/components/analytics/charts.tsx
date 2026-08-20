import React from "react";

/** Lightweight, dependency-free infographic primitives (SVG/CSS). */

export const CHART_COLORS = ["#2563eb", "#0d9488", "#16a34a", "#f59e0b", "#8b5cf6", "#e11d48", "#0ea5e9", "#64748b"];

export function fmtNum(n: number): string {
  return (n || 0).toLocaleString();
}
export function fmtMoney(cents: number): string {
  return `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function KpiStat({ label, value, sub, accent = "#2563eb" }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-lg bg-white ring-1 ring-slate-200 p-4 border-l-4" style={{ borderLeftColor: accent }}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-2xl font-bold text-slate-900 leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function BarChart({ data, height = 170, color = CHART_COLORS[0] }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  if (!data.length) return <Empty />;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="w-full">
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end min-w-0">
            <div className="text-[10px] text-slate-500 mb-1">{d.value ? fmtNum(d.value) : ""}</div>
            <div className="w-full rounded-t" style={{ height: `${(d.value / max) * (height - 28)}px`, background: color, minHeight: d.value ? 3 : 0 }} title={`${d.label}: ${d.value}`} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-1">
        {data.map((d, i) => <div key={i} className="flex-1 text-center text-[9px] text-slate-400 truncate" title={d.label}>{d.label}</div>)}
      </div>
    </div>
  );
}

export function LineArea({ series, height = 180, color = CHART_COLORS[0] }: { series: { month: string; count: number }[]; height?: number; color?: string }) {
  if (!series.length) return <Empty />;
  const w = 600;
  const h = height;
  const pad = 24;
  const max = Math.max(1, ...series.map((s) => s.count));
  const stepX = series.length > 1 ? (w - pad * 2) / (series.length - 1) : 0;
  const pts = series.map((s, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (s.count / max) * (h - pad * 2);
    return [x, y] as [number, number];
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad} L${pts[0][0].toFixed(1)},${h - pad} Z`;
  const short = (m: string) => { const [, mm] = m.split("-"); return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(mm, 10)] || m; };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={color} />)}
      {series.map((s, i) => (
        (series.length <= 12 || i % 2 === 0) ? <text key={i} x={pad + i * stepX} y={h - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">{short(s.month)}</text> : null
      ))}
    </svg>
  );
}

export function Donut({ data, size = 170 }: { data: { label: string; value: number; color?: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty />;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = frac * c;
            const seg = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color || CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={16} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} />
            );
            offset += dash;
            return seg;
          })}
        </g>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize="20" fontWeight="700" fill="#0f172a">{fmtNum(total)}</text>
      </svg>
      <ul className="space-y-1 text-xs">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color || CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="text-slate-600">{d.label}</span>
            <span className="text-slate-900 font-semibold ml-auto">{fmtNum(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBars({ data, unit = "", money = false }: { data: { name: string; value: number }[]; unit?: string; money?: boolean }) {
  if (!data.length) return <Empty />;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2">
      {data.map((d, i) => (
        <li key={i}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-slate-700 truncate max-w-[70%]" title={d.name}>{d.name}</span>
            <span className="text-slate-900 font-semibold">{money ? fmtMoney(d.value) : fmtNum(d.value)}{unit}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <div className="h-[120px] flex items-center justify-center text-xs text-slate-300">No data in range</div>;
}
