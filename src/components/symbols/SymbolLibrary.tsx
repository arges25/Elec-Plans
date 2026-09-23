import type { ReactNode } from 'react';
import { memo, useMemo, useState } from 'react';
import { Search, Star, X } from 'lucide-react';
import type { ElectricalSymbolDefinition } from '../../types';
import { ELECTRICAL_SYMBOLS, LIBRARY_FILTERS, categoryLabel, getSymbolDefinition, searchSymbols, type LibraryFilterId } from '../../data/electricalSymbols';
import { useSettingsStore } from '../../store/settingsStore';
import { SymbolIcon } from './SymbolIcon';

export interface SymbolLibraryProps {
  /** Action au toucher d'un symbole. */
  onPick: (def: ElectricalSymbolDefinition) => void;
  /** Action secondaire (ex. « Ajouter au centre »). */
  onSecondary?: (def: ElectricalSymbolDefinition) => void;
  secondaryLabel?: string;
  initialFilter?: LibraryFilterId;
  compact?: boolean;
  autoFocus?: boolean;
  selectedId?: string | null;
}

/** Bibliothèque électrique : recherche, filtres, favoris, récents. */
export function SymbolLibrary({ onPick, onSecondary, secondaryLabel, initialFilter = 'all', compact, autoFocus, selectedId }: SymbolLibraryProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilterId>(initialFilter);
  const favorites = useSettingsStore((s) => s.settings.favorites);
  const recent = useSettingsStore((s) => s.settings.recentSymbols);
  const toggleFavorite = useSettingsStore((s) => s.toggleFavorite);

  const list = useMemo(() => {
    let base = ELECTRICAL_SYMBOLS;
    const f = LIBRARY_FILTERS.find((x) => x.id === filter);
    if (filter === 'favorites') base = favorites.map(getSymbolDefinition).filter((d) => d.id !== 'inconnu');
    else if (f?.categories) base = base.filter((s) => f.categories!.includes(s.category));
    return searchSymbols(query, base);
  }, [query, filter, favorites]);

  const showFavSection = filter === 'all' && !query && favorites.length > 0;
  const showRecent = filter === 'all' && !query && recent.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 space-y-2 bg-white px-3 pb-2 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={query}
            autoFocus={autoFocus}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (ex. RJ45, va-et-vient, VMC)"
            aria-label="Rechercher un symbole"
            className="min-h-11 w-full rounded-xl border border-gray-300 bg-gray-50 pl-10 pr-10 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          {query && (
            <button type="button" aria-label="Effacer la recherche" onClick={() => setQuery('')} className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500">
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3" role="tablist" aria-label="Catégories">
          {LIBRARY_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold transition-colors ${
                filter === f.id ? 'bg-ink-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.id === 'favorites' && <Star className="-mt-0.5 mr-1 inline size-3.5" aria-hidden />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {showFavSection && (
          <Section title="Mes favoris">
            <Grid compact={compact}>
              {favorites.map((id) => {
                const def = getSymbolDefinition(id);
                if (def.id === 'inconnu') return null;
                return <SymbolCard key={`fav-${id}`} def={def} fav onPick={onPick} onFav={toggleFavorite} onSecondary={onSecondary} secondaryLabel={secondaryLabel} selected={selectedId === id} compact={compact} />;
              })}
            </Grid>
          </Section>
        )}
        {showRecent && (
          <Section title="Utilisés récemment">
            <Grid compact={compact}>
              {recent.slice(0, compact ? 6 : 8).map((id) => {
                const def = getSymbolDefinition(id);
                if (def.id === 'inconnu') return null;
                return <SymbolCard key={`rec-${id}`} def={def} fav={favorites.includes(id)} onPick={onPick} onFav={toggleFavorite} onSecondary={onSecondary} secondaryLabel={secondaryLabel} selected={selectedId === id} compact={compact} />;
              })}
            </Grid>
          </Section>
        )}
        <Section title={query ? `${list.length} résultat(s)` : filter === 'all' ? `Tous les symboles (${list.length})` : `${LIBRARY_FILTERS.find((f) => f.id === filter)?.label} (${list.length})`}>
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">{filter === 'favorites' ? 'Aucun favori : touchez ★ sur un symbole.' : 'Aucun symbole trouvé.'}</p>
          ) : (
            <Grid compact={compact}>
              {list.map((def) => (
                <SymbolCard key={def.id} def={def} fav={favorites.includes(def.id)} onPick={onPick} onFav={toggleFavorite} onSecondary={onSecondary} secondaryLabel={secondaryLabel} selected={selectedId === def.id} compact={compact} />
              ))}
            </Grid>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

function Grid({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5'}`}>{children}</div>;
}

const SymbolCard = memo(function SymbolCard({
  def,
  fav,
  onPick,
  onFav,
  onSecondary,
  secondaryLabel,
  selected,
  compact,
}: {
  def: ElectricalSymbolDefinition;
  fav: boolean;
  onPick: (d: ElectricalSymbolDefinition) => void;
  onFav: (id: string) => void;
  onSecondary?: (d: ElectricalSymbolDefinition) => void;
  secondaryLabel?: string;
  selected?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`relative flex flex-col rounded-xl border bg-white transition ${selected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-gray-200 hover:border-brand-300'}`}>
      <button type="button" onClick={() => onPick(def)} className="flex min-h-24 flex-col items-center gap-1 px-1 pb-2 pt-3 text-center" aria-label={`${def.name} — ${categoryLabel(def.category)}`}>
        <SymbolIcon id={def.id} size={compact ? 38 : 44} />
        <span className="line-clamp-2 text-[12px] font-semibold leading-tight text-gray-800">{def.name}</span>
      </button>
      <button
        type="button"
        onClick={() => onFav(def.id)}
        aria-label={fav ? `Retirer ${def.name} des favoris` : `Ajouter ${def.name} aux favoris`}
        aria-pressed={fav}
        className="absolute right-0 top-0 inline-flex size-9 items-center justify-center rounded-xl"
      >
        <Star className={`size-4 ${fav ? 'fill-volt-400 text-volt-500' : 'text-gray-300'}`} aria-hidden />
      </button>
      {onSecondary && (
        <button type="button" onClick={() => onSecondary(def)} className="min-h-9 border-t border-gray-100 text-xs font-semibold text-brand-600 hover:bg-brand-50">
          {secondaryLabel ?? 'Ajouter'}
        </button>
      )}
    </div>
  );
});
