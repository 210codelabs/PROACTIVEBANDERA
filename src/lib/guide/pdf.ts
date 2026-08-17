/* Branded, print-ready Complete User Guide PDF (photorealistic heroes + real
   app screenshots). Built from the same content as the web guide. Server-only. */
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from "pdf-lib";
import fs from "fs";
import path from "path";
import { GUIDE_SECTIONS, GuideBlock } from "@/lib/guide/content";

const BRAND = rgb(0.055, 0.278, 0.42);
const BRAND2 = rgb(0.02, 0.45, 0.62);
const ACCENT = rgb(0.02, 0.55, 0.55);
const INK = rgb(0.13, 0.17, 0.22);
const MUTED = rgb(0.45, 0.5, 0.56);
const LINE = rgb(0.82, 0.86, 0.9);
const WHITE = rgb(1, 1, 1);
const TIP_BG = rgb(0.9, 0.96, 0.99);
const WARN_BG = rgb(0.99, 0.96, 0.86);
const CARD_BG = rgb(0.97, 0.98, 0.99);

const PW = 612, PH = 792, M = 48;
const CW = PW - M * 2;

function readPublic(rel: string): Buffer | null {
  try { return fs.readFileSync(path.join(process.cwd(), "public", rel.replace(/^\//, ""))); }
  catch { return null; }
}

// Standard Helvetica uses WinAnsi and cannot encode arrows/curly punctuation.
// Normalise to safe equivalents and drop anything still non-Latin1.
function san(s: any): string {
  return String(s ?? "")
    .replace(/\u2192/g, "->").replace(/\u2190/g, "<-")
    .replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...")
    .replace(/[\u2039\u2264]/g, "<").replace(/[\u203A\u2265]/g, ">")
    .replace(/[\u2022\u00b7]/g, "-").replace(/\u00a0/g, " ")
    .replace(/[^\x00-\xFF]/g, "");
}

export async function buildGuidePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const imgCache = new Map<string, PDFImage | null>();
  async function img(rel: string): Promise<PDFImage | null> {
    if (imgCache.has(rel)) return imgCache.get(rel)!;
    const bytes = readPublic(rel);
    let out: PDFImage | null = null;
    if (bytes) {
      try { out = rel.toLowerCase().endsWith(".png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes); }
      catch { out = null; }
    }
    imgCache.set(rel, out);
    return out;
  }

  // Pre-embed every image the guide uses, so the (synchronous) block renderer
  // can pull them from the cache.
  for (const s of GUIDE_SECTIONS) {
    await img(s.hero);
    for (const b of s.blocks) if (b.type === "shot") await img(b.src);
  }

  let page: PDFPage = doc.addPage([PW, PH]);
  let y = PH - M;
  let pageNo = 0;

  function footer() {
    pageNo += 1;
    page.drawText("Proactive Clinic — Complete User Guide", { x: M, y: 26, size: 7.5, font, color: MUTED });
    page.drawText(String(pageNo), { x: PW - M - 12, y: 26, size: 7.5, font, color: MUTED });
  }
  function newPage() { footer(); page = doc.addPage([PW, PH]); y = PH - M; }
  function ensure(space: number) { if (y - space < M + 26) newPage(); }

  function wrap(text: string, f: PDFFont, size: number, maxW: number): string[] {
    const words = san(text).split(/\s+/);
    const lines: string[] = []; let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (f.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function paragraph(text: string, opts: { size?: number; f?: PDFFont; color?: any; x?: number; maxW?: number; lh?: number } = {}) {
    const size = opts.size ?? 10.5, f = opts.f ?? font, color = opts.color ?? INK;
    const x = opts.x ?? M, maxW = opts.maxW ?? CW, lh = opts.lh ?? size + 4;
    for (const ln of wrap(text, f, size, maxW)) {
      ensure(lh);
      page.drawText(ln, { x, y: y - size, size, font: f, color });
      y -= lh;
    }
  }

  // draw an image fit within (maxW x maxH), left-aligned, returns drawn height
  function drawImageFit(image: PDFImage, maxW: number, maxH: number, x = M): number {
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const w = image.width * scale, h = image.height * scale;
    ensure(h + 6);
    page.drawImage(image, { x, y: y - h, width: w, height: h });
    // subtle border
    page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: LINE, borderWidth: 0.5 });
    y -= h;
    return h;
  }

  // ---------- COVER ----------
  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: BRAND });
  const hero = await img("/guide/img/clinical.jpg");
  if (hero) {
    const scale = Math.max(PW / hero.width, 300 / hero.height);
    const w = hero.width * scale, h = hero.height * scale;
    page.drawImage(hero, { x: (PW - w) / 2, y: PH - h, width: w, height: h, opacity: 0.32 });
  }
  const logo = readPublic("/pclinic-footer.png");
  if (logo) {
    try {
      const l = await doc.embedPng(logo);
      const lw = 220, ls = lw / l.width, lh = l.height * ls;
      page.drawImage(l, { x: (PW - lw) / 2, y: PH - 170, width: lw, height: lh });
    } catch {}
  }
  page.drawText("Complete User Guide", { x: M, y: 360, size: 34, font: bold, color: WHITE });
  page.drawText("EHR / EMR platform — for front desk, providers & billing", { x: M, y: 332, size: 13, font, color: rgb(0.85, 0.92, 0.96) });
  page.drawRectangle({ x: M, y: 300, width: 70, height: 4, color: ACCENT });
  const cov = [
    "Scheduling & calendar", "Patient registration & charting", "Clinical notes & orders",
    "Insurance eligibility", "Claims & revenue cycle", "Records requests & EHI export",
  ];
  let cy = 250;
  for (const c of cov) {
    page.drawCircle({ x: M + 4, y: cy + 3, size: 2.5, color: ACCENT });
    page.drawText(c, { x: M + 16, y: cy, size: 11.5, font, color: WHITE });
    cy -= 22;
  }
  page.drawText(`Generated ${new Date().toLocaleDateString("en-US", { dateStyle: "long" } as any)} · All times Central (CT)`, { x: M, y: 60, size: 9, font, color: rgb(0.8, 0.88, 0.93) });
  // start real content on a fresh page (no footer on cover)
  page = doc.addPage([PW, PH]); y = PH - M;

  // ---------- TABLE OF CONTENTS ----------
  page.drawText("Contents", { x: M, y: y - 22, size: 22, font: bold, color: BRAND });
  y -= 44;
  GUIDE_SECTIONS.forEach((s, i) => {
    ensure(22);
    page.drawText(`${i + 1}.`, { x: M, y: y - 11, size: 11, font: bold, color: ACCENT });
    page.drawText(san(s.title), { x: M + 22, y: y - 11, size: 11, font: bold, color: INK });
    y -= 16;
    for (const ln of wrap(s.summary, font, 9.5, CW - 24)) { ensure(13); page.drawText(ln, { x: M + 22, y: y - 9, size: 9.5, font, color: MUTED }); y -= 13; }
    y -= 6;
  });

  // ---------- SECTIONS ----------
  for (let i = 0; i < GUIDE_SECTIONS.length; i++) {
    const s = GUIDE_SECTIONS[i];
    newPage(); // each section starts on a new page

    // section hero banner
    const h = await img(s.hero);
    if (h) {
      const bandH = 120, scale = Math.max(CW / h.width, bandH / h.height);
      const w = h.width * scale, hh = h.height * scale;
      // clip band by drawing image then overlay for text
      ensure(bandH);
      page.drawImage(h, { x: M, y: y - bandH, width: CW, height: bandH });
      page.drawRectangle({ x: M, y: y - bandH, width: CW, height: bandH, color: rgb(0.04, 0.12, 0.2), opacity: 0.45 });
      page.drawText(`${i + 1}. ${san(s.title)}`, { x: M + 14, y: y - 40, size: 19, font: bold, color: WHITE });
      for (const ln of wrap(s.summary, font, 10, CW - 28)) {
        page.drawText(ln, { x: M + 14, y: y - 58 - 0, size: 10, font, color: rgb(0.92, 0.95, 0.98) });
        break; // one line summary in banner
      }
      if (s.audience) page.drawText(`For: ${san(s.audience)}`, { x: M + 14, y: y - bandH + 12, size: 8.5, font: bold, color: rgb(0.85, 0.95, 0.9) });
      y -= bandH + 14;
    } else {
      page.drawText(`${i + 1}. ${san(s.title)}`, { x: M, y: y - 22, size: 20, font: bold, color: BRAND });
      y -= 34;
    }

    for (const b of s.blocks) renderBlock(b);
  }

  function renderBlock(b: GuideBlock) {
    if (b.type === "p") { paragraph(b.text, { size: 10.5, color: INK, lh: 15 }); y -= 4; return; }
    if (b.type === "subhead") {
      ensure(26); y -= 6;
      page.drawText(san(b.text), { x: M, y: y - 13, size: 13.5, font: bold, color: BRAND });
      page.drawLine({ start: { x: M, y: y - 18 }, end: { x: PW - M, y: y - 18 }, thickness: 0.8, color: ACCENT });
      y -= 26; return;
    }
    if (b.type === "steps") {
      const pad = 12;
      // measure required height
      let need = pad * 2 + (b.title ? 18 : 0);
      const rows = b.items.map((it) => wrap(it, font, 10, CW - pad * 2 - 26));
      for (const lines of rows) need += Math.max(16, lines.length * 13 + 2);
      ensure(need + 8);
      const boxTop = y;
      const boxBottom = y - need;
      // background FIRST
      page.drawRectangle({ x: M, y: boxBottom, width: CW, height: need, color: CARD_BG, borderColor: LINE, borderWidth: 0.5 });
      // content on top
      let iy = boxTop - pad;
      if (b.title) { page.drawText(san(b.title).toUpperCase(), { x: M + pad, y: iy - 9, size: 8.5, font: bold, color: ACCENT }); iy -= 18; }
      b.items.forEach((it, idx) => {
        const lines = rows[idx];
        const rowH = Math.max(16, lines.length * 13 + 2);
        page.drawCircle({ x: M + pad + 8, y: iy - 8, size: 8, color: BRAND });
        page.drawText(String(idx + 1), { x: M + pad + (idx + 1 >= 10 ? 4.5 : 6), y: iy - 11, size: 8, font: bold, color: WHITE });
        lines.forEach((ln, li) => page.drawText(ln, { x: M + pad + 26, y: iy - 8 - li * 13, size: 10, font, color: INK }));
        iy -= rowH;
      });
      y = boxBottom - 10;
      return;
    }
    if (b.type === "tip") {
      const warn = b.kind === "warn"; const pad = 10;
      const lines = wrap((warn ? "Important: " : "Tip: ") + b.text, font, 9.5, CW - pad * 2);
      const boxH = lines.length * 13 + pad * 2 + 2;
      ensure(boxH + 6);
      page.drawRectangle({ x: M, y: y - boxH, width: CW, height: boxH, color: warn ? WARN_BG : TIP_BG, borderColor: warn ? rgb(0.9, 0.7, 0.2) : rgb(0.4, 0.7, 0.85), borderWidth: 0.6 });
      lines.forEach((ln, li) => page.drawText(ln, { x: M + pad, y: y - pad - 4 - li * 13, size: 9.5, font: li === 0 ? bold : font, color: warn ? rgb(0.4, 0.28, 0.02) : rgb(0.06, 0.3, 0.42) }));
      y -= boxH + 8; return;
    }
    if (b.type === "shot") {
      // (image resolved synchronously via cache pre-load below)
      const image = imgCache.get(b.src);
      y -= 2;
      if (image) {
        drawImageFit(image, CW, 320);
        ensure(14);
        page.drawText(san(b.caption), { x: M, y: y - 10, size: 8.5, font, color: MUTED });
        y -= 18;
      } else {
        paragraph(`[screenshot: ${b.caption}]`, { size: 9, color: MUTED });
      }
      return;
    }
  }

  footer(); // footer on last page

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
