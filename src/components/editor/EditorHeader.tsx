import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  ChevronDown,
  Crop,
  DraftingCompass,
  Eye,
  FileDown,
  FileUp,
  Grid3x3,
  Info,
  Layers,
  ListTree,
  MoreVertical,
  Pencil,
  Plus,
  Redo2,
  Ruler,
  Settings,
  Trash2,
  Undo2,
  Wand2,
  Wrench,
} from 'lucide-react';
import type { FloorType, Project } from '../../types';
import { useEditorStore } from '../../store/editorStore';
import { confirmDialog, promptDialog } from '../../store/dialogStore';
import { toast } from '../../store/toastStore';
import { addFloor, deleteFloor, renameFloor } from '../../database/projectRepository';
import { exportProjectFile } from '../../services/projectTransfer';
import { FLOOR_OPTIONS } from '../../utils/planFactory';
import { SaveIndicator } from '../layout/SaveIndicator';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ProjectNav, type ProjectSection } from '../layout/ProjectNav';
import { Sheet } from '../ui/Sheet';
import { IconButton } from '../ui/IconButton';

export interface EditorHeaderProps {
  project: Project | undefined;
  planId: string;
  desktop: boolean;
  correction: boolean;
  onSection: (s: ProjectSection) => boolean | void;
  onOpenPanel: (p: 'layers' | 'legend') => void;
}

function MenuItem({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-medium hover:bg-gray-100 ${danger ? 'text-red-600' : 'text-gray-800'}`}
    >
      <span className={danger ? 'text-red-500' : 'text-gray-500'}>{icon}</span>
      {label}
    </button>
  );
}

/** En-tête de l'éditeur : retour, niveau, état de sauvegarde, annuler / rétablir, aperçu client, menu. */
export function EditorHeader({ project, planId, desktop, correction, onSection, onOpenPanel }: EditorHeaderProps) {
  const navigate = useNavigate();
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const plan = useEditorStore((s) => s.plan);
  const wide = useMediaQuery('(min-width: 640px)');
  const [menu, setMenu] = useState(false);
  const [floors, setFloors] = useState(false);
  const st = useEditorStore.getState();
  const base = project ? `/project/${project.id}/plan/${planId}` : '';

  const run = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };

  const newFloor = async () => {
    if (!project) return;
    const choice = await promptDialog({
      title: 'Ajouter un niveau',
      message: `Niveaux proposés : ${FLOOR_OPTIONS.filter((f) => f.value !== 'custom')
        .map((f) => f.label)
        .join(', ')} — ou un nom libre.`,
      label: 'Nom du niveau',
      placeholder: 'Étage 1',
    });
    if (!choice?.trim()) return;
    const match = FLOOR_OPTIONS.find((f) => f.label.toLowerCase() === choice.trim().toLowerCase());
    const type: FloorType = match?.value ?? 'custom';
    const plan = await addFloor(project.id, type, choice.trim());
    setFloors(false);
    toast.success('Niveau ajouté ✓');
    navigate(`/project/${project.id}/plan/${plan.id}/import`);
  };

  return (
    <header className="z-30 bg-ink-900 text-white shadow-md pt-safe">
      <div className="flex min-h-14 items-center gap-1 px-safe-1">
        <IconButton tone="dark" label="Retour à l’accueil" icon={<ArrowLeft className="size-6" aria-hidden />} onClick={() => navigate('/')} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight">{correction ? 'Correction du plan' : (project?.name ?? '…')}</p>
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setFloors(true)}
              className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-gray-300 hover:text-white"
              aria-label="Changer de niveau"
            >
              <span className="truncate">{plan?.name ?? ''}</span>
              <ChevronDown className="size-3.5 shrink-0" aria-hidden />
            </button>
            {!desktop && <SaveIndicator />}
          </div>
        </div>
        {desktop && project && <ProjectNav projectId={project.id} planId={planId} active="plan" variant="tabs" onSection={onSection} />}
        {desktop && <SaveIndicator />}
        <IconButton tone="dark" label="Annuler" icon={<Undo2 className="size-5" aria-hidden />} onClick={() => st.undo()} disabled={!canUndo} />
        <IconButton tone="dark" label="Rétablir" icon={<Redo2 className="size-5" aria-hidden />} onClick={() => st.redo()} disabled={!canRedo} />
        {!correction && wide && (
          <IconButton tone="dark" label="Aperçu client" icon={<Eye className="size-5" aria-hidden />} onClick={() => st.setClientPreview(true)} />
        )}
        <IconButton tone="dark" label="Plus d’actions" icon={<MoreVertical className="size-5" aria-hidden />} onClick={() => setMenu(true)} />
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Actions du plan">
        <div className="flex flex-col p-2">
          <MenuItem icon={<Layers className="size-5" />} label="Calques" onClick={run(() => onOpenPanel('layers'))} />
          <MenuItem icon={<ListTree className="size-5" />} label="Légende" onClick={run(() => onOpenPanel('legend'))} />
          <MenuItem icon={<DraftingCompass className="size-5" />} label="Définir l’échelle" onClick={run(() => st.setTool('scale'))} />
          <MenuItem icon={<Ruler className="size-5" />} label="Mesurer" onClick={run(() => st.setTool('measure'))} />
          <MenuItem icon={<Eye className="size-5" />} label="Aperçu client" onClick={run(() => st.setClientPreview(true))} />
          <div className="my-1 h-px bg-gray-100" />
          <MenuItem icon={<Crop className="size-5" />} label="Recadrer / redresser le plan" onClick={run(() => navigate(`${base}/scan`))} />
          <MenuItem icon={<FileUp className="size-5" />} label="Importer / remplacer le plan" onClick={run(() => navigate(`${base}/import`))} />
          <MenuItem icon={<Wand2 className="size-5" />} label="Croquis → Plan" onClick={run(() => navigate(`${base}/sketch`))} />
          <MenuItem
            icon={<Wrench className="size-5" />}
            label={correction ? 'Quitter la correction' : 'Corriger le plan (murs / ouvertures)'}
            onClick={run(() => navigate(correction ? base : `${base}?mode=correction`))}
          />
          <div className="my-1 h-px bg-gray-100" />
          <MenuItem icon={<Grid3x3 className="size-5" />} label="Tableau électrique" onClick={run(() => project && navigate(`/project/${project.id}/panel`))} />
          <MenuItem icon={<FileDown className="size-5" />} label="Exporter en PDF" onClick={run(() => project && navigate(`/project/${project.id}/export`))} />
          <MenuItem
            icon={<FileDown className="size-5" />}
            label="Exporter le projet (.mgeplan)"
            onClick={run(() => {
              if (project) void exportProjectFile(project.id).then(() => toast.success('Projet exporté ✓'));
            })}
          />
          <MenuItem
            icon={<Info className="size-5" />}
            label="Informations du chantier"
            onClick={run(() => project && navigate(`/project/${project.id}/info`))}
          />
          <MenuItem icon={<Settings className="size-5" />} label="Réglages de l’éditeur" onClick={run(() => navigate('/settings'))} />
        </div>
      </Sheet>

      <Sheet open={floors} onClose={() => setFloors(false)} title="Niveaux du chantier">
        <div className="flex flex-col gap-1 p-2">
          {project?.floors.map((f) => (
            <div key={f.planId} className={`flex items-center gap-1 rounded-xl ${f.planId === planId ? 'bg-brand-50 ring-1 ring-brand-200' : ''}`}>
              <button
                type="button"
                className="min-h-12 flex-1 px-3 text-left font-semibold"
                onClick={() => {
                  setFloors(false);
                  navigate(`/project/${project.id}/plan/${f.planId}`);
                }}
              >
                {f.name}
              </button>
              <IconButton
                label={`Renommer ${f.name}`}
                icon={<Pencil className="size-4" aria-hidden />}
                onClick={async () => {
                  const name = await promptDialog({ title: 'Renommer le niveau', defaultValue: f.name, label: 'Nom' });
                  if (name?.trim()) {
                    await renameFloor(project.id, f.planId, name.trim());
                    if (f.planId === planId) st.setPlanMeta({ name: name.trim() });
                  }
                }}
              />
              {project.floors.length > 1 && (
                <IconButton
                  label={`Supprimer ${f.name}`}
                  icon={<Trash2 className="size-4 text-red-600" aria-hidden />}
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: `Supprimer définitivement ${f.name} ?`,
                      message: 'Le plan et ses symboles seront supprimés.',
                      confirmLabel: 'Supprimer',
                      danger: true,
                    });
                    if (!ok) return;
                    await deleteFloor(project.id, f.planId);
                    const other = project.floors.find((x) => x.planId !== f.planId);
                    setFloors(false);
                    if (f.planId === planId && other) navigate(`/project/${project.id}/plan/${other.planId}`);
                  }}
                />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => void newFloor()}
            className="mt-1 flex min-h-12 items-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 font-semibold text-brand-600"
          >
            <Plus className="size-5" aria-hidden /> Ajouter un niveau
          </button>
        </div>
      </Sheet>
    </header>
  );
}
