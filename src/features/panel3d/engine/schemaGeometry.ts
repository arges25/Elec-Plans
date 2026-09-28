import type { EnclosureModel } from '../types';

/**
 * Géométrie de la vue « Schéma tableau » (vue technique face à face).
 * Unités : millimètres de schéma (1 module = 18). Chaque rangée comporte, de
 * haut en bas : repères de circuit, règle des modules, appareils, étiquettes.
 */

export const SCHEMA_MODULE = 18;
export const SCHEMA_PAD = 8;
export const SCHEMA_LEFT = 40;
export const SCHEMA_HEADER = 30;
export const SCHEMA_REF_H = 13;
export const SCHEMA_RULER_H = 5;
export const SCHEMA_DEVICE_H = 86;
export const SCHEMA_LABEL_H = 22;
export const SCHEMA_ROW_GAP = 12;

export interface SchemaRowGeometry {
  index: number;
  top: number;
  refY: number;
  rulerY: number;
  devY: number;
  labelY: number;
  bottom: number;
}

export interface SchemaGeometry {
  width: number;
  height: number;
  /** Bord gauche de la grille des modules. */
  gridX: number;
  gridWidth: number;
  moduleW: number;
  modulesPerRow: number;
  rows: SchemaRowGeometry[];
}

export function schemaGeometry(enc: Pick<EnclosureModel, 'rows' | 'modulesPerRow'>): SchemaGeometry {
  const gridX = SCHEMA_PAD + SCHEMA_LEFT;
  const gridWidth = enc.modulesPerRow * SCHEMA_MODULE;
  const rowH = SCHEMA_REF_H + SCHEMA_RULER_H + SCHEMA_DEVICE_H + SCHEMA_LABEL_H + SCHEMA_ROW_GAP;
  const rows: SchemaRowGeometry[] = Array.from({ length: enc.rows }, (_, i) => {
    const top = SCHEMA_PAD + SCHEMA_HEADER + i * rowH;
    const refY = top + 2;
    const rulerY = refY + SCHEMA_REF_H;
    const devY = rulerY + SCHEMA_RULER_H;
    const labelY = devY + SCHEMA_DEVICE_H + 1;
    return { index: i, top, refY, rulerY, devY, labelY, bottom: labelY + SCHEMA_LABEL_H };
  });
  return {
    width: gridX + gridWidth + SCHEMA_PAD,
    height: SCHEMA_PAD + SCHEMA_HEADER + enc.rows * rowH - SCHEMA_ROW_GAP + SCHEMA_PAD,
    gridX,
    gridWidth,
    moduleW: SCHEMA_MODULE,
    modulesPerRow: enc.modulesPerRow,
    rows,
  };
}

export function schemaX(geo: SchemaGeometry, module: number): number {
  return geo.gridX + module * geo.moduleW;
}

export type SchemaZone = 'ref' | 'device' | 'label';

/** Point → rangée, position modulaire (non arrondie) et zone (repère / appareil / étiquette). */
export function schemaHitTest(geo: SchemaGeometry, x: number, y: number): { row: number; module: number; zone: SchemaZone } | null {
  const module = (x - geo.gridX) / geo.moduleW;
  for (const r of geo.rows) {
    if (y >= r.top - 2 && y <= r.bottom + SCHEMA_ROW_GAP / 2) {
      const zone: SchemaZone = y < r.devY ? 'ref' : y <= r.devY + SCHEMA_DEVICE_H ? 'device' : 'label';
      return { row: r.index, module, zone };
    }
  }
  return null;
}
