import type { ElectricalCircuit, ElectricalPanel, PanelRow, PanelTemplate } from '../types';
import { computeRowWidthMm } from '../data/electricalPanelTemplates';
import { guessCircuitIcon } from '../data/labelIcons';
import { createId } from './id';

/**
 * Opérations de l'éditeur d'étiquettes (fonctions pures : elles retournent
 * les objets à enregistrer, sans accès à la base).
 * Une « case » d'étiquette correspond à un circuit du tableau.
 */

/** Circuits d'une ligne, dans l'ordre d'affichage. */
export function rowCases(circuits: ElectricalCircuit[], rowId: string): ElectricalCircuit[] {
  return circuits.filter((c) => c.rowId === rowId).sort((a, b) => a.order - b.order);
}

export function nextNumber(circuits: ElectricalCircuit[]): string {
  return String(circuits.reduce((m, c) => Math.max(m, Number.parseInt(c.number, 10) || 0), 0) + 1);
}

/** Nouvelle case en fin de ligne : « Circuit N », 1 module. */
export function createCase(panel: ElectricalPanel, rowId: string, circuits: ElectricalCircuit[], name?: string): ElectricalCircuit {
  const number = nextNumber(circuits);
  const text = name ?? `Circuit ${number}`;
  return {
    id: createId('cir'),
    panelId: panel.id,
    rowId,
    order: circuits.reduce((m, c) => Math.max(m, c.order), -1) + 1,
    number,
    name: text,
    kind: 'circuit',
    modules: 1,
    protection: 'C16',
    cableSection: '2,5 mm²',
    icon: guessCircuitIcon(text),
  };
}

/**
 * Déplace une case d'un cran à gauche (-1) ou à droite (+1) dans sa ligne.
 * Retourne les circuits modifiés (ordres échangés), vide si impossible.
 */
export function moveCase(circuits: ElectricalCircuit[], id: string, dir: -1 | 1): ElectricalCircuit[] {
  const c = circuits.find((x) => x.id === id);
  if (!c) return [];
  const row = rowCases(circuits, c.rowId);
  const i = row.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= row.length) return [];
  // Ordres réattribués 0..n pour éviter les égalités
  const reordered = row.slice();
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  return reordered.map((x, k) => ({ ...x, order: k })).filter((x) => row.find((r) => r.id === x.id)?.order !== x.order);
}

/** Place une case à une position donnée (glisser-déposer), éventuellement dans une autre ligne. */
export function placeCase(circuits: ElectricalCircuit[], id: string, rowId: string, index: number): ElectricalCircuit[] {
  const c = circuits.find((x) => x.id === id);
  if (!c) return [];
  const target = rowCases(circuits, rowId).filter((x) => x.id !== id);
  const at = Math.max(0, Math.min(index, target.length));
  target.splice(at, 0, { ...c, rowId });
  const changed = target
    .map((x, k) => ({ ...x, order: k }))
    .filter((x) => {
      const before = circuits.find((b) => b.id === x.id);
      return !before || before.order !== x.order || before.rowId !== x.rowId;
    });
  // Renumérotation de l'ancienne ligne si la case en sort
  if (c.rowId !== rowId) {
    rowCases(circuits, c.rowId)
      .filter((x) => x.id !== id)
      .forEach((x, k) => {
        if (x.order !== k) changed.push({ ...x, order: k });
      });
  }
  return changed;
}

/**
 * Duplique une ligne : nouvelle ligne insérée juste après, avec une copie de chaque case
 * (nouveaux numéros à la suite des existants).
 */
export function duplicateRow(
  panel: ElectricalPanel,
  circuits: ElectricalCircuit[],
  rowId: string,
): { rows: PanelRow[]; row: PanelRow; copies: ElectricalCircuit[] } | null {
  const idx = panel.rows.findIndex((r) => r.id === rowId);
  if (idx < 0) return null;
  const source = panel.rows[idx];
  const row: PanelRow = { id: createId('row'), name: `${source.name} (copie)` };
  const rows = [...panel.rows.slice(0, idx + 1), row, ...panel.rows.slice(idx + 1)];
  let n = Number.parseInt(nextNumber(circuits), 10);
  const copies = rowCases(circuits, rowId).map((c, k) => ({
    ...c,
    id: createId('cir'),
    rowId: row.id,
    order: k,
    number: c.number ? String(n++) : '',
  }));
  return { rows, row, copies };
}

/** Nouvelle ligne vide (« Rangée N »). */
export function newPanelRow(rows: PanelRow[]): PanelRow {
  let n = rows.length + 1;
  while (rows.some((r) => r.name === `Rangée ${n}`)) n++;
  return { id: createId('row'), name: `Rangée ${n}` };
}

export type TemplateDims = Partial<
  Pick<PanelTemplate, 'modulesPerRow' | 'modulePitchMm' | 'labelHeightMm' | 'fontSizePt' | 'textAlign' | 'showIcon' | 'showNumber' | 'maxLines'>
>;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Applique des réglages au modèle en gardant des valeurs valides (largeur totale recalculée). */
export function applyTemplateChanges(tpl: PanelTemplate, changes: TemplateDims): PanelTemplate {
  const next = { ...tpl, ...changes };
  next.modulesPerRow = Math.round(clamp(next.modulesPerRow, 1, 40));
  next.modulePitchMm = round1(clamp(next.modulePitchMm, 6, 59));
  next.labelHeightMm = round1(clamp(next.labelHeightMm, 4, 79));
  next.fontSizePt = Math.round(clamp(next.fontSizePt, 4, 30) * 2) / 2;
  next.rowWidthMm = computeRowWidthMm(next.modulesPerRow, next.modulePitchMm);
  return next;
}

/** Modules occupés par une ligne. */
export function usedModules(circuits: ElectricalCircuit[], rowId: string): number {
  return rowCases(circuits, rowId).reduce((s, c) => s + c.modules, 0);
}
