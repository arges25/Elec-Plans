import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useSaveStatus } from '../../store/saveStatusStore';

/** « Enregistré ✓ » / « Sauvegarde… » toujours visible. */
export function SaveIndicator({ dark = true }: { dark?: boolean }) {
  const status = useSaveStatus((s) => s.status);
  const base = `inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${dark ? '' : ''}`;
  if (status === 'saving' || status === 'pending')
    return (
      <span className={`${base} ${dark ? 'text-gray-300' : 'text-gray-600'}`} role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Sauvegarde…
      </span>
    );
  if (status === 'error')
    return (
      <span className={`${base} bg-red-500/20 text-red-300`} role="status">
        <AlertCircle className="size-3.5" aria-hidden /> Erreur de sauvegarde
      </span>
    );
  if (status === 'saved')
    return (
      <span className={`${base} ${dark ? 'text-green-400' : 'text-green-700'}`} role="status">
        Enregistré <Check className="size-3.5" aria-hidden />
      </span>
    );
  return null;
}
