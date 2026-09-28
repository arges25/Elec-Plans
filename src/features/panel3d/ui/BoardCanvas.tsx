import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Minus, Plus, X } from 'lucide-react';
import { getEnclosure, getProduct } from '../data/catalog';
import { dropTarget, nearestFreeStart } from '../engine/placement';
import { BoardSvg, type DragPreview } from '../render/BoardSvg';
import { SchemaSvg } from '../render/SchemaSvg';
import { capacityOf, placeMessage, usePanelEditor } from '../store/panelEditorStore';
import { placeOrAsk, useDragStore, type DragTarget } from './dragStore';
import { layoutFor, type ViewBox } from './canvasLayouts';
import { useUiStore } from './uiStore';
import { toast } from '../../../store/toastStore';

/**
 * Tableau interactif (vue schéma ou vue coffret, mêmes données) :
 * – un doigt : toucher court = sélection, appui long sur un appareil = déplacement ;
 * – glisser sur le fond ou deux doigts = déplacement de la vue, pincer = zoom ;
 * – molette / boutons +/− : zoom (jamais de déplacement d'appareil).
 * Toucher un repère ou une étiquette ouvre l'édition directe du circuit.
 */

interface Props {
  onDeviceTap?: (id: string) => void;
  onSlotTap?: (row: number, start: number) => void;
  onEmptyTap?: () => void;
}

interface TapTarget {
  deviceId?: string;
  zoneId?: string;
  refId?: string;
  slot?: { row: number; start: number };
}

type Gesture =
  | ({ kind: 'pending'; pointerId: number; pointerType: string; startX: number; startY: number; timer?: number } & TapTarget)
  | { kind: 'pan'; pointerId: number; lastX: number; lastY: number }
  | { kind: 'pinch'; lastDist: number; lastMidX: number; lastMidY: number }
  | { kind: 'drag'; pointerId: number }
  | { kind: 'idle' };

interface PendingTap extends TapTarget {
  clientX: number;
  clientY: number;
  timer: number;
}

const LONG_PRESS_MS = 380;
/** Sans « click » (navigateur atypique), le toucher est traité après ce délai. */
const TAP_FALLBACK_MS = 500;
const TOUCH_SLOP_PX = 9;
const MOUSE_SLOP_PX = 4;

function targetOf(el: Element): TapTarget {
  const deviceId = el.closest('[data-device-id]')?.getAttribute('data-device-id') ?? undefined;
  if (deviceId) return { deviceId };
  const refId = el.closest('[data-ref-id]')?.getAttribute('data-ref-id') ?? undefined;
  if (refId) return { refId };
  const zoneId = el.closest('[data-zone-id]')?.getAttribute('data-zone-id') ?? undefined;
  if (zoneId) return { zoneId };
  const free = el.closest('[data-free-row]');
  if (free) return { slot: { row: Number(free.getAttribute('data-free-row')), start: Number(free.getAttribute('data-free-start')) } };
  return {};
}

export function BoardCanvas({ onDeviceTap, onSlotTap, onEmptyTap }: Props) {
  const doc = usePanelEditor((s) => s.doc)!;
  const selection = usePanelEditor((s) => s.selection);
  const armedId = usePanelEditor((s) => s.armedProductId);
  const moveId = usePanelEditor((s) => s.moveDeviceId);
  const drag = useDragStore((s) => s.drag);
  const focusRequest = useUiStore((s) => s.focusRequest);
  const enclosure = getEnclosure(doc.enclosureId)!;
  const layout = useMemo(() => layoutFor(doc.view, enclosure), [doc.view, enclosure]);
  const fullVb = layout.fullVb;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [vb, setVbState] = useState<ViewBox>(fullVb);
  const vbRef = useRef<ViewBox>(fullVb);
  const setVb = useCallback((v: ViewBox) => {
    vbRef.current = v;
    setVbState(v);
  }, []);
  // Cadrage initial : tout le tableau, ou une vue lisible sur téléphone
  useLayoutEffect(() => {
    const el = wrapRef.current;
    const cw = el?.clientWidth ?? 1000;
    const ch = el?.clientHeight ?? 800;
    setVb(layout.initialVb(cw, ch));
  }, [layout, setVb]);

  const [hover, setHover] = useState<DragTarget | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture>({ kind: 'idle' });
  const pendingTap = useRef<PendingTap | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  /* ---------- Conversions écran ↔ unités du dessin ---------- */
  const scaleAndRect = () => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const v = vbRef.current;
    return { rect, s: Math.min(rect.width / v.w, rect.height / v.h) };
  };
  const toMm = (clientX: number, clientY: number) => {
    const { rect, s } = scaleAndRect();
    const v = vbRef.current;
    return { x: v.x + v.w / 2 + (clientX - (rect.left + rect.width / 2)) / s, y: v.y + v.h / 2 + (clientY - (rect.top + rect.height / 2)) / s };
  };
  const clampVb = (v: ViewBox): ViewBox => {
    const f = layoutRef.current.fullVb;
    const w = Math.min(Math.max(v.w, f.w / 12), f.w * 1.6);
    const h = (v.h / v.w) * w;
    let cx = v.x + v.w / 2;
    let cy = v.y + v.h / 2;
    cx = Math.min(Math.max(cx, f.x), f.x + f.w);
    cy = Math.min(Math.max(cy, f.y), f.y + f.h);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  };
  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    const p = toMm(clientX, clientY);
    const v = vbRef.current;
    const cx = p.x - (p.x - (v.x + v.w / 2)) / factor;
    const cy = p.y - (p.y - (v.y + v.h / 2)) / factor;
    const w = v.w / factor;
    const h = v.h / factor;
    setVb(clampVb({ x: cx - w / 2, y: cy - h / 2, w, h }));
  };
  const panBy = (dxPx: number, dyPx: number) => {
    const { s } = scaleAndRect();
    const v = vbRef.current;
    setVb(clampVb({ ...v, x: v.x - dxPx / s, y: v.y - dyPx / s }));
  };
  const zoomCenter = (factor: number) => {
    const { rect } = scaleAndRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  };

  // Recentrage demandé (liste des circuits, recherche)
  useEffect(() => {
    if (!focusRequest || !wrapRef.current) return;
    const d = docRef.current.devices.find((x) => x.id === focusRequest.deviceId);
    const box = d ? layoutRef.current.deviceBox(d) : null;
    if (!box) return;
    const v = vbRef.current;
    const visible = box.x >= v.x && box.x + box.w <= v.x + v.w && box.y >= v.y && box.y + box.h <= v.y + v.h;
    if (!visible) setVb(clampVb({ ...v, x: box.x + box.w / 2 - v.w / 2, y: box.y + box.h / 2 - v.h / 2 }));
  }, [focusRequest]);

  /* ---------- Cible de dépôt (aimantée sur la grille) ---------- */
  const locate = useCallback((clientX: number, clientY: number, width: number, ignoreId?: string): DragTarget | null => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const p = toMm(clientX, clientY);
    const hit = layoutRef.current.hit(p.x, p.y);
    if (!hit || hit.module < -2 || hit.module > layoutRef.current.modulesPerRow + 2) return null;
    const d = docRef.current;
    const cap = capacityOf(d);
    // Appareils de largeur entière : calés sur le module ; demi-modules : au pas de 0,5
    const wanted = Number.isInteger(width) ? Math.round(hit.module - width / 2) : hit.module - width / 2;
    let t = dropTarget(d.devices, cap, hit.row, wanted, width, ignoreId);
    if (!t.check.ok) {
      // Aimantation vers la place libre la plus proche (≤ 1 module)
      const near = nearestFreeStart(d.devices, cap, hit.row, width, wanted, ignoreId);
      if (near !== null && Math.abs(near - wanted) <= 1) t = dropTarget(d.devices, cap, hit.row, near, width, ignoreId);
    }
    return { row: t.row, start: t.start, ok: t.check.ok, message: placeMessage(t.check), occupied: t.check.reason === 'overlap' || t.check.reason === 'row-full' };
  }, []);
  useEffect(() => {
    useDragStore.getState().setLocator(locate);
    return () => useDragStore.getState().setLocator(null);
  }, [locate]);

  /* ---------- Molette ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || !e.shiftKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)));
      else panBy(-e.deltaY, 0);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* ---------- Poser / déplacer d'un toucher ---------- */
  const placeAt = (clientX: number, clientY: number): boolean => {
    const editor = usePanelEditor.getState();
    if (editor.armedProductId) {
      const product = getProduct(editor.armedProductId);
      if (!product) return true;
      const t = locate(clientX, clientY, product.modules);
      if (!t) return false;
      if (!t.ok && !t.occupied) toast.error(t.message);
      else placeOrAsk({ action: 'add', productId: product.id, row: t.row, start: t.start, width: product.modules });
      return true;
    }
    if (editor.moveDeviceId) {
      const d = docRef.current.devices.find((x) => x.id === editor.moveDeviceId);
      if (!d) return true;
      const t = locate(clientX, clientY, d.moduleWidth, d.id);
      if (!t) return false;
      if (!t.ok && !t.occupied) toast.error(t.message);
      else placeOrAsk({ action: 'move', productId: d.productId, deviceId: d.id, row: t.row, start: t.start, width: d.moduleWidth });
      return true;
    }
    return false;
  };

  const startDeviceDrag = (deviceId: string, pointerId: number, clientX: number, clientY: number) => {
    const d = docRef.current.devices.find((x) => x.id === deviceId);
    if (!d) return;
    navigator.vibrate?.(12);
    gesture.current = { kind: 'drag', pointerId };
    usePanelEditor.getState().select({ kind: 'device', id: d.id });
    useDragStore.getState().begin({ productId: d.productId, width: d.moduleWidth, ignoreId: d.id, source: 'board', clientX, clientY });
  };

  const cancelPending = () => {
    const g = gesture.current;
    if (g.kind === 'pending' && g.timer) window.clearTimeout(g.timer);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    wrapRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      cancelPending();
      if (gesture.current.kind === 'drag') useDragStore.getState().end(false);
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', lastDist: Math.hypot(a.x - b.x, a.y - b.y), lastMidX: (a.x + b.x) / 2, lastMidY: (a.y + b.y) / 2 };
      return;
    }
    if (pointers.current.size > 2) return;
    const target = targetOf(e.target as Element);
    const g: Gesture = { kind: 'pending', pointerId: e.pointerId, pointerType: e.pointerType, startX: e.clientX, startY: e.clientY, ...target };
    if (target.deviceId && e.pointerType !== 'mouse') {
      const { pointerId, clientX, clientY } = e;
      const deviceId = target.deviceId;
      g.timer = window.setTimeout(() => {
        if (gesture.current === g) startDeviceDrag(deviceId, pointerId, clientX, clientY);
      }, LONG_PRESS_MS);
    }
    gesture.current = g;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Survol souris : silhouette de l'appareil à poser / déplacer
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      const editor = usePanelEditor.getState();
      const width = editor.armedProductId
        ? getProduct(editor.armedProductId)?.modules
        : editor.moveDeviceId
          ? docRef.current.devices.find((d) => d.id === editor.moveDeviceId)?.moduleWidth
          : undefined;
      setHover(width ? locate(e.clientX, e.clientY, width, editor.moveDeviceId ?? undefined) : null);
      return;
    }
    if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      if (g.lastDist > 0) zoomAt(midX, midY, dist / g.lastDist);
      panBy(midX - g.lastMidX, midY - g.lastMidY);
      gesture.current = { kind: 'pinch', lastDist: dist, lastMidX: midX, lastMidY: midY };
      return;
    }
    if (g.kind === 'pending' && g.pointerId === e.pointerId) {
      const dist = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
      if (g.deviceId && g.pointerType === 'mouse' && dist > MOUSE_SLOP_PX) {
        startDeviceDrag(g.deviceId, e.pointerId, e.clientX, e.clientY);
        return;
      }
      if (dist > (g.pointerType === 'mouse' ? MOUSE_SLOP_PX : TOUCH_SLOP_PX)) {
        // Le doigt a bougé avant l'appui long : c'est un déplacement de la vue
        cancelPending();
        gesture.current = { kind: 'pan', pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
        panBy(e.clientX - g.startX, e.clientY - g.startY);
      }
      return;
    }
    if (g.kind === 'pan' && g.pointerId === e.pointerId) {
      panBy(e.clientX - g.lastX, e.clientY - g.lastY);
      gesture.current = { ...g, lastX: e.clientX, lastY: e.clientY };
      return;
    }
    if (g.kind === 'drag' && g.pointerId === e.pointerId) useDragStore.getState().update(e.clientX, e.clientY);
  };

  const runTap = (tap: PendingTap) => {
    if (pendingTap.current !== tap) return;
    pendingTap.current = null;
    window.clearTimeout(tap.timer);
    if (placeAt(tap.clientX, tap.clientY)) return;
    const editor = usePanelEditor.getState();
    const ui = useUiStore.getState();
    if (tap.deviceId) {
      editor.select({ kind: 'device', id: tap.deviceId });
      onDeviceTap?.(tap.deviceId);
    } else if (tap.refId) {
      editor.select({ kind: 'device', id: tap.refId });
      ui.openQuickEdit(tap.refId, 'ref');
    } else if (tap.zoneId) {
      editor.select({ kind: 'device', id: tap.zoneId });
      ui.openQuickEdit(tap.zoneId, 'label');
    } else if (tap.slot) {
      editor.select({ kind: 'slot', row: tap.slot.row, start: tap.slot.start });
      onSlotTap?.(tap.slot.row, tap.slot.start);
    } else {
      editor.select(null);
      onEmptyTap?.();
    }
  };

  const release = (e: React.PointerEvent, commit: boolean) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.kind === 'pinch') {
      // Le doigt restant ne fait rien jusqu'au relâchement
      gesture.current = { kind: 'idle' };
      return;
    }
    if (g.kind === 'drag' && g.pointerId === e.pointerId) {
      gesture.current = { kind: 'idle' };
      if (commit) useDragStore.getState().update(e.clientX, e.clientY);
      useDragStore.getState().end(commit);
      return;
    }
    if (g.kind === 'pending' && g.pointerId === e.pointerId) {
      cancelPending();
      gesture.current = { kind: 'idle' };
      if (!commit) return;
      // Le toucher est traité sur l'événement « click » qui suit : sinon ce click
      // tomberait sur le panneau qui vient de s'ouvrir sous le doigt.
      const tap: PendingTap = { deviceId: g.deviceId, zoneId: g.zoneId, refId: g.refId, slot: g.slot, clientX: e.clientX, clientY: e.clientY, timer: 0 };
      tap.timer = window.setTimeout(() => runTap(tap), TAP_FALLBACK_MS);
      pendingTap.current = tap;
      return;
    }
    if (g.kind === 'pan' && g.pointerId === e.pointerId) gesture.current = { kind: 'idle' };
  };

  useEffect(
    () => () => {
      cancelPending();
      if (pendingTap.current) window.clearTimeout(pendingTap.current.timer);
    },
    [],
  );

  // Silhouette : glisser en cours, sinon survol en mode « poser » / « déplacer »
  const armedProduct = armedId ? getProduct(armedId) : undefined;
  const movingDevice = moveId ? doc.devices.find((d) => d.id === moveId) : undefined;
  let preview: DragPreview | null = null;
  if (drag) preview = { productId: drag.productId, width: drag.width, ignoreId: drag.ignoreId, target: drag.target };
  else if (armedProduct) preview = { productId: armedProduct.id, width: armedProduct.modules, target: hover };
  else if (movingDevice) preview = { productId: movingDevice.productId, width: movingDevice.moduleWidth, ignoreId: movingDevice.id, target: hover };

  const bannerText = armedProduct
    ? `Touchez un emplacement libre pour poser : ${armedProduct.shortName}`
    : movingDevice
      ? `Touchez le nouvel emplacement de ${getProduct(movingDevice.productId)?.shortName ?? 'l’appareil'}`
      : null;

  const common = {
    uid: 'edit',
    selection,
    drag: preview,
    movingId: drag?.ignoreId ?? moveId,
    interactive: true,
    viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`,
    width: '100%',
    height: '100%',
    className: 'block h-full w-full',
  };

  return (
    <div className={`relative h-full w-full overflow-hidden ${doc.view === 'schema' ? 'bg-slate-100' : 'bg-gradient-to-b from-slate-100 to-slate-200'}`}>
      <div
        ref={wrapRef}
        data-testid="board-canvas"
        data-view={doc.view}
        className="absolute inset-0"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => release(e, true)}
        onPointerCancel={(e) => release(e, false)}
        onPointerLeave={() => setHover(null)}
        onClick={() => {
          if (pendingTap.current) runTap(pendingTap.current);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {doc.view === 'schema' ? <SchemaSvg doc={doc} enclosure={enclosure} {...common} /> : <BoardSvg doc={doc} enclosure={enclosure} {...common} />}
      </div>

      {bannerText && (
        <div className="absolute inset-x-2 top-2 z-10 flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-lg" role="status">
          <span className="min-w-0 flex-1">{bannerText}</span>
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-white/15 px-2.5 hover:bg-white/25"
            onClick={() => {
              usePanelEditor.getState().arm(null);
              usePanelEditor.getState().setMoveDevice(null);
            }}
          >
            <X className="size-4" aria-hidden /> Terminer
          </button>
        </div>
      )}

      <div className="absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
        <button type="button" aria-label="Zoom avant" title="Zoom avant" className="flex size-11 items-center justify-center hover:bg-slate-50" onClick={() => zoomCenter(1.3)}>
          <Plus className="size-5" aria-hidden />
        </button>
        <button type="button" aria-label="Zoom arrière" title="Zoom arrière" className="flex size-11 items-center justify-center border-t border-slate-100 hover:bg-slate-50" onClick={() => zoomCenter(1 / 1.3)}>
          <Minus className="size-5" aria-hidden />
        </button>
        <button type="button" aria-label="Voir tout le tableau" title="Voir tout le tableau" className="flex size-11 items-center justify-center border-t border-slate-100 hover:bg-slate-50" onClick={() => setVb(fullVb)}>
          <Maximize className="size-4.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
