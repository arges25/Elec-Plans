import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from '../store/toastStore';
import { buildLabel, checkForUpdate, installUpdate, useUpdateStore } from './updateStore';

const MESSAGES = {
  'up-to-date': () => toast.success('Vous avez la dernière version ✓'),
  offline: () => toast.error('Hors connexion : impossible de rechercher une mise à jour'),
  unavailable: () => toast.info('Recherche de mise à jour indisponible dans ce navigateur'),
  downloading: () => toast.info('Nouvelle version en cours de téléchargement…', undefined, 4000),
  available: () => useUpdateStore.setState({ dismissed: false }),
};

/** Réglages : version installée + recherche manuelle de mise à jour. */
export function UpdateCard() {
  const needRefresh = useUpdateStore((s) => s.needRefresh);
  const checking = useUpdateStore((s) => s.checking);
  const applying = useUpdateStore((s) => s.applying);
  return (
    <div className="flex min-h-14 items-center gap-3 py-2" data-testid="update-card">
      <RefreshCw className="size-5 shrink-0 text-gray-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900">{needRefresh ? 'Nouvelle version disponible' : 'Mise à jour'}</p>
        <p className="text-xs text-gray-500" data-testid="build-label">
          {buildLabel()}
        </p>
      </div>
      {needRefresh ? (
        <button
          type="button"
          disabled={applying}
          onClick={() => void installUpdate()}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-80"
        >
          {applying && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Mettre à jour
        </button>
      ) : (
        <button
          type="button"
          disabled={checking}
          onClick={async () => MESSAGES[await checkForUpdate(true)]()}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-70"
          data-testid="update-check"
        >
          {checking && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {checking ? 'Recherche…' : 'Rechercher'}
        </button>
      )}
    </div>
  );
}
