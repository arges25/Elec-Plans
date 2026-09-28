import type { EnclosureModel } from '../types';
import { DIN_MODULE_MM } from '../constants';

/**
 * Géométrie du tableau en millimètres (face avant, origine en haut à gauche).
 * Toutes les dimensions visuelles découlent des dimensions réelles de la base.
 * Sans dimensions officielles, une vue schématique est construite à partir de la
 * seule grille modulaire (jamais affichée comme cote).
 */

/** Hauteur visible d'une face d'appareil modulaire à travers le capot. */
export const DEVICE_FACE_MM = 45;
/** Hauteur du porte-étiquette au-dessus de chaque rangée. */
export const LABEL_HOLDER_MM = 13;
const OPENING_MM = 49;
const LABEL_GAP_MM = 3;
/** Entraxe utilisé pour une vue schématique quand il n'est pas publié. */
const SCHEMATIC_PITCH_MM = 125;
const SCHEMATIC_SIDE_MM = 16;

export interface RowGeometry {
  index: number;
  top: number;
  labelY: number;
  labelH: number;
  openY: number;
  openH: number;
  deviceY: number;
  deviceH: number;
  railY: number;
}

export interface BoardGeometry {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  /** Dimensions issues de la base (true) ou vue schématique (false). */
  measured: boolean;
  rows: number;
  modulesPerRow: number;
  moduleMm: number;
  windowX: number;
  windowWidth: number;
  rowPitch: number;
  rowGeo: RowGeometry[];
}

export function boardGeometry(enc: EnclosureModel): BoardGeometry {
  const moduleMm = DIN_MODULE_MM;
  const windowWidth = enc.modulesPerRow * moduleMm;
  const measured = Boolean(enc.dimensions);
  const widthMm = enc.dimensions?.widthMm ?? windowWidth + SCHEMATIC_SIDE_MM * 2;
  const heightMm = enc.dimensions?.heightMm ?? enc.rows * SCHEMATIC_PITCH_MM + SCHEMATIC_PITCH_MM;
  const depthMm = enc.dimensions?.depthMm ?? 100;
  // Entraxe publié, sinon réparti régulièrement dans la hauteur réelle
  const rowPitch = enc.rowPitchMm ?? Math.min(SCHEMATIC_PITCH_MM, (heightMm * 0.8) / enc.rows);
  const topMargin = (heightMm - enc.rows * rowPitch) / 2;
  const group = LABEL_HOLDER_MM + LABEL_GAP_MM + OPENING_MM;
  const rowGeo: RowGeometry[] = Array.from({ length: enc.rows }, (_, i) => {
    const top = topMargin + i * rowPitch;
    const labelY = top + (rowPitch - group) / 2;
    const openY = labelY + LABEL_HOLDER_MM + LABEL_GAP_MM;
    const deviceY = openY + (OPENING_MM - DEVICE_FACE_MM) / 2;
    return {
      index: i,
      top,
      labelY,
      labelH: LABEL_HOLDER_MM,
      openY,
      openH: OPENING_MM,
      deviceY,
      deviceH: DEVICE_FACE_MM,
      railY: deviceY + DEVICE_FACE_MM / 2,
    };
  });
  return {
    widthMm,
    heightMm,
    depthMm,
    measured,
    rows: enc.rows,
    modulesPerRow: enc.modulesPerRow,
    moduleMm,
    windowX: (widthMm - windowWidth) / 2,
    windowWidth,
    rowPitch,
    rowGeo,
  };
}

export function moduleX(geo: BoardGeometry, module: number): number {
  return geo.windowX + module * geo.moduleMm;
}

/** Point (mm) → rangée et position modulaire (sans arrondi). */
export function hitTest(geo: BoardGeometry, xMm: number, yMm: number): { row: number; module: number; inLabel: boolean } | null {
  for (const r of geo.rowGeo) {
    if (yMm >= r.labelY - 6 && yMm <= r.openY + r.openH + 10) {
      return { row: r.index, module: (xMm - geo.windowX) / geo.moduleMm, inLabel: yMm < r.openY };
    }
  }
  // Entre deux rangées : la plus proche
  let best: RowGeometry | null = null;
  let bestD = Infinity;
  for (const r of geo.rowGeo) {
    const d = Math.abs(yMm - (r.openY + r.openH / 2));
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  if (!best || bestD > geo.rowPitch) return null;
  return { row: best.index, module: (xMm - geo.windowX) / geo.moduleMm, inLabel: false };
}
