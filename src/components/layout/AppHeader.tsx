import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

export interface AppHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string | true;
  actions?: ReactNode;
  children?: ReactNode;
}

/** En-tête anthracite des pages. */
export function AppHeader({ title, subtitle, back, actions, children }: AppHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 bg-ink-900 text-white shadow-md pt-safe">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-1 px-safe-2">
        {back && (
          <button
            type="button"
            aria-label="Retour"
            onClick={() => (back === true ? navigate(-1) : navigate(back))}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/10"
          >
            <ArrowLeft className="size-6" aria-hidden />
          </button>
        )}
        <div className={`min-w-0 flex-1 ${back ? '' : 'pl-2'}`}>
          <h1 className="truncate text-[17px] font-bold leading-tight">{title}</h1>
          {subtitle && <div className="truncate text-xs text-gray-300">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function PageBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto w-full max-w-6xl px-safe-4 pb-28 pt-4  ${className}`}>{children}</main>;
}
