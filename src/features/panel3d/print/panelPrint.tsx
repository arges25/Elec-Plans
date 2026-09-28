import { renderToStaticMarkup } from 'react-dom/server';
import type { PanelProject } from '../types';
import { brandName, getEnclosure, productRatingText } from '../data/catalog';
import { REFERENCE_NOT_PROVIDED } from '../constants';
import { buildBom } from '../engine/bom';
import { boardGeometry } from '../engine/geometry';
import { BoardSvg, boardViewBox } from '../render/BoardSvg';
import { printHtmlDocument } from '../../../services/printerService/systemPrint';
import { CALIBRATION_LENGTH_MM, layoutSheet, loadCorrectionPercent, panelHeader, percentToScale } from './labelSheet';
import { SheetPageSvg } from './SheetPageSvg';

/**
 * Impression système (AirPrint, Wi-Fi, imprimante par défaut) en millimètres
 * réels. Dans la boîte d'impression : échelle 100 %, « Ajuster à la page » désactivé.
 */

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Pages d'étiquettes (balisage HTML des pages). */
export function labelPagesHtml(p: PanelProject): { html: string; pageWidthMm: number; pageHeightMm: number } {
  const scale = percentToScale(loadCorrectionPercent());
  const layout = layoutSheet(p, scale);
  const header = panelHeader(p);
  const html = layout.pages
    .map(
      (strips, i) =>
        `<div class="page">${renderToStaticMarkup(
          <SheetPageSvg layout={layout} strips={strips} pageIndex={i} header={header} fontPt={p.print.fontSizePt} scale={scale} uid={`pl${i}`} />,
        )}</div>`,
    )
    .join('');
  return { html, pageWidthMm: layout.pageWidthMm, pageHeightMm: layout.pageHeightMm };
}

/** Page de synthèse : vue du tableau + nomenclature (format de page des étiquettes). */
function summaryPageHtml(p: PanelProject, pageWidthMm: number, pageHeightMm: number): string {
  const enc = getEnclosure(p.enclosureId)!;
  const geo = boardGeometry(enc);
  const vb = boardViewBox(geo);
  const landscape = pageWidthMm > pageHeightMm;
  const boardBoxW = landscape ? 150 : 190;
  const boardBoxH = landscape ? 170 : 150;
  const k = Math.min(boardBoxW / vb.w, boardBoxH / vb.h);
  const board = renderToStaticMarkup(<BoardSvg project={p} enclosure={enc} uid="prt" width={`${vb.w * k}mm`} height={`${vb.h * k}mm`} />);
  const rows = buildBom(p.devices)
    .map(
      (l) =>
        `<tr><td style="text-align:right">${l.quantity}</td><td>${esc(brandName(l.product.brand))}</td><td>${esc(l.product.reference ?? REFERENCE_NOT_PROVIDED)}</td><td>${esc(
          l.product.fullName,
        )}</td><td>${esc(productRatingText(l.product) ?? '—')}</td><td style="text-align:right">${String(l.product.modules).replace('.', ',')}</td></tr>`,
    )
    .join('');
  return `<div class="page" style="padding:10mm;box-sizing:border-box;font-size:9pt;color:#111827">
<div style="font-size:14pt;font-weight:700">${esc(p.name)}</div>
<div style="color:#4b5563;margin-bottom:3mm">${esc(brandName(enc.brand))} · ${esc(enc.family)} · ${esc(enc.name)} · Réf. ${esc(enc.reference ?? REFERENCE_NOT_PROVIDED)}</div>
<div style="display:flex;gap:6mm;align-items:flex-start;${landscape ? '' : 'flex-direction:column'}">
<div style="position:relative;flex:none">${board.replace('<svg ', '<svg style="position:static;display:block" ')}</div>
<table style="border-collapse:collapse;width:100%;font-size:8pt"><thead><tr style="background:#f1f5f9"><th style="text-align:right">Qté</th><th>Fabricant</th><th>Référence</th><th>Désignation</th><th>Calibre</th><th>Mod.</th></tr></thead><tbody>${rows}</tbody></table>
</div>
<style>td,th{border-bottom:0.2mm solid #e5e7eb;padding:1mm 1.5mm;text-align:left}</style>
</div>`;
}

export function printLabels(p: PanelProject, withSummary: boolean): void {
  const pages = labelPagesHtml(p);
  const body = (withSummary ? summaryPageHtml(p, pages.pageWidthMm, pages.pageHeightMm) : '') + pages.html;
  printHtmlDocument(body, { pageWidthMm: pages.pageWidthMm, pageHeightMm: pages.pageHeightMm, title: `Étiquettes — ${esc(p.name)}` });
}

/** Règle de contrôle de 50 mm (imprimée avec la correction actuelle). */
export function printCalibrationRuler(): void {
  const scale = percentToScale(loadCorrectionPercent());
  const L = CALIBRATION_LENGTH_MM;
  const ticks = Array.from({ length: L + 1 }, (_, i) => {
    const h = i % 10 === 0 ? 6 : i % 5 === 0 ? 4 : 2.5;
    return `<line x1="${i}" y1="0" x2="${i}" y2="${h}" stroke="#000" stroke-width="0.15"/>${i % 10 === 0 ? `<text x="${i}" y="10" font-size="3" text-anchor="middle" font-family="Helvetica, Arial">${i}</text>` : ''}`;
  }).join('');
  const vticks = Array.from({ length: L + 1 }, (_, i) => {
    const w = i % 10 === 0 ? 6 : i % 5 === 0 ? 4 : 2.5;
    return `<line x1="0" y1="${i}" x2="${w}" y2="${i}" stroke="#000" stroke-width="0.15"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297" style="left:0;top:0">
<g transform="translate(20 20) scale(${scale})" font-family="Helvetica, Arial">
<text x="0" y="0" font-size="5" font-weight="700">Calibration des étiquettes — règle de ${L} mm</text>
<text x="0" y="7" font-size="3.4">Imprimez à 100 % (sans « Ajuster à la page »), mesurez la règle avec un réglet</text>
<text x="0" y="11.5" font-size="3.4">puis saisissez la mesure dans MG Elec &amp; Plans (onglet Aperçu &amp; impression).</text>
<g transform="translate(0 20)"><line x1="0" y1="0" x2="${L}" y2="0" stroke="#000" stroke-width="0.3"/>${ticks}</g>
<g transform="translate(0 45)"><line x1="0" y1="0" x2="0" y2="${L}" stroke="#000" stroke-width="0.3"/>${vticks}<text x="9" y="${L / 2}" font-size="3">${L} mm (vertical)</text></g>
<rect x="30" y="45" width="18" height="12" fill="none" stroke="#000" stroke-width="0.2"/><text x="31" y="62" font-size="2.6">1 module : 18 × 12 mm</text>
</g></svg>`;
  printHtmlDocument(`<div class="page">${svg}</div>`, { pageWidthMm: 210, pageHeightMm: 297, title: 'Règle de calibration 50 mm' });
}
