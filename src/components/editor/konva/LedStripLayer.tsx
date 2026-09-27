import { memo, useLayoutEffect, useRef, useState } from 'react';
import { Circle, Group, Line, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { LedStrip, Point, Wall } from '../../../types';
import { docOps, useEditorStore } from '../../../store/editorStore';
import { getSettings } from '../../../store/settingsStore';
import {
  insertLedPoint,
  ledCaption,
  ledCaptionPlacement,
  ledLength,
  ledSegments,
  moveLedPoint,
  removeLedPoint,
  snapLedPoint,
  toFlat,
  toPoints,
  translateLed,
} from '../../../utils/ledStrip';
import { editorRuntime, hapticTick, isDuplicateActivation } from '../runtime';

const ORANGE = '#f97316';

/** Rendu « tube LED » : contour sombre, couleur de la bande, points lumineux blancs. */
function LedLines({ points, closed, color, width, opacity = 1 }: { points: number[]; closed?: boolean; color: string; width: number; opacity?: number }) {
  return (
    <>
      <Line
        points={points}
        closed={closed}
        stroke="#1f2937"
        strokeWidth={width * 1.45}
        lineJoin="round"
        lineCap="round"
        opacity={0.75 * opacity}
        listening={false}
      />
      <Line points={points} closed={closed} stroke={color} strokeWidth={width} lineJoin="round" lineCap="round" opacity={opacity} listening={false} />
      <Line
        points={points}
        closed={closed}
        stroke="#ffffff"
        strokeWidth={width * 0.45}
        lineCap="round"
        dash={[0.001, width * 1.7]}
        opacity={0.95 * opacity}
        listening={false}
      />
    </>
  );
}

/** Libellé « LED 3,20 m » posé le long du plus grand segment, toujours lisible. */
function LedCaption({ strip, pixelsPerMeter, fontSize }: { strip: LedStrip; pixelsPerMeter?: number; fontSize: number }) {
  const ref = useRef<Konva.Text>(null);
  const place = ledCaptionPlacement(strip.points, strip.closed);
  const text = ledCaption(strip, pixelsPerMeter);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.offsetX(t.width() / 2);
    t.offsetY(t.height() / 2);
  }, [text, fontSize]);
  if (!place) return null;
  const off = strip.width * 0.9 + fontSize * 0.75;
  return (
    <Text
      ref={ref}
      x={place.x + place.nx * off}
      y={place.y + place.ny * off}
      rotation={place.angle}
      text={text}
      fontSize={fontSize}
      fontStyle="bold"
      fontFamily="Helvetica, Arial, sans-serif"
      fill="#374151"
      stroke="#ffffff"
      strokeWidth={fontSize * 0.28}
      fillAfterStrokeEnabled
      listening={false}
    />
  );
}

export interface LedStripNodeProps {
  strip: LedStrip;
  selected: boolean;
  /** Réagit aux touchers (outil Sélection, calque déverrouillé). */
  interactive: boolean;
  zoom: number;
  pixelsPerMeter?: number;
  fontSize: number;
}

/** Bande LED posée : fixe par défaut, déplaçable d'un bloc une fois sélectionnée. */
export const LedStripNode = memo(function LedStripNode({ strip, selected, interactive, zoom, pixelsPerMeter, fontSize }: LedStripNodeProps) {
  // Pendant le glisser, le tracé reste dessiné depuis la position de départ (le groupe se déplace)
  const [frozen, setFrozen] = useState<number[] | null>(null);
  const points = frozen ?? strip.points;

  const onTap = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const st = useEditorStore.getState();
    if (st.clientPreview || st.tool !== 'select') return;
    e.cancelBubble = true;
    if (isDuplicateActivation(`led:${strip.id}`, e.target.getStage()?.getPointerPosition() ?? null)) return;
    const multi = 'shiftKey' in e.evt && (e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey);
    if (multi) st.toggleSelect('led', strip.id);
    else st.select('led', [strip.id]);
  };

  return (
    <Group
      id={strip.id}
      name="led-strip"
      listening={interactive}
      draggable={interactive && selected}
      onClick={onTap}
      onTap={onTap}
      onDragStart={(e) => {
        const st = useEditorStore.getState();
        if (st.tool !== 'select' || editorRuntime.pinching) {
          e.target.stopDrag();
          return;
        }
        editorRuntime.draggingNode = e.target;
        setFrozen(strip.points);
        st.beginGesture();
      }}
      onDragMove={(e) => {
        const base = frozen ?? strip.points;
        useEditorStore.getState().updateTransient(docOps.patchLedStrip(strip.id, { points: translateLed(base, e.target.x(), e.target.y()) }));
      }}
      onDragEnd={(e) => {
        e.target.position({ x: 0, y: 0 });
        editorRuntime.draggingNode = null;
        setFrozen(null);
        useEditorStore.getState().endGesture();
      }}
    >
      {selected && (
        <Line
          points={points}
          closed={strip.closed}
          stroke={ORANGE}
          strokeWidth={strip.width * 1.45 + 12 / zoom}
          lineJoin="round"
          lineCap="round"
          opacity={0.35}
          listening={false}
        />
      )}
      {/* Zone de toucher généreuse autour du tracé */}
      <Line points={points} closed={strip.closed} stroke="transparent" strokeWidth={strip.width} hitStrokeWidth={Math.max(strip.width * 1.6, 26 / zoom)} />
      <LedLines points={points} closed={strip.closed} color={strip.color} width={strip.width} />
      {!strip.closed && points.length >= 2 && (
        <Circle x={points[0]} y={points[1]} radius={strip.width * 0.95} fill="#1f2937" stroke="#ffffff" strokeWidth={strip.width * 0.3} listening={false} />
      )}
      {frozen === null && <LedCaption strip={strip} pixelsPerMeter={pixelsPerMeter} fontSize={fontSize} />}
    </Group>
  );
});

/** Aperçu du tracé en cours (outil Bande LED). */
export function LedDraftPreview({
  points,
  cursor,
  zoom,
  width,
  color,
  pixelsPerMeter,
}: {
  points: Point[];
  cursor: Point | null;
  zoom: number;
  width: number;
  color: string;
  pixelsPerMeter?: number;
}) {
  if (!points.length) return null;
  const all = cursor ? [...points, cursor] : points;
  const flat = toFlat(all);
  const start = points[0];
  const closing = Boolean(cursor && points.length >= 3 && Math.abs(cursor.x - start.x) < 1e-6 && Math.abs(cursor.y - start.y) < 1e-6);
  const len = ledLength(flat);
  const tip = all[all.length - 1];
  const meters = pixelsPerMeter ? `${(len / pixelsPerMeter).toFixed(2).replace('.', ',')} m` : null;
  return (
    <Group listening={false}>
      {flat.length >= 4 && <LedLines points={flat} color={color} width={width} opacity={0.85} />}
      {points.map((p, i) => (
        <Circle key={i} x={p.x} y={p.y} radius={5 / zoom} fill={ORANGE} stroke="#ffffff" strokeWidth={1.5 / zoom} />
      ))}
      {/* Point de départ : cible pour fermer le contour */}
      {points.length >= 3 && (
        <Circle
          x={start.x}
          y={start.y}
          radius={(closing ? 16 : 12) / zoom}
          stroke={ORANGE}
          strokeWidth={2.5 / zoom}
          dash={closing ? undefined : [4 / zoom, 3 / zoom]}
        />
      )}
      {cursor && <Circle x={cursor.x} y={cursor.y} radius={9 / zoom} stroke={ORANGE} strokeWidth={2.5 / zoom} />}
      {meters && flat.length >= 4 && (
        <Text
          x={tip.x + 14 / zoom}
          y={tip.y - 30 / zoom}
          text={meters}
          fontSize={15 / zoom}
          fontStyle="bold"
          fill="#111827"
          stroke="#ffffff"
          strokeWidth={4 / zoom}
          fillAfterStrokeEnabled
        />
      )}
    </Group>
  );
}

export interface LedHandlesProps {
  strip: LedStrip;
  zoom: number;
  walls: Wall[];
  touch: boolean;
  /** Écart face du mur ↔ bande (unités plan). */
  wallGap: number;
}

/**
 * Poignées d'édition de la bande sélectionnée :
 * ronds = points (extrémités et angles) à glisser, « + » = ajouter un angle,
 * double toucher sur un rond = retirer ce point.
 */
export function LedStripHandles({ strip, zoom, walls, touch, wallGap }: LedHandlesProps) {
  const [frozen, setFrozen] = useState<{ points: number[]; mid: number | null } | null>(null);
  const active = useRef<number | null>(null);
  const base = frozen?.points ?? strip.points;
  const pts = toPoints(base);
  const r = (touch ? 13 : 9) / zoom;
  const n = pts.length;

  const current = () => useEditorStore.getState().doc.ledStrips.find((l) => l.id === strip.id);

  const begin = (e: KonvaEventObject<DragEvent>): boolean => {
    const st = useEditorStore.getState();
    if (st.tool !== 'select' || editorRuntime.pinching) {
      e.target.stopDrag();
      return false;
    }
    editorRuntime.draggingNode = e.target;
    st.beginGesture();
    return true;
  };

  const move = (e: KonvaEventObject<DragEvent>) => {
    const idx = active.current;
    const cur = current();
    if (idx === null || !cur) return;
    const cpts = toPoints(cur.points);
    const settings = getSettings();
    const prev = cpts[idx - 1] ?? (cur.closed ? cpts[cpts.length - 1] : null);
    const next = cpts[idx + 1] ?? (cur.closed ? cpts[0] : null);
    const snapped = snapLedPoint(e.target.position(), {
      from: prev ?? next,
      walls,
      radius: 16 / zoom,
      gap: wallGap,
      snapWalls: settings.snapEnabled,
      gridSize: settings.gridEnabled ? settings.gridSize : null,
    });
    e.target.position(snapped.point);
    useEditorStore.getState().updateTransient(docOps.patchLedStrip(strip.id, { points: moveLedPoint(cur.points, idx, snapped.point) }));
  };

  const end = () => {
    active.current = null;
    editorRuntime.draggingNode = null;
    setFrozen(null);
    useEditorStore.getState().endGesture();
  };

  const removeAt = (i: number, e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    if (isDuplicateActivation(`ledpt:${strip.id}:${i}`, e.target.getStage()?.getPointerPosition() ?? null, 450)) return;
    const next = removeLedPoint(strip.points, i, strip.closed);
    if (!next) return;
    useEditorStore.getState().commit(docOps.patchLedStrip(strip.id, { points: next }));
    hapticTick(getSettings().vibration);
  };

  const segs = ledSegments(base, strip.closed);

  return (
    <Group>
      {segs.map(([a, b], i) => {
        if (frozen && frozen.mid !== i) return null;
        // Segment trop court à l'écran : pas de « + » (évite les poignées superposées)
        if (!frozen && Math.hypot(b.x - a.x, b.y - a.y) * zoom < (touch ? 70 : 44)) return null;
        return (
          <Group
            key={`m${i}`}
            x={(a.x + b.x) / 2}
            y={(a.y + b.y) / 2}
            draggable
            onDragStart={(e) => {
              if (!begin(e)) return;
              const pos = e.target.position();
              setFrozen({ points: strip.points, mid: i });
              active.current = i + 1;
              useEditorStore.getState().updateTransient(docOps.patchLedStrip(strip.id, { points: insertLedPoint(strip.points, i, pos) }));
            }}
            onDragMove={move}
            onDragEnd={end}
            onClick={(e) => (e.cancelBubble = true)}
            onTap={(e) => (e.cancelBubble = true)}
          >
            <Circle
              radius={r * 0.8}
              fill="#fff7ed"
              stroke={ORANGE}
              strokeWidth={2 / zoom}
              hitStrokeWidth={14 / zoom}
              shadowColor="#000"
              shadowBlur={4 / zoom}
              shadowOpacity={0.2}
            />
            <Line points={[-r * 0.4, 0, r * 0.4, 0]} stroke={ORANGE} strokeWidth={2.5 / zoom} lineCap="round" listening={false} />
            <Line points={[0, -r * 0.4, 0, r * 0.4]} stroke={ORANGE} strokeWidth={2.5 / zoom} lineCap="round" listening={false} />
          </Group>
        );
      })}
      {pts.map((p, i) => {
        const isEnd = !strip.closed && (i === 0 || i === n - 1);
        return (
          <Circle
            key={`v${i}`}
            x={p.x}
            y={p.y}
            radius={isEnd ? r * 1.1 : r}
            fill={isEnd ? ORANGE : '#ffffff'}
            stroke={isEnd ? '#ffffff' : ORANGE}
            strokeWidth={3 / zoom}
            hitStrokeWidth={16 / zoom}
            shadowColor="#000"
            shadowBlur={5 / zoom}
            shadowOpacity={0.25}
            draggable
            onDragStart={(e) => {
              if (!begin(e)) return;
              setFrozen({ points: strip.points, mid: null });
              active.current = i;
            }}
            onDragMove={move}
            onDragEnd={end}
            onClick={(e) => (e.cancelBubble = true)}
            onTap={(e) => (e.cancelBubble = true)}
            onDblClick={(e) => removeAt(i, e)}
            onDblTap={(e) => removeAt(i, e)}
          />
        );
      })}
    </Group>
  );
}
