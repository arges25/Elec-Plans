import type { LabelStyle, PanelProject } from '../types';
import { allLabelZones, type LabelZone } from '../engine/placement';
import { capacityOf } from '../store/panelEditorStore';
import { brandName, getEnclosure } from '../data/catalog';
import { REFERENCE_NOT_PROVIDED } from '../constants';

/**
 * Mise en page des bandeaux d'étiquettes pour l'impression, en millimètres
 * physiques (jamais en pixels). Un bandeau trop large pour la page est coupé
 * entre deux étiquettes (repère « 1/2 », « 2/2 »).
 */

export const PAGE_MARGIN_MM = 10;
export const HEADER_MM = 9;
export const CAPTION_MM = 4.5;
export const STRIP_GAP_MM = 6;
const A4 = { w: 210, h: 297 };
const EPS = 1e-6;

export interface PieceZone {
  leaderId: string;
  /** Position depuis le bord gauche du morceau (mm). */
  x: number;
  w: number;
  label: string;
  icon: string | null;
  style: LabelStyle;
}

export interface StripPiece {
  row: number;
  part: number;
  parts: number;
  startModule: number;
  endModule: number;
  widthMm: number;
  zones: PieceZone[];
}

export interface PlacedStrip {
  piece: StripPiece;
  x: number;
  y: number;
}

export interface SheetLayout {
  pageWidthMm: number;
  pageHeightMm: number;
  orientation: 'portrait' | 'landscape';
  labelHeightMm: number;
  pages: PlacedStrip[][];
}

/** Positions où l'on peut couper un bandeau sans traverser une étiquette. */
function cuttable(zones: LabelZone[], pos: number): boolean {
  return !zones.some((z) => pos > z.start + EPS && pos < z.start + z.width - EPS);
}

/** Découpe d'une rangée en morceaux d'au plus `maxModules`. */
export function splitRow(zones: LabelZone[], modulesPerRow: number, maxModules: number): [number, number][] {
  if (modulesPerRow <= maxModules + EPS) return [[0, modulesPerRow]];
  const out: [number, number][] = [];
  let start = 0;
  while (start < modulesPerRow - EPS) {
    const limit = Math.min(modulesPerRow, start + maxModules);
    let end = limit;
    if (limit < modulesPerRow - EPS) {
      for (let p = limit; p > start + EPS; p -= 0.5) {
        if (cuttable(zones, p)) {
          end = p;
          break;
        }
      }
      // Étiquette plus large qu'une page : coupe franche à la limite
      if (end <= start + EPS) end = limit;
    }
    out.push([start, end]);
    start = end;
  }
  return out;
}

export function stripPieces(project: PanelProject, maxWidthMm: number): StripPiece[] {
  const cap = capacityOf(project);
  const moduleMm = project.print.moduleMm;
  const maxModules = Math.max(1, Math.floor((maxWidthMm + EPS) / moduleMm / 0.5) * 0.5);
  const zones = allLabelZones(project.devices, cap.rows, project.labelStyle);
  const pieces: StripPiece[] = [];
  for (let row = 0; row < cap.rows; row++) {
    const rz = zones.filter((z) => z.row === row);
    const ranges = splitRow(rz, cap.modulesPerRow, maxModules);
    ranges.forEach(([a, b], i) => {
      pieces.push({
        row,
        part: i + 1,
        parts: ranges.length,
        startModule: a,
        endModule: b,
        widthMm: (b - a) * moduleMm,
        zones: rz
          .filter((z) => z.start < b - EPS && z.start + z.width > a + EPS)
          .map((z) => {
            const s = Math.max(z.start, a);
            const e = Math.min(z.start + z.width, b);
            return { leaderId: z.leaderId, x: (s - a) * moduleMm, w: (e - s) * moduleMm, label: z.label, icon: z.icon, style: z.style };
          }),
      });
    });
  }
  return pieces;
}

/**
 * Pages A4 : portrait si les bandeaux y tiennent, sinon paysage.
 * `scale` = correction d'échelle de l'imprimante (1 = aucune) : la place
 * disponible est réduite d'autant pour que le bandeau corrigé tienne.
 */
export function layoutSheet(project: PanelProject, scale = 1): SheetLayout {
  const cap = capacityOf(project);
  const fullWidth = cap.modulesPerRow * project.print.moduleMm;
  const portraitWidth = (A4.w - PAGE_MARGIN_MM * 2) / scale;
  const orientation = fullWidth <= portraitWidth + EPS ? 'portrait' : 'landscape';
  const pageW = orientation === 'portrait' ? A4.w : A4.h;
  const pageH = orientation === 'portrait' ? A4.h : A4.w;
  const usableW = (pageW - PAGE_MARGIN_MM * 2) / scale;
  const usableH = (pageH - PAGE_MARGIN_MM * 2) / scale;
  const h = project.print.labelHeightMm;
  const block = CAPTION_MM + h + STRIP_GAP_MM;
  const pieces = stripPieces(project, usableW);
  const pages: PlacedStrip[][] = [];
  let page: PlacedStrip[] = [];
  let y = HEADER_MM;
  for (const piece of pieces) {
    if (y + CAPTION_MM + h > usableH + EPS && page.length) {
      pages.push(page);
      page = [];
      y = HEADER_MM;
    }
    page.push({ piece, x: 0, y: y + CAPTION_MM });
    y += block;
  }
  if (page.length) pages.push(page);
  return { pageWidthMm: pageW, pageHeightMm: pageH, orientation, labelHeightMm: h, pages };
}

/** En-tête des pages : projet, marque, gamme, coffret et référence. */
export function panelHeader(p: PanelProject): string {
  const enc = getEnclosure(p.enclosureId);
  if (!enc) return p.name;
  // Le nom du coffret contient en général déjà la gamme (« Coffret Drivia… »)
  const model = enc.name.toLowerCase().includes(enc.family.toLowerCase()) ? enc.name : `${enc.family} ${enc.name}`;
  return `${p.name} — ${brandName(enc.brand)} ${model} — ${enc.reference ?? REFERENCE_NOT_PROVIDED}`;
}

/** Légende au-dessus d'un bandeau : « Rangée 1 (1/2) ». */
export function pieceCaption(p: StripPiece): string {
  return `Rangée ${p.row + 1}${p.parts > 1 ? ` (${p.part}/${p.parts})` : ''}`;
}

/* ------------------------------------------------------------------ */
/* Calibration de l'imprimante (règle de 50 mm)                        */
/* ------------------------------------------------------------------ */

export const CALIBRATION_LENGTH_MM = 50;
const STORAGE_KEY = 'mg-panel3d-print-correction';

/** Correction en % enregistrée sur cet appareil (0 = aucune). */
export function loadCorrectionPercent(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) && Math.abs(v) < 20 ? v : 0;
  } catch {
    return 0;
  }
}

export function saveCorrectionPercent(pct: number): void {
  try {
    if (pct === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(pct));
  } catch {
    /* stockage indisponible : correction non mémorisée */
  }
}

/**
 * Correction à partir de la mesure de la règle imprimée.
 * Ex. règle de 50 mm mesurée 49,4 mm alors que la correction était de 0 % → +1,21 %.
 */
export function correctionFromMeasure(measuredMm: number, currentPercent = 0): number {
  if (!(measuredMm > 0)) throw new Error('Mesure invalide');
  const ratio = CALIBRATION_LENGTH_MM / measuredMm;
  if (ratio < 0.8 || ratio > 1.25) throw new Error('Mesure incohérente (écart supérieur à 20 %)');
  const scale = (1 + currentPercent / 100) * ratio;
  return Math.round((scale - 1) * 10000) / 100;
}

export function percentToScale(pct: number): number {
  return 1 + pct / 100;
}
