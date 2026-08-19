"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProductEditor, { type Category } from "@/components/inventory/ProductEditor";
import CategoryManager from "@/components/inventory/CategoryManager";

/** Top-of-page inventory actions: add a product, manage categories. */
export default function InventoryToolbar({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [showCats, setShowCats] = useState(false);

  const loadCats = useCallback(async () => {
    try {
      const r = await fetch("/api/inventory/categories");
      const d = await r.json();
      setCategories((d.categories || []).map((c: any) => ({ slug: c.slug, name: c.name, builtin: c.builtin })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadCats(); }, [loadCats]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => setShowEditor(true)} disabled={disabled} className="btn-primary disabled:opacity-50">+ Add product</button>
      <button onClick={() => setShowCats(true)} disabled={disabled} className="btn-secondary disabled:opacity-50">Manage categories</button>

      {showEditor && (
        <ProductEditor
          categories={categories}
          onClose={() => setShowEditor(false)}
          onSaved={() => { setShowEditor(false); router.refresh(); }}
        />
      )}
      {showCats && (
        <CategoryManager onClose={() => setShowCats(false)} onChanged={() => { loadCats(); router.refresh(); }} />
      )}
    </div>
  );
}
