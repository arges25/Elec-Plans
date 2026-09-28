import { create } from 'zustand';
import type { Brand, LabelStyle, PanelProject, PlacedDevice, PrintSettings } from '../types';
import { equivalentProduct, getEnclosure, getProduct } from '../data/catalog';
import {
  autoArrange,
  canPlace,
  duplicateRowPlacement,
  duplicateSlot,
  firstFreeSlot,
  labelZones,
  nextMergeCandidate,
  withLinkedComponents,
  zoneOf,
  type Capacity,
  type PlaceCheck,
} from '../engine/placement';
import { newPlacedDevice } from './projectFactory';
import { createId } from '../../../utils/id';

const HISTORY_LIMIT = 150;

export type EditorTab = 'config' | 'board' | 'labels' | 'bom' | 'print';

export type Selection = { kind: 'device'; id: string } | { kind: 'zone'; id: string } | null;

export interface ActionResult {
  ok: boolean;
  message?: string;
  id?: string;
}

interface PanelEditorState {
  project: PanelProject | null;
  past: PanelProject[];
  future: PanelProject[];
  /** Regroupe des modifications successives (saisie d'un texte) en une seule étape d'historique. */
  coalesceKey: string | null;
  selection: Selection;
  /** Produit choisi dans la bibliothèque, à poser d'un toucher sur le rail. */
  armedProductId: string | null;
  /** Appareil en attente de déplacement (bouton « Déplacer »). */
  moveDeviceId: string | null;
  tab: EditorTab;

  load: (p: PanelProject) => void;
  unload: () => void;
  commit: (updater: (p: PanelProject) => PanelProject, coalesce?: string) => void;
  undo: () => void;
  redo: () => void;

  setTab: (t: EditorTab) => void;
  select: (s: Selection) => void;
  arm: (productId: string | null) => void;
  setMoveDevice: (id: string | null) => void;

  setMeta: (changes: Partial<Pick<PanelProject, 'name' | 'labelStyle' | 'showModuleNumbers' | 'showAllBrands' | 'projectId'>>) => void;
  setPrint: (changes: Partial<PrintSettings>) => void;
  /** Change de coffret : les appareils hors capacité sont retirés (retournés). */
  setEnclosure: (enclosureId: string) => PlacedDevice[];
  /** Change de marque : appareils convertis en équivalents de la marque, sinon retirés. */
  setBrand: (brand: Brand, enclosureId: string) => PlacedDevice[];

  addDevice: (productId: string, row: number, start: number) => ActionResult;
  addDeviceAuto: (productId: string) => ActionResult;
  moveDevice: (id: string, row: number, start: number) => ActionResult;
  duplicateDevice: (id: string) => ActionResult;
  removeDevice: (id: string) => void;
  replaceProduct: (id: string, productId: string) => ActionResult;
  updateLabel: (leaderId: string, changes: Partial<Pick<PlacedDevice, 'label' | 'icon' | 'labelStyle'>>, coalesce?: string) => void;
  mergeWithNext: (leaderId: string) => ActionResult;
  splitZone: (leaderId: string) => void;
  duplicateRow: (row: number) => ActionResult;
  clearRow: (row: number) => void;
  autoArrange: () => ActionResult;
}

export function capacityOf(p: PanelProject): Capacity {
  const enc = getEnclosure(p.enclosureId);
  return { rows: enc?.rows ?? 1, modulesPerRow: enc?.modulesPerRow ?? 13 };
}

export function placeMessage(check: PlaceCheck): string {
  switch (check.reason) {
    case 'row-full':
      return 'Rangée complète';
    case 'overlap':
      return 'Emplacement déjà occupé';
    case 'overflow':
      return 'Pas assez de place en bout de rangée';
    case 'bad-row':
      return 'Rangée inexistante';
    default:
      return '';
  }
}

/** Retire les appareils qui ne tiennent plus dans la capacité donnée. */
function fitDevices(devices: PlacedDevice[], cap: Capacity): { kept: PlacedDevice[]; removed: PlacedDevice[] } {
  const kept: PlacedDevice[] = [];
  const removed: PlacedDevice[] = [];
  for (const d of [...devices].sort((a, b) => a.row - b.row || a.startModule - b.startModule)) {
    if (canPlace(kept, cap, d.row, d.startModule, d.moduleWidth).ok) kept.push(d);
    else removed.push(d);
  }
  return { kept, removed };
}

export const usePanelEditor = create<PanelEditorState>((set, get) => {
  const setDevices = (p: PanelProject, devices: PlacedDevice[]): PanelProject => ({ ...p, devices: withLinkedComponents(devices) });

  return {
    project: null,
    past: [],
    future: [],
    coalesceKey: null,
    selection: null,
    armedProductId: null,
    moveDeviceId: null,
    tab: 'board',

    load: (project) => set({ project, past: [], future: [], coalesceKey: null, selection: null, armedProductId: null, moveDeviceId: null }),
    unload: () => set({ project: null, past: [], future: [], selection: null, armedProductId: null, moveDeviceId: null }),

    commit: (updater, coalesce) => {
      const { project, past, coalesceKey } = get();
      if (!project) return;
      const next = updater(project);
      if (next === project) return;
      const stamped = { ...next, updatedAt: Date.now() };
      const merge = coalesce !== undefined && coalesce === coalesceKey;
      set({
        project: stamped,
        past: merge ? past : [...past, project].slice(-HISTORY_LIMIT),
        future: [],
        coalesceKey: coalesce ?? null,
      });
    },
    undo: () => {
      const { past, project, future } = get();
      if (!project || !past.length) return;
      const prev = past[past.length - 1];
      set({ project: { ...prev, updatedAt: Date.now() }, past: past.slice(0, -1), future: [project, ...future].slice(0, HISTORY_LIMIT), coalesceKey: null, selection: null });
    },
    redo: () => {
      const { past, project, future } = get();
      if (!project || !future.length) return;
      const [next, ...rest] = future;
      set({ project: { ...next, updatedAt: Date.now() }, past: [...past, project].slice(-HISTORY_LIMIT), future: rest, coalesceKey: null, selection: null });
    },

    setTab: (tab) => set({ tab, armedProductId: null, moveDeviceId: null }),
    select: (selection) => set({ selection, coalesceKey: null }),
    arm: (armedProductId) => set({ armedProductId, moveDeviceId: null }),
    setMoveDevice: (moveDeviceId) => set({ moveDeviceId, armedProductId: null }),

    setMeta: (changes) => get().commit((p) => ({ ...p, ...changes }), changes.name !== undefined ? 'meta-name' : undefined),
    setPrint: (changes) => get().commit((p) => ({ ...p, print: { ...p.print, ...changes } }), 'print'),

    setEnclosure: (enclosureId) => {
      const p = get().project;
      const enc = getEnclosure(enclosureId);
      if (!p || !enc || p.enclosureId === enclosureId) return [];
      const { kept, removed } = fitDevices(p.devices, { rows: enc.rows, modulesPerRow: enc.modulesPerRow });
      get().commit((pp) => setDevices({ ...pp, enclosureId, brand: enc.brand }, kept));
      set({ selection: null });
      return removed;
    },

    setBrand: (brand, enclosureId) => {
      const p = get().project;
      const enc = getEnclosure(enclosureId);
      if (!p || !enc) return [];
      const converted: PlacedDevice[] = [];
      const removed: PlacedDevice[] = [];
      for (const d of p.devices) {
        const eq = equivalentProduct(d.productId, brand);
        if (eq && eq.modules === d.moduleWidth) converted.push({ ...d, productId: eq.id, manufacturer: brand });
        else removed.push(d);
      }
      const fitted = fitDevices(converted, { rows: enc.rows, modulesPerRow: enc.modulesPerRow });
      get().commit((pp) => setDevices({ ...pp, brand, enclosureId }, fitted.kept));
      set({ selection: null });
      return [...removed, ...fitted.removed];
    },

    addDevice: (productId, row, start) => {
      const p = get().project;
      const product = getProduct(productId);
      if (!p || !product) return { ok: false, message: 'Appareil inconnu' };
      const check = canPlace(p.devices, capacityOf(p), row, start, product.modules);
      if (!check.ok) return { ok: false, message: placeMessage(check) };
      const dev = newPlacedDevice(product, row, start);
      get().commit((pp) => setDevices(pp, [...pp.devices, dev]));
      set({ selection: { kind: 'device', id: dev.id } });
      return { ok: true, id: dev.id };
    },

    addDeviceAuto: (productId) => {
      const p = get().project;
      const product = getProduct(productId);
      if (!p || !product) return { ok: false, message: 'Appareil inconnu' };
      const slot = firstFreeSlot(p.devices, capacityOf(p), product.modules);
      if (!slot) return { ok: false, message: 'Tableau complet : plus d’emplacement libre' };
      return get().addDevice(productId, slot.row, slot.start);
    },

    moveDevice: (id, row, start) => {
      const p = get().project;
      const d = p?.devices.find((x) => x.id === id);
      if (!p || !d) return { ok: false };
      if (d.row === row && d.startModule === start) return { ok: true, id };
      const check = canPlace(p.devices, capacityOf(p), row, start, d.moduleWidth, id);
      if (!check.ok) return { ok: false, message: placeMessage(check) };
      get().commit((pp) =>
        setDevices(
          pp,
          pp.devices.map((x) => (x.id === id ? { ...x, row, startModule: start, mergedWithPrev: false } : x)),
        ),
      );
      return { ok: true, id };
    },

    duplicateDevice: (id) => {
      const p = get().project;
      const d = p?.devices.find((x) => x.id === id);
      if (!p || !d) return { ok: false };
      const slot = duplicateSlot(p.devices, capacityOf(p), d);
      if (!slot) return { ok: false, message: 'Plus de place pour dupliquer' };
      const copy: PlacedDevice = { ...d, id: createId('dev'), row: slot.row, startModule: slot.start, mergedWithPrev: false, linkedComponents: [] };
      get().commit((pp) => setDevices(pp, [...pp.devices, copy]));
      set({ selection: { kind: 'device', id: copy.id } });
      return { ok: true, id: copy.id };
    },

    removeDevice: (id) => {
      get().commit((pp) => setDevices(pp, pp.devices.filter((x) => x.id !== id)));
      const sel = get().selection;
      if (sel && sel.id === id) set({ selection: null });
    },

    replaceProduct: (id, productId) => {
      const p = get().project;
      const d = p?.devices.find((x) => x.id === id);
      const product = getProduct(productId);
      if (!p || !d || !product) return { ok: false };
      if (product.modules !== d.moduleWidth) {
        const check = canPlace(p.devices, capacityOf(p), d.row, d.startModule, product.modules, id);
        if (!check.ok) return { ok: false, message: placeMessage(check) };
      }
      get().commit((pp) =>
        setDevices(
          pp,
          pp.devices.map((x) => (x.id === id ? { ...x, productId, manufacturer: product.brand, moduleWidth: product.modules } : x)),
        ),
      );
      return { ok: true, id };
    },

    updateLabel: (leaderId, changes, coalesce) =>
      get().commit((pp) => ({ ...pp, devices: pp.devices.map((x) => (x.id === leaderId ? { ...x, ...changes } : x)) }), coalesce),

    mergeWithNext: (leaderId) => {
      const p = get().project;
      if (!p) return { ok: false };
      const zone = zoneOf(p.devices, leaderId, p.labelStyle);
      if (!zone) return { ok: false };
      const next = nextMergeCandidate(p.devices, zone);
      if (!next) return { ok: false, message: 'Aucun appareil contigu à droite' };
      // L'appareil suivant (et sa zone éventuelle) rejoint la zone
      const nextZone = labelZones(p.devices, zone.row, p.labelStyle).find((z) => z.ids.includes(next.id));
      const ids = new Set(nextZone?.ids ?? [next.id]);
      get().commit((pp) => setDevices(pp, pp.devices.map((x) => (ids.has(x.id) ? { ...x, mergedWithPrev: true } : x))));
      return { ok: true };
    },

    splitZone: (leaderId) => {
      const p = get().project;
      if (!p) return;
      const zone = zoneOf(p.devices, leaderId, p.labelStyle);
      if (!zone || zone.ids.length < 2) return;
      const ids = new Set(zone.ids);
      get().commit((pp) => setDevices(pp, pp.devices.map((x) => (ids.has(x.id) ? { ...x, mergedWithPrev: false } : x))));
    },

    duplicateRow: (row) => {
      const p = get().project;
      if (!p) return { ok: false };
      const out = duplicateRowPlacement(p.devices, capacityOf(p), row, () => createId('dev'));
      if (!out) return { ok: false, message: 'Aucune rangée vide pour recevoir la copie' };
      get().commit((pp) => ({ ...pp, devices: out }));
      return { ok: true };
    },

    clearRow: (row) => get().commit((pp) => setDevices(pp, pp.devices.filter((x) => x.row !== row))),

    autoArrange: () => {
      const p = get().project;
      if (!p) return { ok: false };
      const out = autoArrange(p.devices, capacityOf(p));
      if (!out) return { ok: false, message: 'Les appareils ne tiennent pas dans le tableau' };
      get().commit((pp) => ({ ...pp, devices: out }));
      return { ok: true };
    },
  };
});

/** Style effectif d'une étiquette. */
export function effectiveStyle(p: PanelProject, d: PlacedDevice): LabelStyle {
  return d.labelStyle ?? p.labelStyle;
}
