import { Cable, FileDown, Grid3x3, Map, Shapes } from 'lucide-react';
import { useNavigate } from 'react-router';

export type ProjectSection = 'plan' | 'symbols' | 'connect' | 'panel' | 'export';

const ITEMS: { id: ProjectSection; label: string; icon: typeof Map }[] = [
  { id: 'plan', label: 'PLAN', icon: Map },
  { id: 'symbols', label: 'SYMBOLES', icon: Shapes },
  { id: 'connect', label: 'RELIER', icon: Cable },
  { id: 'panel', label: 'TABLEAU', icon: Grid3x3 },
  { id: 'export', label: 'EXPORT', icon: FileDown },
];

export function projectSectionPath(projectId: string, planId: string | undefined, section: ProjectSection): string {
  const plan = planId ? `/project/${projectId}/plan/${planId}` : `/project/${projectId}`;
  switch (section) {
    case 'plan':
      return plan;
    case 'symbols':
      return planId ? `${plan}?panel=library` : plan;
    case 'connect':
      return planId ? `${plan}?tool=connect` : plan;
    case 'panel':
      return `/project/${projectId}/panel`;
    case 'export':
      return `/project/${projectId}/export`;
  }
}

/**
 * Navigation principale d'un projet : PLAN · SYMBOLES · RELIER · TABLEAU · EXPORT.
 * `bottom` : barre inférieure mobile ; `tabs` : onglets d'en-tête (ordinateur).
 */
export function ProjectNav({
  projectId,
  planId,
  active,
  variant,
  onSection,
}: {
  projectId: string;
  planId?: string;
  active: ProjectSection;
  variant: 'bottom' | 'tabs';
  onSection?: (s: ProjectSection) => boolean | void;
}) {
  const navigate = useNavigate();
  const go = (s: ProjectSection) => {
    if (onSection?.(s)) return;
    navigate(projectSectionPath(projectId, planId, s));
  };
  if (variant === 'tabs') {
    return (
      <nav aria-label="Navigation du projet" className="flex gap-1">
        {ITEMS.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => go(it.id)}
            aria-current={active === it.id ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-bold tracking-wide transition-colors ${
              active === it.id ? 'bg-brand-500 text-white' : 'text-gray-200 hover:bg-white/10'
            }`}
          >
            <it.icon className="size-4" aria-hidden />
            {it.label}
          </button>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Navigation du projet" className="fixed inset-x-0 bottom-0 z-30 flex bg-ink-900 pb-safe">
      {ITEMS.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => go(it.id)}
          aria-current={active === it.id ? 'page' : undefined}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold tracking-wide ${active === it.id ? 'text-brand-400' : 'text-gray-300'}`}
        >
          <it.icon className="size-5" aria-hidden />
          {it.label}
        </button>
      ))}
    </nav>
  );
}
