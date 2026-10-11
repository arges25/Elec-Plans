import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, FileDown, Grid3x3, Lightbulb, Plug, Share2, ToggleRight, Wand2, WashingMachine } from 'lucide-react';
import type { ElectricalCircuit } from '../types';
import { db } from '../database/db';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { ProjectNav } from '../components/layout/ProjectNav';
import { SaveIndicator } from '../components/layout/SaveIndicator';
import { Button } from '../components/ui/Button';
import { Card, EmptyState, SectionTitle } from '../components/ui/Card';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { NFC15100_RULES } from '../data/nfc15100';
import { buildRecap, CIRCUIT_TYPE_LABELS, planAutoDistribution, type CircuitReport, type RecapElement } from '../services/panelRecap';
import { applyDistribution, undoDistribution } from '../services/panelRecapActions';
import { generateRecapPdf, STATUS_STYLE, statusLabel } from '../services/pdf/recapPdf';
import { confirmDialog } from '../store/dialogStore';
import { toast, useToastStore } from '../store/toastStore';
import { downloadBlob, shareOrDownload } from '../utils/download';
import { formatAmps, formatSection } from '../utils/electrical';
import { safeFileName } from '../utils/format';

/** Carte de synthèse (nombre + libellé). */
function Stat({ icon, value, label, sub }: { icon: ReactNode; value: number; label: string; sub?: string }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-none tabular-nums text-gray-900">{value}</p>
        <p className="mt-0.5 text-xs font-semibold leading-tight text-gray-600">{label}</p>
        {sub && <p className="text-[11px] leading-tight text-gray-500">{sub}</p>}
      </div>
    </Card>
  );
}

/** Pastille d'état : vert (OK), orange (proche de la limite / à préciser), rouge (dépassé), gris (non vérifié). */
function StatusPill({ c }: { c: CircuitReport }) {
  const color = STATUS_STYLE[c.status].color;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold"
      style={{ backgroundColor: `${color}1f`, color: c.status === 'unknown' ? '#4b5563' : color }}
      data-testid="circuit-status"
      data-status={c.status}
    >
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {statusLabel(c)}
    </span>
  );
}

function CircuitCard({ c }: { c: CircuitReport }) {
  const color = STATUS_STYLE[c.status].color;
  const pct = c.max ? Math.min(100, (c.count / c.max) * 100) : 0;
  const typeLabel = c.type === 'specialise' && c.dedicatedRule ? c.dedicatedRule.label : CIRCUIT_TYPE_LABELS[c.type];
  return (
    <Card className="overflow-hidden" data-testid="recap-circuit">
      <div className="flex">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} aria-hidden />
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start gap-2">
            <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 px-1.5 text-sm font-extrabold tabular-nums text-white">
              {c.number || '–'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight text-gray-900">{c.name}</p>
              <p className="text-xs text-gray-600">
                {[
                  typeLabel,
                  c.sectionMm2 !== null ? formatSection(c.sectionMm2) : 'Section ?',
                  c.breakerA !== null ? formatAmps(c.breakerA) : 'Calibre ?',
                ].join(' · ')}
                {!c.circuit && ' · nommé sur le plan'}
              </p>
              <div className="mt-1">
                <StatusPill c={c} />
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className="shrink-0 text-sm font-bold tabular-nums text-gray-900">
              {c.max !== null ? `${c.count} / ${c.max}` : c.count} <span className="font-medium text-gray-600">{c.unit}</span>
            </p>
            {c.max !== null && c.max > 1 && (
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            )}
          </div>
          {c.rooms.length > 0 && (
            <p className="mt-1 truncate text-xs text-gray-500">
              {c.rooms
                .slice(0, 4)
                .map((r) => `${r.name} (${r.count})`)
                .join(' · ')}
              {c.rooms.length > 4 ? ' · …' : ''}
            </p>
          )}
          {c.messages.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {c.messages.map((m) => (
                <li
                  key={m}
                  className={`text-xs font-semibold ${c.status === 'error' ? 'text-red-700' : c.status === 'warn' ? 'text-brand-700' : 'text-gray-600'}`}
                >
                  {m}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Libellés singulier / pluriel des éléments. */
const KIND_LABEL: Record<RecapElement['kind'], [string, string]> = {
  socket: ['prise', 'prises'],
  light: ['point lumineux', 'points lumineux'],
  switch: ['commande', 'commandes'],
  dedicated: ['appareil spécialisé', 'appareils spécialisés'],
  other: ['équipement', 'équipements'],
};

/** Page « Récapitulatif / Calcul du tableau » : comptage tous niveaux, contrôle NF C 15-100, matériel, export. */
export default function PanelRecapPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const [busy, setBusy] = useState<null | 'pdf' | 'share' | 'auto'>(null);
  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId]);
  const plans = useLiveQuery(() => (projectId ? db.plans.where('projectId').equals(projectId).toArray() : []), [projectId]);
  const symbols = useLiveQuery(() => (projectId ? db.symbolsPlaced.where('projectId').equals(projectId).toArray() : []), [projectId]);
  const panel = useLiveQuery(() => (projectId ? db.panels.where('projectId').equals(projectId).first() : undefined), [projectId]);
  const circuits = useLiveQuery<ElectricalCircuit[]>(() => (panel ? db.circuits.where('panelId').equals(panel.id).toArray() : []), [panel?.id]);

  const input = useMemo(() => (plans && symbols && circuits ? { plans, symbols, circuits } : null), [plans, symbols, circuits]);
  const recap = useMemo(() => (input ? buildRecap(input) : null), [input]);
  const distribution = useMemo(() => (input ? planAutoDistribution(input) : null), [input]);

  if (!projectId) return null;
  if (!recap || !project) {
    return (
      <div className="min-h-dvh">
        <AppHeader title="Récapitulatif du tableau" back={`/project/${projectId}/panel`} />
        <PageBody>
          <p className="text-gray-500">Calcul en cours…</p>
        </PageBody>
      </div>
    );
  }

  const t = recap.totals;
  const sc = recap.statusCount;
  const nothingToDo = !distribution || (distribution.newCircuits.length === 0 && distribution.assignments.length === 0);
  const fileName = `recapitulatif-tableau-${safeFileName(project.name)}.pdf`;

  const exportPdf = async (mode: 'pdf' | 'share') => {
    setBusy(mode);
    try {
      const bytes = await generateRecapPdf(project, recap);
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      if (mode === 'pdf') {
        downloadBlob(blob, fileName);
        toast.success('PDF exporté ✓');
      } else {
        const r = await shareOrDownload(blob, fileName, `Récapitulatif du tableau — ${project.name}`);
        if (r === 'downloaded') toast.info('Partage indisponible : PDF téléchargé');
      }
    } catch (e) {
      console.error(e);
      toast.error('Export impossible');
    } finally {
      setBusy(null);
    }
  };

  const autoDistribute = async () => {
    if (!distribution || nothingToDo) return;
    const ok = await confirmDialog({
      title: 'Répartir automatiquement ?',
      message: `${distribution.summary.join(' · ')}. Les circuits créés sont ajoutés au tableau ; vous pourrez annuler juste après.`,
      confirmLabel: 'Répartir',
    });
    if (!ok) return;
    setBusy('auto');
    try {
      const undo = await applyDistribution(projectId, distribution);
      useToastStore.getState().push(
        {
          kind: 'success',
          message: `Répartition enregistrée ✓ ${distribution.summary[0] ?? ''}`.trim(),
          action: {
            label: 'Annuler',
            onClick: () => void undoDistribution(undo).then(() => toast.info('Répartition annulée')),
          },
        },
        10000,
      );
    } catch (e) {
      console.error(e);
      toast.error('Répartition impossible');
    } finally {
      setBusy(null);
    }
  };

  // Tableau par niveau et par pièce
  const floors = [...new Set(recap.rooms.map((r) => r.floorName))];
  const r = NFC15100_RULES;

  return (
    <div className="min-h-dvh">
      <AppHeader
        title="Récapitulatif"
        subtitle={`Calcul du tableau · ${project.name}`}
        back={`/project/${projectId}/panel`}
        actions={
          <>
            <SaveIndicator />
            <Button
              size="sm"
              variant="dark"
              className="!px-2"
              icon={<Share2 className="size-5" aria-hidden />}
              onClick={() => void exportPdf('share')}
              loading={busy === 'share'}
              aria-label="Partager"
            />
          </>
        }
      >
        {desktop && (
          <div className="mx-auto max-w-6xl px-2 pb-2">
            <ProjectNav projectId={projectId} active="panel" variant="tabs" />
          </div>
        )}
      </AppHeader>
      <PageBody className="max-w-4xl">
        {recap.elements.length === 0 ? (
          <EmptyState title="Aucun élément sur les plans">
            Placez des prises, des commandes et des éclairages sur vos plans : le récapitulatif et le calcul du tableau se feront automatiquement.
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="recap-totals">
              <Stat
                icon={<Plug className="size-5" aria-hidden />}
                value={t.sockets}
                label="Prises"
                sub={`${t.socketPoints} point${t.socketPoints > 1 ? 's' : ''}`}
              />
              <Stat icon={<ToggleRight className="size-5" aria-hidden />} value={t.switches} label="Commandes" />
              <Stat icon={<Lightbulb className="size-5" aria-hidden />} value={t.lights} label="Points lumineux" />
              <Stat icon={<WashingMachine className="size-5" aria-hidden />} value={t.dedicated} label="Appareils spécialisés" />
            </div>

            <Card className="mt-3 p-3">
              <p className="text-sm font-bold text-gray-900">
                {recap.circuits.length} circuit{recap.circuits.length > 1 ? 's' : ''} · {floors.length} niveau{floors.length > 1 ? 'x' : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
                <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">● {sc.ok} OK</span>
                <span className="rounded-full bg-brand-100 px-2 py-1 text-brand-700">
                  ● {sc.warn} proche{sc.warn > 1 ? 's' : ''} de la limite / à préciser
                </span>
                <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">
                  ● {sc.error} limite{sc.error > 1 ? 's' : ''} dépassée{sc.error > 1 ? 's' : ''}
                </span>
                {sc.unknown > 0 && (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                    ● {sc.unknown} non vérifié{sc.unknown > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {recap.unassigned.length > 0 && (
                <p className="mt-2 text-sm font-semibold text-brand-700">
                  {recap.unassigned.length} élément{recap.unassigned.length > 1 ? 's' : ''} sans circuit
                </p>
              )}
              <div className="mt-3 border-t border-gray-100 pt-3">
                <Button
                  variant="primary"
                  size="lg"
                  block
                  icon={<Wand2 className="size-5" aria-hidden />}
                  onClick={() => void autoDistribute()}
                  disabled={nothingToDo}
                  loading={busy === 'auto'}
                  data-testid="auto-distribute"
                >
                  {nothingToDo ? 'Tout est réparti ✓' : 'Répartir automatiquement'}
                </Button>
                {!nothingToDo && distribution && <p className="mt-1.5 text-xs text-gray-600">{distribution.summary.join(' · ')}</p>}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button icon={<FileDown className="size-5" aria-hidden />} onClick={() => void exportPdf('pdf')} loading={busy === 'pdf'}>
                  Export PDF
                </Button>
                <Button icon={<Share2 className="size-5" aria-hidden />} onClick={() => void exportPdf('share')} loading={busy === 'share'}>
                  Partager
                </Button>
              </div>
            </Card>

            <SectionTitle
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-brand-600"
                  icon={<Grid3x3 className="size-4" aria-hidden />}
                  onClick={() => navigate(`/project/${projectId}/panel`)}
                >
                  Modifier le tableau
                </Button>
              }
            >
              Circuits
            </SectionTitle>
            <div className="flex flex-col gap-2">
              {recap.circuits.map((c) => (
                <CircuitCard key={c.key} c={c} />
              ))}
              {recap.circuits.length === 0 && <p className="text-sm text-gray-500">Aucun circuit : utilisez « Répartir automatiquement ».</p>}
            </div>

            {recap.unassigned.length > 0 && (
              <>
                <SectionTitle>Éléments sans circuit</SectionTitle>
                <Card className="divide-y divide-gray-100" data-testid="recap-unassigned">
                  {groupUnassigned(recap.unassigned).map((g) => (
                    <div key={g.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate font-semibold text-gray-800">
                        {g.floor} · {g.room}
                      </span>
                      <span className="shrink-0 text-gray-600">{g.text}</span>
                    </div>
                  ))}
                </Card>
              </>
            )}

            <SectionTitle>Par niveau et par pièce</SectionTitle>
            <Card className="overflow-x-auto" data-testid="recap-rooms">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink-900 text-left text-xs text-white">
                    <th className="px-3 py-2 font-bold">Pièce</th>
                    <th className="px-1 py-2 text-center font-bold">Prises</th>
                    <th className="px-1 py-2 text-center font-bold" title="Commandes">
                      Cmd.
                    </th>
                    <th className="px-1 py-2 text-center font-bold" title="Points lumineux">
                      Lum.
                    </th>
                    <th className="px-1 py-2 pr-3 text-center font-bold" title="Appareils spécialisés">
                      Spé.
                    </th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {floors.map((f) => {
                    const rows = recap.rooms.filter((x) => x.floorName === f);
                    return [
                      <tr key={`f-${f}`} className="bg-brand-50">
                        <td colSpan={5} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-700">
                          {f}
                        </td>
                      </tr>,
                      ...rows.map((x) => (
                        <tr key={`${f}-${x.room}`} className="border-b border-gray-100">
                          <td className="px-3 py-2 font-medium text-gray-800">{x.room}</td>
                          <td className="px-1 py-2 text-center">{x.sockets}</td>
                          <td className="px-1 py-2 text-center">{x.switches}</td>
                          <td className="px-1 py-2 text-center">{x.lights}</td>
                          <td className="px-1 py-2 pr-3 text-center">{x.dedicated}</td>
                        </tr>
                      )),
                    ];
                  })}
                  <tr className="bg-gray-100 font-bold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-1 py-2 text-center">{t.sockets}</td>
                    <td className="px-1 py-2 text-center">{t.switches}</td>
                    <td className="px-1 py-2 text-center">{t.lights}</td>
                    <td className="px-1 py-2 pr-3 text-center">{t.dedicated}</td>
                  </tr>
                </tbody>
              </table>
            </Card>

            <SectionTitle>Matériel du tableau</SectionTitle>
            <Card className="overflow-hidden" data-testid="recap-material">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink-900 text-left text-xs text-white">
                    <th className="px-3 py-2 font-bold">Désignation</th>
                    <th className="w-16 px-3 py-2 text-center font-bold">Qté</th>
                  </tr>
                </thead>
                <tbody>
                  {recap.material.map((l) => (
                    <tr key={l.label} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-semibold text-gray-900">{l.label}</p>
                        {l.detail && <p className="text-xs text-gray-500">{l.detail}</p>}
                      </td>
                      <td className="px-3 py-2 text-center text-lg font-extrabold tabular-nums">{l.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            {recap.materialNotes.length > 0 && (
              <ul className="mt-2 flex flex-col gap-0.5 text-xs text-gray-500">
                {recap.materialNotes.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
                {recap.unassigned.length > 0 && <li>• Les éléments sans circuit ne sont pas comptés dans le matériel.</li>}
              </ul>
            )}

            <details className="group mt-6 rounded-2xl border border-gray-200 bg-white">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-bold text-gray-800">
                Règles utilisées (NF C 15-100)
                <ChevronDown className="size-5 text-gray-500 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="flex flex-col gap-1 px-4 pb-4 text-sm text-gray-700">
                {r.sockets.map((s) => (
                  <li key={s.section}>
                    Prises : {formatSection(s.section)}, disjoncteur {formatAmps(s.breakerA)} maximum, {s.maxPoints} prises maximum
                  </li>
                ))}
                <li>
                  Éclairage : {formatSection(r.lighting.section)}, disjoncteur {formatAmps(r.lighting.breakerA)} maximum, {r.lighting.maxPoints} points
                  d’utilisation maximum
                </li>
                <li>
                  Prise multiple dans un même boîtier : {r.multiSocketPoints} point{r.multiSocketPoints > 1 ? 's' : ''}
                </li>
                <li>
                  Circuits spécialisés (1 appareil par circuit) :{' '}
                  {r.dedicated
                    .filter((d) => d.verifySizing !== false)
                    .map((d) => `${d.label} ${formatSection(d.section)} / ${formatAmps(d.breakerA)}`)
                    .join(' · ')}
                </li>
                <li>
                  Orange à partir de {Math.round(r.nearLimitRatio * 100)} % du maximum · {r.rcd.maxCircuits} circuits maximum par interrupteur différentiel ·
                  réserve {r.reservePercent} %
                </li>
                <li className="text-xs text-gray-500">
                  Valeurs modifiables dans le fichier de configuration <code>src/data/nfc15100.ts</code>. Vérification indicative : ne remplace pas la norme ni
                  l’avis d’un professionnel.
                </li>
              </ul>
            </details>
          </>
        )}
      </PageBody>
      {!desktop && <ProjectNav projectId={projectId} active="panel" variant="bottom" />}
    </div>
  );
}

/** « RDC · Salon : 3 prises, 1 commande » */
function groupUnassigned(list: RecapElement[]) {
  const groups = new Map<string, { key: string; floor: string; room: string; counts: Map<RecapElement['kind'], number> }>();
  for (const e of list) {
    const key = `${e.floorOrder}|${e.room}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, floor: e.floorName, room: e.room, counts: new Map() };
      groups.set(key, g);
    }
    g.counts.set(e.kind, (g.counts.get(e.kind) ?? 0) + 1);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    text: [...g.counts].map(([k, n]) => `${n} ${KIND_LABEL[k][n > 1 ? 1 : 0]}`).join(', '),
  }));
}
