import type { FloorType, LayerId, LayerState, Plan, PlanSource, PlanVectorData } from '../types';
import { createId } from './id';

export const FLOOR_OPTIONS: { value: FloorType; label: string }[] = [
  { value: 'rdc', label: 'RDC' },
  { value: 'etage1', label: 'Étage 1' },
  { value: 'etage2', label: 'Étage 2' },
  { value: 'sous-sol', label: 'Sous-sol' },
  { value: 'garage', label: 'Garage' },
  { value: 'exterieur', label: 'Extérieur' },
  { value: 'custom', label: 'Personnalisé' },
];

export function floorLabel(type: FloorType): string {
  return FLOOR_OPTIONS.find((f) => f.value === type)?.label ?? 'Plan';
}

export const LAYER_DEFS: { id: LayerId; label: string; description: string }[] = [
  { id: 'original', label: 'Plan original', description: 'Photo, scan, image ou PDF importé' },
  { id: 'reconstructed', label: 'Plan reconstruit', description: 'Murs, portes, fenêtres et pièces' },
  { id: 'symbols', label: 'Symboles électriques', description: 'Prises, commandes, éclairages, bandes LED…' },
  { id: 'connections', label: 'Liaisons', description: 'Liaisons pointillées de commande / circuit' },
  { id: 'annotations', label: 'Annotations', description: 'Textes, flèches, formes, crayon' },
  { id: 'measures', label: 'Mesures', description: 'Cotes et échelle' },
];

export function defaultLayers(): LayerState[] {
  return LAYER_DEFS.map((l) => ({ id: l.id, visible: true, locked: false }));
}

export function emptyVectorData(): PlanVectorData {
  return { walls: [], doors: [], windows: [], rooms: [], annotations: [], measures: [] };
}

export const BLANK_PLAN_SIZE = { width: 2000, height: 1400 };

export function createPlan(projectId: string, name: string, floorType: FloorType, order: number, source: PlanSource = 'blank'): Plan {
  const now = Date.now();
  return {
    id: createId('plan'),
    projectId,
    name,
    floorType,
    order,
    source,
    backgroundOpacity: 1,
    vectorData: emptyVectorData(),
    width: BLANK_PLAN_SIZE.width,
    height: BLANK_PLAN_SIZE.height,
    layers: defaultLayers(),
    createdAt: now,
    updatedAt: now,
  };
}

/** Plan « vide » : ni image, ni murs. */
export function isPlanEmpty(plan: Plan): boolean {
  return !plan.originalImage && !plan.processedImage && plan.vectorData.walls.length === 0;
}

/* ------------------------------------------------------------------ */
/* Plans d'un chantier (RDC, Étage 1, Garage…)                         */
/* ------------------------------------------------------------------ */

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Type de niveau déduit du nom saisi (« étage 1 » → etage1, « Garage » → garage, sinon personnalisé). */
export function floorTypeFromName(name: string): FloorType {
  const n = norm(name);
  const aliases: [FloorType, string[]][] = [
    ['rdc', ['rdc', 'rez de chaussee', 'rez de chaussee']],
    ['etage1', ['etage 1', '1er etage', 'premier etage', 'r 1', 'r+1']],
    ['etage2', ['etage 2', '2e etage', '2eme etage', 'deuxieme etage', 'r 2']],
    ['sous-sol', ['sous sol', 'cave']],
    ['garage', ['garage']],
    ['exterieur', ['exterieur', 'jardin']],
  ];
  for (const [type, names] of aliases) if (names.includes(n)) return type;
  return 'custom';
}

/** Noms proposés pour un nouveau plan (ceux déjà utilisés sont écartés). */
export function suggestPlanNames(existing: string[]): string[] {
  const used = new Set(existing.map(norm));
  const all = ['RDC', 'Étage 1', 'Étage 2', 'Étage 3', 'Sous-sol', 'Garage', 'Combles', 'Extérieur', 'Annexe', 'Dépendance'];
  return all.filter((n) => !used.has(norm(n)));
}

/** Message d'erreur si le nom est vide ou déjà pris par un autre plan du chantier. */
export function planNameError(name: string, others: string[]): string | null {
  if (!name.trim()) return 'Donnez un nom au plan';
  if (name.trim().length > 40) return 'Nom trop long (40 caractères maximum)';
  if (others.some((o) => norm(o) === norm(name))) return 'Un plan porte déjà ce nom sur ce chantier';
  return null;
}
