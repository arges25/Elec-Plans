import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Group, Image as KonvaImage, Layer, Rect, Shape, Stage } from 'react-konva';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Annotation, Door, Point, Room, Wall, Window } from '../../types';
import { docOps, useEditorStore } from '../../store/editorStore';
import { useSettingsStore } from '../../store/settingsStore';
import { MAX_ZOOM, MIN_ZOOM, useViewStore } from '../../store/viewStore';
import { promptDialog } from '../../store/dialogStore';
import { toast } from '../../store/toastStore';
import { useHtmlImage } from '../../hooks/useHtmlImage';
import { createId } from '../../utils/id';
import { distance, nearestWall, nearestWallEndpoint, projectPointOnSegment, snapSegmentEnd, snapToGrid, wallEnd, wallStart } from '../../utils/geometry';
import { clampOpeningT } from '../../utils/openings';
import { parseMeters, formatMeters } from '../../utils/format';
import { AnnotationNode, ConnectionLine, DoorShape, MeasureNode, RoomLabel, WallShape, WindowShape } from './konva/PlanLayers';
import { SymbolLabel, SymbolNode } from './konva/SymbolsLayer';
import { DraftPreview, Guides, OpeningHandle, SelectionTransformer, WallHandles, type Draft } from './konva/Overlay';
import { editorRuntime, stopActiveDrag } from './runtime';
import { placeSymbolAt } from './editorActions';

Konva.hitOnDragEnabled = true;
Konva.dragDistance = 4;

const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

/** Épaisseur de mur par défaut (≈ 12 cm si l'échelle est connue). */
function defaultWallThickness(planW: number, planH: number, ppm?: number): number {
  return ppm ? Math.max(4, 0.12 * ppm) : Math.max(8, Math.round(Math.max(planW, planH) / 140));
}

/**
 * Canevas de l'éditeur de plan (React-Konva).
 * 1 doigt : sélection / déplacement — 2 doigts : zoom (pincer) et déplacement du plan.
 */
export function PlanStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 300, h: 300 });
  const [zoom, setZoomState] = useState(1);
  const [draft, setDraftState] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const setDraft = useCallback((d: Draft | null) => {
    draftRef.current = d;
    setDraftState(d);
  }, []);
  const pointerDown = useRef(false);
  const pinch = useRef<{ dist: number; center: Point } | null>(null);
  const fitted = useRef<string | null>(null);

  const plan = useEditorStore((s) => s.plan);
  const doc = useEditorStore((s) => s.doc);
  const tool = useEditorStore((s) => s.tool);
  const selection = useEditorStore((s) => s.selection);
  const clientPreview = useEditorStore((s) => s.clientPreview);
  const connectSourceId = useEditorStore((s) => s.connectSourceId);
  const settings = useSettingsStore((s) => s.settings);
  const setScale = useViewStore((s) => s.setScale);
  const setApi = useViewStore((s) => s.setApi);

  const bgSrc = plan?.processedImage ?? plan?.originalImage;
  const bgImage = useHtmlImage(bgSrc);
  const planW = plan?.width ?? 2000;
  const planH = plan?.height ?? 1400;
  const ppm = doc.scale?.pixelsPerMeter;
  const wallThickness = defaultWallThickness(planW, planH, ppm);
  const baseFont = Math.max(14, Math.round(Math.max(planW, planH) / 80));

  const layer = useCallback((id: string) => plan?.layers.find((l) => l.id === id) ?? { id, visible: true, locked: false }, [plan?.layers]);
  const L = {
    original: layer('original'),
    reconstructed: layer('reconstructed'),
    symbols: layer('symbols'),
    connections: layer('connections'),
    annotations: layer('annotations'),
    measures: layer('measures'),
  };

  /* ---------------- Taille du conteneur ---------------- */
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* ---------------- Vue (zoom / position) ---------------- */
  const syncView = useCallback(() => {
    const s = stageRef.current?.scaleX() ?? 1;
    setZoomState(s);
    setScale(s);
  }, [setScale]);

  const applyZoom = useCallback(
    (newScale: number, around?: Point) => {
      const stage = stageRef.current;
      if (!stage) return;
      const old = stage.scaleX();
      const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
      const p = around ?? { x: stage.width() / 2, y: stage.height() / 2 };
      const world = { x: (p.x - stage.x()) / old, y: (p.y - stage.y()) / old };
      stage.scale({ x: s, y: s });
      stage.position({ x: p.x - world.x * s, y: p.y - world.y * s });
      stage.batchDraw();
      syncView();
    },
    [syncView],
  );

  const fit = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const pad = 24;
    const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min((stage.width() - pad * 2) / planW, (stage.height() - pad * 2) / planH)));
    stage.scale({ x: s, y: s });
    stage.position({ x: (stage.width() - planW * s) / 2, y: (stage.height() - planH * s) / 2 });
    stage.batchDraw();
    syncView();
  }, [planW, planH, syncView]);

  useEffect(() => {
    setApi({
      fit,
      zoomBy: (f) => applyZoom((stageRef.current?.scaleX() ?? 1) * f),
      setZoom: (s) => applyZoom(s),
      center: () => {
        const st = stageRef.current;
        if (!st) return { x: planW / 2, y: planH / 2 };
        return { x: (st.width() / 2 - st.x()) / st.scaleX(), y: (st.height() / 2 - st.y()) / st.scaleX() };
      },
      toDataUrl: (pixelRatio = 2) => stageRef.current?.toDataURL({ pixelRatio }) ?? null,
    });
    return () => setApi(null);
  }, [fit, applyZoom, setApi, planW, planH]);

  useEffect(() => {
    if (!plan || size.w < 50) return;
    const key = `${plan.id}:${planW}x${planH}`;
    if (fitted.current !== key) {
      fitted.current = key;
      requestAnimationFrame(fit);
    }
  }, [plan, size.w, planW, planH, fit]);

  /* ---------------- Molette / pincement ---------------- */
  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition() ?? undefined;
    if (e.evt.shiftKey && !e.evt.ctrlKey) {
      stage.x(stage.x() - e.evt.deltaY);
      stage.batchDraw();
      return;
    }
    const factor = e.evt.ctrlKey ? Math.exp(-e.evt.deltaY * 0.01) : e.evt.deltaY > 0 ? 1 / 1.12 : 1.12;
    applyZoom(stage.scaleX() * factor, pointer);
  };

  const touchPoint = (t: Touch): Point => {
    const r = stageRef.current!.container().getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };

  const onTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length !== 2) return;
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    if (!editorRuntime.pinching) {
      editorRuntime.pinching = true;
      stopActiveDrag();
      if (stage.isDragging()) stage.stopDrag();
      pointerDown.current = false;
      const d = draftRef.current;
      if (d && (d.kind === 'pen' || d.kind === 'rect' || d.kind === 'circle' || d.kind === 'arrow' || d.kind === 'room')) setDraft(null);
    }
    const p1 = touchPoint(touches[0]);
    const p2 = touchPoint(touches[1]);
    const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (!pinch.current) {
      pinch.current = { dist, center };
      return;
    }
    const old = stage.scaleX();
    const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, old * (dist / pinch.current.dist)));
    const world = { x: (pinch.current.center.x - stage.x()) / old, y: (pinch.current.center.y - stage.y()) / old };
    stage.scale({ x: s, y: s });
    stage.position({ x: center.x - world.x * s, y: center.y - world.y * s });
    stage.batchDraw();
    pinch.current = { dist, center };
  };

  const onTouchEnd = (e: KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length < 2 && pinch.current) {
      pinch.current = null;
      syncView();
      // Laisse passer le « tap » fantôme de fin de pincement
      setTimeout(() => {
        editorRuntime.pinching = false;
      }, 80);
    }
  };

  /* ---------------- Outils ---------------- */
  const worldPointer = (): Point | null => stageRef.current?.getRelativePointerPosition() ?? null;

  const snapWallPoint = (p: Point, from?: Point): Point => {
    const r = 14 / zoom;
    const ep = nearestWallEndpoint(p, doc.walls, r);
    if (ep) return ep;
    let q = from ? snapSegmentEnd(from, p, 7) : p;
    if (settings.gridEnabled) q = snapToGrid(q, settings.gridSize);
    const nw = nearestWall(q, doc.walls, r * 0.7);
    if (nw) return projectPointOnSegment(q, wallStart(nw.wall), wallEnd(nw.wall)).point;
    return q;
  };

  // Termine le tracé en cours quand on change d'outil
  useEffect(() => {
    setDraft(null);
  }, [tool, setDraft]);

  const onPointerDown = () => {
    if (clientPreview || editorRuntime.pinching) return;
    const p = worldPointer();
    if (!p) return;
    pointerDown.current = true;
    if (tool === 'rect' || tool === 'circle' || tool === 'arrow' || tool === 'room') setDraft({ kind: tool, start: p, end: p });
    else if (tool === 'pen') setDraft({ kind: 'pen', points: [p.x, p.y] });
  };

  const onPointerMove = () => {
    if (clientPreview || editorRuntime.pinching) return;
    const d = draftRef.current;
    if (!d) return;
    const p = worldPointer();
    if (!p) return;
    if (d.kind === 'wall') {
      const last = d.points[d.points.length - 1];
      setDraft({ ...d, cursor: snapWallPoint(p, last) });
    } else if (d.kind === 'measure' || d.kind === 'scale') {
      setDraft({ ...d, cursor: p });
    } else if (pointerDown.current) {
      if (d.kind === 'pen') {
        const n = d.points.length;
        if (Math.hypot(p.x - d.points[n - 2], p.y - d.points[n - 1]) >= 2 / zoom) setDraft({ ...d, points: [...d.points, p.x, p.y] });
      } else if (d.kind === 'rect' || d.kind === 'circle' || d.kind === 'arrow' || d.kind === 'room') {
        setDraft({ ...d, end: p });
      }
    }
  };

  const commitAnnotation = (a: Omit<Annotation, 'id'>) => {
    const ann: Annotation = { id: createId('ann'), ...a };
    useEditorStore.getState().commit(docOps.addAnnotation(ann));
  };

  const createRoom = async (start: Point, end: Point) => {
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    const name = await promptDialog({ title: 'Nom de la pièce', label: 'Nom', placeholder: 'Salon, Cuisine, Chambre…', defaultValue: 'Pièce' });
    if (name === null) return;
    const st = useEditorStore.getState();
    const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const room: Room = { id: createId('room'), name: name.trim() || 'Pièce', x: center.x, y: center.y };
    if (w > 40 / zoom && h > 40 / zoom) {
      const x0 = Math.min(start.x, end.x);
      const y0 = Math.min(start.y, end.y);
      const x1 = x0 + w;
      const y1 = y0 + h;
      const walls: Wall[] = [
        [x0, y0, x1, y0],
        [x1, y0, x1, y1],
        [x1, y1, x0, y1],
        [x0, y1, x0, y0],
      ].map(([a, b, c, d]) => ({ id: createId('wall'), x1: a, y1: b, x2: c, y2: d, thickness: wallThickness }));
      st.commit((d) => ({ ...d, walls: [...d.walls, ...walls], rooms: [...d.rooms, room] }));
    } else {
      st.commit(docOps.addRoom(room));
    }
  };

  const onPointerUp = () => {
    if (!pointerDown.current) return;
    pointerDown.current = false;
    if (clientPreview) return;
    const d = draftRef.current;
    if (!d) return;
    const color = '#111827';
    const sw = Math.max(2, baseFont / 8);
    if (d.kind === 'rect' || d.kind === 'circle') {
      const w = d.end.x - d.start.x;
      const h = d.end.y - d.start.y;
      if (Math.abs(w) > 4 / zoom && Math.abs(h) > 4 / zoom)
        commitAnnotation({
          kind: d.kind,
          x: Math.min(d.start.x, d.end.x),
          y: Math.min(d.start.y, d.end.y),
          width: Math.abs(w),
          height: Math.abs(h),
          color,
          strokeWidth: sw,
        });
      setDraft(null);
    } else if (d.kind === 'arrow') {
      if (distance(d.start, d.end) > 10 / zoom)
        commitAnnotation({ kind: 'arrow', x: 0, y: 0, points: [d.start.x, d.start.y, d.end.x, d.end.y], color, strokeWidth: sw });
      setDraft(null);
    } else if (d.kind === 'pen') {
      if (d.points.length >= 4) commitAnnotation({ kind: 'pen', x: 0, y: 0, points: d.points, color, strokeWidth: sw });
      setDraft(null);
    } else if (d.kind === 'room') {
      setDraft(null);
      void createRoom(d.start, d.end);
    }
  };

  const onStageTap = async (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (clientPreview || editorRuntime.pinching) return;
    const st = useEditorStore.getState();
    const p = worldPointer();
    if (!p) return;
    const onEmpty = e.target === stageRef.current || e.target.name() === 'paper' || e.target.name() === 'background';
    switch (tool) {
      case 'select':
        if (onEmpty) st.clearSelection();
        return;
      case 'connect':
        if (onEmpty) st.setConnectSource(null);
        return;
      case 'place': {
        if (!st.placeSymbolId) return;
        const sym = placeSymbolAt(st.placeSymbolId, p);
        if (sym && !st.repeat) {
          st.setTool('select');
          st.select('symbol', [sym.id]);
        }
        return;
      }
      case 'wall': {
        const d = draftRef.current;
        if (!d || d.kind !== 'wall') {
          setDraft({ kind: 'wall', points: [snapWallPoint(p)], cursor: null });
          return;
        }
        const last = d.points[d.points.length - 1];
        const q = snapWallPoint(p, last);
        if (distance(q, last) < 6 / zoom) {
          setDraft(null); // double toucher = terminer
          return;
        }
        const wall: Wall = { id: createId('wall'), x1: last.x, y1: last.y, x2: q.x, y2: q.y, thickness: wallThickness };
        st.commit(docOps.addWalls([wall]));
        if (d.points.length > 1 && distance(q, d.points[0]) < 1)
          setDraft(null); // boucle fermée
        else setDraft({ kind: 'wall', points: [...d.points, q], cursor: q });
        return;
      }
      case 'door':
      case 'window': {
        const nw = nearestWall(p, doc.walls, Math.max(30 / zoom, wallThickness * 2));
        if (!nw) {
          toast.info(tool === 'door' ? 'Touchez un mur pour placer la porte' : 'Touchez un mur pour placer la fenêtre');
          return;
        }
        const width =
          tool === 'door' ? (ppm ? 0.83 * ppm : Math.max(40, Math.max(planW, planH) / 22)) : ppm ? 1.2 * ppm : Math.max(50, Math.max(planW, planH) / 18);
        const t = clampOpeningT(nw.wall, nw.t, width);
        if (tool === 'door') {
          const door: Door = { id: createId('door'), wallId: nw.wall.id, t, width, flip: false, hingeEnd: false };
          st.commit(docOps.addDoor(door));
          st.select('door', [door.id]);
        } else {
          const win: Window = { id: createId('win'), wallId: nw.wall.id, t, width };
          st.commit(docOps.addWindow(win));
          st.select('window', [win.id]);
        }
        return;
      }
      case 'text': {
        const text = await promptDialog({ title: 'Ajouter un texte', label: 'Texte', placeholder: 'Prise à 110 cm' });
        if (text && text.trim()) commitAnnotation({ kind: 'text', x: p.x, y: p.y, text: text.trim(), fontSize: baseFont, color: '#111827', strokeWidth: 2 });
        return;
      }
      case 'measure': {
        const d = draftRef.current;
        if (!d || d.kind !== 'measure') {
          setDraft({ kind: 'measure', start: p, cursor: p });
          return;
        }
        setDraft(null);
        if (distance(d.start, p) > 4 / zoom) {
          st.commit(docOps.addMeasure({ id: createId('mes'), x1: d.start.x, y1: d.start.y, x2: p.x, y2: p.y }));
          if (!st.doc.scale) toast.info('Définissez l’échelle pour afficher la distance en mètres.');
        }
        return;
      }
      case 'scale': {
        const d = draftRef.current;
        if (!d || d.kind !== 'scale') {
          setDraft({ kind: 'scale', start: p, cursor: p });
          toast.info('Touchez maintenant le point B');
          return;
        }
        const start = d.start;
        setDraft(null);
        const px = distance(start, p);
        if (px < 5 / zoom) return;
        const input = await promptDialog({
          title: 'Définir l’échelle',
          message: 'Longueur réelle entre les points A et B',
          label: 'Distance (m)',
          placeholder: '4,20',
          inputMode: 'decimal',
          validate: (v) => (parseMeters(v) ? null : 'Saisissez une distance valide, ex. 4,20'),
        });
        const meters = input ? parseMeters(input) : null;
        if (!meters) return;
        const ppmNew = px / meters;
        st.commit((d) => ({ ...d, scale: { pixelsPerMeter: ppmNew, reference: { x1: start.x, y1: start.y, x2: p.x, y2: p.y, meters } } }));
        st.setTool('select');
        toast.success(`Échelle définie : ${formatMeters(meters)} ✓`);
        return;
      }
      default:
        return;
    }
  };

  /* ---------------- Rendu ---------------- */
  const symbolsById = useMemo(() => new Map(doc.symbols.map((s) => [s.id, s])), [doc.symbols]);
  /** Une seule étiquette « Commande N » par groupe (sur la première liaison du groupe). */
  const labelledConnections = useMemo(() => {
    const seen = new Set<number>();
    const ids = new Set<string>();
    for (const c of doc.connections) {
      if (c.type !== 'command' || c.group === undefined || !c.showLabel || seen.has(c.group)) continue;
      seen.add(c.group);
      ids.add(c.id);
    }
    return ids;
  }, [doc.connections]);
  const wallsById = useMemo(() => new Map(doc.walls.map((w) => [w.id, w])), [doc.walls]);
  const sel = selection;
  const isSel = (kind: string, id: string) => !clientPreview && sel?.kind === kind && sel.ids.includes(id);
  const editable = !clientPreview;
  const selectTool = tool === 'select';

  const selectedWall = sel?.kind === 'wall' && sel.ids.length === 1 ? wallsById.get(sel.ids[0]) : undefined;
  const selectedDoor = sel?.kind === 'door' && sel.ids.length === 1 ? doc.doors.find((d) => d.id === sel.ids[0]) : undefined;
  const selectedWindow = sel?.kind === 'window' && sel.ids.length === 1 ? doc.windows.find((d) => d.id === sel.ids[0]) : undefined;
  const cursor = tool === 'select' ? 'default' : tool === 'place' || tool === 'wall' || tool === 'measure' || tool === 'scale' ? 'crosshair' : 'copy';

  return (
    <div ref={containerRef} className="absolute inset-0 touch-none bg-gray-200" style={{ cursor }} data-testid="plan-stage">
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        draggable={selectTool || clientPreview}
        onWheel={onWheel}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => void onStageTap(e)}
        onTap={(e) => void onStageTap(e)}
        onDragStart={(e) => {
          if (e.target === stageRef.current && editorRuntime.pinching) stageRef.current?.stopDrag();
        }}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) syncView();
        }}
      >
        {/* Fond : papier, plan original, grille */}
        <Layer listening={false}>
          <Rect
            name="paper"
            x={0}
            y={0}
            width={planW}
            height={planH}
            fill="#ffffff"
            shadowColor="#111827"
            shadowBlur={clientPreview ? 0 : 12}
            shadowOpacity={0.15}
          />
          {L.original.visible && bgImage && (
            <KonvaImage name="background" image={bgImage} x={0} y={0} width={planW} height={planH} opacity={plan?.backgroundOpacity ?? 1} />
          )}
          {settings.gridEnabled && !clientPreview && (
            <Shape
              stroke="#e5e7eb"
              strokeWidth={1 / zoom}
              sceneFunc={(ctx, shape) => {
                const g = settings.gridSize;
                ctx.beginPath();
                for (let x = 0; x <= planW; x += g) {
                  ctx.moveTo(x, 0);
                  ctx.lineTo(x, planH);
                }
                for (let y = 0; y <= planH; y += g) {
                  ctx.moveTo(0, y);
                  ctx.lineTo(planW, y);
                }
                ctx.strokeShape(shape);
              }}
            />
          )}
        </Layer>

        {/* Plan reconstruit : murs, ouvertures, pièces */}
        {L.reconstructed.visible && (
          <Layer listening={editable && !L.reconstructed.locked && selectTool}>
            {doc.walls.map((w) => (
              <WallShape key={w.id} wall={w} selected={isSel('wall', w.id)} interactive={editable && selectTool} />
            ))}
            {doc.doors.map((d) => {
              const w = wallsById.get(d.wallId);
              return w ? <DoorShape key={d.id} door={d} wall={w} selected={isSel('door', d.id)} interactive={editable && selectTool} /> : null;
            })}
            {doc.windows.map((o) => {
              const w = wallsById.get(o.wallId);
              return w ? <WindowShape key={o.id} win={o} wall={w} selected={isSel('window', o.id)} interactive={editable && selectTool} /> : null;
            })}
            {doc.rooms.map((r) => (
              <RoomLabel key={r.id} room={r} selected={isSel('room', r.id)} interactive={editable && selectTool} fontSize={baseFont * 1.1} />
            ))}
          </Layer>
        )}

        {/* Liaisons, symboles, annotations, mesures */}
        <Layer>
          {L.connections.visible && (
            <Group listening={editable && !L.connections.locked && selectTool}>
              {doc.connections.map((c) => {
                const s = symbolsById.get(c.sourceId);
                const t = symbolsById.get(c.targetId);
                if (!s || !t) return null;
                return (
                  <ConnectionLine
                    key={c.id}
                    conn={c}
                    source={s}
                    target={t}
                    selected={isSel('connection', c.id)}
                    interactive={editable && selectTool}
                    showNumber={settings.showCommandNumbers && labelledConnections.has(c.id)}
                  />
                );
              })}
            </Group>
          )}
          {L.symbols.visible && (
            <Group>
              {doc.symbols.map((s) => (
                <SymbolNode
                  key={s.id}
                  symbol={s}
                  selected={isSel('symbol', s.id)}
                  draggable={editable && selectTool && !L.symbols.locked}
                  listening={editable && !L.symbols.locked && (selectTool || tool === 'connect')}
                  connectSource={connectSourceId === s.id}
                />
              ))}
              {doc.symbols.map((s) => (s.properties.label ? <SymbolLabel key={`l-${s.id}`} symbol={s} /> : null))}
            </Group>
          )}
          {L.annotations.visible && (
            <Group listening={editable && !L.annotations.locked && selectTool}>
              {doc.annotations.map((a) => (
                <AnnotationNode key={a.id} a={a} selected={isSel('annotation', a.id)} interactive={editable && selectTool && !L.annotations.locked} />
              ))}
            </Group>
          )}
          {L.measures.visible && (
            <Group listening={editable && !L.measures.locked && selectTool}>
              {doc.measures.map((m) => (
                <MeasureNode key={m.id} m={m} scale={doc.scale} selected={isSel('measure', m.id)} interactive={editable && selectTool} zoom={zoom} />
              ))}
            </Group>
          )}
        </Layer>

        {/* Surcouche : aperçus, repères, poignées */}
        {!clientPreview && (
          <Layer>
            <Guides width={planW} height={planH} zoom={zoom} />
            <DraftPreview draft={draft} zoom={zoom} wallThickness={wallThickness} />
            {selectTool && selectedWall && !L.reconstructed.locked && <WallHandles wall={selectedWall} walls={doc.walls} zoom={zoom} />}
            {selectTool && selectedDoor && wallsById.get(selectedDoor.wallId) && (
              <OpeningHandle
                kind="door"
                id={selectedDoor.id}
                wall={wallsById.get(selectedDoor.wallId)!}
                t={selectedDoor.t}
                width={selectedDoor.width}
                zoom={zoom}
              />
            )}
            {selectTool && selectedWindow && wallsById.get(selectedWindow.wallId) && (
              <OpeningHandle
                kind="window"
                id={selectedWindow.id}
                wall={wallsById.get(selectedWindow.wallId)!}
                t={selectedWindow.t}
                width={selectedWindow.width}
                zoom={zoom}
              />
            )}
            {selectTool && sel?.kind === 'symbol' && !L.symbols.locked && <SelectionTransformer ids={sel.ids} touch={isTouchDevice} />}
          </Layer>
        )}
      </Stage>
      {draft?.kind === 'wall' && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink-900/85 px-3 py-1.5 text-xs font-semibold text-white">
          Touchez pour ajouter un point · touchez deux fois au même endroit pour terminer
        </div>
      )}
    </div>
  );
}
