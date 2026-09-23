import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useIsTablet } from '../../hooks/useMediaQuery';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Sur tablette/ordinateur : panneau latéral droit (par défaut) ou fenêtre centrée. */
  desktop?: 'side' | 'center';
  /** Hauteur max sur mobile (bottom sheet). */
  mobileHeight?: 'auto' | 'half' | 'full';
  /** Pas de voile sombre (le plan reste visible). */
  modeless?: boolean;
  headerExtra?: ReactNode;
  widthClass?: string;
}

/**
 * Panneau responsive : bottom sheet sur téléphone, panneau latéral ou fenêtre sur tablette / ordinateur.
 */
export function Sheet({ open, onClose, title, children, footer, desktop = 'side', mobileHeight = 'auto', modeless, headerExtra, widthClass }: SheetProps) {
  const isTablet = useIsTablet();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const mobileH = mobileHeight === 'full' ? 'h-[92dvh]' : mobileHeight === 'half' ? 'max-h-[60dvh]' : 'max-h-[85dvh]';
  const container = isTablet
    ? desktop === 'center'
      ? `relative m-auto w-full ${widthClass ?? 'max-w-lg'} max-h-[88dvh] rounded-2xl animate-pop-in`
      : `absolute right-0 top-0 h-full w-full ${widthClass ?? 'max-w-md'} animate-sheet-left border-l border-gray-200`
    : `absolute inset-x-0 bottom-0 ${mobileH} rounded-t-2xl animate-sheet-up pb-safe`;

  return (
    <div className={`fixed inset-0 z-50 flex ${modeless ? 'pointer-events-none' : ''}`} role="presentation">
      {!modeless && <div className="absolute inset-0 bg-ink-900/40 animate-fade-in" onClick={onClose} aria-hidden />}
      <section
        role="dialog"
        aria-modal={!modeless}
        aria-labelledby={titleId}
        className={`pointer-events-auto flex flex-col bg-white shadow-sheet ${container}`}
      >
        {!isTablet && <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-gray-300" aria-hidden />}
        <header className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-2">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-lg font-bold text-gray-900">
            {title}
          </h2>
          {headerExtra}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex size-11 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <footer className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">{footer}</footer>}
      </section>
    </div>
  );
}
