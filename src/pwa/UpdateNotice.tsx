import { Loader2, RefreshCw, X } from 'lucide-react';
import { installUpdate, useUpdateStore } from './updateStore';

/**
 * Bandeau « Nouvelle version disponible » : reste affiché tant que l'utilisateur
 * n'a pas choisi (les notifications ordinaires ne peuvent pas le remplacer).
 */
export function UpdateNotice() {
  const show = useUpdateStore((s) => s.needRefresh && !s.dismissed);
  const applying = useUpdateStore((s) => s.applying);
  if (!show) return null;
  return (
    <div
      className="pointer-events-auto w-full max-w-md rounded-2xl bg-brand-500 px-4 py-3 text-sm text-white shadow-xl animate-pop-in"
      data-testid="update-notice"
      role="alert"
    >
      <div className="flex items-center gap-3">
        <RefreshCw className="size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Nouvelle version disponible</p>
          <p className="text-xs text-white/90">Vos projets sont conservés.</p>
        </div>
        {!applying && (
          <button
            type="button"
            aria-label="Plus tard"
            title="Plus tard"
            onClick={() => useUpdateStore.setState({ dismissed: true })}
            className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-white/90 hover:bg-white/15"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <button
        type="button"
        disabled={applying}
        onClick={() => void installUpdate()}
        className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3 font-bold text-brand-600 hover:bg-brand-50 disabled:opacity-80"
        data-testid="update-apply"
      >
        {applying && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {applying ? 'Mise à jour…' : 'Mettre à jour'}
      </button>
    </div>
  );
}
