import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ElectricalSymbolDefinition } from '../types';
import type { LibraryFilterId } from '../data/electricalSymbols';
import { db } from '../database/db';
import { getPlan, loadPlanDocument } from '../database/planRepository';
import { useEditorStore, type RightPanel } from '../store/editorStore';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { useAutosave } from '../hooks/useAutosave';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { toast } from '../store/toastStore';
import { PlanStage } from '../components/editor/PlanStage';
import { EditorHeader } from '../components/editor/EditorHeader';
import { EditorToolbar } from '../components/editor/EditorToolbar';
import { ZoomControls } from '../components/editor/ZoomControls';
import { ConnectModeBar, PlaceModeBar, SelectionMenu, ToolHintBar } from '../components/editor/ModeBars';
import { MobileEditorBar, type QuickGroup } from '../components/editor/MobileEditorBar';
import { QuickSymbolsSheet } from '../components/editor/QuickSymbolsSheet';
import { CorrectionBar } from '../components/editor/CorrectionBar';
import { ClientPreviewOverlay } from '../components/editor/ClientPreviewOverlay';
import { PropertiesPanel } from '../components/editor/PropertiesPanel';
import { ConnectionPanel } from '../components/editor/ConnectionPanel';
import { LayersPanel } from '../components/editor/LayersPanel';
import { LegendPanel } from '../components/editor/LegendPanel';
import { SymbolLibrary } from '../components/symbols/SymbolLibrary';
import { Sheet } from '../components/ui/Sheet';
import { addSymbolAtCenter, beginPlacing } from '../components/editor/editorActions';
import type { ProjectSection } from '../components/layout/ProjectNav';

/** Éditeur électrique (et correction du plan en mode `?mode=correction`). */
export default function PlanEditorPage() {
  const { planId } = useParams();
  return <EditorContent key={planId} />;
}

function EditorContent() {
  const { projectId, planId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const [ready, setReady] = useState(false);
  const [quick, setQuick] = useState<QuickGroup | null>(null);
  const [libFilter, setLibFilter] = useState<LibraryFilterId>('all');
  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId]);

  const correction = params.get('mode') === 'correction';
  const clientPreview = useEditorStore((s) => s.clientPreview);
  const tool = useEditorStore((s) => s.tool);
  const selection = useEditorStore((s) => s.selection);
  const sheet = useEditorStore((s) => s.sheet);
  const rightPanel = useEditorStore((s) => s.rightPanel);
  const placeSymbolId = useEditorStore((s) => s.placeSymbolId);
  const reconstructed = useEditorStore((s) => s.plan?.reconstructed);
  const st = useEditorStore.getState();

  // Chargement du plan
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    void (async () => {
      const plan = await getPlan(planId);
      if (cancelled) return;
      if (!plan) {
        toast.error('Plan introuvable');
        navigate('/', { replace: true });
        return;
      }
      const doc = await loadPlanDocument(plan);
      if (cancelled) return;
      useEditorStore.getState().load(plan, doc);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, navigate]);

  // Paramètres d'entrée : ?tool=wall|connect, ?panel=library, ?mode=correction
  useEffect(() => {
    if (!ready) return;
    const s = useEditorStore.getState();
    const t = params.get('tool');
    if (t === 'wall' || t === 'connect' || t === 'door' || t === 'window') s.setTool(t);
    if (params.get('panel') === 'library') {
      if (desktop) s.setRightPanel('library');
      else s.openSheet('library');
    }
    if (correction) {
      if (s.doc.walls.length === 0) s.setTool('wall');
      const hasImg = Boolean(s.plan?.processedImage ?? s.plan?.originalImage);
      if (hasImg && (s.plan?.backgroundOpacity ?? 1) > 0.8) s.setPlanMeta({ backgroundOpacity: 0.6 });
    }
    if (t || params.get('panel')) {
      const next = new URLSearchParams(params);
      next.delete('tool');
      next.delete('panel');
      setParams(next, { replace: true });
    }
  }, [ready]);

  useAutosave(ready);
  useKeyboardShortcuts(ready && !clientPreview);

  const onSection = (s: ProjectSection): boolean => {
    const store = useEditorStore.getState();
    if (s === 'plan') {
      store.setTool('select');
      return true;
    }
    if (s === 'symbols') {
      if (desktop) store.setRightPanel('library');
      else store.openSheet('library');
      return true;
    }
    if (s === 'connect') {
      store.setTool('connect');
      return true;
    }
    return false;
  };

  const openPanel = (p: RightPanel) => {
    if (desktop) st.setRightPanel(p);
    else st.openSheet(p);
  };

  const pick = (def: ElectricalSymbolDefinition) => {
    beginPlacing(def.id);
    setQuick(null);
    if (!desktop) toast.info(`${def.name} : touchez le plan pour placer`);
  };

  const finishCorrection = () => {
    const s = useEditorStore.getState();
    s.setTool('select');
    navigate(`/project/${projectId}/plan/${planId}`, { replace: true });
    toast.success('Plan corrigé ✓ — placez maintenant vos symboles');
  };

  if (!ready || !projectId || !planId) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-100 text-gray-500" role="status">
        <Loader2 className="mr-2 size-6 animate-spin text-brand-500" aria-hidden /> Ouverture du plan…
      </div>
    );
  }

  const singleSymbol = selection?.kind === 'symbol' && selection.ids.length === 1 ? selection.ids[0] : null;
  const singleConnection = selection?.kind === 'connection' && selection.ids.length === 1 ? selection.ids[0] : null;

  const propertiesContent = singleSymbol ? (
    <PropertiesPanel symbolId={singleSymbol} onClose={() => st.openSheet(null)} />
  ) : singleConnection ? (
    <ConnectionPanel connectionId={singleConnection} onClose={() => st.openSheet(null)} />
  ) : (
    <p className="p-4 text-sm text-gray-500">Sélectionnez un symbole ou une liaison pour afficher ses propriétés.</p>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gray-100">
      {!clientPreview && <EditorHeader project={project} planId={planId} desktop={desktop} correction={correction} onSection={onSection} onOpenPanel={openPanel} />}
      {!desktop && !clientPreview && !correction && <EditorToolbar orientation="horizontal" onLayers={() => openPanel('layers')} onLegend={() => openPanel('legend')} />}

      <div className="relative flex min-h-0 flex-1">
        {desktop && !clientPreview && !correction && <EditorToolbar orientation="vertical" onLayers={() => openPanel('layers')} onLegend={() => openPanel('legend')} />}

        <div className="relative min-w-0 flex-1">
          <PlanStage />
          {clientPreview && <ClientPreviewOverlay project={project} />}
          {correction && !clientPreview && (
            <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-3">
              <p className="flex items-center gap-2 rounded-xl bg-yellow-50/95 px-3 py-2 text-xs font-semibold text-yellow-900 shadow ring-1 ring-yellow-300">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                {reconstructed
                  ? 'Plan simplifié généré automatiquement. Vérifiez les murs et ouvertures avant utilisation.'
                  : 'Tracez les murs par-dessus le croquis. Plan simplifié destiné à l’implantation électrique.'}
              </p>
            </div>
          )}
          {!clientPreview && <ZoomControls className="absolute right-3 top-3 z-10" />}
          {!clientPreview && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-col items-stretch gap-2 px-3 pr-20">
              {tool === 'place' && placeSymbolId && <PlaceModeBar />}
              {tool === 'connect' && <ConnectModeBar />}
              <ToolHintBar />
              <div className="flex justify-center">
                <SelectionMenu onProperties={() => openPanel('properties')} />
              </div>
            </div>
          )}
        </div>

        {desktop && !clientPreview && (
          <aside className="flex w-[340px] shrink-0 flex-col border-l border-gray-200 bg-white">
            <div className="grid grid-cols-4 border-b border-gray-200 p-1" role="tablist" aria-label="Panneaux">
              {(
                [
                  ['library', 'Symboles'],
                  ['properties', 'Propriétés'],
                  ['layers', 'Calques'],
                  ['legend', 'Légende'],
                ] as [RightPanel, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={rightPanel === id}
                  onClick={() => st.setRightPanel(id)}
                  className={`min-h-10 rounded-lg text-xs font-bold ${rightPanel === id ? 'bg-ink-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {rightPanel === 'library' && (
                <SymbolLibrary compact onPick={pick} onSecondary={(d) => addSymbolAtCenter(d.id)} secondaryLabel="Ajouter au plan" selectedId={placeSymbolId} />
              )}
              {rightPanel === 'properties' && propertiesContent}
              {rightPanel === 'layers' && <LayersPanel />}
              {rightPanel === 'legend' && <LegendPanel />}
            </div>
          </aside>
        )}
      </div>

      {!clientPreview && correction && <CorrectionBar onFinish={finishCorrection} />}
      {!desktop && !clientPreview && !correction && (
        <MobileEditorBar onQuick={setQuick} onLibrary={() => st.openSheet('library')} onPanel={() => navigate(`/project/${projectId}/panel`)} />
      )}

      {/* Feuilles (mobile / tablette) */}
      {!desktop && (
        <>
          <Sheet open={sheet === 'library'} onClose={() => st.openSheet(null)} title="Bibliothèque électrique" mobileHeight="full">
            <SymbolLibrary key={libFilter} initialFilter={libFilter} onPick={pick} onSecondary={(d) => { addSymbolAtCenter(d.id); st.openSheet(null); }} secondaryLabel="Ajouter au centre" />
          </Sheet>
          <Sheet open={sheet === 'properties'} onClose={() => st.openSheet(null)} title="Propriétés" modeless>
            {propertiesContent}
          </Sheet>
          <Sheet open={sheet === 'connection'} onClose={() => st.openSheet(null)} title="Liaison" modeless>
            {propertiesContent}
          </Sheet>
          <Sheet open={sheet === 'layers'} onClose={() => st.openSheet(null)} title="Calques" modeless>
            <LayersPanel />
          </Sheet>
          <Sheet open={sheet === 'legend'} onClose={() => st.openSheet(null)} title="Légende automatique">
            <LegendPanel />
          </Sheet>
        </>
      )}
      {desktop && sheet === 'connection' && <DesktopSheetBridge />}
      <QuickSymbolsSheet
        group={quick}
        onClose={() => setQuick(null)}
        onPick={(id) => {
          beginPlacing(id);
          setQuick(null);
        }}
        onMore={(f) => {
          setQuick(null);
          setLibFilter(f);
          st.openSheet('library');
        }}
      />
    </div>
  );
}

/** Sur ordinateur, la « feuille » de liaison s'affiche dans le panneau Propriétés. */
function DesktopSheetBridge() {
  useEffect(() => {
    const s = useEditorStore.getState();
    s.setRightPanel('properties');
    s.openSheet(null);
  }, []);
  return null;
}
