import type { Board, BoardDoc, Brand, DeviceProduct, DisplaySettings, PanelProject, PlacedDevice, PrintSettings } from '../types';
import { defaultEnclosure } from '../data/catalog';
import { createId } from '../../../utils/id';

export const DEFAULT_PRINT: PrintSettings = { moduleMm: 18, labelHeightMm: 12, fontSizePt: 8, showRef: true };

export const DEFAULT_SETTINGS: DisplaySettings = {
  labelStyle: 'text',
  labelText: 'long',
  showModuleNumbers: true,
  showAllBrands: false,
  totals: { kind: 'none' },
  askCircuitOnDrop: true,
  view: 'schema',
};

export const DEFAULT_BOARD_TITLE = 'TABLEAU PRINCIPAL';

export function createBoard(title = DEFAULT_BOARD_TITLE, brand: Brand = 'legrand', enclosureId?: string): Board {
  return { id: createId('brd'), title, brand, enclosureId: enclosureId ?? defaultEnclosure(brand).id, devices: [], minFreePercent: null };
}

export function createPanelProject(name: string, brand: Brand = 'legrand', projectId: string | null = null): PanelProject {
  const now = Date.now();
  const board = createBoard(DEFAULT_BOARD_TITLE, brand);
  return {
    id: createId('p3d'),
    name,
    projectId,
    boards: [board],
    activeBoardId: board.id,
    ...DEFAULT_SETTINGS,
    print: { ...DEFAULT_PRINT },
    createdAt: now,
    updatedAt: now,
    version: 2,
  };
}

/** Appareil posé à partir d'un produit du catalogue. */
export function newPlacedDevice(product: DeviceProduct, row: number, startModule: number): PlacedDevice {
  return {
    id: createId('dev'),
    manufacturer: product.brand,
    productId: product.id,
    row,
    startModule,
    moduleWidth: product.modules,
    circuitRef: '',
    label: '',
    shortLabel: '',
    icon: null,
    labelStyle: null,
    notes: '',
    mergedWithPrev: false,
    linkedComponents: [],
  };
}

export function activeBoard(p: PanelProject): Board {
  return p.boards.find((b) => b.id === p.activeBoardId) ?? p.boards[0];
}

/** Tableau actif « à plat » avec les réglages du projet. */
export function toDoc(p: PanelProject, board: Board = activeBoard(p)): BoardDoc {
  return {
    ...board,
    projectName: p.name,
    labelStyle: p.labelStyle,
    labelText: p.labelText,
    showModuleNumbers: p.showModuleNumbers,
    showAllBrands: p.showAllBrands,
    totals: p.totals,
    askCircuitOnDrop: p.askCircuitOnDrop,
    view: p.view,
    print: p.print,
  };
}

/** Document d'aperçu pour un coffret donné (vignettes). */
export function previewDoc(brand: Brand, enclosureId: string): BoardDoc {
  const p = createPanelProject('aperçu', brand);
  return toDoc(p, { ...p.boards[0], enclosureId });
}

/* ------------------------------------------------------------------ */
/* Migration des projets enregistrés                                   */
/* ------------------------------------------------------------------ */

type Raw = Record<string, unknown>;

export function normalizeDevice(raw: Raw): PlacedDevice {
  const d = raw as Partial<PlacedDevice>;
  return {
    id: String(d.id ?? createId('dev')),
    manufacturer: (d.manufacturer ?? 'legrand') as Brand,
    productId: String(d.productId ?? ''),
    row: Number(d.row ?? 0),
    startModule: Number(d.startModule ?? 0),
    moduleWidth: Number(d.moduleWidth ?? 1),
    circuitRef: typeof d.circuitRef === 'string' ? d.circuitRef : '',
    label: typeof d.label === 'string' ? d.label : '',
    shortLabel: typeof d.shortLabel === 'string' ? d.shortLabel : '',
    icon: typeof d.icon === 'string' ? d.icon : null,
    labelStyle: d.labelStyle ?? null,
    notes: typeof d.notes === 'string' ? d.notes : '',
    mergedWithPrev: Boolean(d.mergedWithPrev),
    linkedComponents: Array.isArray(d.linkedComponents) ? d.linkedComponents.map(String) : [],
  };
}

/**
 * Projet lu en base (ou importé) → format courant.
 * Version 1 (un seul tableau) : devient un projet avec « TABLEAU PRINCIPAL ».
 */
export function normalizeProject(raw: Raw): PanelProject {
  const now = Date.now();
  const r = raw as Partial<PanelProject> & Raw;
  const settings: DisplaySettings = {
    labelStyle: (r.labelStyle as DisplaySettings['labelStyle']) ?? DEFAULT_SETTINGS.labelStyle,
    labelText: r.labelText === 'short' ? 'short' : 'long',
    showModuleNumbers: typeof r.showModuleNumbers === 'boolean' ? r.showModuleNumbers : DEFAULT_SETTINGS.showModuleNumbers,
    showAllBrands: Boolean(r.showAllBrands),
    totals: (r.totals as DisplaySettings['totals']) ?? { kind: 'none' },
    askCircuitOnDrop: typeof r.askCircuitOnDrop === 'boolean' ? r.askCircuitOnDrop : true,
    view: r.view === 'coffret' ? 'coffret' : 'schema',
  };
  let boards: Board[];
  if (Array.isArray(r.boards) && r.boards.length) {
    boards = (r.boards as unknown as Raw[]).map((b) => {
      const bb = b as Partial<Board>;
      const brand = (bb.brand ?? 'legrand') as Brand;
      return {
        id: String(bb.id ?? createId('brd')),
        title: String(bb.title ?? DEFAULT_BOARD_TITLE),
        brand,
        enclosureId: String(bb.enclosureId ?? defaultEnclosure(brand).id),
        devices: Array.isArray(bb.devices) ? (bb.devices as unknown as Raw[]).map(normalizeDevice) : [],
        minFreePercent: typeof bb.minFreePercent === 'number' ? bb.minFreePercent : null,
      };
    });
  } else {
    const brand = (r.brand ?? 'legrand') as Brand;
    boards = [
      {
        id: createId('brd'),
        title: DEFAULT_BOARD_TITLE,
        brand,
        enclosureId: String(r.enclosureId ?? defaultEnclosure(brand).id),
        devices: Array.isArray(r.devices) ? (r.devices as unknown as Raw[]).map(normalizeDevice) : [],
        minFreePercent: null,
      },
    ];
  }
  const activeBoardId = boards.some((b) => b.id === r.activeBoardId) ? String(r.activeBoardId) : boards[0].id;
  return {
    id: String(r.id ?? createId('p3d')),
    name: String(r.name ?? 'Tableau'),
    projectId: (r.projectId as string | null) ?? null,
    boards,
    activeBoardId,
    ...settings,
    print: { ...DEFAULT_PRINT, ...((r.print as Partial<PrintSettings>) ?? {}) },
    createdAt: Number(r.createdAt ?? now),
    updatedAt: Number(r.updatedAt ?? now),
    version: 2,
  };
}
