import { create } from 'zustand';
import type { Point } from '../types';

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 8;

export interface ViewApi {
  fit: () => void;
  zoomBy: (factor: number) => void;
  setZoom: (scale: number) => void;
  /** Centre de la vue, en coordonnées plan. */
  center: () => Point;
  /** Exporte la vue actuelle en image (aperçu client, partage rapide). */
  toDataUrl: (pixelRatio?: number) => string | null;
  /** Recadre la vue (animation courte) pour montrer une zone du plan si elle sort de l'écran, sans zoomer davantage. */
  reveal?: (bounds: { x1: number; y1: number; x2: number; y2: number }, padding?: Partial<Record<'l' | 'r' | 't' | 'b', number>>) => void;
}

interface ViewState {
  scale: number;
  api: ViewApi | null;
  setScale: (s: number) => void;
  setApi: (api: ViewApi | null) => void;
}

/** État de la vue (zoom) partagé entre le canvas et les contrôles. */
export const useViewStore = create<ViewState>((set) => ({
  scale: 1,
  api: null,
  setScale: (scale) => set({ scale }),
  setApi: (api) => set({ api }),
}));
