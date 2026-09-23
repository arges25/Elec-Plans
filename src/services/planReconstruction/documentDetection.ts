import type { Quad } from '../imageProcessing';
import { drawToCanvas } from '../imageProcessing';
import { loadOpenCv } from './opencvLoader';

/** Ordonne 4 points : haut-gauche, haut-droite, bas-droite, bas-gauche. */
export function orderQuad(points: { x: number; y: number }[]): Quad {
  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...points].sort((a, b) => a.y - a.x - (b.y - b.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]];
}

/**
 * Détection automatique des bords d'une feuille / d'un plan photographié (OpenCV.js).
 * Retourne null si aucun quadrilatère convaincant n'est trouvé.
 */
export async function detectDocumentQuad(canvas: HTMLCanvasElement): Promise<Quad | null> {
  const cv = await loadOpenCv();
  const small = drawToCanvas(canvas, 800);
  const k = canvas.width / small.width;
  const src = cv.imread(small);
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, edges, 50, 150);
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.dilate(edges, edges, kernel);
    kernel.delete();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const minArea = small.width * small.height * 0.2;
    let best: { quad: Quad; area: number } | null = null;
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area >= minArea) {
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * cv.arcLength(cnt, true), true);
        if (approx.rows === 4 && (!best || area > best.area)) {
          const pts: { x: number; y: number }[] = [];
          for (let j = 0; j < 4; j++) pts.push({ x: approx.data32S[j * 2] * k, y: approx.data32S[j * 2 + 1] * k });
          best = { quad: orderQuad(pts), area };
        }
        approx.delete();
      }
      cnt.delete();
    }
    return best?.quad ?? null;
  } finally {
    src.delete();
    gray.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
}
