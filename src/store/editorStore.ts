import { create } from 'zustand';
import type {
  Annotation,
  ConnectionType,
  Door,
  ElectricalConnection,
  LayerId,
  LayerState,
  Measure,
  PlacedSymbol,
  Plan,
  PlanDocument,
  Room,
  Wall,
  Window,
} from '../types';
import { createId } from '../utils/id';
import { nextCommandGroup } from '../utils/connections';

export type EditorTool =
  | 'select'
  | 'place'
  | 'connect'
  | 'wall'
  | 'door'
  | 'window'
  | 'room'
  | 'text'
  | 'arrow'
  | 'circle'
  | 'rect'
  | 'pen'
  | 'measure'
  | 'scale';

export type SelectionKind = 'symbol' | 'wall' | 'door' | 'window' | 'room' | 'annotation' | 'measure' | 'connection';

export interface Selection {
  kind: SelectionKind;
  ids: string[];
}

export type RightPanel = 'library' | 'properties' | 'layers' | 'legend';

export const HISTORY_LIMIT = 150;

export function emptyDocument(): PlanDocument {
  return { walls: [], doors: [], windows: [], rooms: [], annotations: [], measures: [], symbols: [], connections: [] };
}

interface Clipboard {
  symbols: PlacedSymbol[];
  annotations: Annotation[];
}

interface EditorState {
  projectId: string | null;
  plan: Plan | null;
  doc: PlanDocument;
  past: PlanDocument[];
  future: PlanDocument[];
  /** Document au début d'un geste continu (glisser) : l'historique n'est enregistré qu'à la fin. */
  gestureStart: PlanDocument | null;
  tool: EditorTool;
  placeSymbolId: string | null;
  /** Mode répétition : l'outil reste actif après un placement. */
  repeat: boolean;
  connectType: ConnectionType;
  connectSourceId: string | null;
  selection: Selection | null;
  clientPreview: boolean;
  clipboard: Clipboard | null;
  rightPanel: RightPanel;
  sheet: null | 'library' | 'properties' | 'layers' | 'legend' | 'connection';
  libraryFilter: string;

  load: (plan: Plan, doc: PlanDocument) => void;
  unload: () => void;
  setPlanMeta: (changes: Partial<Plan>) => void;
  setLayer: (id: LayerId, changes: Partial<LayerState>) => void;

  commit: (updater: (doc: PlanDocument) => PlanDocument) => void;
  beginGesture: () => void;
  updateTransient: (updater: (doc: PlanDocument) => PlanDocument) => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;

  setTool: (tool: EditorTool) => void;
  startPlacing: (symbolId: string) => void;
  setRepeat: (repeat: boolean) => void;
  setConnectType: (t: ConnectionType) => void;
  setConnectSource: (id: string | null) => void;
  select: (kind: SelectionKind, ids: string[]) => void;
  toggleSelect: (kind: SelectionKind, id: string) => void;
  clearSelection: () => void;
  setClientPreview: (v: boolean) => void;
  setRightPanel: (p: RightPanel) => void;
  openSheet: (s: EditorState['sheet']) => void;
  setLibraryFilter: (f: string) => void;

  addSymbol: (s: PlacedSymbol) => void;
  updateSymbol: (id: string, changes: Partial<PlacedSymbol>) => void;
  addConnection: (sourceId: string, targetId: string, style: { color: string; width: number }) => 'created' | 'duplicate' | 'invalid';
  updateConnection: (id: string, changes: Partial<ElectricalConnection>) => void;
  deleteSelection: () => void;
  duplicateSelection: (offset?: number) => void;
  rotateSelection: (delta: number) => void;
  copySelection: () => void;
  paste: (offset?: number) => void;
}

function patchById<T extends { id: string }>(list: T[], id: string, changes: Partial<T>): T[] {
  return list.map((x) => (x.id === id ? { ...x, ...changes } : x));
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projectId: null,
  plan: null,
  doc: emptyDocument(),
  past: [],
  future: [],
  gestureStart: null,
  tool: 'select',
  placeSymbolId: null,
  repeat: true,
  connectType: 'command',
  connectSourceId: null,
  selection: null,
  clientPreview: false,
  clipboard: null,
  rightPanel: 'library',
  sheet: null,
  libraryFilter: 'all',

  load: (plan, doc) =>
    set({
      projectId: plan.projectId,
      plan,
      doc,
      past: [],
      future: [],
      gestureStart: null,
      selection: null,
      tool: 'select',
      placeSymbolId: null,
      connectSourceId: null,
      clientPreview: false,
      sheet: null,
    }),
  unload: () => set({ plan: null, projectId: null, doc: emptyDocument(), past: [], future: [], selection: null, gestureStart: null }),
  setPlanMeta: (changes) => {
    const plan = get().plan;
    if (plan) set({ plan: { ...plan, ...changes } });
  },
  setLayer: (id, changes) => {
    const plan = get().plan;
    if (!plan) return;
    const layers = plan.layers.map((l) => (l.id === id ? { ...l, ...changes } : l));
    const sel = get().selection;
    // Désélectionne si la couche devient masquée / verrouillée
    set({ plan: { ...plan, layers }, selection: changes.visible === false || changes.locked ? (sel && layerOfKind(sel.kind) === id ? null : sel) : sel });
  },

  commit: (updater) => {
    const { doc, past } = get();
    const next = updater(doc);
    if (next === doc) return;
    set({ doc: next, past: [...past, doc].slice(-HISTORY_LIMIT), future: [] });
  },
  beginGesture: () => set({ gestureStart: get().doc }),
  updateTransient: (updater) => {
    const next = updater(get().doc);
    if (next !== get().doc) set({ doc: next });
  },
  endGesture: () => {
    const { gestureStart, doc, past } = get();
    if (gestureStart && gestureStart !== doc) set({ past: [...past, gestureStart].slice(-HISTORY_LIMIT), future: [], gestureStart: null });
    else set({ gestureStart: null });
  },
  undo: () => {
    const { past, doc, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future].slice(0, HISTORY_LIMIT), selection: null, connectSourceId: null });
  },
  redo: () => {
    const { past, doc, future } = get();
    if (!future.length) return;
    const [next, ...rest] = future;
    set({ doc: next, past: [...past, doc].slice(-HISTORY_LIMIT), future: rest, selection: null });
  },

  setTool: (tool) =>
    set({
      tool,
      placeSymbolId: tool === 'place' ? get().placeSymbolId : null,
      connectSourceId: null,
      selection: tool === 'select' ? get().selection : null,
    }),
  startPlacing: (symbolId) => set({ tool: 'place', placeSymbolId: symbolId, selection: null, connectSourceId: null }),
  setRepeat: (repeat) => set({ repeat }),
  setConnectType: (connectType) => set({ connectType }),
  setConnectSource: (connectSourceId) => set({ connectSourceId }),
  select: (kind, ids) => set({ selection: ids.length ? { kind, ids } : null }),
  toggleSelect: (kind, id) => {
    const sel = get().selection;
    if (!sel || sel.kind !== kind) return set({ selection: { kind, ids: [id] } });
    const ids = sel.ids.includes(id) ? sel.ids.filter((x) => x !== id) : [...sel.ids, id];
    set({ selection: ids.length ? { kind, ids } : null });
  },
  clearSelection: () => set({ selection: null }),
  setClientPreview: (clientPreview) => set({ clientPreview, selection: null, tool: 'select', placeSymbolId: null, connectSourceId: null }),
  setRightPanel: (rightPanel) => set({ rightPanel }),
  openSheet: (sheet) => set({ sheet }),
  setLibraryFilter: (libraryFilter) => set({ libraryFilter }),

  addSymbol: (s) => get().commit((d) => ({ ...d, symbols: [...d.symbols, s] })),
  updateSymbol: (id, changes) => get().commit((d) => ({ ...d, symbols: patchById(d.symbols, id, changes) })),
  addConnection: (sourceId, targetId, style) => {
    const { doc, plan, projectId, connectType } = get();
    if (!plan || !projectId || sourceId === targetId) return 'invalid';
    const exists = doc.connections.some(
      (c) => (c.sourceId === sourceId && c.targetId === targetId) || (c.sourceId === targetId && c.targetId === sourceId),
    );
    if (exists) return 'duplicate';
    const group = connectType === 'command' ? nextCommandGroup(doc.connections, sourceId, targetId) : undefined;
    const conn: ElectricalConnection = {
      id: createId('lnk'),
      projectId,
      planId: plan.id,
      sourceId,
      targetId,
      type: connectType,
      color: style.color,
      width: style.width,
      dash: connectType === 'circuit' ? 'long' : connectType === 'information' ? 'dot' : 'dash',
      curvature: 0.25,
      group,
      showLabel: connectType === 'command',
    };
    get().commit((d) => ({ ...d, connections: [...d.connections, conn] }));
    return 'created';
  },
  updateConnection: (id, changes) => get().commit((d) => ({ ...d, connections: patchById(d.connections, id, changes) })),

  deleteSelection: () => {
    const sel = get().selection;
    if (!sel) return;
    const ids = new Set(sel.ids);
    get().commit((d) => {
      switch (sel.kind) {
        case 'symbol':
          return {
            ...d,
            symbols: d.symbols.filter((s) => !ids.has(s.id)),
            connections: d.connections.filter((c) => !ids.has(c.sourceId) && !ids.has(c.targetId)),
          };
        case 'wall':
          return {
            ...d,
            walls: d.walls.filter((w) => !ids.has(w.id)),
            doors: d.doors.filter((o) => !ids.has(o.wallId)),
            windows: d.windows.filter((o) => !ids.has(o.wallId)),
          };
        case 'door':
          return { ...d, doors: d.doors.filter((o) => !ids.has(o.id)) };
        case 'window':
          return { ...d, windows: d.windows.filter((o) => !ids.has(o.id)) };
        case 'room':
          return { ...d, rooms: d.rooms.filter((r) => !ids.has(r.id)) };
        case 'annotation':
          return { ...d, annotations: d.annotations.filter((a) => !ids.has(a.id)) };
        case 'measure':
          return { ...d, measures: d.measures.filter((m) => !ids.has(m.id)) };
        case 'connection':
          return { ...d, connections: d.connections.filter((c) => !ids.has(c.id)) };
      }
    });
    set({ selection: null });
  },

  duplicateSelection: (offset = 20) => {
    const sel = get().selection;
    if (!sel) return;
    const ids = new Set(sel.ids);
    const newIds: string[] = [];
    get().commit((d) => {
      if (sel.kind === 'symbol') {
        const copies = d.symbols.filter((s) => ids.has(s.id)).map((s) => {
          const id = createId('sym');
          newIds.push(id);
          return { ...s, id, x: s.x + offset, y: s.y + offset, properties: { ...s.properties } };
        });
        return { ...d, symbols: [...d.symbols, ...copies] };
      }
      if (sel.kind === 'annotation') {
        const copies = d.annotations.filter((a) => ids.has(a.id)).map((a) => {
          const id = createId('ann');
          newIds.push(id);
          return { ...a, id, x: a.x + offset, y: a.y + offset, points: a.points?.map((v) => v + offset) };
        });
        return { ...d, annotations: [...d.annotations, ...copies] };
      }
      if (sel.kind === 'wall') {
        const copies: Wall[] = d.walls.filter((w) => ids.has(w.id)).map((w) => {
          const id = createId('wall');
          newIds.push(id);
          return { ...w, id, x1: w.x1 + offset, y1: w.y1 + offset, x2: w.x2 + offset, y2: w.y2 + offset };
        });
        return { ...d, walls: [...d.walls, ...copies] };
      }
      return d;
    });
    if (newIds.length) set({ selection: { kind: sel.kind, ids: newIds } });
  },

  rotateSelection: (delta) => {
    const sel = get().selection;
    if (!sel || sel.kind !== 'symbol') return;
    const ids = new Set(sel.ids);
    get().commit((d) => ({
      ...d,
      symbols: d.symbols.map((s) => (ids.has(s.id) ? { ...s, rotation: normalizeRot(s.rotation + delta) } : s)),
    }));
  },

  copySelection: () => {
    const { selection, doc } = get();
    if (!selection) return;
    const ids = new Set(selection.ids);
    set({
      clipboard: {
        symbols: selection.kind === 'symbol' ? doc.symbols.filter((s) => ids.has(s.id)) : [],
        annotations: selection.kind === 'annotation' ? doc.annotations.filter((a) => ids.has(a.id)) : [],
      },
    });
  },

  paste: (offset = 24) => {
    const { clipboard, plan, projectId } = get();
    if (!clipboard || !plan || !projectId) return;
    const symbols = clipboard.symbols.map((s) => ({ ...s, id: createId('sym'), planId: plan.id, projectId, x: s.x + offset, y: s.y + offset }));
    const annotations = clipboard.annotations.map((a) => ({ ...a, id: createId('ann'), x: a.x + offset, y: a.y + offset, points: a.points?.map((v) => v + offset) }));
    if (!symbols.length && !annotations.length) return;
    get().commit((d) => ({ ...d, symbols: [...d.symbols, ...symbols], annotations: [...d.annotations, ...annotations] }));
    // Collage successif : décale encore la prochaine fois
    set({
      clipboard: { symbols: symbols.map((s) => ({ ...s })), annotations: annotations.map((a) => ({ ...a })) },
      selection: symbols.length ? { kind: 'symbol', ids: symbols.map((s) => s.id) } : { kind: 'annotation', ids: annotations.map((a) => a.id) },
    });
  },
}));

function normalizeRot(r: number): number {
  let v = r % 360;
  if (v < 0) v += 360;
  return Math.round(v * 100) / 100;
}

export function layerOfKind(kind: SelectionKind): LayerId {
  switch (kind) {
    case 'symbol':
      return 'symbols';
    case 'connection':
      return 'connections';
    case 'annotation':
      return 'annotations';
    case 'measure':
      return 'measures';
    default:
      return 'reconstructed';
  }
}

/* Aides de mise à jour immuable des collections du document */
export const docOps = {
  addWalls: (walls: Wall[]) => (d: PlanDocument) => ({ ...d, walls: [...d.walls, ...walls] }),
  patchWall: (id: string, c: Partial<Wall>) => (d: PlanDocument) => ({ ...d, walls: patchById(d.walls, id, c) }),
  addDoor: (o: Door) => (d: PlanDocument) => ({ ...d, doors: [...d.doors, o] }),
  patchDoor: (id: string, c: Partial<Door>) => (d: PlanDocument) => ({ ...d, doors: patchById(d.doors, id, c) }),
  addWindow: (o: Window) => (d: PlanDocument) => ({ ...d, windows: [...d.windows, o] }),
  patchWindow: (id: string, c: Partial<Window>) => (d: PlanDocument) => ({ ...d, windows: patchById(d.windows, id, c) }),
  addRoom: (r: Room) => (d: PlanDocument) => ({ ...d, rooms: [...d.rooms, r] }),
  patchRoom: (id: string, c: Partial<Room>) => (d: PlanDocument) => ({ ...d, rooms: patchById(d.rooms, id, c) }),
  addAnnotation: (a: Annotation) => (d: PlanDocument) => ({ ...d, annotations: [...d.annotations, a] }),
  patchAnnotation: (id: string, c: Partial<Annotation>) => (d: PlanDocument) => ({ ...d, annotations: patchById(d.annotations, id, c) }),
  addMeasure: (m: Measure) => (d: PlanDocument) => ({ ...d, measures: [...d.measures, m] }),
  patchMeasure: (id: string, c: Partial<Measure>) => (d: PlanDocument) => ({ ...d, measures: patchById(d.measures, id, c) }),
  patchSymbol: (id: string, c: Partial<PlacedSymbol>) => (d: PlanDocument) => ({ ...d, symbols: patchById(d.symbols, id, c) }),
};
