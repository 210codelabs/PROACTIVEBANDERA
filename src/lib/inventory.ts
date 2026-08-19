// Shared inventory helpers.

/** Built-in category slugs shipped with the app (always available). */
export const BUILTIN_CATEGORIES: { slug: string; name: string }[] = [
  { slug: "medication", name: "Medications" },
  { slug: "supply", name: "Clinical Supplies" },
  { slug: "retail", name: "Retail / OTC" },
  { slug: "aesthetic", name: "Aesthetic Consumables" },
  { slug: "equipment", name: "Equipment & Devices" },
];

export function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
