import type { ElectricalConnection, PlacedSymbol, Plan, PlanDocument } from '../types';
import { db } from './db';
import { refreshProjectStats } from './projectRepository';

export function getPlan(id: string): Promise<Plan | undefined> {
  return db.plans.get(id);
}

export async function updatePlan(id: string, changes: Partial<Plan>): Promise<void> {
  const plan = await db.plans.get(id);
  await db.plans.update(id, { ...changes, updatedAt: Date.now() });
  if (plan) await db.projects.update(plan.projectId, { updatedAt: Date.now() });
}

/** Charge le document éditable d'un plan. */
export async function loadPlanDocument(plan: Plan): Promise<PlanDocument> {
  const [symbols, connections] = await Promise.all([
    db.symbolsPlaced.where('planId').equals(plan.id).toArray(),
    db.connections.where('planId').equals(plan.id).toArray(),
  ]);
  return {
    walls: plan.vectorData.walls ?? [],
    doors: plan.vectorData.doors ?? [],
    windows: plan.vectorData.windows ?? [],
    rooms: plan.vectorData.rooms ?? [],
    annotations: plan.vectorData.annotations ?? [],
    measures: plan.vectorData.measures ?? [],
    scale: plan.scale,
    symbols,
    connections,
  };
}

function diffById<T extends { id: string }>(next: T[], prev: T[] | undefined): { put: T[]; remove: string[] } {
  if (!prev) return { put: next, remove: [] };
  const prevMap = new Map(prev.map((x) => [x.id, x]));
  const nextIds = new Set(next.map((x) => x.id));
  const put = next.filter((x) => prevMap.get(x.id) !== x);
  const remove = prev.filter((x) => !nextIds.has(x.id)).map((x) => x.id);
  return { put, remove };
}

/**
 * Enregistre le document d'un plan. Si `prev` est fourni, seuls les objets modifiés
 * (comparaison par référence — les mises à jour sont immuables) sont écrits.
 */
export async function savePlanDocument(planId: string, projectId: string, next: PlanDocument, prev?: PlanDocument): Promise<void> {
  const symbolsDiff = diffById<PlacedSymbol>(next.symbols, prev?.symbols);
  const connectionsDiff = diffById<ElectricalConnection>(next.connections, prev?.connections);
  const vectorChanged =
    !prev ||
    prev.walls !== next.walls ||
    prev.doors !== next.doors ||
    prev.windows !== next.windows ||
    prev.rooms !== next.rooms ||
    prev.annotations !== next.annotations ||
    prev.measures !== next.measures ||
    prev.scale !== next.scale;
  const countsChanged = !prev || prev.symbols.length !== next.symbols.length || prev.connections.length !== next.connections.length;
  const symbolTypesChanged = symbolsDiff.put.some((s) => !prev || prev.symbols.find((p) => p.id === s.id)?.symbolType !== s.symbolType);

  await db.transaction('rw', [db.plans, db.symbolsPlaced, db.connections, db.projects], async () => {
    if (vectorChanged) {
      await db.plans.update(planId, {
        vectorData: {
          walls: next.walls,
          doors: next.doors,
          windows: next.windows,
          rooms: next.rooms,
          annotations: next.annotations,
          measures: next.measures,
        },
        scale: next.scale,
        updatedAt: Date.now(),
      });
    }
    if (symbolsDiff.put.length) await db.symbolsPlaced.bulkPut(symbolsDiff.put);
    if (symbolsDiff.remove.length) await db.symbolsPlaced.bulkDelete(symbolsDiff.remove);
    if (connectionsDiff.put.length) await db.connections.bulkPut(connectionsDiff.put);
    if (connectionsDiff.remove.length) await db.connections.bulkDelete(connectionsDiff.remove);
    await db.projects.update(projectId, { updatedAt: Date.now() });
  });
  if (countsChanged || symbolTypesChanged) await refreshProjectStats(projectId);
}
