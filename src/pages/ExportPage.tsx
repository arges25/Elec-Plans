import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Eye, Loader2, Printer, Share2 } from 'lucide-react';
import { db } from '../database/db';
import { loadPlanDocument } from '../database/planRepository';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { ProjectNav } from '../components/layout/ProjectNav';
import { Button } from '../components/ui/Button';
import { Card, SectionTitle } from '../components/ui/Card';
import { Segmented, Slider, TextField, Toggle } from '../components/ui/Field';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { DEFAULT_PDF_OPTIONS, type PlanPdfOptions } from '../services/pdf/planPdfExport';
import { pdfBytesToBlob, printPdfBlob } from '../services/printerService/pdfPrint';
import { downloadBlob, shareOrDownload } from '../utils/download';
import { safeFileName } from '../utils/format';
import { toast } from '../store/toastStore';

const STORAGE_KEY = 'mg-pdf-options';

function loadOptions(): PlanPdfOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PDF_OPTIONS, ...(JSON.parse(raw) as Partial<PlanPdfOptions>) };
  } catch {
    /* stockage indisponible */
  }
  return DEFAULT_PDF_OPTIONS;
}

/** Export PDF professionnel du plan. */
export default function ExportPage() {
  const { projectId } = useParams();
  const desktop = useIsDesktop();
  const project = useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId]);
  const plans = useLiveQuery(() => (projectId ? db.plans.where('projectId').equals(projectId).sortBy('order') : []), [projectId]);
  const [opts, setOpts] = useState<PlanPdfOptions>(loadOptions);
  const [selectedPlans, setSelectedPlans] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
    } catch {
      /* stockage indisponible */
    }
  }, [opts]);

  useEffect(() => {
    if (plans && selectedPlans === null) setSelectedPlans(plans.map((p) => p.id));
  }, [plans, selectedPlans]);

  const set = <K extends keyof PlanPdfOptions>(k: K, v: PlanPdfOptions[K]) => {
    setOpts((o) => ({ ...o, [k]: v }));
    setPreview([]);
  };

  const fileName = useMemo(() => `${safeFileName(project?.name ?? 'plan')}-plan-electrique.pdf`, [project?.name]);

  const generate = async (): Promise<Blob | null> => {
    if (!project || !plans) return null;
    const chosen = plans.filter((p) => selectedPlans?.includes(p.id));
    if (!chosen.length) {
      toast.error('Choisissez au moins un niveau');
      return null;
    }
    const { generatePlanPdf } = await import('../services/pdf/planPdfExport');
    const pages = await Promise.all(chosen.map(async (plan) => ({ plan, doc: await loadPlanDocument(plan) })));
    const bytes = await generatePlanPdf(project, pages, opts);
    return pdfBytesToBlob(bytes);
  };

  const run = async (label: string, fn: (blob: Blob) => Promise<void> | void) => {
    setBusy(label);
    try {
      const blob = await generate();
      if (blob) await fn(blob);
    } catch (e) {
      console.error(e);
      toast.error('Création du PDF impossible');
    } finally {
      setBusy(null);
    }
  };

  const doPreview = () =>
    run('Création de l’aperçu…', async (blob) => {
      const { openPdf, renderPdfPage } = await import('../services/pdf/pdfImport');
      const doc = await openPdf(blob);
      const imgs: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const c = await renderPdfPage(doc, i, 1600);
        imgs.push(c.toDataURL('image/png'));
      }
      setPreview(imgs);
    });

  const header = (
    <AppHeader title="Export PDF" subtitle={project?.name} back={projectId ? `/project/${projectId}` : '/'}>
      {desktop && projectId && (
        <div className="mx-auto max-w-6xl px-2 pb-2">
          <ProjectNav projectId={projectId} active="export" variant="tabs" />
        </div>
      )}
    </AppHeader>
  );

  return (
    <div className="min-h-dvh">
      {header}
      <PageBody>
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div>
            <SectionTitle>Mise en page</SectionTitle>
            <Card className="flex flex-col gap-3 p-4">
              <Segmented
                ariaLabel="Format"
                value={opts.format}
                onChange={(v) => set('format', v)}
                options={[
                  { value: 'A4', label: 'A4' },
                  { value: 'A3', label: 'A3' },
                ]}
              />
              <Segmented
                ariaLabel="Orientation"
                value={opts.orientation}
                onChange={(v) => set('orientation', v)}
                options={[
                  { value: 'portrait', label: 'Portrait' },
                  { value: 'landscape', label: 'Paysage' },
                ]}
              />
              <Slider label="Marges" value={opts.marginMm} min={5} max={25} onChange={(v) => set('marginMm', v)} format={(v) => `${v} mm`} />
              <TextField label="Titre" value={opts.title} onValueChange={(v) => set('title', v)} />
            </Card>

            <SectionTitle>Informations</SectionTitle>
            <Card className="divide-y divide-gray-100 px-4">
              <Toggle label="Nom du chantier" checked={opts.showProjectName} onChange={(v) => set('showProjectName', v)} />
              <Toggle label="Client" checked={opts.showClient} onChange={(v) => set('showClient', v)} />
              <Toggle label="Date" checked={opts.showDate} onChange={(v) => set('showDate', v)} />
              <Toggle label="Adresse" checked={opts.showAddress} onChange={(v) => set('showAddress', v)} />
              <Toggle label="Inclure le logo MG Elec & Plans" checked={opts.includeLogo} onChange={(v) => set('includeLogo', v)} />
            </Card>

            <SectionTitle>Contenu</SectionTitle>
            <Card className="divide-y divide-gray-100 px-4">
              <Toggle label="Afficher la légende" checked={opts.showLegend} onChange={(v) => set('showLegend', v)} />
              <Toggle label="Afficher les notes" checked={opts.showNotes} onChange={(v) => set('showNotes', v)} />
              <Toggle label="Afficher les liaisons" checked={opts.showConnections} onChange={(v) => set('showConnections', v)} />
              <Toggle
                label="Afficher le plan original"
                description="Photo, scan ou PDF importé"
                checked={opts.showOriginal}
                onChange={(v) => set('showOriginal', v)}
              />
              <Toggle
                label="Afficher le plan reconstruit"
                description="Murs, portes, fenêtres, pièces"
                checked={opts.showReconstructed}
                onChange={(v) => set('showReconstructed', v)}
              />
              <Toggle label="Afficher les annotations" checked={opts.showAnnotations} onChange={(v) => set('showAnnotations', v)} />
              <Toggle label="Afficher les mesures" checked={opts.showMeasures} onChange={(v) => set('showMeasures', v)} />
            </Card>

            {plans && plans.length > 1 && (
              <>
                <SectionTitle>Niveaux</SectionTitle>
                <Card className="divide-y divide-gray-100 px-4">
                  {plans.map((p) => (
                    <Toggle
                      key={p.id}
                      label={p.name}
                      checked={Boolean(selectedPlans?.includes(p.id))}
                      onChange={(v) => {
                        setSelectedPlans((cur) => (v ? [...(cur ?? []), p.id] : (cur ?? []).filter((x) => x !== p.id)));
                        setPreview([]);
                      }}
                    />
                  ))}
                </Card>
              </>
            )}
          </div>

          <div>
            <div className="sticky top-20 z-10 grid grid-cols-2 gap-2 rounded-2xl bg-gray-50/90 py-2 backdrop-blur sm:grid-cols-4">
              <Button icon={<Eye className="size-5" aria-hidden />} onClick={() => void doPreview()} disabled={Boolean(busy)}>
                APERÇU
              </Button>
              <Button
                variant="primary"
                icon={<Download className="size-5" aria-hidden />}
                disabled={Boolean(busy)}
                onClick={() =>
                  void run('Création du PDF…', (blob) => {
                    downloadBlob(blob, fileName);
                    toast.success('PDF créé ✓');
                  })
                }
              >
                EXPORTER PDF
              </Button>
              <Button
                icon={<Printer className="size-5" aria-hidden />}
                disabled={Boolean(busy)}
                onClick={() =>
                  void run('Préparation de l’impression…', async (blob) => {
                    await printPdfBlob(blob);
                  })
                }
              >
                IMPRIMER
              </Button>
              <Button
                icon={<Share2 className="size-5" aria-hidden />}
                disabled={Boolean(busy)}
                onClick={() =>
                  void run('Préparation du partage…', async (blob) => {
                    const r = await shareOrDownload(blob, fileName, project?.name ?? 'Plan');
                    if (r === 'downloaded') toast.success('PDF créé ✓');
                  })
                }
              >
                PARTAGER
              </Button>
            </div>
            {busy && (
              <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-600" role="status">
                <Loader2 className="size-5 animate-spin text-brand-500" aria-hidden /> {busy}
              </p>
            )}
            <div className="mt-3 flex flex-col gap-4">
              {preview.length === 0 && !busy && (
                <div className="flex aspect-[1.414] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                  Touchez « APERÇU » pour visualiser le PDF avant export.
                </div>
              )}
              {preview.map((src, i) => (
                <img key={i} src={src} alt={`Aperçu page ${i + 1}`} className="w-full rounded-xl border border-gray-200 bg-white shadow" />
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-500">
              PDF vectoriel (symboles, murs, liaisons nets à tout zoom). Plan simplifié destiné à l’implantation électrique : document indicatif, validation par
              l’électricien.
            </p>
          </div>
        </div>
      </PageBody>
      {!desktop && projectId && <ProjectNav projectId={projectId} active="export" variant="bottom" />}
    </div>
  );
}
