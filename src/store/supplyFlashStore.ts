import { create } from 'zustand';
import type { CircuitKind } from '../types';
import type { SupplyInfo } from '../utils/supplyPath';

/** Case du mini-tableau affiché dans la carte « Alimentation ». */
export interface MiniPanelCell {
  id: string;
  number: string;
  kind: CircuitKind;
  modules: number;
  name: string;
  /** Circuit de l'élément : illuminé. */
  active: boolean;
}

export interface MiniPanelRow {
  id: string;
  name: string;
  cells: MiniPanelCell[];
}

/**
 * Résultat de la recherche d'alimentation :
 *  - `path`       : chemin « Relier » réel jusqu'au tableau ;
 *  - `indicative` : pas de liaison jusqu'au tableau, tracé indicatif à travers le circuit ;
 *  - `circuit`    : circuit connu mais pas de tableau sur ce plan (éléments du circuit illuminés) ;
 *  - `none`       : l'élément n'est relié à aucun circuit.
 */
export type SupplyStatus = 'path' | 'indicative' | 'circuit' | 'none';

export interface SupplyFlash {
  /** Change à chaque affichage : relance l'animation. */
  key: number;
  symbolId: string;
  info: SupplyInfo;
  status: SupplyStatus;
  /** Liaisons à faire clignoter (statut `path`). */
  connectionIds: string[];
  /** Symboles du tracé indicatif, du tableau vers l'élément (statut `indicative`). */
  chainIds: string[];
  /** Symbole du tableau sur ce plan (illuminé). */
  panelSymbolId: string | null;
  /** Autres éléments du même circuit sur ce plan (halo léger). */
  memberIds: string[];
  /** « Circuit 3 – Prises salon – 2,5 mm² – 16 A » (null si aucun circuit). */
  circuitLabel: string | null;
  /** Étiquette courte affichée sur le plan, près du tableau : « Circuit 3 · 16 A ». */
  planTag: string | null;
  /** Explication courte affichée sous l'étiquette. */
  note: string;
  /** Rangées du tableau du projet, avec le circuit concerné illuminé. */
  panelRows: MiniPanelRow[];
}

interface SupplyFlashState {
  flash: SupplyFlash | null;
  show: (flash: Omit<SupplyFlash, 'key'>) => void;
  replay: () => void;
  clear: () => void;
}

let counter = 0;

/** Mise en évidence temporaire de l'alimentation d'un élément (rien n'est enregistré dans le plan). */
export const useSupplyFlashStore = create<SupplyFlashState>((set, get) => ({
  flash: null,
  show: (flash) => set({ flash: { ...flash, key: ++counter } }),
  replay: () => {
    const f = get().flash;
    if (f) set({ flash: { ...f, key: ++counter } });
  },
  clear: () => {
    if (get().flash) set({ flash: null });
  },
}));
