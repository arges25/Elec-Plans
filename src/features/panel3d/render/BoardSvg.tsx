import { memo, type Ref } from 'react';
import type { EnclosureModel, PanelProject, PlacedDevice } from '../types';
import { brandName, getProduct } from '../data/catalog';
import { DEVICE_FACE_MM, boardGeometry, moduleX, type BoardGeometry } from '../engine/geometry';
import { allLabelZones, freeIntervals } from '../engine/placement';
import { capacityOf, type Selection } from '../store/panelEditorStore';
import { DeviceFace } from './DeviceFace';
import { LabelCell } from './LabelCell';
import { BoardDefs } from './BoardDefs';

/**
 * Tableau électrique en « 3D légère » (SVG en millimètres) : coffret avec
 * épaisseur et ombre, capot, porte-étiquettes AU-DESSUS de chaque rangée,
 * rail DIN, appareils à leur largeur réelle (18 mm par module).
 * Composant purement visuel : l'interaction repose sur les attributs
 * data-device-id / data-zone-id / data-row lus par le parent.
 */

export interface DragPreview {
  productId: string;
  width: number;
  /** Appareil déplacé (ignoré pour le calcul des places libres). */
  ignoreId?: string;
  target: { row: number; start: number; ok: boolean } | null;
}

interface Props {
  project: PanelProject;
  enclosure: EnclosureModel;
  uid?: string;
  selection?: Selection;
  drag?: DragPreview | null;
  /** Appareil en cours de déplacement (affiché estompé). */
  movingId?: string | null;
  interactive?: boolean;
  viewBox?: string;
  className?: string;
  svgRef?: Ref<SVGSVGElement>;
  width?: number | string;
  height?: number | string;
  /** Mesure du texte via canvas (navigateur) ; désactiver pour le rendu hors écran. */
  preciseMeasure?: boolean;
}

export function depthOffset(geo: BoardGeometry): { dx: number; dy: number } {
  const dx = Math.min(geo.depthMm * 0.16, 18);
  return { dx, dy: dx * 0.7 };
}

export const BOARD_PAD_MM = 12;

/** viewBox englobant le coffret, sa profondeur et son ombre. */
export function boardViewBox(geo: BoardGeometry): { x: number; y: number; w: number; h: number } {
  const { dx, dy } = depthOffset(geo);
  return { x: -BOARD_PAD_MM, y: -BOARD_PAD_MM, w: geo.widthMm + dx + BOARD_PAD_MM * 2, h: geo.heightMm + dy + BOARD_PAD_MM * 2 };
}

function Enclosure({ geo, enclosure, uid }: { geo: BoardGeometry; enclosure: EnclosureModel; uid: string }) {
  const W = geo.widthMm;
  const Hh = geo.heightMm;
  const { dx, dy } = depthOffset(geo);
  const brand = enclosure.brand;
  const rx = brand === 'schneider' ? 14 : brand === 'hager' ? 6 : 10;
  return (
    <g>
      {/* Ombre portée */}
      <rect x={dx * 0.6 + 4} y={dy + 6} width={W} height={Hh} rx={rx} fill="#0f172a" opacity={0.28} filter={`url(#${uid}-blur)`} />
      {/* Épaisseur : côté droit et dessous */}
      <path d={`M${W - rx} 0H${W - rx + dx}L${W + dx} ${dy + rx}V${Hh + dy - rx}L${W} ${Hh - rx * 0.3}V${rx}Z`} fill={`url(#${uid}-side)`} />
      <path d={`M${rx} ${Hh}H${W - rx * 0.3}L${W + dx - rx} ${Hh + dy}H${rx + dx}Z`} fill={`url(#${uid}-bottom)`} />
      <path d={`M${W - rx * 0.3} ${Hh - rx * 0.3}L${W + dx} ${Hh + dy - rx}Q${W + dx} ${Hh + dy} ${W + dx - rx} ${Hh + dy}Z`} fill="#8e969f" />
      {/* Fond + capot (épaisseur de capot visible) */}
      <rect x={0} y={0} width={W} height={Hh} rx={rx} fill={`url(#${uid}-body)`} stroke="#aab2bb" strokeWidth={0.6} />
      <rect x={3} y={3} width={W - 6} height={Hh - 6} rx={Math.max(2, rx - 3)} fill={`url(#${uid}-cover)`} stroke="#cfd5dc" strokeWidth={0.5} />
      <rect x={4} y={3.6} width={W - 8} height={1.4} rx={0.7} fill="#ffffff" />
      {/* Identité propre à chaque gamme (sans reproduction de logo) */}
      {brand === 'legrand' && <rect x={12} y={Hh - 13} width={W - 24} height={6} rx={3} fill="#e3e6ea" stroke="#cfd4da" strokeWidth={0.4} />}
      {brand === 'schneider' && (
        <>
          <rect x={10} y={8} width={W - 20} height={1.2} rx={0.6} fill="#b6c0ca" />
          <rect x={10} y={Hh - 10} width={W - 20} height={1.2} rx={0.6} fill="#b6c0ca" />
        </>
      )}
      {brand === 'hager' && <rect x={3} y={3} width={W - 6} height={8} rx={Math.max(2, rx - 3)} fill="#d4d8dd" />}
      <text x={W - 10} y={Hh - 3.2 - (brand === 'legrand' ? 0 : 1)} textAnchor="end" fontFamily="Helvetica, Arial, sans-serif" fontSize={3.4} fontWeight={700} fill="#8a939d">
        {`${brandName(brand).toUpperCase()} · ${enclosure.family.toUpperCase()}`}
      </text>
      {!geo.measured && (
        <text x={10} y={Hh - 3.8} fontFamily="Helvetica, Arial, sans-serif" fontSize={3.2} fill="#b45309">
          Vue schématique : dimensions non renseignées
        </text>
      )}
    </g>
  );
}

function UnknownDevice({ w }: { w: number }) {
  return (
    <g>
      <rect x={0.2} y={0} width={w - 0.4} height={DEVICE_FACE_MM} rx={1} fill="#e5e7eb" stroke="#9ca3af" strokeWidth={0.3} />
      <text x={w / 2} y={DEVICE_FACE_MM / 2 + 1.5} textAnchor="middle" fontSize={4} fill="#6b7280">
        ?
      </text>
    </g>
  );
}

function DeviceAt({ d, geo, uid, faded }: { d: PlacedDevice; geo: BoardGeometry; uid: string; faded: boolean }) {
  const r = geo.rowGeo[d.row];
  if (!r) return null;
  const product = getProduct(d.productId);
  const w = d.moduleWidth * geo.moduleMm;
  return (
    <g transform={`translate(${moduleX(geo, d.startModule)} ${r.deviceY})`} data-device-id={d.id} opacity={faded ? 0.3 : 1} style={{ cursor: 'pointer' }}>
      <rect x={0.9} y={1.4} width={w} height={DEVICE_FACE_MM} rx={1} fill="#000" opacity={0.35} />
      {product ? <DeviceFace product={product} uid={uid} width={w} /> : <UnknownDevice w={w} />}
    </g>
  );
}

export const BoardSvg = memo(function BoardSvg({
  project,
  enclosure,
  uid = 'b3d',
  selection = null,
  drag = null,
  movingId = null,
  interactive = false,
  viewBox,
  className,
  svgRef,
  width,
  height,
  preciseMeasure = true,
}: Props) {
  const geo = boardGeometry(enclosure);
  const vb = boardViewBox(geo);
  const cap = capacityOf(project);
  const zones = allLabelZones(project.devices, geo.rows, project.labelStyle);
  const selectedDevice = selection?.kind === 'device' ? project.devices.find((d) => d.id === selection.id) : undefined;
  const selectedZone = selection?.kind === 'zone' ? zones.find((z) => z.leaderId === selection.id) : selectedDevice ? zones.find((z) => z.ids.includes(selectedDevice.id)) : undefined;
  const dragProduct = drag ? getProduct(drag.productId) : undefined;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox ?? `${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={`Tableau ${brandName(enclosure.brand)} ${enclosure.name}`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <BoardDefs uid={uid} />
      <Enclosure geo={geo} enclosure={enclosure} uid={uid} />

      {geo.rowGeo.map((r) => (
        <g key={r.index} data-row={r.index}>
          {/* Porte-étiquette au-dessus de la rangée */}
          <rect x={geo.windowX - 2.2} y={r.labelY - 1.4} width={geo.windowWidth + 4.4} height={r.labelH + 2.8} rx={1.8} fill="#dfe4ea" stroke="#b9c1ca" strokeWidth={0.4} />
          <rect x={geo.windowX} y={r.labelY} width={geo.windowWidth} height={r.labelH} fill="#fbfbf8" data-row-label={r.index} />
          {/* Ouverture du capot + rail DIN */}
          <rect x={geo.windowX - 1.2} y={r.openY} width={geo.windowWidth + 2.4} height={r.openH} rx={1.6} fill={`url(#${uid}-opening)`} />
          <g>
            <rect x={geo.windowX - 1.2} y={r.railY - 17.5} width={geo.windowWidth + 2.4} height={35} fill={`url(#${uid}-rail)`} />
            <rect x={geo.windowX - 1.2} y={r.railY - 17.5} width={geo.windowWidth + 2.4} height={35} fill={`url(#${uid}-railholes)`} />
            {Array.from({ length: geo.modulesPerRow + 1 }, (_, m) => (
              <line key={m} x1={moduleX(geo, m)} x2={moduleX(geo, m)} y1={r.railY - 13} y2={r.railY + 13} stroke="#5b646e" strokeWidth={0.25} opacity={0.35} />
            ))}
          </g>
          {drag &&
            freeIntervals(project.devices, cap, r.index, drag.ignoreId).map(([a, b]) => (
              <rect
                key={`${a}-${b}`}
                x={moduleX(geo, a) + 0.3}
                y={r.deviceY + 0.3}
                width={(b - a) * geo.moduleMm - 0.6}
                height={DEVICE_FACE_MM - 0.6}
                rx={1.2}
                fill="#60a5fa"
                opacity={0.28}
                stroke="#3b82f6"
                strokeWidth={0.4}
                strokeDasharray="1.5 1"
              />
            ))}
          {project.showModuleNumbers &&
            Array.from({ length: geo.modulesPerRow }, (_, m) => (
              <text key={m} x={moduleX(geo, m + 0.5)} y={r.openY + r.openH + 3.6} textAnchor="middle" fontSize={2.6} fontFamily="Helvetica, Arial, sans-serif" fill="#64748b">
                {m + 1}
              </text>
            ))}
        </g>
      ))}

      {/* Appareils */}
      {project.devices.map((d) => (
        <DeviceAt key={d.id} d={d} geo={geo} uid={uid} faded={d.id === movingId} />
      ))}

      {/* Ombre du bord de capot sur le haut des appareils + reflet */}
      {geo.rowGeo.map((r) => (
        <g key={`sh${r.index}`} pointerEvents="none">
          <rect x={geo.windowX - 1.2} y={r.openY} width={geo.windowWidth + 2.4} height={3.2} fill={`url(#${uid}-shade)`} />
          <rect x={geo.windowX} y={r.labelY} width={geo.windowWidth} height={r.labelH * 0.45} fill={`url(#${uid}-glass)`} />
        </g>
      ))}

      {/* Zones d'étiquettes (largeur = largeur des appareils) */}
      {zones.map((z) => {
        const r = geo.rowGeo[z.row];
        if (!r) return null;
        const x = moduleX(geo, z.start);
        const w = z.width * geo.moduleMm;
        const sel = selectedZone?.leaderId === z.leaderId;
        return (
          <g key={z.leaderId} data-zone-id={z.leaderId} style={{ cursor: 'pointer' }}>
            <rect x={x} y={r.labelY} width={w} height={r.labelH} fill={sel ? '#dbeafe' : '#ffffff'} stroke="#94a3b8" strokeWidth={0.3} />
            <LabelCell
              x={x}
              y={r.labelY}
              w={w}
              h={r.labelH}
              label={z.label}
              icon={z.icon}
              style={z.style}
              fontPt={project.print.fontSizePt}
              uid={`${uid}-z${z.leaderId}`}
              preciseMeasure={preciseMeasure}
              placeholder={interactive ? '+' : null}
            />
          </g>
        );
      })}

      {/* Sélection */}
      {selectedZone &&
        (() => {
          const r = geo.rowGeo[selectedZone.row];
          if (!r) return null;
          const x = moduleX(geo, selectedZone.start);
          const w = selectedZone.width * geo.moduleMm;
          return <rect x={x - 0.6} y={r.labelY - 0.6} width={w + 1.2} height={r.labelH + 1.2} rx={1} fill="none" stroke="#2563eb" strokeWidth={0.8} pointerEvents="none" />;
        })()}
      {selectedDevice &&
        geo.rowGeo[selectedDevice.row] &&
        (() => {
          const r = geo.rowGeo[selectedDevice.row];
          const x = moduleX(geo, selectedDevice.startModule);
          const w = selectedDevice.moduleWidth * geo.moduleMm;
          return <rect x={x - 0.8} y={r.deviceY - 0.8} width={w + 1.6} height={DEVICE_FACE_MM + 1.6} rx={1.6} fill="none" stroke="#2563eb" strokeWidth={1} pointerEvents="none" />;
        })()}

      {/* Silhouette de l'appareil pendant le glisser-déposer */}
      {drag?.target && dragProduct && geo.rowGeo[drag.target.row] && (
        <g transform={`translate(${moduleX(geo, drag.target.start)} ${geo.rowGeo[drag.target.row].deviceY})`} pointerEvents="none">
          <g opacity={0.75}>
            <DeviceFace product={dragProduct} uid={uid} width={drag.width * geo.moduleMm} />
          </g>
          <rect
            x={-0.4}
            y={-0.4}
            width={drag.width * geo.moduleMm + 0.8}
            height={DEVICE_FACE_MM + 0.8}
            rx={1.4}
            fill={drag.target.ok ? '#22c55e' : '#ef4444'}
            fillOpacity={0.18}
            stroke={drag.target.ok ? '#16a34a' : '#dc2626'}
            strokeWidth={0.9}
          />
        </g>
      )}
    </svg>
  );
});
