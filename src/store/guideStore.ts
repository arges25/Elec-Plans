import { create } from 'zustand';

/** Repères d'alignement affichés pendant un déplacement. */
interface GuideState {
  guides: { x?: number; y?: number } | null;
  setGuides: (g: { x?: number; y?: number } | null) => void;
}

export const useGuideStore = create<GuideState>((set, get) => ({
  guides: null,
  setGuides: (guides) => {
    const cur = get().guides;
    if (cur === guides || (cur && guides && cur.x === guides.x && cur.y === guides.y)) return;
    set({ guides });
  },
}));
