import { CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';

const ICONS = {
  success: <CheckCircle2 className="size-5 text-green-400" aria-hidden />,
  error: <XCircle className="size-5 text-red-400" aria-hidden />,
  info: <Info className="size-5 text-volt-400" aria-hidden />,
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 px-3 pt-safe" aria-live="polite" role="status">
      <div className="h-2" />
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink-900/95 px-4 py-3 text-sm text-white shadow-xl animate-pop-in"
        >
          {ICONS[t.kind]}
          <p className="min-w-0 flex-1 font-medium">{t.message}</p>
          {t.action && (
            <button
              type="button"
              className="min-h-9 rounded-lg bg-brand-500 px-3 font-semibold text-white hover:bg-brand-600"
              onClick={() => {
                t.action?.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Fermer la notification"
            onClick={() => dismiss(t.id)}
            className="-mr-2 inline-flex size-9 items-center justify-center rounded-lg text-gray-300 hover:bg-white/10"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
