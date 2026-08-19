"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProductEditor, { type Category, type EditableItem } from "@/components/inventory/ProductEditor";

/** Per-row "Edit" button that opens the product editor prefilled. */
export default function ProductEditButton({ item, disabled }: { item: EditableItem; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadCats = useCallback(async () => {
    try {
      const r = await fetch("/api/inventory/categories");
      const d = await r.json();
      setCategories((d.categories || []).map((c: any) => ({ slug: c.slug, name: c.name, builtin: c.builtin })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (open) loadCats(); }, [open, loadCats]);

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={disabled} className="ml-2 text-xs text-brand-700 hover:underline disabled:opacity-40">Edit</button>
      {open && (
        <ProductEditor
          item={item}
          categories={categories}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); router.refresh(); }}
        />
      )}
    </>
  );
}
