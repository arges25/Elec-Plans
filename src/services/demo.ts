import { buildDemoBundle } from '../data/demoProject';
import { db } from '../database/db';
import { importProjectBundle } from './projectTransfer';

/** Crée le projet « Maison Démo » dans la base locale. */
export async function createDemoProject(): Promise<string> {
  const id = await importProjectBundle(buildDemoBundle());
  await db.projects.update(id, { isDemo: true });
  return id;
}
