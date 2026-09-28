import type { DeviceKind, PlacedDevice, TotalsRule } from '../types';
import { getProduct } from '../data/catalog';
import { canPlace, devicesInRow, withLinkedComponents, type Capacity, type PlaceCheck } from './placement';

/**
 * Opérations « métier » sur un tableau : insertion avec décalage, remplacement,
 * compactage, numérotation, occupation et totaux de rangée.
 * Fonctions pures : elles renvoient un nouveau tableau d'appareils.
 */

const EPS = 1e-6;

const end = (d: PlacedDevice) => d.startModule + d.moduleWidth;

/**
 * Insère un appareil de largeur `width` au module `start` en poussant vers la
 * droite les appareils suivants de la rangée. Si un appareil chevauche le point
 * d'insertion, l'insertion se fait juste avant lui.
 * Renvoie null si la rangée n'a pas assez de place.
 */
export function insertWithShift(
  devices: PlacedDevice[],
  cap: Capacity,
  row: number,
  start: number,
  width: number,
  ignoreId?: string,
): { devices: PlacedDevice[]; start: number } | null {
  if (row < 0 || row >= cap.rows || start < -EPS) return null;
  const inRow = devicesInRow(devices, row, ignoreId);
  const straddling = inRow.find((d) => d.startModule < start - EPS && end(d) > start + EPS);
  const at = straddling ? straddling.startModule : start;
  const moved = new Map<string, number>();
  let cursor = at + width;
  for (const d of inRow) {
    if (end(d) <= at + EPS) continue;
    if (d.startModule < cursor - EPS) {
      moved.set(d.id, cursor);
      cursor += d.moduleWidth;
    } else break;
  }
  const last = inRow.filter((d) => end(d) > at + EPS).reduce((m, d) => Math.max(m, moved.has(d.id) ? moved.get(d.id)! + d.moduleWidth : end(d)), at + width);
  if (last > cap.modulesPerRow + EPS) return null;
  const out = devices.map((d) => (moved.has(d.id) ? { ...d, startModule: moved.get(d.id)!, mergedWithPrev: false } : d));
  return { devices: out, start: at };
}

/** Retire les appareils qui occupent [start, start+width) sur la rangée (pour « Remplacer l'emplacement »). */
export function clearSpan(devices: PlacedDevice[], row: number, start: number, width: number, ignoreId?: string): { devices: PlacedDevice[]; removed: PlacedDevice[] } {
  const removed = devicesInRow(devices, row, ignoreId).filter((d) => d.startModule < start + width - EPS && end(d) > start + EPS);
  const ids = new Set(removed.map((d) => d.id));
  return { devices: devices.filter((d) => !ids.has(d.id)), removed };
}

/** Choix proposés quand l'emplacement visé est occupé. */
export function conflictOptions(
  devices: PlacedDevice[],
  cap: Capacity,
  row: number,
  start: number,
  width: number,
  ignoreId?: string,
): { check: PlaceCheck; canShift: boolean; canReplace: boolean } {
  const check = canPlace(devices, cap, row, start, width, ignoreId);
  if (check.ok || check.reason === 'bad-row') return { check, canShift: false, canReplace: false };
  const canShift = insertWithShift(devices, cap, row, start, width, ignoreId) !== null;
  const cleared = clearSpan(devices, row, start, width, ignoreId).devices;
  const canReplace = start + width <= cap.modulesPerRow + EPS && canPlace(cleared, cap, row, start, width, ignoreId).ok;
  return { check, canShift, canReplace };
}

/** Compacte une rangée : les appareils sont serrés à gauche, dans le même ordre. */
export function compactRow(devices: PlacedDevice[], row: number): PlacedDevice[] {
  let x = 0;
  const pos = new Map<string, number>();
  for (const d of devicesInRow(devices, row)) {
    pos.set(d.id, x);
    x += d.moduleWidth;
  }
  return withLinkedComponents(devices.map((d) => (pos.has(d.id) && pos.get(d.id) !== d.startModule ? { ...d, startModule: pos.get(d.id)! } : d)));
}

/** Appareils qui reçoivent un repère lors de la numérotation automatique. */
export const NUMBERED_KINDS: DeviceKind[] = ['breaker'];

export function isNumbered(d: PlacedDevice): boolean {
  const k = getProduct(d.productId)?.kind;
  return k ? NUMBERED_KINDS.includes(k) : false;
}

/** Numérotation automatique 1, 2, 3… (rangée par rangée, de gauche à droite). */
export function numberCircuits(devices: PlacedDevice[], first = 1): PlacedDevice[] {
  const ordered = [...devices].filter(isNumbered).sort((a, b) => a.row - b.row || a.startModule - b.startModule);
  const refs = new Map(ordered.map((d, i) => [d.id, String(first + i)]));
  return devices.map((d) => (refs.has(d.id) ? { ...d, circuitRef: refs.get(d.id)! } : d));
}

/* ------------------------------------------------------------------ */
/* Occupation                                                          */
/* ------------------------------------------------------------------ */

export interface Occupancy {
  totalModules: number;
  /** Modules occupés par des appareils (réserves exclues). */
  usedModules: number;
  /** Modules marqués « RÉSERVE ». */
  reservedModules: number;
  /** Modules libres (réserves comprises). */
  freeModules: number;
  freePercent: number;
}

export function isReserve(d: PlacedDevice): boolean {
  return getProduct(d.productId)?.kind === 'reserve';
}

export function occupancy(devices: PlacedDevice[], cap: Capacity, row?: number): Occupancy {
  const list = row === undefined ? devices : devices.filter((d) => d.row === row);
  const totalModules = (row === undefined ? cap.rows : 1) * cap.modulesPerRow;
  let used = 0;
  let reserved = 0;
  for (const d of list) {
    if (isReserve(d)) reserved += d.moduleWidth;
    else used += d.moduleWidth;
  }
  const freeModules = Math.max(0, totalModules - used);
  return {
    totalModules,
    usedModules: used,
    reservedModules: reserved,
    freeModules,
    freePercent: totalModules ? (freeModules / totalModules) * 100 : 0,
  };
}

/** « 20,5 % » */
export function formatPercent(v: number): string {
  return `${(Math.round(v * 10) / 10).toString().replace('.', ',')} %`;
}

/* ------------------------------------------------------------------ */
/* Totaux de rangée (règle choisie par l'utilisateur)                  */
/* ------------------------------------------------------------------ */

export interface RowTotal {
  /** Valeur selon la règle (null si aucune règle n'est configurée). */
  value: number | null;
  /** Somme brute des calibres des disjoncteurs. */
  breakerSum: number;
  breakerCount: number;
  /** Calibre du (des) différentiel(s) de la rangée. */
  rcdRatings: number[];
}

export function rowTotal(devices: PlacedDevice[], row: number, rule: TotalsRule): RowTotal {
  let breakerSum = 0;
  let breakerCount = 0;
  const rcdRatings: number[] = [];
  for (const d of devices) {
    if (d.row !== row) continue;
    const p = getProduct(d.productId);
    if (!p) continue;
    if (p.kind === 'breaker' && p.rating) {
      breakerSum += p.rating;
      breakerCount += 1;
    } else if (p.kind === 'rcd' && p.rating) rcdRatings.push(p.rating);
  }
  let value: number | null = null;
  if (rule.kind === 'sum') value = breakerSum;
  else if (rule.kind === 'sum-coef') value = Math.round(breakerSum * rule.coef * 10) / 10;
  return { value, breakerSum, breakerCount, rcdRatings };
}

export function totalsRuleLabel(rule: TotalsRule): string {
  if (rule.kind === 'sum') return 'Somme des calibres des disjoncteurs';
  if (rule.kind === 'sum-coef') return `Somme des calibres × ${String(rule.coef).replace('.', ',')}`;
  return 'Aucun calcul (règle non définie)';
}
