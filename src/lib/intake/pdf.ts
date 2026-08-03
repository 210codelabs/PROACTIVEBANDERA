// -------------------------------------------------------------------------
// Branded PDF generator for Proactive Clinic intake / clinical forms.
// Renders any FormDef into a polished PDF using pdf-lib. Supports:
//   • language (en/es) via the shared i18n dictionary
//   • optional PREFILL values (filled copy for the chart)
//   • interactive Injury Body Map (blank or with marked points)
// Server-only (reads the logo from /public).
// -------------------------------------------------------------------------

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from "pdf-lib";
import fs from "fs";
import path from "path";
import { CLINIC, FormDef, Field, Width } from "./forms";
import { tr, Lang } from "./i18n";
import { MANNEQUIN, BODY_BOX } from "./bodymap";

const C_BRAND = rgb(0.055, 0.278, 0.42);
const C_ACCENT = rgb(0.02, 0.55, 0.55);
const C_LIGHT = rgb(0.91, 0.955, 0.98);
const C_INK = rgb(0.13, 0.17, 0.22);
const C_FILL = rgb(0.05, 0.32, 0.6); // filled-in answer ink
const C_MUTED = rgb(0.42, 0.47, 0.53);
const C_LINE = rgb(0.72, 0.77, 0.82);
const C_WHITE = rgb(1, 1, 1);
const C_MARK = rgb(0.86, 0.15, 0.15);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 46;
const CW = PAGE_W - MARGIN * 2;
const BOTTOM = 56;

let logoCache: Buffer | null | undefined;
function logoBytes(): Buffer | null {
  if (logoCache === undefined) {
    try {
      logoCache = fs.readFileSync(path.join(process.cwd(), "public", "pclinic-header.png"));
    } catch {
      logoCache = null;
    }
  }
  return logoCache;
}

function widthFrac(w?: Width): number {
  switch (w) {
    case "third":
      return 1 / 3;
    case "half":
      return 0.5;
    case "twothird":
      return 2 / 3;
    default:
      return 1;
  }
}

function asSelected(value: any, id?: string): string[] {
  if (value == null) return [];
  let arr: string[] = Array.isArray(value) ? value.map(String) : String(value).split(",").map((s) => s.trim());
  if (id === "sex") arr = arr.map((v) => (v === "F" ? "Female" : v === "M" ? "Male" : v));
  return arr.filter(Boolean);
}

export type RenderOpts = { values?: Record<string, any>; lang?: Lang };

export async function renderFormPdf(form: FormDef, opts: RenderOpts = {}): Promise<Uint8Array> {
  const lang: Lang = opts.lang === "es" ? "es" : "en";
  const values = opts.values || null;
  const T = (s?: string) => tr(s, lang);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  let logo: PDFImage | null = null;
  const lb = logoBytes();
  if (lb) {
    try {
      logo = await doc.embedPng(lb);
    } catch {
      logo = null;
    }
  }

  doc.setTitle(`${CLINIC.name} — ${T(form.title)}`);
  doc.setAuthor(CLINIC.name);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = 0;

  function wrap(text: string, f: PDFFont, size: number, maxW: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (f.widthOfTextAtSize(test, size) > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function rightText(p: PDFPage, text: string, ry: number, size: number, f: PDFFont, color: any) {
    const w = f.widthOfTextAtSize(text, size);
    p.drawText(text, { x: PAGE_W - MARGIN - w, y: ry, size, font: f, color });
  }

  function drawFooter(p: PDFPage) {
    p.drawLine({ start: { x: MARGIN, y: 44 }, end: { x: PAGE_W - MARGIN, y: 44 }, thickness: 0.5, color: C_LINE });
    const line1 = `${CLINIC.name}  •  ${CLINIC.addr1}, ${CLINIC.addr2}  •  ${CLINIC.phone}  •  ${CLINIC.web}`;
    p.drawText(line1, { x: MARGIN, y: 32, size: 7, font, color: C_MUTED });
    p.drawText(lang === "es" ? "Confidencial — parte del expediente médico del paciente." : "Confidential — part of the patient medical record.", {
      x: MARGIN,
      y: 22,
      size: 6.5,
      font,
      color: C_MUTED,
    });
  }

  function drawHeader(p: PDFPage, first: boolean) {
    p.drawRectangle({ x: 0, y: PAGE_H - 4, width: PAGE_W, height: 4, color: C_ACCENT });
    if (first) {
      let headerBottom = PAGE_H - 40;
      if (logo) {
        const targetW = 168;
        const scale = targetW / logo.width;
        const lh = logo.height * scale;
        const topY = PAGE_H - 22;
        p.drawImage(logo, { x: MARGIN, y: topY - lh, width: targetW, height: lh });
        headerBottom = topY - lh;
      } else {
        p.drawText(CLINIC.name, { x: MARGIN, y: PAGE_H - 44, size: 20, font: bold, color: C_BRAND });
        headerBottom = PAGE_H - 70;
      }
      const cy = PAGE_H - 26;
      rightText(p, CLINIC.addr1, cy, 8, font, C_MUTED);
      rightText(p, CLINIC.addr2, cy - 11, 8, font, C_MUTED);
      rightText(p, `${CLINIC.phone}`, cy - 22, 8, font, C_MUTED);
      rightText(p, `${CLINIC.web}`, cy - 33, 8, bold, C_BRAND);

      const ruleY = Math.min(headerBottom, PAGE_H - 74) - 6;
      p.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: PAGE_W - MARGIN, y: ruleY }, thickness: 1.2, color: C_BRAND });

      const bandTop = ruleY - 10;
      const bandH = 36;
      p.drawRectangle({ x: MARGIN, y: bandTop - bandH, width: CW, height: bandH, color: C_LIGHT });
      p.drawRectangle({ x: MARGIN, y: bandTop - bandH, width: 4, height: bandH, color: C_ACCENT });
      p.drawText(T(form.title), { x: MARGIN + 12, y: bandTop - 15, size: 15, font: bold, color: C_BRAND });
      p.drawText(T(form.subtitle), { x: MARGIN + 12, y: bandTop - 28, size: 8.5, font, color: C_MUTED });
      if (values) {
        const tag = lang === "es" ? "COPIA COMPLETADA" : "COMPLETED COPY";
        const tw = bold.widthOfTextAtSize(tag, 7);
        p.drawRectangle({ x: PAGE_W - MARGIN - tw - 12, y: bandTop - 22, width: tw + 12, height: 14, color: C_ACCENT });
        p.drawText(tag, { x: PAGE_W - MARGIN - tw - 6, y: bandTop - 18, size: 7, font: bold, color: C_WHITE });
      }
      y = bandTop - bandH - 18;
    } else {
      p.drawText(CLINIC.name, { x: MARGIN, y: PAGE_H - 24, size: 10, font: bold, color: C_BRAND });
      rightText(p, T(form.title), PAGE_H - 24, 8.5, font, C_MUTED);
      p.drawLine({ start: { x: MARGIN, y: PAGE_H - 32 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - 32 }, thickness: 0.8, color: C_LINE });
      y = PAGE_H - 48;
    }
  }

  function newPage() {
    drawFooter(page);
    page = doc.addPage([PAGE_W, PAGE_H]);
    drawHeader(page, false);
  }

  function ensure(h: number) {
    if (y - h < BOTTOM) newPage();
  }

  function line(x: number, lineY: number, w: number) {
    page.drawLine({ start: { x, y: lineY }, end: { x: x + w, y: lineY }, thickness: 0.7, color: C_LINE });
  }

  function checkbox(x: number, boxY: number, checked?: boolean) {
    page.drawRectangle({ x, y: boxY, width: 9, height: 9, borderColor: C_BRAND, borderWidth: 0.9, color: C_WHITE });
    if (checked) {
      page.drawText("X", { x: x + 1.4, y: boxY + 1, size: 8, font: bold, color: C_FILL });
    }
  }

  function fillText(x: number, baselineY: number, text: string, maxW: number) {
    if (!text) return;
    let t = text;
    while (t.length > 1 && font.widthOfTextAtSize(t, 8.5) > maxW) t = t.slice(0, -1);
    page.drawText(t, { x: x + 2, y: baselineY + 3, size: 8.5, font, color: C_FILL });
  }

  // text/date row
  function drawTextRow(cells: { label: string; id?: string }[], fracs: number[]) {
    const rowH = 30;
    ensure(rowH);
    const top = y;
    let x = MARGIN;
    for (let i = 0; i < cells.length; i++) {
      const cellW = CW * fracs[i];
      page.drawText(T(cells[i].label), { x, y: top - 9, size: 7.8, font: bold, color: C_INK });
      line(x, top - 24, cellW - 10);
      if (values && cells[i].id) fillText(x, top - 24, String(values[cells[i].id!] ?? ""), cellW - 14);
      x += cellW;
    }
    y = top - rowH;
  }

  function drawTextarea(f: Field & { kind: "textarea" }) {
    const lines = f.lines || 2;
    const h = 14 + lines * 18 + 6;
    ensure(h);
    const top = y;
    page.drawText(T(f.label), { x: MARGIN, y: top - 9, size: 7.8, font: bold, color: C_INK });
    const raw = values && f.id ? String(values[f.id] ?? "") : "";
    const wrapped = raw ? wrap(raw, font, 8.5, CW - 6) : [];
    for (let i = 0; i < lines; i++) {
      line(MARGIN, top - 26 - i * 18, CW);
      if (wrapped[i]) page.drawText(wrapped[i], { x: MARGIN + 2, y: top - 23 - i * 18, size: 8.5, font, color: C_FILL });
    }
    y = top - h;
  }

  function drawCheckboxes(f: Field & { kind: "checkboxes" }) {
    const selected = values && f.id ? asSelected(values[f.id], f.id) : [];
    let curY = y;
    if (f.label) {
      ensure(14);
      page.drawText(T(f.label), { x: MARGIN, y: curY - 9, size: 7.8, font: bold, color: C_INK });
      curY -= 16;
    }
    ensure(16);
    let x = MARGIN;
    for (const opt of f.options) {
      const label = T(opt);
      const tW = font.widthOfTextAtSize(label, 8);
      const chipW = 9 + 4 + tW + 16;
      if (x + chipW > PAGE_W - MARGIN) {
        x = MARGIN;
        curY -= 16;
        if (curY < BOTTOM) {
          y = curY;
          newPage();
          curY = y;
        }
      }
      checkbox(x, curY - 9, selected.includes(opt));
      page.drawText(label, { x: x + 13, y: curY - 8, size: 8, font, color: C_INK });
      x += chipW;
    }
    y = curY - 18;
  }

  function drawYesNo(f: Field & { kind: "yesno" }) {
    ensure(16);
    const top = y;
    const val = values && f.id ? String(values[f.id] ?? "") : "";
    page.drawText(T(f.label), { x: MARGIN, y: top - 9, size: 8, font, color: C_INK });
    const bx = PAGE_W - MARGIN - 96;
    checkbox(bx, top - 10, /yes|s[íi]/i.test(val));
    page.drawText(lang === "es" ? "Sí" : "Yes", { x: bx + 13, y: top - 9, size: 8, font, color: C_INK });
    checkbox(bx + 48, top - 10, /^no$/i.test(val));
    page.drawText("No", { x: bx + 61, y: top - 9, size: 8, font, color: C_INK });
    y = top - 18;
  }

  function drawSignature(f: Field & { kind: "signature" }) {
    const h = 40;
    ensure(h);
    const top = y;
    const w = CW * 0.62;
    line(MARGIN, top - 22, w);
    if (values && f.id && values[f.id]) {
      page.drawText(String(values[f.id]), { x: MARGIN + 4, y: top - 19, size: 12, font: italic, color: C_FILL });
    }
    page.drawText(T(f.label), { x: MARGIN, y: top - 34, size: 7.5, font, color: C_MUTED });
    const dx = MARGIN + w + 24;
    if (dx < PAGE_W - MARGIN - 60) {
      line(dx, top - 22, PAGE_W - MARGIN - dx);
      const dv = values ? String(values["signDate"] ?? values["date"] ?? "") : "";
      if (dv) page.drawText(dv, { x: dx + 4, y: top - 19, size: 9, font, color: C_FILL });
      page.drawText(lang === "es" ? "Fecha" : "Date", { x: dx, y: top - 34, size: 7.5, font, color: C_MUTED });
    }
    y = top - h;
  }

  function drawParagraph(f: Field & { kind: "paragraph" }) {
    const lines = wrap(T(f.text), font, 8.5, CW);
    for (const ln of lines) {
      ensure(12);
      page.drawText(ln, { x: MARGIN, y: y - 9, size: 8.5, font, color: C_INK });
      y -= 12;
    }
    if (f.ack) {
      y -= 4;
      ensure(16);
      const checked = !!(values && f.id && values[f.id]);
      checkbox(MARGIN, y - 9, checked);
      page.drawText(T(f.ackLabel) || (lang === "es" ? "Reconozco y acepto." : "I acknowledge and agree."), {
        x: MARGIN + 14,
        y: y - 8,
        size: 8.5,
        font: bold,
        color: C_BRAND,
      });
      y -= 16;
    }
    y -= 6;
  }

  function drawPairs(f: Field & { kind: "pairs" }) {
    ensure(30);
    page.drawText(T(f.label), { x: MARGIN, y: y - 10, size: 9.5, font: bold, color: C_ACCENT });
    y -= 22;
    const rowLabelW = 130;
    const colW = (CW - rowLabelW) / f.columns.length;
    ensure(14);
    for (let c = 0; c < f.columns.length; c++) {
      const cx = MARGIN + rowLabelW + c * colW;
      page.drawText(T(f.columns[c]), { x: cx, y: y - 8, size: 7, font: bold, color: C_MUTED });
    }
    y -= 14;
    for (const r of f.rows) {
      ensure(20);
      const top = y;
      page.drawText(T(r), { x: MARGIN, y: top - 10, size: 8, font, color: C_INK });
      for (let c = 0; c < f.columns.length; c++) {
        const cx = MARGIN + rowLabelW + c * colW;
        line(cx, top - 13, colW - 12);
      }
      y = top - 20;
    }
    y -= 6;
  }

  function drawMannequin(boxLeft: number, boxTop: number, scale: number, label: string, markers: { x: number; y: number }[]) {
    // silhouette guide
    for (const s of MANNEQUIN) {
      if (s.type === "circle") {
        page.drawCircle({ x: boxLeft + s.cx * scale, y: boxTop - s.cy * scale, size: s.r * scale, borderColor: C_LINE, borderWidth: 1, color: C_LIGHT });
      } else {
        page.drawRectangle({
          x: boxLeft + s.x * scale,
          y: boxTop - (s.y + s.h) * scale,
          width: s.w * scale,
          height: s.h * scale,
          borderColor: C_LINE,
          borderWidth: 1,
          color: C_LIGHT,
        });
      }
    }
    // markers
    markers.forEach((m, i) => {
      const mx = boxLeft + m.x * BODY_BOX.w * scale;
      const my = boxTop - m.y * BODY_BOX.h * scale;
      page.drawCircle({ x: mx, y: my, size: 7, color: C_MARK });
      page.drawText(String(i + 1), { x: mx - 2.2, y: my - 3, size: 7, font: bold, color: C_WHITE });
    });
    // caption
    page.drawText(label, { x: boxLeft + (BODY_BOX.w * scale) / 2 - font.widthOfTextAtSize(label, 8) / 2, y: boxTop - BODY_BOX.h * scale - 12, size: 8, font: bold, color: C_MUTED });
  }

  function drawBodyMap(f: Field & { kind: "bodymap" }) {
    const scale = 0.62; // ~124 x 285 per figure
    const figW = BODY_BOX.w * scale;
    const figH = BODY_BOX.h * scale;
    const need = figH + 24;
    ensure(need);
    const top = y;
    const gap = 40;
    const totalW = figW * 2 + gap;
    const startX = MARGIN + (CW - totalW) / 2;

    const v = values && f.id ? values[f.id] : null;
    const front = v && Array.isArray(v.front) ? v.front : [];
    const back = v && Array.isArray(v.back) ? v.back : [];

    drawMannequin(startX, top, scale, lang === "es" ? "Frente" : "Front", front);
    drawMannequin(startX + figW + gap, top, scale, lang === "es" ? "Espalda" : "Back", back);
    y = top - figH - 24;
  }

  function drawSectionHeader(title: string, description: string | undefined, num: number) {
    ensure(description ? 44 : 30);
    const bandH = 22;
    page.drawRectangle({ x: MARGIN, y: y - bandH, width: CW, height: bandH, color: C_LIGHT });
    page.drawRectangle({ x: MARGIN, y: y - bandH, width: 4, height: bandH, color: C_BRAND });
    page.drawText(`${num}.  ${T(title)}`, { x: MARGIN + 12, y: y - 15, size: 10.5, font: bold, color: C_BRAND });
    y -= bandH + 6;
    if (description) {
      const lines = wrap(T(description), italic, 8, CW);
      for (const ln of lines) {
        ensure(11);
        page.drawText(ln, { x: MARGIN, y: y - 8, size: 8, font: italic, color: C_MUTED });
        y -= 11;
      }
      y -= 4;
    }
  }

  function drawHeading(text: string) {
    ensure(18);
    page.drawText(T(text), { x: MARGIN, y: y - 11, size: 9.5, font: bold, color: C_ACCENT });
    y -= 20;
  }

  // ---- render ----
  drawHeader(page, true);

  form.sections.forEach((section, si) => {
    drawSectionHeader(section.title, section.description, si + 1);

    let pending: { label: string; id?: string; frac: number }[] = [];
    const flush = () => {
      if (!pending.length) return;
      let row: { label: string; id?: string; frac: number }[] = [];
      let sum = 0;
      const rows: typeof pending[] = [];
      for (const c of pending) {
        if (sum + c.frac > 1.0001 && row.length) {
          rows.push(row);
          row = [];
          sum = 0;
        }
        row.push(c);
        sum += c.frac;
      }
      if (row.length) rows.push(row);
      for (const r of rows) drawTextRow(r.map((c) => ({ label: c.label, id: c.id })), r.map((c) => c.frac));
      pending = [];
    };

    for (const f of section.fields as Field[]) {
      if (f.kind === "text" || f.kind === "date") {
        pending.push({ label: f.label, id: (f as any).id, frac: widthFrac((f as any).width) });
        continue;
      }
      flush();
      switch (f.kind) {
        case "textarea":
          drawTextarea(f);
          break;
        case "checkboxes":
          drawCheckboxes(f);
          break;
        case "yesno":
          drawYesNo(f);
          break;
        case "heading":
          drawHeading(f.text);
          break;
        case "paragraph":
          drawParagraph(f);
          break;
        case "signature":
          drawSignature(f);
          break;
        case "pairs":
          drawPairs(f);
          break;
        case "bodymap":
          drawBodyMap(f);
          break;
      }
    }
    flush();
    y -= 8;
  });

  drawFooter(page);
  return await doc.save();
}
