import type Konva from 'konva';

/**
 * État d'exécution mutable de l'éditeur (hors React) : utilisé pour les gestes
 * fréquents (glisser, pincer) sans provoquer de rendus inutiles.
 */
export const editorRuntime = {
  draggingNode: null as Konva.Node | null,
  pinching: false,
  lastVibrate: 0,
};

export function stopActiveDrag(): void {
  const n = editorRuntime.draggingNode;
  if (n && n.isDragging()) n.stopDrag();
  editorRuntime.draggingNode = null;
}

/** Retour haptique (si disponible) lors d'un aimantation. */
export function hapticTick(enabled: boolean): void {
  if (!enabled) return;
  const now = Date.now();
  if (now - editorRuntime.lastVibrate < 250) return;
  editorRuntime.lastVibrate = now;
  try {
    navigator.vibrate?.(20);
  } catch {
    /* non disponible */
  }
}
