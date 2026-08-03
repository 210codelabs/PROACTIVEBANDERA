// -------------------------------------------------------------------------
// Branded PDF generator for Proactive Clinic intake / clinical forms.
// Renders any FormDef (from ./forms) into a polished, printable PDF using
// pdf-lib. Server-only (reads the logo from /public).
// -------------------------------------------------------------------------

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from "pdf-lib";
import fs from "fs";
import path from "path";
import { CLINIC, FormDef, Field, Width } from "./forms";

// Brand palette
const C_BRAND = rgb(0.055, 0.278, 0.42); // deep clinical blue #0E4770
const C_ACCENT = rgb(0.02, 0.55, 0.55); // teal accent
const C_LIGHT = rgb(0.91, 0.955, 0.98); // section band bg
const C_INK = rgb(0.13, 0.17, 0.22);
const C_MUTED = rgb(0.42, 0.47, 0.53);
const C_LINE = rgb(0.72, 0.77, 0.82);
const C_WHITE = rgb(1, 1, 1);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 46;
const CW = PAGE_W - MARGIN * 2;
const BOTTOM = 56; // reserve for footer

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

export async function renderFormPdf(form: FormDef): Promise<Uint8Array> {
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

  doc.setTitle(`${CLINIC.name} — ${form.title}`);
  doc.setAuthor(CLINIC.name);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = 0;

  // ---- text helpers -----------------------------------------------------
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

  // ---- page furniture ---------------------------------------------------
  function drawFooter(p: PDFPage) {
    p.drawLine({
      start: { x: MARGIN, y: 44 },
      end: { x: PAGE_W - MARGIN, y: 44 },
      thickness: 0.5,
      color: C_LINE,
    });
    const line1 = `${CLINIC.name}  •  ${CLINIC.addr1}, ${CLINIC.addr2}  •  ${CLINIC.phone}  •  ${CLINIC.web}`;
    p.drawText(line1, { x: MARGIN, y: 32, size: 7, font, color: C_MUTED });
    p.drawText("Confidential — part of the patient medical record.", {
      x: MARGIN,
      y: 22,
      size: 6.5,
      font,
      color: C_MUTED,
    });
  }

  function drawHeader(p: PDFPage, first: boolean) {
    // top accent rule
    p.drawRectangle({ x: 0, y: PAGE_H - 4, width: PAGE_W, height: 4, color: C_ACCENT });

    if (first) {
      // Logo (top-left)
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
        p.drawText(CLINIC.tagline, { x: MARGIN, y: PAGE_H - 58, size: 9, font, color: C_ACCENT });
        headerBottom = PAGE_H - 70;
      }
      // Contact (top-right)
      const cy = PAGE_H - 26;
      rightText(p, CLINIC.addr1, cy, 8, font, C_MUTED);
      rightText(p, CLINIC.addr2, cy - 11, 8, font, C_MUTED);
      rightText(p, `${CLINIC.phone}`, cy - 22, 8, font, C_MUTED);
      rightText(p, `${CLINIC.web}`, cy - 33, 8, bold, C_BRAND);

      const ruleY = Math.min(headerBottom, PAGE_H - 74) - 6;
      p.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: PAGE_W - MARGIN, y: ruleY }, thickness: 1.2, color: C_BRAND });

      // Title band
      const bandTop = ruleY - 10;
      const bandH = 34;
      p.drawRectangle({ x: MARGIN, y: bandTop - bandH, width: CW, height: bandH, color: C_LIGHT });
      p.drawRectangle({ x: MARGIN, y: bandTop - bandH, width: 4, height: bandH, color: C_ACCENT });
      p.drawText(form.title, { x: MARGIN + 12, y: bandTop - 15, size: 15, font: bold, color: C_BRAND });
      p.drawText(form.subtitle, { x: MARGIN + 12, y: bandTop - 28, size: 8.5, font, color: C_MUTED });

      y = bandTop - bandH - 18;
    } else {
      p.drawText(CLINIC.name, { x: MARGIN, y: PAGE_H - 24, size: 10, font: bold, color: C_BRAND });
      rightText(p, form.title, PAGE_H - 24, 8.5, font, C_MUTED);
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

  // ---- primitive drawers ------------------------------------------------
  function drawWritingLine(x: number, lineY: number, w: number) {
    page.drawLine({ start: { x, y: lineY }, end: { x: x + w, y: lineY }, thickness: 0.7, color: C_LINE });
  }

  function drawCheckbox(x: number, boxY: number) {
    page.drawRectangle({ x, y: boxY, width: 9, height: 9, borderColor: C_BRAND, borderWidth: 0.9, color: C_WHITE });
  }

  // A row of inline text/date cells packed by fraction.
  function drawTextRow(cells: { label: string }[], fracs: number[]) {
    const rowH = 30;
    ensure(rowH);
    const top = y;
    let x = MARGIN;
    for (let i = 0; i < cells.length; i++) {
      const cellW = CW * fracs[i];
      page.drawText(cells[i].label, { x, y: top - 9, size: 7.8, font: bold, color: C_INK });
      drawWritingLine(x, top - 24, cellW - 10);
      x += cellW;
    }
    y = top - rowH;
  }

  function drawTextarea(label: string, lines: number) {
    const h = 14 + lines * 18 + 6;
    ensure(h);
    const top = y;
    page.drawText(label, { x: MARGIN, y: top - 9, size: 7.8, font: bold, color: C_INK });
    for (let i = 0; i < lines; i++) {
      drawWritingLine(MARGIN, top - 26 - i * 18, CW);
    }
    y = top - h;
  }

  function drawCheckboxes(label: string | undefined, options: string[]) {
    // Layout label (optional) then wrap option chips.
    const startTop = y;
    let curY = startTop;
    if (label) {
      ensure(14);
      page.drawText(label, { x: MARGIN, y: curY - 9, size: 7.8, font: bold, color: C_INK });
      curY -= 16;
    }
    ensure(16);
    let x = MARGIN;
    const rowStep = 16;
    for (const opt of options) {
      const tW = font.widthOfTextAtSize(opt, 8);
      const chipW = 9 + 4 + tW + 16;
      if (x + chipW > PAGE_W - MARGIN) {
        x = MARGIN;
        curY -= rowStep;
        if (curY < BOTTOM) {
          y = curY;
          newPage();
          curY = y;
        }
      }
      drawCheckbox(x, curY - 9);
      page.drawText(opt, { x: x + 13, y: curY - 8, size: 8, font, color: C_INK });
      x += chipW;
    }
    y = curY - 18;
  }

  function drawSignature(label: string, half = false) {
    const h = 40;
    ensure(h);
    const top = y;
    const w = half ? CW * 0.5 - 10 : CW * 0.62;
    drawWritingLine(MARGIN, top - 22, w);
    page.drawText(label, { x: MARGIN, y: top - 34, size: 7.5, font, color: C_MUTED });
    // date line to the right
    const dx = MARGIN + w + 24;
    if (dx < PAGE_W - MARGIN - 60) {
      drawWritingLine(dx, top - 22, PAGE_W - MARGIN - dx);
      page.drawText("Date", { x: dx, y: top - 34, size: 7.5, font, color: C_MUTED });
    }
    y = top - h;
  }

  function drawParagraph(text: string, ack?: boolean, ackLabel?: string) {
    const lines = wrap(text, font, 8.5, CW);
    const h = lines.length * 12 + (ack ? 20 : 8);
    ensure(Math.min(h, 120));
    for (const ln of lines) {
      ensure(12);
      page.drawText(ln, { x: MARGIN, y: y - 9, size: 8.5, font, color: C_INK });
      y -= 12;
    }
    if (ack) {
      y -= 4;
      ensure(16);
      drawCheckbox(MARGIN, y - 9);
      page.drawText(ackLabel || "I acknowledge and agree.", { x: MARGIN + 14, y: y - 8, size: 8.5, font: bold, color: C_BRAND });
      y -= 16;
    }
    y -= 6;
  }

  function drawPairs(label: string, columns: string[], rows: string[]) {
    ensure(30);
    // sub-heading
    page.drawText(label, { x: MARGIN, y: y - 10, size: 9.5, font: bold, color: C_ACCENT });
    y -= 22;
    const rowLabelW = 130;
    const colW = (CW - rowLabelW) / columns.length;
    // column headers
    ensure(14);
    for (let c = 0; c < columns.length; c++) {
      const cx = MARGIN + rowLabelW + c * colW;
      page.drawText(columns[c], { x: cx, y: y - 8, size: 7, font: bold, color: C_MUTED });
    }
    y -= 14;
    for (const r of rows) {
      ensure(20);
      const top = y;
      page.drawText(r, { x: MARGIN, y: top - 10, size: 8, font, color: C_INK });
      for (let c = 0; c < columns.length; c++) {
        const cx = MARGIN + rowLabelW + c * colW;
        drawWritingLine(cx, top - 13, colW - 12);
      }
      y = top - 20;
    }
    y -= 6;
  }

  function drawYesNo(label: string) {
    ensure(16);
    const top = y;
    const maxLabel = CW - 120;
    const shortLabel = font.widthOfTextAtSize(label, 8) > maxLabel ? label : label;
    page.drawText(shortLabel, { x: MARGIN, y: top - 9, size: 8, font, color: C_INK });
    const boxesX = PAGE_W - MARGIN - 96;
    drawCheckbox(boxesX, top - 10);
    page.drawText("Yes", { x: boxesX + 13, y: top - 9, size: 8, font, color: C_INK });
    drawCheckbox(boxesX + 48, top - 10);
    page.drawText("No", { x: boxesX + 61, y: top - 9, size: 8, font, color: C_INK });
    y = top - 18;
  }

  function drawSectionHeader(title: string, description?: string) {
    ensure(description ? 44 : 30);
    const bandH = 22;
    page.drawRectangle({ x: MARGIN, y: y - bandH, width: CW, height: bandH, color: C_LIGHT });
    page.drawRectangle({ x: MARGIN, y: y - bandH, width: 4, height: bandH, color: C_BRAND });
    page.drawText(title, { x: MARGIN + 12, y: y - 15, size: 10.5, font: bold, color: C_BRAND });
    y -= bandH + 6;
    if (description) {
      const lines = wrap(description, italic, 8, CW);
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
    page.drawText(text, { x: MARGIN, y: y - 11, size: 9.5, font: bold, color: C_ACCENT });
    y -= 20;
  }

  // ---- render form ------------------------------------------------------
  drawHeader(page, true);

  for (const section of form.sections) {
    drawSectionHeader(section.title, section.description);

    // pack consecutive text/date fields into rows
    let pending: { label: string; frac: number }[] = [];
    const flush = () => {
      if (!pending.length) return;
      // split into rows where frac sum <= 1
      let row: { label: string; frac: number }[] = [];
      let sum = 0;
      const rows: { label: string; frac: number }[][] = [];
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
      for (const r of rows) {
        drawTextRow(r.map((c) => ({ label: c.label })), r.map((c) => c.frac));
      }
      pending = [];
    };

    for (const f of section.fields as Field[]) {
      if (f.kind === "text" || f.kind === "date") {
        pending.push({ label: f.label, frac: widthFrac((f as any).width) });
        continue;
      }
      flush();
      switch (f.kind) {
        case "textarea":
          drawTextarea(f.label, f.lines || 2);
          break;
        case "checkboxes":
          drawCheckboxes(f.label, f.options);
          break;
        case "yesno":
          drawYesNo(f.label);
          break;
        case "heading":
          drawHeading(f.text);
          break;
        case "paragraph":
          drawParagraph(f.text, f.ack, f.ackLabel);
          break;
        case "signature":
          drawSignature(f.label);
          break;
        case "pairs":
          drawPairs(f.label, f.columns, f.rows);
          break;
      }
    }
    flush();
    y -= 8;
  }

  drawFooter(page);

  return await doc.save();
}
