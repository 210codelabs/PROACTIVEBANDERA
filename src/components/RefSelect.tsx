"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type RefItem = {
  id: string;
  type: string;
  code: string | null;
  display: string;
  system: string | null;
  data?: Record<string, unknown> | null;
};

type Props = {
  /** Catalog type, e.g. "diagnosis", "allergen", "insurer" */
  type: string;
  /** Field label shown above the control */
  label: string;
  /** Form field name that receives the selected display value */
  name: string;
  /** Optional form field name that receives the selected code (ICD-10 / CPT / CVX...) */
  codeName?: string;
  required?: boolean;
  /** Pre-selected display value (for edit forms) */
  defaultValue?: string;
  defaultCode?: string;
  placeholder?: string;
  /** Whether staff can add new values to the catalog (default true) */
  allowCreate?: boolean;
  /** Show the code alongside the display in the list */
  showCode?: boolean;
  /** Which value feeds the `name` field: the display text or the code */
  emit?: "display" | "code";
};

export default function RefSelect({
  type,
  label,
  name,
  codeName,
  required,
  defaultValue = "",
  defaultCode = "",
  placeholder = "Search or select…",
  allowCreate = true,
  showCode = true,
  emit = "display",
}: Props) {
  const [items, setItems] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ display: string; code: string }>({
    display: defaultValue,
    code: defaultCode,
  });

  // Create-new panel state
  const [creating, setCreating] = useState(false);
  const [newDisplay, setNewDisplay] = useState("");
  const [newCode, setNewCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const boxRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/refdata?type=${encodeURIComponent(type)}&limit=500`);
      const json = await res.json();
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.display.toLowerCase().includes(q) ||
        (i.code ? i.code.toLowerCase().includes(q) : false),
    );
  }, [items, query]);

  function pick(item: RefItem) {
    setSelected({ display: item.display, code: item.code ?? "" });
    setOpen(false);
    setQuery("");
  }

  function clearSelection() {
    setSelected({ display: "", code: "" });
  }

  async function saveNew() {
    setError("");
    const display = newDisplay.trim();
    if (!display) {
      setError("Please enter a value.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/refdata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, display, code: newCode.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Could not save.");
        return;
      }
      const item: RefItem = json.item;
      setItems((prev) => {
        const exists = prev.some((p) => p.id === item.id);
        return exists ? prev : [...prev, item];
      });
      pick(item);
      setCreating(false);
      setNewDisplay("");
      setNewCode("");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="block" ref={boxRef as React.RefObject<HTMLLabelElement>}>
      <span className="label">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>

      {/* Hidden inputs feed the existing form submit (FormData) */}
      <input
        type="hidden"
        name={name}
        value={emit === "code" ? selected.code : selected.display}
        required={required}
      />
      {codeName ? <input type="hidden" name={codeName} value={selected.code} /> : null}

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setCreating(false);
          }}
          className="input flex w-full items-center justify-between text-left"
        >
          <span className={selected.display ? "" : "text-slate-400"}>
            {selected.display
              ? showCode && selected.code
                ? `${selected.code} — ${selected.display}`
                : selected.display
              : placeholder}
          </span>
          <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {selected.display && !required ? (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            title="Clear"
          >
            ✕
          </button>
        ) : null}

        {open ? (
          <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-xl">
            {!creating ? (
              <>
                <div className="p-2 border-b border-slate-100">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type to search…"
                    className="input w-full"
                  />
                </div>
                <div className="max-h-60 overflow-auto py-1">
                  {loading ? (
                    <div className="px-3 py-2 text-sm text-slate-400">Loading…</div>
                  ) : filtered.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-400">No matches.</div>
                  ) : (
                    filtered.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => pick(item)}
                        className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm hover:bg-brand-50"
                      >
                        {showCode && item.code ? (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                            {item.code}
                          </span>
                        ) : null}
                        <span className="text-slate-700">{item.display}</span>
                      </button>
                    ))
                  )}
                </div>
                {allowCreate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(true);
                      setNewDisplay(query);
                      setError("");
                    }}
                    className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create new…
                  </button>
                ) : null}
              </>
            ) : (
              /* Wrapped "create new" box with close option */
              <div className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Add new {label.toLowerCase()}</span>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="text-slate-400 hover:text-slate-600"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
                <input
                  autoFocus
                  value={newDisplay}
                  onChange={(e) => setNewDisplay(e.target.value)}
                  placeholder="Name / description"
                  className="input mb-2 w-full"
                />
                {showCode ? (
                  <input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="Code (optional)"
                    className="input mb-2 w-full font-mono"
                  />
                ) : null}
                {error ? <p className="mb-2 text-xs text-red-500">{error}</p> : null}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveNew}
                    disabled={saving}
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save & select"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Saved to the clinic catalog and available for future entries.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}
