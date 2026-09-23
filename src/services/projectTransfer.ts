import type { ProjectBundle } from '../types';
import { db } from '../database/db';
import { refreshProjectStats } from '../database/projectRepository';
import { createId } from '../utils/id';
import { downloadBlob, readFileAsText } from '../utils/download';
import { safeFileName } from '../utils/format';

/**
 * Export / import des projets au format « .mgeplan » (JSON).
 * Le fichier contient : projet, plans (images comprises), symboles, liaisons,
 * tableau, circuits, étiquettes et quelques réglages.
 */

export const MGEPLAN_EXTENSION = '.mgeplan';

export async function buildProjectBundle(projectId: string): Promise<ProjectBundle> {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Projet introuvable');
  const [plans, symbols, connections, panels, settings] = await Promise.all([
    db.plans.where('projectId').equals(projectId).toArray(),
    db.symbolsPlaced.where('projectId').equals(projectId).toArray(),
    db.connections.where('projectId').equals(projectId).toArray(),
    db.panels.where('projectId').equals(projectId).toArray(),
    db.settings.get('app'),
  ]);
  const panelIds = panels.map((p) => p.id);
  const circuits = panelIds.length ? await db.circuits.where('panelId').anyOf(panelIds).toArray() : [];
  const labels = panelIds.length ? await db.labels.where('panelId').anyOf(panelIds).toArray() : [];
  return {
    format: 'mgeplan',
    version: 1,
    app: 'MG Elec & Plans',
    exportedAt: new Date().toISOString(),
    project,
    plans,
    symbols,
    connections,
    panels,
    circuits,
    labels,
    settings: settings
      ? { favorites: settings.favorites, commandColor: settings.commandColor, circuitColor: settings.circuitColor, informationColor: settings.informationColor }
      : undefined,
  };
}

/**
 * Attribue de nouveaux identifiants à toutes les entités du lot en conservant
 * toutes les relations (plans ↔ symboles ↔ liaisons ↔ circuits ↔ étiquettes).
 */
export function remapBundleIds(bundle: ProjectBundle, newName?: string): ProjectBundle {
  const ids = new Map<string, string>();
  const map = (old: string, prefix: string) => {
    let v = ids.get(old);
    if (!v) {
      v = createId(prefix);
      ids.set(old, v);
    }
    return v;
  };
  const opt = (old: string | undefined | null) => (old ? (ids.get(old) ?? old) : old);

  const projectId = map(bundle.project.id, 'prj');
  bundle.plans.forEach((p) => map(p.id, 'plan'));
  bundle.symbols.forEach((s) => map(s.id, 'sym'));
  bundle.panels.forEach((p) => {
    map(p.id, 'pnl');
    p.rows.forEach((r) => map(r.id, 'row'));
  });
  bundle.circuits.forEach((c) => map(c.id, 'cir'));

  const now = Date.now();
  return {
    ...bundle,
    project: {
      ...bundle.project,
      id: projectId,
      name: newName ?? bundle.project.name,
      floors: bundle.project.floors.map((f) => ({ ...f, planId: map(f.planId, 'plan') })),
      createdAt: now,
      updatedAt: now,
      isDemo: false,
    },
    plans: bundle.plans.map((p) => ({ ...p, id: map(p.id, 'plan'), projectId })),
    symbols: bundle.symbols.map((s) => ({
      ...s,
      id: map(s.id, 'sym'),
      projectId,
      planId: map(s.planId, 'plan'),
      properties: { ...s.properties, circuitId: opt(s.properties.circuitId) ?? undefined },
    })),
    connections: bundle.connections.map((c) => ({
      ...c,
      id: createId('lnk'),
      projectId,
      planId: map(c.planId, 'plan'),
      sourceId: map(c.sourceId, 'sym'),
      targetId: map(c.targetId, 'sym'),
    })),
    panels: bundle.panels.map((p) => ({
      ...p,
      id: map(p.id, 'pnl'),
      projectId,
      rows: p.rows.map((r) => ({ ...r, id: map(r.id, 'row') })),
    })),
    circuits: bundle.circuits.map((c) => ({ ...c, id: map(c.id, 'cir'), panelId: map(c.panelId, 'pnl'), rowId: map(c.rowId, 'row') })),
    labels: bundle.labels.map((l) => ({ ...l, id: createId('lbl'), panelId: map(l.panelId, 'pnl'), circuitId: map(l.circuitId, 'cir') })),
  };
}

export function serializeBundle(bundle: ProjectBundle): string {
  return JSON.stringify(bundle);
}

/** Lit et valide le contenu d'un fichier .mgeplan. */
export function parseProjectBundle(text: string): ProjectBundle {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fichier illisible : ce n’est pas un projet MG Elec & Plans.');
  }
  const b = data as Partial<ProjectBundle>;
  if (!b || b.format !== 'mgeplan' || !b.project || !Array.isArray(b.plans)) {
    throw new Error('Format non pris en charge : fichier .mgeplan attendu.');
  }
  if (typeof b.version !== 'number' || b.version > 1) {
    throw new Error('Ce projet a été créé avec une version plus récente de MG Elec & Plans.');
  }
  return {
    format: 'mgeplan',
    version: 1,
    app: 'MG Elec & Plans',
    exportedAt: b.exportedAt ?? new Date().toISOString(),
    project: b.project,
    plans: b.plans,
    symbols: b.symbols ?? [],
    connections: b.connections ?? [],
    panels: b.panels ?? [],
    circuits: b.circuits ?? [],
    labels: b.labels ?? [],
    settings: b.settings,
  };
}

/** Écrit un lot dans la base (avec de nouveaux identifiants). */
export async function importProjectBundle(bundle: ProjectBundle, newName?: string): Promise<string> {
  const remapped = remapBundleIds(bundle, newName);
  await db.transaction('rw', [db.projects, db.plans, db.symbolsPlaced, db.connections, db.panels, db.circuits, db.labels], async () => {
    await db.projects.add(remapped.project);
    await db.plans.bulkAdd(remapped.plans);
    await db.symbolsPlaced.bulkAdd(remapped.symbols);
    await db.connections.bulkAdd(remapped.connections);
    await db.panels.bulkAdd(remapped.panels);
    await db.circuits.bulkAdd(remapped.circuits);
    await db.labels.bulkAdd(remapped.labels);
  });
  await refreshProjectStats(remapped.project.id);
  return remapped.project.id;
}

export async function duplicateProject(projectId: string): Promise<string> {
  const bundle = await buildProjectBundle(projectId);
  return importProjectBundle(bundle, `${bundle.project.name} (copie)`);
}

export async function exportProjectFile(projectId: string): Promise<void> {
  const bundle = await buildProjectBundle(projectId);
  const blob = new Blob([serializeBundle(bundle)], { type: 'application/json' });
  downloadBlob(blob, `${safeFileName(bundle.project.name)}${MGEPLAN_EXTENSION}`);
}

export async function importProjectFile(file: File): Promise<string> {
  const text = await readFileAsText(file);
  return importProjectBundle(parseProjectBundle(text));
}
