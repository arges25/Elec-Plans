import type { Brand, DeviceCategory, DeviceProduct, Dimensions, EnclosureModel, ManufacturerData } from '../types';
import { NOT_PROVIDED } from '../constants';
import legrandJson from './manufacturers/legrand.json';
import schneiderJson from './manufacturers/schneider.json';
import hagerJson from './manufacturers/hager.json';

/**
 * Bibliothèques fabricants (une par marque, fichiers JSON indépendants).
 * Pour ajouter un coffret ou un appareil : compléter le JSON de la marque en
 * renseignant la source officielle (sourceName, sourceUrl, lastVerified).
 */
export const MANUFACTURERS: Record<Brand, ManufacturerData> = {
  legrand: legrandJson as ManufacturerData,
  schneider: schneiderJson as ManufacturerData,
  hager: hagerJson as ManufacturerData,
};

export const BRANDS: { id: Brand; name: string; family: string }[] = [
  { id: 'legrand', name: 'Legrand', family: 'Drivia' },
  { id: 'schneider', name: 'Schneider Electric', family: 'Resi9' },
  { id: 'hager', name: 'Hager', family: 'Gamma+' },
];

export const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  protection: 'Protection',
  breakers: 'Disjoncteurs',
  control: 'Commande & automatismes',
  sockets: 'Prises modulaires',
  accessories: 'Obturateurs & réserves',
};
export const CATEGORY_ORDER: DeviceCategory[] = ['protection', 'breakers', 'control', 'sockets', 'accessories'];

const enclosureIndex = new Map<string, EnclosureModel>();
const productIndex = new Map<string, DeviceProduct>();
for (const m of Object.values(MANUFACTURERS)) {
  for (const e of m.enclosures) enclosureIndex.set(e.id, e);
  for (const p of m.devices) productIndex.set(p.id, p);
}

export function brandName(brand: Brand): string {
  return MANUFACTURERS[brand].name;
}

export function getEnclosure(id: string): EnclosureModel | undefined {
  return enclosureIndex.get(id);
}

export function getProduct(id: string): DeviceProduct | undefined {
  return productIndex.get(id);
}

export function listEnclosures(brand: Brand): EnclosureModel[] {
  return MANUFACTURERS[brand].enclosures;
}

export function listFamilies(brand: Brand): string[] {
  return [...new Set(listEnclosures(brand).map((e) => e.family))];
}

/** Largeurs (modules par rangée) existant réellement dans la base pour une gamme. */
export function modulesOptions(brand: Brand, family: string): number[] {
  return [...new Set(listEnclosures(brand).filter((e) => e.family === family).map((e) => e.modulesPerRow))].sort((a, b) => a - b);
}

/** Nombres de rangées existant pour une gamme et une largeur. */
export function rowsOptions(brand: Brand, family: string, modulesPerRow: number): number[] {
  return listEnclosures(brand)
    .filter((e) => e.family === family && e.modulesPerRow === modulesPerRow)
    .map((e) => e.rows)
    .sort((a, b) => a - b);
}

export function findEnclosure(brand: Brand, family: string, modulesPerRow: number, rows: number): EnclosureModel | undefined {
  return listEnclosures(brand).find((e) => e.family === family && e.modulesPerRow === modulesPerRow && e.rows === rows);
}

/** Coffret par défaut d'une marque (le premier de la base). */
export function defaultEnclosure(brand: Brand): EnclosureModel {
  const list = listEnclosures(brand);
  return list.find((e) => e.rows === 2) ?? list[0];
}

/** Bibliothèque d'appareils : marque du tableau, ou tous les fabricants si demandé. */
export function listDevices(brand: Brand, showAllBrands = false): DeviceProduct[] {
  if (!showAllBrands) return MANUFACTURERS[brand].devices;
  return [...MANUFACTURERS[brand].devices, ...Object.values(MANUFACTURERS).flatMap((m) => (m.brand === brand ? [] : m.devices))];
}

/** Appareil équivalent chez une autre marque (même type, même calibre). */
export function equivalentProduct(productId: string, brand: Brand): DeviceProduct | undefined {
  const p = getProduct(productId);
  if (!p) return undefined;
  if (p.brand === brand) return p;
  return MANUFACTURERS[brand].devices.find((d) => d.equivalence === p.equivalence);
}

/** Variantes du même type d'appareil (ex. autres calibres) dans la marque. */
export function productVariants(productId: string): DeviceProduct[] {
  const p = getProduct(productId);
  if (!p) return [];
  return MANUFACTURERS[p.brand].devices.filter((d) => d.kind === p.kind);
}

export function formatMm(v: number): string {
  return `${String(Math.round(v * 10) / 10).replace('.', ',')}`;
}

/** « 250 × 625 × 103,5 mm » (largeur × hauteur × profondeur) ou « Données techniques non renseignées ». */
export function formatDimensions(dims: Dimensions | null): string {
  if (!dims) return NOT_PROVIDED;
  return `${formatMm(dims.widthMm)} × ${formatMm(dims.heightMm)} × ${formatMm(dims.depthMm)} mm`;
}

export function mountingLabel(m: EnclosureModel['mounting']): string {
  if (m === 'surface') return 'En saillie';
  if (m === 'flush') return 'Encastré';
  return NOT_PROVIDED;
}

export const DEVICE_KIND_LABELS: Record<DeviceProduct['kind'], string> = {
  rcd: 'Interrupteur différentiel',
  breaker: 'Disjoncteur',
  teleruptor: 'Télérupteur',
  'contactor-hc': 'Contacteur jour/nuit',
  contactor: 'Contacteur de puissance',
  spd: 'Parafoudre',
  bell: 'Sonnerie modulaire',
  'bell-transformer': 'Transformateur de sonnerie',
  timer: 'Minuterie',
  clock: 'Horloge programmable',
  'load-shedder': 'Délesteur',
  relay: 'Relais',
  'heating-control': 'Commande de chauffage (fil pilote)',
  'energy-meter': 'Écocompteur / compteur d’énergie',
  isolator: 'Interrupteur-sectionneur',
  domotic: 'Module domotique',
  socket: 'Prise de courant modulaire',
  blank: 'Obturateur',
  reserve: 'Emplacement réservé',
};

/** Désignation technique d'un produit (calibre, courbe, sensibilité…). */
export function productRatingText(p: DeviceProduct): string | null {
  if (p.kind === 'rcd') return `${p.rating} A · ${p.sensitivityMa} mA · type ${p.rcdType}`;
  if (p.kind === 'breaker') return `${p.rating} A · courbe ${p.curve}`;
  if (p.rating) return `${p.rating} A`;
  return null;
}
