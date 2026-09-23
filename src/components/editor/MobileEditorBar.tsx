import type { ReactNode } from 'react';
import { Cable, Lightbulb, Plug, Plus, ToggleRight, Grid3x3 } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';

export type QuickGroup = 'prises' | 'commandes' | 'lumieres';

/** Barre inférieure mobile de l'éditeur : PRISES · COMMANDES · LUMIÈRES · RELIER · TABLEAU + bouton « + ». */
export function MobileEditorBar({ onQuick, onLibrary, onPanel }: { onQuick: (g: QuickGroup) => void; onLibrary: () => void; onPanel: () => void }) {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const item = (label: string, icon: ReactNode, onClick: () => void, active = false) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold tracking-wide ${active ? 'text-brand-400' : 'text-gray-200'}`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="relative z-20 bg-ink-900 pb-safe">
      <button
        type="button"
        onClick={onLibrary}
        aria-label="Bibliothèque complète"
        className="absolute -top-16 right-3 inline-flex size-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-xl ring-4 ring-white/70 hover:bg-brand-600"
      >
        <Plus className="size-7" aria-hidden />
      </button>
      <nav aria-label="Barre de l’éditeur" className="flex">
        {item('PRISES', <Plug className="size-5" aria-hidden />, () => onQuick('prises'))}
        {item('COMMANDES', <ToggleRight className="size-5" aria-hidden />, () => onQuick('commandes'))}
        {item('LUMIÈRES', <Lightbulb className="size-5" aria-hidden />, () => onQuick('lumieres'))}
        {item('RELIER', <Cable className="size-5" aria-hidden />, () => setTool(tool === 'connect' ? 'select' : 'connect'), tool === 'connect')}
        {item('TABLEAU', <Grid3x3 className="size-5" aria-hidden />, onPanel)}
      </nav>
    </div>
  );
}
