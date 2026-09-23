import { PDFDocument, StandardFonts, degrees, type PDFFont, type PDFPage } from 'pdf-lib';
import type { PanelTemplate, PrintCalibration } from '../../types';
import { getSymbolDefinition } from '../../data/electricalSymbols';
import { primitivesToSvgInner } from '../../data/symbolShapes';
import { cellWidthMm } from '../../data/electricalPanelTemplates';
import { PT_TO_MM, fitLabelText, stripSizeMm, type LabelStrip, type MeasureFn } from '../../utils/labelLayout';
import { mmToPt } from '../../utils/units';
import { drawSymbolPrimitives, hexToRgb, sanitizeForFont } from '../pdf/pdfUtils';

/**
 * Rendu des étiquettes : une liste de primitives en millimètres,
 * puis deux sorties identiques : SVG (écran, impression système) et PDF (pdf-lib, vectoriel).
 */
export type Prim =
  | { t: 'rect'; x: number; y: number; w: number; h: number; stroke?: string; sw?: number; fill?: string; dash?: number[] }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number }
  | { t: 'text'; x: number; y: number; text: string; sizeMm: number; bold?: boolean; anchor: 'start' | 'middle' | 'end'; fill?: string }
  | { t: 'icon'; symbolId: string; x: number; y: number; sizeMm: number; color?: string };

export const IDENTITY: PrintCalibration = { scaleX: 1, scaleY: 1, offsetXMm: 0, offsetYMm: 0 };

/** Primitives d'une bande d'étiquettes, coin haut-gauche en (ox, oy). */
export function layoutStrip(strip: LabelStrip, tpl: PanelTemplate, measure: MeasureFn, ox = 0, oy = 0, highlightId?: string | null): Prim[] {
  const out: Prim[] = [];
  const size = stripSizeMm(tpl);
  const x0 = ox + tpl.marginLeftMm;
  const y0 = oy + tpl.marginTopMm;
  const h = tpl.labelHeightMm;
  // Cadre de découpe (contour extérieur de la bande)
  out.push({ t: 'rect', x: ox, y: oy, w: size.width, h: size.height, stroke: '#9ca3af', sw: 0.15, dash: [1, 1] });
  // Case vide restante de la rangée
  out.push({ t: 'rect', x: x0, y: y0, w: tpl.rowWidthMm, h, stroke: tpl.borderWidthMm > 0 ? '#111827' : undefined, sw: tpl.borderWidthMm });
  for (const cell of strip.cells) {
    const cx = x0 + cell.xMm;
    const cw = cell.widthMm;
    if (cell.xMm + cw > tpl.rowWidthMm + 0.01) continue; // hors rangée : non imprimé
    const fill = cell.circuitId === highlightId ? '#ffedd5' : cell.kind === 'differential' || cell.kind === 'main' ? '#f3f4f6' : '#ffffff';
    out.push({ t: 'rect', x: cx, y: y0, w: cw, h, fill, stroke: tpl.borderWidthMm > 0 ? '#111827' : undefined, sw: tpl.borderWidthMm });
    const pad = Math.min(0.8, cw * 0.06);
    let top = y0 + pad;
    const numSizeMm = Math.min(tpl.fontSizePt, 6) * PT_TO_MM;
    if (tpl.showNumber && cell.number) {
      out.push({ t: 'text', x: cx + pad, y: y0 + pad + numSizeMm * 0.85, text: cell.number, sizeMm: numSizeMm, bold: true, anchor: 'start' });
    }
    if (tpl.showIcon && cell.icon) {
      const iconSize = Math.min(h * 0.42, cw * 0.5, 6.5);
      out.push({ t: 'icon', symbolId: cell.icon, x: cx + cw / 2, y: y0 + pad + iconSize / 2, sizeMm: iconSize });
      top = y0 + pad + iconSize + 0.25;
    } else if (tpl.showNumber && cell.number) {
      top = y0 + pad + numSizeMm + 0.25;
    }
    const areaH = y0 + h - pad - top;
    const areaW = cw - pad * 2;
    if (areaH <= 0.5 || !cell.text) continue;
    const fit = fitLabelText(cell.text, areaW, areaH, tpl.fontSizePt, tpl.maxLines, measure, true);
    const sizeMm = fit.fontSizePt * PT_TO_MM;
    const lh = sizeMm * 1.12;
    const total = fit.lines.length * lh;
    let y = top + (areaH - total) / 2 + sizeMm * 0.85;
    const anchor = tpl.textAlign === 'left' ? 'start' : tpl.textAlign === 'right' ? 'end' : 'middle';
    const tx = anchor === 'start' ? cx + pad : anchor === 'end' ? cx + cw - pad : cx + cw / 2;
    for (const line of fit.lines) {
      out.push({ t: 'text', x: tx, y, text: line, sizeMm, bold: true, anchor });
      y += lh;
    }
  }
  return out;
}

/** Bande test de calibration : règle, trait de 100 mm, trait vertical de 50 mm, 13 cases. */
export function layoutCalibrationSheet(tpl: PanelTemplate, measure: MeasureFn): { prims: Prim[]; width: number; height: number } {
  const out: Prim[] = [];
  const x0 = 10;
  out.push({ t: 'text', x: x0, y: 12, text: 'MG Elec & Plans', sizeMm: 5, bold: true, anchor: 'start' });
  out.push({ t: 'text', x: x0, y: 19, text: 'TEST 100 mm — mesurez le trait ci-dessous avec une règle', sizeMm: 3.2, anchor: 'start', fill: '#374151' });
  // Trait de 100 mm exactement + graduations
  const ly = 32;
  out.push({ t: 'line', x1: x0, y1: ly, x2: x0 + 100, y2: ly, stroke: '#111827', sw: 0.3 });
  for (let mm = 0; mm <= 100; mm++) {
    const len = mm % 10 === 0 ? 5 : mm % 5 === 0 ? 3.5 : 2;
    out.push({ t: 'line', x1: x0 + mm, y1: ly, x2: x0 + mm, y2: ly + len, stroke: '#111827', sw: mm % 10 === 0 ? 0.25 : 0.12 });
    if (mm % 10 === 0) out.push({ t: 'text', x: x0 + mm, y: ly + 9, text: String(mm), sizeMm: 2.6, anchor: 'middle' });
  }
  out.push({ t: 'text', x: x0 + 50, y: ly - 2.5, text: '100 mm', sizeMm: 3.2, bold: true, anchor: 'middle', fill: '#c2410c' });
  // Trait vertical de 50 mm
  const vx = x0 + 125;
  out.push({ t: 'line', x1: vx, y1: 22, x2: vx, y2: 72, stroke: '#111827', sw: 0.3 });
  for (let mm = 0; mm <= 50; mm += 5) out.push({ t: 'line', x1: vx, y1: 22 + mm, x2: vx + (mm % 10 === 0 ? 4 : 2.5), y2: 22 + mm, stroke: '#111827', sw: 0.15 });
  out.push({ t: 'text', x: vx + 6, y: 48, text: '50 mm (vertical)', sizeMm: 2.8, anchor: 'start', fill: '#c2410c' });
  // 13 cases du modèle
  const n = tpl.modulesPerRow;
  const cells = Array.from({ length: n }, (_, i) => ({
    circuitId: `c${i}`,
    number: String(i + 1),
    text: `Case ${i + 1}`,
    modules: 1,
    kind: 'circuit' as const,
    xMm: i * cellWidthMm(tpl, 1),
    widthMm: cellWidthMm(tpl, 1),
    customized: false,
  }));
  const strip: LabelStrip = { rowId: 'test', rowName: 'Test', cells, usedModules: n, overflow: 0 };
  const sy = 80;
  out.push({ t: 'text', x: x0, y: sy - 2, text: `${tpl.name} — ${n} × ${tpl.modulePitchMm} mm = ${tpl.rowWidthMm} mm`, sizeMm: 2.8, anchor: 'start', fill: '#374151' });
  out.push(...layoutStrip(strip, { ...tpl, showIcon: false }, measure, x0, sy));
  const size = stripSizeMm(tpl);
  return { prims: out, width: Math.max(x0 + size.width + 10, 180), height: sy + size.height + 10 };
}

/* ------------------------------------------------------------------ */
/* Sortie SVG                                                          */
/* ------------------------------------------------------------------ */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f = (n: number) => String(Math.round(n * 1000) / 1000);

export function primsToSvgInner(prims: Prim[]): string {
  return prims
    .map((p) => {
      switch (p.t) {
        case 'rect':
          return `<rect x="${f(p.x)}" y="${f(p.y)}" width="${f(p.w)}" height="${f(p.h)}" fill="${p.fill ?? 'none'}" stroke="${p.stroke ?? 'none'}" stroke-width="${f(p.sw ?? 0)}"${p.dash ? ` stroke-dasharray="${p.dash.join(' ')}"` : ''}/>`;
        case 'line':
          return `<line x1="${f(p.x1)}" y1="${f(p.y1)}" x2="${f(p.x2)}" y2="${f(p.y2)}" stroke="${p.stroke}" stroke-width="${f(p.sw)}"/>`;
        case 'text':
          return `<text x="${f(p.x)}" y="${f(p.y)}" font-size="${f(p.sizeMm)}" font-family="Helvetica, Arial, sans-serif" font-weight="${p.bold ? 700 : 400}" text-anchor="${p.anchor}" fill="${p.fill ?? '#111827'}">${esc(p.text)}</text>`;
        case 'icon': {
          const def = getSymbolDefinition(p.symbolId);
          const k = p.sizeMm / 40;
          return `<g transform="translate(${f(p.x)} ${f(p.y)}) scale(${f(k)})">${primitivesToSvgInner(def.shapes, p.color ?? '#111827')}</g>`;
        }
      }
    })
    .join('');
}

/** SVG autonome dimensionné en mm (calibration optionnelle : échelle X/Y). */
export function primsToSvg(prims: Prim[], widthMm: number, heightMm: number, cal: PrintCalibration = IDENTITY): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(widthMm)} ${f(heightMm)}" width="${f(widthMm * cal.scaleX)}mm" height="${f(heightMm * cal.scaleY)}mm" preserveAspectRatio="none">${primsToSvgInner(prims)}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Pages d'impression                                                  */
/* ------------------------------------------------------------------ */

export interface PrintPage {
  widthMm: number;
  heightMm: number;
  prims: Prim[];
}

/** Répartit les bandes sur des pages A4 (paysage si la bande dépasse 190 mm). */
export function composeLabelPages(strips: LabelStrip[], tpl: PanelTemplate, measure: MeasureFn, copies = 1): PrintPage[] {
  const size = stripSizeMm(tpl);
  const landscape = size.width > 190;
  const pw = landscape ? 297 : 210;
  const ph = landscape ? 210 : 297;
  const margin = 10;
  const titleH = 3;
  const step = size.height + tpl.spacingMm + titleH;
  const perPage = Math.max(1, Math.floor((ph - 2 * margin) / step));
  const all: LabelStrip[] = [];
  for (let c = 0; c < copies; c++) all.push(...strips);
  const pages: PrintPage[] = [];
  const x = Math.max(margin, (pw - size.width) / 2);
  for (let i = 0; i < all.length; i += perPage) {
    const prims: Prim[] = [];
    all.slice(i, i + perPage).forEach((strip, k) => {
      const y = margin + k * step;
      prims.push({ t: 'text', x, y: y + 2.2, text: `${strip.rowName} · ${tpl.name}`, sizeMm: 2.2, anchor: 'start', fill: '#6b7280' });
      prims.push(...layoutStrip(strip, tpl, measure, x, y + titleH));
    });
    pages.push({ widthMm: pw, heightMm: ph, prims });
  }
  return pages;
}

/** HTML des pages pour l'impression système (positions absolues en mm + calibration). */
export function pagesToPrintHtml(pages: PrintPage[], cal: PrintCalibration): string {
  return pages
    .map(
      (p) =>
        `<div class="page"><div style="position:absolute;left:${f(cal.offsetXMm)}mm;top:${f(cal.offsetYMm)}mm">${primsToSvg(p.prims, p.widthMm, p.heightMm, cal)}</div></div>`,
    )
    .join('');
}

/* ------------------------------------------------------------------ */
/* Sortie PDF                                                          */
/* ------------------------------------------------------------------ */

function drawPrimsPdf(page: PDFPage, prims: Prim[], cal: PrintCalibration, fonts: { regular: PDFFont; bold: PDFFont }) {
  const H = page.getHeight();
  const X = (mm: number) => mmToPt(cal.offsetXMm + mm * cal.scaleX);
  const Y = (mm: number) => mmToPt(cal.offsetYMm + mm * cal.scaleY);
  const k = (cal.scaleX + cal.scaleY) / 2;
  for (const p of prims) {
    if (p.t === 'rect') {
      if (!p.fill && !p.stroke) continue;
      page.drawRectangle({
        x: X(p.x),
        y: H - Y(p.y + p.h),
        width: mmToPt(p.w * cal.scaleX),
        height: mmToPt(p.h * cal.scaleY),
        color: p.fill ? hexToRgb(p.fill) : undefined,
        borderColor: p.stroke ? hexToRgb(p.stroke) : undefined,
        borderWidth: p.stroke ? mmToPt(p.sw ?? 0.2) : undefined,
        borderDashArray: p.dash?.map((d) => mmToPt(d)),
      });
    } else if (p.t === 'line') {
      page.drawLine({ start: { x: X(p.x1), y: H - Y(p.y1) }, end: { x: X(p.x2), y: H - Y(p.y2) }, color: hexToRgb(p.stroke), thickness: mmToPt(p.sw) });
    } else if (p.t === 'text') {
      const font = p.bold ? fonts.bold : fonts.regular;
      const size = mmToPt(p.sizeMm * cal.scaleY);
      const text = sanitizeForFont(font, p.text);
      const w = font.widthOfTextAtSize(text, size);
      const dx = p.anchor === 'middle' ? -w / 2 : p.anchor === 'end' ? -w : 0;
      page.drawText(text, { x: X(p.x) + dx, y: H - Y(p.y), size, font, color: hexToRgb(p.fill ?? '#111827'), rotate: degrees(0) });
    } else {
      const def = getSymbolDefinition(p.symbolId);
      drawSymbolPrimitives({ page, H }, def.shapes, p.color ?? '#111827', X(p.x), Y(p.y), 0, (mmToPt(p.sizeMm) / 40) * k, fonts);
    }
  }
}

/** PDF vectoriel des pages d'étiquettes (ou de la bande test), calibration appliquée. */
export async function pagesToPdf(pages: PrintPage[], cal: PrintCalibration, title: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator('MG Elec & Plans');
  const fonts = { regular: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  for (const p of pages) {
    const page = pdf.addPage([mmToPt(p.widthMm), mmToPt(p.heightMm)]);
    drawPrimsPdf(page, p.prims, cal, fonts);
  }
  return pdf.save();
}
