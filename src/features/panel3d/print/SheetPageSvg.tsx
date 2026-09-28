import type { PlacedStrip, SheetLayout } from './labelSheet';
import { PAGE_MARGIN_MM, pieceCaption } from './labelSheet';
import { LabelCell } from '../render/LabelCell';

/**
 * Page d'étiquettes en millimètres réels (width="…mm") : imprimée sans mise à
 * l'échelle, une étiquette de 18 mm mesure 18 mm sur le papier (après correction).
 */

interface Props {
  layout: SheetLayout;
  strips: PlacedStrip[];
  pageIndex: number;
  header: string;
  fontPt: number;
  /** Correction d'échelle de l'imprimante (1 = aucune). */
  scale: number;
  uid: string;
  preciseMeasure?: boolean;
  /** Aperçu écran : largeur CSS libre au lieu des millimètres. */
  screenWidth?: string;
}

export function SheetPageSvg({ layout, strips, pageIndex, header, fontPt, scale, uid, preciseMeasure = true, screenWidth }: Props) {
  const W = layout.pageWidthMm;
  const H = layout.pageHeightMm;
  const h = layout.labelHeightMm;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={screenWidth ?? `${W}mm`}
      height={screenWidth ? undefined : `${H}mm`}
      viewBox={`0 0 ${W} ${H}`}
      style={screenWidth ? { display: 'block', width: screenWidth, height: 'auto' } : { left: 0, top: 0 }}
    >
      <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
      <g transform={`translate(${PAGE_MARGIN_MM} ${PAGE_MARGIN_MM}) scale(${scale})`}>
        <text x={0} y={4} fontFamily="Helvetica, Arial, sans-serif" fontSize={3.3} fontWeight={700} fill="#111827">
          {header}
        </text>
        <text x={(W - PAGE_MARGIN_MM * 2) / scale} y={4} textAnchor="end" fontFamily="Helvetica, Arial, sans-serif" fontSize={2.8} fill="#6b7280">
          {`Page ${pageIndex + 1}/${layout.pages.length} · découper sur les pointillés`}
        </text>
        {strips.map(({ piece, x, y }) => (
          <g key={`${piece.row}-${piece.part}`} transform={`translate(${x} ${y})`}>
            <text x={0} y={-1.3} fontFamily="Helvetica, Arial, sans-serif" fontSize={2.8} fill="#6b7280">
              {pieceCaption(piece)}
            </text>
            <rect x={0} y={0} width={piece.widthMm} height={h} fill="#ffffff" />
            {piece.zones.map((z) => (
              <g key={z.leaderId}>
                <rect x={z.x} y={0} width={z.w} height={h} fill="none" stroke="#111827" strokeWidth={0.2} />
                <LabelCell x={z.x} y={0} w={z.w} h={h} label={z.label} icon={z.icon} style={z.style} fontPt={fontPt} uid={`${uid}-${piece.row}-${piece.part}-${z.leaderId}`} preciseMeasure={preciseMeasure} />
              </g>
            ))}
            <rect x={0} y={0} width={piece.widthMm} height={h} fill="none" stroke="#6b7280" strokeWidth={0.25} strokeDasharray="1.2 0.8" />
          </g>
        ))}
      </g>
    </svg>
  );
}
