"use client";

import { useMemo, useState } from "react";
import type { KioskSlideConfig, KioskSlideMeta } from "@/lib/kiosk/config";

const KIND_LABEL: Record<string, string> = {
  photo: "Photo",
  flyer: "Uploaded flyer",
  flyerad: "Service ad",
  ad: "Info card",
};
const KIND_CHIP: Record<string, string> = {
  photo: "bg-slate-100 text-slate-700 ring-slate-200",
  flyer: "bg-rose-100 text-rose-700 ring-rose-200",
  flyerad: "bg-brand-100 text-brand-800 ring-brand-200",
  ad: "bg-emerald-100 text-emerald-700 ring-emerald-200",
};

export default function KioskSlidesEditor({
  initialConfig,
  catalog,
}: {
  initialConfig: KioskSlideConfig[];
  catalog: KioskSlideMeta[];
}) {
  const metaById = useMemo(() => {
    const m: Record<string, KioskSlideMeta> = {};
    for (const c of catalog) m[c.id] = c;
    return m;
  }, [catalog]);

  const [rows, setRows] = useState<KioskSlideConfig[]>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const enabledCount = rows.filter((r) => r.enabled).length;

  function move(index: number, dir: -1 | 1) {
    const next = [...rows];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    setStatus(null);
  }

  function toggle(index: number) {
    const next = [...rows];
    next[index] = { ...next[index], enabled: !next[index].enabled };
    setRows(next);
    setStatus(null);
  }

  async function save() {
    if (enabledCount === 0) {
      setStatus({ ok: false, msg: "Enable at least one slide before saving." });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/kiosk/slides", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: rows }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, msg: json.error || "Failed to save." });
      } else {
        setRows(json.config);
        setStatus({ ok: true, msg: "Saved. The kiosk will use this order on its next load." });
      }
    } catch {
      setStatus({ ok: false, msg: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="card card-pad mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Kiosk slideshow order</h2>
            <p className="text-sm text-slate-500 mt-1">
              Choose which promotional slides appear on the lobby kiosk and in what order. Use the arrows to
              reorder and the toggle to show or hide each slide. Changes apply the next time the kiosk loads.
            </p>
          </div>
          <a
            href="/kiosk"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 chip bg-brand-100 text-brand-800 ring-brand-200 hover:bg-brand-200"
          >
            Preview kiosk ↗
          </a>
        </div>
      </div>

      <div className="card overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {rows.map((row, i) => {
            const meta = metaById[row.id];
            if (!meta) return null;
            return (
              <li
                key={row.id}
                className={`flex items-center gap-3 px-4 py-3 ${row.enabled ? "" : "bg-slate-50/60"}`}
              >
                <div className="flex flex-col">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="h-6 w-6 grid place-items-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === rows.length - 1}
                    className="h-6 w-6 grid place-items-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                </div>

                <span className="w-6 text-center text-sm font-semibold text-slate-400">{i + 1}</span>

                <div className="flex-1 min-w-0">
                  <div className={`font-medium truncate ${row.enabled ? "text-slate-900" : "text-slate-400"}`}>
                    {meta.label}
                  </div>
                  <span className={`chip mt-1 text-[11px] ring-1 ${KIND_CHIP[meta.kind] || KIND_CHIP.photo}`}>
                    {KIND_LABEL[meta.kind] || meta.kind}
                  </span>
                </div>

                <button
                  onClick={() => toggle(i)}
                  role="switch"
                  aria-checked={row.enabled}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                    row.enabled ? "bg-brand-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      row.enabled ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save changes"}
        </button>
        <span className="text-sm text-slate-500">{enabledCount} of {rows.length} slides visible</span>
        {status && (
          <span className={`text-sm font-medium ${status.ok ? "text-emerald-600" : "text-rose-600"}`}>
            {status.msg}
          </span>
        )}
      </div>
    </div>
  );
}
