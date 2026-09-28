import type { LabelStyle, PlacedDevice } from '../types';
import { PLACEMENT_STEP } from '../constants';

/**
 * Moteur de placement sur rails DIN : grille au demi-module, aucun chevauchement,
 * jamais au-delà de la capacité d'une rangée. Fonctions pures (testables).
 */

const EPS = 1e-6;

export interface Capacity {
  rows: number;
  modulesPerRow: number;
}

export type PlaceReason = 'ok' | 'overlap' | 'overflow' | 'row-full' | 'bad-row';

export interface PlaceCheck {
  ok: boolean;
  reason: PlaceReason;
}

export function snapToStep(v: number): number {
  return Math.round(v / PLACEMENT_STEP) * PLACEMENT_STEP;
}

export function devicesInRow(devices: PlacedDevice[], row: number, ignoreId?: string): PlacedDevice[] {
  return devices.filter((d) => d.row === row && d.id !== ignoreId).sort((a, b) => a.startModule - b.startModule);
}

export function usedModules(devices: PlacedDevice[], row: number, ignoreId?: string): number {
  return devicesInRow(devices, row, ignoreId).reduce((s, d) => s + d.moduleWidth, 0);
}

export function freeModules(devices: PlacedDevice[], row: number, cap: Capacity, ignoreId?: string): number {
  return Math.max(0, cap.modulesPerRow - usedModules(devices, row, ignoreId));
}

/** Vérifie qu'un appareil de largeur `width` peut occuper [start, start + width[ sur la rangée. */
export function canPlace(devices: PlacedDevice[], cap: Capacity, row: number, start: number, width: number, ignoreId?: string): PlaceCheck {
  if (row < 0 || row >= cap.rows) return { ok: false, reason: 'bad-row' };
  if (freeModules(devices, row, cap, ignoreId) + EPS < width) return { ok: false, reason: 'row-full' };
  if (start < -EPS || start + width > cap.modulesPerRow + EPS) return { ok: false, reason: 'overflow' };
  const end = start + width;
  for (const d of devicesInRow(devices, row, ignoreId)) {
    if (start < d.startModule + d.moduleWidth - EPS && end > d.startModule + EPS) return { ok: false, reason: 'overlap' };
  }
  return { ok: true, reason: 'ok' };
}

/** Intervalles libres d'une rangée : [début, fin[. */
export function freeIntervals(devices: PlacedDevice[], cap: Capacity, row: number, ignoreId?: string): [number, number][] {
  const out: [number, number][] = [];
  let x = 0;
  for (const d of devicesInRow(devices, row, ignoreId)) {
    if (d.startModule > x + EPS) out.push([x, d.startModule]);
    x = Math.max(x, d.startModule + d.moduleWidth);
  }
  if (cap.modulesPerRow > x + EPS) out.push([x, cap.modulesPerRow]);
  return out;
}

/**
 * Emplacement libre le plus proche de `preferred` sur une rangée (pas de 0,5).
 * Retourne null si aucun espace contigu suffisant.
 */
export function nearestFreeStart(devices: PlacedDevice[], cap: Capacity, row: number, width: number, preferred = 0, ignoreId?: string): number | null {
  let best: number | null = null;
  for (const [a, b] of freeIntervals(devices, cap, row, ignoreId)) {
    if (b - a + EPS < width) continue;
    // Bornes multiples de 0,5 : le point accroché reste dans l'intervalle
    const candidate = Math.min(Math.max(snapToStep(preferred), a), b - width);
    if (best === null || Math.abs(candidate - preferred) < Math.abs(best - preferred)) best = candidate;
  }
  return best;
}

/** Premier emplacement libre (rangée par rangée, de gauche à droite). */
export function firstFreeSlot(devices: PlacedDevice[], cap: Capacity, width: number, fromRow = 0): { row: number; start: number } | null {
  for (let i = 0; i < cap.rows; i++) {
    const row = (fromRow + i) % cap.rows;
    for (const [a, b] of freeIntervals(devices, cap, row)) if (b - a + EPS >= width) return { row, start: a };
  }
  return null;
}

/** Cible de dépôt : position demandée si possible, sinon raison du refus. */
export function dropTarget(
  devices: PlacedDevice[],
  cap: Capacity,
  row: number,
  wantedStart: number,
  width: number,
  ignoreId?: string,
): { row: number; start: number; check: PlaceCheck } {
  const start = Math.min(Math.max(0, snapToStep(wantedStart)), Math.max(0, cap.modulesPerRow - width));
  const check = canPlace(devices, cap, row, start, width, ignoreId);
  return { row, start, check };
}

/** Emplacement pour un duplicata : juste à droite de l'original, sinon premier espace libre. */
export function duplicateSlot(devices: PlacedDevice[], cap: Capacity, source: PlacedDevice): { row: number; start: number } | null {
  const right = source.startModule + source.moduleWidth;
  if (canPlace(devices, cap, source.row, right, source.moduleWidth).ok) return { row: source.row, start: right };
  const near = nearestFreeStart(devices, cap, source.row, source.moduleWidth, right);
  if (near !== null) return { row: source.row, start: near };
  return firstFreeSlot(devices, cap, source.moduleWidth, source.row);
}

/**
 * Organisation automatique : range les appareils dans l'ordre (rangée, position),
 * serrés à gauche, en passant à la rangée suivante quand une rangée est pleine.
 * Retourne null si tout ne tient pas.
 */
export function autoArrange(devices: PlacedDevice[], cap: Capacity): PlacedDevice[] | null {
  const ordered = [...devices].sort((a, b) => a.row - b.row || a.startModule - b.startModule);
  let row = 0;
  let x = 0;
  const out: PlacedDevice[] = [];
  for (const d of ordered) {
    if (x + d.moduleWidth > cap.modulesPerRow + EPS) {
      row += 1;
      x = 0;
    }
    if (row >= cap.rows) return null;
    out.push({ ...d, row, startModule: x });
    x += d.moduleWidth;
  }
  return withLinkedComponents(out);
}

/** Copie d'une rangée vers une rangée vide (ou la première rangée vide). */
export function duplicateRowPlacement(devices: PlacedDevice[], cap: Capacity, row: number, newId: () => string, targetRow?: number): PlacedDevice[] | null {
  const target =
    targetRow ??
    Array.from({ length: cap.rows }, (_, i) => i).find((r) => r !== row && devicesInRow(devices, r).length === 0);
  if (target === undefined || target === row || devicesInRow(devices, target).length) return null;
  const copies = devicesInRow(devices, row).map((d) => ({ ...d, id: newId(), row: target }));
  return withLinkedComponents([...devices, ...copies]);
}

/* ------------------------------------------------------------------ */
/* Zones d'étiquettes                                                  */
/* ------------------------------------------------------------------ */

export interface LabelZone {
  /** Appareil porteur de l'étiquette (le premier de la zone). */
  leaderId: string;
  ids: string[];
  row: number;
  start: number;
  width: number;
  label: string;
  icon: string | null;
  style: LabelStyle;
}

/**
 * Zones d'étiquette d'une rangée : une par appareil, ou une zone commune
 * pour des appareils contigus fusionnés. La zone a toujours la largeur
 * exacte des appareils : étiquette et appareil restent alignés.
 */
export function labelZones(devices: PlacedDevice[], row: number, defaultStyle: LabelStyle): LabelZone[] {
  const zones: LabelZone[] = [];
  for (const d of devicesInRow(devices, row)) {
    const prev = zones[zones.length - 1];
    const contiguous = prev && Math.abs(prev.start + prev.width - d.startModule) < EPS;
    if (prev && d.mergedWithPrev && contiguous) {
      prev.ids.push(d.id);
      prev.width += d.moduleWidth;
      continue;
    }
    zones.push({
      leaderId: d.id,
      ids: [d.id],
      row,
      start: d.startModule,
      width: d.moduleWidth,
      label: d.label,
      icon: d.icon,
      style: d.labelStyle ?? defaultStyle,
    });
  }
  return zones;
}

export function allLabelZones(devices: PlacedDevice[], rows: number, defaultStyle: LabelStyle): LabelZone[] {
  return Array.from({ length: rows }, (_, r) => labelZones(devices, r, defaultStyle)).flat();
}

/** Met à jour `linkedComponents` d'après les zones (et annule les fusions devenues impossibles). */
export function withLinkedComponents(devices: PlacedDevice[]): PlacedDevice[] {
  const rows = [...new Set(devices.map((d) => d.row))];
  const links = new Map<string, string[]>();
  const validMerge = new Set<string>();
  for (const r of rows) {
    for (const z of labelZones(devices, r, 'both')) {
      z.ids.forEach((id, i) => {
        links.set(id, z.ids.length > 1 ? z.ids.filter((x) => x !== id) : []);
        if (i > 0) validMerge.add(id);
      });
    }
  }
  return devices.map((d) => {
    const linked = links.get(d.id) ?? [];
    const merged = d.mergedWithPrev && validMerge.has(d.id);
    const same = merged === d.mergedWithPrev && linked.length === d.linkedComponents.length && linked.every((x, i) => x === d.linkedComponents[i]);
    return same ? d : { ...d, mergedWithPrev: merged, linkedComponents: linked };
  });
}

/** Zone contenant un appareil. */
export function zoneOf(devices: PlacedDevice[], deviceId: string, defaultStyle: LabelStyle): LabelZone | undefined {
  const d = devices.find((x) => x.id === deviceId);
  if (!d) return undefined;
  return labelZones(devices, d.row, defaultStyle).find((z) => z.ids.includes(deviceId));
}

/** Appareil suivant (contigu, même rangée) pouvant être fusionné avec la zone. */
export function nextMergeCandidate(devices: PlacedDevice[], zone: LabelZone): PlacedDevice | undefined {
  const end = zone.start + zone.width;
  return devicesInRow(devices, zone.row).find((d) => Math.abs(d.startModule - end) < EPS && !zone.ids.includes(d.id));
}
