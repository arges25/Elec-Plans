import type { ElectricalCircuit, Label, PanelRow, PanelTemplate } from '../types';
import { cellWidthMm } from '../data/electricalPanelTemplates';

/** 1 point typographique = 0,3528 mm. */
export const PT_TO_MM = 25.4 / 72;

/** Mesure d'un texte : largeur en mm pour une taille en points. */
export type MeasureFn = (text: string, sizePt: number, bold?: boolean) => number;

/** Mesure approximative (tests / repli) : Helvetica ≈ 0,55 em par caractère. */
export const approxMeasure: MeasureFn = (text, sizePt, bold) => text.length * sizePt * PT_TO_MM * (bold ? 0.6 : 0.55);

let canvasCtx: CanvasRenderingContext2D | null = null;

/** Mesure précise via canvas (navigateur). */
export const canvasMeasure: MeasureFn = (text, sizePt, bold) => {
  if (typeof document === 'undefined') return approxMeasure(text, sizePt, bold);
  if (!canvasCtx) canvasCtx = document.createElement('canvas').getContext('2d');
  if (!canvasCtx) return approxMeasure(text, sizePt, bold);
  canvasCtx.font = `${bold ? 'bold ' : ''}100px Helvetica, Arial, sans-serif`;
  return (canvasCtx.measureText(text).width / 100) * sizePt * PT_TO_MM;
};

export interface FittedText {
  lines: string[];
  fontSizePt: number;
  /** true si le texte a dû être tronqué (…). */
  truncated: boolean;
}

function wrap(words: string[], maxWidth: number, size: number, measure: MeasureFn, bold: boolean): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (!line || measure(test, size, bold) <= maxWidth) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Ajuste un texte dans une case : réduit légèrement la police si nécessaire,
 * passe sur 2 lignes maximum, ne dépasse jamais la case (troncature « … » en dernier recours).
 */
export function fitLabelText(
  text: string,
  boxWidthMm: number,
  boxHeightMm: number,
  baseFontPt: number,
  maxLines: 1 | 2,
  measure: MeasureFn = approxMeasure,
  bold = true,
  minRatio = 0.62,
): FittedText {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return { lines: [], fontSizePt: baseFontPt, truncated: false };
  const words = clean.split(' ');
  const minSize = Math.max(3.5, baseFontPt * minRatio);
  const lineHeight = 1.12;
  for (let size = baseFontPt; size >= minSize - 1e-9; size -= 0.25) {
    const heightFor = (n: number) => n * size * PT_TO_MM * lineHeight;
    if (measure(clean, size, bold) <= boxWidthMm && heightFor(1) <= boxHeightMm) return { lines: [clean], fontSizePt: size, truncated: false };
    if (maxLines === 2 && heightFor(2) <= boxHeightMm) {
      const lines = wrap(words, boxWidthMm, size, measure, bold);
      if (lines.length <= 2 && lines.every((l) => measure(l, size, bold) <= boxWidthMm)) return { lines, fontSizePt: size, truncated: false };
    }
  }
  // Dernier recours : taille minimale (réduite si la hauteur l'exige) + troncature « … »
  let size = minSize;
  while (size > 3 && size * PT_TO_MM * lineHeight > boxHeightMm) size -= 0.25;
  const truncate = (s: string) => {
    if (measure(s, size, bold) <= boxWidthMm) return s;
    let t = s;
    while (t.length > 1 && measure(`${t}…`, size, bold) > boxWidthMm) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  };
  const twoLines = maxLines === 2 && 2 * size * PT_TO_MM * lineHeight <= boxHeightMm;
  if (!twoLines) return { lines: [truncate(clean)], fontSizePt: size, truncated: true };
  const wrapped = wrap(words, boxWidthMm, size, measure, bold);
  const first = truncate(wrapped[0] ?? '');
  const second = wrapped.length > 1 ? truncate(wrapped.slice(1).join(' ')) : '';
  return { lines: second ? [first, second] : [first], fontSizePt: size, truncated: true };
}

/* ------------------------------------------------------------------ */
/* Bandes d'étiquettes                                                 */
/* ------------------------------------------------------------------ */

export interface LabelCell {
  circuitId: string;
  number: string;
  text: string;
  icon?: string;
  modules: number;
  kind: ElectricalCircuit['kind'];
  /** Position (mm) depuis le bord gauche de la zone d'étiquettes. */
  xMm: number;
  widthMm: number;
  customized: boolean;
}

export interface LabelStrip {
  rowId: string;
  rowName: string;
  cells: LabelCell[];
  usedModules: number;
  /** Modules au-delà de la capacité de la rangée. */
  overflow: number;
}

/** Texte d'étiquette proposé à partir d'un circuit. */
export function proposedLabelText(c: ElectricalCircuit): string {
  if (c.kind === 'spare') return c.name || 'Réserve';
  return c.name;
}

/** Construit les bandes d'étiquettes (une par rangée) à partir des circuits. */
export function buildLabelStrips(rows: PanelRow[], circuits: ElectricalCircuit[], labels: Label[], template: PanelTemplate): LabelStrip[] {
  const labelByCircuit = new Map(labels.map((l) => [l.circuitId, l]));
  return rows.map((row) => {
    const rowCircuits = circuits.filter((c) => c.rowId === row.id).sort((a, b) => a.order - b.order);
    let x = 0;
    let used = 0;
    const cells: LabelCell[] = rowCircuits.map((c) => {
      const override = labelByCircuit.get(c.id);
      const widthMm = cellWidthMm(template, c.modules);
      const cell: LabelCell = {
        circuitId: c.id,
        number: c.number,
        text: override?.text ?? proposedLabelText(c),
        icon: override?.icon === null ? undefined : (override?.icon ?? c.icon),
        modules: c.modules,
        kind: c.kind,
        xMm: x,
        widthMm,
        customized: Boolean(override && (override.text !== undefined || override.icon !== undefined)),
      };
      x += widthMm;
      used += c.modules;
      return cell;
    });
    return { rowId: row.id, rowName: row.name, cells, usedModules: used, overflow: Math.max(0, used - template.modulesPerRow) };
  });
}

/** Dimensions extérieures d'une bande imprimée (marges comprises). */
export function stripSizeMm(template: PanelTemplate): { width: number; height: number } {
  return {
    width: template.marginLeftMm + template.rowWidthMm + template.marginRightMm,
    height: template.marginTopMm + template.labelHeightMm + template.marginBottomMm,
  };
}
