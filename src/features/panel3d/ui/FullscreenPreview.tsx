import { useEffect, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { getEnclosure } from '../data/catalog';
import { BoardSvg } from '../render/BoardSvg';
import { SchemaSvg } from '../render/SchemaSvg';
import { usePanelEditor } from '../store/panelEditorStore';
import { useUiStore } from './uiStore';

/** « Aperçu plein écran » : le tableau seul, comme une feuille de schéma. */
export function FullscreenPreview() {
  const open = useUiStore((s) => s.fullscreen);
  const doc = usePanelEditor((s) => s.doc);
  const [zoom, setZoom] = useState(1);
  const close = () => useUiStore.getState().setFullscreen(false);
  useEffect(() => {
    if (!open) return;
    setZoom(1);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open || !doc) return null;
  const enc = getEnclosure(doc.enclosureId);
  if (!enc) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white" role="dialog" aria-modal aria-label="Aperçu plein écran" data-testid="fullscreen-preview">
      <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-md pt-safe">
        <button type="button" aria-label="Zoom arrière" onClick={() => setZoom((z) => Math.max(0.5, z / 1.25))} className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-slate-100">
          <Minus className="size-5" aria-hidden />
        </button>
        <button type="button" aria-label="Zoom avant" onClick={() => setZoom((z) => Math.min(4, z * 1.25))} className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-slate-100">
          <Plus className="size-5" aria-hidden />
        </button>
        <button type="button" aria-label="Fermer l’aperçu" onClick={close} className="inline-flex size-10 items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-700">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div style={{ width: `${zoom * 100}%`, minWidth: 320 }} className="mx-auto max-w-none">
          {doc.view === 'schema' ? (
            <SchemaSvg doc={doc} enclosure={enc} uid="fs" width="100%" className="h-auto w-full" />
          ) : (
            <BoardSvg doc={doc} enclosure={enc} uid="fs" width="100%" className="h-auto w-full" />
          )}
        </div>
      </div>
    </div>
  );
}
