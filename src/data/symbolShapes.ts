import type { ElectricalSymbolDefinition, PrimitiveFill, SymbolCategoryId, SymbolPrimitive, SymbolRole } from '../types';

/**
 * Briques de dessin des symboles électriques.
 *
 * Chaque symbole est dessiné dans une boîte de 40 × 40 unités centrée sur (0, 0).
 * Le côté « mur » est en haut : les symboles muraux ont leur dos à y = WALL_BACK.
 * Les mêmes primitives servent à l'éditeur (Konva), aux vignettes (SVG) et au PDF (vectoriel).
 */

export const WALL_BACK = -16;
export const SYMBOL_BOX = 40;
const SW = 2.2;

export const CATEGORY_COLORS: Record<SymbolCategoryId, string> = {
  prises: '#1d4ed8',
  reseau: '#7c3aed',
  commandes: '#0f766e',
  eclairage: '#b45309',
  ventilation: '#0e7490',
  chauffage: '#dc2626',
  electromenager: '#475569',
  buanderie: '#0369a1',
  securite: '#be123c',
  domotique: '#4f46e5',
  exterieur: '#15803d',
  tableau: '#111827',
  divers: '#6b7280',
};

/* ------------------------------------------------------------------ */
/* Primitives de base                                                  */
/* ------------------------------------------------------------------ */

export const p = (d: string, fill: PrimitiveFill = 'none', sw = SW): SymbolPrimitive => ({ k: 'path', d, fill, stroke: true, sw });
export const filled = (d: string): SymbolPrimitive => ({ k: 'path', d, fill: 'color', stroke: false });
export const c = (cx: number, cy: number, r: number, fill: PrimitiveFill = 'none', sw = SW): SymbolPrimitive => ({
  k: 'circle',
  cx,
  cy,
  r,
  fill,
  stroke: true,
  sw,
});
export const dot = (cx: number, cy: number, r: number): SymbolPrimitive => ({ k: 'circle', cx, cy, r, fill: 'color', stroke: false });
export const t = (text: string, x = 0, y = 0, size = 8, bold = true): SymbolPrimitive => ({ k: 'text', x, y, text, size, bold });
export const rect = (x: number, y: number, w: number, h: number, fill: PrimitiveFill = 'none', sw = SW): SymbolPrimitive =>
  p(`M${x} ${y}H${x + w}V${y + h}H${x}Z`, fill, sw);
export const line = (x1: number, y1: number, x2: number, y2: number, sw = SW): SymbolPrimitive => p(`M${x1} ${y1}L${x2} ${y2}`, 'none', sw);

/** Petit trait de liaison vers le mur. */
export const wallStem = (fromY: number): SymbolPrimitive => line(0, WALL_BACK, 0, fromY);

/* ------------------------------------------------------------------ */
/* Prises                                                              */
/* ------------------------------------------------------------------ */

/** Épaisseur des traits des prises : un peu plus forte pour rester lisible en petit. */
const SW_S = 2.5;
/** Hauteur (y) du sommet de l'arc des prises, où arrive le raccordement au mur. */
const SOCKET_TOP = -9;

/**
 * Prise de courant (symbole normalisé des plans d'installation, NF EN 60617) :
 * trait de raccordement au mur, barre de terre (2P+T) tangente au sommet,
 * arc de la prise ouvert côté pièce.
 */
export function socketGlyph(cx = 0, r = 10, earth = true, fillArc: PrimitiveFill = 'white'): SymbolPrimitive[] {
  const top = SOCKET_TOP;
  const base = top + r;
  const shapes: SymbolPrimitive[] = [
    line(cx, WALL_BACK, cx, top, SW_S),
    p(`M${cx - r} ${base}A${r} ${r} 0 0 1 ${cx + r} ${base}${fillArc === 'color' ? 'Z' : ''}`, fillArc, SW_S),
  ];
  if (earth) shapes.push(line(round(cx - r * 0.85), top, round(cx + r * 0.85), top, SW_S));
  return shapes;
}

export function socket(label?: string, opts: { fill?: PrimitiveFill; earth?: boolean } = {}): SymbolPrimitive[] {
  const shapes = socketGlyph(0, 10, opts.earth ?? true, opts.fill ?? 'white');
  if (label) shapes.push(t(label, 0, 9, label.length > 3 ? 6.5 : 8));
  return shapes;
}

/** Bloc de prises : une barre de terre commune, un arc par prise. */
export function multiSocket(count: 2 | 3 | 4): SymbolPrimitive[] {
  const r = count === 2 ? 7.5 : count === 3 ? 5.6 : 4.4;
  const step = count === 2 ? 16 : count === 3 ? 12 : 9.4;
  const start = -((count - 1) * step) / 2;
  const half = start - r;
  const shapes: SymbolPrimitive[] = [line(0, WALL_BACK, 0, SOCKET_TOP, SW_S), line(round(half), SOCKET_TOP, round(-half), SOCKET_TOP, SW_S)];
  for (let i = 0; i < count; i++) {
    const cx = round(start + i * step);
    shapes.push(p(`M${round(cx - r)} ${SOCKET_TOP + r}A${r} ${r} 0 0 1 ${round(cx + r)} ${SOCKET_TOP + r}`, 'white', SW_S));
  }
  return shapes;
}

/** Prise commandée : prise 2P+T + petit interrupteur (rond, levier, trait) accolé. */
export function switchedSocket(): SymbolPrimitive[] {
  return [...socketGlyph(-4), c(12, -5, 2.6, 'white', 1.9), line(13.5, -2.9, 17.8, 3.3, 1.9), line(17.8, 3.3, 20.8, 1.2, 1.9)];
}

/** Prise étanche : prise 2P+T + goutte d'eau. */
export function waterproofSocket(): SymbolPrimitive[] {
  return [...socketGlyph(), filled('M0 -6.2C1.7 -3.7 3 -2.1 3 -0.5A3 3 0 0 1 -3 -0.5C-3 -2.1 -1.7 -3.7 0 -6.2Z'), t('IP', 0, 9, 6)];
}

/** Pictogramme de prise informatique RJ45 (face du connecteur). */
function rj45Port(cy: number): SymbolPrimitive[] {
  return [p(`M-6 ${cy - 4}H6V${cy + 2}H3V${cy + 4}H-3V${cy + 2}H-6Z`, 'none', 1.6), line(-3, cy - 1.5, 3, cy - 1.5, 1.2)];
}

/** Pictogramme de prise coaxiale (TV / SAT). */
function coaxPort(cy: number): SymbolPrimitive[] {
  return [c(0, cy, 4.8, 'none', 1.6), dot(0, cy, 1.7)];
}

/**
 * Prise de communication : boîtier contre le mur, pictogramme lisible
 * (RJ45, coaxial) ou texte, et libellé sous le boîtier.
 */
export function commOutlet(label: string, sub?: string): SymbolPrimitive[] {
  const shapes: SymbolPrimitive[] = [rect(-12, WALL_BACK, 24, 15, 'white', 2.2)];
  const cy = WALL_BACK + 7.5;
  if (label === 'RJ45') shapes.push(...rj45Port(cy));
  else if (label === 'TV' || label === 'SAT' || label === 'COAX') shapes.push(...coaxPort(cy));
  else shapes.push(t(label, 0, cy + 0.3, label.length > 2 ? 7 : 8.5));
  const iconic = label === 'RJ45' || label === 'TV' || label === 'SAT' || label === 'COAX';
  if (iconic) shapes.push(t(label, 0, 5.5, label.length > 3 ? 6.5 : 7.5));
  if (sub) shapes.push(t(sub, 0, iconic ? 12.5 : 6, 5.5));
  return shapes;
}

/* ------------------------------------------------------------------ */
/* Commandes                                                           */
/* ------------------------------------------------------------------ */

const SW_C = { x: 0, y: -8, r: 4.5 };

/** Levier d'interrupteur partant du cercle selon un angle (degrés, 0 = droite, sens horaire). */
function lever(angleDeg: number, length = 13, ticks = 1): SymbolPrimitive[] {
  const a = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const sx = SW_C.x + ux * SW_C.r;
  const sy = SW_C.y + uy * SW_C.r;
  const ex = SW_C.x + ux * (SW_C.r + length);
  const ey = SW_C.y + uy * (SW_C.r + length);
  const shapes: SymbolPrimitive[] = [line(round(sx), round(sy), round(ex), round(ey))];
  // Trait perpendiculaire (sens anti-horaire)
  const px = uy;
  const py = -ux;
  for (let i = 0; i < ticks; i++) {
    const bx = ex - ux * i * 3.2;
    const by = ey - uy * i * 3.2;
    shapes.push(line(round(bx), round(by), round(bx + px * 4.5), round(by + py * 4.5)));
  }
  return shapes;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

export function switchCircle(fill: PrimitiveFill = 'none'): SymbolPrimitive {
  return c(SW_C.x, SW_C.y, SW_C.r, fill);
}

/** Interrupteur : 1, 2 ou 3 leviers. */
export function switchGlyph(levers: 1 | 2 | 3 = 1): SymbolPrimitive[] {
  const angles = levers === 1 ? [55] : levers === 2 ? [40, 75] : [30, 58, 86];
  return [switchCircle(), ...angles.flatMap((a) => lever(a))];
}

/** Va-et-vient : levier dans deux directions opposées. */
export function twoWayGlyph(double = false): SymbolPrimitive[] {
  const shapes: SymbolPrimitive[] = [switchCircle(), ...lever(55), ...lever(235, 10)];
  if (double) shapes.push(...lever(80), ...lever(260, 10));
  return shapes;
}

export function intermediateGlyph(): SymbolPrimitive[] {
  return [switchCircle(), ...lever(50), ...lever(230, 10), ...lever(130, 11), ...lever(-50, 9)];
}

export function pushButtonGlyph(double = false): SymbolPrimitive[] {
  if (double) return [c(-7, -8, 5.5), dot(-7, -8, 2.2), c(7, -8, 5.5), dot(7, -8, 2.2)];
  return [c(0, -8, 6.5), dot(0, -8, 2.6)];
}

/** Ondes « connecté » (Wi-Fi) centrées en (x, y). */
export function wifi(x: number, y: number, s = 1): SymbolPrimitive[] {
  return [
    p(`M${x - 6 * s} ${y - 2 * s}Q${x} ${y - 8 * s} ${x + 6 * s} ${y - 2 * s}`, 'none', 1.6),
    p(`M${x - 3.5 * s} ${y + 0.8 * s}Q${x} ${y - 3 * s} ${x + 3.5 * s} ${y + 0.8 * s}`, 'none', 1.6),
    dot(x, y + 3 * s, 1.3 * s),
  ];
}

/** Boîtier carré contre le mur avec texte. */
export function wallBox(label: string, size = 8): SymbolPrimitive[] {
  return [rect(-12, WALL_BACK, 24, 20, 'white'), t(label, 0, WALL_BACK + 10, size)];
}

export function clockGlyph(cx = 0, cy = 0, r = 10): SymbolPrimitive[] {
  return [c(cx, cy, r, 'white'), line(cx, cy, cx, cy - r * 0.62), line(cx, cy, cx + r * 0.5, cy + r * 0.2), dot(cx, cy, 1.4)];
}

/* ------------------------------------------------------------------ */
/* Éclairage                                                           */
/* ------------------------------------------------------------------ */

/** Point lumineux : cercle barré d'une croix. */
export function lightGlyph(cx = 0, cy = 0, r = 10, fill: PrimitiveFill = 'white'): SymbolPrimitive[] {
  const k = r * 0.7071;
  return [
    c(cx, cy, r, fill),
    line(round(cx - k), round(cy - k), round(cx + k), round(cy + k)),
    line(round(cx - k), round(cy + k), round(cx + k), round(cy - k)),
  ];
}

export function spotGlyph(cx = 0, cy = 0, r = 6): SymbolPrimitive[] {
  return [...lightGlyph(cx, cy, r), dot(cx, cy, r * 0.28)];
}

export function recessedSpotGlyph(cx = 0, cy = 0, r = 7): SymbolPrimitive[] {
  return [c(cx, cy, r, 'white'), c(cx, cy, r * 0.5, 'color', 1.4)];
}

/** Applique : point lumineux relié au mur. */
export function wallLightGlyph(label?: string): SymbolPrimitive[] {
  const shapes: SymbolPrimitive[] = [line(-10, WALL_BACK, 10, WALL_BACK), wallStem(-10), ...lightGlyph(0, -2, 8)];
  if (label) shapes.push(t(label, 0, 13, 6));
  return shapes;
}

export function floodGlyph(label?: string): SymbolPrimitive[] {
  const shapes: SymbolPrimitive[] = [
    line(-9, WALL_BACK, 9, WALL_BACK),
    p(`M-6 ${WALL_BACK}L-10 -2H10L6 ${WALL_BACK}Z`, 'white'),
    line(-10, 2, -14, 7, 1.6),
    line(0, 1, 0, 8, 1.6),
    line(10, 2, 14, 7, 1.6),
  ];
  if (label) shapes.push(t(label, 0, 14, 6));
  return shapes;
}

/* ------------------------------------------------------------------ */
/* Ventilation / chauffage / appareils                                 */
/* ------------------------------------------------------------------ */

export function fanBlades(cx = 0, cy = 0, r = 8): SymbolPrimitive[] {
  const blades: SymbolPrimitive[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i * 120 * Math.PI) / 180;
    const b = a + 0.9;
    const x1 = round(cx + Math.cos(a) * r);
    const y1 = round(cy + Math.sin(a) * r);
    const x2 = round(cx + Math.cos(b) * r * 0.9);
    const y2 = round(cy + Math.sin(b) * r * 0.9);
    blades.push(p(`M${cx} ${cy}Q${x1} ${y1} ${x2} ${y2}Z`, 'color', 1));
  }
  blades.push(c(cx, cy, 1.8, 'white', 1.2));
  return blades;
}

/** Boîte « appareil » : carré avec pictogramme optionnel + texte. */
export function applianceBox(label: string, extra: SymbolPrimitive[] = [], labelY = 9): SymbolPrimitive[] {
  return [rect(-15, WALL_BACK, 30, 30, 'white'), ...extra, t(label, 0, labelY, label.length > 3 ? 6.5 : 8)];
}

/** Module DIN (tableau) : rectangle vertical. */
export function dinModule(label: string, extra: SymbolPrimitive[] = [], width = 16): SymbolPrimitive[] {
  const w = width;
  const size = label.length <= 2 ? 7 : label.length === 3 ? (w >= 18 ? 5.5 : 4.8) : w >= 18 ? 4.6 : 3.8;
  return [rect(-w / 2, -17, w, 34, 'white'), line(-w / 2, -9, w / 2, -9, 1.2), ...extra, t(label, 0, 10, size)];
}

/** Symbole de disjoncteur (contact + croix). */
export function breakerMark(cx = 0, cy = -1, s = 1): SymbolPrimitive[] {
  return [
    line(cx, cy - 6 * s, cx, cy - 3 * s, 1.6),
    line(cx, cy - 3 * s, cx + 3.5 * s, cy + 3 * s, 1.6),
    line(cx, cy + 3 * s, cx, cy + 6 * s, 1.6),
    line(cx - 1.6 * s, cy - 4.6 * s, cx + 1.6 * s, cy - 1.4 * s, 1.2),
    line(cx - 1.6 * s, cy - 1.4 * s, cx + 1.6 * s, cy - 4.6 * s, 1.2),
  ];
}

export function earthGlyph(cx = 0, cy = -4): SymbolPrimitive[] {
  return [line(cx, cy - 10, cx, cy), line(cx - 10, cy, cx + 10, cy), line(cx - 6.5, cy + 4, cx + 6.5, cy + 4), line(cx - 3, cy + 8, cx + 3, cy + 8)];
}

export function bellGlyph(cx = 0, cy = -3): SymbolPrimitive[] {
  return [
    p(`M${cx - 9} ${cy + 6}Q${cx - 9} ${cy - 10} ${cx} ${cy - 10}Q${cx + 9} ${cy - 10} ${cx + 9} ${cy + 6}Z`, 'white'),
    line(cx - 11, cy + 6, cx + 11, cy + 6),
    dot(cx, cy + 9, 2),
  ];
}

export function cameraGlyph(): SymbolPrimitive[] {
  return [line(0, WALL_BACK, 0, -10), rect(-11, -10, 16, 11, 'white'), p('M5 -7L12 -10V1L5 -2Z', 'white'), dot(-3, -4.5, 2)];
}

/** Détecteur de mouvement mural : boîtier contre le mur, cône et ondes de détection. */
export function motionGlyph(): SymbolPrimitive[] {
  return [
    line(-5, -7.8, -14.5, 0.2, 1.4),
    line(5, -7.8, 14.5, 0.2, 1.4),
    p('M-6.4 -4.3A10 10 0 0 0 6.4 -4.3', 'none', 1.8),
    p('M-9.6 -0.5A15 15 0 0 0 9.6 -0.5', 'none', 1.8),
    p(`M-7 ${WALL_BACK}A7 7 0 0 0 7 ${WALL_BACK}Z`, 'white', 2.2),
    dot(0, -12.2, 1.6),
  ];
}

/** Détecteur de présence (plafond, 360°) : « P » entouré d'ondes de chaque côté. */
export function presenceGlyph(): SymbolPrimitive[] {
  return [
    c(0, 0, 8, 'white', 2.2),
    t('P', 0, 0.4, 9),
    p('M-11.5 -6.5A13 13 0 0 0 -11.5 6.5', 'none', 1.8),
    p('M-15.5 -9A18 18 0 0 0 -15.5 9', 'none', 1.8),
    p('M11.5 -6.5A13 13 0 0 1 11.5 6.5', 'none', 1.8),
    p('M15.5 -9A18 18 0 0 1 15.5 9', 'none', 1.8),
  ];
}

/** Écran de commande domotique mural : écran avec pictogramme maison. */
export function homeScreenGlyph(): SymbolPrimitive[] {
  return [
    rect(-15, WALL_BACK, 30, 22, 'white', 2.2),
    rect(-11.5, -12.5, 23, 13.5, 'none', 1.3),
    filled('M0 -10.5L6 -5.2H4.2V-1H-4.2V-5.2H-6Z'),
    dot(0, 3.2, 1.2),
  ];
}

export function circleLabel(label: string, r = 12, size?: number): SymbolPrimitive[] {
  return [c(0, 0, r, 'white'), t(label, 0, 0, size ?? (label.length > 3 ? 6 : label.length > 2 ? 7 : 8.5))];
}

export function squareLabel(label: string, size?: number): SymbolPrimitive[] {
  return [rect(-13, -13, 26, 26, 'white'), t(label, 0, 0, size ?? (label.length > 3 ? 6 : label.length > 2 ? 7 : 8.5))];
}

/* ------------------------------------------------------------------ */
/* Définition                                                          */
/* ------------------------------------------------------------------ */

export interface SymbolInput {
  id: string;
  name: string;
  subCategory: string;
  shapes: SymbolPrimitive[];
  keywords?: string[];
  description?: string;
  snapToWall?: boolean;
  role?: SymbolRole;
  defaultSize?: number;
  color?: string;
}

const DEFAULT_ROLE: Record<SymbolCategoryId, SymbolRole> = {
  prises: 'socket',
  reseau: 'network',
  commandes: 'switch',
  eclairage: 'light',
  ventilation: 'appliance',
  chauffage: 'appliance',
  electromenager: 'appliance',
  buanderie: 'appliance',
  securite: 'sensor',
  domotique: 'other',
  exterieur: 'other',
  tableau: 'panel',
  divers: 'other',
};

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fillValue(fill: PrimitiveFill | undefined, color: string): string {
  if (fill === 'color') return color;
  if (fill === 'white') return '#ffffff';
  return 'none';
}

/** Convertit des primitives en balises SVG (sans l'élément <svg>). */
export function primitivesToSvgInner(shapes: SymbolPrimitive[], color: string): string {
  return shapes
    .map((s) => {
      if (s.k === 'path') {
        const stroke = s.stroke === false ? 'none' : color;
        return `<path d="${s.d}" fill="${fillValue(s.fill, color)}" stroke="${stroke}" stroke-width="${s.sw ?? SW}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      if (s.k === 'circle') {
        const stroke = s.stroke === false ? 'none' : color;
        return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${fillValue(s.fill, color)}" stroke="${stroke}" stroke-width="${s.sw ?? SW}"/>`;
      }
      return `<text x="${s.x}" y="${s.y}" font-size="${s.size}" font-family="Helvetica, Arial, sans-serif" font-weight="${s.bold === false ? 400 : 700}" text-anchor="middle" dominant-baseline="central" fill="${s.fill === 'white' ? '#ffffff' : color}">${escapeXml(s.text)}</text>`;
    })
    .join('');
}

export function primitivesToSvg(shapes: SymbolPrimitive[], color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 40 40" width="40" height="40">${primitivesToSvgInner(shapes, color)}</svg>`;
}

/** Fabrique de symboles d'une catégorie. */
export function categoryFactory(category: SymbolCategoryId, defaults: { snapToWall: boolean; defaultSize: number }) {
  return (input: SymbolInput): ElectricalSymbolDefinition => {
    const color = input.color ?? CATEGORY_COLORS[category];
    return {
      id: input.id,
      name: input.name,
      category,
      subCategory: input.subCategory,
      shapes: input.shapes,
      svg: primitivesToSvg(input.shapes, color),
      color,
      rotation: 0,
      defaultSize: input.defaultSize ?? defaults.defaultSize,
      keywords: input.keywords ?? [],
      favorite: false,
      description: input.description ?? input.name,
      snapToWall: input.snapToWall ?? defaults.snapToWall,
      role: input.role ?? DEFAULT_ROLE[category],
    };
  };
}
