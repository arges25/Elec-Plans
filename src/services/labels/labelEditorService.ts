import type { ElectricalCircuit, ElectricalPanel, Label, PanelTemplate } from '../../types';
import { db } from '../../database/db';
import { deleteCircuit, saveCircuit, saveCircuits, saveLabel, savePanel } from '../../database/panelRepository';
import { deleteTemplate, saveTemplate } from '../../database/templateRepository';
import { applyTemplateChanges, createCase, duplicateRow, moveCase, newPanelRow, placeCase, type TemplateDims } from '../../utils/labelEditor';

/**
 * Éditeur d'étiquettes : enregistrement immédiat (la base alimente l'aperçu en direct).
 * Le texte d'une case est le nom du circuit : le tableau et les étiquettes restent identiques.
 */

/** Texte d'une case : met à jour le nom du circuit et retire une éventuelle personnalisation de texte. */
export async function setCaseText(circuit: ElectricalCircuit, label: Label | undefined, text: string): Promise<void> {
  await saveCircuit({ ...circuit, name: text });
  if (label && label.text !== undefined) {
    if (label.icon === undefined) await db.labels.delete(label.id);
    else await saveLabel({ ...label, text: undefined });
  }
}

/** Pictogramme d'une case (null = aucun). */
export async function setCaseIcon(circuit: ElectricalCircuit, label: Label | undefined, icon: string | null): Promise<void> {
  await saveCircuit({ ...circuit, icon: icon ?? undefined });
  if (label && label.icon !== undefined) {
    if (label.text === undefined) await db.labels.delete(label.id);
    else await saveLabel({ ...label, icon: undefined });
  }
}

export async function setCaseNumber(circuit: ElectricalCircuit, number: string): Promise<void> {
  await saveCircuit({ ...circuit, number: number.trim() });
}

export async function setCaseModules(circuit: ElectricalCircuit, modules: number): Promise<void> {
  await saveCircuit({ ...circuit, modules: Math.max(1, Math.min(8, Math.round(modules))) });
}

export async function addCase(panel: ElectricalPanel, rowId: string, circuits: ElectricalCircuit[]): Promise<ElectricalCircuit> {
  const c = createCase(panel, rowId, circuits);
  await saveCircuit(c);
  return c;
}

/** Supprime une case ; retourne de quoi l'annuler. */
export async function removeCase(circuit: ElectricalCircuit): Promise<{ circuit: ElectricalCircuit; labels: Label[] }> {
  const labels = await db.labels.where('circuitId').equals(circuit.id).toArray();
  await deleteCircuit(circuit);
  return { circuit, labels };
}

export async function restoreCase(saved: { circuit: ElectricalCircuit; labels: Label[] }): Promise<void> {
  await saveCircuit(saved.circuit);
  for (const l of saved.labels) await saveLabel(l);
}

export async function shiftCase(circuits: ElectricalCircuit[], id: string, dir: -1 | 1): Promise<boolean> {
  const changed = moveCase(circuits, id, dir);
  await saveCircuits(changed);
  return changed.length > 0;
}

export async function moveCaseTo(circuits: ElectricalCircuit[], id: string, rowId: string, index: number): Promise<void> {
  await saveCircuits(placeCase(circuits, id, rowId, index));
}

export async function addLine(panel: ElectricalPanel): Promise<void> {
  await addLines(panel, 1);
}

export async function addLines(panel: ElectricalPanel, count: number): Promise<void> {
  const rows = [...panel.rows];
  for (let i = 0; i < count; i++) rows.push(newPanelRow(rows));
  await savePanel({ ...panel, rows });
}

export async function duplicateLine(panel: ElectricalPanel, circuits: ElectricalCircuit[], rowId: string): Promise<string | null> {
  const r = duplicateRow(panel, circuits, rowId);
  if (!r) return null;
  await db.transaction('rw', [db.panels, db.circuits], async () => {
    await db.panels.put({ ...panel, rows: r.rows, updatedAt: Date.now() });
    if (r.copies.length) await db.circuits.bulkAdd(r.copies);
  });
  return r.row.id;
}

export async function removeLine(panel: ElectricalPanel, circuits: ElectricalCircuit[], rowId: string): Promise<void> {
  for (const c of circuits.filter((x) => x.rowId === rowId)) await deleteCircuit(c);
  await savePanel({ ...panel, rows: panel.rows.filter((r) => r.id !== rowId) });
}

export async function renameLine(panel: ElectricalPanel, rowId: string, name: string): Promise<void> {
  await savePanel({ ...panel, rows: panel.rows.map((r) => (r.id === rowId ? { ...r, name } : r)) });
}

export async function updateTemplateSettings(template: PanelTemplate, changes: TemplateDims): Promise<void> {
  await saveTemplate(applyTemplateChanges(template, changes));
}

/** Remet un modèle intégré à ses valeurs d'origine. */
export async function resetBuiltinTemplate(template: PanelTemplate): Promise<void> {
  await deleteTemplate(template.id);
}
