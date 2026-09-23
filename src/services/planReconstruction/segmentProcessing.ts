import type { RawSegment } from './types';

/**
 * Post-traitement géométrique des segments détectés (fonctions pures, testées) :
 * redressement horizontal / vertical, fusion des traits proches, alignement,
 * fermeture des angles, détection approximative des ouvertures.
 */

export interface ProcessOptions {
  /** Longueur minimale d'un mur (px). */
  minLength: number;
  /** Distance max entre deux traits parallèles pour les fusionner (px). */
  mergeDistance: number;
  /** Écart max entre deux traits colinéaires pour les raccorder sans ouverture (px). */
  gapTolerance: number;
  /** Plage de largeur d'une ouverture (px). */
  openingMin: number;
  openingMax: number;
  /** Tolérance angulaire pour redresser (degrés). */
  angleTolerance: number;
  /** Distance de raccordement des angles (px). */
  snapDistance: number;
  orthogonalOnly: boolean;
  detectOpenings: boolean;
}

export interface ProcessedWall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ProcessedOpening {
  /** Index du mur (dans `walls`). */
  wallIndex: number;
  /** Centre de l'ouverture le long du mur (0 → 1). */
  t: number;
  width: number;
}

export interface ProcessResult {
  walls: ProcessedWall[];
  openings: ProcessedOpening[];
  thickness: number;
}

interface Axis {
  /** Coordonnée fixe (y pour un mur horizontal, x pour un vertical). */
  c: number;
  a: number;
  b: number;
  weight: number;
}

export function defaultProcessOptions(width: number, height: number, minWallRatio = 0.06, orthogonalOnly = true, detectOpenings = true): ProcessOptions {
  const m = Math.min(width, height);
  return {
    minLength: Math.max(12, m * minWallRatio),
    mergeDistance: Math.max(4, m * 0.018),
    gapTolerance: Math.max(4, m * 0.015),
    openingMin: Math.max(10, m * 0.045),
    openingMax: Math.max(20, m * 0.16),
    angleTolerance: 12,
    snapDistance: Math.max(8, m * 0.035),
    orthogonalOnly,
    detectOpenings,
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Classe les segments en horizontaux / verticaux (redressés) et diagonaux. */
export function classifySegments(segs: RawSegment[], angleTolerance: number) {
  const horizontal: Axis[] = [];
  const vertical: Axis[] = [];
  const diagonal: RawSegment[] = [];
  for (const s of segs) {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;
    const ang = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
    const toH = Math.min(ang, 180 - ang);
    const toV = Math.abs(90 - ang);
    if (toH <= angleTolerance) horizontal.push({ c: (s.y1 + s.y2) / 2, a: Math.min(s.x1, s.x2), b: Math.max(s.x1, s.x2), weight: len });
    else if (toV <= angleTolerance) vertical.push({ c: (s.x1 + s.x2) / 2, a: Math.min(s.y1, s.y2), b: Math.max(s.y1, s.y2), weight: len });
    else diagonal.push(s);
  }
  return { horizontal, vertical, diagonal };
}

/**
 * Fusionne les segments d'un même axe : même coordonnée (± mergeDistance)
 * et chevauchement ou écart ≤ gapTolerance. Les écarts compatibles avec une
 * ouverture sont mémorisés.
 */
export function mergeAxis(items: Axis[], o: Pick<ProcessOptions, 'mergeDistance' | 'gapTolerance' | 'openingMin' | 'openingMax' | 'detectOpenings'>): { axes: Axis[]; openings: { axisIndex: number; a: number; b: number }[] } {
  // 1) Regroupement par coordonnée (traits parallèles proches = même mur)
  const sorted = [...items].sort((p, q) => p.c - q.c);
  const bands: Axis[][] = [];
  for (const it of sorted) {
    const band = bands.find((b) => Math.abs(weightedC(b) - it.c) <= o.mergeDistance && b.some((x) => overlaps(x, it, o.openingMax)));
    if (band) band.push(it);
    else bands.push([it]);
  }
  const axes: Axis[] = [];
  const openings: { axisIndex: number; a: number; b: number }[] = [];
  for (const band of bands) {
    const c = weightedC(band);
    // 2) Union des intervalles le long de l'axe
    const ivs = band.map((x) => [x.a, x.b] as [number, number]).sort((p, q) => p[0] - q[0]);
    const merged: [number, number][] = [];
    for (const iv of ivs) {
      const last = merged[merged.length - 1];
      if (last && iv[0] <= last[1] + o.gapTolerance) last[1] = Math.max(last[1], iv[1]);
      else merged.push([iv[0], iv[1]]);
    }
    // 3) Écarts de largeur « porte » → un seul mur + une ouverture
    let cur: [number, number] | null = null;
    const gaps: [number, number][] = [];
    const flush = () => {
      if (!cur) return;
      const idx = axes.length;
      axes.push({ c, a: cur[0], b: cur[1], weight: cur[1] - cur[0] });
      for (const g of gaps) openings.push({ axisIndex: idx, a: g[0], b: g[1] });
      gaps.length = 0;
    };
    for (const iv of merged) {
      if (!cur) cur = [iv[0], iv[1]];
      else {
        const gap = iv[0] - cur[1];
        if (o.detectOpenings && gap >= o.openingMin && gap <= o.openingMax) {
          gaps.push([cur[1], iv[0]]);
          cur = [cur[0], iv[1]];
        } else {
          flush();
          cur = [iv[0], iv[1]];
        }
      }
    }
    flush();
  }
  return { axes, openings };
}

function weightedC(band: Axis[]): number {
  let s = 0;
  let w = 0;
  for (const x of band) {
    s += x.c * x.weight;
    w += x.weight;
  }
  return w ? s / w : band[0].c;
}

function overlaps(p: Axis, q: Axis, tolerance: number): boolean {
  return p.a <= q.b + tolerance && q.a <= p.b + tolerance;
}

/** Aligne les coordonnées proches (ex. murs presque alignés → même y). */
export function alignCoordinates(axes: Axis[], tolerance: number): void {
  const idx = axes.map((_, i) => i).sort((i, j) => axes[i].c - axes[j].c);
  let group: number[] = [];
  const commit = () => {
    if (group.length > 1) {
      const c = weightedC(group.map((i) => axes[i]));
      for (const i of group) axes[i].c = c;
    }
    group = [];
  };
  for (const i of idx) {
    if (group.length && Math.abs(axes[i].c - axes[group[0]].c) > tolerance) commit();
    group.push(i);
  }
  commit();
}

/**
 * Fusionne les murs devenus colinéaires après alignement (même coordonnée,
 * intervalles qui se chevauchent ou se touchent). Les ouvertures suivent leur mur.
 */
export function dedupeAxes(axes: Axis[], openings: { axisIndex: number; a: number; b: number }[], tolerance: number, gap: number) {
  const order = axes.map((_, i) => i).sort((i, j) => axes[i].c - axes[j].c || axes[i].a - axes[j].a);
  const out: Axis[] = [];
  const remap = new Map<number, number>();
  for (const i of order) {
    const ax = axes[i];
    const target = out.findIndex((o) => Math.abs(o.c - ax.c) <= tolerance && ax.a <= o.b + gap && o.a <= ax.b + gap);
    if (target >= 0) {
      const o = out[target];
      o.c = (o.c * o.weight + ax.c * ax.weight) / (o.weight + ax.weight);
      o.a = Math.min(o.a, ax.a);
      o.b = Math.max(o.b, ax.b);
      o.weight += ax.weight;
      remap.set(i, target);
    } else {
      remap.set(i, out.length);
      out.push({ ...ax });
    }
  }
  return { axes: out, openings: openings.map((op) => ({ ...op, axisIndex: remap.get(op.axisIndex) ?? op.axisIndex })) };
}

/** Ferme les angles : prolonge / raccourcit les extrémités jusqu'aux murs perpendiculaires proches. */
export function closeCorners(h: Axis[], v: Axis[], snap: number): void {
  for (const hw of h) {
    for (const end of ['a', 'b'] as const) {
      let best: { vx: Axis; d: number } | null = null;
      for (const vw of v) {
        const d = Math.abs(hw[end] - vw.c);
        if (d <= snap && hw.c >= vw.a - snap && hw.c <= vw.b + snap && (!best || d < best.d)) best = { vx: vw, d };
      }
      if (best) {
        hw[end] = best.vx.c;
        best.vx.a = Math.min(best.vx.a, hw.c);
        best.vx.b = Math.max(best.vx.b, hw.c);
      }
    }
  }
  for (const vw of v) {
    for (const end of ['a', 'b'] as const) {
      let best: { hx: Axis; d: number } | null = null;
      for (const hw of h) {
        const d = Math.abs(vw[end] - hw.c);
        if (d <= snap && vw.c >= hw.a - snap && vw.c <= hw.b + snap && (!best || d < best.d)) best = { hx: hw, d };
      }
      if (best) {
        vw[end] = best.hx.c;
        best.hx.a = Math.min(best.hx.a, vw.c);
        best.hx.b = Math.max(best.hx.b, vw.c);
      }
    }
  }
}

/** Pipeline complet de post-traitement. */
export function processSegments(segs: RawSegment[], o: ProcessOptions): ProcessResult {
  const { horizontal, vertical, diagonal } = classifySegments(segs, o.angleTolerance);
  const hm0 = mergeAxis(horizontal, o);
  const vm0 = mergeAxis(vertical, o);
  alignCoordinates(hm0.axes, o.mergeDistance);
  alignCoordinates(vm0.axes, o.mergeDistance);
  const hm = dedupeAxes(hm0.axes, hm0.openings, o.mergeDistance, o.gapTolerance);
  const vm = dedupeAxes(vm0.axes, vm0.openings, o.mergeDistance, o.gapTolerance);
  closeCorners(hm.axes, vm.axes, o.snapDistance);
  // Petits traits isolés (texte, cotes, hachures) : supprimés
  const isolatedShort = (ax: Axis, horizontalAxis: boolean) => {
    if (ax.b - ax.a >= o.minLength * 2) return false;
    const ends = horizontalAxis
      ? [
          { x: ax.a, y: ax.c },
          { x: ax.b, y: ax.c },
        ]
      : [
          { x: ax.c, y: ax.a },
          { x: ax.c, y: ax.b },
        ];
    // un bout doit toucher un AUTRE mur perpendiculaire
    const other = horizontalAxis ? vm.axes : hm.axes;
    return !ends.some((p) =>
      other.some((w) =>
        horizontalAxis
          ? Math.abs(w.c - p.x) <= o.snapDistance && p.y >= w.a - o.snapDistance && p.y <= w.b + o.snapDistance
          : Math.abs(w.c - p.y) <= o.snapDistance && p.x >= w.a - o.snapDistance && p.x <= w.b + o.snapDistance,
      ),
    );
  };
  hm.axes = hm.axes.map((ax) => (isolatedShort(ax, true) ? { ...ax, b: ax.a } : ax));
  vm.axes = vm.axes.map((ax) => (isolatedShort(ax, false) ? { ...ax, b: ax.a } : ax));

  const walls: ProcessedWall[] = [];
  const openings: ProcessedOpening[] = [];
  const addAxis = (list: Axis[], ops: { axisIndex: number; a: number; b: number }[], horizontalAxis: boolean) => {
    list.forEach((ax, i) => {
      if (ax.b - ax.a < o.minLength) return;
      const wallIndex = walls.length;
      walls.push(horizontalAxis ? { x1: ax.a, y1: ax.c, x2: ax.b, y2: ax.c } : { x1: ax.c, y1: ax.a, x2: ax.c, y2: ax.b });
      for (const op of ops.filter((x) => x.axisIndex === i)) {
        const len = ax.b - ax.a;
        openings.push({ wallIndex, t: ((op.a + op.b) / 2 - ax.a) / len, width: op.b - op.a });
      }
    });
  };
  addAxis(hm.axes, hm.openings, true);
  addAxis(vm.axes, vm.openings, false);
  if (!o.orthogonalOnly) {
    for (const d of diagonal) if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) >= o.minLength) walls.push({ x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 });
  }
  const thickness = median(segs.map((s) => s.thickness ?? 0).filter((t) => t > 0));
  return { walls, openings, thickness };
}

/** Indice de confiance : proportion de murs raccordés à leurs deux extrémités. */
export function reconstructionConfidence(walls: ProcessedWall[], tolerance = 2): number {
  if (walls.length < 3) return walls.length ? 0.15 : 0;
  const ends = walls.flatMap((w) => [
    { x: w.x1, y: w.y1 },
    { x: w.x2, y: w.y2 },
  ]);
  const onAnyWall = (p: { x: number; y: number }, self: ProcessedWall) =>
    walls.some((w) => {
      if (w === self) return false;
      const minX = Math.min(w.x1, w.x2) - tolerance;
      const maxX = Math.max(w.x1, w.x2) + tolerance;
      const minY = Math.min(w.y1, w.y2) - tolerance;
      const maxY = Math.max(w.y1, w.y2) + tolerance;
      if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) return false;
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const len = Math.hypot(dx, dy) || 1;
      return Math.abs((p.x - w.x1) * dy - (p.y - w.y1) * dx) / len <= tolerance;
    });
  let connected = 0;
  walls.forEach((w, i) => {
    if (onAnyWall(ends[i * 2], w)) connected++;
    if (onAnyWall(ends[i * 2 + 1], w)) connected++;
  });
  const ratio = connected / ends.length;
  return Math.round((0.25 * Math.min(1, walls.length / 8) + 0.75 * ratio) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Détection sans OpenCV (repli) : longues suites de pixels « encre »    */
/* ------------------------------------------------------------------ */

/**
 * Détecte les traits horizontaux et verticaux d'un masque binaire (1 = encre)
 * par analyse des plages (run-length), avec tolérance aux petites interruptions.
 */
export function detectSegmentsFromMask(mask: Uint8Array, width: number, height: number, minLength: number, maxGap = 3): RawSegment[] {
  const segments: RawSegment[] = [];
  const scan = (horizontalScan: boolean) => {
    const outer = horizontalScan ? height : width;
    const inner = horizontalScan ? width : height;
    const at = (o: number, i: number) => (horizontalScan ? mask[o * width + i] : mask[i * width + o]);
    // plages actives, regroupées sur les lignes successives
    let open: { a: number; b: number; start: number; last: number; sumC: number; n: number }[] = [];
    const closeBand = (band: (typeof open)[number]) => {
      const c = band.sumC / band.n;
      const thickness = band.last - band.start + 1;
      if (band.b - band.a >= minLength && thickness <= minLength / 2)
        segments.push(horizontalScan ? { x1: band.a, y1: c, x2: band.b, y2: c, thickness } : { x1: c, y1: band.a, x2: c, y2: band.b, thickness });
    };
    for (let o = 0; o < outer; o++) {
      const runs: [number, number][] = [];
      let start = -1;
      let gap = 0;
      for (let i = 0; i < inner; i++) {
        if (at(o, i)) {
          if (start < 0) start = i;
          gap = 0;
        } else if (start >= 0) {
          gap++;
          if (gap > maxGap) {
            const end = i - gap;
            if (end - start >= minLength) runs.push([start, end]);
            start = -1;
            gap = 0;
          }
        }
      }
      if (start >= 0 && inner - gap - start >= minLength) runs.push([start, inner - gap]);
      const next: typeof open = [];
      for (const [a, b] of runs) {
        const band = open.find((bd) => bd.last === o - 1 && a <= bd.b && b >= bd.a);
        if (band) {
          band.a = Math.min(band.a, a);
          band.b = Math.max(band.b, b);
          band.last = o;
          band.sumC += o;
          band.n++;
          if (!next.includes(band)) next.push(band);
        } else next.push({ a, b, start: o, last: o, sumC: o, n: 1 });
      }
      for (const band of open) if (!next.includes(band)) closeBand(band);
      open = next;
    }
    for (const band of open) closeBand(band);
  };
  scan(true);
  scan(false);
  return segments;
}
