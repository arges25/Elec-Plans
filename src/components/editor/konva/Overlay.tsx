import { useEffect, useRef } from 'react';
import { Circle, Ellipse, Line, Rect, Transformer, Arrow, Group, Text } from 'react-konva';
import type Konva from 'konva';
import type { Point, Wall } from '../../../types';
import { docOps, useEditorStore } from '../../../store/editorStore';
import { useGuideStore } from '../../../store/guideStore';
import { getSettings } from '../../../store/settingsStore';
import { nearestWallEndpoint, projectPointOnSegment, snapSegmentEnd, snapToGrid, wallEnd, wallStart } from '../../../utils/geometry';
import { clampOpeningT, openingFrame } from '../../../utils/openings';
import { hapticTick } from '../runtime';

export type Draft =
  | { kind: 'wall'; points: Point[]; cursor: Point | null }
  | { kind: 'rect' | 'circle' | 'room' | 'arrow'; start: Point; end: Point }
  | { kind: 'pen'; points: number[] }
  | { kind: 'measure' | 'scale'; start: Point; cursor: Point | null };

const ORANGE = '#f97316';

/** Aperçu des tracés en cours (mur, rectangle, flèche, crayon, mesure…). */
export function DraftPreview({ draft, zoom, wallThickness }: { draft: Draft | null; zoom: number; wallThickness: number }) {
  if (!draft) return null;
  const sw = 2 / zoom;
  switch (draft.kind) {
    case 'wall': {
      const pts = draft.points.flatMap((p) => [p.x, p.y]);
      const last = draft.points[draft.points.length - 1];
      return (
        <Group listening={false}>
          {pts.length >= 4 && <Line points={pts} stroke="#374151" strokeWidth={wallThickness} lineCap="square" opacity={0.6} />}
          {last && draft.cursor && (
            <Line points={[last.x, last.y, draft.cursor.x, draft.cursor.y]} stroke={ORANGE} strokeWidth={wallThickness} lineCap="square" opacity={0.55} />
          )}
          {draft.points.map((p, i) => (
            <Circle key={i} x={p.x} y={p.y} radius={5 / zoom} fill={ORANGE} />
          ))}
          {draft.cursor && <Circle x={draft.cursor.x} y={draft.cursor.y} radius={6 / zoom} stroke={ORANGE} strokeWidth={sw} />}
        </Group>
      );
    }
    case 'rect':
    case 'room':
      return (
        <Rect
          listening={false}
          x={Math.min(draft.start.x, draft.end.x)}
          y={Math.min(draft.start.y, draft.end.y)}
          width={Math.abs(draft.end.x - draft.start.x)}
          height={Math.abs(draft.end.y - draft.start.y)}
          stroke={draft.kind === 'room' ? '#374151' : ORANGE}
          strokeWidth={draft.kind === 'room' ? wallThickness : sw}
          dash={draft.kind === 'room' ? undefined : [8 / zoom, 5 / zoom]}
          opacity={0.7}
        />
      );
    case 'circle':
      return (
        <Ellipse
          listening={false}
          x={(draft.start.x + draft.end.x) / 2}
          y={(draft.start.y + draft.end.y) / 2}
          radiusX={Math.abs(draft.end.x - draft.start.x) / 2}
          radiusY={Math.abs(draft.end.y - draft.start.y) / 2}
          stroke={ORANGE}
          strokeWidth={sw}
          dash={[8 / zoom, 5 / zoom]}
        />
      );
    case 'arrow':
      return (
        <Arrow
          listening={false}
          points={[draft.start.x, draft.start.y, draft.end.x, draft.end.y]}
          stroke={ORANGE}
          fill={ORANGE}
          strokeWidth={sw}
          pointerLength={10 / zoom}
          pointerWidth={8 / zoom}
        />
      );
    case 'pen':
      return <Line listening={false} points={draft.points} stroke={ORANGE} strokeWidth={sw * 1.5} tension={0.4} lineCap="round" />;
    case 'measure':
    case 'scale': {
      const c = draft.cursor ?? draft.start;
      return (
        <Group listening={false}>
          <Line
            points={[draft.start.x, draft.start.y, c.x, c.y]}
            stroke={draft.kind === 'scale' ? '#7c3aed' : '#0f766e'}
            strokeWidth={sw}
            dash={[6 / zoom, 4 / zoom]}
          />
          <Circle x={draft.start.x} y={draft.start.y} radius={6 / zoom} fill={draft.kind === 'scale' ? '#7c3aed' : '#0f766e'} />
          <Text
            x={draft.start.x + 10 / zoom}
            y={draft.start.y - 24 / zoom}
            text={draft.kind === 'scale' ? 'A' : ''}
            fontSize={16 / zoom}
            fontStyle="bold"
            fill="#7c3aed"
          />
        </Group>
      );
    }
  }
}

/** Repères d'alignement. */
export function Guides({ width, height, zoom }: { width: number; height: number; zoom: number }) {
  const guides = useGuideStore((s) => s.guides);
  if (!guides) return null;
  return (
    <Group listening={false}>
      {guides.x !== undefined && (
        <Line points={[guides.x, -height, guides.x, height * 2]} stroke="#ec4899" strokeWidth={1 / zoom} dash={[6 / zoom, 4 / zoom]} />
      )}
      {guides.y !== undefined && <Line points={[-width, guides.y, width * 2, guides.y]} stroke="#ec4899" strokeWidth={1 / zoom} dash={[6 / zoom, 4 / zoom]} />}
    </Group>
  );
}

/** Poignées d'extrémités du mur sélectionné (allonger / raccourcir, murs raccordés suivis). */
export function WallHandles({ wall, walls, zoom }: { wall: Wall; walls: Wall[]; zoom: number }) {
  const linked = useRef<{ wallId: string; end: 1 | 2 }[]>([]);
  const r = 12 / zoom;

  const handle = (end: 1 | 2) => {
    const p = end === 1 ? wallStart(wall) : wallEnd(wall);
    const other = end === 1 ? wallEnd(wall) : wallStart(wall);
    return (
      <Circle
        key={end}
        x={p.x}
        y={p.y}
        radius={r}
        fill="#ffffff"
        stroke={ORANGE}
        strokeWidth={3 / zoom}
        hitStrokeWidth={20 / zoom}
        draggable
        onDragStart={() => {
          linked.current = [];
          for (const w of walls) {
            if (w.id === wall.id) continue;
            if (Math.hypot(w.x1 - p.x, w.y1 - p.y) < 1.5) linked.current.push({ wallId: w.id, end: 1 });
            if (Math.hypot(w.x2 - p.x, w.y2 - p.y) < 1.5) linked.current.push({ wallId: w.id, end: 2 });
          }
          useEditorStore.getState().beginGesture();
        }}
        onDragMove={(e) => {
          const settings = getSettings();
          let q = e.target.position();
          const excluded = new Set([wall.id, ...linked.current.map((l) => l.wallId)]);
          const ep = nearestWallEndpoint(
            q,
            walls.filter((w) => !excluded.has(w.id)),
            14 / zoom,
          );
          if (ep) {
            q = ep;
            hapticTick(settings.vibration);
          } else {
            q = snapSegmentEnd(other, q, 6);
            if (settings.gridEnabled) q = snapToGrid(q, settings.gridSize);
          }
          e.target.position(q);
          const moves = [{ wallId: wall.id, end }, ...linked.current];
          useEditorStore.getState().updateTransient((d) => ({
            ...d,
            walls: d.walls.map((w) => {
              const m = moves.filter((mv) => mv.wallId === w.id);
              if (!m.length) return w;
              let nw = w;
              for (const mv of m) nw = mv.end === 1 ? { ...nw, x1: q.x, y1: q.y } : { ...nw, x2: q.x, y2: q.y };
              return nw;
            }),
          }));
        }}
        onDragEnd={() => useEditorStore.getState().endGesture()}
      />
    );
  };

  return (
    <Group>
      {handle(1)}
      {handle(2)}
    </Group>
  );
}

/** Poignée de déplacement d'une porte / fenêtre le long de son mur. */
export function OpeningHandle({ kind, id, wall, t, width, zoom }: { kind: 'door' | 'window'; id: string; wall: Wall; t: number; width: number; zoom: number }) {
  const f = openingFrame(wall, t, width);
  return (
    <Circle
      x={f.c.x}
      y={f.c.y}
      radius={11 / zoom}
      fill={ORANGE}
      stroke="#ffffff"
      strokeWidth={3 / zoom}
      hitStrokeWidth={22 / zoom}
      draggable
      onDragStart={() => useEditorStore.getState().beginGesture()}
      onDragMove={(e) => {
        const proj = projectPointOnSegment(e.target.position(), wallStart(wall), wallEnd(wall));
        const nt = clampOpeningT(wall, proj.t, width);
        const nf = openingFrame(wall, nt, width);
        e.target.position(nf.c);
        useEditorStore.getState().updateTransient(kind === 'door' ? docOps.patchDoor(id, { t: nt }) : docOps.patchWindow(id, { t: nt }));
      }}
      onDragEnd={() => useEditorStore.getState().endGesture()}
    />
  );
}

/** Poignées de rotation / redimensionnement des symboles sélectionnés. */
export function SelectionTransformer({ ids, touch }: { ids: string[]; touch: boolean }) {
  const trRef = useRef<Konva.Transformer>(null);
  const symbols = useEditorStore((s) => s.doc.symbols);
  useEffect(() => {
    const tr = trRef.current;
    const stage = tr?.getStage();
    if (!tr || !stage) return;
    const nodes = ids.map((id) => stage.findOne(`#${id}`)).filter((n): n is Konva.Node => Boolean(n));
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [ids, symbols]);
  return (
    <Transformer
      ref={trRef}
      rotateEnabled
      keepRatio
      centeredScaling
      flipEnabled={false}
      enabledAnchors={ids.length === 1 ? ['top-left', 'top-right', 'bottom-left', 'bottom-right'] : []}
      rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
      rotationSnapTolerance={6}
      anchorSize={touch ? 18 : 11}
      anchorCornerRadius={touch ? 9 : 3}
      anchorStroke={ORANGE}
      anchorFill="#ffffff"
      borderStroke={ORANGE}
      borderDash={[5, 4]}
      rotateAnchorOffset={touch ? 34 : 24}
      padding={4}
      ignoreStroke
      boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 12 || Math.abs(newBox.height) < 12 ? oldBox : newBox)}
    />
  );
}
