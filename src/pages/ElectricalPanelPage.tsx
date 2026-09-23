import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, ListOrdered, Pencil, Plus, Tags, Trash2, Wand2 } from 'lucide-react';
import type { ElectricalCircuit, ElectricalPanel } from '../types';
import { db } from '../database/db';
import { deleteCircuit, newRow, saveCircuit, saveCircuits, savePanel } from '../database/panelRepository';
import { listTemplates } from '../database/templateRepository';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { ProjectNav } from '../components/layout/ProjectNav';
import { CircuitEditorSheet } from '../components/labels/CircuitEditorSheet';
import { SymbolIcon } from '../components/symbols/SymbolIcon';
import { Button } from '../components/ui/Button';
import { Badge, Card, EmptyState, SectionTitle } from '../components/ui/Card';
import { SelectField } from '../components/ui/Field';
import { IconButton } from '../components/ui/IconButton';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { confirmDialog, promptDialog } from '../store/dialogStore';
import { toast } from '../store/toastStore';
import { importCircuitsFromSymbols, newCircuit, renumberCircuits } from '../services/panelCircuits';

const KIND_COLORS: Record<ElectricalCircuit['kind'], string> = {
  circuit: 'bg-white',
  differential: 'bg-gray-200',
  main: 'bg-gray-300',
  spare: 'bg-gray-50 border-dashed',
  other: 'bg-blue-50',
};

/** Tableau électrique simplifié : rangées + circuits. */
export default function ElectricalPanelPage() {
  const { panelId } = useParams();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const panel = useLiveQuery(() => (panelId ? db.panels.get(panelId) : undefined), [panelId]);
  const circuits = useLiveQuery(() => (panelId ? db.circuits.where('panelId').equals(panelId).sortBy('order') : []), [panelId]) ?? [];
  const templates = useLiveQuery(() => listTemplates(), []) ?? [];
  const project = useLiveQuery(() => (panel?.projectId ? db.projects.get(panel.projectId) : undefined), [panel?.projectId]);
  const symbols = useLiveQuery(() => (panel?.projectId ? db.symbolsPlaced.where('projectId').equals(panel.projectId).toArray() : []), [panel?.projectId]) ?? [];
  const [editing, setEditing] = useState<{ circuit: ElectricalCircuit; isNew: boolean } | null>(null);

  const template = templates.find((t) => t.id === panel?.templateId) ?? templates[0];
  const symbolCountByCircuit = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of symbols) if (s.properties.circuitId) m.set(s.properties.circuitId, (m.get(s.properties.circuitId) ?? 0) + 1);
    return m;
  }, [symbols]);
  const pendingNames = useMemo(() => new Set(symbols.filter((s) => !s.properties.circuitId && s.properties.circuitName).map((s) => s.properties.circuitName!.trim().toLowerCase())).size, [symbols]);

  if (!panel) {
    return (
      <div className="min-h-dvh">
        <AppHeader title="Tableau électrique" back="/" />
        <PageBody>
          <p className="text-gray-500">Chargement…</p>
        </PageBody>
      </div>
    );
  }

  const update = (changes: Partial<ElectricalPanel>) => void savePanel({ ...panel, ...changes });

  const addCircuit = (rowId: string) => setEditing({ circuit: newCircuit(panel, rowId, circuits), isNew: true });

  const move = async (c: ElectricalCircuit, dir: -1 | 1) => {
    const row = circuits.filter((x) => x.rowId === c.rowId).sort((a, b) => a.order - b.order);
    const i = row.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= row.length) return;
    const a = row[i];
    const b = row[j];
    await saveCircuits([
      { ...a, order: b.order },
      { ...b, order: a.order },
    ]);
  };

  const addRow = () => {
    if (panel.rows.length >= 8) return;
    update({ rows: [...panel.rows, newRow(panel.rows.length)] });
  };

  const removeRow = async (rowId: string) => {
    const inRow = circuits.filter((c) => c.rowId === rowId);
    const row = panel.rows.find((r) => r.id === rowId);
    const ok = await confirmDialog({
      title: `Supprimer ${row?.name ?? 'la rangée'} ?`,
      message: inRow.length ? `${inRow.length} circuit(s) de cette rangée seront aussi supprimés.` : undefined,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    for (const c of inRow) await deleteCircuit(c);
    update({ rows: panel.rows.filter((r) => r.id !== rowId) });
  };

  const renameRow = async (rowId: string) => {
    const row = panel.rows.find((r) => r.id === rowId);
    const name = await promptDialog({ title: 'Nom de la rangée', defaultValue: row?.name, label: 'Nom' });
    if (name?.trim()) update({ rows: panel.rows.map((r) => (r.id === rowId ? { ...r, name: name.trim() } : r)) });
  };

  return (
    <div className="min-h-dvh">
      <AppHeader
        title="Tableau électrique"
        subtitle={project ? project.name : panel.name}
        back={panel.projectId ? `/project/${panel.projectId}` : '/labels'}
        actions={
          !desktop && (
            <IconButton tone="dark" label="Étiquettes" icon={<Tags className="size-5" aria-hidden />} onClick={() => navigate(`/panel/${panel.id}/labels`)} />
          )
        }
      >
        {desktop && panel.projectId && (
          <div className="mx-auto max-w-6xl px-2 pb-2">
            <ProjectNav projectId={panel.projectId} active="panel" variant="tabs" />
          </div>
        )}
      </AppHeader>
      <PageBody className="max-w-4xl">
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <SelectField
            wrapperClassName="flex-1"
            label="Modèle d’étiquettes (fabricant)"
            value={panel.templateId}
            onValueChange={(v) => update({ templateId: v })}
            options={templates.map((t) => ({ value: t.id, label: `${t.name} — ${t.modulesPerRow} × ${t.modulePitchMm} mm` }))}
          />
          <Button variant="primary" icon={<Tags className="size-5" aria-hidden />} onClick={() => navigate(`/panel/${panel.id}/labels`)}>
            Étiquettes
          </Button>
        </Card>

        <div className="mt-3 flex flex-wrap gap-2">
          {panel.projectId && (
            <Button
              size="sm"
              icon={<Wand2 className="size-4" aria-hidden />}
              onClick={async () => {
                const r = await importCircuitsFromSymbols(panel);
                if (r.created || r.linked) toast.success(`${r.created} circuit(s) créé(s), ${r.linked} symbole(s) relié(s) ✓`);
                else toast.info('Aucun nouveau circuit trouvé sur le plan (renseignez « Circuit » dans les propriétés des symboles).');
              }}
            >
              Importer depuis le plan{pendingNames ? ` (${pendingNames})` : ''}
            </Button>
          )}
          <Button
            size="sm"
            icon={<ListOrdered className="size-4" aria-hidden />}
            onClick={async () => {
              await renumberCircuits(panel);
              toast.success('Circuits renumérotés ✓');
            }}
          >
            Renuméroter
          </Button>
        </div>

        {panel.rows.map((row) => {
          const rowCircuits = circuits.filter((c) => c.rowId === row.id).sort((a, b) => a.order - b.order);
          const used = rowCircuits.reduce((s, c) => s + c.modules, 0);
          const cap = template?.modulesPerRow ?? 13;
          return (
            <section key={row.id} aria-label={row.name}>
              <SectionTitle
                action={
                  <div className="flex items-center gap-1">
                    <Badge tone={used > cap ? 'red' : used === cap ? 'green' : 'gray'}>
                      {used} / {cap} modules
                    </Badge>
                    <IconButton label={`Renommer ${row.name}`} icon={<Pencil className="size-4" aria-hidden />} onClick={() => void renameRow(row.id)} />
                    {panel.rows.length > 1 && <IconButton label={`Supprimer ${row.name}`} icon={<Trash2 className="size-4 text-red-600" aria-hidden />} onClick={() => void removeRow(row.id)} />}
                  </div>
                }
              >
                {row.name}
              </SectionTitle>
              {/* Vue schématique de la rangée */}
              <div className="mb-2 flex h-10 overflow-hidden rounded-lg border border-gray-300 bg-gray-100" aria-hidden>
                {rowCircuits.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-center border-r border-gray-300 text-[10px] font-bold text-gray-700 ${KIND_COLORS[c.kind]}`}
                    style={{ width: `${(c.modules / Math.max(cap, used)) * 100}%` }}
                    title={c.name}
                  >
                    {c.number || (c.kind === 'differential' ? 'ID' : '')}
                  </div>
                ))}
              </div>
              {used > cap && <p className="mb-2 text-sm font-semibold text-red-600">Rangée trop remplie : {used - cap} module(s) de trop.</p>}
              <Card className="divide-y divide-gray-100">
                {rowCircuits.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun circuit dans cette rangée.</p>}
                {rowCircuits.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2 p-2 pl-3">
                    <span className="w-8 shrink-0 text-center text-lg font-extrabold tabular-nums text-gray-900">{c.number || '–'}</span>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-50">{c.icon && <SymbolIcon id={c.icon} size={30} color="#111827" />}</span>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing({ circuit: c, isNew: false })}>
                      <p className="truncate font-semibold text-gray-900">{c.name}</p>
                      <p className="truncate text-xs text-gray-500">
                        {[c.protection, c.cableSection, `${c.modules} module${c.modules > 1 ? 's' : ''}`, symbolCountByCircuit.get(c.id) ? `${symbolCountByCircuit.get(c.id)} symbole(s)` : ''].filter(Boolean).join(' · ')}
                      </p>
                    </button>
                    <IconButton label="Monter" icon={<ArrowUp className="size-4" aria-hidden />} onClick={() => void move(c, -1)} disabled={i === 0} />
                    <IconButton label="Descendre" icon={<ArrowDown className="size-4" aria-hidden />} onClick={() => void move(c, 1)} disabled={i === rowCircuits.length - 1} />
                  </div>
                ))}
              </Card>
              <Button size="sm" variant="ghost" className="mt-2 text-brand-600" icon={<Plus className="size-4" aria-hidden />} onClick={() => addCircuit(row.id)}>
                Ajouter un circuit à {row.name}
              </Button>
            </section>
          );
        })}

        {panel.rows.length < 8 && (
          <Button className="mt-6" block icon={<Plus className="size-5" aria-hidden />} onClick={addRow}>
            Ajouter une rangée
          </Button>
        )}
        {circuits.length === 0 && (
          <div className="mt-6">
            <EmptyState title="Tableau vide">
              Ajoutez vos circuits rangée par rangée (ex. 1 Éclairage salon, 2 Prises salon, 3 Prises cuisine, 4 Four…). Les étiquettes seront proposées automatiquement.
            </EmptyState>
          </div>
        )}
      </PageBody>

      <CircuitEditorSheet
        circuit={editing?.circuit ?? null}
        isNew={editing?.isNew ?? false}
        rows={panel.rows}
        symbolCount={editing ? symbolCountByCircuit.get(editing.circuit.id) : undefined}
        onClose={() => setEditing(null)}
        onSave={async (c) => {
          const moved = !editing?.isNew && circuits.find((x) => x.id === c.id)?.rowId !== c.rowId;
          const toSave = moved ? { ...c, order: circuits.filter((x) => x.rowId === c.rowId).reduce((m, x) => Math.max(m, x.order), -1) + 1 } : c;
          await saveCircuit(toSave);
          // Répercute nom / numéro sur les symboles liés
          if (panel.projectId) {
            const linked = symbols.filter((s) => s.properties.circuitId === c.id);
            if (linked.length)
              await db.symbolsPlaced.bulkPut(linked.map((s) => ({ ...s, properties: { ...s.properties, circuitName: c.name, circuitNumber: c.number, breaker: c.protection, cableSection: c.cableSection } })));
          }
          toast.success(editing?.isNew ? 'Circuit ajouté ✓' : 'Circuit enregistré ✓');
          setEditing(null);
        }}
        onDelete={async (c) => {
          const ok = await confirmDialog({ title: `Supprimer le circuit « ${c.name} » ?`, confirmLabel: 'Supprimer', danger: true });
          if (!ok) return;
          await deleteCircuit(c);
          setEditing(null);
        }}
      />
      {!desktop && panel.projectId && <ProjectNav projectId={panel.projectId} active="panel" variant="bottom" />}
    </div>
  );
}
