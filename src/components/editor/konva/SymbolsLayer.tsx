import { memo, useRef } from 'react';
import { Circle, Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { PlacedSymbol } from '../../../types';
import { getSymbolDefinition } from '../../../data/electricalSymbols';
import { useEditorStore } from '../../../store/editorStore';
import { getSettings } from '../../../store/settingsStore';
import { useViewStore } from '../../../store/viewStore';
import { useGuideStore } from '../../../store/guideStore';
import { snapSymbol, symbolUnitScale, symbolWorldSize } from '../../../utils/symbols';
import { editorRuntime, hapticTick } from '../runtime';
import { onSymbolActivate, openSymbolProperties } from '../editorActions';
import { SymbolShapes } from './SymbolShapes';

interface DragState {
  startRotation: number;
  startX: number;
  startY: number;
  others: Map<string, { x: number; y: number }>;
  snapped: boolean;
  raf: number | null;
  pending: { x: number; y: number; rotation: number } | null;
}

export interface SymbolNodeProps {
  symbol: PlacedSymbol;
  selected: boolean;
  /** Déplaçable (outil Sélection, calque déverrouillé). */
  draggable: boolean;
  /** Réagit aux touchers (sélection / liaison). */
  listening: boolean;
  connectSource: boolean;
}

/** Symbole posé : déplaçable, aimanté aux murs, relié aux liaisons en temps réel. */
export const SymbolNode = memo(function SymbolNode({ symbol, selected, draggable, listening, connectSource }: SymbolNodeProps) {
  const def = getSymbolDefinition(symbol.symbolType);
  const unit = symbolUnitScale(def, symbol.scale);
  const color = symbol.properties.color ?? def.color;
  const drag = useRef<DragState | null>(null);

  const flush = () => {
    const d = drag.current;
    if (!d?.pending) return;
    const { x, y, rotation } = d.pending;
    d.pending = null;
    d.raf = null;
    const dx = x - d.startX;
    const dy = y - d.startY;
    useEditorStore.getState().updateTransient((doc) => ({
      ...doc,
      symbols: doc.symbols.map((s) => {
        if (s.id === symbol.id) return { ...s, x, y, rotation };
        const o = d.others.get(s.id);
        return o ? { ...s, x: o.x + dx, y: o.y + dy } : s;
      }),
    }));
  };

  const onDragStart = (e: KonvaEventObject<DragEvent>) => {
    const st = useEditorStore.getState();
    if (st.tool !== 'select' || editorRuntime.pinching) {
      e.target.stopDrag();
      return;
    }
    editorRuntime.draggingNode = e.target;
    if (!st.selection || st.selection.kind !== 'symbol' || !st.selection.ids.includes(symbol.id)) st.select('symbol', [symbol.id]);
    const sel = useEditorStore.getState().selection;
    const others = new Map<string, { x: number; y: number }>();
    if (sel && sel.kind === 'symbol') {
      for (const s of st.doc.symbols) if (s.id !== symbol.id && sel.ids.includes(s.id)) others.set(s.id, { x: s.x, y: s.y });
    }
    drag.current = { startRotation: symbol.rotation, startX: symbol.x, startY: symbol.y, others, snapped: false, raf: null, pending: null };
    st.beginGesture();
  };

  const onDragMove = (e: KonvaEventObject<DragEvent>) => {
    const d = drag.current;
    if (!d) return;
    const node = e.target;
    const pos = node.position();
    const settings = getSettings();
    const viewScale = useViewStore.getState().scale;
    const doc = useEditorStore.getState().doc;
    let x = pos.x;
    let y = pos.y;
    let rotation = d.startRotation;
    let snapped = false;
    if (settings.snapEnabled && def.snapToWall && d.others.size === 0) {
      const snap = snapSymbol(def, symbol.scale, pos, doc.walls, settings.snapDistance / viewScale);
      if (snap) {
        x = snap.x;
        y = snap.y;
        rotation = snap.rotation;
        snapped = true;
      }
    }
    let guides: { x?: number; y?: number } | null = null;
    if (!snapped && settings.showGuides) {
      const tol = 6 / viewScale;
      let gx: number | undefined;
      let gy: number | undefined;
      for (const s of doc.symbols) {
        if (s.id === symbol.id || d.others.has(s.id)) continue;
        if (gx === undefined && Math.abs(s.x - x) < tol) gx = s.x;
        if (gy === undefined && Math.abs(s.y - y) < tol) gy = s.y;
        if (gx !== undefined && gy !== undefined) break;
      }
      if (gx !== undefined) x = gx;
      if (gy !== undefined) y = gy;
      if (gx !== undefined || gy !== undefined) guides = { x: gx, y: gy };
    }
    if (!snapped && settings.gridEnabled && !guides) {
      const g = settings.gridSize;
      x = Math.round(x / g) * g;
      y = Math.round(y / g) * g;
    }
    useGuideStore.getState().setGuides(guides);
    if (snapped && !d.snapped) hapticTick(settings.vibration);
    d.snapped = snapped;
    node.position({ x, y });
    node.rotation(rotation);
    d.pending = { x, y, rotation };
    if (d.raf === null) d.raf = requestAnimationFrame(flush);
  };

  const onDragEnd = () => {
    const d = drag.current;
    if (d) {
      if (d.raf !== null) cancelAnimationFrame(d.raf);
      flush();
    }
    drag.current = null;
    editorRuntime.draggingNode = null;
    useGuideStore.getState().setGuides(null);
    useEditorStore.getState().endGesture();
  };

  const onTransformEnd = (e: KonvaEventObject<Event>) => {
    const node = e.target as unknown as Konva.Group;
    const base = def.defaultSize / 40;
    const newScale = Math.max(0.3, Math.min(4, node.scaleX() / base));
    const rotation = Math.round(node.rotation() * 10) / 10;
    useEditorStore.getState().updateSymbol(symbol.id, { rotation: ((rotation % 360) + 360) % 360, scale: Math.round(newScale * 100) / 100 });
  };

  const onTap = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (onSymbolActivate(symbol.id, e.evt)) e.cancelBubble = true;
  };

  return (
    <Group
      id={symbol.id}
      name="symbol"
      x={symbol.x}
      y={symbol.y}
      rotation={symbol.rotation}
      scaleX={unit}
      scaleY={unit}
      draggable={draggable}
      listening={listening}
      onClick={onTap}
      onTap={onTap}
      onDblClick={() => openSymbolProperties(symbol.id)}
      onDblTap={() => openSymbolProperties(symbol.id)}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    >
      <Rect x={-21} y={-21} width={42} height={42} fill="transparent" />
      {(selected || connectSource) && (
        <Circle
          radius={25}
          stroke="#f97316"
          strokeWidth={connectSource ? 3 : 1.5}
          strokeScaleEnabled={false}
          dash={connectSource ? undefined : [6, 4]}
          fill={connectSource ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.06)'}
          listening={false}
        />
      )}
      <SymbolShapes shapes={def.shapes} color={color} />
    </Group>
  );
});

/** Étiquette texte (non tournée) sous un symbole, ex. « Four ». */
export const SymbolLabel = memo(function SymbolLabel({ symbol }: { symbol: PlacedSymbol }) {
  const text = symbol.properties.label;
  if (!text) return null;
  const def = getSymbolDefinition(symbol.symbolType);
  const size = symbolWorldSize(def, symbol.scale);
  const fontSize = Math.max(10, size * 0.32);
  return (
    <Text
      x={symbol.x - 80}
      y={symbol.y + size * 0.52}
      width={160}
      align="center"
      text={text}
      fontSize={fontSize}
      fontStyle="bold"
      fontFamily="Helvetica, Arial, sans-serif"
      fill={symbol.properties.color ?? def.color}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
});
