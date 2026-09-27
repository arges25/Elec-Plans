import { QUICK_GROUPS, getSymbolDefinition, type LibraryFilterId } from '../../data/electricalSymbols';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { SymbolIcon } from '../symbols/SymbolIcon';
import type { QuickGroup } from './MobileEditorBar';
import { LedStripIcon } from '../symbols/LedStripIcon';

const TITLES: Record<QuickGroup, string> = { prises: 'Prises', commandes: 'Commandes', lumieres: 'Lumières' };
const FILTERS: Record<QuickGroup, LibraryFilterId> = { prises: 'prises', commandes: 'commandes', lumieres: 'eclairage' };

/** Accès rapide : 1 toucher = choisir, puis toucher le plan pour placer. */
export function QuickSymbolsSheet({
  group,
  onClose,
  onPick,
  onMore,
  onLedStrip,
}: {
  group: QuickGroup | null;
  onClose: () => void;
  onPick: (id: string) => void;
  onMore: (f: LibraryFilterId) => void;
  /** Outil « Bande LED » à tracer (groupe Lumières). */
  onLedStrip?: () => void;
}) {
  return (
    <Sheet open={Boolean(group)} onClose={onClose} title={group ? TITLES[group] : ''} mobileHeight="half">
      {group && (
        <div className="p-3">
          {group === 'lumieres' && onLedStrip && (
            <button
              type="button"
              onClick={onLedStrip}
              className="mb-2 flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-yellow-400 bg-yellow-50 px-3 text-left hover:bg-yellow-100 active:bg-yellow-100"
            >
              <LedStripIcon size={40} className="shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900">Bande LED à tracer</span>
                <span className="block text-xs text-gray-600">Tracez au doigt le long des murs, avec les angles</span>
              </span>
            </button>
          )}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {QUICK_GROUPS[group].map((id) => {
              const def = getSymbolDefinition(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPick(id)}
                  className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white p-2 text-center hover:border-brand-400 active:bg-brand-50"
                >
                  <SymbolIcon id={id} size={42} />
                  <span className="text-[12px] font-semibold leading-tight">{def.name}</span>
                </button>
              );
            })}
          </div>
          <Button variant="ghost" block className="mt-2" onClick={() => onMore(FILTERS[group])}>
            Voir toute la catégorie
          </Button>
        </div>
      )}
    </Sheet>
  );
}
