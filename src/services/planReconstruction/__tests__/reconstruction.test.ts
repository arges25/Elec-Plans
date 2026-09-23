import { describe, expect, it } from 'vitest';
import { detectWithoutOpenCv, toPlanGeometry } from '../localPlanReconstruction';
import { DEFAULT_RECONSTRUCTION_OPTIONS } from '../types';
import { makeSketch } from './syntheticSketch';

describe('Reconstruction croquis → plan (repli sans OpenCV)', () => {
  it('détecte les murs principaux et la porte d’un croquis simple', () => {
    const img = makeSketch() as unknown as ImageData;
    const raw = detectWithoutOpenCv(img, DEFAULT_RECONSTRUCTION_OPTIONS, 36);
    const { walls, doors, confidence } = toPlanGeometry(img, { width: 1600, height: 1200 }, raw, DEFAULT_RECONSTRUCTION_OPTIONS);
    expect(walls.length).toBeGreaterThanOrEqual(5);
    expect(walls.length).toBeLessThanOrEqual(8);
    expect(doors.length).toBeGreaterThanOrEqual(1);
    expect(confidence).toBeGreaterThan(0.5);
  });
});
