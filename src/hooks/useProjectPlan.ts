import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';

/** Projet + plan courants (réactifs à la base locale). */
export function useProjectPlan(projectId: string | undefined, planId: string | undefined) {
  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId]);
  const plan = useLiveQuery(() => (planId ? db.plans.get(planId) : undefined), [planId]);
  return { project, plan };
}
