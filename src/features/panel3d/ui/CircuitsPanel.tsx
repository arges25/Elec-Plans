import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { BoardDoc, PlacedDevice } from '../types';
import { getProduct } from '../data/catalog';
import { normalizeText } from '../render/icons';
import { displayLabel, usePanelEditor } from '../store/panelEditorStore';
import { useUiStore } from './uiStore';

/**
 * Liste des circuits du tableau : « 01 — Plaque induction — 32 A ».
 * Toucher une ligne sélectionne l'appareil et recentre la vue dessus.
 */

export interface CircuitLine {
  device: PlacedDevice;
  ref: string;
  text: string;
  rating: string;
  kind: string;
}

export function circuitLines(doc: BoardDoc): CircuitLine[] {
  return [...doc.devices]
    .sort((a, b) => a.row - b.row || a.startModule - b.startModule)
    .map((d) => {
      const p = getProduct(d.productId);
      const rating = p?.rating ? `${p.rating} A` : '';
      return { device: d, ref: d.circuitRef.trim(), text: displayLabel(doc, d).trim() || (p?.kind === 'reserve' ? 'Réserve' : (p?.fullName ?? 'Appareil')), rating, kind: p?.kind ?? '' };
    })
    .filter((l) => l.kind !== 'blank');
}

/** Recherche : nom, nom court, repère, désignation produit. */
export function searchCircuits(lines: CircuitLine[], query: string): CircuitLine[] {
  const q = normalizeText(query);
  if (!q) return lines;
  return lines.filter((l) => normalizeText(`${l.ref} ${l.text} ${l.device.label} ${l.device.shortLabel} ${l.rating}`).split(' ').some((w) => w.startsWith(q)) || normalizeText(`${l.text} ${l.device.label}`).includes(q));
}

export function selectCircuit(deviceId: string) {
  usePanelEditor.getState().select({ kind: 'device', id: deviceId });
  useUiStore.getState().focusDevice(deviceId);
}

export function CircuitsPanel({ onPicked }: { onPicked?: () => void }) {
  const doc = usePanelEditor((s) => s.doc)!;
  const selection = usePanelEditor((s) => s.selection);
  const [query, setQuery] = useState('');
  const lines = useMemo(() => circuitLines(doc), [doc]);
  const found = useMemo(() => searchCircuits(lines, query), [lines, query]);
  const selectedId = selection && 'id' in selection ? selection.id : null;

  const pick = (id: string) => {
    selectCircuit(id);
    onPicked?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="circuits-panel">
      <div className="shrink-0 border-b border-slate-200 p-3">
        <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
          <Search className="size-4 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Sélection immédiate du premier circuit trouvé
              const first = searchCircuits(lines, e.target.value)[0];
              if (e.target.value.trim() && first) selectCircuit(first.device.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && found[0]) pick(found[0].device.id);
            }}
            placeholder="Rechercher un circuit (ex. Four)"
            aria-label="Rechercher un circuit"
            className="min-h-10 min-w-0 flex-1 bg-transparent outline-none"
            data-testid="circuit-search"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {Array.from(new Set(found.map((l) => l.device.row))).map((row) => (
          <section key={row} className="mb-2">
            <h3 className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">Rangée {row + 1}</h3>
            <ul>
              {found
                .filter((l) => l.device.row === row)
                .map((l) => (
                  <li key={l.device.id}>
                    <button
                      type="button"
                      onClick={() => pick(l.device.id)}
                      className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm ${selectedId === l.device.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
                      data-testid="circuit-line"
                    >
                      <span className={`w-10 shrink-0 text-right font-mono font-bold ${selectedId === l.device.id ? 'text-white' : 'text-slate-900'}`}>{l.ref ? l.ref.padStart(2, '0') : '—'}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{l.text}</span>
                      <span className={`shrink-0 text-xs ${selectedId === l.device.id ? 'text-blue-100' : 'text-slate-500'}`}>{l.rating}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
        {!found.length && <p className="p-4 text-center text-sm text-slate-500">{lines.length ? 'Aucun circuit ne correspond.' : 'Aucun appareil posé.'}</p>}
      </div>
    </div>
  );
}
