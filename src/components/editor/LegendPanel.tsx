import { useMemo } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { buildLegend } from '../../utils/legend';
import { SymbolIcon } from '../symbols/SymbolIcon';
import { EmptyState } from '../ui/Card';

/** Légende automatique : liste des symboles présents sur le plan. */
export function LegendPanel() {
  const symbols = useEditorStore((s) => s.doc.symbols);
  const connections = useEditorStore((s) => s.doc.connections);
  const legend = useMemo(() => buildLegend(symbols), [symbols]);
  const hasCmd = connections.some((c) => c.type === 'command');
  const hasCircuit = connections.some((c) => c.type === 'circuit');
  const hasInfo = connections.some((c) => c.type === 'information');
  if (!legend.length) return <div className="p-4"><EmptyState title="Aucun symbole sur ce plan">La légende se construit automatiquement à partir des symboles placés.</EmptyState></div>;
  return (
    <div className="p-4">
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {legend.map((e) => (
          <li key={e.def.id} className="flex items-center gap-3 px-3 py-2">
            <SymbolIcon id={e.def.id} size={32} />
            <span className="flex-1 text-sm font-medium text-gray-800">{e.def.name}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-700">× {e.count}</span>
          </li>
        ))}
        {hasCmd && <LegendLine color="#f97316" dash="6 4" label="Liaison de commande" />}
        {hasCircuit && <LegendLine color="#2563eb" dash="12 5" label="Liaison de circuit" />}
        {hasInfo && <LegendLine color="#6b7280" dash="1 5" label="Information" />}
      </ul>
      <p className="mt-3 text-xs text-gray-500">La légende peut être ajoutée au PDF depuis l’écran Export.</p>
    </div>
  );
}

function LegendLine({ color, dash, label }: { color: string; dash: string; label: string }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <path d="M2 24 Q16 4 30 12" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={dash} strokeLinecap="round" />
      </svg>
      <span className="flex-1 text-sm font-medium text-gray-800">{label}</span>
    </li>
  );
}
