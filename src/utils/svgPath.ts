/**
 * Analyse et transformation de chemins SVG (M, L, H, V, C, S, Q, T, A, Z — absolus ou relatifs).
 * Utilisé pour dessiner les symboles en vectoriel dans le PDF avec rotation / échelle / translation.
 */

export type AbsCommand =
  | { c: 'M'; x: number; y: number }
  | { c: 'L'; x: number; y: number }
  | { c: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { c: 'Q'; x1: number; y1: number; x: number; y: number }
  | { c: 'A'; rx: number; ry: number; rot: number; large: 0 | 1; sweep: 0 | 1; x: number; y: number }
  | { c: 'Z' };

const TOKEN_RE = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

/** Convertit un chemin SVG en liste de commandes absolues. */
export function parseSvgPath(d: string): AbsCommand[] {
  const tokens = d.match(TOKEN_RE) ?? [];
  const out: AbsCommand[] = [];
  let i = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let lastCtrl: { x: number; y: number } | null = null;
  let lastQuad: { x: number; y: number } | null = null;

  const isCmd = (t: string | undefined) => t !== undefined && /^[A-Za-z]$/.test(t);
  const num = (): number => {
    const t = tokens[i++];
    if (t === undefined || isCmd(t)) throw new Error(`Chemin SVG invalide : ${d}`);
    return Number.parseFloat(t);
  };
  const flag = (): 0 | 1 => (num() ? 1 : 0);

  while (i < tokens.length) {
    if (isCmd(tokens[i])) {
      cmd = tokens[i++];
    } else if (!cmd) {
      throw new Error(`Chemin SVG invalide : ${d}`);
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    switch (C) {
      case 'M': {
        cx = ox + num();
        cy = oy + num();
        sx = cx;
        sy = cy;
        out.push({ c: 'M', x: cx, y: cy });
        // Les paires suivantes sont des L implicites
        cmd = rel ? 'l' : 'L';
        lastCtrl = lastQuad = null;
        break;
      }
      case 'L': {
        cx = ox + num();
        cy = oy + num();
        out.push({ c: 'L', x: cx, y: cy });
        lastCtrl = lastQuad = null;
        break;
      }
      case 'H': {
        cx = ox + num();
        out.push({ c: 'L', x: cx, y: cy });
        lastCtrl = lastQuad = null;
        break;
      }
      case 'V': {
        cy = oy + num();
        out.push({ c: 'L', x: cx, y: cy });
        lastCtrl = lastQuad = null;
        break;
      }
      case 'C': {
        const x1 = ox + num();
        const y1 = oy + num();
        const x2 = ox + num();
        const y2 = oy + num();
        cx = ox + num();
        cy = oy + num();
        out.push({ c: 'C', x1, y1, x2, y2, x: cx, y: cy });
        lastCtrl = { x: x2, y: y2 };
        lastQuad = null;
        break;
      }
      case 'S': {
        const x1: number = lastCtrl ? 2 * cx - lastCtrl.x : cx;
        const y1: number = lastCtrl ? 2 * cy - lastCtrl.y : cy;
        const x2 = ox + num();
        const y2 = oy + num();
        cx = ox + num();
        cy = oy + num();
        out.push({ c: 'C', x1, y1, x2, y2, x: cx, y: cy });
        lastCtrl = { x: x2, y: y2 };
        lastQuad = null;
        break;
      }
      case 'Q': {
        const x1 = ox + num();
        const y1 = oy + num();
        cx = ox + num();
        cy = oy + num();
        out.push({ c: 'Q', x1, y1, x: cx, y: cy });
        lastQuad = { x: x1, y: y1 };
        lastCtrl = null;
        break;
      }
      case 'T': {
        const x1: number = lastQuad ? 2 * cx - lastQuad.x : cx;
        const y1: number = lastQuad ? 2 * cy - lastQuad.y : cy;
        cx = ox + num();
        cy = oy + num();
        out.push({ c: 'Q', x1, y1, x: cx, y: cy });
        lastQuad = { x: x1, y: y1 };
        lastCtrl = null;
        break;
      }
      case 'A': {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = flag();
        const sweep = flag();
        cx = ox + num();
        cy = oy + num();
        out.push({ c: 'A', rx, ry, rot, large, sweep, x: cx, y: cy });
        lastCtrl = lastQuad = null;
        break;
      }
      case 'Z': {
        cx = sx;
        cy = sy;
        out.push({ c: 'Z' });
        lastCtrl = lastQuad = null;
        cmd = '';
        break;
      }
      default:
        throw new Error(`Commande SVG non prise en charge : ${cmd}`);
    }
  }
  return out;
}

export interface SimilarityTransform {
  /** Translation appliquée après rotation et échelle. */
  tx: number;
  ty: number;
  /** Rotation en degrés (sens horaire, axe Y vers le bas). */
  rotation: number;
  scale: number;
}

function applyPoint(t: SimilarityTransform, x: number, y: number): [number, number] {
  const r = (t.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [t.tx + t.scale * (x * cos - y * sin), t.ty + t.scale * (x * sin + y * cos)];
}

/** Applique une similitude (rotation + échelle uniforme + translation) à un chemin. */
export function transformCommands(cmds: AbsCommand[], t: SimilarityTransform): AbsCommand[] {
  return cmds.map((c): AbsCommand => {
    switch (c.c) {
      case 'M':
      case 'L': {
        const [x, y] = applyPoint(t, c.x, c.y);
        return { c: c.c, x, y };
      }
      case 'C': {
        const [x1, y1] = applyPoint(t, c.x1, c.y1);
        const [x2, y2] = applyPoint(t, c.x2, c.y2);
        const [x, y] = applyPoint(t, c.x, c.y);
        return { c: 'C', x1, y1, x2, y2, x, y };
      }
      case 'Q': {
        const [x1, y1] = applyPoint(t, c.x1, c.y1);
        const [x, y] = applyPoint(t, c.x, c.y);
        return { c: 'Q', x1, y1, x, y };
      }
      case 'A': {
        const [x, y] = applyPoint(t, c.x, c.y);
        return { ...c, rx: c.rx * t.scale, ry: c.ry * t.scale, rot: c.rot + t.rotation, x, y };
      }
      case 'Z':
        return c;
    }
  });
}

const fmt = (n: number) => {
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? '0' : String(v);
};

export function serializeCommands(cmds: AbsCommand[]): string {
  return cmds
    .map((c) => {
      switch (c.c) {
        case 'M':
        case 'L':
          return `${c.c}${fmt(c.x)} ${fmt(c.y)}`;
        case 'C':
          return `C${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x2)} ${fmt(c.y2)} ${fmt(c.x)} ${fmt(c.y)}`;
        case 'Q':
          return `Q${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x)} ${fmt(c.y)}`;
        case 'A':
          return `A${fmt(c.rx)} ${fmt(c.ry)} ${fmt(c.rot)} ${c.large} ${c.sweep} ${fmt(c.x)} ${fmt(c.y)}`;
        case 'Z':
          return 'Z';
      }
    })
    .join(' ');
}

const cache = new Map<string, AbsCommand[]>();

/** Transforme un chemin SVG (avec cache d'analyse). */
export function transformSvgPath(d: string, t: SimilarityTransform): string {
  let parsed = cache.get(d);
  if (!parsed) {
    parsed = parseSvgPath(d);
    cache.set(d, parsed);
  }
  return serializeCommands(transformCommands(parsed, t));
}

/** Chemin SVG d'un cercle (deux arcs). */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${fmt(cx - r)} ${fmt(cy)} A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)} A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)} Z`;
}
