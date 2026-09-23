import { memo } from 'react';
import { Arrow, Ellipse, Group, Label, Line, Rect, Shape, Tag, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Annotation, Door, ElectricalConnection, Measure, PlacedSymbol, PlanScale, Room, Wall, Window } from '../../../types';
import { docOps, useEditorStore, type SelectionKind } from '../../../store/editorStore';
import { promptDialog } from '../../../store/dialogStore';
import { bezierToFlatPoints, distance } from '../../../utils/geometry';
import { connectionGeometry, connectionLabelPoint, dashPattern } from '../../../utils/connections';
import { doorGeometry, openingFrame } from '../../../utils/openings';
import { formatMeters } from '../../../utils/format';

const WALL_COLOR = '#374151';
const SELECT_COLOR = '#f97316';

/** Sélection au toucher en mode Sélection (retourne true si consommé). */
function selectOnTap(kind: SelectionKind, id: string, e: KonvaEventObject<MouseEvent | TouchEvent>): void {
  const st = useEditorStore.getState();
  if (st.clientPreview || st.tool !== 'select') return;
  e.cancelBubble = true;
  const evt = e.evt as MouseEvent;
  if (evt.shiftKey && kind !== 'connection') st.toggleSelect(kind, id);
  else st.select(kind, [id]);
  if (kind === 'connection') st.openSheet('connection');
}

/* ------------------------------------------------------------------ */
/* Murs, ouvertures, pièces                                            */
/* ------------------------------------------------------------------ */

export const WallShape = memo(function WallShape({ wall, selected, interactive }: { wall: Wall; selected: boolean; interactive: boolean }) {
  return (
    <Line
      id={wall.id}
      points={[wall.x1, wall.y1, wall.x2, wall.y2]}
      stroke={selected ? SELECT_COLOR : WALL_COLOR}
      strokeWidth={wall.thickness}
      lineCap="square"
      hitStrokeWidth={Math.max(wall.thickness, 18)}
      listening={interactive}
      draggable={interactive && selected}
      perfectDrawEnabled={false}
      onClick={(e) => selectOnTap('wall', wall.id, e)}
      onTap={(e) => selectOnTap('wall', wall.id, e)}
      onDragStart={() => useEditorStore.getState().beginGesture()}
      onDragEnd={(e) => {
        const dx = e.target.x();
        const dy = e.target.y();
        e.target.position({ x: 0, y: 0 });
        const st = useEditorStore.getState();
        st.updateTransient(docOps.patchWall(wall.id, { x1: wall.x1 + dx, y1: wall.y1 + dy, x2: wall.x2 + dx, y2: wall.y2 + dy }));
        st.endGesture();
      }}
    />
  );
});

export const DoorShape = memo(function DoorShape({ door, wall, selected, interactive }: { door: Door; wall: Wall; selected: boolean; interactive: boolean }) {
  const g = doorGeometry(wall, door.t, door.width, door.flip, door.hingeEnd);
  const color = selected ? SELECT_COLOR : WALL_COLOR;
  return (
    <Group listening={interactive} onClick={(e) => selectOnTap('door', door.id, e)} onTap={(e) => selectOnTap('door', door.id, e)}>
      <Line points={[g.a.x, g.a.y, g.b.x, g.b.y]} stroke="#ffffff" strokeWidth={wall.thickness + 2} lineCap="butt" hitStrokeWidth={24} />
      <Line points={[g.hinge.x, g.hinge.y, g.leafEnd.x, g.leafEnd.y]} stroke={color} strokeWidth={2.5} listening={false} />
      <Shape
        listening={false}
        stroke={color}
        strokeWidth={1.2}
        dash={[6, 4]}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.arc(g.hinge.x, g.hinge.y, g.width, g.startAngle, g.endAngle, !g.clockwise);
          ctx.strokeShape(shape);
        }}
      />
    </Group>
  );
});

export const WindowShape = memo(function WindowShape({ win, wall, selected, interactive }: { win: Window; wall: Wall; selected: boolean; interactive: boolean }) {
  const f = openingFrame(wall, win.t, win.width);
  const off = wall.thickness / 4;
  const color = selected ? SELECT_COLOR : '#0369a1';
  const pts = (k: number) => [f.a.x + f.n.x * k, f.a.y + f.n.y * k, f.b.x + f.n.x * k, f.b.y + f.n.y * k];
  return (
    <Group listening={interactive} onClick={(e) => selectOnTap('window', win.id, e)} onTap={(e) => selectOnTap('window', win.id, e)}>
      <Line points={[f.a.x, f.a.y, f.b.x, f.b.y]} stroke="#ffffff" strokeWidth={wall.thickness} lineCap="butt" hitStrokeWidth={24} />
      <Line points={pts(off)} stroke={color} strokeWidth={1.6} listening={false} />
      <Line points={pts(-off)} stroke={color} strokeWidth={1.6} listening={false} />
      <Line points={[f.a.x + f.n.x * (wall.thickness / 2), f.a.y + f.n.y * (wall.thickness / 2), f.a.x - f.n.x * (wall.thickness / 2), f.a.y - f.n.y * (wall.thickness / 2)]} stroke={color} strokeWidth={1.6} listening={false} />
      <Line points={[f.b.x + f.n.x * (wall.thickness / 2), f.b.y + f.n.y * (wall.thickness / 2), f.b.x - f.n.x * (wall.thickness / 2), f.b.y - f.n.y * (wall.thickness / 2)]} stroke={color} strokeWidth={1.6} listening={false} />
    </Group>
  );
});

export const RoomLabel = memo(function RoomLabel({ room, selected, interactive, fontSize }: { room: Room; selected: boolean; interactive: boolean; fontSize: number }) {
  return (
    <Text
      id={room.id}
      x={room.x}
      y={room.y}
      offsetX={200}
      offsetY={fontSize / 2}
      width={400}
      align="center"
      text={room.name}
      fontSize={fontSize}
      fontStyle="bold"
      fontFamily="Helvetica, Arial, sans-serif"
      fill={selected ? SELECT_COLOR : '#6b7280'}
      listening={interactive}
      draggable={interactive}
      onClick={(e) => selectOnTap('room', room.id, e)}
      onTap={(e) => selectOnTap('room', room.id, e)}
      onDblClick={() => void renameRoom(room)}
      onDblTap={() => void renameRoom(room)}
      onDragStart={() => useEditorStore.getState().beginGesture()}
      onDragEnd={(e) => {
        const st = useEditorStore.getState();
        st.updateTransient(docOps.patchRoom(room.id, { x: e.target.x(), y: e.target.y() }));
        st.endGesture();
      }}
    />
  );
});

export async function renameRoom(room: Room): Promise<void> {
  const name = await promptDialog({ title: 'Nom de la pièce', defaultValue: room.name, label: 'Nom' });
  if (name && name.trim()) useEditorStore.getState().commit(docOps.patchRoom(room.id, { name: name.trim() }));
}

/* ------------------------------------------------------------------ */
/* Liaisons                                                            */
/* ------------------------------------------------------------------ */

export const ConnectionLine = memo(function ConnectionLine({
  conn,
  source,
  target,
  selected,
  interactive,
  showNumber,
}: {
  conn: ElectricalConnection;
  source: PlacedSymbol;
  target: PlacedSymbol;
  selected: boolean;
  interactive: boolean;
  showNumber: boolean;
}) {
  const curve = connectionGeometry(conn, source, target);
  const mid = connectionLabelPoint(curve);
  const label = showNumber && conn.showLabel && conn.type === 'command' && conn.group !== undefined ? `Commande ${conn.group}` : null;
  return (
    <Group listening={interactive} onClick={(e) => selectOnTap('connection', conn.id, e)} onTap={(e) => selectOnTap('connection', conn.id, e)}>
      {selected && <Line points={bezierToFlatPoints(curve)} bezier stroke="rgba(249,115,22,0.25)" strokeWidth={conn.width + 8} lineCap="round" listening={false} />}
      <Line
        points={bezierToFlatPoints(curve)}
        bezier
        stroke={conn.color}
        strokeWidth={conn.width}
        dash={dashPattern(conn.dash, conn.width)}
        lineCap="round"
        hitStrokeWidth={18}
        perfectDrawEnabled={false}
      />
      {label && (
        <Label x={mid.x} y={mid.y} offsetX={(label.length * 12 * 0.58 + 8) / 2} offsetY={10} listening={false}>
          <Tag fill="#ffffff" stroke={conn.color} strokeWidth={1} cornerRadius={6} pointerDirection="none" />
          <Text text={label} fontSize={12} fontStyle="bold" fontFamily="Helvetica, Arial, sans-serif" fill={conn.color} padding={4} />
        </Label>
      )}
    </Group>
  );
});

/* ------------------------------------------------------------------ */
/* Annotations                                                         */
/* ------------------------------------------------------------------ */

async function editText(a: Annotation) {
  const text = await promptDialog({ title: 'Modifier le texte', defaultValue: a.text ?? '', label: 'Texte' });
  if (text !== null && text.trim()) useEditorStore.getState().commit(docOps.patchAnnotation(a.id, { text: text.trim() }));
}

export const AnnotationNode = memo(function AnnotationNode({ a, selected, interactive }: { a: Annotation; selected: boolean; interactive: boolean }) {
  const color = selected ? SELECT_COLOR : a.color;
  const common = {
    id: a.id,
    listening: interactive,
    draggable: interactive,
    onClick: (e: KonvaEventObject<MouseEvent>) => selectOnTap('annotation', a.id, e),
    onTap: (e: KonvaEventObject<TouchEvent>) => selectOnTap('annotation', a.id, e),
    onDragStart: () => useEditorStore.getState().beginGesture(),
    onDragEnd: (e: KonvaEventObject<DragEvent>) => {
      const st = useEditorStore.getState();
      if (a.points) {
        const dx = e.target.x();
        const dy = e.target.y();
        e.target.position({ x: 0, y: 0 });
        st.updateTransient(docOps.patchAnnotation(a.id, { points: a.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) }));
      } else {
        st.updateTransient(docOps.patchAnnotation(a.id, { x: e.target.x(), y: e.target.y() }));
      }
      st.endGesture();
    },
  };
  switch (a.kind) {
    case 'text':
      return (
        <Text
          {...common}
          x={a.x}
          y={a.y}
          text={a.text ?? ''}
          fontSize={a.fontSize ?? 22}
          fontFamily="Helvetica, Arial, sans-serif"
          fontStyle="bold"
          fill={color}
          onDblClick={() => void editText(a)}
          onDblTap={() => void editText(a)}
        />
      );
    case 'arrow':
      return <Arrow {...common} x={0} y={0} points={a.points ?? []} stroke={color} fill={color} strokeWidth={a.strokeWidth} pointerLength={a.strokeWidth * 5} pointerWidth={a.strokeWidth * 4} hitStrokeWidth={16} />;
    case 'circle':
      return (
        <Ellipse
          {...common}
          x={a.x + (a.width ?? 0) / 2}
          y={a.y + (a.height ?? 0) / 2}
          radiusX={Math.abs(a.width ?? 0) / 2}
          radiusY={Math.abs(a.height ?? 0) / 2}
          stroke={color}
          strokeWidth={a.strokeWidth}
          hitStrokeWidth={16}
          fillEnabled={false}
          onDragEnd={(e) => {
            const st = useEditorStore.getState();
            st.updateTransient(docOps.patchAnnotation(a.id, { x: e.target.x() - (a.width ?? 0) / 2, y: e.target.y() - (a.height ?? 0) / 2 }));
            st.endGesture();
          }}
        />
      );
    case 'rect':
      return <Rect {...common} x={a.x} y={a.y} width={a.width ?? 0} height={a.height ?? 0} stroke={color} strokeWidth={a.strokeWidth} hitStrokeWidth={16} fillEnabled={false} />;
    case 'pen':
      return <Line {...common} x={0} y={0} points={a.points ?? []} stroke={color} strokeWidth={a.strokeWidth} tension={0.4} lineCap="round" lineJoin="round" hitStrokeWidth={16} />;
  }
});

/* ------------------------------------------------------------------ */
/* Mesures                                                             */
/* ------------------------------------------------------------------ */

export function measureText(m: { x1: number; y1: number; x2: number; y2: number }, scale: PlanScale | undefined): string {
  const d = distance({ x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 });
  if (!scale?.pixelsPerMeter) return 'Échelle non définie';
  return formatMeters(d / scale.pixelsPerMeter);
}

export const MeasureNode = memo(function MeasureNode({
  m,
  scale,
  selected,
  interactive,
  zoom,
}: {
  m: Measure;
  scale: PlanScale | undefined;
  selected: boolean;
  interactive: boolean;
  zoom: number;
}) {
  const len = Math.max(1e-6, distance({ x: m.x1, y: m.y1 }, { x: m.x2, y: m.y2 }));
  const nx = -(m.y2 - m.y1) / len;
  const ny = (m.x2 - m.x1) / len;
  const tick = 8 / zoom;
  const color = selected ? SELECT_COLOR : '#0f766e';
  const angle = (Math.atan2(m.y2 - m.y1, m.x2 - m.x1) * 180) / Math.PI;
  const upright = angle > 90 || angle < -90 ? angle + 180 : angle;
  const fs = 14 / zoom;
  const text = measureText(m, scale);
  const labelW = text.length * fs * 0.58 + (6 / zoom);
  return (
    <Group listening={interactive} onClick={(e) => selectOnTap('measure', m.id, e)} onTap={(e) => selectOnTap('measure', m.id, e)}>
      <Line points={[m.x1, m.y1, m.x2, m.y2]} stroke={color} strokeWidth={1.5 / zoom} hitStrokeWidth={16 / zoom} />
      <Line points={[m.x1 - nx * tick, m.y1 - ny * tick, m.x1 + nx * tick, m.y1 + ny * tick]} stroke={color} strokeWidth={1.5 / zoom} />
      <Line points={[m.x2 - nx * tick, m.y2 - ny * tick, m.x2 + nx * tick, m.y2 + ny * tick]} stroke={color} strokeWidth={1.5 / zoom} />
      <Label x={(m.x1 + m.x2) / 2} y={(m.y1 + m.y2) / 2} rotation={upright} offsetX={labelW / 2} offsetY={fs / 2 + 3 / zoom}>
        <Tag fill="#ffffff" stroke={color} strokeWidth={1 / zoom} cornerRadius={4 / zoom} />
        <Text text={text} fontSize={fs} fontStyle="bold" fill={color} padding={3 / zoom} fontFamily="Helvetica, Arial, sans-serif" />
      </Label>
    </Group>
  );
});
