import type { ReactNode } from 'react';
import { Layers, ListTree } from 'lucide-react';
import { useEditorStore, type EditorTool } from '../../store/editorStore';
import { TOOL_DEFS } from './toolDefs';

export interface EditorToolbarProps {
  orientation: 'vertical' | 'horizontal';
  tools?: EditorTool[];
  onLayers?: () => void;
  onLegend?: () => void;
}

/** Barre d'outils de l'éditeur (verticale sur ordinateur, bandeau défilant sur mobile). */
export function EditorToolbar({ orientation, tools, onLayers, onLegend }: EditorToolbarProps) {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const defs = tools ? TOOL_DEFS.filter((t) => tools.includes(t.id)) : TOOL_DEFS;
  const vertical = orientation === 'vertical';
  let lastGroup = '';

  const btn = (key: string, label: string, icon: ReactNode, active: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition-colors ${
        vertical ? 'min-h-14 w-16' : 'min-h-12 min-w-14 px-1'
      } ${active ? 'bg-brand-500 text-white shadow' : 'text-gray-700 hover:bg-gray-100'}`}
    >
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  );

  return (
    <nav
      aria-label="Outils"
      className={
        vertical
          ? 'flex w-20 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-gray-200 bg-white py-2'
          : 'no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-gray-200 bg-white px-2 py-1'
      }
    >
      {defs.map((d) => {
        const sep = lastGroup && lastGroup !== d.group;
        lastGroup = d.group;
        return [
          sep ? <div key={`sep-${d.id}`} className={vertical ? 'my-1 h-px w-10 bg-gray-200' : 'mx-1 h-8 w-px shrink-0 bg-gray-200'} aria-hidden /> : null,
          btn(d.id, d.label, d.icon, tool === d.id, () => setTool(d.id)),
        ];
      })}
      {(onLayers || onLegend) && <div className={vertical ? 'my-1 h-px w-10 bg-gray-200' : 'mx-1 h-8 w-px shrink-0 bg-gray-200'} aria-hidden />}
      {onLayers && btn('layers', 'Calques', <Layers className="size-5" aria-hidden />, false, onLayers)}
      {onLegend && btn('legend', 'Légende', <ListTree className="size-5" aria-hidden />, false, onLegend)}
    </nav>
  );
}
