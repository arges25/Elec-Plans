import { LineCapStyle, degrees, rgb, type Color, type PDFFont, type PDFPage } from 'pdf-lib';
import type { SymbolPrimitive } from '../../types';
import { transformSvgPath } from '../../utils/svgPath';
import { rotatePoint } from '../../utils/geometry';

/**
 * Outils de dessin PDF vectoriel.
 * Convention : les coordonnées « page » sont en points, origine en HAUT à gauche, Y vers le bas
 * (comme le plan) ; la conversion vers le repère PDF (Y vers le haut) est faite ici.
 */

export function hexToRgb(hex: string): Color {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.padEnd(6, '0');
  const n = Number.parseInt(full.slice(0, 6), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export const WHITE = rgb(1, 1, 1);
export const BLACK = rgb(0.07, 0.09, 0.15);
export const GRAY = rgb(0.42, 0.45, 0.5);
export const LIGHT_GRAY = rgb(0.9, 0.91, 0.92);
export const ORANGE = hexToRgb('#f97316');

const REPLACEMENTS: Record<string, string> = {
  '✓': 'OK',
  '✔': 'OK',
  '→': '->',
  '←': '<-',
  '≥': '>=',
  '≤': '<=',
  '≈': '~',
  '−': '-',
  ' ': ' ',
  ' ': ' ',
};

const charsetCache = new WeakMap<PDFFont, Set<number>>();

/** Remplace les caractères non encodables par la police standard (WinAnsi). */
export function sanitizeForFont(font: PDFFont, text: string): string {
  let set = charsetCache.get(font);
  if (!set) {
    set = new Set(font.getCharacterSet());
    charsetCache.set(font, set);
  }
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 63;
    if (ch === '\n' || set.has(cp)) out += ch;
    else out += REPLACEMENTS[ch] ?? (/\s/.test(ch) ? ' ' : '?');
  }
  return out;
}

export interface Ctx {
  page: PDFPage;
  /** Hauteur de la page (pt) pour la conversion de repère. */
  H: number;
}

/** Trace un chemin SVG déjà exprimé en coordonnées page (Y vers le bas). */
export function drawPath(
  ctx: Ctx,
  d: string,
  opts: { stroke?: Color; width?: number; fill?: Color; dash?: number[]; cap?: 'round' | 'butt' | 'square'; opacity?: number },
): void {
  ctx.page.drawSvgPath(d, {
    x: 0,
    y: ctx.H,
    borderColor: opts.stroke,
    borderWidth: opts.stroke ? (opts.width ?? 1) : undefined,
    color: opts.fill,
    borderDashArray: opts.dash && opts.dash.length ? opts.dash : undefined,
    borderLineCap: opts.cap === 'round' ? LineCapStyle.Round : opts.cap === 'square' ? LineCapStyle.Projecting : LineCapStyle.Butt,
    opacity: opts.opacity,
    borderOpacity: opts.opacity,
  });
}

export function drawLine(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: Color,
  thickness: number,
  cap: 'butt' | 'square' | 'round' = 'butt',
  dash?: number[],
): void {
  ctx.page.drawLine({
    start: { x: x1, y: ctx.H - y1 },
    end: { x: x2, y: ctx.H - y2 },
    color,
    thickness,
    lineCap: cap === 'round' ? LineCapStyle.Round : cap === 'square' ? LineCapStyle.Projecting : LineCapStyle.Butt,
    dashArray: dash,
  });
}

/** Texte : (x, y) = point d'ancrage en coordonnées page ; align horizontal ; y = ligne de base. */
export function drawText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  opts: { font: PDFFont; size: number; color?: Color; align?: 'left' | 'center' | 'right'; rotation?: number; maxWidth?: number },
): void {
  let t = sanitizeForFont(opts.font, text);
  let size = opts.size;
  if (opts.maxWidth) {
    while (size > 4 && opts.font.widthOfTextAtSize(t, size) > opts.maxWidth) size -= 0.25;
    if (opts.font.widthOfTextAtSize(t, size) > opts.maxWidth) {
      while (t.length > 1 && opts.font.widthOfTextAtSize(`${t}…`, size) > opts.maxWidth) t = t.slice(0, -1);
      t = `${t}…`;
    }
  }
  const w = opts.font.widthOfTextAtSize(t, size);
  const dx = opts.align === 'center' ? -w / 2 : opts.align === 'right' ? -w : 0;
  const rot = opts.rotation ?? 0;
  const off = rotatePoint({ x: dx, y: 0 }, rot);
  ctx.page.drawText(t, {
    x: x + off.x,
    y: ctx.H - (y + off.y),
    size,
    font: opts.font,
    color: opts.color ?? BLACK,
    rotate: degrees(-rot),
  });
}

/** Découpe un texte en lignes pour une largeur donnée. */
export function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of sanitizeForFont(font, text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Dessine un symbole (primitives de la boîte 40 × 40) en vectoriel.
 * @param tx, ty centre du symbole (pt, repère page) ; scale = pt par unité-symbole.
 */
export function drawSymbolPrimitives(
  ctx: Ctx,
  shapes: SymbolPrimitive[],
  color: string,
  tx: number,
  ty: number,
  rotation: number,
  scale: number,
  fonts: { bold: PDFFont; regular: PDFFont },
): void {
  const c = hexToRgb(color);
  const fillOf = (f: string | undefined) => (f === 'color' ? c : f === 'white' ? WHITE : undefined);
  const t = { tx, ty, rotation, scale };
  for (const s of shapes) {
    if (s.k === 'path') {
      drawPath(ctx, transformSvgPath(s.d, t), {
        stroke: s.stroke === false ? undefined : c,
        width: (s.sw ?? 2.2) * scale,
        fill: fillOf(s.fill),
        cap: 'round',
      });
    } else if (s.k === 'circle') {
      const p = rotatePoint({ x: s.cx * scale, y: s.cy * scale }, rotation);
      ctx.page.drawCircle({
        x: tx + p.x,
        y: ctx.H - (ty + p.y),
        size: s.r * scale,
        borderColor: s.stroke === false ? undefined : c,
        borderWidth: s.stroke === false ? undefined : (s.sw ?? 2.2) * scale,
        color: fillOf(s.fill),
      });
    } else {
      const font = s.bold === false ? fonts.regular : fonts.bold;
      const size = s.size * scale;
      // Centre vertical approximatif : ligne de base à +0,35 × taille sous le centre
      const p = rotatePoint({ x: s.x * scale, y: s.y * scale + size * 0.35 }, rotation);
      drawText(ctx, s.text, tx + p.x, ty + p.y, { font, size, color: s.fill === 'white' ? WHITE : c, align: 'center', rotation });
    }
  }
}

/** Logo MG Elec & Plans vectoriel (carré de `size` pt, coin haut-gauche en x, y). */
export function drawLogo(ctx: Ctx, x: number, y: number, size: number): void {
  const k = size / 512;
  const t = { tx: x, ty: y, rotation: 0, scale: k };
  drawPath(ctx, transformSvgPath('M112 0H400A112 112 0 0 1 512 112V400A112 112 0 0 1 400 512H112A112 112 0 0 1 0 400V112A112 112 0 0 1 112 0Z', t), {
    fill: hexToRgb('#111827'),
  });
  drawPath(ctx, transformSvgPath('M84 250V90h46l40 78 40-78h46v160h-40v-92l-34 64h-24l-34-64v92z', t), { fill: WHITE });
  drawPath(ctx, transformSvgPath('M419 118A74 74 0 1 0 431 180H364', t), { stroke: WHITE, width: 38 * k });
  drawPath(ctx, transformSvgPath('M112 300h290v130H112zM240 300v78M240 406v24M112 366h72', t), { stroke: hexToRgb('#9ca3af'), width: 12 * k });
  drawPath(ctx, transformSvgPath('M356 258l-62 108h44l-28 92 94-128h-46l34-72z', t), { fill: ORANGE, stroke: hexToRgb('#111827'), width: 8 * k });
}
