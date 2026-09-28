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

const lastActivations = new Map<string, number>();

/**
 * Sur smartphone / tablette, un même toucher déclenche à la fois « tap » et « click ».
 * Retourne true si l'activation (clé + position) vient d'être traitée : l'événement
 * est alors un doublon du même toucher et doit être ignoré.
 * Un vrai double-toucher (≥ 120 ms d'écart) reste bien pris en compte.
 */
export function isDuplicateActivation(key: string, pointer: { x: number; y: number } | null, windowMs = 120): boolean {
  const k = pointer ? `${key}@${Math.round(pointer.x / 4)},${Math.round(pointer.y / 4)}` : key;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const last = lastActivations.get(k);
  lastActivations.set(k, now);
  if (lastActivations.size > 200) {
    for (const [key2, t] of lastActivations) if (now - t > 2000) lastActivations.delete(key2);
  }
  return last !== undefined && now - last < windowMs;
}
