import type { PlacedSymbol } from '../../types';
import { getSymbolDefinition } from '../../data/electricalSymbols';
import { useEditorStore } from '../../store/editorStore';
import { getSettings, useSettingsStore } from '../../store/settingsStore';
import { useViewStore } from '../../store/viewStore';
import { toast } from '../../store/toastStore';
import { createId } from '../../utils/id';
import { snapSymbol } from '../../utils/symbols';
import { hapticTick } from './runtime';

/** Toucher d'un symbole selon l'outil actif. Retourne true si l'événement est consommé. */
export function onSymbolActivate(id: string, evt: MouseEvent | TouchEvent): boolean {
  const st = useEditorStore.getState();
  if (st.clientPreview) return false;
  if (st.tool === 'select') {
    const multi = 'shiftKey' in evt && (evt.shiftKey || evt.metaKey || evt.ctrlKey);
    if (multi) st.toggleSelect('symbol', id);
    else st.select('symbol', [id]);
    return true;
  }
  if (st.tool === 'connect') {
    connectTap(id);
    return true;
  }
  return false;
}

export function connectionColor(type: 'command' | 'circuit' | 'information'): string {
  const s = getSettings();
  return type === 'command' ? s.commandColor : type === 'circuit' ? s.circuitColor : s.informationColor;
}

/** Relier : 1er toucher = source, touchers suivants = cibles (la source reste active). */
export function connectTap(id: string): void {
  const st = useEditorStore.getState();
  if (!st.connectSourceId) {
    st.setConnectSource(id);
    return;
  }
  if (st.connectSourceId === id) {
    st.setConnectSource(null);
    return;
  }
  const settings = getSettings();
  const r = st.addConnection(st.connectSourceId, id, { color: connectionColor(st.connectType), width: settings.lineWidth });
  if (r === 'duplicate') toast.info('Ces éléments sont déjà reliés');
  else if (r === 'created') hapticTick(settings.vibration);
}

export function openSymbolProperties(id: string): void {
  const st = useEditorStore.getState();
  if (st.clientPreview || st.tool !== 'select') return;
  st.select('symbol', [id]);
  st.openSheet('properties');
  st.setRightPanel('properties');
}

/** Crée un symbole posé à une position (aimanté au mur si pertinent). */
export function placeSymbolAt(symbolType: string, point: { x: number; y: number }): PlacedSymbol | null {
  const st = useEditorStore.getState();
  if (!st.plan || !st.projectId) return null;
  const settings = getSettings();
  const def = getSymbolDefinition(symbolType);
  const scale = settings.defaultSymbolScale;
  const viewScale = useViewStore.getState().scale;
  let x = point.x;
  let y = point.y;
  let rotation = 0;
  if (settings.snapEnabled) {
    // Au toucher, on accepte une distance un peu plus grande qu'en glisser (doigt moins précis).
    const snap = snapSymbol(def, scale, point, st.doc.walls, (settings.snapDistance * 2) / viewScale);
    if (snap) {
      x = snap.x;
      y = snap.y;
      rotation = snap.rotation;
      hapticTick(settings.vibration);
    } else if (settings.gridEnabled) {
      x = Math.round(x / settings.gridSize) * settings.gridSize;
      y = Math.round(y / settings.gridSize) * settings.gridSize;
    }
  }
  const sym: PlacedSymbol = {
    id: createId('sym'),
    projectId: st.projectId,
    planId: st.plan.id,
    symbolType,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    rotation,
    scale,
    properties: {},
  };
  st.addSymbol(sym);
  useSettingsStore.getState().pushRecent(symbolType);
  return sym;
}

/** « Ajouter au plan » : le symbole apparaît au centre de la vue et est sélectionné. */
export function addSymbolAtCenter(symbolType: string): void {
  const api = useViewStore.getState().api;
  const st = useEditorStore.getState();
  const c = api?.center() ?? { x: (st.plan?.width ?? 1000) / 2, y: (st.plan?.height ?? 800) / 2 };
  const sym = placeSymbolAt(symbolType, c);
  if (sym) {
    useEditorStore.getState().setTool('select');
    useEditorStore.getState().select('symbol', [sym.id]);
  }
}

/** Démarre le mode « placer » (mode répétition : l'outil reste actif jusqu'à TERMINER). */
export function beginPlacing(symbolType: string): void {
  const st = useEditorStore.getState();
  st.startPlacing(symbolType);
  st.openSheet(null);
  st.setRepeat(getSettings().repeatMode);
}
