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
  { id: 'symbols', label: 'Symboles électriques', description: 'Prises, commandes, éclairages…' },
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
