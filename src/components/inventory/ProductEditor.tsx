"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DrugHit } from "@/lib/openfda";
import DrugDatabaseSearch from "@/components/drugs/DrugDatabaseSearch";

export type Category = { slug: string; name: string; builtin?: boolean };

export type EditableItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  edition?: string | null;
  form?: string | null;
  strength?: string | null;
  ndc?: string | null;
  unit?: string | null;
  quantityOnHand: number;
  reorderLevel: number;
  unitCostCents: number;
  retailPriceCents: number;
  taxable?: boolean;
  controlled?: boolean;
  location?: string | null;
  supplier?: string | null;
  lotNumber?: string | null;
  expiresAt?: string | null;
  imageUrl?: string | null;
};

const dollars = (cents?: number | null) => (cents && cents > 0 ? (cents / 100).toFixed(2) : "");
const toCents = (v: string) => Math.round((parseFloat(v) || 0) * 100);

/**
 * Create/edit an inventory product. Includes an image upload button and an
 * optional openFDA/RxNorm database search to prefill medication fields.
 */
export default function ProductEditor({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item?: EditableItem | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(item?.id);
  const [name, setName] = useState(item?.name || "");
  const [sku, setSku] = useState(item?.sku || "");
  const [category, setCategory] = useState(item?.category || categories[0]?.slug || "supply");
  const [edition, setEdition] = useState(item?.edition || "");
  const [strength, setStrength] = useState(item?.strength || "");
  const [form, setForm] = useState(item?.form || "");
  const [unit, setUnit] = useState(item?.unit || "each");
  const [ndc, setNdc] = useState(item?.ndc || "");
  const [qty, setQty] = useState(String(item?.quantityOnHand ?? 0));
  const [reorder, setReorder] = useState(String(item?.reorderLevel ?? 0));
  const [cost, setCost] = useState(dollars(item?.unitCostCents));
  const [price, setPrice] = useState(dollars(item?.retailPriceCents));
  const [taxable, setTaxable] = useState(Boolean(item?.taxable));
  const [controlled, setControlled] = useState(Boolean(item?.controlled));
  const [location, setLocation] = useState(item?.location || "");
  const [supplier, setSupplier] = useState(item?.supplier || "");
  const [lot, setLot] = useState(item?.lotNumber || "");
  const [expires, setExpires] = useState(item?.expiresAt ? String(item.expiresAt).slice(0, 10) : "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl || "");

  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  function applyDrug(d: DrugHit) {
    setName(d.brandName || d.genericName || name);
    if (d.strengths?.[0]) setStrength(d.strengths[0]);
    if (d.dosageForm) setForm(d.dosageForm);
    if (d.productNdc) setNdc(d.productNdc);
    if (d.deaSchedule) setControlled(true);
    if (category === "supply") setCategory("medication");
    setShowSearch(false);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("kind", "inventory");
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Upload failed."); return; }
      setImageUrl(d.url);
    } catch {
      setErr("Image upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!name.trim()) { setErr("Product name is required."); return; }
    setBusy(true); setErr(null);
    const base: any = {
      name: name.trim(), category, edition: edition || null, form: form || null,
      strength: strength || null, ndc: ndc || null, unit: unit || "each",
      reorderLevel: parseInt(reorder, 10) || 0, unitCostCents: toCents(cost), retailPriceCents: toCents(price),
      taxable, controlled, location: location || null, supplier: supplier || null,
      lotNumber: lot || null, expiresAt: expires || null, imageUrl: imageUrl || null,
    };
    try {
      let r: Response;
      if (editing) {
        r = await fetch(`/api/inventory/${item!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(base) });
      } else {
        r = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...base, sku: sku || undefined, quantityOnHand: parseInt(qty, 10) || 0 }) });
      }
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Could not save product."); return; }
      onSaved();
    } catch {
      setErr("Could not save product.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <span className="font-semibold text-slate-900">{editing ? "Edit product" : "Add product"}</span>
          <button onClick={() => setShowSearch((v) => !v)} className="ml-auto btn-secondary py-1 px-2 text-xs">{showSearch ? "Hide" : "Search FDA / RxNorm"}</button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </header>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {showSearch && <DrugDatabaseSearch title="Prefill from medication database" onSelect={applyDrug} />}

          {err && <div className="rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-3 py-2 text-sm">{err}</div>}

          {/* Image */}
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-lg ring-1 ring-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="product" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] text-slate-400 text-center px-1">No image</span>
              )}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary py-1.5 px-3 text-sm">{uploading ? "Uploading…" : imageUrl ? "Change image" : "Upload image"}</button>
              {imageUrl && <button type="button" onClick={() => setImageUrl("")} className="ml-2 text-xs text-rose-600 hover:underline">Remove</button>}
              <div className="text-[10px] text-slate-400 mt-1">PNG/JPG/WEBP up to 3 MB.</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Product name *"><input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="SKU"><input className="input w-full" value={sku} onChange={(e) => setSku(e.target.value)} placeholder={editing ? "" : "auto-generated"} disabled={editing} /></Field>
            <Field label="Category">
              <select className="input w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Edition / variant"><input className="input w-full" value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="e.g. 2nd Gen, 500-pack" /></Field>
            <Field label="Strength"><input className="input w-full" value={strength} onChange={(e) => setStrength(e.target.value)} /></Field>
            <Field label="Form"><input className="input w-full" value={form} onChange={(e) => setForm(e.target.value)} /></Field>
            <Field label="Unit"><input className="input w-full" value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
            <Field label="NDC"><input className="input w-full" value={ndc} onChange={(e) => setNdc(e.target.value)} /></Field>
            {!editing && <Field label="Qty on hand"><input type="number" className="input w-full" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>}
            <Field label="Reorder level"><input type="number" className="input w-full" value={reorder} onChange={(e) => setReorder(e.target.value)} /></Field>
            <Field label="Unit cost ($)"><input type="number" step="0.01" className="input w-full" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
            <Field label="Retail price ($)"><input type="number" step="0.01" className="input w-full" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
            <Field label="Location"><input className="input w-full" value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
            <Field label="Supplier"><input className="input w-full" value={supplier} onChange={(e) => setSupplier(e.target.value)} /></Field>
            <Field label="Lot #"><input className="input w-full" value={lot} onChange={(e) => setLot(e.target.value)} /></Field>
            <Field label="Expires"><input type="date" className="input w-full" value={expires} onChange={(e) => setExpires(e.target.value)} /></Field>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} /> Taxable</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={controlled} onChange={(e) => setControlled(e.target.checked)} /> Controlled substance</label>
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={busy || uploading} className="btn-primary">{busy ? "Saving…" : editing ? "Save changes" : "Create product"}</button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
