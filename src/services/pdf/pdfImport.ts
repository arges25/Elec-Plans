import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { MAX_IMAGE_SIDE, canvasToCompressedDataUrl, createCanvas } from '../imageProcessing';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy };

/** Ouvre un PDF local avec PDF.js (lecture uniquement sur l'appareil). */
export async function openPdf(file: Blob): Promise<PDFDocumentProxy> {
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}

/** Rend une page en canvas, grand côté ≈ maxSide pixels. */
export async function renderPdfPage(doc: PDFDocumentProxy, pageNumber: number, maxSide = MAX_IMAGE_SIDE): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = maxSide / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  await page.render({ canvas, viewport, background: 'rgb(255,255,255)' }).promise;
  page.cleanup();
  return canvas;
}

export async function renderPdfThumbnail(doc: PDFDocumentProxy, pageNumber: number, maxSide = 240): Promise<string> {
  const canvas = await renderPdfPage(doc, pageNumber, maxSide);
  return canvasToCompressedDataUrl(canvas, 0.7);
}
