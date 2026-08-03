// -------------------------------------------------------------------------
// Shared "mannequin" body-map geometry used by BOTH the online SVG picker
// and the PDF renderer. Coordinates live in a fixed 200 x 460 canvas box.
// Markers are stored NORMALIZED (0..1) relative to that box, so the same
// data renders identically on screen and on paper.
// -------------------------------------------------------------------------

export const BODY_BOX = { w: 200, h: 460 };

export type Shape =
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "rect"; x: number; y: number; w: number; h: number; rx?: number };

// A simple, recognizable front/back humanoid silhouette (outline guide).
export const MANNEQUIN: Shape[] = [
  { type: "circle", cx: 100, cy: 44, r: 30 }, // head
  { type: "rect", x: 92, y: 70, w: 16, h: 16, rx: 6 }, // neck
  { type: "rect", x: 60, y: 84, w: 80, h: 150, rx: 18 }, // torso
  { type: "rect", x: 38, y: 92, w: 20, h: 132, rx: 10 }, // left arm
  { type: "rect", x: 142, y: 92, w: 20, h: 132, rx: 10 }, // right arm
  { type: "rect", x: 68, y: 232, w: 28, h: 206, rx: 13 }, // left leg
  { type: "rect", x: 104, y: 232, w: 28, h: 206, rx: 13 }, // right leg
];

export type Marker = { x: number; y: number; type?: string }; // normalized 0..1 + pain type
export type BodyMapValue = { front: Marker[]; back: Marker[] };

// Pain descriptors with display colors (hex for SVG, used by PDF too).
export const PAIN_TYPES: { key: string; label: string; labelEs: string; color: string }[] = [
  { key: "sharp", label: "Sharp", labelEs: "Agudo", color: "#DC2626" },
  { key: "dull", label: "Dull / Aching", labelEs: "Sordo / Dolor", color: "#D97706" },
  { key: "burning", label: "Burning", labelEs: "Ardor", color: "#DB2777" },
  { key: "numb", label: "Numbness", labelEs: "Entumecimiento", color: "#2563EB" },
  { key: "tingling", label: "Tingling", labelEs: "Hormigueo", color: "#7C3AED" },
  { key: "stiff", label: "Stiffness", labelEs: "Rigidez", color: "#0F766E" },
];

export function painType(key?: string) {
  return PAIN_TYPES.find((p) => p.key === key) || PAIN_TYPES[0];
}

export function emptyBodyMap(): BodyMapValue {
  return { front: [], back: [] };
}

export function bodyMapCount(v: any): number {
  if (!v || typeof v !== "object") return 0;
  const f = Array.isArray(v.front) ? v.front.length : 0;
  const b = Array.isArray(v.back) ? v.back.length : 0;
  return f + b;
}
