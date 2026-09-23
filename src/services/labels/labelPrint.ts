import type { PanelTemplate, PrintCalibration } from '../../types';
import { canvasMeasure, stripSizeMm, type LabelStrip } from '../../utils/labelLayout';
import { downloadBlob, shareOrDownload } from '../../utils/download';
import { safeFileName } from '../../utils/format';
import { createCanvas, get2d, loadImage } from '../imageProcessing';
import { pdfBytesToBlob, printPdfBlob } from '../printerService/pdfPrint';
import { printHtmlDocument } from '../printerService/systemPrint';
import { getCurrentBluetoothPrinter, printCanvasEscPos, printableDots } from '../printerService/webBluetoothPrint';
import { composeLabelPages, layoutCalibrationSheet, layoutStrip, pagesToPdf, pagesToPrintHtml, primsToSvg, type PrintPage } from './labelRender';

/** Impression système (AirPrint / Wi-Fi / imprimante par défaut) des étiquettes. */
export function printLabelsSystem(strips: LabelStrip[], tpl: PanelTemplate, cal: PrintCalibration, copies = 1): void {
  const pages = composeLabelPages(strips, tpl, canvasMeasure, copies);
  const p = pages[0];
  printHtmlDocument(pagesToPrintHtml(pages, cal), { pageWidthMm: p.widthMm, pageHeightMm: p.heightMm, title: `Étiquettes ${tpl.name}` });
}

export async function labelsPdfBlob(strips: LabelStrip[], tpl: PanelTemplate, cal: PrintCalibration, copies = 1): Promise<Blob> {
  const pages = composeLabelPages(strips, tpl, canvasMeasure, copies);
  return pdfBytesToBlob(await pagesToPdf(pages, cal, `Étiquettes ${tpl.name}`));
}

export async function downloadLabelsPdf(strips: LabelStrip[], tpl: PanelTemplate, cal: PrintCalibration, name: string, copies = 1): Promise<void> {
  downloadBlob(await labelsPdfBlob(strips, tpl, cal, copies), `etiquettes-${safeFileName(name)}.pdf`);
}

export async function shareLabelsPdf(strips: LabelStrip[], tpl: PanelTemplate, cal: PrintCalibration, name: string, copies = 1) {
  return shareOrDownload(await labelsPdfBlob(strips, tpl, cal, copies), `etiquettes-${safeFileName(name)}.pdf`, `Étiquettes ${name}`);
}

export async function printLabelsPdf(strips: LabelStrip[], tpl: PanelTemplate, cal: PrintCalibration, copies = 1) {
  return printPdfBlob(await labelsPdfBlob(strips, tpl, cal, copies));
}

/* ---------------- Bande test de calibration ---------------- */

function calibrationPages(tpl: PanelTemplate): PrintPage[] {
  const sheet = layoutCalibrationSheet(tpl, canvasMeasure);
  return [{ widthMm: 297, heightMm: 210, prims: sheet.prims }];
}

export function printCalibrationSystem(tpl: PanelTemplate, cal: PrintCalibration): void {
  printHtmlDocument(pagesToPrintHtml(calibrationPages(tpl), cal), { pageWidthMm: 297, pageHeightMm: 210, title: 'MG Elec & Plans — TEST 100 mm' });
}

export async function calibrationPdfBlob(tpl: PanelTemplate, cal: PrintCalibration): Promise<Blob> {
  return pdfBytesToBlob(await pagesToPdf(calibrationPages(tpl), cal, 'MG Elec & Plans — TEST 100 mm'));
}

/* ---------------- Bluetooth (ESC/POS) ---------------- */

/** Rend une bande en canvas à la résolution de l'imprimante, tournée de 90° (le long du rouleau). */
export async function stripToPrinterCanvas(strip: LabelStrip, tpl: PanelTemplate, dpi: number, cal: PrintCalibration): Promise<HTMLCanvasElement> {
  const size = stripSizeMm(tpl);
  const svg = primsToSvg(layoutStrip(strip, tpl, canvasMeasure), size.width, size.height);
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const w = Math.round((size.width * cal.scaleX * dpi) / 25.4);
  const h = Math.round((size.height * cal.scaleY * dpi) / 25.4);
  const canvas = createCanvas(h, w);
  const ctx = get2d(canvas);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(h, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/** Impression directe sur l'imprimante Bluetooth connectée (profil ESC/POS). */
export async function printLabelsBluetooth(strips: LabelStrip[], tpl: PanelTemplate, cal: PrintCalibration): Promise<void> {
  const conn = getCurrentBluetoothPrinter();
  if (!conn) throw new Error('Aucune imprimante Bluetooth connectée');
  const maxDots = printableDots(conn.profile);
  for (const strip of strips) {
    const canvas = await stripToPrinterCanvas(strip, tpl, conn.profile.dpi, cal);
    if (canvas.width > maxDots) throw new Error('La hauteur d’étiquette dépasse la largeur imprimable de cette imprimante');
    await printCanvasEscPos(conn, canvas);
  }
}
