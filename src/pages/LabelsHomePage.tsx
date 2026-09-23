import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Grid3x3, Plus, Printer, Ruler, SlidersHorizontal, Trash2 } from 'lucide-react';
import { db } from '../database/db';
import { createPanelForProject, deletePanel } from '../database/panelRepository';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { Button } from '../components/ui/Button';
import { Card, EmptyState, SectionTitle } from '../components/ui/Card';
import { IconButton } from '../components/ui/IconButton';
import { promptDialog, confirmDialog } from '../store/dialogStore';
import { formatRelativeDate } from '../utils/format';

/** Étiquettes tableau : tableaux des chantiers + tableaux indépendants. */
export default function LabelsHomePage() {
  const navigate = useNavigate();
  const panels = useLiveQuery(() => db.panels.orderBy('updatedAt').reverse().toArray(), []);
  const projects = useLiveQuery(() => db.projects.toArray(), []);
  const counts = useLiveQuery(async () => {
    const all = await db.circuits.toArray();
    const m = new Map<string, number>();
    for (const c of all) m.set(c.panelId, (m.get(c.panelId) ?? 0) + 1);
    return m;
  }, []);
  const projectName = (id: string | null) => projects?.find((p) => p.id === id)?.name;

  const createStandalone = async () => {
    const name = await promptDialog({ title: 'Nouveau tableau indépendant', label: 'Nom', placeholder: 'Garage M. Dupont' });
    if (!name?.trim()) return;
    const panel = await createPanelForProject(null, name.trim());
    navigate(`/panel/${panel.id}`);
  };

  return (
    <div className="min-h-dvh">
      <AppHeader title="Étiquettes tableau" subtitle="Legrand · Schneider · Hager · modèles personnalisés" back="/" />
      <PageBody className="max-w-3xl">
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" icon={<SlidersHorizontal className="size-4" aria-hidden />} onClick={() => navigate('/templates')}>
            Modèles
          </Button>
          <Button size="sm" icon={<Ruler className="size-4" aria-hidden />} onClick={() => navigate('/calibration')}>
            Calibrer
          </Button>
          <Button size="sm" icon={<Printer className="size-4" aria-hidden />} onClick={() => navigate('/printers')}>
            Imprimantes
          </Button>
        </div>
        <SectionTitle
          action={
            <Button size="sm" variant="ghost" className="text-brand-600" icon={<Plus className="size-4" aria-hidden />} onClick={() => void createStandalone()}>
              Tableau indépendant
            </Button>
          }
        >
          Tableaux
        </SectionTitle>
        {panels && panels.length === 0 && (
          <EmptyState title="Aucun tableau" action={<Button variant="primary" onClick={() => void createStandalone()}>Créer un tableau</Button>}>
            Chaque chantier possède son tableau. Vous pouvez aussi créer un tableau indépendant pour imprimer rapidement des étiquettes.
          </EmptyState>
        )}
        <div className="flex flex-col gap-2">
          {panels?.map((p) => (
            <Card key={p.id} className="flex items-center gap-3 p-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-volt-400">
                <Grid3x3 className="size-5" aria-hidden />
              </span>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate(`/panel/${p.id}/labels`)}>
                <p className="truncate font-bold">{projectName(p.projectId) ?? p.name}</p>
                <p className="text-xs text-gray-500">
                  {p.projectId ? 'Chantier' : 'Tableau indépendant'} · {counts?.get(p.id) ?? 0} circuit(s) · {p.rows.length} rangée(s) · modifié {formatRelativeDate(p.updatedAt)}
                </p>
              </button>
              <Button size="sm" onClick={() => navigate(`/panel/${p.id}`)}>
                Circuits
              </Button>
              {!p.projectId && (
                <IconButton
                  label={`Supprimer ${p.name}`}
                  icon={<Trash2 className="size-4 text-red-600" aria-hidden />}
                  onClick={async () => {
                    if (await confirmDialog({ title: `Supprimer définitivement ${p.name} ?`, confirmLabel: 'Supprimer', danger: true })) await deletePanel(p.id);
                  }}
                />
              )}
            </Card>
          ))}
        </div>
      </PageBody>
    </div>
  );
}
