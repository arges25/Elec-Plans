import { useState } from 'react';
import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { Sheet } from '../../../components/ui/Sheet';
import { confirmDialog, promptDialog } from '../../../store/dialogStore';
import { toast } from '../../../store/toastStore';
import { usePanelEditor } from '../store/panelEditorStore';

/** Tableaux du projet (principal, garage, étage…) : changer, ajouter, renommer, dupliquer, supprimer. */
export function BoardSwitcher() {
  const project = usePanelEditor((s) => s.project)!;
  const [menu, setMenu] = useState(false);
  const ed = usePanelEditor.getState;
  const active = project.boards.find((b) => b.id === project.activeBoardId) ?? project.boards[0];

  const add = async () => {
    const title = await promptDialog({ title: 'Nouveau tableau', label: 'Titre', placeholder: 'TABLEAU GARAGE', defaultValue: 'TABLEAU ' });
    if (!title?.trim()) return;
    ed().addBoard(title.trim().toUpperCase());
    ed().setTab('config');
  };
  const rename = async () => {
    setMenu(false);
    const title = await promptDialog({ title: 'Renommer le tableau', label: 'Titre', defaultValue: active.title });
    if (title?.trim()) ed().setBoardMeta({ title: title.trim().toUpperCase() });
  };

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1" data-testid="board-switcher">
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Tableaux du projet">
        {project.boards.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={b.id === active.id}
            onClick={() => ed().setActiveBoard(b.id)}
            className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-extrabold uppercase tracking-wide ${b.id === active.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'}`}
          >
            {b.title || 'TABLEAU'}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => void add()} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50" data-testid="add-board">
        <Plus className="size-4" aria-hidden /> <span className="hidden sm:inline">Tableau</span>
      </button>
      <button type="button" onClick={() => setMenu(true)} aria-label="Actions du tableau" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200">
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      <Sheet open={menu} onClose={() => setMenu(false)} title={active.title} desktop="center" widthClass="max-w-sm">
        <div className="grid gap-2 p-4">
          <button type="button" onClick={() => void rename()} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 px-4 font-semibold hover:bg-slate-50">
            <Pencil className="size-4" aria-hidden /> Renommer
          </button>
          <button
            type="button"
            onClick={() => {
              ed().duplicateBoard(active.id);
              setMenu(false);
              toast.success('Tableau dupliqué');
            }}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 px-4 font-semibold hover:bg-slate-50"
          >
            <Copy className="size-4" aria-hidden /> Dupliquer
          </button>
          <button
            type="button"
            disabled={project.boards.length < 2}
            onClick={async () => {
              setMenu(false);
              if (!(await confirmDialog({ title: `Supprimer « ${active.title} » ?`, message: 'Le tableau et ses appareils sont retirés du projet (annulable).', confirmLabel: 'Supprimer', danger: true }))) return;
              const r = ed().removeBoard(active.id);
              if (!r.ok && r.message) toast.error(r.message);
            }}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-red-200 px-4 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 className="size-4" aria-hidden /> Supprimer
          </button>
        </div>
      </Sheet>
    </div>
  );
}
