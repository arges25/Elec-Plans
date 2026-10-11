import type { ElectricalConnection, PlacedSymbol, SymbolRole } from '../types';
import { getSymbolDefinition } from '../data/electricalSymbols';
import { distance } from './geometry';

/**
 * « Flash de provenance » : retrouve le chemin d'alimentation d'un élément
 * (prise, interrupteur…) jusqu'au tableau électrique.
 */

/** Deux familles de câbles, affichées avec une couleur et un libellé différents. */
export type SupplyKind = 'prise' | 'eclairage';

export interface SupplyInfo {
  kind: SupplyKind;
  /** Titre de la carte : « Alimentation prise », « Alimentation interrupteur »… */
  title: string;
  /** Nature du câble : « Câble de prises », « Câble d’éclairage / commande ». */
  cable: string;
  /** Couleur du flash. */
  color: string;
  /** Halo autour du flash (couleur translucide). */
  glow: string;
}

/** Couleurs : orange pour les prises (charte MG), bleu pour l'éclairage / les commandes. */
export const SUPPLY_COLORS: Record<SupplyKind, { color: string; glow: string }> = {
  prise: { color: '#f97316', glow: 'rgba(249,115,22,0.32)' },
  eclairage: { color: '#2563eb', glow: 'rgba(37,99,235,0.30)' },
};

const TITLES: Partial<Record<SymbolRole, { kind: SupplyKind; title: string; cable: string }>> = {
  socket: { kind: 'prise', title: 'Alimentation prise', cable: 'Câble de prises' },
  appliance: { kind: 'prise', title: 'Alimentation appareil', cable: 'Câble d’alimentation (circuit dédié)' },
  switch: { kind: 'eclairage', title: 'Alimentation interrupteur', cable: 'Câble d’éclairage / commande' },
  light: { kind: 'eclairage', title: 'Alimentation éclairage', cable: 'Câble d’éclairage / commande' },
};

/** Informations d'alimentation d'un type de symbole (null : élément non concerné, ex. RJ45). */
export function supplyInfo(symbolType: string): SupplyInfo | null {
  const t = TITLES[getSymbolDefinition(symbolType).role];
  return t ? { ...t, ...SUPPLY_COLORS[t.kind] } : null;
}

/** Symbole représentant le tableau (ou un appareil de tableau) sur le plan. */
export function isPanelSymbol(symbolType: string): boolean {
  return getSymbolDefinition(symbolType).role === 'panel';
}

/** Tableau principal d'une liste de symboles : « Tableau électrique » en priorité. */
export function findPanelSymbol(symbols: PlacedSymbol[]): PlacedSymbol | null {
  return symbols.find((s) => s.symbolType === 'tableau-electrique') ?? symbols.find((s) => isPanelSymbol(s.symbolType)) ?? null;
}

export interface SupplyPath {
  /** Symbole « tableau » atteint. */
  panelId: string;
  /** Liaisons du chemin, de l'élément vers le tableau. */
  connectionIds: string[];
  /** Symboles traversés, de l'élément vers le tableau (inclus). */
  symbolIds: string[];
}

/**
 * Plus court chemin (en nombre de liaisons « Relier ») entre un élément et un tableau.
 * Les liaisons « Information » (réseau, bus…) ne transportent pas l'alimentation : ignorées.
 */
export function findSupplyPath(startId: string, symbols: PlacedSymbol[], connections: ElectricalConnection[]): SupplyPath | null {
  const byId = new Map(symbols.map((s) => [s.id, s]));
  const start = byId.get(startId);
  if (!start || isPanelSymbol(start.symbolType)) return null;
  const adj = new Map<string, { to: string; conn: string }[]>();
  const link = (a: string, b: string, conn: string) => {
    const list = adj.get(a);
    if (list) list.push({ to: b, conn });
    else adj.set(a, [{ to: b, conn }]);
  };
  for (const c of connections) {
    if (c.type === 'information' || !byId.has(c.sourceId) || !byId.has(c.targetId)) continue;
    link(c.sourceId, c.targetId, c.id);
    link(c.targetId, c.sourceId, c.id);
  }
  // Parcours en largeur : le premier tableau atteint est le plus proche en nombre de liaisons.
  const prev = new Map<string, { from: string; conn: string }>();
  const seen = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift()!;
    if (id !== startId && isPanelSymbol(byId.get(id)!.symbolType)) {
      const connectionIds: string[] = [];
      const symbolIds = [id];
      let cur = id;
      while (cur !== startId) {
        const p = prev.get(cur)!;
        connectionIds.push(p.conn);
        symbolIds.push(p.from);
        cur = p.from;
      }
      return { panelId: id, connectionIds: connectionIds.reverse(), symbolIds: symbolIds.reverse() };
    }
    for (const n of adj.get(id) ?? []) {
      if (seen.has(n.to)) continue;
      seen.add(n.to);
      prev.set(n.to, { from: id, conn: n.conn });
      queue.push(n.to);
    }
  }
  return null;
}

/**
 * Tracé indicatif quand aucune liaison ne rejoint le tableau : on part du tableau et on
 * passe, de proche en proche, par les éléments du même circuit jusqu'à l'élément choisi
 * (comme un câble de prises qui chemine d'une prise à l'autre).
 * Renvoie les identifiants des symboles, du tableau vers l'élément.
 */
export function indicativeChain(panel: PlacedSymbol, target: PlacedSymbol, members: PlacedSymbol[], maxHops = 24): string[] {
  const chain = [panel.id];
  const remaining = members.filter((m) => m.id !== target.id && m.id !== panel.id);
  let cur: PlacedSymbol = panel;
  for (let hop = 0; hop < maxHops; hop++) {
    let best: PlacedSymbol = target;
    let bestD = distance(cur, target);
    for (const m of remaining) {
      const d = distance(cur, m);
      if (d < bestD) {
        best = m;
        bestD = d;
      }
    }
    chain.push(best.id);
    if (best.id === target.id) return chain;
    remaining.splice(remaining.indexOf(best), 1);
    cur = best;
  }
  chain.push(target.id);
  return chain;
}
