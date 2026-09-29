import { create } from 'zustand';
import { conflictOptions } from '../engine/boardOps';
import { capacityOf, usePanelEditor, type PlaceMode } from '../store/panelEditorStore';
import { toast } from '../../../store/toastStore';

/**
 * Glisser-déposer partagé entre la bibliothèque et le tableau :
 * silhouette qui suit le doigt, cible « aimantée » sur la grille du rail.
 */

export interface DragTarget {
  row: number;
  start: number;
  ok: boolean;
  message: string;
  /** L'emplacement est occupé (proposer « Décaler » / « Remplacer »). */
  occupied: boolean;
}

export type Locator = (clientX: number, clientY: number, width: number, ignoreId?: string) => DragTarget | null;

export interface DragSession {
  productId: string;
  width: number;
  /** Appareil déplacé (source « board »). */
  ignoreId?: string;
  source: 'library' | 'board';
  clientX: number;
  clientY: number;
  target: DragTarget | null;
}

/** Pose / déplacement en attente d'un choix (emplacement occupé). */
export interface PlaceConflict {
  action: 'add' | 'move';
  productId: string;
  deviceId?: string;
  row: number;
  start: number;
  width: number;
  canShift: boolean;
  canReplace: boolean;
}

interface DragState {
  drag: DragSession | null;
  locator: Locator | null;
  conflict: PlaceConflict | null;
  setLocator: (l: Locator | null) => void;
  begin: (s: Omit<DragSession, 'target'>) => void;
  update: (clientX: number, clientY: number) => void;
  /** Termine le glisser ; `commit` pose ou déplace l'appareil si la cible est valide. */
  end: (commit: boolean) => void;
  resolveConflict: (mode: PlaceMode | null) => void;
}

/**
 * Pose (bibliothèque) ou déplacement (tableau) à un emplacement : si l'emplacement
 * est occupé et qu'une solution existe, le choix est demandé à l'utilisateur.
 */
export function placeOrAsk(p: Omit<PlaceConflict, 'canShift' | 'canReplace'>): boolean {
  const editor = usePanelEditor.getState();
  const doc = editor.doc;
  if (!doc) return false;
  const res = p.action === 'add' ? editor.addDevice(p.productId, p.row, p.start) : editor.moveDevice(p.deviceId!, p.row, p.start);
  if (res.ok) {
    if (p.action === 'move') editor.setMoveDevice(null);
    return true;
  }
  const opts = conflictOptions(doc.devices, capacityOf(doc), p.row, p.start, p.width, p.deviceId);
  if (opts.canShift || opts.canReplace) {
    useDragStore.setState({ conflict: { ...p, canShift: opts.canShift, canReplace: opts.canReplace } });
    return false;
  }
  toast.error(res.message || 'Emplacement indisponible');
  return false;
}

export const useDragStore = create<DragState>((set, get) => ({
  drag: null,
  locator: null,
  conflict: null,
  setLocator: (locator) => set({ locator }),
  begin: (s) => {
    const target = get().locator?.(s.clientX, s.clientY, s.width, s.ignoreId) ?? null;
    set({ drag: { ...s, target } });
  },
  update: (clientX, clientY) => {
    const d = get().drag;
    if (!d) return;
    const target = get().locator?.(clientX, clientY, d.width, d.ignoreId) ?? null;
    set({ drag: { ...d, clientX, clientY, target } });
  },
  end: (commit) => {
    const d = get().drag;
    set({ drag: null });
    if (!d || !commit || !d.target) return;
    const t = d.target;
    if (!t.ok && !t.occupied) {
      toast.error(t.message || 'Emplacement indisponible');
      return;
    }
    placeOrAsk({ action: d.source === 'library' ? 'add' : 'move', productId: d.productId, deviceId: d.ignoreId, row: t.row, start: t.start, width: d.width });
  },
  resolveConflict: (mode) => {
    const c = get().conflict;
    set({ conflict: null });
    if (!c || !mode) return;
    const editor = usePanelEditor.getState();
    const res = c.action === 'add' ? editor.addDevice(c.productId, c.row, c.start, mode) : editor.moveDevice(c.deviceId!, c.row, c.start, mode);
    if (!res.ok) toast.error(res.message || 'Placement impossible');
    else if (c.action === 'move') editor.setMoveDevice(null);
  },
}));

/** Empêche le défilement de la page pendant un glisser tactile. */
function blockTouchScroll(e: TouchEvent) {
  e.preventDefault();
}

/**
 * Suit le pointeur au niveau de la fenêtre jusqu'au relâchement
 * (le glisser peut partir de la bibliothèque et finir sur le tableau).
 */
export function trackDragOnWindow(pointerId: number): void {
  const { update, end } = useDragStore.getState();
  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    update(e.clientX, e.clientY);
  };
  const finish = (commit: boolean) => (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    document.removeEventListener('touchmove', blockTouchScroll);
    if (commit) update(e.clientX, e.clientY);
    end(commit);
  };
  const up = finish(true);
  const cancel = finish(false);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  document.addEventListener('touchmove', blockTouchScroll, { passive: false });
}
