import type { Point, Wall } from '../types';

/** Utilitaires géométriques (plan, aimantation, liaisons). */

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Normalise un angle en degrés dans ]-180, 180]. */
export function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a <= -180) a += 360;
  if (a > 180) a -= 360;
  return a;
}

export function rotatePoint(p: Point, angleDeg: number, origin: Point = { x: 0, y: 0 }): Point {
  const r = degToRad(angleDeg);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos };
}

export interface SegmentProjection {
  point: Point;
  /** Paramètre le long du segment (0 → 1). */
  t: number;
  distance: number;
}

/** Projette un point sur un segment [a, b] (projection bornée aux extrémités). */
export function projectPointOnSegment(p: Point, a: Point, b: Point): SegmentProjection {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + dx * t, y: a.y + dy * t };
  return { point, t, distance: distance(p, point) };
}

export function wallStart(w: Wall): Point {
  return { x: w.x1, y: w.y1 };
}

export function wallEnd(w: Wall): Point {
  return { x: w.x2, y: w.y2 };
}

export function wallLength(w: Wall): number {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

/** Angle du mur en degrés (0 = horizontal vers la droite). */
export function wallAngle(w: Wall): number {
  return radToDeg(Math.atan2(w.y2 - w.y1, w.x2 - w.x1));
}

export function pointOnWall(w: Wall, t: number): Point {
  return { x: w.x1 + (w.x2 - w.x1) * t, y: w.y1 + (w.y2 - w.y1) * t };
}

export interface WallSnapResult {
  x: number;
  y: number;
  /** Rotation (degrés) orientant le dos du symbole (haut local) vers le mur. */
  rotation: number;
  wallId: string;
  t: number;
  distance: number;
}

/**
 * Aimante un point au mur le plus proche.
 * - `snapDistance` : distance maximale (unités plan) entre le point et l'axe du mur ;
 * - le symbole est placé contre la face du mur située du côté du point ;
 * - `depth` : décalage supplémentaire du centre du symbole depuis la face du mur.
 */
export function snapToWalls(p: Point, walls: Wall[], snapDistance: number, depth = 0): WallSnapResult | null {
  let best: { wall: Wall; proj: SegmentProjection } | null = null;
  for (const wall of walls) {
    if (wallLength(wall) < 1e-6) continue;
    const proj = projectPointOnSegment(p, wallStart(wall), wallEnd(wall));
    const reach = snapDistance + wall.thickness / 2 + depth;
    if (proj.distance <= reach && (!best || proj.distance < best.proj.distance)) {
      best = { wall, proj };
    }
  }
  if (!best) return null;
  const { wall, proj } = best;
  const len = wallLength(wall);
  const ux = (wall.x2 - wall.x1) / len;
  const uy = (wall.y2 - wall.y1) / len;
  // Normale gauche du mur
  let nx = -uy;
  let ny = ux;
  const side = (p.x - proj.point.x) * nx + (p.y - proj.point.y) * ny;
  if (side < 0) {
    nx = -nx;
    ny = -ny;
  }
  const offset = wall.thickness / 2 + depth;
  const x = proj.point.x + nx * offset;
  const y = proj.point.y + ny * offset;
  // Le haut local (0, -1) du symbole doit pointer vers le mur, soit -n.
  // Le vecteur local (0, 1) tourné de r vaut (-sin r, cos r) et doit valoir n.
  const rotation = normalizeAngle(radToDeg(Math.atan2(-nx, ny)));
  return { x, y, rotation: round2(rotation), wallId: wall.id, t: proj.t, distance: proj.distance };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Trouve le mur le plus proche d'un point (pour portes / fenêtres). */
export function nearestWall(p: Point, walls: Wall[], maxDistance: number): { wall: Wall; t: number; distance: number } | null {
  let best: { wall: Wall; t: number; distance: number } | null = null;
  for (const wall of walls) {
    const proj = projectPointOnSegment(p, wallStart(wall), wallEnd(wall));
    if (proj.distance <= maxDistance && (!best || proj.distance < best.distance)) {
      best = { wall, t: proj.t, distance: proj.distance };
    }
  }
  return best;
}

/** Arrondit un angle au multiple de `step` le plus proche si l'écart est inférieur à `tolerance`. */
export function snapAngle(angleDeg: number, step = 45, tolerance = 8): number {
  const snapped = Math.round(angleDeg / step) * step;
  return Math.abs(snapped - angleDeg) <= tolerance ? snapped : angleDeg;
}

/** Contraint le point `to` pour que le segment from→to soit horizontal/vertical/45° si proche. */
export function snapSegmentEnd(from: Point, to: Point, tolerance = 8): Point {
  const len = distance(from, to);
  if (len < 1e-6) return to;
  const angle = radToDeg(Math.atan2(to.y - from.y, to.x - from.x));
  const snapped = snapAngle(angle, 45, tolerance);
  if (snapped === angle) return to;
  const r = degToRad(snapped);
  return { x: from.x + Math.cos(r) * len, y: from.y + Math.sin(r) * len };
}

/** Extrémité de mur la plus proche (pour raccorder les murs entre eux). */
export function nearestWallEndpoint(p: Point, walls: Wall[], radius: number, excludeWallId?: string): Point | null {
  let best: Point | null = null;
  let bestD = radius;
  for (const w of walls) {
    if (w.id === excludeWallId) continue;
    for (const e of [wallStart(w), wallEnd(w)]) {
      const d = distance(p, e);
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
  }
  return best;
}

export function snapToGrid(p: Point, grid: number): Point {
  return { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid };
}

/* ------------------------------------------------------------------ */
/* Liaisons (courbes de Bézier)                                         */
/* ------------------------------------------------------------------ */

export interface BezierCurve {
  p0: Point;
  c1: Point;
  c2: Point;
  p1: Point;
}

/**
 * Points d'ancrage d'une liaison : sur le pourtour de chaque symbole,
 * dans la direction de l'autre symbole.
 */
export function connectionAnchors(a: Point, ra: number, b: Point, rb: number): { start: Point; end: Point } {
  const d = distance(a, b);
  if (d < 1e-6) return { start: a, end: b };
  const ux = (b.x - a.x) / d;
  const uy = (b.y - a.y) / d;
  const ka = Math.min(ra, d / 3);
  const kb = Math.min(rb, d / 3);
  return {
    start: { x: a.x + ux * ka, y: a.y + uy * ka },
    end: { x: b.x - ux * kb, y: b.y - uy * kb },
  };
}

/** Courbe de Bézier douce entre deux points ; `curvature` ∈ [-1, 1]. */
export function connectionCurve(start: Point, end: Point, curvature: number): BezierCurve {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  const nx = len === 0 ? 0 : -dy / len;
  const ny = len === 0 ? 0 : dx / len;
  const k = curvature * len * 0.35;
  return {
    p0: start,
    c1: { x: start.x + dx * 0.25 + nx * k, y: start.y + dy * 0.25 + ny * k },
    c2: { x: start.x + dx * 0.75 + nx * k, y: start.y + dy * 0.75 + ny * k },
    p1: end,
  };
}

export function bezierPoint(c: BezierCurve, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const d = 3 * mt * t * t;
  const e = t * t * t;
  return {
    x: a * c.p0.x + b * c.c1.x + d * c.c2.x + e * c.p1.x,
    y: a * c.p0.y + b * c.c1.y + d * c.c2.y + e * c.p1.y,
  };
}

export function bezierToFlatPoints(c: BezierCurve): number[] {
  return [c.p0.x, c.p0.y, c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.p1.x, c.p1.y];
}

export function bezierToSvgPath(c: BezierCurve): string {
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M ${f(c.p0.x)} ${f(c.p0.y)} C ${f(c.c1.x)} ${f(c.c1.y)} ${f(c.c2.x)} ${f(c.c2.y)} ${f(c.p1.x)} ${f(c.p1.y)}`;
}

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function emptyBounds(): Bounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

export function extendBounds(b: Bounds, x: number, y: number, pad = 0): void {
  b.minX = Math.min(b.minX, x - pad);
  b.minY = Math.min(b.minY, y - pad);
  b.maxX = Math.max(b.maxX, x + pad);
  b.maxY = Math.max(b.maxY, y + pad);
}

export function isBoundsValid(b: Bounds): boolean {
  return Number.isFinite(b.minX) && Number.isFinite(b.maxX) && b.maxX > b.minX && b.maxY > b.minY;
}

export function rectFromPoints(a: Point, b: Point): { x: number; y: number; width: number; height: number } {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

/** Intersection de deux droites (a1a2) et (b1b2), ou null si parallèles. */
export function lineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const d = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / d;
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
}
