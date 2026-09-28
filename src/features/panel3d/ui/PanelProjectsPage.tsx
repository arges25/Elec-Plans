import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { AppHeader, PageBody } from '../../../components/layout/AppHeader';
import { Button } from '../../../components/ui/Button';
import { EmptyState, SectionTitle } from '../../../components/ui/Card';
import { IconButton } from '../../../components/ui/IconButton';
import { confirmDialog, promptDialog } from '../../../store/dialogStore';
import { toast } from '../../../store/toastStore';
import { formatRelativeDate } from '../../../utils/format';
import { db } from '../../../database/db';
import type { PanelProject } from '../types';
import { brandName, getEnclosure } from '../data/catalog';
import { boardGeometry } from '../engine/geometry';
import { BoardSvg, boardViewBox } from '../render/BoardSvg';
import { createAndSavePanelProject, deletePanelProject, duplicatePanelProject, savePanelProject } from '../persistence/panelProjectRepository';

function Thumb({ p }: { p: PanelProject }) {
  const enc = getEnclosure(p.enclosureId);
  if (!enc) return null;
  const vb = boardViewBox(boardGeometry(enc));
  const h = 96;
  return <BoardSvg project={p} enclosure={enc} uid={`t-${p.id}`} width={Math.min(120, (vb.w / vb.h) * h)} height={h} preciseMeasure={false} />;
}

/** Tableaux électriques enregistrés (configurateur 3D). */
export default function PanelProjectsPage() {
  const navigate = useNavigate();
  const projects = useLiveQuery(() => db.panelProjects.orderBy('updatedAt').reverse().toArray(), []);
  const chantiers = useLiveQuery(() => db.projects.toArray(), []);

  const create = async () => {
    const name = await promptDialog({ title: 'Nouveau tableau électrique', label: 'Nom du projet', placeholder: 'Maison Dupont — tableau principal' });
    if (!name?.trim()) return;
    const p = await createAndSavePanelProject(name.trim());
    navigate(`/tableaux/${p.id}`);
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader title="Tableaux électriques" subtitle="Configurateur 3D · Legrand · Schneider · Hager" back="/" />
      <PageBody className="max-w-4xl">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
          <p className="font-bold text-slate-900">Composez le tableau, posez les appareils, nommez les circuits</p>
          <p className="mt-1 text-sm text-slate-600">Coffrets aux dimensions officielles, rails DIN au pas de 18 mm, étiquettes au-dessus des appareils, impression à l’échelle réelle.</p>
          <Button variant="primary" className="mt-3 !bg-blue-600 hover:!bg-blue-700" icon={<Plus className="size-5" aria-hidden />} onClick={() => void create()} data-testid="new-panel-project">
            Nouveau tableau
          </Button>
        </div>

        <SectionTitle>Mes tableaux</SectionTitle>
        {projects && projects.length === 0 && (
          <EmptyState title="Aucun tableau enregistré">Créez un premier tableau : il est enregistré automatiquement sur cet appareil.</EmptyState>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {projects?.map((p) => {
            const enc = getEnclosure(p.enclosureId);
            const chantier = p.projectId ? chantiers?.find((c) => c.id === p.projectId)?.name : null;
            return (
              <div key={p.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <button type="button" onClick={() => navigate(`/tableaux/${p.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Ouvrir ${p.name}`}>
                  <span className="flex h-24 w-28 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                    <Thumb p={p} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-slate-900">{p.name}</span>
                    <span className="block truncate text-xs text-slate-600">{enc ? `${brandName(enc.brand)} · ${enc.name}` : '—'}</span>
                    <span className="block text-xs text-slate-500">
                      {p.devices.length} appareil(s) · modifié {formatRelativeDate(p.updatedAt)}
                    </span>
                    {chantier && <span className="block truncate text-xs font-semibold text-blue-700">Chantier : {chantier}</span>}
                  </span>
                </button>
                <div className="flex shrink-0 flex-col">
                  <IconButton
                    label={`Renommer ${p.name}`}
                    icon={<Pencil className="size-4" aria-hidden />}
                    onClick={async () => {
                      const name = await promptDialog({ title: 'Renommer', label: 'Nom', defaultValue: p.name });
                      if (name?.trim()) await savePanelProject({ ...p, name: name.trim(), updatedAt: Date.now() });
                    }}
                  />
                  <IconButton
                    label={`Dupliquer ${p.name}`}
                    icon={<Copy className="size-4" aria-hidden />}
                    onClick={async () => {
                      const c = await duplicatePanelProject(p.id);
                      if (c) toast.success('Tableau dupliqué');
                    }}
                  />
                  <IconButton
                    label={`Supprimer ${p.name}`}
                    icon={<Trash2 className="size-4 text-red-600" aria-hidden />}
                    onClick={async () => {
                      if (await confirmDialog({ title: `Supprimer définitivement « ${p.name} » ?`, confirmLabel: 'Supprimer', danger: true })) await deletePanelProject(p.id);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
          <Tags className="size-6 shrink-0 text-slate-500" aria-hidden />
          <p className="flex-1 text-sm text-slate-600">L’ancien éditeur d’étiquettes (modèles, imprimantes Bluetooth) reste disponible.</p>
          <Button size="sm" onClick={() => navigate('/labels')}>
            Ancien éditeur d’étiquettes
          </Button>
        </div>
      </PageBody>
    </div>
  );
}
