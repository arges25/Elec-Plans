import type { ElectricalCircuit, PlacedSymbol } from '../../types';
import { db } from '../../database/db';
import { getSymbolDefinition } from '../../data/electricalSymbols';
import { useEditorStore } from '../../store/editorStore';
import { useViewStore } from '../../store/viewStore';
import { useSupplyFlashStore, type MiniPanelRow, type SupplyFlash } from '../../store/supplyFlashStore';
import { findPanelSymbol, findSupplyPath, indicativeChain, isPanelSymbol, supplyInfo } from '../../utils/supplyPath';
import { circuitLabel, formatAmps, normName, parseAmps } from '../../utils/electrical';
import { symbolWorldSize } from '../../utils/symbols';

/** Peut-on afficher l'alimentation de ce symbole ? (prises, appareils, interrupteurs, éclairages) */
export function canShowSupply(symbolType: string): boolean {
  return supplyInfo(symbolType) !== null;
}

/**
 * Bouton « Alimentation » : calcule le chemin de l'élément jusqu'au tableau,
 * le fait clignoter sur le plan et affiche l'étiquette du circuit.
 */
export async function showSupply(symbolId: string): Promise<void> {
  const st = useEditorStore.getState();
  const sym = st.doc.symbols.find((s) => s.id === symbolId);
  const info = sym ? supplyInfo(sym.symbolType) : null;
  if (!sym || !info || !st.projectId || !st.plan) return;
  const { doc, projectId, plan } = st;

  // Circuit du tableau (source de vérité : section et calibre du tableau)
  const panel = await db.panels.where('projectId').equals(projectId).first();
  const circuits: ElectricalCircuit[] = panel ? await db.circuits.where('panelId').equals(panel.id).toArray() : [];
  const circuit = sym.properties.circuitId ? circuits.find((c) => c.id === sym.properties.circuitId) : undefined;
  const freeName = sym.properties.circuitName?.trim();
  const hasCircuit = Boolean(circuit || freeName || sym.properties.circuitNumber?.trim());
  const path = findSupplyPath(sym.id, doc.symbols, doc.connections);

  const base: Omit<SupplyFlash, 'key' | 'status' | 'note'> = {
    symbolId: sym.id,
    info,
    connectionIds: [],
    chainIds: [],
    panelSymbolId: null,
    memberIds: [],
    circuitLabel: null,
    planTag: null,
    panelRows: [],
  };

  if (!hasCircuit && !path) {
    useSupplyFlashStore.getState().show({ ...base, status: 'none', note: 'Cet élément n’est relié à aucun circuit' });
    return;
  }

  // Autres éléments du même circuit sur ce plan
  const sameCircuit = (s: PlacedSymbol) =>
    s.id !== sym.id &&
    !isPanelSymbol(s.symbolType) &&
    (circuit
      ? s.properties.circuitId === circuit.id
      : Boolean(freeName && s.properties.circuitName && normName(s.properties.circuitName) === normName(freeName)));
  const members = hasCircuit ? doc.symbols.filter(sameCircuit) : [];

  const label = hasCircuit
    ? circuitLabel({
        number: circuit?.number ?? sym.properties.circuitNumber,
        name: circuit?.name ?? freeName,
        cableSection: circuit?.cableSection ?? sym.properties.cableSection,
        protection: circuit?.protection ?? sym.properties.breaker,
      })
    : null;

  // Étiquette courte sur le plan : « Circuit 3 · 16 A »
  const amps = parseAmps(circuit?.protection ?? sym.properties.breaker);
  const number = (circuit?.number ?? sym.properties.circuitNumber)?.trim();
  const planTag = hasCircuit
    ? [number ? `Circuit ${number}` : (circuit?.name ?? freeName ?? 'Circuit'), amps !== null ? formatAmps(amps) : ''].filter(Boolean).join(' · ')
    : null;

  const panelRows: MiniPanelRow[] =
    panel && circuit
      ? panel.rows
          .map((r) => ({
            id: r.id,
            name: r.name,
            cells: circuits
              .filter((c) => c.rowId === r.id)
              .sort((a, b) => a.order - b.order)
              .map((c) => ({ id: c.id, number: c.number, kind: c.kind, modules: c.modules, name: c.name, active: c.id === circuit.id })),
          }))
          .filter((r) => r.cells.length > 0)
      : [];

  let flash: Omit<SupplyFlash, 'key'>;
  const panelOnPlan = path ? (doc.symbols.find((s) => s.id === path.panelId) ?? null) : findPanelSymbol(doc.symbols);
  const unknownCircuit = hasCircuit ? '' : ' · circuit non renseigné dans les propriétés';
  if (path) {
    const n = path.connectionIds.length;
    flash = {
      ...base,
      status: 'path',
      connectionIds: path.connectionIds,
      panelSymbolId: path.panelId,
      memberIds: members.map((m) => m.id),
      circuitLabel: label,
      planTag,
      panelRows,
      note: `${info.cable} · ${n} liaison${n > 1 ? 's' : ''} jusqu’au tableau${unknownCircuit}`,
    };
  } else if (panelOnPlan) {
    flash = {
      ...base,
      status: 'indicative',
      chainIds: indicativeChain(panelOnPlan, sym, members),
      panelSymbolId: panelOnPlan.id,
      memberIds: members.map((m) => m.id),
      circuitLabel: label,
      planTag,
      panelRows,
      note: `${info.cable} · tracé indicatif (pas de liaison « Relier » jusqu’au tableau)`,
    };
  } else {
    flash = {
      ...base,
      status: 'circuit',
      memberIds: members.map((m) => m.id),
      circuitLabel: label,
      planTag,
      panelRows,
      note: `${info.cable} · ${await panelElsewhere(projectId, plan.id)}`,
    };
  }
  useSupplyFlashStore.getState().show(flash);
  revealFlash(flash, doc.symbols);
}

/** Où se trouve le tableau quand il n'est pas sur ce plan ? */
async function panelElsewhere(projectId: string, planId: string): Promise<string> {
  const others = (await db.symbolsPlaced.where('projectId').equals(projectId).toArray()).filter((s) => s.planId !== planId);
  const panel = findPanelSymbol(others);
  if (!panel) return 'aucun « Tableau électrique » placé sur les plans';
  const p = await db.plans.get(panel.planId);
  return `tableau placé sur le plan « ${p?.name ?? 'autre niveau'} »`;
}

/** Recadre la vue si le chemin sort de l'écran (sans zoomer davantage). */
function revealFlash(flash: Omit<SupplyFlash, 'key'>, symbols: PlacedSymbol[]) {
  const ids = new Set([flash.symbolId, ...flash.chainIds, ...flash.memberIds, ...(flash.panelSymbolId ? [flash.panelSymbolId] : [])]);
  const conns = useEditorStore.getState().doc.connections.filter((c) => flash.connectionIds.includes(c.id));
  for (const c of conns) {
    ids.add(c.sourceId);
    ids.add(c.targetId);
  }
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const s of symbols) {
    if (!ids.has(s.id)) continue;
    const r = symbolWorldSize(getSymbolDefinition(s.symbolType), s.scale);
    x1 = Math.min(x1, s.x - r);
    y1 = Math.min(y1, s.y - r);
    x2 = Math.max(x2, s.x + r);
    y2 = Math.max(y2, s.y + r);
  }
  if (!Number.isFinite(x1)) return;
  // Attend l'affichage de la carte pour connaître la place qu'elle occupe en haut du plan
  requestAnimationFrame(() => {
    const card = document.querySelector('[data-testid="supply-card"]')?.getBoundingClientRect();
    const stage = document.querySelector('[data-testid="plan-stage"]')?.getBoundingClientRect();
    const t = card && stage ? Math.max(24, card.bottom - stage.top + 16) : undefined;
    useViewStore.getState().api?.reveal?.({ x1, y1, x2, y2 }, t !== undefined ? { t } : undefined);
  });
}
