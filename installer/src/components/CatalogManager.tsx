"use client";
import { useEffect, useState } from "react";

type Item = {
  id: string;
  type: string;
  code: string | null;
  display: string;
  system: string | null;
  active: boolean;
};

const CATALOGS: { type: string; label: string; coded: boolean }[] = [
  { type: "diagnosis", label: "Diagnoses (ICD-10-CM)", coded: true },
  { type: "billingCode", label: "Billing Codes (CPT/HCPCS)", coded: true },
  { type: "medication", label: "Medications (RxNorm)", coded: false },
  { type: "vaccine", label: "Vaccines (CVX)", coded: true },
  { type: "allergen", label: "Allergens", coded: false },
  { type: "allergyReaction", label: "Allergy Reactions", coded: false },
  { type: "allergySeverity", label: "Allergy Severity", coded: false },
  { type: "problemStatus", label: "Problem Status", coded: false },
  { type: "medForm", label: "Medication Forms", coded: false },
  { type: "medRoute", label: "Medication Routes", coded: true },
  { type: "medFrequency", label: "Medication Frequencies", coded: true },
  { type: "insurer", label: "Insurers", coded: false },
  { type: "language", label: "Languages", coded: false },
  { type: "race", label: "Race", coded: false },
  { type: "ethnicity", label: "Ethnicity", coded: false },
  { type: "maritalStatus", label: "Marital Status", coded: false },
  { type: "usState", label: "US States", coded: true },
  { type: "sex", label: "Sex", coded: true },
  { type: "pronouns", label: "Pronouns", coded: false },
  { type: "apptLocation", label: "Appointment Locations", coded: false },
];

export default function CatalogManager() {
  const [active, setActive] = useState(CATALOGS[0].type);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editDisplay, setEditDisplay] = useState("");
  const [editCode, setEditCode] = useState("");
  const [newDisplay, setNewDisplay] = useState("");
  const [newCode, setNewCode] = useState("");
  const [saving, setSaving] = useState(false);

  const current = CATALOGS.find((c) => c.type === active)!;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/refdata?type=${active}&all=1&limit=500`);
      const json = await res.json();
      setItems(Array.isArray(json.items) ? json.items : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    setEditing(null);
    setNewDisplay("");
    setNewCode("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const filtered = items.filter(
    (i) => !q || i.display.toLowerCase().includes(q.toLowerCase()) || (i.code || "").toLowerCase().includes(q.toLowerCase()),
  );

  async function addNew() {
    if (!newDisplay.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/refdata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: active, display: newDisplay.trim(), code: newCode.trim() || undefined }),
      });
      setNewDisplay("");
      setNewCode("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      await fetch(`/api/refdata/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display: editDisplay, code: editCode }),
      });
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: Item) {
    await fetch(`/api/refdata/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    await load();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Catalog list */}
      <aside className="card card-pad lg:col-span-1 h-fit">
        <h2 className="font-semibold text-slate-900 mb-2">Catalogs</h2>
        <div className="space-y-0.5 max-h-[70vh] overflow-auto">
          {CATALOGS.map((c) => (
            <button
              key={c.type}
              onClick={() => setActive(c.type)}
              className={`block w-full text-left px-3 py-1.5 rounded-md text-sm ${active === c.type ? "bg-brand-100 text-brand-800 font-medium" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Items */}
      <section className="card lg:col-span-3">
        <header className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="font-semibold">{current.label} ({filtered.length})</div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input max-w-xs py-1" />
        </header>

        {/* Add new */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-end gap-2">
          {current.coded && (
            <label className="block">
              <span className="label">Code</span>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} className="input py-1 w-28 font-mono" placeholder="Code" />
            </label>
          )}
          <label className="block flex-1 min-w-[200px]">
            <span className="label">New value</span>
            <input value={newDisplay} onChange={(e) => setNewDisplay(e.target.value)} className="input py-1" placeholder={`Add to ${current.label}…`} />
          </label>
          <button onClick={addNew} disabled={saving || !newDisplay.trim()} className="btn-primary py-1.5">Add</button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="data">
            <thead><tr>{current.coded && <th className="w-28">Code</th>}<th>Value</th><th className="w-24">Status</th><th className="w-40 text-right">Actions</th></tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className={item.active ? "" : "opacity-50"}>
                  {current.coded && (
                    <td className="font-mono text-xs">
                      {editing === item.id ? (
                        <input value={editCode} onChange={(e) => setEditCode(e.target.value)} className="input py-0.5 w-24 font-mono" />
                      ) : (item.code || "—")}
                    </td>
                  )}
                  <td>
                    {editing === item.id ? (
                      <input value={editDisplay} onChange={(e) => setEditDisplay(e.target.value)} className="input py-0.5" />
                    ) : item.display}
                  </td>
                  <td>
                    <span className={`chip ${item.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                      {item.active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="text-right space-x-2 text-xs">
                    {editing === item.id ? (
                      <>
                        <button onClick={() => saveEdit(item.id)} disabled={saving} className="text-brand-600 font-medium hover:text-brand-800">Save</button>
                        <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditing(item.id); setEditDisplay(item.display); setEditCode(item.code || ""); }} className="text-brand-600 hover:text-brand-800">Edit</button>
                        <button onClick={() => toggleActive(item)} className={item.active ? "text-rose-500 hover:text-rose-700" : "text-emerald-600 hover:text-emerald-800"}>
                          {item.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
