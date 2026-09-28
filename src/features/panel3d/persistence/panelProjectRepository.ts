import type { PanelProject } from '../types';
import { db } from '../../../database/db';
import { createId } from '../../../utils/id';
import { createPanelProject } from '../store/projectFactory';

export function listPanelProjects(): Promise<PanelProject[]> {
  return db.panelProjects.orderBy('updatedAt').reverse().toArray();
}

export function getPanelProject(id: string): Promise<PanelProject | undefined> {
  return db.panelProjects.get(id);
}

export async function savePanelProject(p: PanelProject): Promise<void> {
  await db.panelProjects.put(p);
}

export async function createAndSavePanelProject(name: string, projectId: string | null = null): Promise<PanelProject> {
  const p = createPanelProject(name, 'legrand', projectId);
  await savePanelProject(p);
  return p;
}

export async function duplicatePanelProject(id: string): Promise<PanelProject | null> {
  const src = await getPanelProject(id);
  if (!src) return null;
  const now = Date.now();
  const copy: PanelProject = { ...structuredClone(src), id: createId('p3d'), name: `${src.name} (copie)`, createdAt: now, updatedAt: now };
  await savePanelProject(copy);
  return copy;
}

export async function deletePanelProject(id: string): Promise<void> {
  await db.panelProjects.delete(id);
}

/** Tableau 3D associé à un chantier (créé s'il n'existe pas). */
export async function getOrCreateProjectPanel3d(projectId: string, name: string): Promise<PanelProject> {
  const existing = await db.panelProjects.where('projectId').equals(projectId).first();
  if (existing) return existing;
  return createAndSavePanelProject(name, projectId);
}
