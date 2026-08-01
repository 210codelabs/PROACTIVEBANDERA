// Color utilities to drive the app's brand palette from a single primary color.
// Tailwind's `brand.*` colors are wired to CSS variables (see globals.css +
// tailwind.config.ts). We generate an 11-step scale from one hex and emit the
// space-separated "R G B" triplets those variables expect.

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  let h = (hex || "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 24, g: 114, b: 240 }; // fallback brand-600
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbTriplet(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

function mix(a: Rgb, b: Rgb, weight: number): Rgb {
  // weight = amount of b mixed into a (0..1)
  const w = Math.max(0, Math.min(1, weight));
  return {
    r: Math.round(a.r * (1 - w) + b.r * w),
    g: Math.round(a.g * (1 - w) + b.g * w),
    b: Math.round(a.b * (1 - w) + b.b * w),
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

// Given a primary hex (treated as the 600 step), build a pleasing tonal scale.
export function generateBrandScale(primaryHex: string): Record<string, string> {
  const base = hexToRgb(primaryHex);
  const steps: Record<string, Rgb> = {
    "50": mix(base, WHITE, 0.95),
    "100": mix(base, WHITE, 0.88),
    "200": mix(base, WHITE, 0.75),
    "300": mix(base, WHITE, 0.58),
    "400": mix(base, WHITE, 0.33),
    "500": mix(base, WHITE, 0.15),
    "600": base,
    "700": mix(base, BLACK, 0.14),
    "800": mix(base, BLACK, 0.28),
    "900": mix(base, BLACK, 0.42),
    "950": mix(base, BLACK, 0.62),
  };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(steps)) out[k] = `${v.r} ${v.g} ${v.b}`;
  return out;
}

// Build the CSS text injected into a <style> tag to override :root variables.
export function buildThemeCss(colors: { primary: string; secondary: string; accent: string }): string {
  const scale = generateBrandScale(colors.primary);
  const brandVars = Object.entries(scale)
    .map(([k, v]) => `--brand-${k}: ${v};`)
    .join("");
  const secondary = hexToRgb(colors.secondary);
  const accent = rgbTriplet(colors.accent);
  const secHex = colors.secondary;
  return `:root{${brandVars}--accent-rgb:${accent};--navy-900:${secHex};--navy-800:rgb(${secondary.r} ${secondary.g} ${secondary.b});}`;
}
