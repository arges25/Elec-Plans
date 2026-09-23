import type { DashStyle, ElectricalConnection, PlacedSymbol } from '../types';
import { bezierPoint, connectionAnchors, connectionCurve, type BezierCurve } from './geometry';
import { symbolAnchorRadius } from './symbols';

/**
 * Numéro de groupe de commande pour une nouvelle liaison de commande :
 * si la source ou la cible appartient déjà à un groupe, on le réutilise
 * (ex. va-et-vient 1 + va-et-vient 2 → même plafonnier = « Commande 1 »),
 * sinon on prend le numéro suivant.
 */
export function nextCommandGroup(connections: ElectricalConnection[], sourceId: string, targetId: string): number {
  const commands = connections.filter((c) => c.type === 'command' && c.group !== undefined);
  const touching = commands.find((c) => c.sourceId === targetId || c.targetId === targetId || c.sourceId === sourceId || c.targetId === sourceId);
  if (touching?.group !== undefined) return touching.group;
  return commands.reduce((max, c) => Math.max(max, c.group ?? 0), 0) + 1;
}

/** Courbe d'une liaison, recalculée à partir des positions actuelles des symboles. */
export function connectionGeometry(conn: ElectricalConnection, source: PlacedSymbol, target: PlacedSymbol): BezierCurve {
  const { start, end } = connectionAnchors({ x: source.x, y: source.y }, symbolAnchorRadius(source), { x: target.x, y: target.y }, symbolAnchorRadius(target));
  return connectionCurve(start, end, conn.curvature);
}

export function connectionLabelPoint(curve: BezierCurve) {
  return bezierPoint(curve, 0.5);
}

/** Motif de pointillés (unités plan) selon le style et l'épaisseur. */
export function dashPattern(dash: DashStyle, width: number): number[] {
  const w = Math.max(1, width);
  switch (dash) {
    case 'dash':
      return [5 * w, 3.5 * w];
    case 'dot':
      return [0.1, 3 * w];
    case 'long':
      return [10 * w, 4 * w];
    case 'solid':
      return [];
  }
}

export const CONNECTION_TYPE_LABELS: Record<ElectricalConnection['type'], string> = {
  command: 'Commande',
  circuit: 'Circuit',
  information: 'Information',
};

export const DASH_LABELS: Record<DashStyle, string> = {
  dash: 'Tirets',
  dot: 'Points',
  long: 'Tirets longs',
  solid: 'Continu',
};
