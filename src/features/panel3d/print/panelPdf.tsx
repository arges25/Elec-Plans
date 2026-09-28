import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BoardDoc, PanelProject } from '../types';
import { brandName, getEnclosure, getProduct, productRatingText } from '../data/catalog';
import { REFERENCE_NOT_PROVIDED } from '../constants';
import { buildBom } from '../engine/bom';
import { allLabelZones, devicesInRow } from '../engine/placement';
import { SchemaSvg } from '../render/SchemaSvg';
import { schemaGeometry } from '../engine/schemaGeometry';
import { layoutLabel } from '../render/LabelCell';
import { iconSvg } from '../render/icons';
import { mmToPt, ptToMm } from '../../../utils/units';
import { sanitizeForFont } from '../../../services/pdf/pdfUtils';
import { PAGE_MARGIN_MM, layoutSheet, loadCorrectionPercent, panelHeader, percentToScale, pieceCaption } from './labelSheet';
import { svgToPng } from './raster';
import { SchemaPageSvg, commonOrientation, docsFor } from './schemaSheet';
import { displayLabel } from '../store/panelEditorStore';

/**
 * Export PDF :
 * – « tableau complet » : fiche (projet, marque, gamme, référence), vue du
 *   tableau, nomenclature, liste des circuits puis étiquettes ;
 * – « étiquettes uniquement ».
 * Les étiquettes sont vectorielles, à l'échelle réelle (mm) avec la correction
 * de l'imprimante ; seules les icônes sont rastérisées.
 */

export type PdfMode = 'full' | 'schema' | 'labels';

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

/* ------------------------- Schéma du tableau ------------------------- */

/** Page A4 « Schéma tableau » (rendu identique à l'aperçu, rastérisé à ~250 dpi). */
async function schemaPage(pdf: PDFDocument, doc: BoardDoc, orientation: 'portrait' | 'landscape', date: Date) {
  const W = orientation === 'portrait' ? 210 : 297;
  const H = orientation === 'portrait' ? 297 : 210;
  const pxPerMm = 10;
  const markup = renderToStaticMarkup(<SchemaPageSvg doc={doc} orientation={orientation} uid="pdfs" date={date} />).replace(/width="[\d.]+mm" height="[\d.]+mm"/, `width="${W * pxPerMm}" height="${H * pxPerMm}"`);
  const png = await svgToPng(markup, W * pxPerMm, H * pxPerMm);
  const img = await pdf.embedPng(png);
  const page = pdf.addPage([mmToPt(W), mmToPt(H)]);
  page.drawImage(img, { x: 0, y: 0, width: mmToPt(W), height: mmToPt(H) });
}

/** Image PNG haute résolution du schéma (≈ 8 px par millimètre de schéma). */
export async function schemaPng(doc: BoardDoc, pxPerUnit = 8): Promise<Uint8Array> {
  const enc = getEnclosure(doc.enclosureId)!;
  const geo = schemaGeometry(enc);
  const w = Math.round(geo.width * pxPerUnit);
  const h = Math.round(geo.height * pxPerUnit);
  const markup = renderToStaticMarkup(<SchemaSvg doc={doc} enclosure={enc} uid="png" width={w} height={h} info={`Projet : ${doc.projectName}`} />);
  return svgToPng(markup, w, h);
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

function bomTable(pdf: PDFDocument, p: BoardDoc, f: Fonts) {
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
  table(pdf, f, `Nomenclature — ${p.title}`, cols, data);
}

function circuitTable(pdf: PDFDocument, p: BoardDoc, f: Fonts) {
  const enc = getEnclosure(p.enclosureId)!;
  const zones = allLabelZones(p.devices, enc.rows, p.labelStyle);
  const cols: Col[] = [
    { title: 'Rangée', width: 44 },
    { title: 'Modules', width: 56 },
    { title: 'Repère', width: 50 },
    { title: 'Étiquette', width: 170 },
    { title: 'Appareil', width: 190 },
  ];
  const fmt = (n: number) => String(n).replace('.', ',');
  const data: { cells: string[] }[] = [];
  for (let r = 0; r < enc.rows; r++) {
    for (const d of devicesInRow(p.devices, r)) {
      const z = zones.find((x) => x.ids.includes(d.id));
      const zl = z ? displayLabel(p, z) : '';
      const label = z ? (z.leaderId === d.id ? zl || '—' : `(regroupé avec « ${zl || '—'} »)`) : '—';
      const range = d.moduleWidth > 1 ? `${fmt(d.startModule + 1)} à ${fmt(d.startModule + d.moduleWidth)}` : fmt(d.startModule + 1);
      const product = getProduct(d.productId);
      data.push({ cells: [String(r + 1), range, d.circuitRef || '—', label, product ? `${product.fullName}${product.reference ? ` (${product.reference})` : ''}` : '—'] });
    }
  }
  if (data.length) table(pdf, f, `Liste des circuits — ${p.title}`, cols, data);
}

/* ------------------------------ Étiquettes ---------------------------- */

async function labelPages(pdf: PDFDocument, p: BoardDoc, f: Fonts) {
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
        // Repère dans le coin (même disposition que LabelCell)
        const ref = p.print.showRef ? z.circuitRef.trim() : '';
        const refSize = Math.min(2.6, h * 0.24);
        const refH = ref ? refSize + 0.4 : 0;
        if (ref) text(page, ref, X(zx + 0.6), Y(y + refSize + 0.3), (refSize / (25.4 / 72)) * scale, f.bold, rgb(0.22, 0.25, 0.32));
        const lay = layoutLabel(z.w, h - refH, z.label, z.icon, z.style, p.print.fontSizePt, measure);
        if (lay.icon && z.icon) {
          const img = await iconImage(pdf, icons, z.icon);
          if (img) page.drawImage(img, { x: X(zx + lay.icon.x), y: Y(y + refH + lay.icon.y + lay.icon.size), width: L(lay.icon.size), height: L(lay.icon.size) });
        }
        if (lay.text) {
          const sizePt = (lay.text.sizeMm / (25.4 / 72)) * scale;
          lay.text.lines.forEach((line, i) => {
            const s = sanitizeForFont(f.bold, line);
            const tw = f.bold.widthOfTextAtSize(s, sizePt);
            page.drawText(s, { x: X(zx + lay.text!.x) - tw / 2, y: Y(y + refH + lay.text!.y + i * lay.text!.lineH), size: sizePt, font: f.bold, color: rgb(0, 0, 0) });
          });
        }
      }
      page.drawRectangle({ x: X(x), y: Y(y + h), width: L(piece.widthMm), height: L(h), borderColor: GREY, borderWidth: 0.7 * scale, borderDashArray: [3.4, 2.3] });
    }
  }
}

/**
 * PDF : « schema » (schéma tableau), « labels » (étiquettes seules) ou
 * « full » (dossier : schéma, nomenclature, liste des circuits, étiquettes),
 * pour le tableau actif ou pour tous les tableaux du projet.
 */
export async function buildPanelPdf(project: PanelProject, mode: PdfMode, scope: 'current' | 'all' = 'current'): Promise<Uint8Array> {
  const docs = docsFor(project, scope);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${project.name} — ${mode === 'labels' ? 'étiquettes' : mode === 'schema' ? 'schéma tableau' : 'dossier tableau électrique'}`);
  pdf.setCreator('MG Elec & Plans');
  const f: Fonts = { reg: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };
  const orientation = commonOrientation(docs);
  const date = new Date();
  for (const doc of docs) {
    if (mode !== 'labels') await schemaPage(pdf, doc, orientation, date);
    if (mode === 'full') {
      bomTable(pdf, doc, f);
      circuitTable(pdf, doc, f);
    }
    if (mode !== 'schema' && doc.devices.length) await labelPages(pdf, doc, f);
  }
  if (!pdf.getPageCount()) throw new Error('Rien à exporter : posez d’abord des appareils');
  return pdf.save();
}
