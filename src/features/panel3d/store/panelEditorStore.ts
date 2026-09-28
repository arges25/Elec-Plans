import { create } from 'zustand';
import type { Board, BoardDoc, Brand, DisplaySettings, PanelProject, PlacedDevice, PrintSettings } from '../types';
import { equivalentProduct, getEnclosure, getProduct, listDevices } from '../data/catalog';
import { getPreset } from '../data/circuits';
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
import { clearSpan, compactRow, insertWithShift, numberCircuits } from '../engine/boardOps';
import { activeBoard, createBoard, newPlacedDevice, toDoc } from './projectFactory';
import { createId } from '../../../utils/id';

const HISTORY_LIMIT = 150;

export type EditorTab = 'config' | 'board' | 'labels' | 'bom' | 'print';

export type Selection =
  | { kind: 'device'; id: string }
  | { kind: 'zone'; id: string }
  /** Emplacement libre (ajouter / réserver). */
  | { kind: 'slot'; row: number; start: number }
  | null;

/** En cas d'emplacement occupé : décaler les appareils suivants, ou remplacer. */
export type PlaceMode = 'strict' | 'shift' | 'replace';

export interface ActionResult {
  ok: boolean;
  message?: string;
  id?: string;
}

export type DeviceChanges = Partial<Pick<PlacedDevice, 'circuitRef' | 'label' | 'shortLabel' | 'icon' | 'labelStyle' | 'notes'>>;

interface PanelEditorState {
  project: PanelProject | null;
  /** Tableau actif + réglages (dérivé de `project`). */
  doc: BoardDoc | null;
  past: PanelProject[];
  future: PanelProject[];
  /** Regroupe des modifications successives (saisie d'un texte) en une seule étape d'historique. */
  coalesceKey: string | null;
  selection: Selection;
  /** Produit choisi dans la bibliothèque, à poser d'un toucher sur le rail. */
  armedProductId: string | null;
  /** Appareil en attente de déplacement (bouton « Déplacer »). */
  moveDeviceId: string | null;
  /** Appareil qui vient d'être posé : « Quel circuit ? » (facultatif). */
  circuitPromptFor: string | null;
  tab: EditorTab;

  load: (p: PanelProject) => void;
  unload: () => void;
  commit: (updater: (p: PanelProject) => PanelProject, coalesce?: string) => void;
  commitBoard: (updater: (b: Board) => Board, coalesce?: string) => void;
  undo: () => void;
  redo: () => void;

  setTab: (t: EditorTab) => void;
  select: (s: Selection) => void;
  arm: (productId: string | null) => void;
  setMoveDevice: (id: string | null) => void;
  setCircuitPrompt: (id: string | null) => void;

  setMeta: (changes: Partial<Pick<PanelProject, 'name' | 'projectId'>>) => void;
  setSettings: (changes: Partial<DisplaySettings>) => void;
  setPrint: (changes: Partial<PrintSettings>) => void;

  /* Tableaux du projet */
  setActiveBoard: (id: string) => void;
  addBoard: (title: string) => string;
  duplicateBoard: (id: string) => void;
  removeBoard: (id: string) => ActionResult;
  setBoardMeta: (changes: Partial<Pick<Board, 'title' | 'minFreePercent'>>) => void;
  /** Change de coffret : les appareils hors capacité sont retirés (retournés). */
  setEnclosure: (enclosureId: string) => PlacedDevice[];
  /** Change de marque : appareils convertis en équivalents de la marque, sinon retirés. */
  setBrand: (brand: Brand, enclosureId: string) => PlacedDevice[];

  /* Appareils */
  addDevice: (productId: string, row: number, start: number, mode?: PlaceMode) => ActionResult;
  addDeviceAuto: (productId: string) => ActionResult;
  moveDevice: (id: string, row: number, start: number, mode?: PlaceMode) => ActionResult;
  duplicateDevice: (id: string) => ActionResult;
  removeDevice: (id: string) => void;
  replaceProduct: (id: string, productId: string) => ActionResult;
  resizeDevice: (id: string, width: number) => ActionResult;
  updateDevice: (id: string, changes: DeviceChanges, coalesce?: string) => void;
  /** Alias historique (étiquettes). */
  updateLabel: (leaderId: string, changes: DeviceChanges, coalesce?: string) => void;
  applyPreset: (id: string, presetId: string) => void;
  reserveSlot: (row: number, start: number, width?: number) => ActionResult;
  mergeWithNext: (leaderId: string) => ActionResult;
  splitZone: (leaderId: string) => void;
  duplicateRow: (row: number) => ActionResult;
  clearRow: (row: number) => void;
  compactRow: (row: number) => void;
  autoArrange: () => ActionResult;
  numberCircuits: () => void;
}

export function capacityOf(b: { enclosureId: string }): Capacity {
  const enc = getEnclosure(b.enclosureId);
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

/** Place `width` modules en [row, start) selon le mode ; renvoie les appareils prêts à recevoir le nouvel appareil. */
function makeRoom(devices: PlacedDevice[], cap: Capacity, row: number, start: number, width: number, mode: PlaceMode, ignoreId?: string): { devices: PlacedDevice[]; start: number } | { error: string } {
  const check = canPlace(devices, cap, row, start, width, ignoreId);
  if (check.ok) return { devices, start };
  if (mode === 'shift' && check.reason !== 'bad-row') {
    const r = insertWithShift(devices, cap, row, start, width, ignoreId);
    if (r) return r;
    return { error: 'Pas assez de place dans la rangée pour décaler les appareils' };
  }
  if (mode === 'replace' && check.reason !== 'bad-row') {
    const cleared = clearSpan(devices, row, start, width, ignoreId).devices;
    if (canPlace(cleared, cap, row, start, width, ignoreId).ok) return { devices: cleared, start };
  }
  return { error: placeMessage(check) };
}

const setDevices = (b: Board, devices: PlacedDevice[]): Board => ({ ...b, devices: withLinkedComponents(devices) });

export const usePanelEditor = create<PanelEditorState>((set, get) => {
  const withDoc = (project: PanelProject | null) => ({ project, doc: project ? toDoc(project) : null });
  const board = (): Board | null => {
    const p = get().project;
    return p ? activeBoard(p) : null;
  };

  return {
    project: null,
    doc: null,
    past: [],
    future: [],
    coalesceKey: null,
    selection: null,
    armedProductId: null,
    moveDeviceId: null,
    circuitPromptFor: null,
    tab: 'board',

    load: (project) =>
      set({ ...withDoc(project), past: [], future: [], coalesceKey: null, selection: null, armedProductId: null, moveDeviceId: null, circuitPromptFor: null }),
    unload: () => set({ ...withDoc(null), past: [], future: [], selection: null, armedProductId: null, moveDeviceId: null, circuitPromptFor: null }),

    commit: (updater, coalesce) => {
      const { project, past, coalesceKey } = get();
      if (!project) return;
      const next = updater(project);
      if (next === project) return;
      const stamped = { ...next, updatedAt: Date.now() };
      const merge = coalesce !== undefined && coalesce === coalesceKey;
      set({
        ...withDoc(stamped),
        past: merge ? past : [...past, project].slice(-HISTORY_LIMIT),
        future: [],
        coalesceKey: coalesce ?? null,
      });
    },
    commitBoard: (updater, coalesce) =>
      get().commit((p) => {
        const b = activeBoard(p);
        const nb = updater(b);
        if (nb === b) return p;
        return { ...p, boards: p.boards.map((x) => (x.id === b.id ? nb : x)) };
      }, coalesce),
    undo: () => {
      const { past, project, future } = get();
      if (!project || !past.length) return;
      const prev = past[past.length - 1];
      set({ ...withDoc({ ...prev, updatedAt: Date.now() }), past: past.slice(0, -1), future: [project, ...future].slice(0, HISTORY_LIMIT), coalesceKey: null, selection: null });
    },
    redo: () => {
      const { past, project, future } = get();
      if (!project || !future.length) return;
      const [next, ...rest] = future;
      set({ ...withDoc({ ...next, updatedAt: Date.now() }), past: [...past, project].slice(-HISTORY_LIMIT), future: rest, coalesceKey: null, selection: null });
    },

    setTab: (tab) => set({ tab, armedProductId: null, moveDeviceId: null }),
    select: (selection) => set({ selection, coalesceKey: null }),
    arm: (armedProductId) => set({ armedProductId, moveDeviceId: null }),
    setMoveDevice: (moveDeviceId) => set({ moveDeviceId, armedProductId: null }),
    setCircuitPrompt: (circuitPromptFor) => set({ circuitPromptFor }),

    setMeta: (changes) => get().commit((p) => ({ ...p, ...changes }), changes.name !== undefined ? 'meta-name' : undefined),
    setSettings: (changes) => get().commit((p) => ({ ...p, ...changes }), 'settings'),
    setPrint: (changes) => get().commit((p) => ({ ...p, print: { ...p.print, ...changes } }), 'print'),

    /* ------------------------------ Tableaux ------------------------------ */
    setActiveBoard: (id) => {
      const p = get().project;
      if (!p || p.activeBoardId === id || !p.boards.some((b) => b.id === id)) return;
      // Navigation : pas une étape d'historique
      set({ ...withDoc({ ...p, activeBoardId: id }), selection: null, armedProductId: null, moveDeviceId: null, circuitPromptFor: null });
    },
    addBoard: (title) => {
      const cur = board();
      const b = createBoard(title, cur?.brand ?? 'legrand', cur?.enclosureId);
      get().commit((p) => ({ ...p, boards: [...p.boards, b], activeBoardId: b.id }));
      set({ selection: null });
      return b.id;
    },
    duplicateBoard: (id) => {
      const src = get().project?.boards.find((b) => b.id === id);
      if (!src) return;
      const copy: Board = {
        ...structuredClone(src),
        id: createId('brd'),
        title: `${src.title} (COPIE)`,
        devices: withLinkedComponents(src.devices.map((d) => ({ ...d, id: createId('dev') })).map((d) => ({ ...d, mergedWithPrev: false }))),
      };
      get().commit((p) => ({ ...p, boards: [...p.boards, copy], activeBoardId: copy.id }));
      set({ selection: null });
    },
    removeBoard: (id) => {
      const p = get().project;
      if (!p) return { ok: false };
      if (p.boards.length <= 1) return { ok: false, message: 'Un projet contient au moins un tableau' };
      get().commit((pp) => {
        const boards = pp.boards.filter((b) => b.id !== id);
        return { ...pp, boards, activeBoardId: pp.activeBoardId === id ? boards[0].id : pp.activeBoardId };
      });
      set({ selection: null });
      return { ok: true };
    },
    setBoardMeta: (changes) => get().commitBoard((b) => ({ ...b, ...changes }), changes.title !== undefined ? 'board-title' : 'board-meta'),

    setEnclosure: (enclosureId) => {
      const b = board();
      const enc = getEnclosure(enclosureId);
      if (!b || !enc || b.enclosureId === enclosureId) return [];
      const { kept, removed } = fitDevices(b.devices, { rows: enc.rows, modulesPerRow: enc.modulesPerRow });
      get().commitBoard((bb) => setDevices({ ...bb, enclosureId, brand: enc.brand }, kept));
      set({ selection: null });
      return removed;
    },

    setBrand: (brand, enclosureId) => {
      const b = board();
      const enc = getEnclosure(enclosureId);
      if (!b || !enc) return [];
      const converted: PlacedDevice[] = [];
      const removed: PlacedDevice[] = [];
      for (const d of b.devices) {
        const eq = equivalentProduct(d.productId, brand);
        const product = getProduct(d.productId);
        const sameWidth = eq && (eq.modules === d.moduleWidth || (product && !product.verified && !eq.verified));
        if (eq && sameWidth) converted.push({ ...d, productId: eq.id, manufacturer: brand });
        else removed.push(d);
      }
      const fitted = fitDevices(converted, { rows: enc.rows, modulesPerRow: enc.modulesPerRow });
      get().commitBoard((bb) => setDevices({ ...bb, brand, enclosureId }, fitted.kept));
      set({ selection: null });
      return [...removed, ...fitted.removed];
    },

    /* ------------------------------ Appareils ------------------------------ */
    addDevice: (productId, row, start, mode = 'strict') => {
      const p = get().project;
      const b = board();
      const product = getProduct(productId);
      if (!p || !b || !product) return { ok: false, message: 'Appareil inconnu' };
      const room = makeRoom(b.devices, capacityOf(b), row, start, product.modules, mode);
      if ('error' in room) return { ok: false, message: room.error };
      const dev = newPlacedDevice(product, row, room.start);
      get().commitBoard((bb) => setDevices(bb, [...room.devices, dev]));
      set({ selection: { kind: 'device', id: dev.id }, circuitPromptFor: product.kind === 'breaker' && p.askCircuitOnDrop ? dev.id : null });
      return { ok: true, id: dev.id };
    },

    addDeviceAuto: (productId) => {
      const b = board();
      const product = getProduct(productId);
      if (!b || !product) return { ok: false, message: 'Appareil inconnu' };
      const slot = firstFreeSlot(b.devices, capacityOf(b), product.modules);
      if (!slot) return { ok: false, message: 'Tableau complet : plus d’emplacement libre' };
      return get().addDevice(productId, slot.row, slot.start);
    },

    moveDevice: (id, row, start, mode = 'strict') => {
      const b = board();
      const d = b?.devices.find((x) => x.id === id);
      if (!b || !d) return { ok: false };
      if (d.row === row && d.startModule === start) return { ok: true, id };
      const room = makeRoom(b.devices, capacityOf(b), row, start, d.moduleWidth, mode, id);
      if ('error' in room) return { ok: false, message: room.error };
      get().commitBoard((bb) =>
        setDevices(
          bb,
          room.devices.map((x) => (x.id === id ? { ...x, row, startModule: room.start, mergedWithPrev: false } : x)),
        ),
      );
      return { ok: true, id };
    },

    duplicateDevice: (id) => {
      const b = board();
      const d = b?.devices.find((x) => x.id === id);
      if (!b || !d) return { ok: false };
      const slot = duplicateSlot(b.devices, capacityOf(b), d);
      if (!slot) return { ok: false, message: 'Plus de place pour dupliquer' };
      const copy: PlacedDevice = { ...d, id: createId('dev'), row: slot.row, startModule: slot.start, mergedWithPrev: false, linkedComponents: [] };
      get().commitBoard((bb) => setDevices(bb, [...bb.devices, copy]));
      set({ selection: { kind: 'device', id: copy.id } });
      return { ok: true, id: copy.id };
    },

    removeDevice: (id) => {
      // L'emplacement reste libre : les appareils suivants ne bougent pas
      get().commitBoard((bb) => setDevices(bb, bb.devices.filter((x) => x.id !== id)));
      const sel = get().selection;
      if (sel && 'id' in sel && sel.id === id) set({ selection: null });
      if (get().circuitPromptFor === id) set({ circuitPromptFor: null });
    },

    replaceProduct: (id, productId) => {
      const b = board();
      const d = b?.devices.find((x) => x.id === id);
      const product = getProduct(productId);
      if (!b || !d || !product) return { ok: false };
      if (product.modules !== d.moduleWidth) {
        const check = canPlace(b.devices, capacityOf(b), d.row, d.startModule, product.modules, id);
        if (!check.ok) return { ok: false, message: placeMessage(check) };
      }
      get().commitBoard((bb) =>
        setDevices(
          bb,
          bb.devices.map((x) => (x.id === id ? { ...x, productId, manufacturer: product.brand, moduleWidth: product.modules } : x)),
        ),
      );
      return { ok: true, id };
    },

    resizeDevice: (id, width) => {
      const b = board();
      const d = b?.devices.find((x) => x.id === id);
      const product = d ? getProduct(d.productId) : undefined;
      if (!b || !d || !product) return { ok: false };
      if (product.verified) return { ok: false, message: 'Largeur fixée par la référence du fabricant' };
      const w = Math.round(width * 2) / 2;
      if (w < 0.5) return { ok: false, message: 'Largeur minimale : ½ module' };
      const check = canPlace(b.devices, capacityOf(b), d.row, d.startModule, w, id);
      if (!check.ok) return { ok: false, message: placeMessage(check) };
      get().commitBoard((bb) => setDevices(bb, bb.devices.map((x) => (x.id === id ? { ...x, moduleWidth: w } : x))));
      return { ok: true, id };
    },

    updateDevice: (id, changes, coalesce) =>
      get().commitBoard((bb) => ({ ...bb, devices: bb.devices.map((x) => (x.id === id ? { ...x, ...changes } : x)) }), coalesce),
    updateLabel: (leaderId, changes, coalesce) => get().updateDevice(leaderId, changes, coalesce),

    applyPreset: (id, presetId) => {
      const preset = getPreset(presetId);
      if (!preset) return;
      get().updateDevice(id, { label: preset.name, shortLabel: preset.short, icon: preset.icon });
    },

    reserveSlot: (row, start, width = 1) => {
      const b = board();
      if (!b) return { ok: false };
      const reserve = listDevices(b.brand).find((x) => x.kind === 'reserve');
      if (!reserve) return { ok: false, message: 'Réserve indisponible' };
      const check = canPlace(b.devices, capacityOf(b), row, start, width);
      if (!check.ok) return { ok: false, message: placeMessage(check) };
      const dev = { ...newPlacedDevice(reserve, row, start), moduleWidth: width, label: 'RÉSERVE' };
      get().commitBoard((bb) => setDevices(bb, [...bb.devices, dev]));
      set({ selection: { kind: 'device', id: dev.id } });
      return { ok: true, id: dev.id };
    },

    mergeWithNext: (leaderId) => {
      const d = get().doc;
      if (!d) return { ok: false };
      const zone = zoneOf(d.devices, leaderId, d.labelStyle);
      if (!zone) return { ok: false };
      const next = nextMergeCandidate(d.devices, zone);
      if (!next) return { ok: false, message: 'Aucun appareil contigu à droite' };
      const nextZone = labelZones(d.devices, zone.row, d.labelStyle).find((z) => z.ids.includes(next.id));
      const ids = new Set(nextZone?.ids ?? [next.id]);
      get().commitBoard((bb) => setDevices(bb, bb.devices.map((x) => (ids.has(x.id) ? { ...x, mergedWithPrev: true } : x))));
      return { ok: true };
    },

    splitZone: (leaderId) => {
      const d = get().doc;
      if (!d) return;
      const zone = zoneOf(d.devices, leaderId, d.labelStyle);
      if (!zone || zone.ids.length < 2) return;
      const ids = new Set(zone.ids);
      get().commitBoard((bb) => setDevices(bb, bb.devices.map((x) => (ids.has(x.id) ? { ...x, mergedWithPrev: false } : x))));
    },

    duplicateRow: (row) => {
      const b = board();
      if (!b) return { ok: false };
      const out = duplicateRowPlacement(b.devices, capacityOf(b), row, () => createId('dev'));
      if (!out) return { ok: false, message: 'Aucune rangée vide pour recevoir la copie' };
      get().commitBoard((bb) => ({ ...bb, devices: out }));
      return { ok: true };
    },

    clearRow: (row) => get().commitBoard((bb) => setDevices(bb, bb.devices.filter((x) => x.row !== row))),
    compactRow: (row) => get().commitBoard((bb) => ({ ...bb, devices: compactRow(bb.devices, row) })),

    autoArrange: () => {
      const b = board();
      if (!b) return { ok: false };
      const out = autoArrange(b.devices, capacityOf(b));
      if (!out) return { ok: false, message: 'Les appareils ne tiennent pas dans le tableau' };
      get().commitBoard((bb) => ({ ...bb, devices: out }));
      return { ok: true };
    },

    numberCircuits: () => get().commitBoard((bb) => ({ ...bb, devices: numberCircuits(bb.devices) })),
  };
});

/** Style effectif d'une étiquette. */
export function effectiveStyle(doc: { labelStyle: BoardDoc['labelStyle'] }, d: PlacedDevice): BoardDoc['labelStyle'] {
  return d.labelStyle ?? doc.labelStyle;
}

/** Texte affiché sous l'appareil selon le réglage « nom long / nom court ». */
export function displayLabel(doc: Pick<BoardDoc, 'labelText'>, d: Pick<PlacedDevice, 'label' | 'shortLabel'>): string {
  if (doc.labelText === 'short') return d.shortLabel.trim() || d.label;
  return d.label.trim() || d.shortLabel;
}
