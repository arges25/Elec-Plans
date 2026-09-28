import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PanelProject } from '../types';
import { brandName, formatDimensions, getEnclosure, getProduct, productRatingText } from '../data/catalog';
import { REFERENCE_NOT_PROVIDED } from '../constants';
import { buildBom } from '../engine/bom';
import { boardGeometry } from '../engine/geometry';
import { allLabelZones, devicesInRow } from '../engine/placement';
import { BoardSvg, boardViewBox } from '../render/BoardSvg';
import { layoutLabel } from '../render/LabelCell';
import { iconSvg } from '../render/icons';
import { mmToPt, ptToMm } from '../../../utils/units';
import { sanitizeForFont } from '../../../services/pdf/pdfUtils';
import { PAGE_MARGIN_MM, layoutSheet, loadCorrectionPercent, panelHeader, percentToScale, pieceCaption } from './labelSheet';
import { svgToPng } from './raster';

/**
 * Export PDF :
 * – « tableau complet » : fiche (projet, marque, gamme, référence), vue du
 *   tableau, nomenclature, liste des circuits puis étiquettes ;
 * – « étiquettes uniquement ».
 * Les étiquettes sont vectorielles, à l'échelle réelle (mm) avec la correction
 * de l'imprimante ; seules les icônes sont rastérisées.
 */

export type PdfMode = 'full' | 'labels';

const A4 = { w: mmToPt(210), h: mmToPt(297) };
const INK = rgb(0.07, 0.09, 0.15);
const GREY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);
const AMBER = rgb(0.71, 0.33, 0.04);

interface Fonts {
  reg: PDFFont;
  bold: PDFFont;
}

function text(page: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = INK) {
  page.drawText(sanitizeForFont(font, s), { x, y, size, font, color });
}

/** Tronque un texte à une largeur (pt). */
function clip(font: PDFFont, s: string, size: number, maxW: number): string {
  let t = sanitizeForFont(font, s);
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

async function iconImage(pdf: PDFDocument, cache: Map<string, PDFImage>, id: string): Promise<PDFImage | null> {
  const hit = cache.get(id);
  if (hit) return hit;
  const png = await svgToPng(iconSvg(id, 192, `pdf-${id}`), 192, 192, '');
  const img = await pdf.embedPng(png);
  cache.set(id, img);
  return img;
}

/* ---------------------------- Fiche + vue ---------------------------- */

async function summaryPage(pdf: PDFDocument, p: PanelProject, f: Fonts) {
  const enc = getEnclosure(p.enclosureId)!;
  const page = pdf.addPage([A4.w, A4.h]);
  const m = mmToPt(15);
  let y = A4.h - m;
  text(page, 'TABLEAU ÉLECTRIQUE', m, y - 9, 9, f.bold, GREY);
  y -= 30;
  text(page, clip(f.bold, p.name, 20, A4.w - 2 * m), m, y, 20, f.bold);
  y -= 22;
  const rows: [string, string, boolean?][] = [
    ['Fabricant', brandName(enc.brand)],
    ['Gamme', enc.family],
    ['Coffret', enc.name],
    ['Référence', enc.reference ?? REFERENCE_NOT_PROVIDED, !enc.reference],
    ['Dimensions (L × H × P)', formatDimensions(enc.dimensions), !enc.dimensions],
    ['Capacité', `${enc.rows} rangée(s) × ${enc.modulesPerRow} modules = ${enc.totalModules} modules`],
    ['Date', new Date().toLocaleDateString('fr-FR')],
  ];
  for (const [k, v, warn] of rows) {
    text(page, k, m, y, 10, f.reg, GREY);
    text(page, clip(f.bold, v, 10, A4.w - 2 * m - 140), m + 140, y, 10, f.bold, warn ? AMBER : INK);
    y -= 15;
  }
  // Vue du tableau (image)
  const geo = boardGeometry(enc);
  const vb = boardViewBox(geo);
  const pxPerMm = 5;
  const markup = renderToStaticMarkup(<BoardSvg project={p} enclosure={enc} uid="pdf" width={vb.w * pxPerMm} height={vb.h * pxPerMm} />);
  const png = await svgToPng(markup, vb.w * pxPerMm, vb.h * pxPerMm);
  const img = await pdf.embedPng(png);
  const boxW = A4.w - 2 * m;
  const boxH = y - m - 10;
  const k = Math.min(boxW / img.width, boxH / img.height);
  const w = img.width * k;
  const h = img.height * k;
  page.drawImage(img, { x: m + (boxW - w) / 2, y: m + (boxH - h) / 2, width: w, height: h });
}

/* --------------------------- Tableaux texte -------------------------- */

interface Col {
  title: string;
  width: number;
  align?: 'right';
}

function table(pdf: PDFDocument, f: Fonts, title: string, cols: Col[], data: { cells: string[]; warn?: number[] }[]) {
  const m = mmToPt(15);
  const rowH = 17;
  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - m;
  const header = (first: boolean) => {
    text(page, first ? title : `${title} (suite)`, m, y - 14, 14, f.bold);
    y -= 32;
    page.drawRectangle({ x: m, y: y - 5, width: A4.w - 2 * m, height: rowH, color: rgb(0.95, 0.96, 0.98) });
    let x = m;
    for (const c of cols) {
      const tw = f.bold.widthOfTextAtSize(c.title, 8);
      text(page, c.title, c.align === 'right' ? x + c.width - 4 - tw : x + 4, y, 8, f.bold, GREY);
      x += c.width;
    }
    y -= rowH;
  };
  header(true);
  for (const row of data) {
    if (y < m + rowH) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - m;
      header(false);
    }
    let x = m;
    row.cells.forEach((cell, i) => {
      const c = cols[i];
      const s = clip(f.reg, cell, 8.5, c.width - 8);
      const tw = f.reg.widthOfTextAtSize(s, 8.5);
      text(page, s, c.align === 'right' ? x + c.width - 4 - tw : x + 4, y, 8.5, f.reg, row.warn?.includes(i) ? AMBER : INK);
      x += c.width;
    });
    page.drawLine({ start: { x: m, y: y - 5 }, end: { x: A4.w - m, y: y - 5 }, thickness: 0.4, color: LINE });
    y -= rowH;
  }
}

function bomTable(pdf: PDFDocument, p: PanelProject, f: Fonts) {
  const enc = getEnclosure(p.enclosureId)!;
  const cols: Col[] = [
    { title: 'Qté', width: 30, align: 'right' },
    { title: 'Fabricant', width: 58 },
    { title: 'Référence', width: 112 },
    { title: 'Désignation', width: 166 },
    { title: 'Calibre', width: 94 },
    { title: 'Largeur', width: 50, align: 'right' },
  ];
  const data = [
    { cells: ['1', brandName(enc.brand), enc.reference ?? REFERENCE_NOT_PROVIDED, enc.name, '—', `${enc.totalModules} mod.`], warn: enc.reference ? [] : [2] },
    ...buildBom(p.devices).map((l) => ({
      cells: [String(l.quantity), brandName(l.product.brand), l.product.reference ?? REFERENCE_NOT_PROVIDED, l.product.fullName, productRatingText(l.product) ?? '—', `${String(l.product.modules).replace('.', ',')} mod.`],
      warn: l.product.reference ? [] : [2],
    })),
  ];
  table(pdf, f, 'Nomenclature', cols, data);
}

function circuitTable(pdf: PDFDocument, p: PanelProject, f: Fonts) {
  const enc = getEnclosure(p.enclosureId)!;
  const zones = allLabelZones(p.devices, enc.rows, p.labelStyle);
  const cols: Col[] = [
    { title: 'Rangée', width: 46 },
    { title: 'Modules', width: 60 },
    { title: 'Étiquette', width: 190 },
    { title: 'Appareil', width: 215 },
  ];
  const fmt = (n: number) => String(n).replace('.', ',');
  const data: { cells: string[] }[] = [];
  for (let r = 0; r < enc.rows; r++) {
    for (const d of devicesInRow(p.devices, r)) {
      const z = zones.find((x) => x.ids.includes(d.id));
      const label = z ? (z.leaderId === d.id ? z.label || '—' : `(regroupé avec « ${z.label || '—'} »)`) : '—';
      const range = d.moduleWidth > 1 ? `${fmt(d.startModule + 1)} à ${fmt(d.startModule + d.moduleWidth)}` : fmt(d.startModule + 1);
      data.push({ cells: [String(r + 1), range, label, getProduct(d.productId)?.fullName ?? '—'] });
    }
  }
  if (data.length) table(pdf, f, 'Liste des circuits', cols, data);
}

/* ------------------------------ Étiquettes ---------------------------- */

async function labelPages(pdf: PDFDocument, p: PanelProject, f: Fonts) {
  const scale = percentToScale(loadCorrectionPercent());
  const layout = layoutSheet(p, scale);
  const header = panelHeader(p);
  const icons = new Map<string, PDFImage>();
  const measure = (s: string, sizePt: number) => ptToMm(f.bold.widthOfTextAtSize(sanitizeForFont(f.bold, s), sizePt));
  const W = mmToPt(layout.pageWidthMm);
  const H = mmToPt(layout.pageHeightMm);
  const X = (mm: number) => mmToPt(PAGE_MARGIN_MM + mm * scale);
  const Y = (mm: number) => H - mmToPt(PAGE_MARGIN_MM + mm * scale);
  const L = (mm: number) => mmToPt(mm * scale);
  const h = layout.labelHeightMm;

  for (let pi = 0; pi < layout.pages.length; pi++) {
    const page = pdf.addPage([W, H]);
    text(page, clip(f.bold, header, 9.3 * scale, W * 0.7), X(0), Y(4), 9.3 * scale, f.bold);
    const right = `Page ${pi + 1}/${layout.pages.length} · découper sur les pointillés`;
    text(page, right, W - mmToPt(PAGE_MARGIN_MM) - f.reg.widthOfTextAtSize(right, 8 * scale), Y(4), 8 * scale, f.reg, GREY);
    for (const { piece, x, y } of layout.pages[pi]) {
      text(page, pieceCaption(piece), X(x), Y(y - 1.3), 8 * scale, f.reg, GREY);
      for (const z of piece.zones) {
        const zx = x + z.x;
        page.drawRectangle({ x: X(zx), y: Y(y + h), width: L(z.w), height: L(h), borderColor: INK, borderWidth: 0.57 * scale });
        const lay = layoutLabel(z.w, h, z.label, z.icon, z.style, p.print.fontSizePt, measure);
        if (lay.icon && z.icon) {
          const img = await iconImage(pdf, icons, z.icon);
          if (img) page.drawImage(img, { x: X(zx + lay.icon.x), y: Y(y + lay.icon.y + lay.icon.size), width: L(lay.icon.size), height: L(lay.icon.size) });
        }
        if (lay.text) {
          const sizePt = (lay.text.sizeMm / (25.4 / 72)) * scale;
          lay.text.lines.forEach((line, i) => {
            const s = sanitizeForFont(f.bold, line);
            const tw = f.bold.widthOfTextAtSize(s, sizePt);
            page.drawText(s, { x: X(zx + lay.text!.x) - tw / 2, y: Y(y + lay.text!.y + i * lay.text!.lineH), size: sizePt, font: f.bold, color: INK });
          });
        }
      }
      page.drawRectangle({ x: X(x), y: Y(y + h), width: L(piece.widthMm), height: L(h), borderColor: GREY, borderWidth: 0.7 * scale, borderDashArray: [3.4, 2.3] });
    }
  }
}

export async function buildPanelPdf(p: PanelProject, mode: PdfMode): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${p.name} — ${mode === 'full' ? 'tableau électrique' : 'étiquettes'}`);
  pdf.setCreator('MG Elec & Plans');
  const f: Fonts = { reg: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  if (mode === 'full') {
    await summaryPage(pdf, p, f);
    bomTable(pdf, p, f);
    circuitTable(pdf, p, f);
  }
  await labelPages(pdf, p, f);
  return pdf.save();
}
