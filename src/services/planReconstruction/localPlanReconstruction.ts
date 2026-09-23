import type { Door, Wall } from '../../types';
import { createId } from '../../utils/id';
import { adaptiveThreshold, dilateMask, toGray } from './imageOps';
import { loadOpenCv, type OpenCv } from './opencvLoader';
import { defaultProcessOptions, detectSegmentsFromMask, processSegments, reconstructionConfidence } from './segmentProcessing';
import type { PlanReconstructionService, RawSegment, ReconstructionMethod, ReconstructionOptions, ReconstructionResult } from './types';

/**
 * Reconstruction LOCALE croquis → plan (aucun envoi sur internet).
 * 1. OpenCV.js : niveaux de gris, flou, seuillage adaptatif, fermeture, dilatation,
 *    extraction des traits horizontaux / verticaux (ouverture morphologique), HoughLinesP ;
 * 2. repli sans OpenCV (worker) : seuillage adaptatif + analyse des plages ;
 * 3. post-traitement : fusion, alignement, fermeture des angles, ouvertures.
 * Résultat : plan SIMPLIFIÉ destiné à l'implantation électrique, à vérifier.
 */

function odd(n: number): number {
  const v = Math.max(3, Math.round(n));
  return v % 2 ? v : v + 1;
}

export function detectWithOpenCv(cv: OpenCv, image: ImageData, opts: ReconstructionOptions, minLength: number): RawSegment[] {
  const w = image.width;
  const h = image.height;
  const src = cv.matFromImageData(image);
  const gray = new cv.Mat();
  const bin = new cv.Mat();
  const lines = new cv.Mat();
  const mats: { delete: () => void }[] = [src, gray, bin, lines];
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.adaptiveThreshold(gray, bin, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, odd(Math.min(w, h) / 25), Math.max(2, opts.sensitivity));
    const k3 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    mats.push(k3);
    cv.morphologyEx(bin, bin, cv.MORPH_CLOSE, k3);
    const k5 = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    mats.push(k5);
    cv.dilate(bin, bin, k5);
    if (opts.orthogonalOnly) {
      const len = Math.max(10, Math.round(minLength * 0.5));
      const hK = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(len, 1));
      const vK = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, len));
      const hMask = new cv.Mat();
      const vMask = new cv.Mat();
      mats.push(hK, vK, hMask, vMask);
      cv.morphologyEx(bin, hMask, cv.MORPH_OPEN, hK);
      cv.morphologyEx(bin, vMask, cv.MORPH_OPEN, vK);
      cv.bitwise_or(hMask, vMask, bin);
    }
    cv.HoughLinesP(bin, lines, 1, Math.PI / 180, 30, Math.max(8, minLength * 0.6), Math.max(3, minLength * 0.12));
    // Selon la version d'OpenCV, la sortie est N × 1 ou 1 × N (4 entiers par segment).
    const out: RawSegment[] = [];
    const d = lines.data32S;
    const n = Math.floor(d.length / 4);
    for (let i = 0; i < n; i++) out.push({ x1: d[i * 4], y1: d[i * 4 + 1], x2: d[i * 4 + 2], y2: d[i * 4 + 3] });
    return out;
  } finally {
    for (const m of mats) m.delete();
  }
}

/** Repli sans OpenCV (mêmes étapes principales, en TypeScript pur). */
export function detectWithoutOpenCv(image: ImageData, opts: ReconstructionOptions, minLength: number): RawSegment[] {
  const { width, height } = image;
  const gray = toGray(image.data, width, height);
  const block = odd(Math.min(width, height) / 25);
  const mask = dilateMask(adaptiveThreshold(gray, width, height, block, opts.sensitivity), width, height, 2);
  return detectSegmentsFromMask(mask, width, height, minLength, 4);
}

function detectInWorker(image: ImageData, opts: ReconstructionOptions, minLength: number): Promise<RawSegment[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../../workers/sketchDetection.worker.ts', import.meta.url), { type: 'module' });
    } catch (e) {
      reject(e);
      return;
    }
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Délai dépassé'));
    }, 60_000);
    worker.onmessage = (e: MessageEvent<{ segments: RawSegment[] }>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(e.data.segments);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      reject(e);
    };
    const data = new Uint8ClampedArray(image.data);
    worker.postMessage({ data, width: image.width, height: image.height, sensitivity: opts.sensitivity, minLength }, [data.buffer]);
  });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Délai dépassé')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Convertit les segments traités (pixels d'analyse) en murs / portes du plan. */
export function toPlanGeometry(
  image: { width: number; height: number },
  planSize: { width: number; height: number },
  raw: RawSegment[],
  opts: ReconstructionOptions,
): { walls: Wall[]; doors: Door[]; confidence: number } {
  const p = defaultProcessOptions(image.width, image.height, opts.minWallRatio, opts.orthogonalOnly, opts.detectOpenings);
  const res = processSegments(raw, p);
  const k = planSize.width / image.width;
  const defaultT = Math.max(8, Math.round(Math.max(planSize.width, planSize.height) / 140));
  const thickness = res.thickness > 0 ? Math.min(defaultT * 2, Math.max(defaultT * 0.6, res.thickness * k)) : defaultT;
  const walls: Wall[] = res.walls.map((w) => ({
    id: createId('wall'),
    x1: Math.round(w.x1 * k * 10) / 10,
    y1: Math.round(w.y1 * k * 10) / 10,
    x2: Math.round(w.x2 * k * 10) / 10,
    y2: Math.round(w.y2 * k * 10) / 10,
    thickness,
  }));
  const doors: Door[] = res.openings
    .filter((o) => walls[o.wallIndex])
    .map((o) => ({ id: createId('door'), wallId: walls[o.wallIndex].id, t: o.t, width: o.width * k, flip: false, hingeEnd: false }));
  return { walls, doors, confidence: reconstructionConfidence(res.walls, p.mergeDistance) };
}

export const localPlanReconstruction: PlanReconstructionService = {
  id: 'local',
  label: 'Reconstruction automatique (locale)',
  isAvailable: () => true,
  async reconstruct(image, planSize, opts, onProgress) {
    const minLength = Math.max(12, Math.min(image.width, image.height) * opts.minWallRatio);
    let raw: RawSegment[];
    let method: ReconstructionMethod = 'opencv';
    const warnings: string[] = [];
    try {
      onProgress?.('Chargement d’OpenCV.js (la première fois : ≈ 10 Mo)…');
      const cv = await withTimeout(loadOpenCv(), 90_000);
      onProgress?.('Détection du croquis (OpenCV.js)…');
      await new Promise((r) => setTimeout(r, 20));
      raw = detectWithOpenCv(cv, image, opts, minLength);
    } catch (e) {
      console.warn('OpenCV indisponible, détection de repli', e);
      method = 'local';
      warnings.push('OpenCV.js indisponible (hors connexion ?) : détection simplifiée utilisée.');
      onProgress?.('Détection du croquis (mode simplifié)…');
      try {
        raw = await detectInWorker(image, opts, minLength);
      } catch {
        raw = detectWithoutOpenCv(image, opts, minLength);
      }
    }
    onProgress?.('Simplification des murs…');
    const { walls, doors, confidence } = toPlanGeometry(image, planSize, raw, opts);
    if (!walls.length) warnings.push('Aucun mur détecté : tracez les murs par-dessus le croquis.');
    else if (confidence < 0.55) warnings.push('Le plan nécessite quelques corrections.');
    const result: ReconstructionResult = { walls, doors, method, confidence, rawSegments: raw.length, warnings };
    return result;
  },
};
