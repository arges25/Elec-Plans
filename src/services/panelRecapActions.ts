import type { ElectricalCircuit, PanelRow, PlacedSymbol } from '../types';
import { db } from '../database/db';
import { getOrCreateProjectPanel, newRow } from '../database/panelRepository';
import { getTemplate } from '../database/templateRepository';
import { useSaveStatus } from '../store/saveStatusStore';
import type { DistributionPlan } from './panelRecap';

/** État avant répartition : permet d'annuler (bouton « Annuler » de la notification). */
export interface DistributionUndo {
  panelId: string;
  previousRows: PanelRow[];
  createdCircuitIds: string[];
  previousSymbols: PlacedSymbol[];
}

const MAX_ROWS = 8;

/**
 * Enregistre la répartition automatique : crée les circuits dans le tableau du projet
 * (dernière rangée, nouvelle rangée si elle est pleine) et met à jour les symboles des plans.
 */
export async function applyDistribution(projectId: string, plan: DistributionPlan): Promise<DistributionUndo> {
  const status = useSaveStatus.getState();
  status.setStatus('saving');
  try {
    const panel = await getOrCreateProjectPanel(projectId);
    const template = await getTemplate(panel.templateId);
    const capacity = template.modulesPerRow;
    const existing = await db.circuits.where('panelId').equals(panel.id).toArray();
    const rows = [...panel.rows];
    const used = new Map(rows.map((r) => [r.id, existing.filter((c) => c.rowId === r.id).reduce((s, c) => s + c.modules, 0)]));
    let order = existing.reduce((m, c) => Math.max(m, c.order), -1) + 1;

    const created: ElectricalCircuit[] = plan.newCircuits.map((d) => {
      let row = rows[rows.length - 1];
      if ((used.get(row.id) ?? 0) + 1 > capacity && rows.length < MAX_ROWS) {
        row = newRow(rows.length);
        rows.push(row);
        used.set(row.id, 0);
      }
      used.set(row.id, (used.get(row.id) ?? 0) + 1);
      return { ...d, panelId: panel.id, rowId: row.id, order: order++, kind: 'circuit', modules: 1 };
    });

    const byId = new Map([...existing, ...created].map((c) => [c.id, c]));
    const symbols = await db.symbolsPlaced.bulkGet(plan.assignments.map((a) => a.symbolId));
    const previousSymbols: PlacedSymbol[] = [];
    const updated: PlacedSymbol[] = [];
    plan.assignments.forEach((a, i) => {
      const s = symbols[i];
      const c = byId.get(a.circuitId);
      if (!s || !c) return;
      previousSymbols.push(s);
      // Mêmes informations que lors du choix du circuit dans « Propriétés »
      updated.push({
        ...s,
        properties: { ...s.properties, circuitId: c.id, circuitName: c.name, circuitNumber: c.number, breaker: c.protection, cableSection: c.cableSection },
      });
    });

    await db.transaction('rw', [db.circuits, db.symbolsPlaced, db.panels, db.projects], async () => {
      if (created.length) await db.circuits.bulkAdd(created);
      if (updated.length) await db.symbolsPlaced.bulkPut(updated);
      await db.panels.put({ ...panel, rows, updatedAt: Date.now() });
      await db.projects.update(projectId, { updatedAt: Date.now() });
    });
    status.setStatus('saved');
    return { panelId: panel.id, previousRows: panel.rows, createdCircuitIds: created.map((c) => c.id), previousSymbols };
  } catch (e) {
    status.setStatus('error');
    throw e;
  }
}

/** Annule une répartition : symboles et rangées remis à l'identique, circuits créés supprimés. */
export async function undoDistribution(undo: DistributionUndo): Promise<void> {
  const status = useSaveStatus.getState();
  status.setStatus('saving');
  await db.transaction('rw', [db.circuits, db.symbolsPlaced, db.panels, db.labels], async () => {
    if (undo.previousSymbols.length) await db.symbolsPlaced.bulkPut(undo.previousSymbols);
    if (undo.createdCircuitIds.length) {
      await db.circuits.bulkDelete(undo.createdCircuitIds);
      await db.labels.where('circuitId').anyOf(undo.createdCircuitIds).delete();
    }
    await db.panels.update(undo.panelId, { rows: undo.previousRows, updatedAt: Date.now() });
  });
  status.setStatus('saved');
}
