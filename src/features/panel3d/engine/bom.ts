import type { DeviceProduct, PlacedDevice } from '../types';
import { CATEGORY_ORDER, getProduct } from '../data/catalog';

export interface BomLine {
  product: DeviceProduct;
  quantity: number;
  totalModules: number;
}

/** Nomenclature : appareils identiques regroupés, triés par catégorie puis calibre. */
export function buildBom(devices: PlacedDevice[]): BomLine[] {
  const map = new Map<string, BomLine>();
  for (const d of devices) {
    const product = getProduct(d.productId);
    if (!product) continue;
    const line = map.get(product.id) ?? { product, quantity: 0, totalModules: 0 };
    line.quantity += 1;
    line.totalModules += d.moduleWidth;
    map.set(product.id, line);
  }
  const catIndex = (p: DeviceProduct) => CATEGORY_ORDER.indexOf(p.category);
  return [...map.values()].sort(
    (a, b) =>
      catIndex(a.product) - catIndex(b.product) ||
      a.product.kind.localeCompare(b.product.kind) ||
      (b.product.rating ?? 0) - (a.product.rating ?? 0) ||
      a.product.fullName.localeCompare(b.product.fullName, 'fr'),
  );
}

/** « 4 × Disjoncteur 1P+N 16 A courbe C » */
export function bomText(lines: BomLine[]): string {
  return lines.map((l) => `${l.quantity} × ${l.product.fullName}`).join('\n');
}
