import type { ElectricalCircuit, PlacedSymbol, Plan, Point, Room, Wall } from '../types';
import { getSymbolDefinition } from '../data/electricalSymbols';
import { NFC15100_RULES, type DedicatedCircuitRule, type Nfc15100Rules, type SocketCircuitRule } from '../data/nfc15100';
import { formatAmps, formatSection, normName, parseAmps, parseSection } from '../utils/electrical';
import { createId } from '../utils/id';

/**
 * Récapitulatif / calcul du tableau : comptage des éléments de tous les plans,
 * regroupement par circuit, contrôle des règles NF C 15-100 (voir data/nfc15100.ts),
 * liste du matériel et répartition automatique. Fonctions pures (aucun accès à la base).
 */

/* ------------------------------------------------------------------ */
/* Éléments                                                            */
/* ------------------------------------------------------------------ */

/** Nature d'un élément pour le calcul : prise, point lumineux, commande, appareil dédié, autre équipement. */
export type ElementKind = 'socket' | 'light' | 'switch' | 'dedicated' | 'other';

export interface RecapElement {
  symbol: PlacedSymbol;
  kind: ElementKind;
  /** Points d'utilisation comptés (prises et points lumineux). */
  points: number;
  planId: string;
  floorName: string;
  floorOrder: number;
  /** Pièce saisie, sinon déduite du plan (étiquette de pièce visible), sinon « Pièce non renseignée ». */
  room: string;
  /** Appareil spécialisé reconnu (lave-linge, four…). */
  dedicated: DedicatedCircuitRule | null;
}

export const UNKNOWN_ROOM = 'Pièce non renseignée';

/** Recherche un appareil spécialisé dans un texte (nom du circuit, nom affiché…). */
export function matchDedicated(text: string, rules: Nfc15100Rules = NFC15100_RULES): DedicatedCircuitRule | null {
  const words = (s: string) =>
    ` ${normName(s)
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()} `;
  const t = words(text);
  if (t.trim() === '') return null;
  return rules.dedicated.find((r) => r.keywords.some((k) => t.includes(words(k)))) ?? null;
}

/** Classe un symbole (null : non concerné par le calcul — réseau, capteurs, tableau…). */
export function classifySymbol(s: PlacedSymbol, rules: Nfc15100Rules = NFC15100_RULES): Pick<RecapElement, 'kind' | 'points' | 'dedicated'> | null {
  const direct = rules.dedicated.find((r) => r.symbolTypes.includes(s.symbolType));
  if (direct) return { kind: 'dedicated', points: 1, dedicated: direct };
  if (rules.dedicatedFallback.symbolTypes.includes(s.symbolType)) {
    const named = matchDedicated(`${s.properties.label ?? ''} ${s.properties.circuitName ?? ''}`, rules);
    return { kind: 'dedicated', points: 1, dedicated: named ?? rules.dedicatedFallback };
  }
  switch (getSymbolDefinition(s.symbolType).role) {
    case 'socket':
      return { kind: 'socket', points: rules.multiSocketTypes.includes(s.symbolType) ? rules.multiSocketPoints : 1, dedicated: null };
    case 'light':
      return { kind: 'light', points: 1, dedicated: null };
    case 'switch':
      return { kind: 'switch', points: 0, dedicated: null };
    case 'appliance':
      return { kind: 'other', points: 0, dedicated: null };
    default:
      return null;
  }
}

/** Les segments [ab] et [cd] se coupent-ils ? */
function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Pièce déduite du plan : étiquette de pièce la plus proche visible sans traverser de mur. */
export function inferRoom(p: Point, rooms: Room[], walls: Wall[]): string | null {
  const sorted = [...rooms].sort((r1, r2) => Math.hypot(r1.x - p.x, r1.y - p.y) - Math.hypot(r2.x - p.x, r2.y - p.y));
  for (const r of sorted) {
    if (!walls.some((w) => segmentsCross(p, r, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }))) return r.name;
  }
  return null;
}

export interface RecapInput {
  plans: Plan[];
  symbols: PlacedSymbol[];
  circuits: ElectricalCircuit[];
  rules?: Nfc15100Rules;
}

/** Éléments de tous les plans du projet, avec niveau et pièce. */
export function collectElements(input: RecapInput): RecapElement[] {
  const rules = input.rules ?? NFC15100_RULES;
  const plans = [...input.plans].sort((a, b) => a.order - b.order);
  const planIndex = new Map(plans.map((p, i) => [p.id, { plan: p, order: i }]));
  const out: RecapElement[] = [];
  for (const s of input.symbols) {
    const c = classifySymbol(s, rules);
    const pl = planIndex.get(s.planId);
    if (!c || !pl) continue;
    const room = s.properties.room?.trim() || inferRoom(s, pl.plan.vectorData.rooms ?? [], pl.plan.vectorData.walls ?? []) || UNKNOWN_ROOM;
    out.push({ symbol: s, ...c, planId: s.planId, floorName: pl.plan.name, floorOrder: pl.order, room });
  }
  return out;
}

/** Ordre de parcours : niveau, pièce, puis position sur le plan. */
function byPlace(a: RecapElement, b: RecapElement): number {
  return a.floorOrder - b.floorOrder || a.room.localeCompare(b.room, 'fr') || a.symbol.y - b.symbol.y || a.symbol.x - b.symbol.x;
}

/* ------------------------------------------------------------------ */
/* Circuits                                                            */
/* ------------------------------------------------------------------ */

export type CircuitType = 'prises' | 'eclairage' | 'specialise' | 'mixte' | 'autre' | 'vide';
/** ok = vert, warn = orange (proche de la limite / à préciser), error = rouge (limite dépassée), unknown = gris (non vérifié). */
export type CircuitStatus = 'ok' | 'warn' | 'error' | 'unknown';

export const CIRCUIT_TYPE_LABELS: Record<CircuitType, string> = {
  prises: 'Prises',
  eclairage: 'Éclairage',
  specialise: 'Circuit spécialisé',
  mixte: 'Mixte',
  autre: 'Autre',
  vide: 'Vide',
};

export interface CircuitReport {
  /** Identifiant du circuit du tableau, ou « nom:… » pour un circuit seulement nommé sur le plan. */
  key: string;
  circuit: ElectricalCircuit | null;
  number: string;
  name: string;
  type: CircuitType;
  sectionMm2: number | null;
  breakerA: number | null;
  /** Éléments comptés : prises (points), points lumineux, ou appareils (circuit spécialisé). */
  count: number;
  /** Maximum autorisé (null : pas de limite vérifiée). */
  max: number | null;
  /** Unité de comptage : « prises », « points lumineux », « appareil ». */
  unit: string;
  status: CircuitStatus;
  messages: string[];
  elements: RecapElement[];
  /** Répartition par pièce (« Salon (3) »). */
  rooms: { name: string; count: number }[];
  /** Règle de circuit spécialisé appliquée. */
  dedicatedRule: DedicatedCircuitRule | null;
}

interface CircuitGroup {
  key: string;
  circuit: ElectricalCircuit | null;
  number: string;
  name: string;
  cableSection?: string;
  protection?: string;
  elements: RecapElement[];
}

/** Règle de prises correspondant à une section (la plus grande section inférieure ou égale). */
function socketRuleFor(section: number | null, rules: Nfc15100Rules): SocketCircuitRule | null {
  if (section === null) return rules.sockets[0];
  return [...rules.sockets].sort((a, b) => b.section - a.section).find((r) => r.section <= section + 1e-6) ?? null;
}

function analyzeGroup(g: CircuitGroup, rules: Nfc15100Rules): CircuitReport {
  const els = g.elements;
  const sockets = els.filter((e) => e.kind === 'socket');
  const lights = els.filter((e) => e.kind === 'light');
  const dedicated = els.filter((e) => e.kind === 'dedicated');
  const firstProp = (k: 'cableSection' | 'breaker') => els.map((e) => e.symbol.properties[k]).find((v) => v?.trim());
  const sectionMm2 = parseSection(g.cableSection ?? firstProp('cableSection'));
  const breakerA = parseAmps(g.protection ?? firstProp('breaker'));
  const nameRule = matchDedicated(g.name, rules);
  const messages: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];
  const sec = (n: number) => formatSection(n);

  let type: CircuitType;
  if (dedicated.length && (sockets.length || lights.length)) type = 'mixte';
  else if (dedicated.length || (nameRule && !sockets.length && !lights.length)) type = 'specialise';
  else if (sockets.length && lights.length) type = 'mixte';
  else if (sockets.length) type = 'prises';
  else if (lights.length) type = 'eclairage';
  else if (!els.length) type = 'vide';
  else type = 'autre';

  let count = 0;
  let max: number | null = null;
  let unit = 'éléments';
  let dedicatedRule: DedicatedCircuitRule | null = null;

  if (type === 'prises' || type === 'eclairage') {
    const rule = type === 'prises' ? socketRuleFor(sectionMm2, rules) : rules.lighting;
    const minSection = type === 'prises' ? Math.min(...rules.sockets.map((r) => r.section)) : rules.lighting.section;
    count = (type === 'prises' ? sockets : lights).reduce((s, e) => s + e.points, 0);
    unit = type === 'prises' ? 'prises' : 'points lumineux';
    if (sectionMm2 === null) warns.push(`Section non renseignée (${sec(rule!.section)} retenu)`);
    else if (!rule || sectionMm2 < minSection - 1e-6) errors.push(`Section ${sec(sectionMm2)} insuffisante (${sec(minSection)} minimum)`);
    const r = rule ?? rules.sockets[rules.sockets.length - 1];
    max = r.maxPoints;
    if (breakerA === null) warns.push('Calibre du disjoncteur non renseigné');
    else if (breakerA > r.breakerA)
      errors.push(
        type === 'prises'
          ? `Disjoncteur ${formatAmps(breakerA)} trop fort pour ${sec(r.section)} (${formatAmps(r.breakerA)} maximum)`
          : `Disjoncteur ${formatAmps(breakerA)} trop fort pour un circuit d’éclairage (${formatAmps(r.breakerA)} maximum)`,
      );
  } else if (type === 'specialise') {
    dedicatedRule = dedicated[0]?.dedicated ?? nameRule ?? rules.dedicatedFallback;
    count = dedicated.length;
    max = 1;
    unit = count > 1 ? 'appareils' : 'appareil';
    if (count > 1) errors.push(`Circuit dédié : 1 seul appareil par circuit (${count} sur ce circuit)`);
    if (dedicatedRule.verifySizing !== false) {
      if (sectionMm2 === null) warns.push(`Section non renseignée (${sec(dedicatedRule.section)} requis)`);
      else if (sectionMm2 < dedicatedRule.section - 1e-6) errors.push(`Section ${sec(sectionMm2)} insuffisante (${sec(dedicatedRule.section)} requis)`);
      if (breakerA === null) warns.push('Calibre du disjoncteur non renseigné');
      else if (breakerA > dedicatedRule.breakerA)
        errors.push(`Disjoncteur ${formatAmps(breakerA)} trop fort (${formatAmps(dedicatedRule.breakerA)} maximum pour ${dedicatedRule.label.toLowerCase()})`);
    } else messages.push('Section et calibre selon la puissance de l’appareil');
  } else if (type === 'mixte') {
    count = els.length;
    unit = count > 1 ? 'éléments' : 'élément';
    errors.push(
      dedicated.length
        ? 'Appareil spécialisé partagé avec d’autres éléments : circuit dédié obligatoire'
        : 'Prises et éclairage sur le même circuit : à séparer',
    );
  } else {
    count = els.length;
    unit = count > 1 ? 'éléments' : 'élément';
    messages.push(type === 'vide' ? 'Aucun élément sur les plans' : 'Équipements sans règle de calcul : non vérifié');
  }

  let status: CircuitStatus = 'ok';
  if (max !== null && count > max) errors.unshift(`Limite dépassée : ${count} ${unit} pour ${max} maximum`);
  if (errors.length) status = 'error';
  else if (type === 'autre' || type === 'vide') status = 'unknown';
  else if (warns.length) status = 'warn';
  if (status !== 'error' && max !== null && max > 1 && count >= Math.ceil(max * rules.nearLimitRatio) && count <= max) {
    if (status === 'ok') status = 'warn';
    warns.unshift(count === max ? `Limite atteinte : ${count} / ${max} ${unit}` : `Proche de la limite : ${count} / ${max} ${unit}`);
  }

  const roomCount = new Map<string, number>();
  for (const e of els) roomCount.set(e.room, (roomCount.get(e.room) ?? 0) + 1);

  return {
    key: g.key,
    circuit: g.circuit,
    number: g.number,
    name: g.name,
    type,
    sectionMm2,
    breakerA,
    count,
    max,
    unit,
    status,
    messages: [...errors, ...warns, ...messages],
    elements: [...els].sort(byPlace),
    rooms: [...roomCount].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    dedicatedRule,
  };
}

/* ------------------------------------------------------------------ */
/* Récapitulatif complet                                               */
/* ------------------------------------------------------------------ */

export interface RoomRow {
  floorName: string;
  floorOrder: number;
  room: string;
  sockets: number;
  switches: number;
  lights: number;
  dedicated: number;
}

export interface MaterialLine {
  label: string;
  qty: number;
  detail?: string;
}

export interface ProjectRecap {
  elements: RecapElement[];
  circuits: CircuitReport[];
  /** Éléments sans circuit. */
  unassigned: RecapElement[];
  rooms: RoomRow[];
  totals: { sockets: number; socketPoints: number; switches: number; lights: number; dedicated: number; others: number };
  statusCount: Record<CircuitStatus, number>;
  material: MaterialLine[];
  materialNotes: string[];
}

function circuitOrder(a: CircuitReport, b: CircuitReport): number {
  const na = Number.parseInt(a.number, 10);
  const nb = Number.parseInt(b.number, 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  if (Number.isFinite(na) !== Number.isFinite(nb)) return Number.isFinite(na) ? -1 : 1;
  return a.name.localeCompare(b.name, 'fr');
}

/** Regroupe les éléments par circuit (circuit du tableau, sinon nom saisi sur le plan). */
function groupByCircuit(elements: RecapElement[], circuits: ElectricalCircuit[]): { groups: CircuitGroup[]; unassigned: RecapElement[] } {
  const real = circuits.filter((c) => c.kind === 'circuit');
  const groups = new Map<string, CircuitGroup>(
    real.map((c) => [c.id, { key: c.id, circuit: c, number: c.number, name: c.name, cableSection: c.cableSection, protection: c.protection, elements: [] }]),
  );
  const unassigned: RecapElement[] = [];
  for (const e of elements) {
    const p = e.symbol.properties;
    const g = p.circuitId ? groups.get(p.circuitId) : undefined;
    if (g) {
      g.elements.push(e);
      continue;
    }
    const name = p.circuitName?.trim();
    if (!name) {
      unassigned.push(e);
      continue;
    }
    const key = `nom:${normName(name)}`;
    let named = groups.get(key);
    if (!named) {
      named = { key, circuit: null, number: p.circuitNumber?.trim() ?? '', name, cableSection: p.cableSection, protection: p.breaker, elements: [] };
      groups.set(key, named);
    }
    named.elements.push(e);
  }
  return { groups: [...groups.values()], unassigned };
}

export function buildRecap(input: RecapInput): ProjectRecap {
  const rules = input.rules ?? NFC15100_RULES;
  const elements = collectElements(input);
  const { groups, unassigned } = groupByCircuit(elements, input.circuits);
  const circuits = groups.map((g) => analyzeGroup(g, rules)).sort(circuitOrder);

  const rooms = new Map<string, RoomRow>();
  for (const e of elements) {
    const key = `${e.floorOrder}|${e.room}`;
    let r = rooms.get(key);
    if (!r) {
      r = { floorName: e.floorName, floorOrder: e.floorOrder, room: e.room, sockets: 0, switches: 0, lights: 0, dedicated: 0 };
      rooms.set(key, r);
    }
    if (e.kind === 'socket') r.sockets++;
    else if (e.kind === 'switch') r.switches++;
    else if (e.kind === 'light') r.lights++;
    else if (e.kind === 'dedicated') r.dedicated++;
  }
  const roomRows = [...rooms.values()]
    .filter((r) => r.sockets + r.switches + r.lights + r.dedicated > 0)
    .sort((a, b) => a.floorOrder - b.floorOrder || (a.room === UNKNOWN_ROOM ? 1 : b.room === UNKNOWN_ROOM ? -1 : a.room.localeCompare(b.room, 'fr')));

  const count = (k: ElementKind) => elements.filter((e) => e.kind === k).length;
  const statusCount: Record<CircuitStatus, number> = { ok: 0, warn: 0, error: 0, unknown: 0 };
  for (const c of circuits) statusCount[c.status]++;
  const { lines, notes } = buildMaterial(circuits, rules);

  return {
    elements,
    circuits,
    unassigned: [...unassigned].sort(byPlace),
    rooms: roomRows,
    totals: {
      sockets: count('socket'),
      socketPoints: elements.filter((e) => e.kind === 'socket').reduce((s, e) => s + e.points, 0),
      switches: count('switch'),
      lights: count('light'),
      dedicated: count('dedicated'),
      others: count('other'),
    },
    statusCount,
    material: lines,
    materialNotes: notes,
  };
}

/* ------------------------------------------------------------------ */
/* Liste du matériel                                                   */
/* ------------------------------------------------------------------ */

/** Matériel du tableau déduit des circuits : disjoncteurs par calibre, différentiels, coffret. */
export function buildMaterial(circuits: CircuitReport[], rules: Nfc15100Rules = NFC15100_RULES): { lines: MaterialLine[]; notes: string[] } {
  // Circuits à protéger : ceux du tableau et ceux nommés sur le plan (les circuits vides du tableau comptent aussi)
  const list = circuits.filter((c) => c.circuit || c.elements.length);
  const lines: MaterialLine[] = [];
  const notes: string[] = [];
  if (!list.length) return { lines, notes: ['Aucun circuit : lancez « Répartir automatiquement » ou ajoutez vos circuits dans le tableau.'] };

  const byAmps = new Map<number, number>();
  let unknownAmps = 0;
  for (const c of list) {
    if (c.breakerA === null) unknownAmps++;
    else byAmps.set(c.breakerA, (byAmps.get(c.breakerA) ?? 0) + 1);
  }
  for (const [a, n] of [...byAmps].sort((x, y) => x[0] - y[0])) {
    lines.push({ label: `Disjoncteur divisionnaire 1P+N ${formatAmps(a)}`, detail: `Courbe C (C${a})`, qty: n });
  }
  if (unknownAmps) lines.push({ label: 'Disjoncteur divisionnaire 1P+N', detail: 'Calibre à préciser', qty: unknownAmps });

  const breakers = list.length;
  const typeACircuits = list.filter((c) => c.dedicatedRule?.rcdTypeA).length;
  const totalRcd = Math.max(1, Math.ceil(breakers / rules.rcd.maxCircuits));
  const rcdA = rules.rcd.defaultType === 'A' ? totalRcd : Math.min(totalRcd, Math.ceil(typeACircuits / rules.rcd.maxCircuits));
  const rcdAc = totalRcd - rcdA;
  if (rcdAc)
    lines.push({
      label: `Interrupteur différentiel 30 mA type AC`,
      detail: `${rules.rcd.rating} · ${rules.rcd.maxCircuits} circuits maximum en aval`,
      qty: rcdAc,
    });
  if (rcdA)
    lines.push({
      label: `Interrupteur différentiel 30 mA type A`,
      detail: `${rules.rcd.rating}${typeACircuits ? ' · plaque de cuisson, lave-linge, recharge VE' : ''}`,
      qty: rcdA,
    });

  const hasWaterHeater = list.some((c) => c.dedicatedRule?.id === 'chauffe-eau');
  if (hasWaterHeater) lines.push({ label: 'Contacteur heures creuses', detail: 'Chauffe-eau (conseillé)', qty: 1 });

  const modules = breakers + 2 * totalRcd + (hasWaterHeater ? 1 : 0);
  const rows = Math.max(1, Math.ceil((modules * (1 + rules.reservePercent / 100)) / rules.modulesPerRow));
  lines.push({ label: `Peigne d’alimentation ${rules.modulesPerRow} modules`, detail: '1 par rangée', qty: rows });
  lines.push({
    label: `Coffret ${rows} rangée${rows > 1 ? 's' : ''} de ${rules.modulesPerRow} modules`,
    detail: `${modules} modules occupés + ${rules.reservePercent} % de réserve`,
    qty: 1,
  });

  notes.push('Disjoncteur de branchement non compté (installé avec le compteur).');
  notes.push('Le nombre minimal d’interrupteurs différentiels dépend aussi de la surface du logement.');
  if (unknownAmps) notes.push(`${unknownAmps} circuit(s) sans calibre renseigné.`);
  return { lines, notes };
}

/* ------------------------------------------------------------------ */
/* Répartition automatique                                             */
/* ------------------------------------------------------------------ */

/** Circuit à créer dans le tableau. */
export interface NewCircuitDraft {
  id: string;
  number: string;
  name: string;
  protection: string;
  cableSection: string;
  icon: string;
}

export interface DistributionPlan {
  newCircuits: NewCircuitDraft[];
  /** Symbole → circuit (existant ou créé). */
  assignments: { symbolId: string; circuitId: string }[];
  summary: string[];
  /** Éléments laissés sans circuit (équipements sans règle : chauffage, ventilation…). */
  leftover: number;
}

interface OpenCircuit {
  id: string;
  type: 'prises' | 'eclairage';
  max: number;
  used: number;
  planId: string;
  rooms: string[];
  draft: NewCircuitDraft | null;
}

/**
 * Calcule la répartition : circuits trop chargés découpés, circuits mixtes séparés,
 * appareils spécialisés sur un circuit dédié, éléments sans circuit affectés
 * (en regroupant les pièces d'un même niveau). Rien n'est enregistré ici.
 */
export function planAutoDistribution(input: RecapInput, idFactory: (prefix: string) => string = createId): DistributionPlan {
  const rules = input.rules ?? NFC15100_RULES;
  const recap = buildRecap(input);
  const newCircuits: NewCircuitDraft[] = [];
  const assign = new Map<string, string>();
  const summary: string[] = [];
  const usedNames = new Set(input.circuits.map((c) => normName(c.name)));
  let nextNumber = input.circuits.reduce((m, c) => Math.max(m, Number.parseInt(c.number, 10) || 0), 0) + 1;
  for (const r of recap.circuits) if (!r.circuit) nextNumber = Math.max(nextNumber, (Number.parseInt(r.number, 10) || 0) + 1);

  const uniqueName = (name: string) => {
    let n = name;
    for (let i = 2; usedNames.has(normName(n)); i++) n = `${name} ${i}`;
    usedNames.add(normName(n));
    return n;
  };
  const create = (name: string, section: number, breakerA: number, icon: string): NewCircuitDraft => {
    const draft: NewCircuitDraft = {
      id: idFactory('cir'),
      number: String(nextNumber++),
      name: uniqueName(name),
      protection: `C${breakerA}`,
      cableSection: formatSection(section),
      icon,
    };
    newCircuits.push(draft);
    return draft;
  };

  const open: OpenCircuit[] = [];
  const poolSockets: RecapElement[] = [];
  const poolLights: RecapElement[] = [];
  const poolSwitches: RecapElement[] = [];
  const poolDedicated: RecapElement[] = [];
  let leftover = 0;
  const emptyDedicated = recap.circuits.filter((c) => c.circuit && c.type === 'specialise' && c.count === 0);
  let split = 0;
  let separated = 0;

  for (const r of recap.circuits) {
    // Circuit seulement nommé sur le plan : il est créé dans le tableau avec ses caractéristiques
    let targetId = r.circuit?.id ?? null;
    if (!r.circuit) {
      const rule = r.type === 'eclairage' ? rules.lighting : r.type === 'specialise' ? r.dedicatedRule : socketRuleFor(r.sectionMm2, rules);
      const d = create(
        r.name,
        r.sectionMm2 ?? rule?.section ?? rules.sockets[0].section,
        r.breakerA ?? rule?.breakerA ?? rules.sockets[0].breakerA,
        iconFor(r.type, r.dedicatedRule),
      );
      if (r.number && !newCircuits.some((c) => c !== d && c.number === r.number) && !input.circuits.some((c) => c.number === r.number)) d.number = r.number;
      targetId = d.id;
      for (const e of r.elements) assign.set(e.symbol.id, d.id);
    }
    const id = targetId!;

    if (r.type === 'prises' || r.type === 'eclairage') {
      const counted = r.elements.filter((e) => e.kind === (r.type === 'prises' ? 'socket' : 'light'));
      let used = 0;
      const overflow: RecapElement[] = [];
      for (const e of counted) {
        if (used + e.points <= (r.max ?? Infinity)) used += e.points;
        else overflow.push(e);
      }
      if (overflow.length) {
        split++;
        const section = r.sectionMm2 ?? (r.type === 'prises' ? rules.sockets[0].section : rules.lighting.section);
        const breaker = r.breakerA ?? (r.type === 'prises' ? rules.sockets[0].breakerA : rules.lighting.breakerA);
        let cur: NewCircuitDraft | null = null;
        let curUsed = 0;
        for (const e of overflow) {
          if (!cur || curUsed + e.points > (r.max ?? Infinity)) {
            cur = create(r.name, section, breaker, iconFor(r.type, null));
            curUsed = 0;
          }
          curUsed += e.points;
          assign.set(e.symbol.id, cur.id);
        }
      } else if (r.max !== null) {
        const planId = counted[0]?.planId ?? r.elements[0]?.planId;
        if (planId) open.push({ id, type: r.type, max: r.max, used, planId, rooms: [...new Set(counted.map((e) => e.room))], draft: null });
      }
    } else if (r.type === 'mixte') {
      separated++;
      const keepSockets = r.elements.filter((e) => e.kind === 'socket');
      const socketRule = socketRuleFor(r.sectionMm2, rules) ?? rules.sockets[0];
      if (keepSockets.length) {
        // Les prises restent sur le circuit (dans la limite), le reste est réparti
        let used = 0;
        for (const e of keepSockets) {
          if (used + e.points <= socketRule.maxPoints) used += e.points;
          else poolSockets.push(e);
        }
        poolLights.push(...r.elements.filter((e) => e.kind === 'light'));
        poolSwitches.push(...r.elements.filter((e) => e.kind === 'switch'));
      } else {
        poolLights.push(...r.elements.filter((e) => e.kind === 'light'));
        poolSwitches.push(...r.elements.filter((e) => e.kind === 'switch'));
      }
      poolDedicated.push(...r.elements.filter((e) => e.kind === 'dedicated'));
    } else if (r.type === 'specialise' && r.count > 1) {
      split++;
      poolDedicated.push(...r.elements.filter((e) => e.kind === 'dedicated').slice(1));
    }
  }

  for (const e of recap.unassigned) {
    if (e.kind === 'socket') poolSockets.push(e);
    else if (e.kind === 'light') poolLights.push(e);
    else if (e.kind === 'switch') poolSwitches.push(e);
    else if (e.kind === 'dedicated') poolDedicated.push(e);
    else leftover++;
  }

  // Appareils spécialisés : circuit dédié vide existant (même appareil), sinon nouveau circuit
  for (const e of poolDedicated.sort(byPlace)) {
    const rule = e.dedicated ?? rules.dedicatedFallback;
    const idx = emptyDedicated.findIndex((c) => (c.dedicatedRule?.id ?? '') === rule.id);
    if (idx >= 0) {
      assign.set(e.symbol.id, emptyDedicated[idx].circuit!.id);
      emptyDedicated.splice(idx, 1);
      continue;
    }
    const label = rule === rules.dedicatedFallback && e.symbol.properties.label?.trim() ? e.symbol.properties.label.trim() : rule.label;
    assign.set(e.symbol.id, create(label, rule.section, rule.breakerA, iconFor('specialise', rule)).id);
  }

  // Prises puis éclairages : on complète d'abord les circuits de la même pièce, puis on regroupe les pièces d'un niveau
  const fill = (pool: RecapElement[], type: 'prises' | 'eclairage') => {
    const rule = type === 'prises' ? rules.sockets[0] : rules.lighting;
    for (const e of pool.sort(byPlace)) {
      let target =
        open.find((o) => o.type === type && o.planId === e.planId && o.rooms.includes(e.room) && o.used + e.points <= o.max) ??
        open.find((o) => o.type === type && o.draft && o.planId === e.planId && o.used + e.points <= o.max);
      if (!target) {
        const draft = create(type === 'prises' ? 'Prises' : 'Éclairage', rule.section, rule.breakerA, iconFor(type, null));
        target = { id: draft.id, type, max: rule.maxPoints, used: 0, planId: e.planId, rooms: [], draft };
        open.push(target);
      }
      target.used += e.points;
      if (!target.rooms.includes(e.room)) target.rooms.push(e.room);
      assign.set(e.symbol.id, target.id);
    }
  };
  fill(poolSockets, 'prises');
  fill(poolLights, 'eclairage');

  // Commandes : avec l'éclairage de leur pièce, sinon du même niveau
  for (const e of poolSwitches) {
    const lightCircuit =
      open.find((o) => o.type === 'eclairage' && o.planId === e.planId && o.rooms.includes(e.room)) ??
      open.find((o) => o.type === 'eclairage' && o.planId === e.planId);
    if (lightCircuit) assign.set(e.symbol.id, lightCircuit.id);
    else leftover++;
  }

  // Noms des nouveaux circuits : « Prises Salon / Cuisine »
  const floorName = new Map(recap.elements.map((e) => [e.planId, e.floorName]));
  for (const o of open) {
    if (!o.draft) continue;
    const known = o.rooms.filter((r) => r !== UNKNOWN_ROOM);
    const place = known.length && known.length <= 3 ? known.join(' / ') : (floorName.get(o.planId) ?? '');
    usedNames.delete(normName(o.draft.name));
    o.draft.name = uniqueName(`${o.type === 'prises' ? 'Prises' : 'Éclairage'}${place ? ` ${place}` : ''}`);
  }

  const assignments = [...assign].map(([symbolId, circuitId]) => ({ symbolId, circuitId }));
  // N'affecte que ce qui change réellement
  const current = new Map(input.symbols.map((s) => [s.id, s.properties.circuitId]));
  const changes = assignments.filter((a) => current.get(a.symbolId) !== a.circuitId);
  if (newCircuits.length) summary.push(`${newCircuits.length} circuit${newCircuits.length > 1 ? 's' : ''} créé${newCircuits.length > 1 ? 's' : ''}`);
  if (changes.length) summary.push(`${changes.length} élément${changes.length > 1 ? 's' : ''} affecté${changes.length > 1 ? 's' : ''} à un circuit`);
  if (split) summary.push(`${split} circuit${split > 1 ? 's' : ''} trop chargé${split > 1 ? 's' : ''} découpé${split > 1 ? 's' : ''}`);
  if (separated) summary.push(`${separated} circuit${separated > 1 ? 's' : ''} mixte${separated > 1 ? 's' : ''} séparé${separated > 1 ? 's' : ''}`);
  if (leftover) summary.push(`${leftover} élément${leftover > 1 ? 's' : ''} à affecter à la main (chauffage, ventilation, commandes sans éclairage…)`);
  return { newCircuits, assignments: changes, summary, leftover };
}

/** Pictogramme d'étiquette du nouveau circuit. */
function iconFor(type: CircuitType, rule: DedicatedCircuitRule | null): string {
  if (type === 'eclairage') return 'point-lumineux';
  if (type === 'specialise' && rule) {
    const icons: Record<string, string> = {
      plaque: 'plaque-cuisson',
      four: 'four',
      'lave-linge': 'lave-linge',
      'seche-linge': 'seche-linge',
      'lave-vaisselle': 'lave-vaisselle',
      congelateur: 'congelateur',
      'chauffe-eau': 'chauffe-eau',
      vmc: 'bouche-vmc',
      ve: 'borne-recharge-ve',
    };
    return icons[rule.id] ?? 'prise-20a';
  }
  return 'prise-16a';
}
