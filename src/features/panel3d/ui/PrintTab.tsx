import { useState } from 'react';
import { Download, FileDown, Image as ImageIcon, Printer, Ruler, Save, Tags } from 'lucide-react';
import { Stepper } from '../../../components/ui/Stepper';
import { getEnclosure } from '../data/catalog';
import { CALIBRATION_LENGTH_MM, correctionFromMeasure, loadCorrectionPercent, saveCorrectionPercent } from '../print/labelSheet';
import { usePanelEditor } from '../store/panelEditorStore';
import { panelProjectFile, savePanelProject } from '../persistence/panelProjectRepository';
import { SchemaSvg } from '../render/SchemaSvg';
import { toast } from '../../../store/toastStore';
import { downloadBlob, shareOrDownload } from '../../../utils/download';
import { pdfBytesToBlob } from '../../../services/printerService/pdfPrint';
import { PrintPreview, type PreviewKind } from './PrintPreview';

function safeName(s: string): string {
  return s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'tableau';
}

const card = 'space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
const btnSecondary = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold hover:bg-slate-50 disabled:opacity-50';

/** Onglet 5 — Aperçu & impression : schéma tableau, étiquettes, exports, sauvegarde. */
export function PrintTab() {
  const project = usePanelEditor((s) => s.project)!;
  const doc = usePanelEditor((s) => s.doc)!;
  const setPrint = usePanelEditor((s) => s.setPrint);
  const enc = getEnclosure(doc.enclosureId)!;
  const [correction, setCorrection] = useState(loadCorrectionPercent);
  const [measured, setMeasured] = useState('');
  const [preview, setPreview] = useState<PreviewKind | null>(null);
  const [busy, setBusy] = useState<null | 'full' | 'png'>(null);

  const exportFull = async () => {
    setBusy('full');
    try {
      const { buildPanelPdf } = await import('../print/panelPdf');
      const bytes = await buildPanelPdf(project, 'full', 'all');
      const res = await shareOrDownload(pdfBytesToBlob(bytes), `${safeName(project.name)}-dossier.pdf`, project.name);
      if (res !== 'cancelled') toast.success('Dossier PDF exporté');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export PDF impossible');
    } finally {
      setBusy(null);
    }
  };
  const exportPng = async () => {
    setBusy('png');
    try {
      const { schemaPng } = await import('../print/panelPdf');
      const bytes = await schemaPng(doc);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      downloadBlob(new Blob([copy.buffer], { type: 'image/png' }), `${safeName(project.name)}-${safeName(doc.title)}.png`);
      toast.success('Image PNG exportée');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export PNG impossible');
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
  const printRuler = async () => {
    try {
      (await import('../print/panelPrint')).printCalibrationRuler();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impression impossible');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4" data-testid="print-tab">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">Schéma tableau</h2>
              <p className="text-xs text-slate-500">Projet, tableau, marque, gamme, rangées, modules, appareils, calibres, repères, étiquettes, modules disponibles</p>
            </div>
            <button type="button" onClick={() => setPreview('schema')} className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left hover:border-blue-400" aria-label="Aperçu du schéma">
              <SchemaSvg doc={doc} enclosure={enc} uid="prv" width="100%" className="h-auto w-full" info={`Projet : ${doc.projectName}`} />
            </button>
            <div className="grid gap-2 sm:grid-cols-3">
              <button type="button" onClick={() => setPreview('schema')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700" data-testid="print-schema">
                <Printer className="size-5" aria-hidden /> Imprimer schéma tableau
              </button>
              <button type="button" disabled={busy !== null} onClick={() => void exportPng()} className={btnSecondary} data-testid="export-png">
                <ImageIcon className="size-4" aria-hidden /> {busy === 'png' ? 'Export…' : 'PNG haute résolution'}
              </button>
              <button type="button" disabled={busy !== null} onClick={() => void exportFull()} className={btnSecondary} data-testid="pdf-full">
                <FileDown className="size-4" aria-hidden /> {busy === 'full' ? 'Export…' : 'Dossier PDF complet'}
              </button>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className={card}>
            <h3 className="flex items-center gap-2 font-bold">
              <Tags className="size-4" aria-hidden /> Étiquettes physiques
            </h3>
            <p className="text-xs text-slate-500">Seules les étiquettes nécessaires sont imprimées, aux dimensions réelles du support.</p>
            <Stepper label="Largeur d’un module" value={doc.print.moduleMm} onChange={(v) => setPrint({ moduleMm: Math.round(v * 10) / 10 })} step={0.1} min={15} max={20} decimals={1} suffix="mm" hint="18 mm = pas DIN standard (Legrand : 17,5 mm)" />
            <Stepper label="Hauteur" value={doc.print.labelHeightMm} onChange={(v) => setPrint({ labelHeightMm: Math.round(v * 10) / 10 })} step={0.5} min={8} max={20} decimals={1} suffix="mm" hint="Mesurez votre porte-étiquette" />
            <Stepper label="Taille du texte" value={doc.print.fontSizePt} onChange={(v) => setPrint({ fontSizePt: Math.round(v * 10) / 10 })} step={0.5} min={5} max={14} decimals={1} suffix="pt" />
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 text-sm font-semibold">
              Imprimer le repère dans le coin
              <input type="checkbox" checked={doc.print.showRef} onChange={(e) => setPrint({ showRef: e.target.checked })} className="size-5 accent-blue-600" />
            </label>
            <button type="button" onClick={() => setPreview('labels')} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700" data-testid="print-labels">
              <Printer className="size-5" aria-hidden /> Imprimer étiquettes
            </button>
          </section>

          <section className={card} data-testid="calibration">
            <h3 className="flex items-center gap-2 font-bold">
              <Ruler className="size-4" aria-hidden /> Calibration de l’imprimante
            </h3>
            <p className="text-sm text-slate-600">
              Correction actuelle : <strong>{correction >= 0 ? '+' : ''}{String(correction).replace('.', ',')} %</strong> (enregistrée sur cet appareil)
            </p>
            <button type="button" onClick={() => void printRuler()} className={btnSecondary}>
              <Printer className="size-4" aria-hidden /> Imprimer la règle de {CALIBRATION_LENGTH_MM} mm
            </button>
            <div className="flex gap-2">
              <label className="flex min-h-11 flex-1 items-center gap-1 rounded-xl border border-slate-300 px-3 focus-within:border-blue-500">
                <input inputMode="decimal" value={measured} onChange={(e) => setMeasured(e.target.value)} placeholder="Mesure (ex. 49,4)" aria-label="Longueur mesurée en millimètres" className="min-w-0 flex-1 bg-transparent outline-none" />
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

          <section className={card}>
            <h3 className="font-bold">Sauvegarde du projet</h3>
            <button
              type="button"
              onClick={async () => {
                await savePanelProject(usePanelEditor.getState().project!);
                toast.success('Projet enregistré');
              }}
              className={btnSecondary}
            >
              <Save className="size-4" aria-hidden /> Enregistrer
            </button>
            <button
              type="button"
              onClick={async () => {
                const { blob, filename } = panelProjectFile(usePanelEditor.getState().project!);
                const r = await shareOrDownload(blob, filename, project.name);
                if (r !== 'cancelled') toast.success('Sauvegarde exportée');
              }}
              className={btnSecondary}
              data-testid="export-project"
            >
              <Download className="size-4" aria-hidden /> Exporter le projet (.mgtableau)
            </button>
          </section>
        </aside>
      </div>
      {preview && <PrintPreview project={project} kind={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
