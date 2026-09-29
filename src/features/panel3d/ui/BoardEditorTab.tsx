import { useEffect, useState } from 'react';
import { ListOrdered, Plus, SlidersHorizontal } from 'lucide-react';
import { Sheet } from '../../../components/ui/Sheet';
import { useIsTablet } from '../../../hooks/useMediaQuery';
import { usePanelEditor } from '../store/panelEditorStore';
import { BoardCanvas } from './BoardCanvas';
import { BoardToolbar } from './BoardToolbar';
import { CircuitsPanel } from './CircuitsPanel';
import { DeviceLibrary } from './DeviceLibrary';
import { PropertiesPanel } from './PropertiesPanel';
import { useDragStore } from './dragStore';

/**
 * Onglet 2 — Édition du tableau.
 * Tablette / ordinateur : bibliothèque (ou circuits) | tableau | propriétés.
 * Téléphone : tableau pleine largeur + boutons « Appareil », « Circuits », « Modifier ».
 */
export function BoardEditorTab() {
  const isTablet = useIsTablet();
  const selection = usePanelEditor((s) => s.selection);
  const [leftTab, setLeftTab] = useState<'library' | 'circuits'>('library');
  const [sheet, setSheet] = useState<null | 'library' | 'circuits' | 'props'>(null);

  // Glisser depuis la bibliothèque (mobile) : la feuille est masquée pendant le glisser
  // (sans être démontée, pour ne pas interrompre le geste), puis fermée au dépôt
  const libraryDragging = useDragStore((s) => s.drag?.source === 'library');
  useEffect(
    () =>
      useDragStore.subscribe((s, prev) => {
        if (!s.drag && prev.drag?.source === 'library') setSheet((v) => (v === 'library' ? null : v));
      }),
    [],
  );
  useEffect(() => {
    if (!selection) setSheet((v) => (v === 'props' ? null : v));
  }, [selection]);

  if (isTablet) {
    return (
      <div className="grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)_280px] lg:grid-cols-[290px_minmax(0,1fr)_340px]" data-testid="board-editor">
        <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
          <div role="tablist" className="grid shrink-0 grid-cols-2 gap-1 border-b border-slate-200 p-2">
            {(['library', 'circuits'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={leftTab === t}
                onClick={() => setLeftTab(t)}
                data-testid={`left-${t}`}
                className={`min-h-9 rounded-lg text-sm font-semibold ${leftTab === t ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t === 'library' ? 'Appareils' : 'Circuits'}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">{leftTab === 'library' ? <DeviceLibrary /> : <CircuitsPanel />}</div>
        </aside>
        <div className="flex min-h-0 flex-col">
          <BoardToolbar />
          <div className="min-h-0 flex-1">
            <BoardCanvas />
          </div>
        </div>
        <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-slate-50">
          <PropertiesPanel />
        </aside>
      </div>
    );
  }

  const btn = 'inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold';
  return (
    <div className="relative flex h-full min-h-0 flex-col" data-testid="board-editor">
      <BoardToolbar />
      <div className="min-h-0 flex-1">
        <BoardCanvas onDeviceTap={() => setSheet('props')} onSlotTap={() => setSheet('props')} onEmptyTap={() => setSheet(null)} />
      </div>
      <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-2 pb-safe">
        <button type="button" onClick={() => setSheet('library')} className={`${btn} bg-blue-600 text-white shadow hover:bg-blue-700`} data-testid="open-library">
          <Plus className="size-5" aria-hidden /> Appareil
        </button>
        <button type="button" onClick={() => setSheet('circuits')} className={`${btn} border border-slate-300 bg-white text-slate-800`} data-testid="open-circuits">
          <ListOrdered className="size-5" aria-hidden /> Circuits
        </button>
        <button type="button" onClick={() => setSheet('props')} className={`${btn} border border-slate-300 bg-white text-slate-800`} data-testid="open-properties">
          <SlidersHorizontal className="size-5" aria-hidden /> {selection ? 'Modifier' : 'Tableau'}
        </button>
      </div>

      <div style={{ visibility: libraryDragging ? 'hidden' : undefined }}>
        <Sheet open={sheet === 'library'} onClose={() => setSheet(null)} title="Appareils" mobileHeight="half" modeless>
          <div className="h-[52dvh]">
            <DeviceLibrary onChosen={() => setSheet(null)} />
          </div>
        </Sheet>
      </div>
      <Sheet open={sheet === 'circuits'} onClose={() => setSheet(null)} title="Circuits" mobileHeight="half" modeless>
        <div className="h-[52dvh]">
          <CircuitsPanel onPicked={() => setSheet(null)} />
        </div>
      </Sheet>
      <Sheet
        open={sheet === 'props'}
        onClose={() => setSheet(null)}
        title={selection?.kind === 'slot' ? 'Emplacement libre' : selection ? 'Appareil' : 'Tableau'}
        mobileHeight="half"
        modeless
      >
        <PropertiesPanel onMove={() => setSheet(null)} />
      </Sheet>
    </div>
  );
}
