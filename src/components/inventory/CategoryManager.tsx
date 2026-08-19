"use client";

import React, { useEffect, useState } from "react";

type Cat = { id: string | null; slug: string; name: string; description?: string | null; builtin: boolean; count: number };

export default function CategoryManager({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/inventory/categories");
    const d = await r.json();
    setCats(d.categories || []);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/inventory/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not add category."); return; }
      setName("");
      await load();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this category? Existing products keep their tag.")) return;
    await fetch(`/api/inventory/categories/${id}`, { method: "DELETE" });
    await load();
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md my-12" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-3 border-b border-slate-200 flex items-center">
          <span className="font-semibold text-slate-900">Manage categories</span>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </header>
        <form onSubmit={add} className="p-4 flex gap-2 border-b border-slate-100">
          <input className="input flex-1" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary" disabled={busy} type="submit">{busy ? "…" : "Add"}</button>
        </form>
        {err && <div className="px-4 py-2 text-xs text-rose-600">{err}</div>}
        <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {cats.map((c) => (
            <li key={c.slug} className="px-4 py-2.5 flex items-center gap-2 text-sm">
              <div className="flex-1">
                <span className="font-medium text-slate-900">{c.name}</span>
                <span className="text-[11px] text-slate-400 ml-2">{c.count} item{c.count === 1 ? "" : "s"}</span>
                {c.builtin && <span className="chip bg-slate-100 text-slate-500 ring-slate-200 text-[9px] ml-2">built-in</span>}
              </div>
              {!c.builtin && c.id && <button onClick={() => remove(c.id!)} className="text-rose-600 text-xs hover:underline">Delete</button>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
