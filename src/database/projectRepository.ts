import type { FloorType, Plan, Project, ProjectStats } from '../types';
import { getSymbolDefinition } from '../data/electricalSymbols';
import { createId } from '../utils/id';
import { createPlan, floorLabel } from '../utils/planFactory';
import { db } from './db';
import { createPanelForProject } from './panelRepository';

export interface NewProjectInput {
  name: string;
  clientName: string;
  address: string;
  city: string;
  phone?: string;
  email?: string;
  notes: string;
  date: string;
  floorType: FloorType;
  customFloorName?: string;
}

export async function createProject(input: NewProjectInput): Promise<{ project: Project; plan: Plan }> {
  const now = Date.now();
  const projectId = createId('prj');
  const floorName = input.floorType === 'custom' ? input.customFloorName?.trim() || 'Plan' : floorLabel(input.floorType);
  const plan = createPlan(projectId, floorName, input.floorType, 0);
  const project: Project = {
    id: projectId,
    name: input.name.trim() || 'Nouveau chantier',
    clientName: input.clientName.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    phone: input.phone?.trim() || undefined,
    email: input.email?.trim() || undefined,
    notes: input.notes,
    date: input.date,
    floors: [{ planId: plan.id, name: floorName, type: input.floorType }],
    createdAt: now,
    updatedAt: now,
    stats: { symbols: 0, sockets: 0, lights: 0, switches: 0, connections: 0 },
  };
  await db.transaction('rw', [db.projects, db.plans, db.panels], async () => {
    await db.projects.add(project);
    await db.plans.add(plan);
    await createPanelForProject(projectId, project.name);
  });
  return { project, plan };
}

export function listProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function updateProject(id: string, changes: Partial<Project>): Promise<void> {
  await db.projects.update(id, { ...changes, updatedAt: Date.now() });
}

export async function touchProject(id: string): Promise<void> {
  await db.projects.update(id, { updatedAt: Date.now() });
}

/** Supprime un projet et toutes ses données associées. */
export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', [db.projects, db.plans, db.symbolsPlaced, db.connections, db.panels, db.circuits, db.labels], async () => {
    const panels = await db.panels.where('projectId').equals(id).toArray();
    for (const panel of panels) {
      await db.circuits.where('panelId').equals(panel.id).delete();
      await db.labels.where('panelId').equals(panel.id).delete();
    }
    await db.panels.where('projectId').equals(id).delete();
    await db.symbolsPlaced.where('projectId').equals(id).delete();
    await db.connections.where('projectId').equals(id).delete();
    await db.plans.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}

export async function computeProjectStats(projectId: string): Promise<ProjectStats> {
  const symbols = await db.symbolsPlaced.where('projectId').equals(projectId).toArray();
  const connections = await db.connections.where('projectId').equals(projectId).count();
  const stats: ProjectStats = { symbols: symbols.length, sockets: 0, lights: 0, switches: 0, connections };
  for (const s of symbols) {
    const role = getSymbolDefinition(s.symbolType).role;
    if (role === 'socket') stats.sockets++;
    else if (role === 'light') stats.lights++;
    else if (role === 'switch') stats.switches++;
  }
  return stats;
}

export async function refreshProjectStats(projectId: string): Promise<void> {
  const stats = await computeProjectStats(projectId);
  await db.projects.update(projectId, { stats, updatedAt: Date.now() });
}

export async function getProjectPlans(projectId: string): Promise<Plan[]> {
  const plans = await db.plans.where('projectId').equals(projectId).toArray();
  return plans.sort((a, b) => a.order - b.order);
}

/** Ajoute un niveau (plan) au projet. */
export async function addFloor(projectId: string, type: FloorType, customName?: string): Promise<Plan> {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Projet introuvable');
  const plans = await getProjectPlans(projectId);
  const name = type === 'custom' ? customName?.trim() || `Plan ${plans.length + 1}` : floorLabel(type);
  const plan = createPlan(projectId, name, type, plans.length);
  await db.transaction('rw', [db.projects, db.plans], async () => {
    await db.plans.add(plan);
    await db.projects.update(projectId, {
      floors: [...project.floors, { planId: plan.id, name, type }],
      updatedAt: Date.now(),
    });
  });
  return plan;
}

export async function renameFloor(projectId: string, planId: string, name: string): Promise<void> {
  const project = await db.projects.get(projectId);
  if (!project) return;
  await db.transaction('rw', [db.projects, db.plans], async () => {
    await db.plans.update(planId, { name, updatedAt: Date.now() });
    await db.projects.update(projectId, {
      floors: project.floors.map((f) => (f.planId === planId ? { ...f, name } : f)),
      updatedAt: Date.now(),
    });
  });
}

export async function deleteFloor(projectId: string, planId: string): Promise<void> {
  const project = await db.projects.get(projectId);
  if (!project) return;
  await db.transaction('rw', [db.projects, db.plans, db.symbolsPlaced, db.connections], async () => {
    await db.symbolsPlaced.where('planId').equals(planId).delete();
    await db.connections.where('planId').equals(planId).delete();
    await db.plans.delete(planId);
    await db.projects.update(projectId, { floors: project.floors.filter((f) => f.planId !== planId), updatedAt: Date.now() });
  });
  await refreshProjectStats(projectId);
}
