import { useMemo } from 'react';
import type { PanelTemplate } from '../../types';
import { canvasMeasure, stripSizeMm, type LabelStrip } from '../../utils/labelLayout';
import { layoutStrip, primsToSvgInner } from '../../services/labels/labelRender';

/**
 * Aperçu d'une bande d'étiquettes. `pxPerMm` fixe la taille à l'écran ;
 * sans valeur, la bande occupe toute la largeur disponible.
 */
export function LabelStripView({
  strip,
  template,
  pxPerMm,
  onCellClick,
  highlightId,
}: {
  strip: LabelStrip;
  template: PanelTemplate;
  pxPerMm?: number;
  onCellClick?: (circuitId: string) => void;
  highlightId?: string | null;
}) {
  const size = stripSizeMm(template);
  const svgInner = useMemo(() => primsToSvgInner(layoutStrip(strip, template, canvasMeasure, 0, 0, highlightId)), [strip, template, highlightId]);
  const style = pxPerMm ? { width: size.width * pxPerMm, height: size.height * pxPerMm } : { width: '100%', aspectRatio: `${size.width} / ${size.height}` };
  return (
    <div className="relative shrink-0 bg-white" style={style}>
      <svg viewBox={`0 0 ${size.width} ${size.height}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none" dangerouslySetInnerHTML={{ __html: svgInner }} role="img" aria-label={`Étiquettes ${strip.rowName}`} />
      {onCellClick &&
        strip.cells.map((c) =>
          c.xMm + c.widthMm <= template.rowWidthMm + 0.01 ? (
            <button
              key={c.circuitId}
              type="button"
              onClick={() => onCellClick(c.circuitId)}
              aria-label={`Modifier l’étiquette ${c.number} ${c.text}`}
              className="absolute top-0 h-full hover:bg-brand-500/10 focus:bg-brand-500/15"
              style={{ left: `${((template.marginLeftMm + c.xMm) / size.width) * 100}%`, width: `${(c.widthMm / size.width) * 100}%` }}
            />
          ) : null,
        )}
    </div>
  );
}
