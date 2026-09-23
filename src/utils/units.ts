/** Conversions d'unités (impression, PDF, écran). */

export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;
export const CSS_PX_PER_INCH = 96;

/** Millimètres → points PDF (1 pt = 1/72 pouce). */
export function mmToPt(mm: number): number {
  return (mm * PT_PER_INCH) / MM_PER_INCH;
}

/** Points PDF → millimètres. */
export function ptToMm(pt: number): number {
  return (pt * MM_PER_INCH) / PT_PER_INCH;
}

/** Millimètres → pixels CSS (96 px par pouce CSS). */
export function mmToCssPx(mm: number): number {
  return (mm * CSS_PX_PER_INCH) / MM_PER_INCH;
}

/** Millimètres → points d'imprimante à une résolution donnée. */
export function mmToDots(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / MM_PER_INCH);
}

export const PAPER_SIZES_MM = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
} as const;

export type PaperFormat = keyof typeof PAPER_SIZES_MM;
export type PaperOrientation = 'portrait' | 'landscape';

export function paperSizeMm(format: PaperFormat, orientation: PaperOrientation): { width: number; height: number } {
  const s = PAPER_SIZES_MM[format];
  return orientation === 'portrait' ? { width: s.width, height: s.height } : { width: s.height, height: s.width };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
