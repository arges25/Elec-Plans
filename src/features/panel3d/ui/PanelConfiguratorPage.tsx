import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Loader2, Pencil, Redo2, Undo2 } from 'lucide-react';
import { AppHeader } from '../../../components/layout/AppHeader';
import { SaveIndicator } from '../../../components/layout/SaveIndicator';
import { useSaveStatus } from '../../../store/saveStatusStore';
import { promptDialog } from '../../../store/dialogStore';
import { brandName, getEnclosure } from '../data/catalog';
import { getPanelProject, savePanelProject } from '../persistence/panelProjectRepository';
import { usePanelEditor, type EditorTab } from '../store/panelEditorStore';
import { BoardEditorTab } from './BoardEditorTab';
import { BomTab } from './BomTab';
import { ConfigTab } from './ConfigTab';
import { DragGhost } from './DragGhost';
import { BoardSwitcher } from './BoardSwitcher';
import { EditorDialogs } from './EditorDialogs';
import { FullscreenPreview } from './FullscreenPreview';
import { LabelsTab } from './LabelsTab';
import { PrintTab } from './PrintTab';
import { useDragStore } from './dragStore';
import { useUiStore } from './uiStore';

const TABS: { id: EditorTab; label: string; short: string }[] = [
  { id: 'config', label: 'Configuration', short: 'Config.' },
  { id: 'board', label: 'Édition du tableau', short: 'Tableau' },
  { id: 'labels', label: 'Étiquettes', short: 'Étiquettes' },
  { id: 'bom', label: 'Nomenclature', short: 'Liste' },
  { id: 'print', label: 'Aperçu & impression', short: 'Impression' },
];

const AUTOSAVE_MS = 500;

/** Sauvegarde automatique du projet ouvert (IndexedDB). */
function useAutosave() {
  const setStatus = useSaveStatus((s) => s.setStatus);
  useEffect(() => {
    let timer: number | undefined;
    let pending: ReturnType<typeof usePanelEditor.getState>['project'] = null;
    const flush = async () => {
      window.clearTimeout(timer);
      timer = undefined;
      const p = pending;
      pending = null;
      if (!p) return;
      setStatus('saving');
      try {
        await savePanelProject(p);
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    };
    const unsub = usePanelEditor.subscribe((s, prev) => {
      if (!s.project || s.project === prev.project || !prev.project || s.project.id !== prev.project.id) return;
      pending = s.project;
      setStatus('pending');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void flush(), AUTOSAVE_MS);
    });
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      unsub();
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      void flush();
      setStatus('idle');
    };
  }, [setStatus]);
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable));
}

/** Raccourcis clavier : annuler / rétablir, supprimer, échap. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ed = usePanelEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !isTyping(e.target)) {
        e.preventDefault();
        if (e.shiftKey) ed.redo();
        else ed.undo();
      } else if (mod && e.key.toLowerCase() === 'y' && !isTyping(e.target)) {
        e.preventDefault();
        ed.redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping(e.target) && ed.selection?.kind === 'device' && ed.tab === 'board' && !useUiStore.getState().quickEdit) {
        e.preventDefault();
        ed.removeDevice(ed.selection.id);
      } else if (e.key === 'Escape' && !isTyping(e.target)) {
        if (useDragStore.getState().drag) useDragStore.getState().end(false);
        else if (ed.armedProductId || ed.moveDeviceId) {
          ed.arm(null);
          ed.setMoveDevice(null);
        } else ed.select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function PanelConfiguratorPage() {
  const { panelProjectId } = useParams();
  const project = usePanelEditor((s) => s.project);
  const tab = usePanelEditor((s) => s.tab);
  const canUndo = usePanelEditor((s) => s.past.length > 0);
  const canRedo = usePanelEditor((s) => s.future.length > 0);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!panelProjectId) return;
    void getPanelProject(panelProjectId).then((p) => {
      if (!alive) return;
      if (!p) {
        setMissing(true);
        return;
      }
      const ed = usePanelEditor.getState();
      ed.load(p);
      ed.setTab(p.boards.some((b) => b.devices.length) ? 'board' : 'config');
    });
    return () => {
      alive = false;
    };
  }, [panelProjectId]);
  useEffect(() => () => usePanelEditor.getState().unload(), []);

  useAutosave();
  useShortcuts();

  if (missing) {
    return (
      <div className="min-h-dvh">
        <AppHeader title="Tableau introuvable" back="/tableaux" />
        <p className="p-6 text-center text-slate-600">Ce tableau n’existe plus sur cet appareil.</p>
      </div>
    );
  }
  if (!project || project.id !== panelProjectId) {
    return (
      <div className="flex h-dvh items-center justify-center text-slate-500" role="status">
        <Loader2 className="mr-2 size-6 animate-spin text-blue-600" aria-hidden /> Chargement du tableau…
      </div>
    );
  }

  const board = project.boards.find((b) => b.id === project.activeBoardId) ?? project.boards[0];
  const enc = getEnclosure(board.enclosureId);
  const ed = usePanelEditor.getState();
  const rename = async () => {
    const name = await promptDialog({ title: 'Nom du projet', label: 'Nom', defaultValue: project.name });
    if (name?.trim()) ed.setMeta({ name: name.trim() });
  };

  return (
    <div className="flex h-dvh flex-col bg-slate-50" data-testid="panel-configurator">
      <AppHeader
        back="/tableaux"
        title={
          <button type="button" onClick={() => void rename()} className="inline-flex max-w-full items-center gap-1.5 truncate text-left hover:underline" aria-label="Renommer le projet">
            <span className="truncate">{project.name}</span>
            <Pencil className="size-3.5 shrink-0 opacity-70" aria-hidden />
          </button>
        }
        subtitle={enc ? `${board.title} · ${brandName(enc.brand)} · ${enc.family} · ${enc.rows} × ${enc.modulesPerRow} modules` : undefined}
        actions={
          <>
            <span className="hidden sm:inline">
              <SaveIndicator />
            </span>
            <button type="button" aria-label="Annuler" title="Annuler (Ctrl+Z)" disabled={!canUndo} onClick={ed.undo} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-white/10 disabled:opacity-35">
              <Undo2 className="size-5" aria-hidden />
            </button>
            <button type="button" aria-label="Rétablir" title="Rétablir (Ctrl+Y)" disabled={!canRedo} onClick={ed.redo} className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-white/10 disabled:opacity-35">
              <Redo2 className="size-5" aria-hidden />
            </button>
          </>
        }
      />
      <BoardSwitcher />
      <nav className="shrink-0 border-b border-slate-200 bg-white" aria-label="Étapes">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 py-1.5" role="tablist">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => ed.setTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors ${
                tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className={`inline-flex size-5 items-center justify-center rounded-full text-[11px] ${tab === t.id ? 'bg-white/25' : 'bg-slate-200 text-slate-700'}`}>{i + 1}</span>
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.short}</span>
            </button>
          ))}
        </div>
      </nav>
      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === 'config' && (
          <div className="h-full overflow-y-auto">
            <ConfigTab onDone={() => ed.setTab('board')} />
          </div>
        )}
        {tab === 'board' && <BoardEditorTab />}
        {tab === 'labels' && <LabelsTab />}
        {tab === 'bom' && <BomTab />}
        {tab === 'print' && <PrintTab />}
      </main>
      <DragGhost />
      <EditorDialogs />
      <FullscreenPreview />
    </div>
  );
}
