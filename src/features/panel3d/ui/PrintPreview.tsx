import { useEffect, useMemo, useState } from 'react';
import { FileDown, Minus, Plus, Printer, X } from 'lucide-react';
import type { PanelProject } from '../types';
import { layoutSheet, loadCorrectionPercent, panelHeader, percentToScale } from '../print/labelSheet';
import { SheetPageSvg } from '../print/SheetPageSvg';
import { SchemaPageSvg, commonOrientation, docsFor } from '../print/schemaSheet';
import { toast } from '../../../store/toastStore';
import { shareOrDownload } from '../../../utils/download';
import { pdfBytesToBlob } from '../../../services/printerService/pdfPrint';

/**
 * Aperçu avant impression, à l'échelle : Zoom, Imprimer, PDF, Annuler.
 * `kind` = schéma tableau (un ou tous les tableaux) ou étiquettes du tableau actif.
 */

export type PreviewKind = 'schema' | 'labels';

interface Props {
  project: PanelProject;
  kind: PreviewKind;
  onClose: () => void;
}

function safeName(s: string): string {
  return s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'tableau';
}

export function PrintPreview({ project, kind, onClose }: Props) {
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const docs = useMemo(() => docsFor(project, kind === 'labels' ? 'current' : scope), [project, kind, scope]);
  const scale = percentToScale(loadCorrectionPercent());
  const labelLayout = useMemo(() => (kind === 'labels' ? layoutSheet(docs[0], scale) : null), [kind, docs, scale]);
  const orientation = commonOrientation(docs);
  const pageWidthMm = kind === 'labels' ? (labelLayout?.pageWidthMm ?? 297) : orientation === 'portrait' ? 210 : 297;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const print = async () => {
    try {
      const m = await import('../print/panelPrint');
      if (kind === 'labels') m.printLabels(docs[0]);
      else m.printSchema(docs);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impression impossible');
    }
  };
  const pdf = async () => {
    setBusy(true);
    try {
      const { buildPanelPdf } = await import('../print/panelPdf');
      const bytes = await buildPanelPdf(project, kind, kind === 'labels' ? 'current' : scope);
      const name = `${safeName(project.name)}-${kind === 'labels' ? `etiquettes-${safeName(docs[0].title)}` : scope === 'all' ? 'schemas' : `schema-${safeName(docs[0].title)}`}.pdf`;
      const res = await shareOrDownload(pdfBytesToBlob(bytes), name, project.name);
      if (res !== 'cancelled') toast.success('PDF exporté');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export PDF impossible');
    } finally {
      setBusy(false);
    }
  };

  const pageWidthPx = `${Math.round(pageWidthMm * 3.2 * zoom)}px`;
  const btn = 'inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold';

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-200" role="dialog" aria-modal aria-label="Aperçu avant impression" data-testid="print-preview">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-300 bg-white px-3 py-2 pt-safe">
        <p className="mr-auto font-bold text-slate-900">{kind === 'labels' ? `Étiquettes — ${docs[0].title}` : 'Schéma tableau'}</p>
        {kind === 'schema' && project.boards.length > 1 && (
          <div role="radiogroup" aria-label="Tableaux à imprimer" className="inline-flex rounded-xl bg-slate-100 p-1">
            {(
              [
                ['current', 'Ce tableau'],
                ['all', `Tous (${project.boards.length})`],
              ] as const
            ).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={scope === v} onClick={() => setScope(v)} className={`min-h-8 rounded-lg px-3 text-sm font-semibold ${scope === v ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
                {l}
              </button>
            ))}
          </div>
        )}
        <div className="inline-flex rounded-xl border border-slate-300">
          <button type="button" aria-label="Zoom arrière" onClick={() => setZoom((z) => Math.max(0.4, z / 1.25))} className="inline-flex size-10 items-center justify-center hover:bg-slate-50">
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="inline-flex min-w-14 items-center justify-center border-x border-slate-300 text-sm tabular-nums">{Math.round(zoom * 100)} %</span>
          <button type="button" aria-label="Zoom avant" onClick={() => setZoom((z) => Math.min(4, z * 1.25))} className="inline-flex size-10 items-center justify-center hover:bg-slate-50">
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        <button type="button" onClick={() => void print()} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`} data-testid="preview-print">
          <Printer className="size-4" aria-hidden /> Imprimer
        </button>
        <button type="button" disabled={busy} onClick={() => void pdf()} className={`${btn} border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50`} data-testid="preview-pdf">
          <FileDown className="size-4" aria-hidden /> {busy ? 'PDF…' : 'PDF'}
        </button>
        <button type="button" onClick={onClose} className={`${btn} border border-slate-300 bg-white hover:bg-slate-50`} data-testid="preview-cancel">
          <X className="size-4" aria-hidden /> Annuler
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto flex w-max flex-col items-center gap-4">
          {kind === 'schema' &&
            docs.map((d, i) => (
              <div key={d.id} className="bg-white shadow-lg" style={{ width: pageWidthPx }}>
                <SchemaPageSvg doc={d} orientation={orientation} uid={`pv${i}`} screenWidth="100%" />
              </div>
            ))}
          {kind === 'labels' && labelLayout && labelLayout.pages.length === 0 && <p className="rounded-xl bg-white p-6 text-slate-600">Aucune étiquette à imprimer : posez d’abord des appareils.</p>}
          {kind === 'labels' &&
            labelLayout?.pages.map((strips, i) => (
              <div key={i} className="bg-white shadow-lg" style={{ width: pageWidthPx }}>
                <SheetPageSvg layout={labelLayout} strips={strips} pageIndex={i} header={panelHeader(docs[0])} fontPt={docs[0].print.fontSizePt} scale={scale} uid={`lv${i}`} screenWidth="100%" showRef={docs[0].print.showRef} />
              </div>
            ))}
        </div>
        <p className="mt-3 text-center text-xs text-slate-600">À l’impression : format A4, échelle 100 %, « Ajuster à la page » désactivé.</p>
      </div>
    </div>
  );
}
