import type { LedStrip, Point, Wall } from '../types';
import { distance, snapSegmentEnd, snapToGrid } from './geometry';

/** Couleurs proposées pour les bandes LED. */
export const LED_COLORS: { value: string; label: string }[] = [
  { value: '#eab308', label: 'Blanc chaud' },
  { value: '#0ea5e9', label: 'Blanc froid' },
  { value: '#a855f7', label: 'RGB' },
  { value: '#16a34a', label: 'Vert' },
  { value: '#dc2626', label: 'Rouge' },
];

export const LED_DEFAULT_COLOR = LED_COLORS[0].value;
export const LED_DEFAULT_LABEL = 'LED';

export function toPoints(flat: number[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
}

export function toFlat(points: Point[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

/** Segments de la bande (le segment de fermeture est inclus si `closed`). */
export function ledSegments(flat: number[], closed = false): [Point, Point][] {
  const pts = toPoints(flat);
  const segs: [Point, Point][] = [];
  for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i + 1]]);
  if (closed && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
  return segs;
}

/** Longueur totale en unités plan. */
export function ledLength(flat: number[], closed = false): number {
  return ledSegments(flat, closed).reduce((sum, [a, b]) => sum + distance(a, b), 0);
}

/** Longueur en mètres (null si l'échelle du plan n'est pas définie). */
export function ledLengthMeters(strip: Pick<LedStrip, 'points' | 'closed'>, pixelsPerMeter?: number): number | null {
  if (!pixelsPerMeter || pixelsPerMeter <= 0) return null;
  return ledLength(strip.points, strip.closed) / pixelsPerMeter;
}

/** Texte affiché le long de la bande : « LED 3,20 m » (ou « LED » sans échelle). */
export function ledCaption(strip: Pick<LedStrip, 'points' | 'closed' | 'label'>, pixelsPerMeter?: number): string {
  const label = strip.label?.trim() || LED_DEFAULT_LABEL;
  const m = ledLengthMeters(strip, pixelsPerMeter);
  return m === null ? label : `${label} ${m.toFixed(2).replace('.', ',')} m`;
}

/** Position du libellé : milieu du plus long segment, angle lisible (jamais à l'envers). */
export function ledCaptionPlacement(flat: number[], closed = false): { x: number; y: number; angle: number; nx: number; ny: number } | null {
  const segs = ledSegments(flat, closed);
  if (!segs.length) return null;
  let best = segs[0];
  let bestLen = -1;
  for (const s of segs) {
    const l = distance(s[0], s[1]);
    if (l > bestLen) {
      bestLen = l;
      best = s;
    }
  }
  const [a, b] = best;
  let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  const rad = (angle * Math.PI) / 180;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  // Normale « au-dessus » du texte ; si la bande tourne (contour, angle), le texte
  // passe du côté intérieur (vers le centre du tracé), à l'écart du mur suivi.
  let nx = Math.sin(rad);
  let ny = -Math.cos(rad);
  const pts = toPoints(flat);
  const c = pts.reduce((acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length }), { x: 0, y: 0 });
  const side = (c.x - mid.x) * nx + (c.y - mid.y) * ny;
  if (side < -1e-6 * Math.max(1, bestLen)) {
    nx = -nx;
    ny = -ny;
  }
  return { ...mid, angle, nx, ny };
}

interface Face {
  origin: Point;
  dir: Point;
  point: Point;
  dist: number;
}

function lineIntersection(p: Point, d: Point, q: Point, e: Point): Point | null {
  const cross = d.x * e.y - d.y * e.x;
  if (Math.abs(cross) < 1e-9) return null;
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / cross;
  return { x: p.x + d.x * t, y: p.y + d.y * t };
}

/**
 * Accroche un point le long de la face d'un mur (côté du doigt), décalée de
 * l'épaisseur / 2 + `gap`. Près d'un angle de pièce, retourne l'angle intérieur
 * (intersection des deux faces) : tracer le tour d'une chambre devient facile.
 */
export function snapToWallFace(p: Point, walls: Wall[], radius: number, gap: number): Point | null {
  const faces: Face[] = [];
  for (const w of walls) {
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    if (len < 1e-6) continue;
    const dir = { x: (w.x2 - w.x1) / len, y: (w.y2 - w.y1) / len };
    const n = { x: -dir.y, y: dir.x };
    const side = Math.sign((p.x - w.x1) * n.x + (p.y - w.y1) * n.y) || 1;
    const off = w.thickness / 2 + gap;
    const origin = { x: w.x1 + n.x * side * off, y: w.y1 + n.y * side * off };
    // Projection sur la face (légèrement prolongée aux extrémités pour atteindre les angles)
    const ext = off + radius;
    const t = Math.max(-ext, Math.min(len + ext, (p.x - origin.x) * dir.x + (p.y - origin.y) * dir.y));
    const point = { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
    const dist = distance(p, point);
    if (dist <= radius) faces.push({ origin, dir, point, dist });
  }
  if (!faces.length) return null;
  faces.sort((a, b) => a.dist - b.dist);
  const f0 = faces[0];
  for (const f1 of faces.slice(1)) {
    if (Math.abs(f0.dir.x * f1.dir.y - f0.dir.y * f1.dir.x) < 0.3) continue;
    const corner = lineIntersection(f0.origin, f0.dir, f1.origin, f1.dir);
    if (corner && distance(corner, p) <= radius * 1.5) return corner;
  }
  return f0.point;
}

export interface LedSnapOptions {
  /** Point précédent (accroche d'angle 0/45/90°). */
  from?: Point | null;
  /** Point de départ du tracé : s'y accrocher ferme le contour. */
  start?: Point | null;
  walls: Wall[];
  /** Rayon d'accroche (unités plan). */
  radius: number;
  /** Écart entre la face du mur et la bande. */
  gap: number;
  snapWalls: boolean;
  gridSize?: number | null;
}

export type LedSnapKind = 'start' | 'wall' | 'free';

/** Accroche d'un point de bande LED : départ (fermeture) > face de mur > angle / grille. */
export function snapLedPoint(p: Point, o: LedSnapOptions): { point: Point; kind: LedSnapKind } {
  if (o.start && o.from && distance(p, o.start) <= o.radius) return { point: { ...o.start }, kind: 'start' };
  if (o.snapWalls) {
    const face = snapToWallFace(p, o.walls, o.radius, o.gap);
    if (face) return { point: face, kind: 'wall' };
  }
  let q = o.from ? snapSegmentEnd(o.from, p, 7) : p;
  if (o.gridSize) q = snapToGrid(q, o.gridSize);
  return { point: q, kind: 'free' };
}

/** Supprime un point (retourne null si la bande deviendrait trop courte). */
export function removeLedPoint(flat: number[], index: number, closed = false): number[] | null {
  const n = flat.length / 2;
  if (n <= (closed ? 3 : 2)) return null;
  return flat.filter((_, i) => Math.floor(i / 2) !== index);
}

/** Insère un point après l'indice `afterIndex`. */
export function insertLedPoint(flat: number[], afterIndex: number, p: Point): number[] {
  const at = (afterIndex + 1) * 2;
  return [...flat.slice(0, at), p.x, p.y, ...flat.slice(at)];
}

export function moveLedPoint(flat: number[], index: number, p: Point): number[] {
  const out = flat.slice();
  out[index * 2] = p.x;
  out[index * 2 + 1] = p.y;
  return out;
}

export function translateLed(flat: number[], dx: number, dy: number): number[] {
  return flat.map((v, i) => v + (i % 2 === 0 ? dx : dy));
}

/** Nettoie un tracé : retire les points doublons consécutifs. */
export function cleanLedPoints(points: Point[], minDist: number): Point[] {
  const out: Point[] = [];
  for (const p of points) if (!out.length || distance(out[out.length - 1], p) >= minDist) out.push(p);
  return out;
}

/** Résumé pour la légende : « Bande LED (2) — 7,40 m ». */
export function ledLegendLabel(strips: Pick<LedStrip, 'points' | 'closed'>[], pixelsPerMeter?: number): string | null {
  if (!strips.length) return null;
  const total = strips.reduce((sum, l) => sum + ledLength(l.points, l.closed), 0);
  const m = pixelsPerMeter ? total / pixelsPerMeter : null;
  return `Bande LED${m !== null ? ` — ${m.toFixed(2).replace('.', ',')} m` : ''}`;
}
