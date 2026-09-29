import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileUp, Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import type { FloorInfo, Project } from '../../types';
import { addNamedFloor, deleteFloor, renameFloor, reorderFloors } from '../../database/projectRepository';
import { useEditorStore } from '../../store/editorStore';
import { confirmDialog, promptDialog } from '../../store/dialogStore';
import { toast } from '../../store/toastStore';
import { planNameError, suggestPlanNames } from '../../utils/planFactory';
import { Sheet } from '../ui/Sheet';

/**
 * Plans du chantier sous forme d'onglets (RDC, Étage 1, Garage…) :
 * un toucher pour changer de plan, « + » pour en créer un et le nommer,
 * toucher l'onglet actif pour le renommer, le déplacer ou le supprimer.
 */

interface Props {
  project: Project;
  planId: string;
}

function usePlanActions(project: Project, planId: string) {
  const navigate = useNavigate();
  const open = (id: string, suffix = '') => navigate(`/project/${project.id}/plan/${id}${suffix}`);
  const names = (except?: string) => project.floors.filter((f) => f.planId !== except).map((f) => f.name);

  const rename = async (f: FloorInfo) => {
    const name = await promptDialog({
      title: 'Renommer le plan',
      label: 'Nom du plan',
      defaultValue: f.name,
      validate: (v) => planNameError(v, names(f.planId)),
    });
    if (!name?.trim() || name.trim() === f.name) return;
    await renameFloor(project.id, f.planId, name.trim());
    if (f.planId === planId) useEditorStore.getState().setPlanMeta({ name: name.trim() });
    toast.success('Plan renommé ✓');
  };

  const remove = async (f: FloorInfo) => {
    if (project.floors.length < 2) return;
    const ok = await confirmDialog({
      title: `Supprimer le plan « ${f.name} » ?`,
      message: 'Le plan, ses symboles et ses liaisons seront supprimés définitivement.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    await deleteFloor(project.id, f.planId);
    toast.success('Plan supprimé');
    if (f.planId === planId) {
      const other = project.floors.find((x) => x.planId !== f.planId);
      if (other) open(other.planId);
    }
  };

  const move = async (f: FloorInfo, delta: -1 | 1) => {
    const ids = project.floors.map((x) => x.planId);
    const i = ids.indexOf(f.planId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderFloors(project.id, ids);
  };

  return { open, names, rename, remove, move };
}

/** Création d'un plan : nom libre ou proposé, puis plan vierge ou import d'un fond. */
export function NewPlanSheet({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const existing = project.floors.map((f) => f.name);
  const suggestions = suggestPlanNames(existing);
  const error = planNameError(name, existing);

  useEffect(() => {
    if (!open) return;
    setName(suggestions[0] ?? '');
    setTouched(false);
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 80);
    return () => clearTimeout(t);
    // Proposition initiale uniquement à l'ouverture
  }, [open]);

  const create = async (then: 'edit' | 'import') => {
    setTouched(true);
    if (error || busy) return;
    setBusy(true);
    try {
      const plan = await addNamedFloor(project.id, name.trim());
      onClose();
      toast.success(`Plan « ${plan.name} » créé ✓`);
      navigate(`/project/${project.id}/plan/${plan.id}${then === 'import' ? '/import' : ''}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Création impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Nouveau plan" desktop="center" widthClass="max-w-md">
      <div className="space-y-4 p-4" data-testid="new-plan-sheet">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-800">Nom du plan</span>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void create('edit');
              }
            }}
            placeholder="ex. Étage 2, Garage, Extension…"
            maxLength={40}
            enterKeyHint="done"
            className={`min-h-12 w-full rounded-xl border px-3 outline-none focus:ring-2 ${touched && error ? 'border-red-400 focus:ring-red-100' : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100'}`}
            data-testid="new-plan-name"
          />
          {touched && error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
        </label>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Noms proposés">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setName(s)}
                aria-pressed={name === s}
                className={`min-h-9 rounded-full border px-3 text-sm font-semibold ${name === s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300'}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void create('edit')}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            data-testid="new-plan-create"
          >
            <Plus className="size-5" aria-hidden /> Créer le plan
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create('import')}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            data-testid="new-plan-import"
          >
            <FileUp className="size-5" aria-hidden /> Créer et importer un fond (photo, PDF, croquis)
          </button>
        </div>
        <p className="text-xs text-gray-500">Le plan est ajouté au chantier « {project.name} ». Vous pourrez le renommer à tout moment.</p>
      </div>
    </Sheet>
  );
}

/** Liste complète des plans : changer, renommer, déplacer, supprimer, créer. */
export function PlansSheet({ project, planId, open, onClose, onNew }: Props & { open: boolean; onClose: () => void; onNew: () => void }) {
  const a = usePlanActions(project, planId);
  return (
    <Sheet open={open} onClose={onClose} title="Plans du chantier">
      <div className="flex flex-col gap-1 p-2" data-testid="plans-sheet">
        {project.floors.map((f, i) => (
          <div key={f.planId} className={`flex items-center gap-0.5 rounded-xl ${f.planId === planId ? 'bg-brand-50 ring-1 ring-brand-200' : ''}`}>
            <button
              type="button"
              className="min-h-12 min-w-0 flex-1 truncate px-3 text-left font-semibold"
              onClick={() => {
                onClose();
                if (f.planId !== planId) a.open(f.planId);
              }}
            >
              {f.name}
            </button>
            <button
              type="button"
              aria-label={`Monter ${f.name}`}
              disabled={i === 0}
              onClick={() => void a.move(f, -1)}
              className="inline-flex size-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
            >
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Descendre ${f.name}`}
              disabled={i === project.floors.length - 1}
              onClick={() => void a.move(f, 1)}
              className="inline-flex size-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
            >
              <ArrowDown className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Renommer ${f.name}`}
              onClick={() => void a.rename(f)}
              className="inline-flex size-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
            {project.floors.length > 1 && (
              <button
                type="button"
                aria-label={`Supprimer ${f.name}`}
                onClick={() => void a.remove(f)}
                className="inline-flex size-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            onClose();
            onNew();
          }}
          className="mt-1 flex min-h-12 items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 font-semibold text-brand-600"
        >
          <Plus className="size-5" aria-hidden /> Nouveau plan
        </button>
      </div>
    </Sheet>
  );
}

/** Actions de l'onglet actif (toucher l'onglet déjà ouvert). */
function PlanActionsSheet({ project, planId, floor, onClose }: Props & { floor: FloorInfo | null; onClose: () => void }) {
  const a = usePlanActions(project, planId);
  if (!floor) return null;
  const i = project.floors.findIndex((f) => f.planId === floor.planId);
  const item = 'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-medium hover:bg-gray-100 disabled:opacity-40';
  const run = (fn: () => Promise<void>) => () => {
    onClose();
    void fn();
  };
  return (
    <Sheet open onClose={onClose} title={floor.name} desktop="center" widthClass="max-w-sm">
      <div className="flex flex-col p-2" data-testid="plan-actions">
        <button type="button" className={item} onClick={run(() => a.rename(floor))}>
          <Pencil className="size-5 text-gray-500" aria-hidden /> Renommer
        </button>
        <button type="button" className={item} disabled={i <= 0} onClick={run(() => a.move(floor, -1))}>
          <ChevronLeft className="size-5 text-gray-500" aria-hidden /> Déplacer à gauche
        </button>
        <button type="button" className={item} disabled={i < 0 || i >= project.floors.length - 1} onClick={run(() => a.move(floor, 1))}>
          <ChevronRight className="size-5 text-gray-500" aria-hidden /> Déplacer à droite
        </button>
        {project.floors.length > 1 && (
          <button type="button" className={`${item} text-red-600`} onClick={run(() => a.remove(floor))}>
            <Trash2 className="size-5 text-red-500" aria-hidden /> Supprimer ce plan
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function PlanTabs({ project, planId }: Props) {
  const a = usePlanActions(project, planId);
  const [newOpen, setNewOpen] = useState(false);
  const [manage, setManage] = useState(false);
  const [actions, setActions] = useState<FloorInfo | null>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [planId, project.floors.length]);

  // Les fenêtres sont rendues hors de la barre : elles passent ainsi au-dessus de l'en-tête et des barres d'outils
  return (
    <>
      <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-1.5 py-1 shadow-sm" data-testid="plan-tabs">
        <div
          role="tablist"
          aria-label="Plans du chantier"
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
        >
          {project.floors.map((f) => {
            const active = f.planId === planId;
            return (
              <button
                key={f.planId}
                ref={active ? activeRef : undefined}
                type="button"
                role="tab"
                aria-selected={active}
                title={active ? `${f.name} — toucher pour renommer, déplacer ou supprimer` : `Ouvrir ${f.name}`}
                onClick={() => (active ? setActions(f) : a.open(f.planId))}
                className={`inline-flex min-h-10 max-w-[11rem] shrink-0 items-center gap-1 rounded-xl px-3.5 text-sm font-bold transition-colors ${
                  active ? 'bg-ink-900 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="truncate">{f.name}</span>
                {active && <Pencil className="size-3 shrink-0 opacity-60" aria-hidden />}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            aria-label="Ajouter un plan"
            title="Ajouter un plan (étage, garage…)"
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl border-2 border-dashed border-brand-300 px-3 text-sm font-bold text-brand-600 hover:bg-brand-50"
            data-testid="add-plan"
          >
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Plan</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setManage(true)}
          aria-label="Gérer les plans"
          title="Gérer les plans"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100"
        >
          <Settings2 className="size-5" aria-hidden />
        </button>
      </div>
      <NewPlanSheet project={project} open={newOpen} onClose={() => setNewOpen(false)} />
      <PlansSheet project={project} planId={planId} open={manage} onClose={() => setManage(false)} onNew={() => setNewOpen(true)} />
      <PlanActionsSheet project={project} planId={planId} floor={actions} onClose={() => setActions(null)} />
    </>
  );
}
