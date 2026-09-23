import type { ElectricalCircuit, ElectricalPanel, Label, PanelRow } from '../types';
import { DEFAULT_TEMPLATE_ID } from '../data/electricalPanelTemplates';
import { createId } from '../utils/id';
import { db } from './db';

export function newRow(index: number): PanelRow {
  return { id: createId('row'), name: `Rangée ${index + 1}` };
}

export async function createPanelForProject(projectId: string | null, name: string, templateId?: string): Promise<ElectricalPanel> {
  const now = Date.now();
  const settings = await db.settings.get('app');
  const panel: ElectricalPanel = {
    id: createId('pnl'),
    projectId,
    name,
    templateId: templateId ?? settings?.defaultTemplateId ?? DEFAULT_TEMPLATE_ID,
    rows: [newRow(0), newRow(1)],
    createdAt: now,
    updatedAt: now,
  };
  await db.panels.add(panel);
  return panel;
}

/** Tableau du projet (créé s'il n'existe pas encore). */
export async function getOrCreateProjectPanel(projectId: string): Promise<ElectricalPanel> {
  const existing = await db.panels.where('projectId').equals(projectId).first();
  if (existing) return existing;
  const project = await db.projects.get(projectId);
  return createPanelForProject(projectId, project?.name ?? 'Tableau');
}

export function getPanel(id: string): Promise<ElectricalPanel | undefined> {
  return db.panels.get(id);
}

export async function listPanels(): Promise<ElectricalPanel[]> {
  const panels = await db.panels.toArray();
  return panels.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function savePanel(panel: ElectricalPanel): Promise<void> {
  await db.panels.put({ ...panel, updatedAt: Date.now() });
}

export async function deletePanel(panelId: string): Promise<void> {
  await db.transaction('rw', [db.panels, db.circuits, db.labels], async () => {
    await db.circuits.where('panelId').equals(panelId).delete();
    await db.labels.where('panelId').equals(panelId).delete();
    await db.panels.delete(panelId);
  });
}

export async function listCircuits(panelId: string): Promise<ElectricalCircuit[]> {
  const circuits = await db.circuits.where('panelId').equals(panelId).toArray();
  return circuits.sort((a, b) => a.order - b.order);
}

export async function saveCircuit(circuit: ElectricalCircuit): Promise<void> {
  await db.circuits.put(circuit);
  await db.panels.update(circuit.panelId, { updatedAt: Date.now() });
}

export async function saveCircuits(circuits: ElectricalCircuit[]): Promise<void> {
  if (!circuits.length) return;
  await db.circuits.bulkPut(circuits);
  await db.panels.update(circuits[0].panelId, { updatedAt: Date.now() });
}

export async function deleteCircuit(circuit: ElectricalCircuit): Promise<void> {
  await db.transaction('rw', [db.circuits, db.labels], async () => {
    await db.circuits.delete(circuit.id);
    await db.labels.where('circuitId').equals(circuit.id).delete();
  });
}

export function listLabels(panelId: string): Promise<Label[]> {
  return db.labels.where('panelId').equals(panelId).toArray();
}

export async function saveLabel(label: Label): Promise<void> {
  await db.labels.put(label);
}

export async function deleteLabel(id: string): Promise<void> {
  await db.labels.delete(id);
}
