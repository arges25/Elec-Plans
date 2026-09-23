import { useState } from 'react';
import { Star } from 'lucide-react';
import type { ElectricalSymbolDefinition } from '../types';
import { ELECTRICAL_SYMBOLS, categoryLabel } from '../data/electricalSymbols';
import { AppHeader } from '../components/layout/AppHeader';
import { SymbolLibrary } from '../components/symbols/SymbolLibrary';
import { SymbolIcon } from '../components/symbols/SymbolIcon';
import { Sheet } from '../components/ui/Sheet';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Card';
import { useSettingsStore } from '../store/settingsStore';

/** Bibliothèque électrique (consultation, favoris). */
export default function SymbolLibraryPage() {
  const [detail, setDetail] = useState<ElectricalSymbolDefinition | null>(null);
  const favorites = useSettingsStore((s) => s.settings.favorites);
  const toggleFavorite = useSettingsStore((s) => s.toggleFavorite);
  const fav = detail ? favorites.includes(detail.id) : false;
  return (
    <div className="flex h-dvh flex-col">
      <AppHeader title="Bibliothèque électrique" subtitle={`${ELECTRICAL_SYMBOLS.length} symboles génériques`} back="/" />
      <div className="mx-auto min-h-0 w-full max-w-6xl flex-1 bg-white">
        <SymbolLibrary onPick={setDetail} autoFocus={false} />
      </div>
      <Sheet open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name ?? ''} desktop="center">
        {detail && (
          <div className="flex flex-col items-center gap-3 p-5 text-center">
            <div className="flex size-40 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50">
              <SymbolIcon id={detail.id} size={120} />
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              <Badge tone="orange">{categoryLabel(detail.category)}</Badge>
              <Badge>{detail.subCategory}</Badge>
              {detail.snapToWall && <Badge tone="blue">Aimanté aux murs</Badge>}
            </div>
            <p className="text-gray-700">{detail.description}</p>
            {detail.keywords.length > 0 && <p className="text-xs text-gray-500">Mots-clés : {detail.keywords.join(', ')}</p>}
            <p className="text-xs text-gray-400">
              Identifiant : {detail.id} · taille par défaut {detail.defaultSize}
            </p>
            <Button
              variant={fav ? 'secondary' : 'primary'}
              icon={<Star className={`size-5 ${fav ? 'fill-volt-400 text-volt-500' : ''}`} aria-hidden />}
              onClick={() => toggleFavorite(detail.id)}
            >
              {fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
