import type { Point, Wall } from '../types';
import { wallLength } from './geometry';

export interface OpeningFrame {
  /** Centre de l'ouverture. */
  c: Point;
  /** Extrémités de l'ouverture sur l'axe du mur. */
  a: Point;
  b: Point;
  /** Vecteur unitaire le long du mur. */
  u: Point;
  /** Normale unitaire. */
  n: Point;
  width: number;
}

/** Borne la position t pour que l'ouverture reste dans le mur. */
export function clampOpeningT(wall: Wall, t: number, width: number): number {
  const len = wallLength(wall);
  if (len <= width) return 0.5;
  const half = width / 2 / len;
  return Math.max(half, Math.min(1 - half, t));
}

export function openingFrame(wall: Wall, t: number, width: number): OpeningFrame {
  const len = Math.max(1e-6, wallLength(wall));
  const u = { x: (wall.x2 - wall.x1) / len, y: (wall.y2 - wall.y1) / len };
  const n = { x: -u.y, y: u.x };
  const w = Math.min(width, len);
  const tt = clampOpeningT(wall, t, w);
  const c = { x: wall.x1 + (wall.x2 - wall.x1) * tt, y: wall.y1 + (wall.y2 - wall.y1) * tt };
  const h = w / 2;
  return { c, a: { x: c.x - u.x * h, y: c.y - u.y * h }, b: { x: c.x + u.x * h, y: c.y + u.y * h }, u, n, width: w };
}

export interface DoorGeometry extends OpeningFrame {
  hinge: Point;
  /** Point de départ de l'arc (extrémité opposée à la charnière). */
  arcStart: Point;
  /** Extrémité du battant ouvert. */
  leafEnd: Point;
  startAngle: number;
  endAngle: number;
  /** true si l'arc va dans le sens des angles croissants (horaire, axe Y vers le bas). */
  clockwise: boolean;
}

export function doorGeometry(wall: Wall, t: number, width: number, flip: boolean, hingeEnd: boolean): DoorGeometry {
  const f = openingFrame(wall, t, width);
  const hinge = hingeEnd ? f.b : f.a;
  const arcStart = hingeEnd ? f.a : f.b;
  const s = flip ? -1 : 1;
  const leafEnd = { x: hinge.x + f.n.x * s * f.width, y: hinge.y + f.n.y * s * f.width };
  const startAngle = Math.atan2(arcStart.y - hinge.y, arcStart.x - hinge.x);
  const endAngle = Math.atan2(leafEnd.y - hinge.y, leafEnd.x - hinge.x);
  let delta = endAngle - startAngle;
  while (delta <= -Math.PI) delta += 2 * Math.PI;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  return { ...f, hinge, arcStart, leafEnd, startAngle, endAngle, clockwise: delta > 0 };
}
