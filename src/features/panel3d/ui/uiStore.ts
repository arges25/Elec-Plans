import { create } from 'zustand';

/** État d'interface du configurateur (fenêtres, recentrage de la vue). */
interface UiState {
  /** Édition directe d'un circuit (repère, nom, icône). */
  quickEdit: { deviceId: string; focus: 'label' | 'ref' } | null;
  /** Demande de recentrage de la vue sur un appareil (liste des circuits, recherche). */
  focusRequest: { deviceId: string; seq: number } | null;
  fullscreen: boolean;
  openQuickEdit: (deviceId: string, focus?: 'label' | 'ref') => void;
  closeQuickEdit: () => void;
  focusDevice: (deviceId: string) => void;
  setFullscreen: (v: boolean) => void;
}

let seq = 0;

export const useUiStore = create<UiState>((set) => ({
  quickEdit: null,
  focusRequest: null,
  fullscreen: false,
  openQuickEdit: (deviceId, focus = 'label') => set({ quickEdit: { deviceId, focus } }),
  closeQuickEdit: () => set({ quickEdit: null }),
  focusDevice: (deviceId) => set({ focusRequest: { deviceId, seq: ++seq } }),
  setFullscreen: (fullscreen) => set({ fullscreen }),
}));
