import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ImageDown, X } from 'lucide-react';
import type { Project } from '../../types';
import { useEditorStore } from '../../store/editorStore';
import { useViewStore } from '../../store/viewStore';
import { buildLegend } from '../../utils/legend';
import { formatDate, safeFileName } from '../../utils/format';
import { shareOrDownload } from '../../utils/download';
import { SymbolIcon } from '../symbols/SymbolIcon';
import { LogoMark } from '../layout/Logo';

/**
 * APERÇU CLIENT : plan, symboles, liaisons, légende et titre uniquement
 * (grille, sélections, poignées et menus masqués).
 */
export function ClientPreviewOverlay({ project }: { project: Project | undefined }) {
  const plan = useEditorStore((s) => s.plan);
  const symbols = useEditorStore((s) => s.doc.symbols);
  const setClientPreview = useEditorStore((s) => s.setClientPreview);
  const legend = useMemo(() => buildLegend(symbols), [symbols]);
  const [legendOpen, setLegendOpen] = useState(true);

  const shareImage = async () => {
    const url = useViewStore.getState().api?.toDataUrl(2);
    if (!url) return;
    const blob = await (await fetch(url)).blob();
    await shareOrDownload(blob, `${safeFileName(project?.name ?? 'plan')}-${safeFileName(plan?.name ?? '')}.png`, project?.name ?? 'Plan');
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 pt-safe">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-lg">
          <LogoMark size={40} className="rounded-lg" />
          <div className="min-w-0">
            <p className="truncate font-extrabold text-gray-900">{project?.name}</p>
            <p className="truncate text-xs text-gray-600">
              {[project?.clientName, plan?.name, project?.date ? formatDate(project.date) : ''].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button type="button" onClick={() => void shareImage()} aria-label="Partager une image du plan" className="inline-flex size-12 items-center justify-center rounded-2xl bg-white/95 text-gray-800 shadow-lg">
            <ImageDown className="size-6" aria-hidden />
          </button>
          <button type="button" onClick={() => setClientPreview(false)} className="inline-flex min-h-12 items-center gap-1 rounded-2xl bg-ink-900 px-4 font-bold text-white shadow-lg">
            <X className="size-5" aria-hidden /> Quitter l’aperçu
          </button>
        </div>
      </div>
      {legend.length > 0 && (
        <div className="absolute bottom-3 left-3 z-10 max-h-[45%] w-64 max-w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl bg-white/95 shadow-lg mb-safe">
          <button type="button" onClick={() => setLegendOpen((v) => !v)} className="flex min-h-11 w-full items-center justify-between px-3 font-bold text-gray-900" aria-expanded={legendOpen}>
            Légende {legendOpen ? <ChevronDown className="size-5" aria-hidden /> : <ChevronUp className="size-5" aria-hidden />}
          </button>
          {legendOpen && (
            <ul className="max-h-64 overflow-y-auto px-3 pb-3">
              {legend.map((e) => (
                <li key={e.def.id} className="flex items-center gap-2 py-0.5 text-sm">
                  <SymbolIcon id={e.def.id} size={24} />
                  <span className="flex-1 text-gray-800">{e.def.name}</span>
                  <span className="text-xs font-bold text-gray-500">× {e.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
