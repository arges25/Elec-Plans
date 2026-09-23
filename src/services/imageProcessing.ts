import { applyAdaptiveBlackWhite } from './planReconstruction/imageOps';

/**
 * Traitement d'image local (aucun envoi sur internet) :
 * compression, filtres, redressement de perspective, rotation.
 */

export const MAX_IMAGE_SIDE = 2400;

export interface ImageFilters {
  /** -100 → 100 */
  brightness: number;
  /** -100 → 100 */
  contrast: number;
  grayscale: boolean;
  /** Noir et blanc « scan » (seuillage adaptatif). */
  blackWhite: boolean;
  /** Sensibilité du noir et blanc (1 → 30 %). */
  threshold: number;
}

export const DEFAULT_FILTERS: ImageFilters = { brightness: 0, contrast: 0, grayscale: false, blackWhite: false, threshold: 12 };

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Format non pris en charge'));
    img.src = src;
  });
}

export async function fileToImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D indisponible');
  return ctx;
}

type Drawable = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

function sizeOf(src: Drawable): { width: number; height: number } {
  if (src instanceof HTMLImageElement) return { width: src.naturalWidth, height: src.naturalHeight };
  return { width: src.width, height: src.height };
}

/** Dessine une source dans un canvas en la réduisant si son grand côté dépasse maxSide. */
export function drawToCanvas(src: Drawable, maxSide = MAX_IMAGE_SIDE): HTMLCanvasElement {
  const { width, height } = sizeOf(src);
  const k = Math.min(1, maxSide / Math.max(width, height));
  const canvas = createCanvas(width * k, height * k);
  const ctx = get2d(canvas);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

let webpSupport: boolean | null = null;

export function supportsWebpEncoding(): boolean {
  if (webpSupport === null) {
    try {
      webpSupport = createCanvas(2, 2).toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport;
}

/** Encode un canvas en WebP si possible, sinon JPEG. */
export function canvasToCompressedDataUrl(canvas: HTMLCanvasElement, quality = 0.86): string {
  if (supportsWebpEncoding()) return canvas.toDataURL('image/webp', quality);
  return canvas.toDataURL('image/jpeg', Math.min(0.92, quality + 0.04));
}

export interface CompressedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/** Réduit (≈ 2400 px max) et compresse une image importée. */
export async function compressImageFile(file: Blob, maxSide = MAX_IMAGE_SIDE): Promise<CompressedImage> {
  let src: Drawable;
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    src = await fileToImage(file);
  }
  const canvas = drawToCanvas(src, maxSide);
  if ('close' in src && typeof src.close === 'function') src.close();
  return { dataUrl: canvasToCompressedDataUrl(canvas), width: canvas.width, height: canvas.height };
}

export function compressCanvas(canvas: HTMLCanvasElement, maxSide = MAX_IMAGE_SIDE): CompressedImage {
  const c = Math.max(canvas.width, canvas.height) > maxSide ? drawToCanvas(canvas, maxSide) : canvas;
  return { dataUrl: canvasToCompressedDataUrl(c), width: c.width, height: c.height };
}

/* ------------------------------------------------------------------ */
/* Filtres (fonctions pures sur les pixels)                            */
/* ------------------------------------------------------------------ */

/** Applique luminosité / contraste / niveaux de gris sur des pixels RGBA (le noir et blanc est adaptatif, voir filterCanvas). */
export function applyFiltersToPixels(data: Uint8ClampedArray, f: ImageFilters): void {
  const b = (f.brightness / 100) * 255 * 0.5;
  const cf = f.contrast / 100;
  const c = cf >= 0 ? 1 + cf * 2 : 1 + cf;
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = (i - 128) * c + 128 + b;
  const gray = f.grayscale || f.blackWhite;
  for (let i = 0; i < data.length; i += 4) {
    let r = lut[data[i]];
    let g = lut[data[i + 1]];
    let bl = lut[data[i + 2]];
    if (gray) {
      const y = 0.299 * r + 0.587 * g + 0.114 * bl;
      r = g = bl = y;
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = bl;
  }
}

/** Calcule des réglages « amélioration automatique » à partir de l'histogramme. */
export function computeAutoEnhance(data: Uint8ClampedArray): Pick<ImageFilters, 'brightness' | 'contrast'> {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < data.length; i += 16) {
    const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[y]++;
    n++;
  }
  const pct = (p: number) => {
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= n * p) return i;
    }
    return 255;
  };
  const lo = pct(0.02);
  const hi = pct(0.98);
  const range = Math.max(20, hi - lo);
  const contrastFactor = Math.min(2.5, 255 / range);
  const contrast = contrastFactor >= 1 ? ((contrastFactor - 1) / 2) * 100 : (contrastFactor - 1) * 100;
  const mid = (lo + hi) / 2;
  const brightness = Math.max(-60, Math.min(60, ((150 - ((mid - 128) * contrastFactor + 128)) / 127.5) * 100));
  return { brightness: Math.round(brightness), contrast: Math.round(Math.max(0, Math.min(100, contrast))) };
}

export function filterCanvas(canvas: HTMLCanvasElement, f: ImageFilters): HTMLCanvasElement {
  const identity = f.brightness === 0 && f.contrast === 0 && !f.grayscale && !f.blackWhite;
  if (identity) return canvas;
  const ctx = get2d(canvas);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyFiltersToPixels(img.data, f);
  if (f.blackWhite) applyAdaptiveBlackWhite(img.data, canvas.width, canvas.height, f.threshold);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/* ------------------------------------------------------------------ */
/* Géométrie : rotation, homographie                                   */
/* ------------------------------------------------------------------ */

export function rotateCanvas90(src: HTMLCanvasElement, clockwise: boolean): HTMLCanvasElement {
  const out = createCanvas(src.height, src.width);
  const ctx = get2d(out);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(((clockwise ? 90 : -90) * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

/** Rotation libre (degrés) avec agrandissement du cadre et fond blanc. */
export function rotateCanvasFree(src: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  if (Math.abs(deg) < 0.01) return src;
  const r = (deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  const w = src.width * cos + src.height * sin;
  const h = src.width * sin + src.height * cos;
  const out = createCanvas(w, h);
  const ctx = get2d(out);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(r);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

export type Quad = [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];

/**
 * Homographie 3×3 (tableau de 9 valeurs, h33 = 1) envoyant src[i] → dst[i].
 * Résolution d'un système linéaire 8×8 par élimination de Gauss.
 */
export function computeHomography(src: Quad, dst: Quad): number[] {
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    B.push(v);
  }
  const h = solveLinear(A, B);
  return [...h, 1];
}

function solveLinear(A: number[][], B: number[]): number[] {
  const n = B.length;
  const M = A.map((row, i) => [...row, B[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) throw new Error('Quadrilatère dégénéré');
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export function applyHomography(h: number[], x: number, y: number): { x: number; y: number } {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}

/** Taille de sortie naturelle d'un quadrilatère (moyenne des côtés opposés). */
export function quadOutputSize(q: Quad, maxSide = MAX_IMAGE_SIDE): { width: number; height: number } {
  const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
  const w = Math.max(d(q[0], q[1]), d(q[3], q[2]));
  const h = Math.max(d(q[0], q[3]), d(q[1], q[2]));
  const k = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

/**
 * Redressement de perspective : le quadrilatère `quad` (coins HG, HD, BD, BG) de l'image source
 * devient un rectangle width × height. Échantillonnage bilinéaire.
 */
export function warpPerspectivePixels(
  src: { data: Uint8ClampedArray; width: number; height: number },
  quad: Quad,
  width: number,
  height: number,
): Uint8ClampedArray {
  const rect: Quad = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ];
  // Homographie inverse : sortie → source
  const h = computeHomography(rect, quad);
  const out = new Uint8ClampedArray(width * height * 4);
  const sw = src.width;
  const sh = src.height;
  const sd = src.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = h[6] * x + h[7] * y + h[8];
      const sx = (h[0] * x + h[1] * y + h[2]) / w;
      const sy = (h[3] * x + h[4] * y + h[5]) / w;
      const o = (y * width + x) * 4;
      if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) {
        out[o] = out[o + 1] = out[o + 2] = 255;
        out[o + 3] = 255;
        continue;
      }
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      for (let c = 0; c < 3; c++) {
        const top = sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx;
        const bot = sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx;
        out[o + c] = top * (1 - fy) + bot * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}

export function warpCanvas(src: HTMLCanvasElement, quad: Quad, maxSide = MAX_IMAGE_SIDE): HTMLCanvasElement {
  const { width, height } = quadOutputSize(quad, maxSide);
  const sctx = get2d(src);
  const sdata = sctx.getImageData(0, 0, src.width, src.height);
  const pixels = warpPerspectivePixels({ data: sdata.data, width: src.width, height: src.height }, quad, width, height);
  const out = createCanvas(width, height);
  const img = new ImageData(width, height);
  img.data.set(pixels);
  get2d(out).putImageData(img, 0, 0);
  return out;
}

export function isFullQuad(q: Quad, width: number, height: number): boolean {
  const eps = 1;
  return (
    Math.abs(q[0].x) < eps &&
    Math.abs(q[0].y) < eps &&
    Math.abs(q[1].x - width) < eps &&
    Math.abs(q[1].y) < eps &&
    Math.abs(q[2].x - width) < eps &&
    Math.abs(q[2].y - height) < eps &&
    Math.abs(q[3].x) < eps &&
    Math.abs(q[3].y - height) < eps
  );
}

/** Convertit un dataURL (webp/png/jpeg) en octets JPEG ou PNG pour l'intégration PDF. */
export async function dataUrlToEmbeddable(dataUrl: string): Promise<{ bytes: Uint8Array; type: 'jpg' | 'png' }> {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/png')) {
    const type = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    return { bytes: base64ToBytes(dataUrl.split(',')[1] ?? ''), type };
  }
  const img = await loadImage(dataUrl);
  const canvas = drawToCanvas(img, 4000);
  const jpeg = canvas.toDataURL('image/jpeg', 0.9);
  return { bytes: base64ToBytes(jpeg.split(',')[1] ?? ''), type: 'jpg' };
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
