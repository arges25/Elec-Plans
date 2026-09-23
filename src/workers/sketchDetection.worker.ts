/**
 * Worker de détection de croquis sans OpenCV (repli) : seuillage adaptatif,
 * dilatation, analyse des plages horizontales / verticales. Garde l'interface fluide.
 */
import { adaptiveThreshold, dilateMask, toGray } from '../services/planReconstruction/imageOps';
import { detectSegmentsFromMask } from '../services/planReconstruction/segmentProcessing';

export interface SketchWorkerRequest {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  sensitivity: number;
  minLength: number;
}

self.onmessage = (e: MessageEvent<SketchWorkerRequest>) => {
  const { data, width, height, sensitivity, minLength } = e.data;
  const gray = toGray(data, width, height);
  const block = Math.max(15, Math.round(Math.min(width, height) / 25) | 1);
  const mask = dilateMask(adaptiveThreshold(gray, width, height, block, sensitivity), width, height, 2);
  const segments = detectSegmentsFromMask(mask, width, height, minLength, 4);
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage({ segments });
};
