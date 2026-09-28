import type { BoardView, EnclosureModel, PlacedDevice } from '../types';
import { boardGeometry, hitTest, moduleX, DEVICE_FACE_MM } from '../engine/geometry';
import { schemaGeometry, schemaHitTest, schemaX } from '../engine/schemaGeometry';
import { boardViewBox } from '../render/BoardSvg';

/**
 * Géométrie d'une vue pour le tableau interactif : cadrage, détection de la
 * rangée / du module sous le doigt, position d'un appareil. Les deux vues
 * (schéma et coffret) partagent les mêmes données et les mêmes gestes.
 */

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasHit {
  row: number;
  module: number;
  zone: 'ref' | 'device' | 'label';
}

export interface CanvasLayout {
  view: BoardView;
  fullVb: ViewBox;
  /** Cadrage initial : tout le tableau s'il reste lisible, sinon pleine largeur / vue rapprochée. */
  initialVb: (containerW: number, containerH: number) => ViewBox;
  hit: (x: number, y: number) => CanvasHit | null;
  deviceBox: (d: PlacedDevice) => ViewBox | null;
  modulesPerRow: number;
}

/** Échelle minimale lisible sur téléphone (pixels par millimètre de schéma). */
const MOBILE_PX_PER_UNIT = 2.3;
/** En dessous, la vue d'ensemble n'est plus lisible (texte des étiquettes < 8 px). */
const MIN_READABLE_PX_PER_UNIT = 2;

export function schemaLayout(enc: EnclosureModel): CanvasLayout {
  const geo = schemaGeometry(enc);
  return {
    view: 'schema',
    fullVb: { x: 0, y: 0, w: geo.width, h: geo.height },
    initialVb: (cw, ch) => {
      const all = Math.min(cw / geo.width, ch / geo.height);
      if (all >= MIN_READABLE_PX_PER_UNIT) return { x: 0, y: 0, w: geo.width, h: geo.height };
      // Pleine largeur (défilement vertical) ; sur téléphone, échelle minimale lisible (défilement horizontal)
      const k = Math.max(MOBILE_PX_PER_UNIT, cw / geo.width);
      return { x: 0, y: 0, w: cw / k, h: ch / k };
    },
    hit: (x, y) => schemaHitTest(geo, x, y),
    deviceBox: (d) => {
      const r = geo.rows[d.row];
      if (!r) return null;
      return { x: schemaX(geo, d.startModule), y: r.refY, w: d.moduleWidth * geo.moduleW, h: r.bottom - r.refY };
    },
    modulesPerRow: enc.modulesPerRow,
  };
}

export function coffretLayout(enc: EnclosureModel): CanvasLayout {
  const geo = boardGeometry(enc);
  const full = boardViewBox(geo);
  const first = geo.rowGeo[0];
  const last = geo.rowGeo[geo.rowGeo.length - 1];
  const rows = { x: geo.windowX - 8, y: first.labelY - 8, w: geo.windowWidth + 16, h: last.openY + last.openH - first.labelY + 16 };
  return {
    view: 'coffret',
    fullVb: full,
    initialVb: (cw) => (cw < 700 ? rows : full),
    hit: (x, y) => {
      const h = hitTest(geo, x, y);
      return h ? { row: h.row, module: h.module, zone: h.inLabel ? 'label' : 'device' } : null;
    },
    deviceBox: (d) => {
      const r = geo.rowGeo[d.row];
      if (!r) return null;
      return { x: moduleX(geo, d.startModule), y: r.labelY, w: d.moduleWidth * geo.moduleMm, h: r.deviceY + DEVICE_FACE_MM - r.labelY };
    },
    modulesPerRow: enc.modulesPerRow,
  };
}

export function layoutFor(view: BoardView, enc: EnclosureModel): CanvasLayout {
  return view === 'schema' ? schemaLayout(enc) : coffretLayout(enc);
}
