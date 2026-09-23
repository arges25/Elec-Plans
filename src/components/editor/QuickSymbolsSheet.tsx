import { QUICK_GROUPS, getSymbolDefinition, type LibraryFilterId } from '../../data/electricalSymbols';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { SymbolIcon } from '../symbols/SymbolIcon';
import type { QuickGroup } from './MobileEditorBar';

const TITLES: Record<QuickGroup, string> = { prises: 'Prises', commandes: 'Commandes', lumieres: 'Lumières' };
const FILTERS: Record<QuickGroup, LibraryFilterId> = { prises: 'prises', commandes: 'commandes', lumieres: 'eclairage' };

/** Accès rapide : 1 toucher = choisir, puis toucher le plan pour placer. */
export function QuickSymbolsSheet({
  group,
  onClose,
  onPick,
  onMore,
}: {
  group: QuickGroup | null;
  onClose: () => void;
  onPick: (id: string) => void;
  onMore: (f: LibraryFilterId) => void;
}) {
  return (
    <Sheet open={Boolean(group)} onClose={onClose} title={group ? TITLES[group] : ''} mobileHeight="half">
      {group && (
        <div className="p-3">
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
