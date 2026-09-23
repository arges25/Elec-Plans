import type { ElectricalSymbolDefinition, PlacedSymbol, Wall } from '../types';
import { getSymbolDefinition } from '../data/electricalSymbols';
import { SYMBOL_BOX, WALL_BACK } from '../data/symbolShapes';
import { snapToWalls, type WallSnapResult } from './geometry';

/** Taille (unités plan) d'un symbole posé. */
export function symbolWorldSize(def: ElectricalSymbolDefinition, scale: number): number {
  return def.defaultSize * scale;
}

/** Facteur unités-symbole → unités plan. */
export function symbolUnitScale(def: ElectricalSymbolDefinition, scale: number): number {
  return symbolWorldSize(def, scale) / SYMBOL_BOX;
}

/** Distance entre le centre du symbole et la face du mur (dos du symbole). */
export function symbolWallDepth(def: ElectricalSymbolDefinition, scale: number): number {
  return (Math.abs(WALL_BACK) / SYMBOL_BOX) * symbolWorldSize(def, scale);
}

/** Rayon approximatif (ancrage des liaisons). */
export function symbolAnchorRadius(symbol: PlacedSymbol): number {
  const def = getSymbolDefinition(symbol.symbolType);
  return symbolWorldSize(def, symbol.scale) * 0.36;
}

/** Aimante un symbole mural au mur le plus proche. */
export function snapSymbol(
  def: ElectricalSymbolDefinition,
  scale: number,
  point: { x: number; y: number },
  walls: Wall[],
  snapDistance: number,
): WallSnapResult | null {
  if (!def.snapToWall) return null;
  return snapToWalls(point, walls, snapDistance, symbolWallDepth(def, scale));
}
