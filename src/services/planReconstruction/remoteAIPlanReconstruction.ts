import type { PlanReconstructionService } from './types';

/**
 * Service de reconstruction DISTANT (IA) — DÉSACTIVÉ PAR DÉFAUT.
 *
 * Point d'extension pour brancher ultérieurement une API d'IA (analyse de croquis).
 * Tant qu'aucun service n'est configuré et activé explicitement dans les réglages,
 * aucune image ne quitte l'appareil et l'application n'affiche jamais « IA ».
 *
 * Contrat attendu (proposition) : POST {endpoint} avec l'image (PNG) et les options,
 * réponse JSON { walls: Wall[], doors: Door[] } en coordonnées du plan.
 */
export interface RemoteReconstructionConfig {
  enabled: boolean;
  endpoint?: string;
}

let config: RemoteReconstructionConfig = { enabled: false };

export function configureRemoteReconstruction(next: RemoteReconstructionConfig): void {
  config = { ...next };
}

export function isRemoteReconstructionConfigured(): boolean {
  return config.enabled && Boolean(config.endpoint);
}

export const remoteAIPlanReconstruction: PlanReconstructionService = {
  id: 'remote-ai',
  label: 'Service distant (non configuré)',
  isAvailable: () => isRemoteReconstructionConfigured(),
  async reconstruct() {
    if (!isRemoteReconstructionConfigured()) {
      throw new Error('Service de reconstruction distant non configuré (désactivé par défaut).');
    }
    // Volontairement non implémenté : aucune API n'est branchée dans cette version.
    throw new Error('Aucun service distant n’est branché dans cette version de MG Elec & Plans.');
  },
};
