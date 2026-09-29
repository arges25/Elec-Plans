import type { Board, Brand, PlacedDevice } from '../types';
import { getProduct, listEnclosures } from './catalog';
import { newPlacedDevice } from '../store/projectFactory';
import { withLinkedComponents } from '../engine/placement';

/**
 * Tableau d'exemple « TABLEAU PRINCIPAL » (3 rangées de 13 modules), repris de
 * la planche de référence : repères libres (1, 14, 5…), désignations, modules
 * libres, réserves et prises modulaires. Sert d'exemple et de jeu de test.
 */
type Item = [equivalence: string, start: number, ref: string, label: string, width?: number];

const ROWS: Item[][] = [
  [
    ['rcd-63-A', 0, '', ''],
    ['breaker-C-32', 2, '1', 'Plaque induction'],
    ['breaker-C-20', 3, '14', 'PC1'],
    ['breaker-C-20', 4, '5', 'PC5'],
    ['breaker-C-16', 5, '14', 'Hotte'],
    ['breaker-C-10', 6, '5', 'ECL2'],
    ['breaker-C-2', 7, '9', 'VMC'],
    ['reserve-1', 8, '10', ''],
    ['isolator-63', 11, 'disj. tab. div.', ''],
  ],
  [
    ['rcd-63-AC', 0, '', ''],
    ['breaker-C-20', 2, '1', 'Four'],
    ['breaker-C-20', 3, '2', 'PC2'],
    ['breaker-C-20', 4, '7', 'PC4'],
    ['breaker-C-16', 5, '12', 'Frigo'],
    ['breaker-C-10', 6, '15', 'ECL3'],
    ['breaker-C-10', 7, '15', 'ECL4'],
    ['reserve-1', 8, '15', ''],
    ['reserve-1', 9, '16', ''],
    ['reserve-1', 10, 'X', ''],
    ['reserve-1', 11, 'X', ''],
    ['reserve-1', 12, 'X', ''],
  ],
  [
    ['rcd-63-AC', 0, '', ''],
    ['breaker-C-20', 2, '17', 'Lave vaisselle'],
    ['breaker-C-20', 3, '19', 'Prises crédence'],
    ['breaker-C-20', 4, '14', 'PC6'],
    ['breaker-C-16', 5, '21', 'PC3'],
    ['breaker-C-10', 6, '22', 'ECL1'],
    ['breaker-C-16', 7, '15', 'Prises modulaires'],
    ['socket-2pt-16', 8, '23', ''],
    ['socket-2pt-16', 10.5, '24', ''],
  ],
];

export function referenceDevices(brand: Brand): PlacedDevice[] {
  const out: PlacedDevice[] = [];
  ROWS.forEach((items, row) => {
    for (const [eq, start, ref, label, width] of items) {
      const product = getProduct(`${brand}-${eq}`);
      if (!product) continue;
      const d = newPlacedDevice(product, row, start);
      out.push({ ...d, circuitRef: ref, label, moduleWidth: width ?? d.moduleWidth });
    }
  });
  return withLinkedComponents(out);
}

export function referenceBoard(brand: Brand = 'legrand'): Omit<Board, 'id'> {
  const enc = listEnclosures(brand).find((e) => e.rows === 3 && e.modulesPerRow === 13)!;
  return { title: 'TABLEAU PRINCIPAL', brand, enclosureId: enc.id, devices: referenceDevices(brand), minFreePercent: 20 };
}
