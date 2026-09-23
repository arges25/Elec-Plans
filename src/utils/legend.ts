import type { ElectricalSymbolDefinition, PlacedSymbol } from '../types';
import { getSymbolDefinition, SYMBOL_CATEGORIES } from '../data/electricalSymbols';

export interface LegendEntry {
  def: ElectricalSymbolDefinition;
  count: number;
}

/** Analyse les symboles présents et construit la légende (ordre de la bibliothèque). */
export function buildLegend(symbols: PlacedSymbol[]): LegendEntry[] {
  const counts = new Map<string, number>();
  for (const s of symbols) counts.set(s.symbolType, (counts.get(s.symbolType) ?? 0) + 1);
  const catOrder = new Map(SYMBOL_CATEGORIES.map((c, i) => [c.id, i]));
  return [...counts.entries()]
    .map(([id, count]) => ({ def: getSymbolDefinition(id), count }))
    .sort((a, b) => (catOrder.get(a.def.category) ?? 99) - (catOrder.get(b.def.category) ?? 99) || a.def.name.localeCompare(b.def.name, 'fr'));
}
