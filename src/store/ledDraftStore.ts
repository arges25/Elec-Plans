import { create } from 'zustand';
import type { Point } from '../types';

/** Tracé de bande LED en cours (partagé entre le canevas et la barre d'outil). */
interface LedDraftState {
  points: Point[];
  /** Position du doigt pendant le tracé du segment suivant. */
  cursor: Point | null;
  /** Bande existante en cours de prolongement. */
  extendId: string | null;
  setPoints: (points: Point[]) => void;
  setCursor: (cursor: Point | null) => void;
  start: (points: Point[], extendId?: string | null) => void;
  reset: () => void;
}

export const useLedDraftStore = create<LedDraftState>((set) => ({
  points: [],
  cursor: null,
  extendId: null,
  setPoints: (points) => set({ points }),
  setCursor: (cursor) => set({ cursor }),
  start: (points, extendId = null) => set({ points, cursor: null, extendId }),
  reset: () => set({ points: [], cursor: null, extendId: null }),
}));
