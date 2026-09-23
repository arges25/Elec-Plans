import { describe, expect, it } from 'vitest';
import { mmToPt, ptToMm, paperSizeMm, mmToDots } from '../utils/units';
import { computeScaleCorrection, TEST_LENGTH_X_MM } from '../utils/calibration';

describe('Conversion mm → points PDF', () => {
  it('1 pouce = 25,4 mm = 72 pt', () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 10);
    expect(mmToPt(1)).toBeCloseTo(2.834645669, 6);
    expect(ptToMm(mmToPt(227.5))).toBeCloseTo(227.5, 10);
  });

  it('format A4 en points', () => {
    const a4 = paperSizeMm('A4', 'portrait');
    expect(mmToPt(a4.width)).toBeCloseTo(595.28, 1);
    expect(mmToPt(a4.height)).toBeCloseTo(841.89, 1);
    expect(paperSizeMm('A3', 'landscape')).toEqual({ width: 420, height: 297 });
  });

  it('mm → points imprimante (203 dpi)', () => {
    expect(mmToDots(25.4, 203)).toBe(203);
  });
});

describe('Calibration imprimante', () => {
  it('trait de 100 mm mesuré à 98,7 mm → correction ≈ 1,0132', () => {
    const s = computeScaleCorrection(TEST_LENGTH_X_MM, 98.7);
    expect(s).toBeCloseTo(100 / 98.7, 4);
    expect(98.7 * s).toBeCloseTo(100, 3);
  });

  it('compose avec une correction déjà appliquée', () => {
    // Impression déjà corrigée à 1,01 et encore mesurée à 99,5 mm
    const s = computeScaleCorrection(100, 99.5, 1.01);
    expect(s).toBeCloseTo(1.01 * (100 / 99.5), 5);
  });

  it('refuse une mesure invalide', () => {
    expect(() => computeScaleCorrection(100, 0)).toThrow();
    expect(() => computeScaleCorrection(100, 20)).toThrow();
  });
});
