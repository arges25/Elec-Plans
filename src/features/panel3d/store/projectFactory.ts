import type { Brand, DeviceProduct, PanelProject, PlacedDevice } from '../types';
import { defaultEnclosure } from '../data/catalog';
import { createId } from '../../../utils/id';

export const DEFAULT_PRINT = { moduleMm: 18, labelHeightMm: 12, fontSizePt: 8 } as const;

export function createPanelProject(name: string, brand: Brand = 'legrand', projectId: string | null = null): PanelProject {
  const now = Date.now();
  return {
    id: createId('p3d'),
    name,
    projectId,
    brand,
    enclosureId: defaultEnclosure(brand).id,
    devices: [],
    labelStyle: 'both',
    showModuleNumbers: false,
    showAllBrands: false,
    print: { ...DEFAULT_PRINT },
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/** Appareil posé à partir d'un produit du catalogue. */
export function newPlacedDevice(product: DeviceProduct, row: number, startModule: number): PlacedDevice {
  const isRcd = product.kind === 'rcd';
  return {
    id: createId('dev'),
    manufacturer: product.brand,
    productId: product.id,
    row,
    startModule,
    moduleWidth: product.modules,
    // Un différentiel est étiqueté d'office ; les autres circuits se nomment ensuite
    label: isRcd ? 'Différentiel' : '',
    icon: isRcd ? 'differentiel' : null,
    labelStyle: null,
    mergedWithPrev: false,
    linkedComponents: [],
  };
}
