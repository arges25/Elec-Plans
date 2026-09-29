import { memo } from 'react';
import type { LabelStyle } from '../types';
import { PT_TO_MM, approxMeasure, canvasMeasure, fitLabelText, type MeasureFn } from '../../../utils/labelLayout';
import { iconMarkup } from './icons';

/**
 * Contenu d'une zone d'étiquette (millimètres). Même rendu à l'écran, dans le
 * tableau 3D et à l'impression : l'étiquette imprimée correspond à l'aperçu.
 */

/** Réduction maximale du texte d'une étiquette (80 % de la taille choisie). */
export const LABEL_MIN_RATIO = 0.8;

export interface LabelLayout {
  icon: { x: number; y: number; size: number } | null;
  text: { x: number; y: number; lines: string[]; sizeMm: number; lineH: number; truncated: boolean } | null;
}

/** Disposition texte / icône dans une case w × h (mm). */
export function layoutLabel(
  w: number,
  h: number,
  label: string,
  icon: string | null,
  style: LabelStyle,
  fontPt: number,
  measure: MeasureFn = approxMeasure,
  /** Réduction maximale de la police (0,8 = « réduction légère », jamais de texte minuscule). */
  minRatio = LABEL_MIN_RATIO,
  maxLines: 1 | 2 | 3 = 2,
): LabelLayout {
  const pad = Math.min(0.8, w * 0.05);
  const text = label.trim();
  const wantIcon = Boolean(icon) && style !== 'text';
  const wantText = Boolean(text) && style !== 'icon';

  const fit = (bw: number, bh: number, lines: 1 | 2 | 3, cx: number, top: number) => {
    if (bw <= 1 || bh <= 1) return null;
    const f = fitLabelText(text, bw, bh, fontPt, lines, measure, true, minRatio);
    const sizeMm = f.fontSizePt * PT_TO_MM;
    const lineH = sizeMm * 1.12;
    const total = f.lines.length * lineH;
    return { x: cx, y: top + (bh - total) / 2 + sizeMm * 0.84, lines: f.lines, sizeMm, lineH, truncated: f.truncated };
  };

  if (wantIcon && !wantText) {
    const size = Math.max(2, Math.min(h - pad * 2, w - pad * 2));
    return { icon: { x: (w - size) / 2, y: (h - size) / 2, size }, text: null };
  }
  if (!wantIcon) {
    return { icon: null, text: wantText ? fit(w - pad * 2, h - pad * 2, maxLines, w / 2, pad) : null };
  }
  // Icône + texte : côte à côte si la case est large, empilés sinon
  if (w >= h * 1.9) {
    const size = h - pad * 2;
    const tx = pad + size + pad;
    const tw = w - tx - pad;
    return { icon: { x: pad, y: pad, size }, text: fit(tw, h - pad * 2, maxLines, tx + tw / 2, pad) };
  }
  const size = Math.min(h * 0.54, w - pad * 2);
  const textTop = pad + size + 0.2;
  return { icon: { x: (w - size) / 2, y: pad, size }, text: fit(w - pad * 2, h - textTop - pad * 0.5, 1, w / 2, textTop) };
}

interface CellProps {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  icon: string | null;
  style: LabelStyle;
  fontPt: number;
  /** Préfixe unique des dégradés de l'icône. */
  uid: string;
  /** Mesure précise du texte (navigateur) ; approximative sinon. */
  preciseMeasure?: boolean;
  placeholder?: string | null;
  /** Repère du circuit, imprimé petit dans le coin supérieur gauche. */
  refText?: string;
  minRatio?: number;
  maxLines?: 1 | 2 | 3;
  color?: string;
}

export const LabelCell = memo(function LabelCell({ x, y, w, h, label, icon, style, fontPt, uid, preciseMeasure = true, placeholder, refText, minRatio, maxLines, color = '#111827' }: CellProps) {
  // Place réservée au repère : l'étiquette garde toute sa hauteur, le repère est dans le coin
  const refSize = Math.min(2.6, h * 0.24);
  const refH = refText ? refSize + 0.4 : 0;
  const lay = layoutLabel(w, h - refH, label, icon, style, fontPt, preciseMeasure ? canvasMeasure : approxMeasure, minRatio, maxLines);
  const empty = !lay.icon && !lay.text;
  return (
    <g transform={`translate(${x} ${y})`}>
      {lay.icon && icon && (
        <svg x={lay.icon.x} y={lay.icon.y + refH} width={lay.icon.size} height={lay.icon.size} viewBox="0 0 64 64" dangerouslySetInnerHTML={{ __html: iconMarkup(icon, uid) }} />
      )}
      {lay.text && (
        <text fontFamily="Helvetica, Arial, sans-serif" fontWeight={700} fontSize={lay.text.sizeMm} fill={color} textAnchor="middle">
          {lay.text.lines.map((l, i) => (
            <tspan key={i} x={lay.text!.x} y={lay.text!.y + refH + i * lay.text!.lineH}>
              {l}
            </tspan>
          ))}
        </text>
      )}
      {refText && (
        <text x={0.6} y={refSize + 0.3} fontFamily="Helvetica, Arial, sans-serif" fontWeight={700} fontSize={refSize} fill="#374151">
          {refText}
        </text>
      )}
      {empty && placeholder && (
        <text x={w / 2} y={h / 2 + 1.1} fontFamily="Helvetica, Arial, sans-serif" fontSize={Math.min(3, w / 5)} fill="#94a3b8" textAnchor="middle">
          {placeholder}
        </text>
      )}
    </g>
  );
});
