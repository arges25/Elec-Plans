import { describe, expect, it } from 'vitest';
import { detectWithOpenCv, toPlanGeometry } from '../localPlanReconstruction';
import { createRequire } from 'node:module';
import type { OpenCv } from '../opencvLoader';
import { DEFAULT_RECONSTRUCTION_OPTIONS } from '../types';
import { makeSketch } from './syntheticSketch';

describe('Reconstruction croquis → plan (OpenCV.js)', () => {
  it('détecte les murs avec OpenCV (HoughLinesP)', { timeout: 120_000 }, async () => {
    // Sous Node, l'import ESM d'un module CommonJS exportant une promesse est « thenable » :
    // on passe par require (le navigateur utilise loadOpenCv()).
    const require = createRequire(import.meta.url);
    const cv = (await (require('@techstark/opencv-js') as Promise<unknown>)) as OpenCv;
    const img = makeSketch() as unknown as ImageData;
    const raw = detectWithOpenCv(cv, img, DEFAULT_RECONSTRUCTION_OPTIONS, 36);
    const { walls, doors, confidence } = toPlanGeometry(img, { width: 1600, height: 1200 }, raw, DEFAULT_RECONSTRUCTION_OPTIONS);
    expect(walls.length).toBeGreaterThanOrEqual(5);
    expect(walls.length).toBeLessThanOrEqual(8);
    expect(confidence).toBeGreaterThan(0.5);
    expect(doors.length).toBeGreaterThanOrEqual(1);
  });
});
