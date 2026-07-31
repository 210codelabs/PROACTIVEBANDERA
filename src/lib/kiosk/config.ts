// Shared catalog + config helpers for the Kiosk Mode slideshow.
// The slide CONTENT lives in src/app/kiosk/page.tsx (rich bilingual data).
// Here we keep only stable IDs + human labels so staff can toggle visibility
// and reorder slides from Settings, and the kiosk can resolve the config.

export type KioskSlideMeta = { id: string; label: string; kind: "photo" | "flyer" | "flyerad" | "ad" };

export const KIOSK_SLIDES_KEY = "kiosk_slides";

// Default order shown when no config has been saved yet.
export const KIOSK_SLIDE_CATALOG: KioskSlideMeta[] = [
  { id: "welcome", label: "Welcome — Comprehensive Care", kind: "photo" },
  { id: "dot", label: "DOT Medical Exams (uploaded flyer)", kind: "flyer" },
  { id: "physical", label: "Physical Therapy", kind: "flyerad" },
  { id: "pain", label: "Pain Management", kind: "flyerad" },
  { id: "chiropractic", label: "Chiropractic Care", kind: "flyerad" },
  { id: "iv", label: "IV Vitamin Therapy", kind: "flyerad" },
  { id: "telehealth", label: "Telehealth Visits", kind: "flyerad" },
  { id: "primary", label: "Primary Care", kind: "flyerad" },
  { id: "security", label: "HIPAA / Patient Portal", kind: "ad" },
];

export type KioskSlideConfig = { id: string; enabled: boolean };

export function defaultKioskConfig(): KioskSlideConfig[] {
  return KIOSK_SLIDE_CATALOG.map((s) => ({ id: s.id, enabled: true }));
}

// Ensure the stored config always covers every known slide (in stored order),
// drops unknown ids, and appends any newly-added slides at the end (enabled).
export function normalizeConfig(raw: unknown): KioskSlideConfig[] {
  const known = new Set(KIOSK_SLIDE_CATALOG.map((s) => s.id));
  const stored = Array.isArray(raw) ? raw : [];
  const result: KioskSlideConfig[] = [];
  const seen = new Set<string>();
  for (const item of stored) {
    const id = item && typeof item === "object" ? (item as { id?: unknown }).id : undefined;
    if (typeof id === "string" && known.has(id) && !seen.has(id)) {
      const enabled = (item as { enabled?: unknown }).enabled !== false;
      result.push({ id, enabled });
      seen.add(id);
    }
  }
  for (const s of KIOSK_SLIDE_CATALOG) {
    if (!seen.has(s.id)) result.push({ id: s.id, enabled: true });
  }
  return result;
}
