import { renderToStaticMarkup } from 'react-dom/server';
import type { BoardDoc } from '../types';
import { printHtmlDocument } from '../../../services/printerService/systemPrint';
import { CALIBRATION_LENGTH_MM, layoutSheet, loadCorrectionPercent, panelHeader, percentToScale } from './labelSheet';
import { SheetPageSvg } from './SheetPageSvg';
import { SchemaPageSvg, commonOrientation } from './schemaSheet';

/**
 * Impression système (AirPrint, Wi-Fi, imprimante par défaut) en millimètres
 * réels. Dans la boîte d'impression : échelle 100 %, « Ajuster à la page » désactivé.
 */

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Pages d'étiquettes (balisage HTML des pages). */
export function labelPagesHtml(doc: BoardDoc): { html: string; pageWidthMm: number; pageHeightMm: number; pages: number } {
  const scale = percentToScale(loadCorrectionPercent());
  const layout = layoutSheet(doc, scale);
  const header = panelHeader(doc);
  const html = layout.pages
    .map(
      (strips, i) =>
        `<div class="page">${renderToStaticMarkup(
          <SheetPageSvg layout={layout} strips={strips} pageIndex={i} header={header} fontPt={doc.print.fontSizePt} scale={scale} uid={`pl${i}`} showRef={doc.print.showRef} />,
        )}</div>`,
    )
    .join('');
  return { html, pageWidthMm: layout.pageWidthMm, pageHeightMm: layout.pageHeightMm, pages: layout.pages.length };
}

/** « Imprimer étiquettes » : uniquement les bandeaux nécessaires, à l'échelle réelle. */
export function printLabels(doc: BoardDoc): void {
  const pages = labelPagesHtml(doc);
  if (!pages.pages) throw new Error('Aucune étiquette à imprimer : posez d’abord des appareils');
  printHtmlDocument(pages.html, { pageWidthMm: pages.pageWidthMm, pageHeightMm: pages.pageHeightMm, title: `Étiquettes — ${esc(doc.title)}` });
}

/** « Imprimer schéma tableau » : une page A4 par tableau. */
export function printSchema(docs: BoardDoc[]): void {
  if (!docs.length) return;
  const orientation = commonOrientation(docs);
  const date = new Date();
  const html = docs.map((d, i) => `<div class="page">${renderToStaticMarkup(<SchemaPageSvg doc={d} orientation={orientation} uid={`ps${i}`} date={date} />)}</div>`).join('');
  const W = orientation === 'portrait' ? 210 : 297;
  const H = orientation === 'portrait' ? 297 : 210;
  printHtmlDocument(html, { pageWidthMm: W, pageHeightMm: H, title: `Schéma — ${esc(docs[0].projectName)}` });
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
