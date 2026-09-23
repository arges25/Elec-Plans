import type { PrintCalibration } from '../types';

/** Longueur de référence imprimée sur la bande test (mm). */
export const TEST_LENGTH_X_MM = 100;
export const TEST_LENGTH_Y_MM = 50;

/**
 * Facteur de correction d'échelle.
 * Exemple : trait de 100 mm imprimé à 98,7 mm → 100 / 98,7 ≈ 1,0132.
 * Si la bande test a été imprimée avec une correction déjà active, on la compose.
 */
export function computeScaleCorrection(expectedMm: number, measuredMm: number, currentScale = 1): number {
  if (!(expectedMm > 0) || !(measuredMm > 0)) throw new Error('Mesure invalide');
  const ratio = expectedMm / measuredMm;
  if (ratio < 0.5 || ratio > 1.5) throw new Error('Mesure incohérente (écart > 50 %)');
  return Math.round(currentScale * ratio * 100000) / 100000;
}

export function applyCalibration(mm: number, scale: number, offset = 0): number {
  return offset + mm * scale;
}

export function calibrationSummary(c: PrintCalibration): string {
  const pct = (v: number) => `${v >= 1 ? '+' : ''}${((v - 1) * 100).toFixed(2)} %`;
  return `X ${pct(c.scaleX)} · Y ${pct(c.scaleY)} · décalage ${c.offsetXMm} / ${c.offsetYMm} mm`;
}
