import { useEffect, useState } from 'react';
import { Library, SlidersHorizontal } from 'lucide-react';
import { Sheet } from '../../../components/ui/Sheet';
import { useIsDesktop } from '../../../hooks/useMediaQuery';
import { usePanelEditor } from '../store/panelEditorStore';
import { BoardCanvas } from './BoardCanvas';
import { DeviceLibrary } from './DeviceLibrary';
import { PropertiesPanel } from './PropertiesPanel';
import { useDragStore } from './dragStore';

/**
 * Onglet 2 — Édition du tableau.
 * Ordinateur : bibliothèque | tableau | propriétés.
 * Téléphone / tablette : tableau plein écran + panneaux coulissants.
 */
export function BoardEditorTab() {
  const isDesktop = useIsDesktop();
  const selection = usePanelEditor((s) => s.selection);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);

  // Glisser depuis la bibliothèque (mobile) : la feuille est masquée pendant le glisser
  // (sans être démontée, pour ne pas interrompre le geste), puis fermée au dépôt
  const libraryDragging = useDragStore((s) => s.drag?.source === 'library');
  useEffect(
    () =>
      useDragStore.subscribe((s, prev) => {
        if (!s.drag && prev.drag?.source === 'library') setLibraryOpen(false);
      }),
    [],
  );
  // La sélection disparaît (suppression, annulation) : on ferme la feuille
  useEffect(() => {
    if (!selection) setPropsOpen(false);
  }, [selection]);

  if (isDesktop) {
    return (
      <div className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)_340px]" data-testid="board-editor">
        <aside className="min-h-0 border-r border-slate-200 bg-white">
          <DeviceLibrary />
        </aside>
        <div className="min-h-0">
          <BoardCanvas />
        </div>
        <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-slate-50">
          <PropertiesPanel />
        </aside>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col" data-testid="board-editor">
      <div className="min-h-0 flex-1">
        <BoardCanvas onDeviceTap={() => setPropsOpen(true)} onZoneTap={() => setPropsOpen(true)} onEmptyTap={() => setPropsOpen(false)} />
      </div>
      <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white p-2 pb-safe">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white shadow hover:bg-blue-700"
          data-testid="open-library"
        >
          <Library className="size-5" aria-hidden /> Ajouter un appareil
        </button>
        <button
          type="button"
          onClick={() => setPropsOpen(true)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-800"
          data-testid="open-properties"
        >
          <SlidersHorizontal className="size-5" aria-hidden /> {selection ? 'Propriétés' : 'Tableau'}
        </button>
      </div>

      <div style={{ visibility: libraryDragging ? 'hidden' : undefined }}>
        <Sheet open={libraryOpen} onClose={() => setLibraryOpen(false)} title="Bibliothèque d’appareils" mobileHeight="half" modeless desktop="side">
          <div className="h-[52dvh] md:h-full">
            <DeviceLibrary onChosen={() => setLibraryOpen(false)} />
          </div>
        </Sheet>
      </div>
      <Sheet
        open={propsOpen}
        onClose={() => setPropsOpen(false)}
        title={selection?.kind === 'zone' ? 'Étiquette' : selection?.kind === 'device' ? 'Appareil' : 'Tableau'}
        mobileHeight={selection?.kind === 'zone' ? 'auto' : 'half'}
        modeless
      >
        <PropertiesPanel onRequestClose={() => setPropsOpen(false)} onMove={() => setPropsOpen(false)} />
      </Sheet>
    </div>
  );
}
