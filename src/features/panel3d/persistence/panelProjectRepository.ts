import type { PanelProject } from '../types';
import { db } from '../../../database/db';
import { createId } from '../../../utils/id';
import { createPanelProject, normalizeProject } from '../store/projectFactory';

export async function listPanelProjects(): Promise<PanelProject[]> {
  const all = await db.panelProjects.orderBy('updatedAt').reverse().toArray();
  return all.map((p) => normalizeProject(p as unknown as Record<string, unknown>));
}

/** Projet lu en base, migré au format courant (plusieurs tableaux, repères…). */
export async function getPanelProject(id: string): Promise<PanelProject | undefined> {
  const raw = await db.panelProjects.get(id);
  return raw ? normalizeProject(raw as unknown as Record<string, unknown>) : undefined;
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
  if (existing) return normalizeProject(existing as unknown as Record<string, unknown>);
  return createAndSavePanelProject(name, projectId);
}

/* ------------------------------------------------------------------ */
/* Sauvegarde / restauration d'un projet (fichier)                     */
/* ------------------------------------------------------------------ */

export const PANEL_FILE_EXTENSION = '.mgtableau';
const FORMAT = 'mg-elec-plans/tableau';

export function panelProjectFile(p: PanelProject): { blob: Blob; filename: string } {
  const safe = p.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'tableau';
  const blob = new Blob([JSON.stringify({ format: FORMAT, version: 2, exportedAt: new Date().toISOString(), project: p }, null, 2)], { type: 'application/json' });
  return { blob, filename: `${safe}${PANEL_FILE_EXTENSION}` };
}

/** Importe un projet sauvegardé (nouvel identifiant : n'écrase jamais un projet existant). */
export async function importPanelProjectFile(text: string): Promise<PanelProject> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fichier illisible');
  }
  const d = data as { format?: string; project?: Record<string, unknown> };
  if (d.format !== FORMAT || !d.project) throw new Error('Ce fichier n’est pas un projet de tableau MG Elec & Plans');
  const now = Date.now();
  const p = normalizeProject({ ...d.project, id: createId('p3d'), createdAt: now, updatedAt: now, projectId: null });
  await savePanelProject(p);
  return p;
}
