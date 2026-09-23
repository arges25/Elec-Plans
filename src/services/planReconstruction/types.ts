import type { Door, Wall } from '../../types';

/** Segment brut détecté (pixels de l'image analysée). */
export interface RawSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Épaisseur estimée du trait (pixels), si connue. */
  thickness?: number;
}

export interface ReconstructionOptions {
  /** Sensibilité du seuillage (1 → 30 %) : plus haut = moins de traits retenus. */
  sensitivity: number;
  /** Longueur minimale d'un mur, en fraction du plus petit côté de l'image. */
  minWallRatio: number;
  /** Ne conserver que les murs horizontaux / verticaux (redressés). */
  orthogonalOnly: boolean;
  /** Détecter les ouvertures (portes) dans les murs. */
  detectOpenings: boolean;
}

export const DEFAULT_RECONSTRUCTION_OPTIONS: ReconstructionOptions = {
  sensitivity: 12,
  minWallRatio: 0.06,
  orthogonalOnly: true,
  detectOpenings: true,
};

export type ReconstructionMethod = 'opencv' | 'local' | 'remote';

export interface ReconstructionResult {
  walls: Wall[];
  doors: Door[];
  method: ReconstructionMethod;
  /** Indice de confiance 0 → 1 (heuristique : murs raccordés aux angles). */
  confidence: number;
  rawSegments: number;
  warnings: string[];
}

/** Service de reconstruction croquis → plan (local ou distant). */
export interface PlanReconstructionService {
  id: string;
  label: string;
  isAvailable: () => boolean;
  reconstruct: (
    image: ImageData,
    planSize: { width: number; height: number },
    options: ReconstructionOptions,
    onProgress?: (msg: string) => void,
  ) => Promise<ReconstructionResult>;
}
