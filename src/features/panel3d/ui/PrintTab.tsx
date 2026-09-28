import { useMemo, useState } from 'react';
import { FileDown, Printer, Ruler, Save } from 'lucide-react';
import { Stepper } from '../../../components/ui/Stepper';
import { getEnclosure } from '../data/catalog';
import { CALIBRATION_LENGTH_MM, correctionFromMeasure, layoutSheet, loadCorrectionPercent, panelHeader, percentToScale, saveCorrectionPercent } from '../print/labelSheet';
import { SheetPageSvg } from '../print/SheetPageSvg';
import { usePanelEditor } from '../store/panelEditorStore';
import { savePanelProject } from '../persistence/panelProjectRepository';
import { BoardSvg } from '../render/BoardSvg';
import { toast } from '../../../store/toastStore';
import { shareOrDownload } from '../../../utils/download';
import { pdfBytesToBlob } from '../../../services/printerService/pdfPrint';

/** Onglet 5 — Aperçu & impression. */
export function PrintTab() {
  const project = usePanelEditor((s) => s.project)!;
  const setPrint = usePanelEditor((s) => s.setPrint);
  const enc = getEnclosure(project.enclosureId)!;
  const [correction, setCorrection] = useState(loadCorrectionPercent);
  const [measured, setMeasured] = useState('');
  const [busy, setBusy] = useState<null | 'full' | 'labels'>(null);
  const scale = percentToScale(correction);
  const layout = useMemo(() => layoutSheet(project, scale), [project, scale]);

  const print = async (what: 'labels' | 'full' | 'ruler') => {
    try {
      const m = await import('../print/panelPrint');
      if (what === 'ruler') m.printCalibrationRuler();
      else m.printLabels(usePanelEditor.getState().project!, what === 'full');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impression impossible');
    }
  };

  const exportPdf = async (mode: 'full' | 'labels') => {
    setBusy(mode);
    try {
      const { buildPanelPdf } = await import('../print/panelPdf');
      const bytes = await buildPanelPdf(project, mode);
      const safe = project.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'tableau';
      const res = await shareOrDownload(pdfBytesToBlob(bytes), `${safe}-${mode === 'full' ? 'tableau' : 'etiquettes'}.pdf`, project.name);
      if (res !== 'cancelled') toast.success('PDF exporté');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export PDF impossible');
    } finally {
      setBusy(null);
    }
  };

  const applyMeasure = () => {
    try {
      const pct = correctionFromMeasure(Number(measured.replace(',', '.')), correction);
      setCorrection(pct);
      saveCorrectionPercent(pct);
      setMeasured('');
      toast.success(`Correction enregistrée sur cet appareil : ${pct >= 0 ? '+' : ''}${String(pct).replace('.', ',')} %`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Mesure invalide');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4" data-testid="print-tab">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-2 text-base font-bold">Tableau</h2>
            <div className="flex justify-center rounded-xl bg-gradient-to-b from-slate-50 to-slate-200 p-2">
              <BoardSvg project={project} enclosure={enc} uid="prv" width="100%" height={Math.min(460, 120 + enc.rows * 85)} />
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-base font-bold">Étiquettes à l’échelle réelle</h2>
            <p className="mb-2 text-xs text-slate-500">
              A4 {layout.orientation === 'portrait' ? 'portrait' : 'paysage'} · {layout.pages.length} page(s) · module {String(project.print.moduleMm).replace('.', ',')} mm · hauteur{' '}
              {String(project.print.labelHeightMm).replace('.', ',')} mm
            </p>
            <div className="space-y-3">
              {layout.pages.map((strips, i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-slate-300 shadow">
                  <SheetPageSvg layout={layout} strips={strips} pageIndex={i} header={panelHeader(project)} fontPt={project.print.fontSizePt} scale={scale} uid={`sp${i}`} screenWidth="100%" />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <button type="button" onClick={() => void print('labels')} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700" data-testid="print-labels">
              <Printer className="size-5" aria-hidden /> Imprimer les étiquettes
            </button>
            <button type="button" onClick={() => void print('full')} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50">
              <Printer className="size-4" aria-hidden /> Imprimer le tableau complet
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void exportPdf('full')}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                data-testid="pdf-full"
              >
                <FileDown className="size-4" aria-hidden /> {busy === 'full' ? 'Export…' : 'PDF complet'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void exportPdf('labels')}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                data-testid="pdf-labels"
              >
                <FileDown className="size-4" aria-hidden /> {busy === 'labels' ? 'Export…' : 'PDF étiquettes'}
              </button>
            </div>
            <button
              type="button"
              onClick={async () => {
                await savePanelProject(usePanelEditor.getState().project!);
                toast.success('Projet enregistré');
              }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50"
            >
              <Save className="size-4" aria-hidden /> Enregistrer
            </button>
            <p className="text-xs leading-snug text-slate-500">À l’impression : échelle 100 %, « Ajuster à la page » désactivé.</p>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-bold">Format des étiquettes</h3>
            <Stepper label="Largeur d’un module" value={project.print.moduleMm} onChange={(v) => setPrint({ moduleMm: Math.round(v * 10) / 10 })} step={0.1} min={15} max={20} decimals={1} suffix="mm" hint="18 mm = pas DIN standard" />
            <Stepper label="Hauteur" value={project.print.labelHeightMm} onChange={(v) => setPrint({ labelHeightMm: Math.round(v * 10) / 10 })} step={0.5} min={8} max={20} decimals={1} suffix="mm" />
            <Stepper label="Taille du texte" value={project.print.fontSizePt} onChange={(v) => setPrint({ fontSizePt: Math.round(v * 10) / 10 })} step={0.5} min={5} max={14} decimals={1} suffix="pt" />
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="calibration">
            <h3 className="flex items-center gap-2 font-bold">
              <Ruler className="size-4" aria-hidden /> Calibration de l’imprimante
            </h3>
            <p className="text-sm text-slate-600">
              Correction actuelle : <strong>{correction >= 0 ? '+' : ''}{String(correction).replace('.', ',')} %</strong> (enregistrée sur cet appareil)
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Imprimez la règle de {CALIBRATION_LENGTH_MM} mm.</li>
              <li>Mesurez-la avec un réglet.</li>
              <li>Saisissez la mesure : la correction est calculée.</li>
            </ol>
            <button type="button" onClick={() => void print('ruler')} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50">
              <Printer className="size-4" aria-hidden /> Imprimer la règle de {CALIBRATION_LENGTH_MM} mm
            </button>
            <div className="flex gap-2">
              <label className="flex min-h-11 flex-1 items-center gap-1 rounded-xl border border-slate-300 px-3 focus-within:border-blue-500">
                <input
                  inputMode="decimal"
                  value={measured}
                  onChange={(e) => setMeasured(e.target.value)}
                  placeholder="Mesure (ex. 49,4)"
                  aria-label="Longueur mesurée en millimètres"
                  className="min-w-0 flex-1 bg-transparent outline-none"
                />
                <span className="text-sm text-slate-500">mm</span>
              </label>
              <button type="button" onClick={applyMeasure} disabled={!measured.trim()} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40">
                Appliquer
              </button>
            </div>
            {correction !== 0 && (
              <button
                type="button"
                onClick={() => {
                  setCorrection(0);
                  saveCorrectionPercent(0);
                }}
                className="text-sm font-semibold text-slate-500 underline hover:text-red-600"
              >
                Réinitialiser la correction
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
