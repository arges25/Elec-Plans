import { create } from 'zustand';
import { usePanelEditor } from '../store/panelEditorStore';
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

interface DragState {
  drag: DragSession | null;
  locator: Locator | null;
  setLocator: (l: Locator | null) => void;
  begin: (s: Omit<DragSession, 'target'>) => void;
  update: (clientX: number, clientY: number) => void;
  /** Termine le glisser ; `commit` pose ou déplace l'appareil si la cible est valide. */
  end: (commit: boolean) => void;
}

export const useDragStore = create<DragState>((set, get) => ({
  drag: null,
  locator: null,
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
    if (!d.target.ok) {
      toast.error(d.target.message || 'Emplacement indisponible');
      return;
    }
    const editor = usePanelEditor.getState();
    const res = d.source === 'library' ? editor.addDevice(d.productId, d.target.row, d.target.start) : editor.moveDevice(d.ignoreId!, d.target.row, d.target.start);
    if (!res.ok && res.message) toast.error(res.message);
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
