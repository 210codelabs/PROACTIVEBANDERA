"use client";
import { useEffect, useState } from "react";
import DrugSearch from "@/components/drugs/DrugSearch";
import DrugReference from "@/components/drugs/DrugReference";
import type { DrugHit } from "@/lib/openfda";

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
  const [drug, setDrug] = useState<DrugHit | null>(null);

  const current = CATALOGS.find((c) => c.type === active)!;
  const showCode = current.coded || active === "medication";

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
    setDrug(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const filtered = items.filter(
    (i) => !q || i.display.toLowerCase().includes(q.toLowerCase()) || (i.code || "").toLowerCase().includes(q.toLowerCase()),
  );

  // Prefill the "Add medication" form from an official openFDA product.
  function pickDrug(d: DrugHit) {
    const name = d.brandName || d.genericName || d.display;
    const label = [name, d.strengths[0], d.dosageForm].filter(Boolean).join(" ").trim();
    setNewDisplay(label || d.display);
    setNewCode(d.productNdc || "");
    setDrug(d);
  }

  async function addNew() {
    if (!newDisplay.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        type: active,
        display: newDisplay.trim(),
        code: newCode.trim() || undefined,
      };
      // When prefilled from openFDA, persist the NDC + official reference data.
      if (drug && active === "medication") {
        payload.code = (newCode.trim() || drug.productNdc) || undefined;
        payload.system = "openFDA-NDC";
        payload.data = {
          source: "openFDA",
          productNdc: drug.productNdc || null,
          rxcui: null,
          brandName: drug.brandName || null,
          genericName: drug.genericName || null,
          dosageForm: drug.dosageForm || null,
          route: drug.route || null,
          strengths: drug.strengths || [],
          activeIngredients: drug.activeIngredients || [],
          deaSchedule: drug.deaSchedule || null,
          labelerName: drug.labelerName || null,
          pharmClass: drug.pharmClass || [],
        };
      }
      await fetch("/api/refdata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNewDisplay("");
      setNewCode("");
      setDrug(null);
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
        {active === "medication" && (
          <div className="px-4 pt-3 border-b border-slate-100 bg-sky-50/40">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="chip bg-sky-100 text-sky-800 ring-sky-200">openFDA</span>
              <span className="text-xs text-slate-500">
                Search the official FDA NDC Directory to prefill a new medication (name, strength, form &amp; NDC).
              </span>
            </div>
            <DrugSearch onSelect={pickDrug} placeholder="Search FDA medications to prefill…" />
            {drug && (
              <div className="mt-2 mb-1 rounded-lg bg-white ring-1 ring-slate-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-semibold text-slate-900">{drug.brandName || drug.genericName}</span>
                    {drug.genericName && drug.genericName !== drug.brandName && (
                      <span className="text-slate-500"> · {drug.genericName}</span>
                    )}
                    <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-2">
                      {drug.productNdc && <span>NDC {drug.productNdc}</span>}
                      {drug.dosageForm && <span>{drug.dosageForm}</span>}
                      {drug.route && <span>{drug.route}</span>}
                      {drug.deaSchedule && <span className="text-amber-600 font-semibold">C-{drug.deaSchedule}</span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => { setDrug(null); setNewDisplay(""); setNewCode(""); }} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
                </div>
                <div className="mt-2">
                  <DrugReference productNdc={drug.productNdc} name={drug.genericName || drug.brandName} title="Official FDA labeling (reference)" />
                </div>
              </div>
            )}
          </div>
        )}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-end gap-2">
          {(current.coded || (active === "medication" && !!newCode)) && (
            <label className="block">
              <span className="label">{active === "medication" ? "NDC" : "Code"}</span>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} className="input py-1 w-32 font-mono" placeholder={active === "medication" ? "NDC" : "Code"} />
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
            <thead><tr>{showCode && <th className="w-32">{active === "medication" ? "NDC / Code" : "Code"}</th>}<th>Value</th><th className="w-24">Status</th><th className="w-40 text-right">Actions</th></tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className={item.active ? "" : "opacity-50"}>
                  {showCode && (
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
