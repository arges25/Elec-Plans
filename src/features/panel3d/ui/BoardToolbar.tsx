import { Expand } from 'lucide-react';
import type { BoardView } from '../types';
import { formatPercent, occupancy } from '../engine/boardOps';
import { capacityOf, usePanelEditor } from '../store/panelEditorStore';
import { useUiStore } from './uiStore';

/** Barre au-dessus du tableau : vue schéma / coffret, occupation en temps réel, aperçu plein écran. */
export function BoardToolbar() {
  const doc = usePanelEditor((s) => s.doc)!;
  const occ = occupancy(doc.devices, capacityOf(doc));
  const alert = doc.minFreePercent !== null && occ.freePercent + 1e-9 < doc.minFreePercent;
  const views: { id: BoardView; label: string }[] = [
    { id: 'schema', label: 'Schéma tableau' },
    { id: 'coffret', label: 'Vue coffret' },
  ];
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-2 py-1.5">
      <div role="radiogroup" aria-label="Affichage du tableau" className="inline-flex rounded-xl bg-slate-100 p-1">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={doc.view === v.id}
            onClick={() => usePanelEditor.getState().setSettings({ view: v.id })}
            data-testid={`view-${v.id}`}
            className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${doc.view === v.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div
        className={`flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-sm ${alert ? 'bg-red-50 text-red-800 ring-1 ring-red-200' : 'bg-slate-100 text-slate-700'}`}
        data-testid="occupancy"
        title={alert ? `Réserve minimale de ${doc.minFreePercent} % non respectée` : undefined}
      >
        <span className="hidden xl:inline">
          {occ.totalModules} modules · {String(occ.usedModules).replace('.', ',')} occupés ·
        </span>
        <strong>{String(occ.freeModules).replace('.', ',')} libres</strong>
        <span>({formatPercent(occ.freePercent)})</span>
      </div>
      <button
        type="button"
        onClick={() => useUiStore.getState().setFullscreen(true)}
        className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-50"
        data-testid="open-fullscreen"
        title="Aperçu plein écran"
      >
        <Expand className="size-4" aria-hidden /> <span className="hidden xl:inline">Aperçu plein écran</span>
      </button>
    </div>
  );
}
