import type { LedStrip } from '../../types';
import { docOps, useEditorStore } from '../../store/editorStore';
import { useLedDraftStore } from '../../store/ledDraftStore';
import { getSettings } from '../../store/settingsStore';
import { toast } from '../../store/toastStore';
import { createId } from '../../utils/id';
import { LED_DEFAULT_COLOR, cleanLedPoints, toFlat, toPoints } from '../../utils/ledStrip';

/** Épaisseur par défaut d'une bande LED (proportionnelle à la taille des symboles). */
export function defaultLedWidth(): number {
  return Math.max(2, 7 * getSettings().defaultSymbolScale);
}

/** Active l'outil Bande LED (optionnellement pour prolonger une bande existante). */
export function startLedTool(extendId?: string): void {
  const st = useEditorStore.getState();
  const strip = extendId ? st.doc.ledStrips.find((l) => l.id === extendId) : undefined;
  st.setTool('led');
  st.openSheet(null);
  if (strip) useLedDraftStore.getState().start(toPoints(strip.points), strip.id);
  else useLedDraftStore.getState().reset();
}

/**
 * Enregistre le tracé en cours. `close` ferme le contour (retour au départ).
 * Retourne l'identifiant de la bande créée / prolongée, ou null si le tracé est trop court.
 */
export function commitLedDraft(options: { close?: boolean; minDist?: number } = {}): string | null {
  const draft = useLedDraftStore.getState();
  const st = useEditorStore.getState();
  const pts = cleanLedPoints(draft.points, options.minDist ?? 0.5);
  // Point final identique au départ : contour fermé
  let close = Boolean(options.close);
  if (pts.length > 3 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.5) {
    pts.pop();
    close = true;
  }
  useLedDraftStore.getState().reset();
  if (pts.length < 2 || (close && pts.length < 3)) {
    if (draft.points.length) toast.info('Tracé trop court : touchez au moins deux points');
    return null;
  }
  const existing = draft.extendId ? st.doc.ledStrips.find((l) => l.id === draft.extendId) : undefined;
  if (existing) {
    st.commit(docOps.patchLedStrip(existing.id, { points: toFlat(pts), closed: close || existing.closed }));
    return existing.id;
  }
  const strip: LedStrip = { id: createId('led'), points: toFlat(pts), closed: close, color: LED_DEFAULT_COLOR, width: defaultLedWidth() };
  st.commit(docOps.addLedStrip(strip));
  return strip.id;
}

/** Bouton TERMINER : enregistre le tracé puis sélectionne la bande (poignées d'édition visibles). */
export function finishLedTool(options: { close?: boolean } = {}): void {
  const id = commitLedDraft(options);
  const st = useEditorStore.getState();
  st.setTool('select');
  if (id) st.select('led', [id]);
}

/** Retire le dernier point posé. */
export function undoLedPoint(): void {
  const d = useLedDraftStore.getState();
  if (!d.points.length) return;
  d.setPoints(d.points.slice(0, -1));
  d.setCursor(null);
}
