import { memo, type Ref } from 'react';
import type { BoardDoc, EnclosureModel } from '../types';
import { brandName, getProduct } from '../data/catalog';
import { REFERENCE_NOT_PROVIDED } from '../constants';
import { allLabelZones, freeIntervals } from '../engine/placement';
import { formatPercent, occupancy, rowTotal, totalsRuleLabel } from '../engine/boardOps';
import { SCHEMA_DEVICE_H, SCHEMA_LABEL_H, SCHEMA_PAD, SCHEMA_REF_H, SCHEMA_RULER_H, schemaGeometry, schemaX, type SchemaGeometry } from '../engine/schemaGeometry';
import { capacityOf, displayLabel, type Selection } from '../store/panelEditorStore';
import { SchemaDefs, SchemaDevice } from './SchemaDevice';
import { LabelCell } from './LabelCell';
import type { DragPreview } from './BoardSvg';

/**
 * Vue « Schéma tableau » : vue technique face à face, sans perspective, pensée
 * pour travailler et imprimer. Pour chaque rangée : repères au-dessus, appareils
 * au centre, étiquettes dessous, modules libres en gris.
 * Composant visuel : l'interaction passe par les attributs data-* lus par le parent.
 */

const FONT = 'Helvetica, Arial, sans-serif';
/** Taille du texte des étiquettes sous les appareils (en points équivalents). */
const LABEL_FONT_PT = 10.5;

interface Props {
  doc: BoardDoc;
  enclosure: EnclosureModel;
  uid?: string;
  selection?: Selection;
  drag?: DragPreview | null;
  movingId?: string | null;
  interactive?: boolean;
  viewBox?: string;
  className?: string;
  svgRef?: Ref<SVGSVGElement>;
  width?: number | string;
  height?: number | string;
  preciseMeasure?: boolean;
  /** Masque l'en-tête (titre + occupation). */
  hideHeader?: boolean;
  /** Position dans un SVG parent (page imprimée). */
  x?: number;
  y?: number;
  /** Ligne d'information en haut à droite (projet, date). */
  info?: string;
}

export function schemaViewBox(geo: SchemaGeometry): { x: number; y: number; w: number; h: number } {
  return { x: 0, y: 0, w: geo.width, h: geo.height };
}

export function schemaTitle(doc: BoardDoc, enc: EnclosureModel): string {
  const occ = occupancy(doc.devices, capacityOf(doc));
  return `${doc.title} - ${enc.rows} rangée${enc.rows > 1 ? 's' : ''} de ${enc.modulesPerRow} modules - ${formatPercent(occ.freePercent)} libre = ${String(occ.freeModules).replace('.', ',')} modules`;
}

export const SchemaSvg = memo(function SchemaSvg({
  doc,
  enclosure,
  uid = 'sch',
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
  hideHeader = false,
  x,
  y,
  info,
}: Props) {
  const geo = schemaGeometry(enclosure);
  const cap = capacityOf(doc);
  const occ = occupancy(doc.devices, cap);
  const zones = allLabelZones(doc.devices, geo.rows.length, doc.labelStyle);
  const selectedDevice = selection?.kind === 'device' ? doc.devices.find((d) => d.id === selection.id) : undefined;
  const selectedZone = selection?.kind === 'zone' ? zones.find((z) => z.leaderId === selection.id) : undefined;
  const dragProduct = drag ? getProduct(drag.productId) : undefined;
  const alert = doc.minFreePercent !== null && occ.freePercent + 1e-9 < doc.minFreePercent;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      x={x}
      y={y}
      viewBox={viewBox ?? `0 0 ${geo.width} ${geo.height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={`Schéma ${doc.title}`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <SchemaDefs uid={uid} />
      <rect x={0} y={0} width={geo.width} height={geo.height} fill="#ffffff" />

      {!hideHeader && (
        <g>
          <text x={SCHEMA_PAD} y={SCHEMA_PAD + 8} fontFamily={FONT} fontSize={7.4} fontWeight={800} fill="#111827" data-testid="schema-title">
            {schemaTitle(doc, enclosure)}
          </text>
          <text x={SCHEMA_PAD} y={SCHEMA_PAD + 15} fontFamily={FONT} fontSize={3.4} fill="#4b5563">
            {`${brandName(enclosure.brand)} · ${enclosure.family} · Réf. ${enclosure.reference ?? REFERENCE_NOT_PROVIDED} · ${occ.totalModules} modules · ${String(occ.usedModules).replace('.', ',')} utilisés · ${String(occ.freeModules).replace('.', ',')} libres (${formatPercent(occ.freePercent)})${occ.reservedModules ? ` dont ${String(occ.reservedModules).replace('.', ',')} réservé${occ.reservedModules > 1 ? 's' : ''}` : ''}`}
          </text>
          {alert && (
            <text x={SCHEMA_PAD} y={SCHEMA_PAD + 20.5} fontFamily={FONT} fontSize={3.4} fontWeight={700} fill="#b91c1c">
              {`Réserve minimale de ${doc.minFreePercent} % non respectée`}
            </text>
          )}
          {info && (
            <text x={geo.width - SCHEMA_PAD} y={SCHEMA_PAD + 20.5} textAnchor="end" fontFamily={FONT} fontSize={3} fill="#374151">
              {info}
            </text>
          )}
          {doc.totals.kind !== 'none' && (
            <text x={geo.width - SCHEMA_PAD} y={SCHEMA_PAD + 15} textAnchor="end" fontFamily={FONT} fontSize={2.8} fill="#6b7280">
              {`Totaux : ${totalsRuleLabel(doc.totals)}`}
            </text>
          )}
        </g>
      )}

      {geo.rows.map((r) => {
        const total = rowTotal(doc.devices, r.index, doc.totals);
        const rowOcc = occupancy(doc.devices, cap, r.index);
        const midY = r.devY + SCHEMA_DEVICE_H / 2;
        return (
          <g key={r.index} data-row={r.index}>
            {r.index > 0 && <line x1={SCHEMA_PAD} x2={geo.width - SCHEMA_PAD} y1={r.top - 6} y2={r.top - 6} stroke="#d1d5db" strokeWidth={0.5} />}
            {/* Colonne de gauche : rangée, total selon la règle choisie, informations connues */}
            <text x={SCHEMA_PAD} y={midY - 12} fontFamily={FONT} fontSize={3.4} fontWeight={800} fill="#6b7280">
              {`RANGÉE ${r.index + 1}`}
            </text>
            {total.value !== null ? (
              <text x={SCHEMA_PAD} y={midY - 3} fontFamily={FONT} fontSize={4.8} fontWeight={800} fill="#111827" data-testid={`row-total-${r.index}`}>
                {`TOTAL = ${String(total.value).replace('.', ',')}A`}
              </text>
            ) : (
              <text x={SCHEMA_PAD} y={midY - 3} fontFamily={FONT} fontSize={3.2} fill="#374151">
                {`${total.breakerCount} disjoncteur${total.breakerCount > 1 ? 's' : ''}`}
              </text>
            )}
            {total.rcdRatings.length > 0 && (
              <text x={SCHEMA_PAD} y={midY + 3.5} fontFamily={FONT} fontSize={3} fill="#4b5563">
                {`Diff. ${total.rcdRatings.map((v) => `${v} A`).join(' + ')}`}
              </text>
            )}
            <text x={SCHEMA_PAD} y={midY + 9.5} fontFamily={FONT} fontSize={3} fill={rowOcc.freeModules > 0 ? '#4b5563' : '#b91c1c'}>
              {rowOcc.freeModules > 0 ? `${String(rowOcc.freeModules).replace('.', ',')} mod. libre${rowOcc.freeModules > 1 ? 's' : ''}` : 'Rangée complète'}
            </text>

            {/* Règle des modules */}
            {doc.showModuleNumbers &&
              Array.from({ length: geo.modulesPerRow }, (_, m) => (
                <g key={m}>
                  <rect x={schemaX(geo, m)} y={r.rulerY} width={geo.moduleW} height={SCHEMA_RULER_H - 0.6} fill="#f3f4f6" stroke="#e5e7eb" strokeWidth={0.25} />
                  <text x={schemaX(geo, m + 0.5)} y={r.rulerY + 3.4} textAnchor="middle" fontFamily={FONT} fontSize={2.6} fill="#9ca3af">
                    {m + 1}
                  </text>
                </g>
              ))}

            {/* Modules libres (gris) */}
            {freeIntervals(doc.devices, cap, r.index).flatMap(([a, b]) => {
              const cells: [number, number][] = [];
              let x = a;
              while (x < b - 1e-6) {
                const nx = Math.min(b, Math.floor(x + 1 + 1e-6));
                cells.push([x, nx]);
                x = nx;
              }
              return cells.map(([s, e]) => (
                <rect
                  key={`f${s}`}
                  x={schemaX(geo, s) + 0.5}
                  y={r.devY}
                  width={(e - s) * geo.moduleW - 1}
                  height={SCHEMA_DEVICE_H}
                  fill="#c9cbcf"
                  data-free-row={r.index}
                  data-free-start={s}
                />
              ));
            })}
          </g>
        );
      })}

      {/* Appareils */}
      {doc.devices.map((d) => {
        const r = geo.rows[d.row];
        const product = getProduct(d.productId);
        if (!r || !product) return null;
        const x = schemaX(geo, d.startModule);
        const w = d.moduleWidth * geo.moduleW;
        return (
          <g key={d.id} transform={`translate(${x} ${r.devY})`} data-device-id={d.id} opacity={d.id === movingId ? 0.3 : 1} style={{ cursor: 'pointer' }}>
            <SchemaDevice product={product} width={w} uid={uid} />
          </g>
        );
      })}

      {/* Repères (au-dessus) */}
      {doc.devices.map((d) => {
        const r = geo.rows[d.row];
        if (!r) return null;
        const x = schemaX(geo, d.startModule);
        const w = d.moduleWidth * geo.moduleW;
        const cx = x + w / 2;
        const ref = d.circuitRef.trim();
        const size = Math.min(7.2, (w - 1) / Math.max(1, ref.length * 0.6));
        return (
          <g key={`r${d.id}`} data-ref-id={d.id} style={{ cursor: 'pointer' }}>
            <rect x={x} y={r.refY - 1} width={w} height={SCHEMA_REF_H} fill="transparent" />
            {ref ? (
              <>
                <text x={cx} y={r.refY + 7.6} textAnchor="middle" fontFamily={FONT} fontSize={size} fontWeight={800} fill="#111827">
                  {ref}
                </text>
                <line x1={cx} x2={cx} y1={r.refY + 9.4} y2={r.refY + SCHEMA_REF_H} stroke="#6b7280" strokeWidth={0.35} />
              </>
            ) : (
              interactive && (
                <text x={cx} y={r.refY + 7} textAnchor="middle" fontFamily={FONT} fontSize={3.6} fill="#cbd5e1">
                  +
                </text>
              )
            )}
          </g>
        );
      })}

      {/* Étiquettes (sous les appareils) */}
      {zones.map((z) => {
        const r = geo.rows[z.row];
        if (!r) return null;
        const x = schemaX(geo, z.start);
        const w = z.width * geo.moduleW;
        const text = displayLabel(doc, z);
        const empty = !text.trim() && !(z.icon && z.style !== 'text');
        return (
          <g key={`z${z.leaderId}`} data-zone-id={z.leaderId} style={{ cursor: 'pointer' }}>
            <rect x={x + 0.3} y={r.labelY} width={w - 0.6} height={SCHEMA_LABEL_H} fill="transparent" stroke={interactive && empty ? '#e2e8f0' : 'none'} strokeWidth={0.4} strokeDasharray="1.4 1" />
            <LabelCell
              x={x}
              y={r.labelY}
              w={w}
              h={SCHEMA_LABEL_H}
              label={text}
              icon={z.icon}
              style={z.style}
              fontPt={LABEL_FONT_PT}
              uid={`${uid}-l${z.leaderId}`}
              preciseMeasure={preciseMeasure}
              placeholder={interactive ? '+' : null}
              maxLines={3}
            />
          </g>
        );
      })}

      {/* Sélection (bleu) */}
      {selectedDevice &&
        geo.rows[selectedDevice.row] &&
        (() => {
          const r = geo.rows[selectedDevice.row];
          const x = schemaX(geo, selectedDevice.startModule);
          const w = selectedDevice.moduleWidth * geo.moduleW;
          return (
            <rect x={x - 0.9} y={r.refY - 1.5} width={w + 1.8} height={r.bottom - r.refY + 2.5} rx={1.6} fill="#2563eb" fillOpacity={0.06} stroke="#2563eb" strokeWidth={1.1} pointerEvents="none" data-testid="schema-selection" />
          );
        })()}
      {selectedZone &&
        geo.rows[selectedZone.row] &&
        (() => {
          const r = geo.rows[selectedZone.row];
          const x = schemaX(geo, selectedZone.start);
          const w = selectedZone.width * geo.moduleW;
          return <rect x={x - 0.6} y={r.labelY - 0.6} width={w + 1.2} height={SCHEMA_LABEL_H + 1.2} rx={1} fill="#2563eb" fillOpacity={0.08} stroke="#2563eb" strokeWidth={0.9} pointerEvents="none" />;
        })()}
      {selection?.kind === 'slot' &&
        geo.rows[selection.row] &&
        (() => {
          const r = geo.rows[selection.row];
          return (
            <rect x={schemaX(geo, selection.start) + 0.3} y={r.devY - 0.5} width={geo.moduleW - 0.6} height={SCHEMA_DEVICE_H + 1} rx={1} fill="#2563eb" fillOpacity={0.15} stroke="#2563eb" strokeWidth={1} pointerEvents="none" />
          );
        })()}

      {/* Glisser-déposer : places disponibles en vert, silhouette verte ou rouge */}
      {drag &&
        geo.rows.map((r) =>
          freeIntervals(doc.devices, cap, r.index, drag.ignoreId).map(([a, b]) => (
            <rect
              key={`d${r.index}-${a}`}
              x={schemaX(geo, a) + 0.4}
              y={r.devY + 0.4}
              width={(b - a) * geo.moduleW - 0.8}
              height={SCHEMA_DEVICE_H - 0.8}
              rx={1}
              fill="#22c55e"
              fillOpacity={0.14}
              stroke="#16a34a"
              strokeWidth={0.4}
              strokeDasharray="1.6 1"
              pointerEvents="none"
            />
          )),
        )}
      {drag?.target && dragProduct && geo.rows[drag.target.row] && (
        <g transform={`translate(${schemaX(geo, drag.target.start)} ${geo.rows[drag.target.row].devY})`} pointerEvents="none" data-testid="drag-ghost">
          <g opacity={0.72}>
            <SchemaDevice product={dragProduct} width={drag.width * geo.moduleW} uid={uid} />
          </g>
          <rect
            x={-0.6}
            y={-0.6}
            width={drag.width * geo.moduleW + 1.2}
            height={SCHEMA_DEVICE_H + 1.2}
            rx={1.4}
            fill={drag.target.ok ? '#22c55e' : '#ef4444'}
            fillOpacity={0.16}
            stroke={drag.target.ok ? '#16a34a' : '#dc2626'}
            strokeWidth={1.1}
          />
        </g>
      )}
    </svg>
  );
});
