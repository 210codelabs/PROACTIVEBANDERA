import { db } from "@/lib/db";

// Single source of truth for a deployment's clinic identity, look & feel and
// enabled modules. Stored as one AppSetting row (key 'site_config') so a fresh
// deployment can be fully re-branded from the /setup wizard without code edits.

export type SiteModules = {
  ehr: boolean;
  portal: boolean;
  kiosk: boolean;
  legal: boolean;
  pharmacyPos: boolean;
  aiAssistant: boolean;
  attorneyPortal: boolean;
};

export type SiteConfig = {
  setupComplete: boolean;
  identity: {
    clinicName: string;
    division: string;
    tagline: string;
    addressLine: string;
    city: string;
    state: string;
    postalCode: string;
    phone: string;
    email: string;
    website: string;
  };
  colors: { primary: string; secondary: string; accent: string };
  logos: { header: string; footer: string };
  slides: { hero: string[]; kiosk: string[] };
  modules: SiteModules;
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  setupComplete: false,
  identity: {
    clinicName: "Proactive Clinic",
    division: "A Division of Proactive UMS Inc.",
    tagline: "Comprehensive Wellness & Recovery",
    addressLine: "8103 Bandera Rd, Suite 102",
    city: "San Antonio",
    state: "TX",
    postalCode: "78250",
    phone: "(210) 500-2914",
    email: "support@proactiveclinic.com",
    website: "https://proactiveclinics.com",
  },
  colors: { primary: "#1872f0", secondary: "#0b1e35", accent: "#10b981" },
  logos: { header: "/pclinic-header.png?v=2", footer: "/pclinic-footer.png?v=2" },
  slides: { hero: [], kiosk: [] },
  modules: {
    ehr: true,
    portal: true,
    kiosk: true,
    legal: true,
    pharmacyPos: true,
    aiAssistant: true,
    attorneyPortal: true,
  },
};

const KEY = "site_config";

function deepMerge<T>(base: T, override: unknown): T {
  if (override == null || typeof override !== "object") return base;
  const out: Record<string, unknown> = Array.isArray(base) ? ([...(base as unknown[])] as unknown as Record<string, unknown>) : { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    if (b && typeof b === "object" && !Array.isArray(b) && v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(b, v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: KEY } });
    if (!row?.value) return DEFAULT_SITE_CONFIG;
    return deepMerge(DEFAULT_SITE_CONFIG, row.value);
  } catch {
    return DEFAULT_SITE_CONFIG;
  }
}

export async function saveSiteConfig(patch: Partial<SiteConfig>): Promise<SiteConfig> {
  const current = await getSiteConfig();
  const next = deepMerge(current, patch);
  await db.appSetting.upsert({
    where: { key: KEY },
    update: { value: next as unknown as object },
    create: { key: KEY, value: next as unknown as object },
  });
  return next;
}

// Convenience helpers for server components.
export function fullAddress(c: SiteConfig): string {
  const { addressLine, city, state, postalCode } = c.identity;
  return [addressLine, [city, state].filter(Boolean).join(", "), postalCode].filter(Boolean).join(", ");
}
