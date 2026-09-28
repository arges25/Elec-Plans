import { useMemo, useState } from 'react';
import { Tags } from 'lucide-react';
import { Sheet } from '../../../components/ui/Sheet';
import { useIsDesktop } from '../../../hooks/useMediaQuery';
import { getEnclosure } from '../data/catalog';
import { boardGeometry } from '../engine/geometry';
import { allLabelZones, zoneOf } from '../engine/placement';
import { BoardSvg } from '../render/BoardSvg';
import { usePanelEditor } from '../store/panelEditorStore';
import { LabelEditor } from './LabelEditor';

/**
 * Onglet 3 — Étiquettes : bandeaux agrandis rangée par rangée.
 * Toucher une zone pour la nommer ; Entrée passe à l'étiquette suivante.
 */
export function LabelsTab() {
  const project = usePanelEditor((s) => s.project)!;
  const selection = usePanelEditor((s) => s.selection);
  const select = usePanelEditor((s) => s.select);
  const isDesktop = useIsDesktop();
  const enc = getEnclosure(project.enclosureId)!;
  const geo = useMemo(() => boardGeometry(enc), [enc]);
  const zones = allLabelZones(project.devices, geo.rows, project.labelStyle);
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentId = selection?.kind === 'zone' ? selection.id : null;
  const idx = zones.findIndex((z) => z.leaderId === currentId);
  const openZone = (id: string) => {
    select({ kind: 'zone', id });
    setSheetOpen(true);
  };
  const next = () => {
    const n = zones[idx + 1];
    if (n) select({ kind: 'zone', id: n.leaderId });
    else {
      select(null);
      setSheetOpen(false);
    }
  };

  const onBoardClick = (e: React.MouseEvent) => {
    const el = e.target as Element;
    const zoneId = el.closest('[data-zone-id]')?.getAttribute('data-zone-id');
    if (zoneId) return openZone(zoneId);
    const devId = el.closest('[data-device-id]')?.getAttribute('data-device-id');
    if (devId) {
      const z = zoneOf(project.devices, devId, project.labelStyle);
      if (z) openZone(z.leaderId);
    }
  };

  const named = zones.filter((z) => z.label.trim() || z.icon).length;

  const editor = currentId ? <LabelEditor key={currentId} leaderId={currentId} autoFocus onNext={next} onDone={() => { select(null); setSheetOpen(false); }} /> : null;

  return (
    <div className={`h-full min-h-0 ${isDesktop ? 'grid grid-cols-[minmax(0,1fr)_380px]' : ''}`} data-testid="labels-tab">
      <div className="h-full min-h-0 overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto max-w-5xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              {named}/{zones.length} étiquette(s) renseignée(s) · touchez une étiquette pour la nommer
            </p>
            {zones.length > 0 && (
              <button
                type="button"
                onClick={() => openZone((zones.find((z) => !z.label.trim()) ?? zones[0]).leaderId)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Tags className="size-4" aria-hidden /> Nommer à la suite
              </button>
            )}
          </div>
          {geo.rowGeo.map((r) => {
            const pad = 3;
            const vb = `${geo.windowX - pad} ${r.labelY - pad} ${geo.windowWidth + pad * 2} ${r.openY + r.openH - r.labelY + pad * 2}`;
            return (
              <section key={r.index} className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                <h3 className="mb-1 px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Rangée {r.index + 1}</h3>
                <div onClick={onBoardClick} className="cursor-pointer">
                  <BoardSvg project={project} enclosure={enc} uid={`lr${r.index}`} selection={selection} viewBox={vb} width="100%" interactive />
                </div>
              </section>
            );
          })}
          {!project.devices.length && <p className="py-8 text-center text-sm text-slate-500">Ajoutez d’abord des appareils dans l’onglet « Édition du tableau ».</p>}
        </div>
      </div>
      {isDesktop ? (
        <aside className="min-h-0 overflow-y-auto border-l border-slate-200 bg-slate-50">
          {editor ?? <p className="p-6 text-sm text-slate-500">Sélectionnez une étiquette pour saisir le nom du circuit et choisir son icône.</p>}
        </aside>
      ) : (
        <Sheet open={sheetOpen && Boolean(editor)} onClose={() => setSheetOpen(false)} title={`Étiquette ${idx + 1}/${zones.length}`}>
          {editor}
        </Sheet>
      )}
    </div>
  );
}
