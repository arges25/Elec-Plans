import type { ElectricalCircuit, ElectricalPanel, PlacedSymbol } from '../types';
import { db } from '../database/db';
import { getSymbolDefinition } from '../data/electricalSymbols';
import { guessCircuitIcon } from '../data/labelIcons';
import { createId } from '../utils/id';

function norm(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function nextCircuitNumber(circuits: ElectricalCircuit[]): string {
  return String(circuits.reduce((m, c) => Math.max(m, Number.parseInt(c.number, 10) || 0), 0) + 1);
}

export function newCircuit(panel: ElectricalPanel, rowId: string, circuits: ElectricalCircuit[], partial: Partial<ElectricalCircuit> = {}): ElectricalCircuit {
  const name = partial.name ?? 'Nouveau circuit';
  return {
    id: createId('cir'),
    panelId: panel.id,
    rowId,
    order: circuits.reduce((m, c) => Math.max(m, c.order), -1) + 1,
    number: partial.kind && partial.kind !== 'circuit' ? '' : nextCircuitNumber(circuits),
    name,
    kind: 'circuit',
    modules: 1,
    protection: 'C16',
    cableSection: '2,5 mm²',
    icon: guessCircuitIcon(name),
    ...partial,
  };
}

/**
 * Crée les circuits à partir des noms de circuit saisis sur les symboles du plan
 * et relie les symboles à ces circuits.
 */
export async function importCircuitsFromSymbols(panel: ElectricalPanel): Promise<{ created: number; linked: number }> {
  if (!panel.projectId) return { created: 0, linked: 0 };
  const symbols = await db.symbolsPlaced.where('projectId').equals(panel.projectId).toArray();
  const circuits = await db.circuits.where('panelId').equals(panel.id).toArray();
  const byName = new Map(circuits.map((c) => [norm(c.name), c]));
  const byId = new Set(circuits.map((c) => c.id));
  const all = [...circuits];
  const created: ElectricalCircuit[] = [];
  const updated: PlacedSymbol[] = [];
  const lastRow = panel.rows[panel.rows.length - 1]?.id ?? panel.rows[0]?.id;
  if (!lastRow) return { created: 0, linked: 0 };
  for (const s of symbols) {
    if (s.properties.circuitId && byId.has(s.properties.circuitId)) continue;
    const name = s.properties.circuitName?.trim();
    if (!name) continue;
    let c = byName.get(norm(name));
    if (!c) {
      const role = getSymbolDefinition(s.symbolType).role;
      c = newCircuit(panel, lastRow, all, {
        name,
        number: s.properties.circuitNumber || nextCircuitNumber(all),
        protection: s.properties.breaker || (role === 'light' ? 'C10' : 'C16'),
        cableSection: s.properties.cableSection || (role === 'light' ? '1,5 mm²' : '2,5 mm²'),
      });
      all.push(c);
      created.push(c);
      byName.set(norm(name), c);
    }
    updated.push({ ...s, properties: { ...s.properties, circuitId: c.id, circuitNumber: c.number } });
  }
  await db.transaction('rw', [db.circuits, db.symbolsPlaced, db.panels], async () => {
    if (created.length) await db.circuits.bulkAdd(created);
    if (updated.length) await db.symbolsPlaced.bulkPut(updated);
    await db.panels.update(panel.id, { updatedAt: Date.now() });
  });
  return { created: created.length, linked: updated.length };
}

/** Renumérote les circuits (1, 2, 3…) dans l'ordre des rangées ; met à jour les symboles liés. */
export async function renumberCircuits(panel: ElectricalPanel): Promise<void> {
  const circuits = await db.circuits.where('panelId').equals(panel.id).toArray();
  const rowIndex = new Map(panel.rows.map((r, i) => [r.id, i]));
  circuits.sort((a, b) => (rowIndex.get(a.rowId) ?? 99) - (rowIndex.get(b.rowId) ?? 99) || a.order - b.order);
  let n = 1;
  const updated = circuits.map((c) => (c.kind === 'circuit' ? { ...c, number: String(n++) } : c));
  const numberById = new Map(updated.map((c) => [c.id, c.number]));
  await db.transaction('rw', [db.circuits, db.symbolsPlaced], async () => {
    await db.circuits.bulkPut(updated);
    if (panel.projectId) {
      const symbols = await db.symbolsPlaced.where('projectId').equals(panel.projectId).toArray();
      const changed = symbols
        .filter((s) => s.properties.circuitId && numberById.has(s.properties.circuitId))
        .map((s) => ({ ...s, properties: { ...s.properties, circuitNumber: numberById.get(s.properties.circuitId!) } }));
      if (changed.length) await db.symbolsPlaced.bulkPut(changed);
    }
  });
}

export const CIRCUIT_KIND_LABELS: Record<ElectricalCircuit['kind'], string> = {
  circuit: 'Circuit',
  differential: 'Interrupteur différentiel',
  main: 'Disjoncteur général / de branchement',
  spare: 'Réserve',
  other: 'Autre appareillage',
};
